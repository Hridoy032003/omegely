-- Safe to run whether 0002_profiles.sql was already applied or not.
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists interests text[] not null default '{}',
  add column if not exists last_seen timestamptz;

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email text,
  kind text not null check (kind in ('feedback', 'bug', 'safety')),
  message text not null check (char_length(message) between 5 and 4000),
  page_url text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists feedback_status_created_at_idx
  on public.feedback(status, created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "anyone can submit feedback" on public.feedback;
create policy "anyone can submit feedback"
  on public.feedback for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists "users can view their own feedback" on public.feedback;
create policy "users can view their own feedback"
  on public.feedback for select to authenticated
  using (user_id = auth.uid());
