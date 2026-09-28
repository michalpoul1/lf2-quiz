-- Krok 4: user progress storage.
-- Run this in Supabase SQL Editor before deploying the app changes.

create table if not exists user_progress (
  user_id uuid references auth.users(id) primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table user_progress enable row level security;

drop policy if exists "Users can view own progress" on user_progress;
create policy "Users can view own progress"
  on user_progress for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own progress" on user_progress;
create policy "Users can insert own progress"
  on user_progress for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own progress" on user_progress;
create policy "Users can update own progress"
  on user_progress for update
  using (auth.uid() = user_id);
