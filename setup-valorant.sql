-- Run once in Supabase > SQL Editor. Replace PUT_YOUR_CRON_SECRET (same value as your CRON_SECRET secret).
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('valorant-stats', '*/30 * * * *', $$
  select net.http_post(
    url := 'https://myepznophwqbnyzviylh.supabase.co/functions/v1/valorant-stats',
    headers := '{"Content-Type":"application/json","x-cron-secret":"PUT_YOUR_CRON_SECRET"}'::jsonb);
$$);
-- Want the page filled right now instead of waiting up to 30 minutes? Run this once too:
-- select net.http_post(url := 'https://myepznophwqbnyzviylh.supabase.co/functions/v1/valorant-stats', headers := '{"Content-Type":"application/json","x-cron-secret":"PUT_YOUR_CRON_SECRET"}'::jsonb);
