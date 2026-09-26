-- Anonymous wallet visibility for the chat header.
-- The browser stores only a random wallet token. The database stores and
-- compares its SHA-256 digest, never a raw device/browser fingerprint.

create or replace function public.get_anonymous_wallet_balance(p_wallet_id text)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  v_balance bigint;
begin
  if p_wallet_id is null or length(trim(p_wallet_id)) < 16 then
    return 0;
  end if;

  select coin_balance into v_balance
  from public.anonymous_wallets
  where wallet_hash = encode(digest(trim(p_wallet_id), 'sha256'), 'hex')
    and claimed_by is null;

  return coalesce(v_balance, 0);
end;
$$;

revoke execute on function public.get_anonymous_wallet_balance(text) from public;
grant execute on function public.get_anonymous_wallet_balance(text) to anon, authenticated;
