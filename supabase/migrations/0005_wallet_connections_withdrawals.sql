-- Wallet v2: 100 coins = $1.00.
-- Connection rewards are 10 coins per completed connection.

alter table public.profiles
  add column if not exists reserved_coins bigint not null default 0;

-- Preserve the dollar value of the v1 balances and referral rewards.
update public.profiles
set coin_balance = coin_balance * 100,
    total_earned = total_earned * 100;

update public.coin_transactions
set amount = amount * 100,
    balance_after = balance_after * 100,
    description = case when type = 'referral_reward' then 'Referral reward (100 coins)' else description end
where type = 'referral_reward' or type = 'admin_adjustment';

alter table public.referrals alter column reward_coins set default 100;
update public.referrals set reward_coins = reward_coins * 100;

alter table public.coin_transactions drop constraint if exists coin_transactions_type_check;
alter table public.coin_transactions add constraint coin_transactions_type_check
  check (type in ('referral_reward', 'connection_reward', 'admin_adjustment', 'redemption'));
alter table public.coin_transactions add column if not exists event_key text;
create unique index if not exists coin_transactions_event_key_idx
  on public.coin_transactions(event_key) where event_key is not null;

create table if not exists public.anonymous_wallets (
  id uuid primary key default gen_random_uuid(),
  wallet_hash text not null unique,
  coin_balance bigint not null default 0,
  total_earned bigint not null default 0,
  created_at timestamptz not null default now(),
  last_earned_at timestamptz
);

create table if not exists public.anonymous_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.anonymous_wallets(id) on delete cascade,
  type text not null check (type in ('connection_reward', 'redemption')),
  amount bigint not null,
  balance_after bigint not null,
  event_key text not null unique,
  description text not null,
  created_at timestamptz not null default now()
);
alter table public.anonymous_wallets add column if not exists claimed_by uuid references public.profiles(id) on delete set null;
alter table public.anonymous_wallets add column if not exists claimed_at timestamptz;

create index if not exists anonymous_wallet_transactions_wallet_created_idx
  on public.anonymous_wallet_transactions(wallet_id, created_at desc);

create table if not exists public.friend_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'blocked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, recipient_id),
  check (requester_id <> recipient_id)
);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_coins bigint not null check (amount_coins >= 100),
  amount_usd numeric(12,2) generated always as (amount_coins / 100.0) stored,
  method text not null check (method in ('gift_card', 'cash_pending')),
  destination text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

create index if not exists withdrawal_requests_status_created_idx
  on public.withdrawal_requests(status, created_at desc);

-- Referral rewards remain a separate, higher-value bonus: 100 coins = $1.
create or replace function public.claim_referral(p_referral_code text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_referral_id uuid;
  v_new_balance bigint;
  v_inserted integer;
begin
  if auth.uid() is null or p_referral_code is null or length(trim(p_referral_code)) = 0 then return false; end if;
  select id into v_referrer_id from public.profiles
  where referral_code = lower(trim(p_referral_code)) and id <> auth.uid() limit 1;
  if v_referrer_id is null then return false; end if;
  insert into public.referrals (referrer_id, referred_id, referral_code)
  values (v_referrer_id, auth.uid(), lower(trim(p_referral_code)))
  on conflict (referred_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return false; end if;
  select id into v_referral_id from public.referrals where referred_id = auth.uid();
  update public.profiles set referred_by = v_referrer_id where id = auth.uid();
  update public.profiles set coin_balance = coin_balance + 100, total_earned = total_earned + 100
  where id = v_referrer_id returning coin_balance into v_new_balance;
  insert into public.coin_transactions (user_id, type, amount, balance_after, referral_id, event_key, description)
  values (v_referrer_id, 'referral_reward', 100, v_new_balance, v_referral_id, 'referral:' || v_referral_id::text, 'Referral reward (100 coins)');
  return true;
end;
$$;

alter table public.anonymous_wallets enable row level security;
alter table public.anonymous_wallet_transactions enable row level security;
alter table public.friend_connections enable row level security;
alter table public.withdrawal_requests enable row level security;

drop policy if exists "users can view their own connections" on public.friend_connections;
create policy "users can view their own connections"
  on public.friend_connections for select to authenticated
  using (requester_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "users can create connection requests" on public.friend_connections;
create policy "users can create connection requests"
  on public.friend_connections for insert to authenticated
  with check (requester_id = auth.uid());

drop policy if exists "users can respond to connection requests" on public.friend_connections;
create policy "users can respond to connection requests"
  on public.friend_connections for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists "users can view their withdrawals" on public.withdrawal_requests;
create policy "users can view their withdrawals"
  on public.withdrawal_requests for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "users can request withdrawals" on public.withdrawal_requests;
create policy "users can request withdrawals"
  on public.withdrawal_requests for insert to authenticated
  with check (user_id = auth.uid());

-- The wallet identifier is random on the client; only its SHA-256 hash is stored.
create or replace function public.reward_anonymous_connection(p_wallet_id text, p_event_key text)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  v_wallet_id uuid;
  v_balance bigint;
  v_inserted integer;
begin
  if p_wallet_id is null or length(trim(p_wallet_id)) < 16 or p_event_key is null then return 0; end if;
  insert into public.anonymous_wallets (wallet_hash)
  values (encode(digest(trim(p_wallet_id), 'sha256'), 'hex'))
  on conflict (wallet_hash) do nothing;
  select id into v_wallet_id from public.anonymous_wallets
  where wallet_hash = encode(digest(trim(p_wallet_id), 'sha256'), 'hex');
  insert into public.anonymous_wallet_transactions (wallet_id, type, amount, balance_after, event_key, description)
  values (v_wallet_id, 'connection_reward', 10, 0, p_event_key, 'Completed connection reward')
  on conflict (event_key) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 0; end if;
  update public.anonymous_wallets set coin_balance = coin_balance + 10, total_earned = total_earned + 10, last_earned_at = now()
  where id = v_wallet_id returning coin_balance into v_balance;
  update public.anonymous_wallet_transactions set balance_after = v_balance where wallet_id = v_wallet_id and event_key = p_event_key;
  return v_balance;
end;
$$;

create or replace function public.reward_authenticated_connection(p_event_key text)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance bigint;
  v_inserted integer;
begin
  if auth.uid() is null or p_event_key is null then return 0; end if;
  insert into public.coin_transactions (user_id, type, amount, balance_after, event_key, description)
  values (auth.uid(), 'connection_reward', 10, 0, p_event_key, 'Completed connection reward')
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 0; end if;
  update public.profiles set coin_balance = coin_balance + 10, total_earned = total_earned + 10
  where id = auth.uid() returning coin_balance into v_balance;
  update public.coin_transactions set balance_after = v_balance where event_key = p_event_key;
  return v_balance;
end;
$$;

grant execute on function public.reward_anonymous_connection(text, text) to anon, authenticated;
grant execute on function public.reward_authenticated_connection(text) to authenticated;

create or replace function public.request_withdrawal(p_amount_coins bigint, p_method text, p_destination text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_request_id uuid;
begin
  if auth.uid() is null or p_amount_coins < 100 or p_method not in ('gift_card', 'cash_pending') or length(trim(coalesce(p_destination, ''))) < 3 then
    return null;
  end if;
  update public.profiles
  set reserved_coins = reserved_coins + p_amount_coins
  where id = auth.uid() and coin_balance - reserved_coins >= p_amount_coins;
  if not found then return null; end if;
  insert into public.withdrawal_requests (user_id, amount_coins, method, destination)
  values (auth.uid(), p_amount_coins, p_method, trim(p_destination))
  returning id into v_request_id;
  return v_request_id;
end;
$$;

grant execute on function public.request_withdrawal(bigint, text, text) to authenticated;

create or replace function public.claim_anonymous_wallet(p_wallet_id text)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  v_wallet record;
  v_balance bigint;
begin
  if auth.uid() is null or p_wallet_id is null then return 0; end if;
  select * into v_wallet from public.anonymous_wallets
  where wallet_hash = encode(digest(trim(p_wallet_id), 'sha256'), 'hex') and claimed_by is null
  for update;
  if not found or v_wallet.coin_balance <= 0 then return 0; end if;
  update public.profiles set coin_balance = coin_balance + v_wallet.coin_balance, total_earned = total_earned + v_wallet.coin_balance
  where id = auth.uid() returning coin_balance into v_balance;
  insert into public.coin_transactions (user_id, type, amount, balance_after, event_key, description)
  values (auth.uid(), 'connection_reward', v_wallet.coin_balance, v_balance, 'wallet-claim:' || v_wallet.id::text, 'Anonymous wallet claim');
  update public.anonymous_wallets set claimed_by = auth.uid(), claimed_at = now(), coin_balance = 0 where id = v_wallet.id;
  return v_wallet.coin_balance;
end;
$$;

grant execute on function public.claim_anonymous_wallet(text) to authenticated;
