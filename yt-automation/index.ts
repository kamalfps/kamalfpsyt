// Supabase Edge Function "yt-automation": runs every 10 min.
// Saves hourly growth snapshots, detects live / new upload / milestones, sends alerts, weekly report.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const E = (k: string) => Deno.env.get(k);
const YT = "https://www.googleapis.com/youtube/v3/";
const MILES = [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const J = { "Content-Type": "application/json" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
async function notify(html: string, url?: string, label = "▶️ Watch") {
  const d = E("DISCORD_WEBHOOK");
  const plain = html.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  if (d) await fetch(d, { method: "POST", headers: J, body: JSON.stringify({ content: plain + (url ? "\n" + url : "") }) }).catch(() => {});
  const t = E("TELEGRAM_BOT_TOKEN"), c = E("TELEGRAM_CHAT_ID");
  if (t && c) await fetch(`https://api.telegram.org/bot${t}/sendMessage`, { method: "POST", headers: J, body: JSON.stringify({ chat_id: c, text: html, parse_mode: "HTML", disable_web_page_preview: true, ...(url ? { reply_markup: { inline_keyboard: [[{ text: label, url }]] } } : {}) }) }).catch(() => {});
}
async function yt(p: string) {
  const r = await fetch(YT + p + "&key=" + E("YT_API_KEY"));
  if (!r.ok) throw new Error("YouTube " + r.status + ": " + (await r.text()).slice(0, 200));
  return r.json();
}

const TH: [string, string][] = [["{g} ranked grind: {r} or nothing","Ranked grind toward {r}."],["Trying 1v5 clutches in {g} until I win","Chasing clutch plays until one finally works."],["My {g} aim routine on the road to {r}","The aim routine that is getting me closer to {r}."],["Playing {g} with chat until we win","Queueing with viewers and not stopping until we win."],["{g} but every loss means a new challenge","Every loss adds a challenge. Chat picks them."],["Learning from the best: {g} pro tips","Testing pro tips live to see what actually works."],["Subscriber goal stream: {g} all night","A long stream to push the subscriber goal."],["Unlucky? Comeback attempt in {g}","Starting from a bad run and fighting back."],["No-death challenge in {g}","Trying to survive full games without dying."],["{g} solo vs squad: who wins?","Solo queue against full squads."],["Reviewing my worst {g} rounds","Going through mistakes to fix them live."],["{g} ranked with viewers","Ranked games with people from chat."],["New sensitivity, same {g} grind","Testing new settings in real matches."],["Can I hit {r} today? {g} live","A push for {r} with everything on the line."]];
function kit(i: number, g: string, r: string, handle: string) {
  const f = (s: string) => s.replaceAll("{g}", g).replaceAll("{r}", r), tag = g.replace(/[^a-z0-9]/gi, ""), left = 365 - i, last = i === 364, t = TH[i % TH.length];
  const title = (last ? "Last stream of 2026: " : `Day ${i + 1}: `) + f(t[0]);
  const desc = `${f(t[1])}\n\n${last ? "The final day of 2026." : `Day ${i + 1} of 365.`} My road to becoming a name in ${g} before 2027, with ${left} ${left === 1 ? "day" : "days"} left. Goal: ${r}.\n\nCome say hi in chat and help me reach the next subscriber goal.\n\nTimestamps\n0:00 Intro\n\nSubscribe so you don't miss the next stream: https://youtube.com/@${handle}?sub_confirmation=1\n\n#kamalfps #${tag} #RoadTo2027`;
  const date = new Date(Date.UTC(2026, 0, 1 + i)).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return { title, desc, left, date };
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
    if (live && S.live_id !== live.id) { if (!first) await notify(`🔴 <b>LIVE NOW</b>\n━━━━━━━━━━━━━━━━\n<b>${esc(live.snippet.title)}</b>\n\nCome hang out! 🔥`, "https://youtu.be/" + live.id, "▶️ Watch live"); S.live_id = live.id; }
    else if (!live) S.live_id = null;
    // 3) new upload alert
    const done = vids.filter((v) => v.snippet.liveBroadcastContent === "none");
    const seen: string[] = S.seen || [];
    for (const v of done) if (!seen.includes(v.id)) {
      if (!first && Date.now() - Date.parse(v.snippet.publishedAt) < 3 * 864e5) await notify(`🎬 <b>New on your channel</b>\n━━━━━━━━━━━━━━━━\n<b>${esc(v.snippet.title)}</b>`, "https://youtu.be/" + v.id);
      seen.push(v.id);
    }
    S.seen = seen.slice(-60);
    // 4) milestones
    const hit = MILES.filter((m) => subs >= m).pop() || 0;
    if (!first && hit > (S.milestone || 0)) await notify(`🎉 <b>MILESTONE!</b>\n━━━━━━━━━━━━━━━━\nYou just hit <b>${hit.toLocaleString()}</b> subscribers! 🚀`);
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
      await notify(["📊 <b>Weekly report</b>", "━━━━━━━━━━━━━━━━", `👥 Subscribers <b>${subs.toLocaleString()}</b>${w ? ` (${subs - w.subs >= 0 ? "+" : ""}${subs - w.subs})` : ""}`, w ? `👁 Views <b>+${(views - w.views).toLocaleString()}</b>` : "", top ? `🏆 Best recent video: <b>${esc(top.snippet.title)}</b> (${(+top.statistics.viewCount).toLocaleString()} views)` : "", best ? `📅 Best day to post so far: <b>${DAYS[best.d]}</b>` : "", "Keep grinding 🔥"].filter(Boolean).join("\n"), top ? "https://youtu.be/" + top.id : undefined, "▶️ Best video");
      S.report = day;
    }
    // 8) daily kit at 09:00 local: days to 2027 + today's title + description
    if (loc.getUTCHours() >= 9 && S.daily !== day) {
      const ci: any = (await get("content")) || {}, i = Math.floor((Date.UTC(loc.getUTCFullYear(), loc.getUTCMonth(), loc.getUTCDate()) - Date.UTC(2026, 0, 1)) / 864e5);
      if (i >= 0 && i <= 364) {
        const x = kit(i, String(ci.g || "FPS"), String(ci.r || "the next rank"), E("YT_HANDLE") ?? "kamalfps");
        await notify(`☀️ <b>Good morning!</b> <b>${x.left}</b> days to 2027\n━━━━━━━━━━━━━━━━\n✍️ <b>Today's title</b>\n<code>${esc(x.title)}</code>\n\n📝 <b>Description</b>\n<pre>${esc(x.desc)}</pre>`);
      }
      S.daily = day;
    }
    await put("bot_state", S);
    return new Response(JSON.stringify({ ok: true, subs, live: !!live, first }), { headers: J });
  } catch (e) { return new Response("Error: " + (e as Error).message, { status: 500 }); }
});
