import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenant/current";
import { fetchBusinessDiscovery, getDreanIgAsset, newBdSession } from "@/lib/ig-discovery";
import { canonIgUrl, socialContentType } from "@/lib/ig-discovery-core";
import { snapshotRows, postKey, type RedSnap, type SnapInputPost } from "@/lib/post-snapshots-core";
import { recordPostSnapshots } from "@/lib/post-snapshots";
import { temasExistentes, temasPrompt, parseTemas, TEMAS_LOTE } from "@/lib/redes-temas";

// Competencia de redes — refresco DIARIO (workflow competencia-ig.yml). Tres partes (`?part=`):
//  · bd     : cuentas de Instagram de la competencia por Business Discovery (Graph OFICIAL, token de la
//             Página de Drean). ANTES que el scraper: actualiza likes/comentarios/views de los posts que
//             ya están en social_posts (match por shortcode) e inserta los que falten; guarda seguidores
//             del día en social_followers. Lo que la API no cubre (cuenta no Business, permiso, rate
//             limit) queda con el dato del scraper n8n + Apify (fallback, sin cambios).
//  · snaps  : fotos por edad (1/3/7 días) → social_post_snapshots (migración 0115): las de Business
//             Discovery (se toman en la parte bd) + las filas del scraper con su updated_at como momento.
//  · temas  : tema corto por post (gpt-4o-mini, lotes de 60, reusa temas ya usados) → social_posts.tema
//             (migración 0116). Sin la columna, se saltea.
// Sin `part` corre las tres. Nunca tira: cada parte informa su estado en el JSON.

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const arDate = (ms: number) => new Date(ms - 3 * 3600_000).toISOString().slice(0, 10);

function sbConf() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase no configurado");
  return { url, key, h: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } };
}
async function rest<T>(path: string): Promise<{ ok: boolean; status: number; data: T[]; error?: string }> {
  const c = sbConf();
  const r = await fetch(`${c.url}/rest/v1/${path}`, { headers: c.h, cache: "no-store" });
  if (!r.ok) return { ok: false, status: r.status, data: [], error: (await r.text()).slice(0, 200) };
  return { ok: true, status: r.status, data: (await r.json()) as T[] };
}
async function write(method: "POST" | "PATCH", path: string, body: unknown, prefer = "return=minimal"): Promise<{ ok: boolean; error?: string }> {
  const c = sbConf();
  const r = await fetch(`${c.url}/rest/v1/${path}`, { method, headers: { ...c.h, Prefer: prefer }, body: JSON.stringify(body), cache: "no-store" });
  return r.ok ? { ok: true } : { ok: false, error: `${r.status}: ${(await r.text()).slice(0, 160)}` };
}

interface FolRow { marca: string; red_social: string; fecha: string; followers: number }
const folAt = (fol: FolRow[], marca: string, red: string, fecha: string | null): number | null => {
  if (!fecha) return null;
  let best: FolRow | null = null;
  for (const s of fol) { if (s.marca !== marca || s.red_social !== red || s.fecha > fecha) continue; if (!best || s.fecha > best.fecha) best = s; }
  return best?.followers ?? null;
};

// ── Parte bd ──────────────────────────────────────────────────────────────────
async function partBd(mode: "daily" | "full") {
  const t = getTenant();
  const cuentas = t.socialAccounts.filter((a) => a.key !== t.ownBrand.key);
  const { asset, motivo } = await getDreanIgAsset();
  if (!asset) return { estado: "sin_token", motivo, marcas: [], snaps: [] as SnapInputPost[] };
  const s = newBdSession();
  const now = Date.now();
  const fromDate = arDate(now - (mode === "full" ? 120 : 30) * DAY);
  const hoy = arDate(now);
  const marcas: Record<string, unknown>[] = [];
  const snaps: SnapInputPost[] = [];
  for (const a of cuentas) {
    if (s.stopped) { marcas.push({ marca: a.key, estado: "rate_limit", fallback: "scraper" }); continue; }
    const r = await fetchBusinessDiscovery(asset, a.handle, a.key, fromDate, mode, s);
    if (!r.ok) { marcas.push({ marca: a.key, estado: r.error ?? "error", motivo: r.message, fallback: "scraper" }); continue; }
    // Posts ya cargados por el scraper (match por shortcode → se actualiza SU fila, sin duplicar).
    const ex = await rest<{ url: string }>(`social_posts?select=url&red_social=eq.INSTAGRAM&marca=eq.${encodeURIComponent(a.key)}&fecha=gte.${arDate(Date.parse(`${fromDate}T12:00:00Z`) - 5 * DAY)}&limit=2000`);
    const byKey = new Map(ex.data.map((x) => [postKey(x.url), x.url]));
    let upd = 0, ins = 0, fail = 0;
    const nuevos: Record<string, unknown>[] = [];
    const stamp = new Date().toISOString();
    for (const p of r.posts) {
      const url = byKey.get(postKey(p.url));
      if (url) {
        // Solo métricas (no pisa pilar/sentimiento/miniatura espejada del scraper). Likes ocultos → no se tocan.
        const patch: Record<string, unknown> = { comentarios: p.comentarios, updated_at: stamp };
        if (p.likes != null) patch.likes = p.likes;
        if (p.views > 0) patch.views = p.views;
        if (r.followers) patch.followers = r.followers;
        const w = await write("PATCH", `social_posts?url=eq.${encodeURIComponent(url)}`, patch);
        if (w.ok) upd++; else fail++;
      } else {
        nuevos.push({
          red_social: "INSTAGRAM", url: canonIgUrl(p.url), marca: a.key, fecha: p.fecha, tipo: "ORGÁNICO",
          likes: p.likes ?? -1, comentarios: p.comentarios, views: p.views, content_type: socialContentType(p.content_type),
          sponsored: false, followers: r.followers ?? 0, thumbnail_url: p.thumbnail_url, copy: p.copy || null, updated_at: stamp,
        });
      }
      snaps.push({ marca: a.key, red: "INSTAGRAM", url: p.url, ts: p.ts, fecha: p.fecha, likes: p.likes, comentarios: p.comentarios, views: p.views, followers: r.followers });
    }
    if (nuevos.length) {
      const w = await write("POST", "social_posts?on_conflict=url", nuevos, "resolution=ignore-duplicates,return=minimal");
      if (w.ok) ins = nuevos.length; else fail += nuevos.length;
    }
    if (r.followers) await write("POST", "social_followers?on_conflict=marca,red_social,fecha", [{ marca: a.key, red_social: "INSTAGRAM", fecha: hoy, followers: r.followers }], "resolution=merge-duplicates,return=minimal");
    marcas.push({ marca: a.key, estado: "ok", posts: r.posts.length, actualizados: upd, nuevos: ins, fallidos: fail, seguidores: r.followers, likesOcultos: r.likesOcultos, llamadas: r.calls });
  }
  return { estado: "ok", usoRateLimitPct: s.usage, cortadoPorRateLimit: s.stopped, llamadas: s.calls, marcas, snaps };
}

// ── Parte snaps ───────────────────────────────────────────────────────────────
async function partSnaps(bdSnaps: SnapInputPost[]) {
  const now = new Date();
  const out: Record<string, unknown> = {};
  const bdRows = snapshotRows(bdSnaps, now);
  out.business_discovery = await recordPostSnapshots(bdRows, "business_discovery");
  // Filas del scraper (todas las marcas, IG + FB) fotografiadas en el momento en que se leyeron (updated_at).
  const since = arDate(now.getTime() - 12 * DAY);
  const [sp, fol] = await Promise.all([
    rest<{ red_social: string; url: string; marca: string; fecha: string | null; likes: number | null; comentarios: number | null; views: number | null; updated_at: string }>(
      `social_posts?select=red_social,url,marca,fecha,likes,comentarios,views,updated_at&fecha=gte.${since}&red_social=in.(INSTAGRAM,FACEBOOK,TIKTOK)&limit=3000`),
    rest<FolRow>("social_followers?select=marca,red_social,fecha,followers&limit=5000"),
  ]);
  const rows = sp.data.flatMap((p) => snapshotRows([{
    marca: p.marca, red: p.red_social as RedSnap, url: p.url, fecha: p.fecha,
    likes: p.likes != null && p.likes >= 0 ? p.likes : 0, comentarios: p.comentarios, views: p.views,
    followers: folAt(fol.data, p.marca, p.red_social, p.fecha),
  }], new Date(p.updated_at)));
  out.scraper = await recordPostSnapshots(rows, "apify");
  return out;
}

// ── Parte temas ───────────────────────────────────────────────────────────────
async function partTemas(maxLotes: number) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { estado: "sin_openai" };
  const since = arDate(Date.now() - 150 * DAY);
  const pend = await rest<{ id: string; marca: string; copy: string | null }>(`social_posts?select=id,marca,copy&tema=is.null&fecha=gte.${since}&order=fecha.desc&limit=${TEMAS_LOTE * maxLotes}`);
  if (!pend.ok) return { estado: /tema/.test(pend.error ?? "") ? "sin_columna (correr migración 0116)" : "error", error: pend.error };
  if (!pend.data.length) return { estado: "ok", clasificados: 0 };
  const usados = await rest<{ tema: string | null }>(`social_posts?select=tema&tema=not.is.null&tema=neq.&order=fecha.desc&limit=3000`);
  const existentes = temasExistentes(usados.data);
  let clasificados = 0, lotes = 0;
  const errores: string[] = [];
  for (let i = 0; i < pend.data.length; i += TEMAS_LOTE) {
    const lote = pend.data.slice(i, i + TEMAS_LOTE);
    lotes++;
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini", temperature: 0.1, response_format: { type: "json_object" }, max_tokens: 2500,
          messages: [{ role: "user", content: temasPrompt(lote.map((p, j) => ({ i: j + 1, marca: p.marca, copy: p.copy ?? "" })), existentes) }],
        }),
      });
      if (!res.ok) { errores.push(`OpenAI ${res.status}`); break; }
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const temas = parseTemas(j.choices?.[0]?.message?.content ?? "{}");
      const stamp = new Date().toISOString();
      for (let k = 0; k < lote.length; k++) {
        const tema = temas.get(k + 1) ?? ""; // "" = sin tema útil → no se re-pide en cada corrida
        const w = await write("PATCH", `social_posts?id=eq.${lote[k]!.id}`, { tema, tema_at: stamp });
        if (w.ok && tema) { clasificados++; if (!existentes.includes(tema) && existentes.length < 40) existentes.push(tema); }
      }
    } catch (e) { errores.push((e as Error).message.slice(0, 120)); break; }
  }
  return { estado: errores.length ? "parcial" : "ok", pendientes: pend.data.length, clasificados, lotes, errores };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const u = new URL(request.url);
  const part = u.searchParams.get("part") ?? "all";
  const mode = u.searchParams.get("mode") === "full" ? "full" : "daily";
  const maxLotes = Math.min(Math.max(Number(u.searchParams.get("lotes") ?? 3) || 3, 1), 10);
  const results: Record<string, unknown> = {};
  let bdSnaps: SnapInputPost[] = [];
  if (part === "all" || part === "bd") {
    try { const r = await partBd(mode); bdSnaps = r.snaps; results.bd = { ...r, snaps: r.snaps.length }; } catch (e) { results.bd = { estado: "error", error: (e as Error).message }; }
  }
  if (part === "all" || part === "snaps" || part === "bd") {
    try { results.snaps = await partSnaps(bdSnaps); } catch (e) { results.snaps = { estado: "error", error: (e as Error).message }; }
  }
  if (part === "all" || part === "temas") {
    try { results.temas = await partTemas(maxLotes); } catch (e) { results.temas = { estado: "error", error: (e as Error).message }; }
  }
  // ok:true salvo error inesperado: la falta de token/permiso/migración es un estado, no una caída.
  return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), part, mode, results });
}
