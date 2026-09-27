import "server-only";
import { getSearchConsoleSnapshot } from "@/lib/search-console";
import { getWebCalidadSnapshot } from "@/lib/web-calidad-server";
import {
  parseRobots, parseSitemap, parseHtml, accesoBots, chequearPagina, chequearCwv, chequearSitio, agruparHallazgos, saludSitio,
  parsePsi, parseCrux, elegirPaginas, auditCaps,
  type PageFacts, type BotAcceso, type CwvDato, type AuditIssue, type Hallazgo, type SitemapUrl,
} from "@/lib/seo-audit-core";

// ============================================================================
// AUDITORÍA TÉCNICA SEO/GEO + CORE WEB VITALS de drean.com.ar (server). Portado de BIP (sep-2026).
// Semanal por cron (/api/cron/seo-audit, workflow seo-audit.yml). Guarda UNA fila en
// seo_audit_snapshot (migración 0118); /seo-search la lee. Fail-safe: sin la migración se calcula
// igual pero no se guarda; una página que falla no corta el resto; nunca tira.
//  · Páginas: home + top por clics de Search Console + top landings de GA4 (snapshot de calidad web)
//    + URLs del sitemap. Tope SEO_AUDIT_PAGINAS (default 20).
//  · CWV de campo: CrUX API por URL/origen si hay GOOGLE_PSI_KEY (la misma key sirve para PageSpeed
//    Insights); PageSpeed Insights mobile para las top SEO_AUDIT_PSI (default 8). SIN key, PSI anda
//    con cuota compartida (suele dar 429) → la UI avisa "falta la clave".
//  · IndexNow / Bing Webmaster: NO (requieren publicar un archivo con la key en drean.com.ar).
// ============================================================================

export const AUDIT_SITE = "https://www.drean.com.ar";
const HOST = new URL(AUDIT_SITE).hostname;
const ROOT = HOST.replace(/^www\./, "");

export interface SeoAuditData {
  v: 1;
  ok: boolean;
  code?: "error";
  error?: string;
  site?: string;
  fuentePaginas?: string[];
  caps?: { paginas: number; psi: number };
  paginas?: PageFacts[];
  bots?: BotAcceso[];
  robots?: { status: number; sitemaps: string[] } | null;
  sitemap?: { url: string; status: number; tipo: "urlset" | "index" | "invalido"; urls: number } | null;
  cwv?: CwvDato[];
  cwvFuente?: "crux" | "psi" | "mixto" | null;
  /** true si GOOGLE_PSI_KEY estaba configurada en la corrida. */
  psiKey?: boolean;
  /** PSI respondió 429 (cuota compartida agotada sin key). */
  psiCuota?: boolean;
  issues?: AuditIssue[];
  salud?: number | null;
  /** true si el sitio rechazó al auditor (403/5xx en la mayoría de las páginas y en robots.txt). */
  bloqueado?: boolean;
  paginasBloqueadas?: number;
  updatedAt: string;
}

const UA = "Mozilla/5.0 (compatible; DreanDashboard-SEO-Audit/1.0)";
// Algunos firewalls/CDN (el de drean.com.ar incluido) responden 403/5xx a UAs que no son navegador:
// si pasa, se reintenta UNA vez con un UA de navegador para no reportar como "páginas con error" lo
// que en realidad es un bloqueo al auditor.
const UA_NAVEGADOR = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const HTML_MAX = 1_500_000;
const mismoSitio = (u: string) => { try { const h = new URL(u).hostname.toLowerCase(); return h === ROOT || h.endsWith(`.${ROOT}`); } catch { return false; } };

/** GET con timeout y tope de bytes. Solo sigue redirects dentro de drean.com.ar. */
type FetchRes = { status: number; text: string | null; finalUrl: string; headers: Headers };
const bloqueoProbable = (st: number) => st === 403 || st === 429 || st >= 500;
async function fetchText(url: string, max: number, timeoutMs = 12_000): Promise<FetchRes | null> {
  const r = await fetchTextUA(url, max, timeoutMs, UA);
  if (r && bloqueoProbable(r.status)) return (await fetchTextUA(url, max, timeoutMs, UA_NAVEGADOR)) ?? r;
  return r;
}

async function fetchTextUA(url: string, max: number, timeoutMs: number, ua: string): Promise<FetchRes | null> {
  let cur = url;
  try {
    for (let hop = 0; hop < 5; hop++) {
      if (!mismoSitio(cur)) return null;
      const res = await fetch(cur, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(timeoutMs), headers: { "User-Agent": ua, Accept: "text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.5" } });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        await res.body?.cancel().catch(() => {});
        cur = new URL(res.headers.get("location")!, cur).toString();
        continue;
      }
      let text: string | null = null;
      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let n = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done || !value) break;
          chunks.push(value); n += value.length;
          if (n >= max) { await reader.cancel().catch(() => {}); break; }
        }
        const buf = new Uint8Array(n);
        let off = 0;
        for (const c of chunks) { buf.set(c.subarray(0, Math.min(c.length, n - off)), off); off += c.length; if (off >= n) break; }
        text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      } else await res.body?.cancel().catch(() => {});
      return { status: res.status, text, finalUrl: cur, headers: res.headers };
    }
    return null;
  } catch { return null; }
}

async function mapLimit<T, R>(xs: T[], n: number, fn: (x: T) => Promise<R | null>): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(xs.length).fill(null);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, async () => {
    while (i < xs.length) { const k = i++; out[k] = await fn(xs[k]!).catch(() => null); }
  }));
  return out;
}

let psiCuota = false;
async function psi(url: string, key?: string): Promise<CwvDato | null> {
  try {
    const q = new URLSearchParams({ url, strategy: "mobile", category: "performance" });
    if (key) q.set("key", key);
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { cache: "no-store", signal: AbortSignal.timeout(60_000) });
    if (res.status === 429) psiCuota = true;
    if (!res.ok) return null;
    return parsePsi(url, await res.json());
  } catch { return null; }
}
async function crux(target: { url?: string; origin?: string }, key: string): Promise<CwvDato | null> {
  try {
    const res = await fetch(`https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${encodeURIComponent(key)}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({ ...target, formFactor: "PHONE", metrics: ["largest_contentful_paint", "interaction_to_next_paint", "cumulative_layout_shift"] }),
    });
    if (!res.ok) return null; // 404 = sin datos suficientes en CrUX
    return parseCrux(target.url ?? target.origin ?? "", await res.json(), !!target.origin);
  } catch { return null; }
}

export async function runSeoAudit(): Promise<SeoAuditData> {
  const updatedAt = new Date().toISOString();
  psiCuota = false;
  const caps = auditCaps(process.env);
  const [sc, web] = await Promise.all([getSearchConsoleSnapshot().catch(() => null), getWebCalidadSnapshot().catch(() => null)]);

  // 1) robots.txt + sitemap (si es índice, se baja el 1er sitemap hijo).
  const rob = await fetchText(`${AUDIT_SITE}/robots.txt`, 512 * 1024);
  const robotsTxt = rob && rob.status === 200 ? rob.text : null;
  const parsed = robotsTxt ? parseRobots(robotsTxt) : null;
  const smUrl = parsed?.sitemaps.find((u) => mismoSitio(u)) ?? `${AUDIT_SITE}/sitemap.xml`;
  let sitemap: SeoAuditData["sitemap"] = null;
  let smUrls: SitemapUrl[] = [];
  if (!/\.gz($|\?)/i.test(smUrl)) {
    const sm = await fetchText(smUrl, 3_000_000, 15_000);
    if (sm) {
      const p = sm.status === 200 ? parseSitemap(sm.text) : { tipo: "invalido" as const, urls: [] };
      if (p.tipo === "index" && p.urls[0]) {
        const child = await fetchText(p.urls[0].loc, 3_000_000, 15_000);
        const pc = child?.status === 200 ? parseSitemap(child.text) : null;
        smUrls = pc?.tipo === "urlset" ? pc.urls : [];
      } else smUrls = p.urls;
      sitemap = { url: smUrl, status: sm.status, tipo: p.tipo, urls: p.urls.length };
    }
  }

  // 2) Páginas: SC (clics) → landings GA4 (sesiones) → sitemap.
  const fuentes: string[] = [];
  const cands: { url: string; clicks?: number; impresiones?: number }[] = [];
  if (sc?.status === "ok" && sc.data.ok && sc.data.pages?.length) { fuentes.push("Search Console"); cands.push(...sc.data.pages.map((p) => ({ url: p.key, clicks: p.clicks, impresiones: p.impressions }))); }
  const land = web?.status === "ok" ? web.data.ga4?.reports.landing.rows ?? [] : [];
  if (land.length) {
    fuentes.push("landings de GA4");
    cands.push(...land.map((r) => ({ path: String(r.dimensionValues[0]?.value ?? ""), s: Number(r.metricValues[0]?.value ?? 0) }))
      .filter((r) => r.path.startsWith("/")).sort((a, b) => b.s - a.s).slice(0, 40).map((r) => ({ url: `${AUDIT_SITE}${r.path.replace(/\?.*$/, "")}` })));
  }
  if (smUrls.length) { fuentes.push("sitemap"); cands.push(...smUrls.slice(0, 40).map((u) => ({ url: u.loc }))); }
  const sel = elegirPaginas(AUDIT_SITE, cands, caps.paginas);

  // 3) HTML (4 en paralelo).
  const pages: PageFacts[] = (await mapLimit(sel, 4, async (p): Promise<PageFacts | null> => {
    const r = await fetchText(p.url, HTML_MAX);
    if (!r) return null;
    const f = r.text != null
      ? parseHtml(r.text, { url: p.url, finalUrl: r.finalUrl, status: r.status, xRobots: r.headers.get("x-robots-tag"), contentType: r.headers.get("content-type"), bytes: r.text.length })
      : { ...parseHtml("", { url: p.url, finalUrl: r.finalUrl, status: r.status }), textChars: 0 };
    return { ...f, clicks: p.clicks, impresiones: p.impresiones };
  })).filter((x): x is PageFacts => !!x);
  if (!pages.length && !rob) {
    return { v: 1, ok: false, code: "error", error: `No pudimos leer ${AUDIT_SITE} (robots.txt ni páginas).`, updatedAt };
  }

  // 4) CWV: CrUX (con key) por URL + origen; PSI para las top N sin dato de campo.
  const key = process.env.GOOGLE_PSI_KEY?.trim() || undefined;
  const cwv: CwvDato[] = [];
  const topCwv = pages.filter((p) => p.status < 400).slice(0, caps.psi);
  let usoCrux = false, usoPsi = false;
  if (key) {
    const got = await mapLimit(topCwv, 5, (p) => crux({ url: p.finalUrl }, key));
    got.forEach((g) => { if (g?.fuente) { cwv.push(g); usoCrux = true; } });
    const origen = await crux({ origin: AUDIT_SITE }, key);
    if (origen?.fuente) { cwv.push({ ...origen, url: AUDIT_SITE }); usoCrux = true; }
  }
  const sinCampo = topCwv.filter((p) => !cwv.some((c) => c.url === p.finalUrl));
  const psiRes = await mapLimit(sinCampo, 3, (p) => psi(p.finalUrl, key));
  psiRes.forEach((g) => { if (g?.fuente) { cwv.push(g); usoPsi = true; } });

  // 5) Chequeos → issues agrupados.
  const hallazgos: Hallazgo[] = [
    ...pages.flatMap(chequearPagina),
    ...chequearSitio({ robots: rob ? { status: rob.status, txt: robotsTxt } : null, sitemap, pages }),
    ...cwv.filter((c) => c.url !== AUDIT_SITE || !cwv.some((x) => x.url !== c.url && x.fuente === "url")).flatMap(chequearCwv),
  ];
  // Si la mayoría de las páginas (y el robots.txt) responden 403/5xx aun con UA de navegador, lo más
  // probable es un firewall que bloquea al auditor, no páginas rotas: no se reportan como error ni
  // cuentan para la salud (la UI muestra el aviso `bloqueado`).
  const errores = pages.filter((p) => bloqueoProbable(p.status)).length;
  const bloqueado = pages.length >= 4 && errores / pages.length >= 0.5 && (!rob || bloqueoProbable(rob.status));
  const issues = agruparHallazgos(bloqueado ? hallazgos.filter((h) => h.check !== "http_error" && h.check !== "sitemap_ausente") : hallazgos, pages);
  return {
    v: 1, ok: true, site: AUDIT_SITE, fuentePaginas: fuentes, caps,
    paginas: pages.map((p) => ({ ...p, h1: p.h1.slice(0, 3).map((x) => x.slice(0, 120)), title: p.title?.slice(0, 200) ?? null, metaDescription: p.metaDescription?.slice(0, 300) ?? null })),
    bots: accesoBots(parsed), robots: rob ? { status: rob.status, sitemaps: parsed?.sitemaps.slice(0, 5) ?? [] } : null, sitemap,
    cwv, cwvFuente: usoCrux && usoPsi ? "mixto" : usoCrux ? "crux" : usoPsi ? "psi" : null,
    psiKey: !!key, psiCuota,
    issues, salud: bloqueado ? null : saludSitio(issues, pages.length), bloqueado, paginasBloqueadas: bloqueado ? errores : 0, updatedAt,
  };
}

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, headers: { apikey: key, Authorization: `Bearer ${key}` } } : null;
}

export type SeoAuditEstado = { status: "ok"; data: SeoAuditData } | { status: "empty" } | { status: "no_table" };
export async function getSeoAudit(): Promise<SeoAuditEstado> {
  const env = sb();
  if (!env) return { status: "no_table" };
  try {
    const res = await fetch(`${env.url}/rest/v1/seo_audit_snapshot?id=eq.1&select=data`, { headers: env.headers, cache: "no-store" });
    if (!res.ok) return { status: "no_table" };
    const rows = (await res.json()) as { data: SeoAuditData | null }[];
    const d = rows[0]?.data;
    return d?.v === 1 ? { status: "ok", data: d } : { status: "empty" };
  } catch { return { status: "no_table" }; }
}

/** Corre y persiste. Un error no pisa una auditoría buena anterior. */
export async function syncSeoAudit(): Promise<{ data: SeoAuditData; persisted: boolean; keptPrevious: boolean }> {
  let d: SeoAuditData;
  try { d = await runSeoAudit(); } catch (e) { d = { v: 1, ok: false, code: "error", error: (e as Error).message.slice(0, 300), updatedAt: new Date().toISOString() }; }
  const env = sb();
  if (!env) return { data: d, persisted: false, keptPrevious: false };
  if (!d.ok) {
    const prev = await getSeoAudit();
    if (prev.status === "ok" && prev.data.ok) return { data: prev.data, persisted: false, keptPrevious: true };
  }
  try {
    const res = await fetch(`${env.url}/rest/v1/seo_audit_snapshot?on_conflict=id`, {
      method: "POST",
      headers: { ...env.headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: 1, data: d, updated_at: d.updatedAt }),
      cache: "no-store",
    });
    return { data: d, persisted: res.ok, keptPrevious: false };
  } catch { return { data: d, persisted: false, keptPrevious: false }; }
}
