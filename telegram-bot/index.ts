// Supabase Edge Function "telegram-bot" v2: stats cards, live status, titles, thumbnail text, trending hashtags.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const E = (k: string) => Deno.env.get(k) ?? "";
const sb = createClient(E("SUPABASE_URL"), E("SUPABASE_SERVICE_ROLE_KEY"));
const api = (m: string, b: unknown) => fetch(`https://api.telegram.org/bot${E("TELEGRAM_BOT_TOKEN")}/${m}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n = (x: number) => Number(x).toLocaleString("en-US");
const sg = (v?: number | null) => v == null ? "n/a" : (v >= 0 ? "+" : "") + n(v);
const LINE = "━━━━━━━━━━━━━━━━";
const bar = (p: number) => { const f = Math.max(0, Math.min(10, Math.round(p / 10))); return "▰".repeat(f) + "▱".repeat(10 - f); };
const pick = <T,>(a: T[], k: number) => [...a].sort(() => Math.random() - .5).slice(0, k);
const NUM = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"];
const yh = () => E("YT_HANDLE") || "kamalfps", ks = () => E("KICK_SLUG") || "kamalfps";
const daysLeft = () => Math.max(0, 365 - todayIdx());

const site = async (k: string) => (await sb.from("site").select("value").eq("key", k).maybeSingle()).data?.value;
const TH: [string, string][] = [["{g} ranked grind: {r} or nothing","Ranked grind toward {r}."],["Trying 1v5 clutches in {g} until I win","Chasing clutch plays until one finally works."],["My {g} aim routine on the road to {r}","The aim routine that is getting me closer to {r}."],["Playing {g} with chat until we win","Queueing with viewers and not stopping until we win."],["{g} but every loss means a new challenge","Every loss adds a challenge. Chat picks them."],["Learning from the best: {g} pro tips","Testing pro tips live to see what actually works."],["Subscriber goal stream: {g} all night","A long stream to push the subscriber goal."],["Unlucky? Comeback attempt in {g}","Starting from a bad run and fighting back."],["No-death challenge in {g}","Trying to survive full games without dying."],["{g} solo vs squad: who wins?","Solo queue against full squads."],["Reviewing my worst {g} rounds","Going through mistakes to fix them live."],["{g} ranked with viewers","Ranked games with people from chat."],["New sensitivity, same {g} grind","Testing new settings in real matches."],["Can I hit {r} today? {g} live","A push for {r} with everything on the line."]];
function kit(i: number, g: string, r: string, handle: string) {
  const f = (s: string) => s.replaceAll("{g}", g).replaceAll("{r}", r), tag = g.replace(/[^a-z0-9]/gi, ""), left = 365 - i, last = i === 364, t = TH[i % TH.length];
  const title = (last ? "Last stream of 2026: " : `Day ${i + 1}: `) + f(t[0]);
  const desc = `${f(t[1])}\n\n${last ? "The final day of 2026." : `Day ${i + 1} of 365.`} My road to becoming a name in ${g} before 2027, with ${left} ${left === 1 ? "day" : "days"} left. Goal: ${r}.\n\nCome say hi in chat and help me reach the next subscriber goal.\n\nTimestamps\n0:00 Intro\n\nSubscribe so you don't miss the next stream: https://youtube.com/@${handle}?sub_confirmation=1\n\n#kamalfps #${tag} #RoadTo2027`;
  const date = new Date(Date.UTC(2026, 0, 1 + i)).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return { title, desc, left, date };
}
const OFF = +(E("TZ_OFFSET_MIN") || "330");
const todayIdx = () => { const l = new Date(Date.now() + OFF * 6e4); return Math.floor((Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()) - Date.UTC(2026, 0, 1)) / 864e5); };
async function content() { const c = await site("content"); return { g: String(c?.g || E("GAME") || "FPS"), r: String(c?.r || E("RANK_GOAL") || "the next rank") }; }
const TT = ["1V5 CLUTCH", "INSANE {G}", "NO WAY...", "I DID IT?!", "DAY {N}", "{D} DAYS LEFT", "LAST CHANCE", "GRIND MODE", "{G} GOD?", "IMPOSSIBLE?", "STILL STUCK?"];
const ttext = (i: number, g: string) => [0, 4].map((o) => TT[(i + o) % TT.length].replaceAll("{G}", g.toUpperCase()).replaceAll("{N}", String(i + 1)).replaceAll("{D}", String(365 - i)));
const MENU = { inline_keyboard: [
  [{ text: "📊 Stats", callback_data: "stats" }, { text: "📈 This week", callback_data: "week" }],
  [{ text: "📅 Today's kit", callback_data: "today" }, { text: "📆 Next 7 days", callback_data: "wk7" }],
  [{ text: "🔴 Live", callback_data: "live" }, { text: "🟢 Kick", callback_data: "kick" }],
  [{ text: "✍️ Titles", callback_data: "ask:ti" }, { text: "🖼 Thumbnail text", callback_data: "ask:th" }],
  [{ text: "#️⃣ Hashtags", callback_data: "ask:ht" }, { text: "⏳ Days left", callback_data: "days" }],
  [{ text: "🗓 Schedule", callback_data: "schedule" }, { text: "🔗 Links", callback_data: "links" }],
  [{ text: "⚙️ Set game", callback_data: "ask:sg" }]] };
const again = (k: string, g: string, r: string) => ({ inline_keyboard: [
  [{ text: "🔁 Again", callback_data: (`${k}:${g}|${r}`).slice(0, 60) }, { text: "🏠 Menu", callback_data: "menu" }]] });

const latest = async () => (await sb.from("snapshots").select("subs,views").order("ts", { ascending: false }).limit(1)).data?.[0];
async function gain(h: number) {
  const l = await latest();
  const p = (await sb.from("snapshots").select("subs,views").gte("ts", new Date(Date.now() - h * 36e5).toISOString()).order("ts").limit(1)).data?.[0];
  return l && p ? { subs: l.subs - p.subs, views: l.views - p.views } : null;
}

// ---------- content generators ----------
function titles(g: string, r: string) {
  const d = daysLeft(), day = 365 - d;
  const T = ["{g} ranked grind: {r} or nothing", "I tried to hit {r} in {g}. {d} days left", "Day {n} of the road to {r} in {g}", "Can I reach {r} in {g} before 2027?",
    "{g} clutch moments that shouldn't work", "Trying 1v5 clutches in {g} until I win", "This {g} aim routine changed everything", "{r} push in {g} (LIVE)",
    "Nobody believed I could hit {r} in {g}", "{d} days to {r}: the {g} grind continues", "Why I'm stuck in {g} (and how I fix it)", "Solo queue to {r} in {g}, no excuses",
    "My {g} comeback arc starts now", "{g} but every loss costs me a day"].filter((t) => r || !t.includes("{r}"));
  const out = pick(T, 5).map((t, i) => { const s = t.replaceAll("{g}", g).replaceAll("{r}", r).replaceAll("{d}", String(d)).replaceAll("{n}", String(day)); return `${NUM[i]} <code>${esc(s)}</code> <i>(${s.length})</i>`; });
  return [`✍️ <b>Title ideas</b> · ${esc(g)}${r ? ` → ${esc(r)}` : ""}`, LINE, ...out, "", "💡 <i>Tap a title to copy. Keep it under 60 characters with the hook in the first 3 words.</i>"].join("\n");
}
function thumbs(g: string, r: string) {
  const G = g.toUpperCase(), R = r.toUpperCase(), d = daysLeft();
  const T = ["{R} OR NOTHING", "ROAD TO {R}", "{D} DAYS LEFT", "1V5 CLUTCH", "INSANE {G}", "NO WAY...", "I DID IT?!", "DAY {N}", "LAST CHANCE", "STILL STUCK?", "GRIND MODE", "{G} GOD?", "THEY QUIT", "IMPOSSIBLE?"].filter((t) => R || !t.includes("{R}"));
  const out = pick(T, 6).map((t, i) => `${NUM[i]} <code>${esc(t.replaceAll("{G}", G).replaceAll("{R}", R).replaceAll("{D}", String(d)).replaceAll("{N}", String(365 - d)))}</code>`);
  const tips = ["White text + thick black outline, one key word in yellow", "Big yellow text on the left, your face on the right", "Red word for the shock, white for the rest", "Max 3 words, readable at phone size", "Add a bright arrow or circle on the key moment"];
  return [`🖼 <b>Thumbnail text</b> · ${esc(g)}`, LINE, ...out, "", `🎨 <b>Style tip:</b> ${pick(tips, 1)[0]}`, "<i>Make it in your Thumbnails page.</i>"].join("\n");
}
async function trending() {
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&videoCategoryId=20&regionCode=${E("REGION") || "IN"}&maxResults=50&key=${E("YT_API_KEY")}`);
    const j = await r.json(), c: Record<string, number> = {};
    for (const v of j.items || []) for (const t of v.snippet.tags || []) { const k = t.toLowerCase().replace(/[^a-z0-9]/g, ""); if (k.length >= 3 && k.length <= 20) c[k] = (c[k] || 0) + 1; }
    const top = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k);
    return top.length >= 3 ? top : null;
  } catch { return null; }
}
async function hashtags(g: string, r: string) {
  const k = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const gg = k(g), t = await trending();
  const mine = [gg, gg + "gameplay", gg + "live", gg + "clips", r ? k(r) : "", "roadto2027"].filter(Boolean);
  const evergreen = ["gaming", "gamer", "youtubegaming", "livestream", "gameplay", "shorts", "clutch", "fps", "indiangamer"];
  return [`#️⃣ <b>Hashtags</b> · ${esc(g)}`, LINE,
    t ? `🔥 <b>Trending now in Gaming (${E("REGION") || "IN"})</b>\n<code>${t.map((x) => "#" + x).join(" ")}</code>` : `📌 <b>Evergreen gaming tags</b>\n<code>${evergreen.map((x) => "#" + x).join(" ")}</code>\n<i>(live trend data was unavailable)</i>`,
    "", `🎯 <b>For your stream</b>\n<code>${mine.map((x) => "#" + x).join(" ")}</code>`, "",
    "💡 <i>YouTube shows only the first 3 hashtags above your title. Use 3 to 5 that match the video.</i>"].join("\n");
}

// ---------- views ----------
async function view(cmd: string, name: string, chat: number): Promise<{ text: string; kb: unknown }> {
  const [k, rest = ""] = [cmd.split(":")[0], cmd.slice(cmd.indexOf(":") + 1)];
  if (k === "today" || k === "day") {
    const T = todayIdx();
    if (T > 364) return { kb: MENU, text: "🎆 2026 is over. See you in 2027!" };
    let i = k === "day" && rest !== "today" ? +rest : T; i = Math.max(0, Math.min(364, i || 0));
    const { g, r } = await content(), x = kit(i, g, r, yh()), p = (i + 1) / 365 * 100;
    const nav = [...(i > 0 ? [{ text: "◀ Prev day", callback_data: `day:${i - 1}` }] : []), ...(i < 364 ? [{ text: "Next day ▶", callback_data: `day:${i + 1}` }] : [])];
    return { kb: { inline_keyboard: [nav, [{ text: "🔁 Today", callback_data: "day:today" }, { text: "🏠 Menu", callback_data: "menu" }]] }, text: [
      `📅 <b>${i === T ? "Today's kit" : "Stream kit"}</b> · ${x.date}`, LINE, `⏳ <b>${x.left}</b> days to 2027`, `${bar(p)} ${p.toFixed(0)}% of 2026 done`, "",
      `✍️ <b>Title</b> <i>(${x.title.length}/100)</i>`, `<code>${esc(x.title)}</code>`, "", `📝 <b>Description</b>`, `<pre>${esc(x.desc)}</pre>`, "",
      `🖼 <b>Thumbnail text</b>  ${ttext(i, g).map((t) => `<code>${esc(t)}</code>`).join("  ·  ")}`, `<i>Tap a block to copy it. Game: ${esc(g)} → ${esc(r)}</i>`].join("\n") };
  }
  if (k === "wk7") {
    const T = Math.max(0, todayIdx()); if (T > 364) return { kb: MENU, text: "🎆 2026 is over. See you in 2027!" };
    const { g, r } = await content(), idx = Array.from({ length: 7 }, (_, j) => T + j).filter((i) => i <= 364);
    const days = idx.map((i) => { const x = kit(i, g, r, yh()); return `🗓 <b>${x.date}</b>\n<code>${esc(x.title)}</code>`; });
    const btn = idx.map((i) => ({ text: String(new Date(Date.UTC(2026, 0, 1 + i)).getUTCDate()), callback_data: `day:${i}` }));
    return { kb: { inline_keyboard: [btn.slice(0, 4), btn.slice(4), [{ text: "🏠 Menu", callback_data: "menu" }]].filter((x) => x.length) }, text: `📆 <b>Next 7 days</b>\n${LINE}\n` + days.join("\n\n") + `\n\n<i>Tap a date below for its full title + description.</i>` };
  }
  if (k === "days") {
    const T = todayIdx(), p = Math.min(100, (T + 1) / 365 * 100);
    return { kb: MENU, text: `⏳ <b>${Math.max(0, 365 - T)}</b> days to 2027\n${LINE}\n${bar(p)} <b>${p.toFixed(0)}%</b> of 2026 done\n🏁 Last stream day: <b>Dec 31</b>` };
  }
  if (k === "sg") {
    if (!E("TELEGRAM_CHAT_ID") || String(chat) !== E("TELEGRAM_CHAT_ID")) return { kb: MENU, text: "🔒 Only the channel owner can change the game." };
    const [g, r = ""] = rest.split("|").map((s) => s.trim()); if (!g || cmd === "sg") return { kb: MENU, text: "Send it like this: <code>Valorant | Radiant</code>" };
    const goal = r || "the next rank";
    const { error } = await sb.from("site").upsert({ key: "content", value: { g, r: goal }, owner: E("OWNER_ID") });
    return { kb: MENU, text: error ? "⚠️ Could not save: " + esc(error.message) : `✅ Saved: <b>${esc(g)}</b> → <b>${esc(goal)}</b>\nToday's kit now uses this.` };
  }
  if (["ti", "th", "ht"].includes(k)) {
    const [g, r = ""] = rest.split("|").map((s) => s.trim());
    const text = k === "ti" ? titles(g, r) : k === "th" ? thumbs(g, r) : await hashtags(g, r);
    return { text, kb: again(k, g, r) };
  }
  if (cmd === "stats") {
    const l = await latest(); if (!l) return { text: "⏳ No data yet. The automation needs a little time to collect snapshots.", kb: MENU };
    const g = await site("goal"), d1 = await gain(24), d7 = await gain(168), tg = g?.target ? +g.target : 0, p = tg ? l.subs / tg * 100 : 0;
    return { kb: MENU, text: [`📊 <b>@${esc(yh())} · Channel stats</b>`, LINE, `👥 Subscribers   <b>${n(l.subs)}</b>`, `👁 Total views   <b>${n(l.views)}</b>`, LINE,
      `📈 24h <b>${sg(d1?.subs)}</b>   ·   7d <b>${sg(d7?.subs)}</b>`, tg ? `🎯 Goal  ${bar(p)} <b>${Math.min(100, p).toFixed(1)}%</b>\n      ${n(l.subs)} / ${n(tg)}` : "", `⏳ <b>${daysLeft()}</b> days left in 2026`].filter(Boolean).join("\n") };
  }
  if (cmd === "week") {
    const d = await gain(168), i = await site("insights");
    return { kb: MENU, text: [`📈 <b>Last 7 days</b>`, LINE, `👥 Subscribers  <b>${sg(d?.subs)}</b>`, `👁 Views  <b>${sg(d?.views)}</b>`, i ? `\n📅 Best day to post so far: <b>${esc(i.best_day)}</b>` : "", `\n🔥 <i>Keep the streak going!</i>`].filter(Boolean).join("\n") };
  }
  if (cmd === "live") {
    const s = await site("yt_status");
    if (s?.live) return { kb: { inline_keyboard: [[{ text: "▶️ Watch live", url: "https://youtu.be/" + s.live.id }], [{ text: "🏠 Menu", callback_data: "menu" }]] }, text: `🔴 <b>LIVE NOW</b>\n${LINE}\n<b>${esc(s.live.title)}</b>` };
    return { kb: s?.latest ? { inline_keyboard: [[{ text: "▶️ Latest upload", url: "https://youtu.be/" + s.latest.id }], [{ text: "🏠 Menu", callback_data: "menu" }]] } : MENU, text: `⚫ <b>Not live on YouTube right now</b>${s?.latest ? `\n${LINE}\n🎬 Latest upload:\n<b>${esc(s.latest.title)}</b>` : ""}` };
  }
  if (cmd === "kick") {
    const kk = await site("kick");
    return { kb: { inline_keyboard: [[{ text: "🟢 Open Kick", url: "https://kick.com/" + ks() }], [{ text: "🏠 Menu", callback_data: "menu" }]] }, text: `🟢 <b>Kick · ${esc(ks())}</b>\n${LINE}\n👥 Followers  <b>${kk?.followers != null ? n(kk.followers) : "not set yet"}</b>` };
  }
  if (cmd === "schedule") {
    const s = await site("schedule");
    return { kb: MENU, text: Array.isArray(s) && s.length ? `📅 <b>Weekly schedule</b>\n${LINE}\n` + s.map((x: any) => `🕒 <b>${esc(x.day)} ${esc(x.time)}</b>\n      ${esc(x.title)}`).join("\n") : "📅 No schedule set yet. Add one in Studio." };
  }
  if (cmd === "links") return { kb: { inline_keyboard: [[{ text: "▶️ YouTube", url: "https://youtube.com/@" + yh() }, { text: "🟢 Kick", url: "https://kick.com/" + ks() }], ...(E("SITE_URL") ? [[{ text: "🌐 Website", url: E("SITE_URL") }]] : []), [{ text: "🏠 Menu", callback_data: "menu" }]] }, text: `🔗 <b>Your links</b>` };
  if (cmd === "id") return { kb: MENU, text: `🆔 Your chat ID:\n<code>${chat}</code>\n<i>Save it as the TELEGRAM_CHAT_ID secret so alerts reach you.</i>` };
  return { kb: MENU, text: `👋 Hey <b>${esc(name)}</b>!\n<b>KamalFPS Control Bot</b>\n${LINE}\n📊 Live stats & growth\n📅 Today's title + description\n⏳ Days to 2027\n✍️ Title ideas\n🖼 Thumbnail text\n#️⃣ Trending hashtags\n\n<i>Tap a button below 👇</i>` };
}
const PROMPT: Record<string, string> = { ti: "✍️ Titles: send your game name", th: "🖼 Thumbnail text: send your game name", ht: "#️⃣ Hashtags: send your game name", sg: "⚙️ Set game: send your game name" };

Deno.serve(async (req) => {
  if (!E("TELEGRAM_WEBHOOK_SECRET") || req.headers.get("x-telegram-bot-api-secret-token") !== E("TELEGRAM_WEBHOOK_SECRET")) return new Response("forbidden", { status: 403 });
  try {
    const u = await req.json(), cb = u.callback_query, m = u.message, chat = cb ? cb.message.chat.id : m?.chat?.id;
    if (!chat) return new Response("ok");
    const name = (cb ? cb.from : m.from)?.first_name || "there";
    const send = (text: string, kb: unknown) => api("sendMessage", { chat_id: chat, text, parse_mode: "HTML", reply_markup: kb, disable_web_page_preview: true });
    if (cb) {
      await api("answerCallbackQuery", { callback_query_id: cb.id });
      if (cb.data.startsWith("ask:")) { await api("sendMessage", { chat_id: chat, text: PROMPT[cb.data.slice(4)] + "\n<i>Optional rank goal: Valorant | Radiant</i>", parse_mode: "HTML", reply_markup: { force_reply: true, input_field_placeholder: "Valorant | Radiant" } }); return new Response("ok"); }
      const v = await view(cb.data === "menu" ? "start" : cb.data, name, chat);
      const r = await api("editMessageText", { chat_id: chat, message_id: cb.message.message_id, text: v.text, parse_mode: "HTML", reply_markup: v.kb, disable_web_page_preview: true });
      if (!r.ok && !/not modified/.test(await r.text())) await send(v.text, v.kb);
      return new Response("ok");
    }
    const text = (m?.text || "").trim(), rp = m?.reply_to_message?.text || "";
    const mode = Object.keys(PROMPT).find((k) => rp.startsWith(PROMPT[k]));
    let cmd = "start";
    if (mode && text) cmd = `${mode}:${text}`;
    else if (text.startsWith("/")) {
      const [c, ...a] = text.slice(1).split(/\s+/), base = c.split("@")[0].toLowerCase(), arg = a.join(" ");
      const map: Record<string, string> = { titles: "ti", thumb: "th", thumbnail: "th", hashtags: "ht", tags: "ht", setgame: "sg" }, alias: Record<string, string> = { today: "today", kit: "today", days: "days", next: "wk7", week7: "wk7" };
      cmd = alias[base] ?? (map[base] ? (arg ? `${map[base]}:${arg}` : "ask:" + map[base]) : base);
    }
    if (cmd.startsWith("ask:")) { await api("sendMessage", { chat_id: chat, text: PROMPT[cmd.slice(4)] + "\n<i>Optional rank goal: Valorant | Radiant</i>", parse_mode: "HTML", reply_markup: { force_reply: true, input_field_placeholder: "Valorant | Radiant" } }); return new Response("ok"); }
    const v = await view(cmd, name, chat); await send(v.text, v.kb);
  } catch (_) { /* always 200 so Telegram doesn't retry */ }
  return new Response("ok");
});
