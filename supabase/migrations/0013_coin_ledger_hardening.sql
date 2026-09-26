-- Production wallet hardening and user-to-user coin sending.
-- Every balance mutation is performed inside Postgres while the affected
-- profile rows are locked. Idempotency keys make retries safe.

alter table public.profiles
  add column if not exists profile_visibility text not null default 'private';
update public.profiles
set profile_visibility = 'private'
where profile_visibility is null or profile_visibility not in ('public', 'private');
alter table public.profiles alter column profile_visibility set default 'private';
alter table public.profiles alter column profile_visibility set not null;
alter table public.profiles drop constraint if exists profiles_profile_visibility_check;
alter table public.profiles add constraint profiles_profile_visibility_check
  check (profile_visibility in ('public', 'private'));

-- RLS limits rows, not columns. Remove broad profile UPDATE permission so a
-- browser cannot edit role, ban, wallet, referral, or ownership fields.
revoke update on table public.profiles from anon, authenticated;
grant update (
  display_name,
  avatar_url,
  bio,
  interests,
  profile_visibility,
  updated_at
) on table public.profiles to authenticated;

create or replace function public.touch_my_last_seen()
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  v_seen timestamptz := now();
begin
  if auth.uid() is null then return null; end if;
  update public.profiles set last_seen = v_seen where id = auth.uid();
  return v_seen;
end;
$$;

revoke execute on function public.touch_my_last_seen() from public, anon;
grant execute on function public.touch_my_last_seen() to authenticated;

create or replace function public.ensure_my_referral_code()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_code text;
begin
  if auth.uid() is null then return null; end if;
  update public.profiles
  set referral_code = coalesce(
    referral_code,
    lower(substr(replace(auth.uid()::text, '-', ''), 1, 10))
  )
  where id = auth.uid()
  returning referral_code into v_code;
  return v_code;
end;
$$;

revoke execute on function public.ensure_my_referral_code() from public, anon;
grant execute on function public.ensure_my_referral_code() to authenticated;

alter table public.coin_transactions drop constraint if exists coin_transactions_type_check;
alter table public.coin_transactions add constraint coin_transactions_type_check
  check (type in (
    'referral_reward',
    'connection_reward',
    'admin_adjustment',
    'redemption',
    'coin_purchase',
    'coin_transfer'
  ));

alter table public.app_settings
  add column if not exists coin_sends_enabled boolean not null default true,
  add column if not exists minimum_send_coins bigint not null default 1,
  add column if not exists daily_send_limit_coins bigint not null default 100000,
  add column if not exists daily_send_count_limit integer not null default 20;

alter table public.app_settings
  drop constraint if exists app_settings_minimum_send_coins_check,
  drop constraint if exists app_settings_daily_send_limit_coins_check,
  drop constraint if exists app_settings_daily_send_count_limit_check;
alter table public.app_settings
  add constraint app_settings_minimum_send_coins_check check (minimum_send_coins between 1 and 100000),
  add constraint app_settings_daily_send_limit_coins_check check (daily_send_limit_coins between 1 and 10000000),
  add constraint app_settings_daily_send_count_limit_check check (daily_send_count_limit between 1 and 100);

create table if not exists public.coin_transfers (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  amount bigint not null check (amount between 1 and 1000000),
  note text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (sender_id, idempotency_key),
  check (sender_id <> recipient_id),
  check (note is null or char_length(note) <= 160)
);

create index if not exists coin_transfers_sender_created_idx
  on public.coin_transfers(sender_id, created_at desc);
create index if not exists coin_transfers_recipient_created_idx
  on public.coin_transfers(recipient_id, created_at desc);

alter table public.coin_transfers enable row level security;
drop policy if exists "users can view their own coin transfers" on public.coin_transfers;
create policy "users can view their own coin transfers"
  on public.coin_transfers for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create or replace function public.send_coins(
  p_recipient text,
  p_amount bigint,
  p_note text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_recipient_id uuid;
  v_transfer_id uuid;
  v_sender_balance bigint;
  v_sender_reserved bigint;
  v_recipient_balance bigint;
  v_sent_count bigint;
  v_sent_amount bigint;
  v_sends_enabled boolean;
  v_minimum_send bigint;
  v_daily_amount_limit bigint;
  v_daily_count_limit integer;
  v_sender_name text;
  v_recipient_name text;
begin
  if v_sender_id is null then
    return jsonb_build_object('ok', false, 'error', 'Sign in to send coins.');
  end if;

  select coin_sends_enabled, minimum_send_coins, daily_send_limit_coins, daily_send_count_limit
    into v_sends_enabled, v_minimum_send, v_daily_amount_limit, v_daily_count_limit
  from public.app_settings where id = true;
  v_minimum_send := coalesce(v_minimum_send, 1);
  v_daily_amount_limit := coalesce(v_daily_amount_limit, 100000);
  v_daily_count_limit := coalesce(v_daily_count_limit, 20);

  if not coalesce(v_sends_enabled, false) then
    return jsonb_build_object('ok', false, 'error', 'Coin sending is temporarily paused.');
  end if;
  if p_amount is null or p_amount < v_minimum_send or p_amount > 1000000 then
    return jsonb_build_object('ok', false, 'error', 'Enter a valid whole coin amount.');
  end if;
  if length(trim(coalesce(p_recipient, ''))) < 3 then
    return jsonb_build_object('ok', false, 'error', 'Enter the recipient email or referral code.');
  end if;
  if char_length(trim(coalesce(p_note, ''))) > 160 then
    return jsonb_build_object('ok', false, 'error', 'The note must be 160 characters or fewer.');
  end if;
  if length(trim(coalesce(p_idempotency_key, ''))) not between 16 and 120 then
    return jsonb_build_object('ok', false, 'error', 'This send request is invalid.');
  end if;

  select id into v_transfer_id
  from public.coin_transfers
  where sender_id = v_sender_id and idempotency_key = trim(p_idempotency_key);
  if v_transfer_id is not null then
    return jsonb_build_object('ok', true, 'transfer_id', v_transfer_id, 'already_processed', true);
  end if;

  select id, coalesce(nullif(display_name, ''), 'Omegley member')
    into v_recipient_id, v_recipient_name
  from public.profiles
  where is_banned = false
    and (
      lower(email) = lower(trim(p_recipient))
      or lower(referral_code) = lower(trim(p_recipient))
    )
  limit 1;

  if v_recipient_id is null then
    return jsonb_build_object('ok', false, 'error', 'No eligible account matches that email or referral code.');
  end if;
  if v_recipient_id = v_sender_id then
    return jsonb_build_object('ok', false, 'error', 'You cannot send coins to your own account.');
  end if;

  -- Lock in UUID order so two users sending to each other cannot deadlock.
  perform 1
  from public.profiles
  where id in (v_sender_id, v_recipient_id)
  order by id
  for update;

  -- A retry may have waited on the sender lock while the first request committed.
  select id into v_transfer_id
  from public.coin_transfers
  where sender_id = v_sender_id and idempotency_key = trim(p_idempotency_key);
  if v_transfer_id is not null then
    return jsonb_build_object('ok', true, 'transfer_id', v_transfer_id, 'already_processed', true);
  end if;

  select coin_balance, reserved_coins, coalesce(nullif(display_name, ''), 'Omegley member')
    into v_sender_balance, v_sender_reserved, v_sender_name
  from public.profiles where id = v_sender_id;
  if v_sender_balance - v_sender_reserved < p_amount then
    return jsonb_build_object('ok', false, 'error', 'Your available balance is too low.');
  end if;

  select count(*), coalesce(sum(amount), 0)
    into v_sent_count, v_sent_amount
  from public.coin_transfers
  where sender_id = v_sender_id and created_at >= now() - interval '24 hours';
  if v_sent_count >= v_daily_count_limit or v_sent_amount + p_amount > v_daily_amount_limit then
    return jsonb_build_object('ok', false, 'error', 'Your 24-hour sending limit has been reached.');
  end if;

  insert into public.coin_transfers (sender_id, recipient_id, amount, note, idempotency_key)
  values (
    v_sender_id,
    v_recipient_id,
    p_amount,
    nullif(trim(coalesce(p_note, '')), ''),
    trim(p_idempotency_key)
  )
  returning id into v_transfer_id;

  update public.profiles
  set coin_balance = coin_balance - p_amount
  where id = v_sender_id
  returning coin_balance into v_sender_balance;

  update public.profiles
  set coin_balance = coin_balance + p_amount
  where id = v_recipient_id
  returning coin_balance into v_recipient_balance;

  insert into public.coin_transactions (
    user_id, type, amount, balance_after, event_key, description
  ) values
    (
      v_sender_id,
      'coin_transfer',
      -p_amount,
      v_sender_balance,
      'send:' || v_transfer_id::text || ':out',
      'Coins sent to ' || v_recipient_name
    ),
    (
      v_recipient_id,
      'coin_transfer',
      p_amount,
      v_recipient_balance,
      'send:' || v_transfer_id::text || ':in',
      'Coins received from ' || v_sender_name
    );

  return jsonb_build_object(
    'ok', true,
    'transfer_id', v_transfer_id,
    'recipient_name', v_recipient_name,
    'balance', v_sender_balance,
    'already_processed', false
  );
end;
$$;

revoke execute on function public.send_coins(text, bigint, text, text) from public, anon;
grant execute on function public.send_coins(text, bigint, text, text) to authenticated;

-- A wallet that has already been claimed must never accept more anonymous
-- rewards; otherwise a stale browser tab could create stranded coins.
create or replace function public.reward_anonymous_connection(
  p_wallet_id text,
  p_event_key text
)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_balance bigint;
  v_reward bigint;
  v_daily_limit bigint;
  v_earned_today bigint;
  v_inserted integer;
begin
  if not coalesce((select connection_rewards_enabled from public.app_settings where id = true), false)
    or p_wallet_id is null or length(trim(p_wallet_id)) < 16
    or p_event_key is null or length(trim(p_event_key)) not between 16 and 120 then return 0; end if;

  select connection_reward_coins, daily_connection_reward_limit
    into v_reward, v_daily_limit
  from public.app_settings where id = true;
  v_reward := coalesce(v_reward, 10);
  v_daily_limit := coalesce(v_daily_limit, 100);

  insert into public.anonymous_wallets (wallet_hash)
  values (encode(digest(trim(p_wallet_id), 'sha256'), 'hex'))
  on conflict (wallet_hash) do nothing;

  select id into v_wallet_id
  from public.anonymous_wallets
  where wallet_hash = encode(digest(trim(p_wallet_id), 'sha256'), 'hex')
    and claimed_by is null
  for update;
  if v_wallet_id is null then return 0; end if;

  select coalesce(sum(amount), 0) into v_earned_today
  from public.anonymous_wallet_transactions
  where wallet_id = v_wallet_id
    and type = 'connection_reward'
    and created_at >= date_trunc('day', now());
  if v_earned_today + v_reward > v_daily_limit then return 0; end if;

  insert into public.anonymous_wallet_transactions (
    wallet_id, type, amount, balance_after, event_key, description
  ) values (
    v_wallet_id, 'connection_reward', v_reward, 0, trim(p_event_key), 'Completed mutual connection reward'
  ) on conflict (event_key) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 0; end if;

  update public.anonymous_wallets
  set coin_balance = coin_balance + v_reward,
      total_earned = total_earned + v_reward,
      last_earned_at = now()
  where id = v_wallet_id and claimed_by is null
  returning coin_balance into v_balance;
  if v_balance is null then return 0; end if;

  update public.anonymous_wallet_transactions
  set balance_after = v_balance
  where wallet_id = v_wallet_id and event_key = trim(p_event_key);
  return v_balance;
end;
$$;

revoke execute on function public.reward_anonymous_connection(text, text) from public;
grant execute on function public.reward_anonymous_connection(text, text) to anon, authenticated;

alter table public.withdrawal_requests
  add column if not exists idempotency_key text;
drop policy if exists "users can request withdrawals" on public.withdrawal_requests;
revoke insert on table public.withdrawal_requests from anon, authenticated;
create unique index if not exists withdrawal_requests_user_idempotency_idx
  on public.withdrawal_requests(user_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.request_withdrawal_v2(
  p_amount_coins bigint,
  p_method text,
  p_destination text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_request_id uuid;
  v_enabled boolean;
  v_minimum bigint;
begin
  if auth.uid() is null
    or p_amount_coins is null
    or p_method is null or p_method not in ('gift_card', 'cash_pending')
    or length(trim(coalesce(p_destination, ''))) < 3
    or length(trim(coalesce(p_idempotency_key, ''))) not between 16 and 120 then
    return null;
  end if;

  select id into v_request_id
  from public.withdrawal_requests
  where user_id = auth.uid() and idempotency_key = trim(p_idempotency_key);
  if v_request_id is not null then return v_request_id; end if;

  select withdrawals_enabled, withdrawal_minimum_coins
    into v_enabled, v_minimum
  from public.app_settings where id = true;
  if not coalesce(v_enabled, false) or p_amount_coins < coalesce(v_minimum, 5000) then
    return null;
  end if;

  perform 1 from public.profiles where id = auth.uid() for update;
  select id into v_request_id
  from public.withdrawal_requests
  where user_id = auth.uid() and idempotency_key = trim(p_idempotency_key);
  if v_request_id is not null then return v_request_id; end if;

  update public.profiles
  set reserved_coins = reserved_coins + p_amount_coins
  where id = auth.uid() and coin_balance - reserved_coins >= p_amount_coins;
  if not found then return null; end if;

  insert into public.withdrawal_requests (
    user_id, amount_coins, method, destination, idempotency_key
  ) values (
    auth.uid(), p_amount_coins, p_method, trim(p_destination), trim(p_idempotency_key)
  )
  returning id into v_request_id;
  return v_request_id;
end;
$$;

revoke execute on function public.request_withdrawal_v2(bigint, text, text, text) from public, anon;
grant execute on function public.request_withdrawal_v2(bigint, text, text, text) to authenticated;
revoke execute on function public.request_withdrawal(bigint, text, text) from public, anon, authenticated;

create or replace function public.admin_credit_coins(
  p_user_id uuid,
  p_amount bigint,
  p_message text,
  p_idempotency_key text
)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance bigint;
  v_event_key text := 'admin-credit:' || coalesce(p_user_id::text, '') || ':' || trim(coalesce(p_idempotency_key, ''));
begin
  if p_user_id is null
    or p_amount is null or p_amount < 1 or p_amount > 1000000
    or length(trim(coalesce(p_message, ''))) not between 1 and 240
    or length(trim(coalesce(p_idempotency_key, ''))) not between 16 and 120 then
    return null;
  end if;

  select balance_after into v_balance
  from public.coin_transactions where event_key = v_event_key;
  if v_balance is not null then return v_balance; end if;

  select coin_balance into v_balance
  from public.profiles where id = p_user_id for update;
  if not found then return null; end if;

  select balance_after into v_balance
  from public.coin_transactions where event_key = v_event_key;
  if v_balance is not null then return v_balance; end if;

  update public.profiles
  set coin_balance = coin_balance + p_amount,
      total_earned = total_earned + p_amount
  where id = p_user_id
  returning coin_balance into v_balance;

  insert into public.coin_transactions (
    user_id, type, amount, balance_after, event_key, description
  ) values (
    p_user_id, 'admin_adjustment', p_amount, v_balance, v_event_key, trim(p_message)
  );
  return v_balance;
end;
$$;

revoke execute on function public.admin_credit_coins(uuid, bigint, text, text) from public, anon, authenticated;
grant execute on function public.admin_credit_coins(uuid, bigint, text, text) to service_role;

create or replace function public.admin_process_withdrawal(
  p_withdrawal_id uuid,
  p_next_status text,
  p_admin_note text,
  p_reviewer_id uuid
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_request record;
  v_balance bigint;
  v_reserved bigint;
begin
  if p_withdrawal_id is null
    or p_next_status is null or p_next_status not in ('approved', 'rejected', 'paid')
    or p_reviewer_id is null
    or char_length(coalesce(p_admin_note, '')) > 240 then
    return jsonb_build_object('ok', false, 'error', 'Invalid withdrawal decision.');
  end if;

  select * into v_request
  from public.withdrawal_requests
  where id = p_withdrawal_id
  for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Withdrawal request was not found.'); end if;

  if v_request.status = p_next_status then
    return jsonb_build_object('ok', true, 'already_processed', true);
  end if;
  if v_request.status in ('paid', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'This withdrawal is already finalized.');
  end if;
  if v_request.status = 'pending' and p_next_status = 'paid' then
    return jsonb_build_object('ok', false, 'error', 'Approve the withdrawal before marking it paid.');
  end if;

  select coin_balance, reserved_coins into v_balance, v_reserved
  from public.profiles where id = v_request.user_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'The wallet was not found.'); end if;

  if p_next_status = 'rejected' then
    update public.profiles
    set reserved_coins = greatest(0, reserved_coins - v_request.amount_coins)
    where id = v_request.user_id;
  elsif p_next_status = 'paid' then
    if v_balance < v_request.amount_coins or v_reserved < v_request.amount_coins then
      return jsonb_build_object('ok', false, 'error', 'The wallet balance or reserved balance is inconsistent.');
    end if;
    update public.profiles
    set coin_balance = coin_balance - v_request.amount_coins,
        reserved_coins = reserved_coins - v_request.amount_coins
    where id = v_request.user_id
    returning coin_balance into v_balance;

    insert into public.coin_transactions (
      user_id, type, amount, balance_after, event_key, description
    ) values (
      v_request.user_id,
      'redemption',
      -v_request.amount_coins,
      v_balance,
      'withdrawal:' || v_request.id::text,
      'Withdrawal paid'
    ) on conflict (event_key) do nothing;
  end if;

  update public.withdrawal_requests
  set status = p_next_status,
      reviewed_at = now(),
      reviewed_by = p_reviewer_id,
      admin_note = case
        when p_admin_note is null then admin_note
        else nullif(trim(p_admin_note), '')
      end
  where id = p_withdrawal_id;

  return jsonb_build_object('ok', true, 'already_processed', false);
end;
$$;

revoke execute on function public.admin_process_withdrawal(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_process_withdrawal(uuid, text, text, uuid) to service_role;

drop function if exists public.get_public_wallet_settings();
create function public.get_public_wallet_settings()
returns table (
  withdrawals_enabled boolean,
  withdrawal_minimum_coins bigint,
  connection_reward_coins bigint,
  referral_reward_coins bigint,
  daily_connection_reward_limit bigint,
  referral_qualification_days integer,
  mutual_connection_required boolean,
  coin_sends_enabled boolean,
  minimum_send_coins bigint,
  daily_send_limit_coins bigint,
  daily_send_count_limit integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(withdrawals_enabled, false),
    coalesce(withdrawal_minimum_coins, 5000),
    coalesce(connection_reward_coins, 10),
    coalesce(referral_reward_coins, 100),
    coalesce(daily_connection_reward_limit, 100),
    coalesce(referral_qualification_days, 7),
    coalesce(mutual_connection_required, true),
    coalesce(coin_sends_enabled, false),
    coalesce(minimum_send_coins, 1),
    coalesce(daily_send_limit_coins, 100000),
    coalesce(daily_send_count_limit, 20)
  from public.app_settings
  where id = true;
$$;

revoke execute on function public.get_public_wallet_settings() from public;
grant execute on function public.get_public_wallet_settings() to anon, authenticated;
