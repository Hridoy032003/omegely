create extension if not exists pgcrypto;

create type public.user_role as enum ('user', 'admin');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role public.user_role not null default 'user',
  is_banned boolean not null default false,
  ban_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  reporter_session_hash text,
  target_user_id uuid references public.profiles(id) on delete set null,
  target_session_hash text,
  reason text not null,
  details text,
  status public.report_status not null default 'open',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid references public.profiles(id) on delete cascade,
  blocked_session_hash text,
  created_at timestamptz not null default now(),
  constraint blocks_target_check check (blocked_user_id is not null or blocked_session_hash is not null)
);

create index reports_status_created_at_idx on public.reports(status, created_at desc);
create index profiles_banned_idx on public.profiles(is_banned) where is_banned = true;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;

create policy "users can view their own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "users can create their own reports"
  on public.reports for insert to authenticated
  with check (reporter_id = auth.uid());

create policy "users can view their own reports"
  on public.reports for select to authenticated
  using (reporter_id = auth.uid());

create policy "users can manage their own blocks"
  on public.blocks for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());
