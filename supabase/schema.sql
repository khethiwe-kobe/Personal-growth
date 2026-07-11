-- Run this in your Supabase project's SQL editor to enable cloud backup.

create table if not exists public.app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

create policy "Users can read own state"
  on public.app_state for select
  using (auth.uid() = user_id);

create policy "Users can insert own state"
  on public.app_state for insert
  with check (auth.uid() = user_id);

create policy "Users can update own state"
  on public.app_state for update
  using (auth.uid() = user_id);
