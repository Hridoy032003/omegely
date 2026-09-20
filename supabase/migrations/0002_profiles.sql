alter table public.profiles
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists interests text[] not null default '{}',
  add column if not exists last_seen timestamptz;

create policy "users can update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create index if not exists profiles_created_at_idx on public.profiles(created_at desc);
