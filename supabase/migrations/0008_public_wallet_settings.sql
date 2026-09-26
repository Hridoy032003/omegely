-- Expose only non-sensitive reward settings required by the public wallet UI.

create or replace function public.get_public_wallet_settings()
returns table (withdrawals_enabled boolean, withdrawal_minimum_coins bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(app_settings.withdrawals_enabled, false),
    coalesce(app_settings.withdrawal_minimum_coins, 5000)
  from public.app_settings
  where id = true;
$$;

grant execute on function public.get_public_wallet_settings() to anon, authenticated;
