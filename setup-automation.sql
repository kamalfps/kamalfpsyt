-- Run once in Supabase > SQL Editor. Replace PUT_YOUR_CRON_SECRET (2 places).
create table if not exists snapshots (
  ts timestamptz primary key default now(),
  subs bigint not null, views bigint not null, videos int
);
alter table snapshots enable row level security;
drop policy if exists "public read" on snapshots;
create policy "public read" on snapshots for select using (true);   -- only the function (service role) can write

create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('yt-automation', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://myepznophwqbnyzviylh.supabase.co/functions/v1/yt-automation',
    headers := '{"Content-Type":"application/json","x-cron-secret":"PUT_YOUR_CRON_SECRET"}'::jsonb);
$$);
