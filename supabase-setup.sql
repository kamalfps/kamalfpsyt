-- Run once in Supabase > SQL Editor

-- Private data: each user sees only their own rows
create table if not exists kv (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null,
  value jsonb not null,
  primary key (user_id, key)
);
alter table kv enable row level security;
create policy "own rows" on kv for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Public data (schedule, goal): everyone can read, only the owner can write
create table if not exists site (
  key text primary key,
  value jsonb not null,
  owner uuid not null default auth.uid()
);
alter table site enable row level security;
create policy "public read" on site for select using (true);
create policy "owner insert" on site for insert with check (auth.uid() = owner);
create policy "owner update" on site for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "owner delete" on site for delete using (auth.uid() = owner);

-- needed by the planner page
alter table kv add column if not exists updated_at timestamptz default now();
