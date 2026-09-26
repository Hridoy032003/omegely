-- Reward safety controls and qualified referral workflow.
-- Rewards remain server-authoritative: the browser can request an event, but
-- Postgres decides whether the event is eligible and within the daily budget.

alter table public.app_settings
  add column if not exists connection_reward_coins bigint not null default 10,
  add column if not exists referral_reward_coins bigint not null default 100,
  add column if not exists daily_connection_reward_limit bigint not null default 100,
  add column if not exists referral_qualification_days integer not null default 7,
  add column if not exists mutual_connection_required boolean not null default true;

alter table public.app_settings
  drop constraint if exists app_settings_connection_reward_coins_check,
  drop constraint if exists app_settings_referral_reward_coins_check,
  drop constraint if exists app_settings_daily_connection_reward_limit_check,
  drop constraint if exists app_settings_referral_qualification_days_check;

alter table public.app_settings
  add constraint app_settings_connection_reward_coins_check check (connection_reward_coins between 1 and 1000),
  add constraint app_settings_referral_reward_coins_check check (referral_reward_coins between 1 and 5000),
  add constraint app_settings_daily_connection_reward_limit_check check (daily_connection_reward_limit between 1 and 10000),
  add constraint app_settings_referral_qualification_days_check check (referral_qualification_days between 1 and 30);

alter table public.referrals alter column qualified_at drop not null;
alter table public.referrals drop constraint if exists referrals_status_check;
alter table public.referrals
  add constraint referrals_status_check check (status in ('pending', 'qualified', 'reversed'));

-- Existing functions accepted a referral and paid immediately. New referrals
-- stay pending until the referred account has returned after the qualification
-- window. The referred account's last_seen is updated by the public app.
create or replace function public.claim_referral(p_referral_code text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_reward bigint;
  v_inserted integer;
begin
  select referral_reward_coins into v_reward
  from public.app_settings where id = true;

  if auth.uid() is null
    or not coalesce((select referral_rewards_enabled from public.app_settings where id = true), false)
    or p_referral_code is null
    or length(trim(p_referral_code)) = 0 then
    return false;
  end if;

  select id into v_referrer_id
  from public.profiles
  where referral_code = lower(trim(p_referral_code))
    and id <> auth.uid()
  limit 1;

  if v_referrer_id is null then return false; end if;

  insert into public.referrals (referrer_id, referred_id, referral_code, status, reward_coins, qualified_at)
  values (v_referrer_id, auth.uid(), lower(trim(p_referral_code)), 'pending', coalesce(v_reward, 100), null)
  on conflict (referred_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then return false; end if;

  update public.profiles
  set referred_by = v_referrer_id
  where id = auth.uid();

  return true;
end;
$$;

-- Called when a signed-in user opens the account or wallet. It is safe to call
-- repeatedly and only qualifies referrals belonging to the current referrer.
create or replace function public.qualify_referrals()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_days integer;
  v_count integer := 0;
  v_referral record;
  v_balance bigint;
begin
  if auth.uid() is null
    or not coalesce((select referral_rewards_enabled from public.app_settings where id = true), false) then
    return 0;
  end if;

  select referral_qualification_days into v_days
  from public.app_settings where id = true;
  v_days := coalesce(v_days, 7);

  for v_referral in
    select r.id, r.referred_id, r.reward_coins
    from public.referrals r
    join public.profiles referred on referred.id = r.referred_id
    where r.referrer_id = auth.uid()
      and r.status = 'pending'
      and referred.created_at <= now() - make_interval(days => v_days)
      and referred.last_seen >= r.created_at + make_interval(days => v_days)
    for update of r
  loop
    update public.profiles
    set coin_balance = coin_balance + v_referral.reward_coins,
        total_earned = total_earned + v_referral.reward_coins
    where id = auth.uid()
    returning coin_balance into v_balance;

    update public.referrals
    set status = 'qualified', qualified_at = now()
    where id = v_referral.id;

    insert into public.coin_transactions (
      user_id, type, amount, balance_after, referral_id, event_key, description
    ) values (
      auth.uid(),
      'referral_reward',
      v_referral.reward_coins,
      v_balance,
      v_referral.id,
      'referral:' || v_referral.id::text,
      'Qualified referral reward'
    ) on conflict (event_key) do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.qualify_referrals() to authenticated;

-- Replace the connection reward functions with capped versions. The daily
-- limit is per authenticated profile or anonymous wallet, not global.
create or replace function public.reward_authenticated_connection(p_event_key text)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance bigint;
  v_reward bigint;
  v_daily_limit bigint;
  v_earned_today bigint;
  v_inserted integer;
begin
  if auth.uid() is null
    or not coalesce((select connection_rewards_enabled from public.app_settings where id = true), false)
    or p_event_key is null
    or length(trim(p_event_key)) not between 16 and 120 then return 0; end if;

  select connection_reward_coins, daily_connection_reward_limit
    into v_reward, v_daily_limit
  from public.app_settings where id = true;
  v_reward := coalesce(v_reward, 10);
  v_daily_limit := coalesce(v_daily_limit, 100);

  select coin_balance into v_balance
  from public.profiles where id = auth.uid() for update;
  if not found then return 0; end if;

  select coalesce(sum(amount), 0) into v_earned_today
  from public.coin_transactions
  where user_id = auth.uid()
    and type = 'connection_reward'
    and created_at >= date_trunc('day', now());
  if v_earned_today + v_reward > v_daily_limit then return 0; end if;

  insert into public.coin_transactions (user_id, type, amount, balance_after, event_key, description)
  values (auth.uid(), 'connection_reward', v_reward, 0, trim(p_event_key), 'Completed mutual connection reward')
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 0; end if;

  update public.profiles
  set coin_balance = coin_balance + v_reward,
      total_earned = total_earned + v_reward
  where id = auth.uid()
  returning coin_balance into v_balance;

  update public.coin_transactions set balance_after = v_balance where event_key = trim(p_event_key);
  return v_balance;
end;
$$;

create or replace function public.reward_anonymous_connection(p_wallet_id text, p_event_key text)
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
  select id into v_wallet_id from public.anonymous_wallets
  where wallet_hash = encode(digest(trim(p_wallet_id), 'sha256'), 'hex')
  for update;

  select coalesce(sum(amount), 0) into v_earned_today
  from public.anonymous_wallet_transactions
  where wallet_id = v_wallet_id
    and type = 'connection_reward'
    and created_at >= date_trunc('day', now());
  if v_earned_today + v_reward > v_daily_limit then return 0; end if;

  insert into public.anonymous_wallet_transactions (wallet_id, type, amount, balance_after, event_key, description)
  values (v_wallet_id, 'connection_reward', v_reward, 0, trim(p_event_key), 'Completed mutual connection reward')
  on conflict (event_key) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 0; end if;

  update public.anonymous_wallets
  set coin_balance = coin_balance + v_reward,
      total_earned = total_earned + v_reward,
      last_earned_at = now()
  where id = v_wallet_id
  returning coin_balance into v_balance;
  update public.anonymous_wallet_transactions set balance_after = v_balance where event_key = trim(p_event_key);
  return v_balance;
end;
$$;

-- The public wallet only receives safe policy values, never the private
-- admin settings row.
drop function if exists public.get_public_wallet_settings();
create function public.get_public_wallet_settings()
returns table (
  withdrawals_enabled boolean,
  withdrawal_minimum_coins bigint,
  connection_reward_coins bigint,
  referral_reward_coins bigint,
  daily_connection_reward_limit bigint,
  referral_qualification_days integer,
  mutual_connection_required boolean
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
    coalesce(mutual_connection_required, true)
  from public.app_settings
  where id = true;
$$;

grant execute on function public.get_public_wallet_settings() to anon, authenticated;

-- Anonymous reports use only one-way session hashes supplied by the client.
-- This preserves the existing no-account chat flow while preventing raw
-- session identifiers from being stored.
create or replace function public.submit_anonymous_report(
  p_reporter_session_hash text,
  p_target_session_hash text,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_report_id uuid;
begin
  if length(trim(coalesce(p_reporter_session_hash, ''))) < 32
    or length(trim(coalesce(p_target_session_hash, ''))) < 32
    or char_length(trim(coalesce(p_reason, ''))) not between 3 and 80
    or char_length(trim(coalesce(p_details, ''))) > 2000 then
    return null;
  end if;

  if (
    select count(*) from public.reports
    where reporter_session_hash = trim(p_reporter_session_hash)
      and created_at >= now() - interval '12 hours'
  ) >= 5 then
    return null;
  end if;

  insert into public.reports (reporter_id, reporter_session_hash, target_session_hash, reason, details)
  values (auth.uid(), trim(p_reporter_session_hash), trim(p_target_session_hash), trim(p_reason), nullif(trim(p_details), ''))
  returning id into v_report_id;
  return v_report_id;
end;
$$;

grant execute on function public.submit_anonymous_report(text, text, text, text) to anon, authenticated;
