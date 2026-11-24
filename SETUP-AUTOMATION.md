# YouTube automation setup (about 15 minutes)

Every 10 minutes Supabase checks your channel. It saves hourly growth snapshots, spots going live / new uploads / milestones, sends alerts, and posts a weekly report (Sunday after 6 pm India time).

## 1. Alerts destination (pick one, or both)
- DISCORD: Server settings > Integrations > Webhooks > New Webhook > choose channel > Copy Webhook URL.
- TELEGRAM: message @BotFather, send /newbot, copy the bot token. Message your bot once, then open
  https://api.telegram.org/bot<TOKEN>/getUpdates and copy "chat":{"id": ...}.
Never paste these into chat or GitHub. They only go into Supabase secrets (step 3).

## 2. Supabase function
Edge Functions > Create new function named exactly: yt-automation. Paste yt-automation/index.ts, deploy, turn OFF "Verify JWT".

## 3. Secrets (Edge Functions > Secrets)
| Name | Value |
|---|---|
| YT_API_KEY | the same YouTube API key as in config.js |
| YT_HANDLE | kamalfps |
| CRON_SECRET | any long random text (reuse the one from the Kick setup if you have it) |
| OWNER_ID | Authentication > Users > your "User UID" |
| DISCORD_WEBHOOK | your webhook URL (if using Discord) |
| TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID | (if using Telegram) |
| TZ_OFFSET_MIN | optional, default 330 (India) |

## 4. Database + schedule
SQL Editor > paste setup-automation.sql, replace PUT_YOUR_CRON_SECRET (2 places), Run.

## 5. Website files
Upload to your GitHub repo: index.html, growth.html, app.js (nav now has a Growth link).

## Test
Wait ~10 minutes. Home page should show your latest upload. Growth page needs a few hours of snapshots before charts look good.
If nothing happens: Supabase > Edge Functions > yt-automation > Logs.

## Notes
- First run only records the current state, it won't send alerts for old videos.
- Uses about 3 YouTube quota units per run (~430/day of your free 10,000).
- A finished livestream's replay can trigger a "New on your channel" alert.
- Best-day insight is a rough guide from recent uploads, not YouTube Analytics.
