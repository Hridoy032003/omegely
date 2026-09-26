-- Referral rewards and coin ledger.
-- One coin is displayed as one US dollar in the product.

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null,
  add column if not exists coin_balance bigint not null default 0,
  add column if not exists total_earned bigint not null default 0;

update public.profiles
set referral_code = lower(substr(replace(id::text, '-', ''), 1, 10))
where referral_code is null;

create unique index if not exists profiles_referral_code_idx
  on public.profiles(referral_code);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  referral_code text not null,
  status text not null default 'qualified' check (status in ('qualified', 'reversed')),
  reward_coins bigint not null default 1 check (reward_coins > 0),
  created_at timestamptz not null default now(),
  qualified_at timestamptz not null default now()
);

create index if not exists referrals_referrer_created_at_idx
  on public.referrals(referrer_id, created_at desc);

create table if not exists public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('referral_reward', 'admin_adjustment', 'redemption')),
  amount bigint not null,
  balance_after bigint not null,
  referral_id uuid references public.referrals(id) on delete set null,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists coin_transactions_user_created_at_idx
  on public.coin_transactions(user_id, created_at desc);

-- Keep new accounts referral-ready without requiring client-side code.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, referral_code)
  values (new.id, new.email, lower(substr(replace(new.id::text, '-', ''), 1, 10)))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

alter table public.referrals enable row level security;
alter table public.coin_transactions enable row level security;

drop policy if exists "users can view their own referrals" on public.referrals;
create policy "users can view their own referrals"
  on public.referrals for select to authenticated
  using (referrer_id = auth.uid() or referred_id = auth.uid());

drop policy if exists "users can view their own coin transactions" on public.coin_transactions;
create policy "users can view their own coin transactions"
  on public.coin_transactions for select to authenticated
  using (user_id = auth.uid());

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
  if auth.uid() is null or p_referral_code is null or length(trim(p_referral_code)) = 0 then
    return false;
  end if;

  select id into v_referrer_id
  from public.profiles
  where referral_code = lower(trim(p_referral_code))
    and id <> auth.uid()
  limit 1;

  if v_referrer_id is null then
    return false;
  end if;

  insert into public.referrals (referrer_id, referred_id, referral_code)
  values (v_referrer_id, auth.uid(), lower(trim(p_referral_code)))
  on conflict (referred_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return false;
  end if;

  select id into v_referral_id
  from public.referrals
  where referred_id = auth.uid();

  update public.profiles
  set referred_by = v_referrer_id
  where id = auth.uid();

  update public.profiles
  set coin_balance = coin_balance + 1,
      total_earned = total_earned + 1
  where id = v_referrer_id
  returning coin_balance into v_new_balance;

  insert into public.coin_transactions (user_id, type, amount, balance_after, referral_id, description)
  values (v_referrer_id, 'referral_reward', 1, v_new_balance, v_referral_id, 'Referral reward');

  return true;
end;
$$;

grant execute on function public.claim_referral(text) to authenticated;
