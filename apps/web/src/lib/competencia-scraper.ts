import "server-only";
import { runActor, apifyEnabled, ApifyQuotaError } from "@/lib/apify";
import { postKey } from "@/lib/post-snapshots-core";
import {
  SCRAPER_BRANDS, FB_PAGES, WEB_COMPETIDORES, igProfileUrl, tagInstagram, tagFacebook, n8nAnalysisPrompt, N8N_SYSTEM_PROMPT,
  parseAnalysisContent, mapToSocialRows, mergeSocialRow, normalizeWeb, webHasData, cleanDomain,
  type Analysis, type TaggedPost, type SocialRow, type ExistingRow, type WebRow,
} from "@/lib/competencia-scraper-core";

// Scraper de competencia en código (reemplaza los workflows de n8n; ver docs/n8n-migracion.md).
// Partes: fb (diario), ig (comentarios → sentimiento, semanal), web (SimilarWeb, semanal), fbfol (seguidores FB, semanal).
// `dry` = corre los actores y el LLM y devuelve las filas mapeadas SIN escribir (para n8n-paridad.ts).
// Nunca tira: cada parte devuelve su estado. Cupo de Apify agotado (402/403) → corta y lo informa.

const ACTORS = {
  ig: process.env.APIFY_ACTOR_IG || "apify~instagram-scraper",
  // El export del repo dice facebook-pages-scraper, pero la cuenta corre facebook-posts-scraper (el de páginas no
  // devuelve posts; confirmado en BIP con la misma cuenta). Se puede cambiar sin deploy.
  fb: process.env.APIFY_ACTOR_FB || "apify~facebook-posts-scraper",
  fbPage: process.env.APIFY_ACTOR_FB_PAGE || "apify~facebook-pages-scraper",
  web: process.env.APIFY_ACTOR_SIMILARWEB || "radeance~similarweb-scraper",
};
const MAX_CHARGE = Number(process.env.APIFY_MAX_CHARGE_USD || "2");
const DAY = 86_400_000;
const arDate = (ms: number) => new Date(ms - 3 * 3600_000).toISOString().slice(0, 10);
const envInt = (k: string, d: number) => { const n = Number(process.env[k]); return Number.isFinite(n) && n > 0 ? Math.round(n) : d; };

export interface RunCtx { dry: boolean; quota: { stopped: boolean; message?: string } }
export const newCtx = (dry: boolean): RunCtx => ({ dry, quota: { stopped: false } });

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase no configurado");
  return { url, h: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } };
}
async function restGet<T>(path: string): Promise<T[]> {
  const c = sb();
  const r = await fetch(`${c.url}/rest/v1/${path}`, { headers: c.h, cache: "no-store" });
  if (!r.ok) throw new Error(`Supabase GET ${r.status}: ${(await r.text()).slice(0, 160)}`);
  return (await r.json()) as T[];
}
async function restUpsert(table: string, onConflict: string, rows: unknown[]): Promise<{ ok: boolean; error?: string }> {
  if (!rows.length) return { ok: true };
  const c = sb();
  const r = await fetch(`${c.url}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST", headers: { ...c.h, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows), cache: "no-store",
  });
  return r.ok ? { ok: true } : { ok: false, error: `${r.status}: ${(await r.text()).slice(0, 200)}` };
}

async function actor<T = Record<string, unknown>>(ctx: RunCtx, id: string, input: Record<string, unknown>, maxItems: number): Promise<{ items: T[]; error?: string }> {
  if (ctx.quota.stopped) return { items: [], error: `salteado: cupo de Apify agotado (${ctx.quota.message ?? ""})` };
  try {
    return { items: await runActor<T>(id, input, 240, { maxItems, maxChargeUsd: MAX_CHARGE }) };
  } catch (e) {
    const msg = (e as Error).message;
    if (e instanceof ApifyQuotaError) {
      ctx.quota = { stopped: true, message: msg.slice(0, 200) };
      console.error("[competencia-social] Apify sin cupo, se corta la corrida:", msg);
    }
    return { items: [], error: msg.slice(0, 240) };
  }
}

// ── LLM (mismo prompt/modelo que el nodo "GPT Analysis" de n8n) ────────────────────────────────
const LLM_BATCH = 40;
async function analyze(posts: TaggedPost[]): Promise<{ map: Map<string, Analysis>; errores: string[] }> {
  const map = new Map<string, Analysis>();
  const errores: string[] = [];
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { map, errores: ["OPENAI_API_KEY no configurado"] };
  const model = process.env.COMPETENCIA_SCRAPER_MODEL || "gpt-4o";
  for (let i = 0; i < posts.length; i += LLM_BATCH) {
    const lote = posts.slice(i, i + LLM_BATCH);
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ model, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: N8N_SYSTEM_PROMPT }, { role: "user", content: n8nAnalysisPrompt(lote) }] }),
      });
      if (!res.ok) { errores.push(`OpenAI ${res.status}`); continue; }
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      for (const a of parseAnalysisContent(j.choices?.[0]?.message?.content ?? "{}")) map.set(a.url, a);
    } catch (e) { errores.push((e as Error).message.slice(0, 120)); }
  }
  return { map, errores };
}

async function existingByKey(urls: string[]): Promise<Map<string, ExistingRow>> {
  const out = new Map<string, ExistingRow>();
  const sel = "url,red_social,marca,fecha,pilar,positivo,negativo,neutro,likes,comentarios,views,engagement,tipo,content_type,thumbnail_url,copy,followers";
  for (let i = 0; i < urls.length; i += 80) {
    const chunk = urls.slice(i, i + 80);
    const list = chunk.map((u) => `"${u.replace(/"/g, "")}"`).join(",");
    const rows = await restGet<ExistingRow>(`social_posts?select=${sel}&url=in.(${encodeURIComponent(list)})`);
    for (const r of rows) out.set(postKey(r.url), r);
  }
  return out;
}
/** IG: además de la url exacta, el mismo shortcode puede estar guardado como /p/ o /reel/. */
async function existingIg(marcas: readonly string[], since: string): Promise<Map<string, ExistingRow>> {
  const sel = "url,red_social,marca,fecha,pilar,positivo,negativo,neutro,likes,comentarios,views,engagement,tipo,content_type,thumbnail_url,copy,followers";
  const rows = await restGet<ExistingRow>(`social_posts?select=${sel}&red_social=eq.INSTAGRAM&marca=in.(${marcas.map((m) => `"${m}"`).join(",")})&fecha=gte.${since}&order=id&limit=3000`);
  return new Map(rows.map((r) => [postKey(r.url), r]));
}

/** Escribe filas del scraper sin perder información (merge contra lo existente) + updated_at. */
async function writeSocial(rows: SocialRow[], existing: Map<string, ExistingRow>): Promise<{ nuevos: number; actualizados: number; error?: string }> {
  const stamp = new Date().toISOString();
  let nuevos = 0, actualizados = 0;
  const out = rows.map((r) => {
    const ex = existing.get(postKey(r.url));
    if (ex) actualizados++; else nuevos++;
    // Si el post existe con otra variante de url (/reel/ vs /p/), se escribe sobre ESA url (sin duplicar).
    return { ...mergeSocialRow(ex, r), updated_at: stamp };
  });
  const w = await restUpsert("social_posts", "url", out);
  return w.ok ? { nuevos, actualizados } : { nuevos: 0, actualizados: 0, error: w.error };
}

function countBy(rows: { marca: string }[]): Record<string, number> {
  const o: Record<string, number> = {};
  for (const r of rows) o[r.marca] = (o[r.marca] ?? 0) + 1;
  return o;
}
const fromDateDefault = () => process.env.COMPETENCIA_FROM_DATE || `${new Date().getUTCFullYear()}-01-01`;

// ── Parte FB (diaria, lo que hacía n8n ~07:03 UTC) ─────────────────────────────────────────────
export async function partFacebook(ctx: RunCtx, opts: { limit?: number; analizarTodos?: boolean } = {}) {
  if (!apifyEnabled()) return { estado: "sin_apify" };
  const limit = opts.limit ?? envInt("COMPETENCIA_FB_LIMIT", 15);
  const pages = SCRAPER_BRANDS.map((m) => FB_PAGES[m]).filter(Boolean) as string[];
  const r = await actor(ctx, ACTORS.fb, { startUrls: pages.map((url) => ({ url })), resultsLimit: limit, maxPosts: limit }, limit * pages.length * 2);
  if (r.error && !r.items.length) return { estado: ctx.quota.stopped ? "sin_cupo_apify" : "error_apify", error: r.error };
  const tagged = tagFacebook(r.items).filter((p) => p.url);
  const existing = await existingByKey(tagged.map((p) => p.url));
  // Solo se clasifican (pilar) los posts nuevos o sin pilar: los ya clasificados conservan el suyo.
  const aAnalizar = opts.analizarTodos ? tagged : tagged.filter((p) => !existing.get(postKey(p.url))?.pilar);
  const { map, errores } = await analyze(aAnalizar);
  // Los ya clasificados no necesitan LLM: se les pasa un análisis neutro (sin sentimiento, FB no trae comentarios).
  for (const p of tagged) if (!map.has(p.url) && existing.get(postKey(p.url))?.pilar) map.set(p.url, { url: p.url, pilar: existing.get(postKey(p.url))!.pilar!, sentimiento: null });
  const { rows, stats } = mapToSocialRows(tagged, map, { marcas: SCRAPER_BRANDS, fromDate: fromDateDefault(), fbPageFallback: true });
  const base = { actor: ACTORS.fb, items: r.items.length, posts: tagged.length, filas: rows.length, porMarca: countBy(rows), analizados: aAnalizar.length, stats, erroresLlm: errores, sampleKeys: r.items[0] ? Object.keys(r.items[0]).slice(0, 40) : [] };
  if (ctx.dry) return { estado: "dry", ...base, rows };
  const w = await writeSocial(rows, existing);
  return { estado: w.error ? "error_escritura" : "ok", ...base, ...w };
}

// ── Parte IG por Apify (comentarios → sentimiento; semanal por defecto) ─────────────────────────
// Business Discovery (competencia-ig, diario) ya trae posts/likes/comentarios/views/seguidores. Apify queda
// solo para lo que la API oficial no da: el TEXTO de los comentarios (sentimiento), el pin (tipo PAUTA) y
// el pilar/sentimiento con el mismo prompt de n8n. Pocos posts por marca.
export async function partInstagram(ctx: RunCtx, opts: { posts?: number; dias?: number } = {}) {
  if (!apifyEnabled()) return { estado: "sin_apify" };
  const n = opts.posts ?? envInt("COMPETENCIA_IG_COMMENT_POSTS", 10);
  const dias = opts.dias ?? envInt("COMPETENCIA_IG_DIAS", 14);
  const newer = arDate(Date.now() - dias * DAY);
  const urls = SCRAPER_BRANDS.map(igProfileUrl);
  const r = await actor(ctx, ACTORS.ig, { directUrls: urls, resultsLimit: n, onlyPostsNewerThan: newer, scrapePosts: true, scrapeComments: false, enhanceUserData: true }, n * urls.length * 2);
  if (r.error && !r.items.length) return { estado: ctx.quota.stopped ? "sin_cupo_apify" : "error_apify", error: r.error };
  const tagged = tagInstagram(r.items);
  const { map, errores } = await analyze(tagged);
  const { rows, stats } = mapToSocialRows(tagged, map, { marcas: SCRAPER_BRANDS, fromDate: fromDateDefault() });
  const conComentarios = tagged.filter((p) => (p.commentTexts ?? []).length > 0).length;
  const base = { actor: ACTORS.ig, items: r.items.length, posts: tagged.length, conComentarios, filas: rows.length, porMarca: countBy(rows), conSentimiento: rows.filter((x) => x.positivo != null).length, stats, erroresLlm: errores };
  if (ctx.dry) return { estado: "dry", ...base, rows };
  const existing = await existingIg(SCRAPER_BRANDS, arDate(Date.now() - (dias + 30) * DAY));
  const w = await writeSocial(rows.map((x) => { const ex = existing.get(postKey(x.url)); return ex ? { ...x, url: ex.url } : x; }), existing);
  return { estado: w.error ? "error_escritura" : "ok", ...base, ...w };
}

// ── Parte web (SimilarWeb semanal, lo que hacía n8n los domingos ~00:00 UTC) ───────────────────
export async function partWeb(ctx: RunCtx) {
  if (!apifyEnabled()) return { estado: "sin_apify" };
  const fecha = new Date().toISOString().slice(0, 10); // n8n: fecha UTC del día de la corrida
  const doms = WEB_COMPETIDORES.map((c) => c.dominio);
  const r = await actor(ctx, ACTORS.web, { urls: doms.map((d) => `https://${d}`) }, doms.length * 2);
  if (r.error && !r.items.length) return { estado: ctx.quota.stopped ? "sin_cupo_apify" : "error_apify", error: r.error };
  const all = normalizeWeb(r.items, fecha);
  const rows = all.filter(webHasData);
  const faltan = doms.filter((d) => !rows.some((w) => w.dominio === cleanDomain(d)));
  const base = { actor: ACTORS.web, items: r.items.length, filas: rows.length, sinDato: all.length - rows.length, faltan };
  if (ctx.dry) return { estado: "dry", ...base, rows: rows.map(stripRaw) };
  // Nunca se pisa una semana buena con una vacía: solo se escriben dominios con visitas.
  const w = await restUpsert("competitor_web", "fecha,competidor,source", rows);
  return { estado: w.error ? "error_escritura" : "ok", ...base, error: w.error };
}
const stripRaw = (w: WebRow) => ({ ...w, raw: w.raw ? "(omitido)" : null });

// ── Parte seguidores de FB (semanal; n8n no los guardaba: el último dato era manual de mayo) ────
export async function partFbFollowers(ctx: RunCtx) {
  if (!apifyEnabled()) return { estado: "sin_apify" };
  const entries = SCRAPER_BRANDS.map((m) => [m, FB_PAGES[m]] as const).filter(([, u]) => !!u);
  const r = await actor<Record<string, unknown>>(ctx, ACTORS.fbPage, { startUrls: entries.map(([, url]) => ({ url })) }, entries.length * 2);
  if (r.error && !r.items.length) return { estado: ctx.quota.stopped ? "sin_cupo_apify" : "error_apify", error: r.error };
  const key = (u: unknown) => String(u ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/^(www\.|m\.|web\.)/, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
  const hoy = arDate(Date.now());
  const rows: { marca: string; red_social: "FACEBOOK"; fecha: string; followers: number }[] = [];
  r.items.forEach((it, i) => {
    const f = Number(it.followers ?? it.followersCount ?? 0);
    if (!Number.isFinite(f) || f <= 0) return;
    const u = key(it.facebookUrl ?? it.pageUrl ?? it.url ?? it.inputUrl);
    const hit = entries.find(([, url]) => key(url) === u) ?? (r.items.length === entries.length ? entries[i] : undefined);
    if (hit) rows.push({ marca: hit[0], red_social: "FACEBOOK", fecha: hoy, followers: Math.round(f) });
  });
  if (ctx.dry) return { estado: "dry", items: r.items.length, rows };
  const w = await restUpsert("social_followers", "marca,red_social,fecha", rows);
  return { estado: w.error ? "error_escritura" : "ok", filas: rows.length, error: w.error };
}
