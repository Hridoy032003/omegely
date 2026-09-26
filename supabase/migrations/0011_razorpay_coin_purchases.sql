-- Razorpay coin purchases. Money is verified server-side; this table is never
-- credited directly by the browser.

alter table public.coin_transactions drop constraint if exists coin_transactions_type_check;
alter table public.coin_transactions add constraint coin_transactions_type_check
  check (type in ('referral_reward', 'connection_reward', 'admin_adjustment', 'redemption', 'coin_purchase'));

create table if not exists public.coin_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pack_id text not null,
  coins bigint not null check (coins > 0),
  amount_paise bigint not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  status text not null default 'created' check (status in ('created', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists coin_purchases_user_created_idx on public.coin_purchases(user_id, created_at desc);
create index if not exists coin_purchases_status_idx on public.coin_purchases(status, created_at desc);

alter table public.coin_purchases enable row level security;
drop policy if exists "users can view their own coin purchases" on public.coin_purchases;
create policy "users can view their own coin purchases"
  on public.coin_purchases for select to authenticated
  using (user_id = auth.uid());

create or replace function public.complete_coin_purchase(
  p_user_id uuid,
  p_order_id text,
  p_payment_id text,
  p_amount_paise bigint,
  p_currency text
)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  v_purchase record;
  v_balance bigint;
begin
  if p_user_id is null or p_order_id is null or p_payment_id is null or p_amount_paise is null or p_currency <> 'INR' then return null; end if;

  select * into v_purchase
  from public.coin_purchases
  where razorpay_order_id = trim(p_order_id)
  for update;
  if not found or v_purchase.user_id <> p_user_id or v_purchase.amount_paise <> p_amount_paise or v_purchase.currency <> p_currency then return null; end if;

  select coin_balance into v_balance from public.profiles where id = p_user_id for update;
  if not found then return null; end if;
  if v_purchase.status = 'paid' then return v_balance; end if;
  if v_purchase.status <> 'created' then return null; end if;

  update public.profiles
  set coin_balance = coin_balance + v_purchase.coins,
      total_earned = total_earned + v_purchase.coins
  where id = p_user_id
  returning coin_balance into v_balance;

  insert into public.coin_transactions (user_id, type, amount, balance_after, event_key, description)
  values (p_user_id, 'coin_purchase', v_purchase.coins, v_balance, 'purchase:' || v_purchase.id::text, 'Razorpay coin purchase');

  update public.coin_purchases
  set status = 'paid', razorpay_payment_id = p_payment_id, paid_at = now(), updated_at = now()
  where id = v_purchase.id;
  return v_balance;
end;
$$;

revoke execute on function public.complete_coin_purchase(uuid, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.complete_coin_purchase(uuid, text, text, bigint, text) to service_role;
