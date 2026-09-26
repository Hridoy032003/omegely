-- Global earning and withdrawal controls managed from the admin console.

create table if not exists public.app_settings (
  id boolean primary key default true check (id = true),
  withdrawals_enabled boolean not null default true,
  withdrawal_minimum_coins bigint not null default 5000 check (withdrawal_minimum_coins >= 100),
  connection_rewards_enabled boolean not null default true,
  referral_rewards_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

create or replace function public.request_withdrawal(p_amount_coins bigint, p_method text, p_destination text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_request_id uuid;
  v_minimum bigint;
  v_enabled boolean;
begin
  select withdrawals_enabled, withdrawal_minimum_coins into v_enabled, v_minimum from public.app_settings where id = true;
  if auth.uid() is null or not coalesce(v_enabled, false) or p_amount_coins < coalesce(v_minimum, 5000) or p_method not in ('gift_card', 'cash_pending') or length(trim(coalesce(p_destination, ''))) < 3 then
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

create or replace function public.reward_authenticated_connection(p_event_key text)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare v_balance bigint; v_inserted integer; v_enabled boolean;
begin
  select connection_rewards_enabled into v_enabled from public.app_settings where id = true;
  if auth.uid() is null or not coalesce(v_enabled, false) or p_event_key is null then return 0; end if;
  insert into public.coin_transactions (user_id, type, amount, balance_after, event_key, description)
  values (auth.uid(), 'connection_reward', 10, 0, p_event_key, 'Completed connection reward') on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 0; end if;
  update public.profiles set coin_balance = coin_balance + 10, total_earned = total_earned + 10 where id = auth.uid() returning coin_balance into v_balance;
  update public.coin_transactions set balance_after = v_balance where event_key = p_event_key;
  return v_balance;
end;
$$;

create or replace function public.reward_anonymous_connection(p_wallet_id text, p_event_key text)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare v_wallet_id uuid; v_balance bigint; v_inserted integer; v_enabled boolean;
begin
  select connection_rewards_enabled into v_enabled from public.app_settings where id = true;
  if not coalesce(v_enabled, false) or p_wallet_id is null or length(trim(p_wallet_id)) < 16 or p_event_key is null then return 0; end if;
  insert into public.anonymous_wallets (wallet_hash) values (encode(digest(trim(p_wallet_id), 'sha256'), 'hex')) on conflict (wallet_hash) do nothing;
  select id into v_wallet_id from public.anonymous_wallets where wallet_hash = encode(digest(trim(p_wallet_id), 'sha256'), 'hex');
  insert into public.anonymous_wallet_transactions (wallet_id, type, amount, balance_after, event_key, description) values (v_wallet_id, 'connection_reward', 10, 0, p_event_key, 'Completed connection reward') on conflict (event_key) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return 0; end if;
  update public.anonymous_wallets set coin_balance = coin_balance + 10, total_earned = total_earned + 10, last_earned_at = now() where id = v_wallet_id returning coin_balance into v_balance;
  update public.anonymous_wallet_transactions set balance_after = v_balance where wallet_id = v_wallet_id and event_key = p_event_key;
  return v_balance;
end;
$$;

create or replace function public.claim_referral(p_referral_code text)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare v_referrer_id uuid; v_referral_id uuid; v_new_balance bigint; v_inserted integer; v_enabled boolean;
begin
  select referral_rewards_enabled into v_enabled from public.app_settings where id = true;
  if auth.uid() is null or not coalesce(v_enabled, false) or p_referral_code is null or length(trim(p_referral_code)) = 0 then return false; end if;
  select id into v_referrer_id from public.profiles where referral_code = lower(trim(p_referral_code)) and id <> auth.uid() limit 1;
  if v_referrer_id is null then return false; end if;
  insert into public.referrals (referrer_id, referred_id, referral_code) values (v_referrer_id, auth.uid(), lower(trim(p_referral_code))) on conflict (referred_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return false; end if;
  select id into v_referral_id from public.referrals where referred_id = auth.uid();
  update public.profiles set referred_by = v_referrer_id where id = auth.uid();
  update public.profiles set coin_balance = coin_balance + 100, total_earned = total_earned + 100 where id = v_referrer_id returning coin_balance into v_new_balance;
  insert into public.coin_transactions (user_id, type, amount, balance_after, referral_id, event_key, description) values (v_referrer_id, 'referral_reward', 100, v_new_balance, v_referral_id, 'referral:' || v_referral_id::text, 'Referral reward (100 coins)');
  return true;
end;
$$;
