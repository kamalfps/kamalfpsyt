-- Run once in Supabase > SQL Editor (safe to run again)
create table if not exists site (
  key text primary key,
  value jsonb not null,
  owner uuid not null default auth.uid()
);
alter table site enable row level security;
drop policy if exists "public read" on site;
drop policy if exists "owner insert" on site;
drop policy if exists "owner update" on site;
drop policy if exists "owner delete" on site;
create policy "public read" on site for select using (true);
create policy "owner insert" on site for insert with check (auth.uid() = owner);
create policy "owner update" on site for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy "owner delete" on site for delete using (auth.uid() = owner);
