-- Krok 5: user collections (bookmarks) and streak storage.
-- Run in Supabase SQL Editor. RLS + GRANT (RLS filters rows, GRANT lets the
-- role touch the table at all — same lesson as 001).

-- ─── Kolekce/záložky ─────────────────────────────────────────────────────
create table if not exists user_collections (
  user_id uuid references auth.users(id) primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table user_collections enable row level security;

drop policy if exists "Users can view own collections" on user_collections;
create policy "Users can view own collections"
  on user_collections for select
  using (auth.uid() = user_id);
drop policy if exists "Users can insert own collections" on user_collections;
create policy "Users can insert own collections"
  on user_collections for insert
  with check (auth.uid() = user_id);
drop policy if exists "Users can update own collections" on user_collections;
create policy "Users can update own collections"
  on user_collections for update
  using (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, insert, update on table user_collections to authenticated;

-- ─── Streak + denní cíl ──────────────────────────────────────────────────
create table if not exists user_streak (
  user_id uuid references auth.users(id) primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table user_streak enable row level security;

drop policy if exists "Users can view own streak" on user_streak;
create policy "Users can view own streak"
  on user_streak for select
  using (auth.uid() = user_id);
drop policy if exists "Users can insert own streak" on user_streak;
create policy "Users can insert own streak"
  on user_streak for insert
  with check (auth.uid() = user_id);
drop policy if exists "Users can update own streak" on user_streak;
create policy "Users can update own streak"
  on user_streak for update
  using (auth.uid() = user_id);

grant select, insert, update on table user_streak to authenticated;
