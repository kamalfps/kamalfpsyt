// Supabase Edge Function "yt-automation": runs every 10 min.
// Saves hourly growth snapshots, detects live / new upload / milestones, sends alerts, weekly report.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const E = (k: string) => Deno.env.get(k);
const YT = "https://www.googleapis.com/youtube/v3/";
const MILES = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const J = { "Content-Type": "application/json" };

async function notify(text: string) {
  const d = E("DISCORD_WEBHOOK");
  if (d) await fetch(d, { method: "POST", headers: J, body: JSON.stringify({ content: text }) }).catch(() => {});
  const t = E("TELEGRAM_BOT_TOKEN"), c = E("TELEGRAM_CHAT_ID");
  if (t && c) await fetch(`https://api.telegram.org/bot${t}/sendMessage`, { method: "POST", headers: J, body: JSON.stringify({ chat_id: c, text }) }).catch(() => {});
}
async function yt(p: string) {
  const r = await fetch(YT + p + "&key=" + E("YT_API_KEY"));
  if (!r.ok) throw new Error("YouTube " + r.status + ": " + (await r.text()).slice(0, 200));
  return r.json();
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== E("CRON_SECRET")) return new Response("forbidden", { status: 403 });
  try {
    const sb = createClient(E("SUPABASE_URL")!, E("SUPABASE_SERVICE_ROLE_KEY")!), owner = E("OWNER_ID");
    const ch = (await yt(`channels?part=statistics,contentDetails&forHandle=${encodeURIComponent(E("YT_HANDLE") ?? "kamalfps")}`)).items?.[0];
    if (!ch) throw new Error("Channel not found");
    const subs = +ch.statistics.subscriberCount, views = +ch.statistics.viewCount, vcount = +ch.statistics.videoCount;
    const pl = await yt(`playlistItems?part=contentDetails&maxResults=25&playlistId=${ch.contentDetails.relatedPlaylists.uploads}`);
    const ids = (pl.items || []).map((i: any) => i.contentDetails.videoId).join(",");
    const vids: any[] = ids ? (await yt(`videos?part=snippet,statistics,liveStreamingDetails&id=${ids}`)).items || [] : [];
    const get = async (k: string) => (await sb.from("site").select("value").eq("key", k).maybeSingle()).data?.value;
    const put = (k: string, v: unknown) => sb.from("site").upsert({ key: k, value: v, owner });
    const S: any = (await get("bot_state")) || {};
    const first = !S.init; S.init = true;

    // 1) hourly snapshot
    if (!ch.statistics.hiddenSubscriberCount) {
      const last = (await sb.from("snapshots").select("ts").order("ts", { ascending: false }).limit(1)).data?.[0];
      if (!last || Date.now() - Date.parse(last.ts) > 55 * 6e4) await sb.from("snapshots").insert({ subs, views, videos: vcount });
    }
    // 2) live alert
    const live = vids.find((v) => v.snippet.liveBroadcastContent === "live");
    if (live && S.live_id !== live.id) { if (!first) await notify(`🔴 LIVE NOW: ${live.snippet.title}\nhttps://youtu.be/${live.id}`); S.live_id = live.id; }
    else if (!live) S.live_id = null;
    // 3) new upload alert
    const done = vids.filter((v) => v.snippet.liveBroadcastContent === "none");
    const seen: string[] = S.seen || [];
    for (const v of done) if (!seen.includes(v.id)) {
      if (!first && Date.now() - Date.parse(v.snippet.publishedAt) < 3 * 864e5) await notify(`🎬 New on your channel: ${v.snippet.title}\nhttps://youtu.be/${v.id}`);
      seen.push(v.id);
    }
    S.seen = seen.slice(-60);
    // 4) milestones
    const hit = MILES.filter((m) => subs >= m).pop() || 0;
    if (!first && hit > (S.milestone || 0)) await notify(`🎉 Milestone reached: ${hit.toLocaleString()} subscribers!`);
    S.milestone = Math.max(S.milestone || 0, hit);
    // 5) insights: best weekday by average views (rough, based on recent uploads)
    const off = +(E("TZ_OFFSET_MIN") ?? 330), by: Record<number, number[]> = {};
    for (const v of done) { const d = new Date(Date.parse(v.snippet.publishedAt) + off * 6e4).getUTCDay(); (by[d] ??= []).push(+v.statistics.viewCount || 0); }
    const rank = Object.entries(by).map(([d, a]) => ({ d: +d, avg: Math.round(a.reduce((x, y) => x + y, 0) / a.length), n: a.length })).sort((a, b) => b.avg - a.avg);
    const best = rank[0];
    await put("insights", best ? { best_day: DAYS[best.d], best_avg: best.avg, n: done.length, at: new Date().toISOString() } : null);
    // 6) status for the home page
    const lt = done.sort((a, b) => Date.parse(b.snippet.publishedAt) - Date.parse(a.snippet.publishedAt))[0];
    await put("yt_status", { live: live ? { id: live.id, title: live.snippet.title } : null, latest: lt ? { id: lt.id, title: lt.snippet.title, at: lt.snippet.publishedAt } : null, updated: new Date().toISOString() });
    // 7) weekly report: Sundays after 18:00 local
    const loc = new Date(Date.now() + off * 6e4), day = loc.toISOString().slice(0, 10);
    if (loc.getUTCDay() === 0 && loc.getUTCHours() >= 18 && S.report !== day) {
      const w = (await sb.from("snapshots").select("subs,views").gte("ts", new Date(Date.now() - 7 * 864e5).toISOString()).order("ts").limit(1)).data?.[0];
      const top = [...done].filter((v) => Date.now() - Date.parse(v.snippet.publishedAt) < 14 * 864e5).sort((a, b) => +b.statistics.viewCount - +a.statistics.viewCount)[0];
      await notify([`📊 Weekly report`, `Subscribers: ${subs.toLocaleString()}${w ? ` (${subs - w.subs >= 0 ? "+" : ""}${subs - w.subs} this week)` : ""}`,
        w ? `Views gained: +${(views - w.views).toLocaleString()}` : "", top ? `Best recent video: ${top.snippet.title} (${(+top.statistics.viewCount).toLocaleString()} views)` : "",
        best ? `Best day to post so far: ${DAYS[best.d]}` : ""].filter(Boolean).join("\n"));
      S.report = day;
    }
    await put("bot_state", S);
    return new Response(JSON.stringify({ ok: true, subs, live: !!live, first }), { headers: J });
  } catch (e) { return new Response("Error: " + (e as Error).message, { status: 500 }); }
});
