// @ts-nocheck
// Supabase Edge Function "valorant-stats": runs every 30 min and saves your ranked stats for valorant.html.
// Same pattern as yt-automation: x-cron-secret check, writes to the "site" table with OWNER_ID.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const E = (k: string) => Deno.env.get(k);
const J = { "Content-Type": "application/json" };

async function notify(text: string) { // Discord and/or Telegram, same secrets as yt-automation
  const d = E("DISCORD_WEBHOOK"); if (d) await fetch(d, { method: "POST", headers: J, body: JSON.stringify({ content: text }) });
  const t = E("TELEGRAM_BOT_TOKEN"), c = E("TELEGRAM_CHAT_ID");
  if (t && c) await fetch(`https://api.telegram.org/bot${t}/sendMessage`, { method: "POST", headers: J, body: JSON.stringify({ chat_id: c, text }) });
}
async function henrik(path: string) {
  const r = await fetch("https://api.henrikdev.xyz" + path, { headers: { Authorization: E("HENRIK_KEY")! } });
  const j = await r.json();
  if (!r.ok) throw new Error(j.errors?.[0]?.message || "Valorant API error " + r.status);
  return j.data;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== E("CRON_SECRET")) return new Response("forbidden", { status: 403 });
  try {
    const RN = E("RIOT_NAME"), RT = E("RIOT_TAG"), RG = (E("RIOT_REGION") ?? "ap").toLowerCase();
    if (!E("HENRIK_KEY") || !RN || !RT) throw new Error("Set HENRIK_KEY, RIOT_NAME and RIOT_TAG in the function secrets.");
    const e = encodeURIComponent;
    const mmr = await henrik(`/valorant/v3/mmr/${RG}/pc/${e(RN)}/${e(RT)}`);
    const matches = await henrik(`/valorant/v3/matches/${RG}/${e(RN)}/${e(RT)}?mode=Competitive&size=10`);

    const me = (p: any) => String(p.name).toLowerCase() === RN.toLowerCase() && String(p.tag).toLowerCase() === RT.toLowerCase();
    const rows: any[] = [];
    for (const m of matches || []) {
      const p = m.players?.all_players?.find(me); if (!p || !m.metadata) continue;
      const side = String(p.team).toLowerCase(), mine = m.teams?.[side], rp = Math.max(1, m.metadata.rounds_played), st = p.stats;
      rows.push({ map: m.metadata.map, agent: p.character, icon: p.assets?.agent?.small, k: st.kills, d: st.deaths, a: st.assists,
        won: !!mine?.has_won, score: `${mine?.rounds_won ?? "?"}-${mine?.rounds_lost ?? "?"}`, acs: Math.round(st.score / rp), adr: Math.round(p.damage_made / rp),
        hsN: st.headshots, shots: st.headshots + st.bodyshots + st.legshots, at: m.metadata.game_start });
    }
    rows.sort((a, b) => b.at - a.at);
    const n = rows.length, sum = (f: (r: any) => number) => rows.reduce((t, r) => t + f(r), 0);
    const recent = n ? { games: n, wins: rows.filter((r) => r.won).length, kd: +(sum((r) => r.k) / Math.max(1, sum((r) => r.d))).toFixed(2),
      acs: Math.round(sum((r) => r.acs) / n), adr: Math.round(sum((r) => r.adr) / n), hs: Math.round(100 * sum((r) => r.hsN) / Math.max(1, sum((r) => r.shots))) } : null;
    const ag: Record<string, any> = {};
    for (const r of rows) { const a = (ag[r.agent] ??= { name: r.agent, icon: r.icon, games: 0, wins: 0, k: 0, d: 0 }); a.games++; a.wins += r.won ? 1 : 0; a.k += r.k; a.d += r.d; }
    const agents = Object.values(ag).sort((a: any, b: any) => b.games - a.games).slice(0, 4)
      .map((a: any) => ({ name: a.name, icon: a.icon, games: a.games, wins: a.wins, kd: +(a.k / Math.max(1, a.d)).toFixed(2) }));
    const cur = mmr.current, pk = mmr.peak, last = (mmr.seasonal || []).at(-1);
    const out = { updated: new Date().toISOString(), player: { name: RN, tag: RT, region: RG.toUpperCase() },
      rank: { tier: cur.tier.name, rr: cur.rr, change: cur.last_change, elo: cur.elo, peak: pk?.tier?.name ?? null, peakSeason: pk?.season?.short ?? null },
      act: last ? { season: last.season?.short, wins: last.wins, games: last.games } : null, recent, agents,
      matches: rows.slice(0, 8).map(({ hsN, shots, ...r }) => r) };

    const sb = createClient(E("SUPABASE_URL")!, E("SUPABASE_SERVICE_ROLE_KEY")!), owner = E("OWNER_ID");
    const put = (k: string, v: unknown) => sb.from("site").upsert({ key: k, value: v, owner });
    const w = await put("valorant", out); if (w.error) throw new Error(w.error.message);
    const prev = (await sb.from("site").select("value").eq("key", "val_rank").maybeSingle()).data?.value;
    if (prev && cur.elo > prev.elo && cur.tier.name !== prev.tier)
      await notify(`🔥 RANK UP! ${prev.tier} → ${cur.tier.name}\nPost a Short of the game that did it, with the new rank in the title.`);
    await put("val_rank", { elo: cur.elo, tier: cur.tier.name });
    return new Response("ok");
  } catch (err) { return new Response("Error: " + (err as Error).message, { status: 500 }); }
});
