-- One support case per withdrawal request, with a small abuse guard.

create table if not exists public.withdrawal_complaints (
  id uuid primary key default gen_random_uuid(),
  withdrawal_id uuid not null references public.withdrawal_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (char_length(trim(subject)) between 3 and 120),
  message text not null check (char_length(trim(message)) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved', 'rejected')),
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  unique (withdrawal_id, user_id)
);

create index if not exists withdrawal_complaints_status_created_idx
  on public.withdrawal_complaints(status, created_at desc);

alter table public.withdrawal_complaints enable row level security;

drop policy if exists "users can view their own withdrawal complaints" on public.withdrawal_complaints;
create policy "users can view their own withdrawal complaints"
  on public.withdrawal_complaints for select to authenticated
  using (user_id = auth.uid());

-- Inserts go through the function below so the withdrawal ownership check and
-- the three-complaints-per-12-hours limit cannot be bypassed by the client.

create or replace function public.file_withdrawal_complaint(
  p_withdrawal_id uuid,
  p_subject text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_complaint_id uuid;
begin
  if auth.uid() is null
    or p_withdrawal_id is null
    or char_length(trim(coalesce(p_subject, ''))) not between 3 and 120
    or char_length(trim(coalesce(p_message, ''))) not between 10 and 2000 then
    return null;
  end if;

  if not exists (
    select 1 from public.withdrawal_requests
    where id = p_withdrawal_id and user_id = auth.uid()
  ) then
    return null;
  end if;

  if exists (
    select 1 from public.withdrawal_complaints
    where withdrawal_id = p_withdrawal_id and user_id = auth.uid()
  ) then
    return null;
  end if;

  if (
    select count(*) from public.withdrawal_complaints
    where user_id = auth.uid()
      and created_at >= now() - interval '12 hours'
  ) >= 3 then
    return null;
  end if;

  insert into public.withdrawal_complaints (withdrawal_id, user_id, subject, message)
  values (p_withdrawal_id, auth.uid(), trim(p_subject), trim(p_message))
  returning id into v_complaint_id;

  return v_complaint_id;
end;
$$;

grant execute on function public.file_withdrawal_complaint(uuid, text, text) to authenticated;
