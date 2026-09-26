-- Withdrawals require at least 5,000 coins ($50.00).

alter table public.withdrawal_requests drop constraint if exists withdrawal_requests_amount_coins_check;
alter table public.withdrawal_requests add constraint withdrawal_requests_amount_coins_check
  check (amount_coins >= 5000);

create or replace function public.request_withdrawal(p_amount_coins bigint, p_method text, p_destination text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_request_id uuid;
begin
  if auth.uid() is null or p_amount_coins < 5000 or p_method not in ('gift_card', 'cash_pending') or length(trim(coalesce(p_destination, ''))) < 3 then
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
