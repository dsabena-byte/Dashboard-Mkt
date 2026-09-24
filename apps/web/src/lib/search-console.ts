import "server-only";
import type { SearchConsoleData as ScDataLite, ScMonth, ScRow, ScQueryPage } from "@/lib/signals/model";

// ============================================================================
// Google SEARCH CONSOLE de drean.com.ar — SEO PROPIO real (clicks, impresiones, CTR y
// posición por búsqueda y por página). Portado de BIP (lib/search-console.ts), single-tenant.
//
// Auth: el MISMO OAuth de Google que usa el cron de GA4 (env GOOGLE_CLIENT_ID /
// GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN). Requiere que el refresh token incluya el scope
// `https://www.googleapis.com/auth/webmasters.readonly` (además de analytics.readonly + adwords,
// que usan GA4 y Google Ads) y que la "Google Search Console API" esté habilitada en el proyecto
// de Cloud de la app OAuth. Si falta, el snapshot guarda `code` (no_scope / api_disabled /
// no_site) y la UI de /seo-search explica qué hacer (pasos en CLAUDE.md).
//
// Snapshot en `search_console_snapshot` (id=1, migración 0107). Lo llena el cron
// /api/cron/search-console (workflow search-console-sync.yml, semanal). Fail-safe: sin la
// tabla, get devuelve { status: "no_table" } y el sync no tira.
// El análisis (quick wins, CTR bajo, etc.) es PURO y vive en lib/signals/model.ts
// (analyzeSearchConsole / ctrEsperado), compartido con las señales cruce_sc_*.
// ============================================================================

export const SC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
export const SC_OWN_DOMAIN = "drean.com.ar";

export type ScCode = "no_creds" | "no_scope" | "api_disabled" | "no_site" | "error";
export interface SearchConsoleData extends ScDataLite {
  code?: ScCode;
  error?: string;
  sites?: string[]; // propiedades visibles (para diagnosticar "no_site")
  site?: string; // propiedad usada (sc-domain:… o URL-prefix)
  range?: { start: string; end: string }; // ventana de queries/páginas (≈ 3 meses)
}
export type { ScMonth, ScRow, ScQueryPage };

const API = "https://www.googleapis.com/webmasters/v3";
const cleanDomain = (u: string) => u.toLowerCase().replace(/^sc-domain:/, "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
const ymd = (d: Date) => d.toISOString().slice(0, 10);

class ScError extends Error {
  constructor(public code: ScCode, msg: string) { super(msg); }
}

async function getAccessToken(): Promise<string> {
  const id = process.env.GOOGLE_CLIENT_ID, secret = process.env.GOOGLE_CLIENT_SECRET, refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (!id || !secret || !refresh) throw new ScError("no_creds", "Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  if (!res.ok) throw new ScError("error", `Google OAuth refresh ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function gget<T>(token: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text();
    let msg = t.slice(0, 240);
    try { msg = (JSON.parse(t) as { error?: { message?: string } })?.error?.message ?? msg; } catch { /* texto plano */ }
    if (res.status === 403 && /(has not been used|is disabled|SERVICE_DISABLED|accessNotConfigured)/i.test(msg)) throw new ScError("api_disabled", msg);
    if (res.status === 403 && /insufficient|scope/i.test(msg)) throw new ScError("no_scope", msg);
    if (res.status === 401) throw new ScError("no_scope", msg);
    throw new ScError("error", `Search Console ${res.status}: ${msg}`);
  }
  return res.json() as Promise<T>;
}

/** Elige la propiedad de drean.com.ar: sc-domain primero, después URL-prefix https. */
export function pickSite(sites: { siteUrl: string; permissionLevel?: string }[], domain = SC_OWN_DOMAIN): string | null {
  const ok = sites.filter((s) => s.permissionLevel !== "siteUnverifiedUser").map((s) => s.siteUrl);
  const dom = cleanDomain(domain);
  const matches = ok.filter((s) => { const d = cleanDomain(s); return d === dom || dom.endsWith(`.${d}`) || d.endsWith(`.${dom}`); });
  return matches.find((s) => s.startsWith("sc-domain:")) ?? matches.find((s) => s.startsWith("https://")) ?? matches[0] ?? null;
}

type ApiRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };
async function query(token: string, site: string, body: Record<string, unknown>): Promise<ApiRow[]> {
  const r = await gget<{ rows?: ApiRow[] }>(token, `/sites/${encodeURIComponent(site)}/searchAnalytics/query`, { dataState: "final", ...body });
  return r.rows ?? [];
}

/** Trae todo de la API (no persiste). Nunca tira: el error va en `code`. */
export async function fetchSearchConsole(): Promise<SearchConsoleData> {
  const now = new Date().toISOString();
  try {
    const token = await getAccessToken();
    const list = await gget<{ siteEntry?: { siteUrl: string; permissionLevel?: string }[] }>(token, "/sites");
    const entries = list.siteEntry ?? [];
    const sites = entries.map((e) => e.siteUrl).slice(0, 30);
    const site = pickSite(entries);
    if (!site) {
      return {
        v: 1, ok: false, code: "no_site", sites, updatedAt: now,
        error: entries.length ? `Ninguna propiedad de Search Console coincide con ${SC_OWN_DOMAIN}.` : "La cuenta de Google del token no tiene propiedades en Search Console.",
      };
    }
    // Search Console tiene ~2-3 días de demora.
    const end = new Date(Date.now() - 3 * 864e5);
    const start3m = new Date(end.getTime() - 90 * 864e5);
    const start13 = new Date(Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), 1)); // mismo mes del año anterior → 13 meses
    const [daily, qs, pgs, qp] = await Promise.all([
      query(token, site, { startDate: ymd(start13), endDate: ymd(end), dimensions: ["date"], rowLimit: 500 }),
      query(token, site, { startDate: ymd(start3m), endDate: ymd(end), dimensions: ["query"], rowLimit: 250 }),
      query(token, site, { startDate: ymd(start3m), endDate: ymd(end), dimensions: ["page"], rowLimit: 100 }),
      query(token, site, { startDate: ymd(start3m), endDate: ymd(end), dimensions: ["query", "page"], rowLimit: 500 }),
    ]);
    // Mensual: clicks/impresiones suman; posición ponderada por impresiones.
    const mm = new Map<string, { c: number; i: number; pw: number; d: number }>();
    for (const r of daily) {
      const k = (r.keys[0] ?? "").slice(0, 7);
      const e = mm.get(k) ?? { c: 0, i: 0, pw: 0, d: 0 };
      e.c += r.clicks; e.i += r.impressions; e.pw += r.position * r.impressions; e.d++;
      mm.set(k, e);
    }
    const monthly: ScMonth[] = [...mm.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, e]) => ({ mes, clicks: e.c, impressions: e.i, ctr: e.i ? (e.c / e.i) * 100 : 0, position: e.i ? e.pw / e.i : 0, dias: e.d }));
    const row = (r: ApiRow): ScRow => ({ key: r.keys[0] ?? "", clicks: r.clicks, impressions: r.impressions, ctr: r.ctr * 100, position: r.position });
    return {
      v: 1, ok: true, site, sites, range: { start: ymd(start3m), end: ymd(end) }, monthly,
      queries: qs.map(row).sort((a, b) => b.impressions - a.impressions),
      pages: pgs.map(row).sort((a, b) => b.clicks - a.clicks),
      queryPage: qp.map((r) => ({ query: r.keys[0] ?? "", page: r.keys[1] ?? "", clicks: r.clicks, impressions: r.impressions, ctr: r.ctr * 100, position: r.position })),
      updatedAt: now,
    };
  } catch (e) {
    const code: ScCode = e instanceof ScError ? e.code : "error";
    return { v: 1, ok: false, code, error: (e as Error).message?.slice(0, 300), updatedAt: now };
  }
}

// ── Persistencia (REST service key, sin cookies) ──
function sbEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, headers: { apikey: key, Authorization: `Bearer ${key}` } } : null;
}

export type ScSnapshot =
  | { status: "ok"; data: SearchConsoleData; updatedAt: string }
  | { status: "empty" } // tabla creada, sync nunca corrido
  | { status: "no_table" }; // migración 0107 no corrida (o error de lectura)

export async function getSearchConsoleSnapshot(): Promise<ScSnapshot> {
  const env = sbEnv();
  if (!env) return { status: "no_table" };
  try {
    const res = await fetch(`${env.url}/rest/v1/search_console_snapshot?id=eq.1&select=data,updated_at`, { headers: env.headers, cache: "no-store" });
    if (!res.ok) return { status: "no_table" };
    const rows = (await res.json()) as Array<{ data: SearchConsoleData | null; updated_at: string }>;
    const r = rows[0];
    if (!r?.data || r.data.v !== 1) return { status: "empty" };
    return { status: "ok", data: r.data, updatedAt: r.updated_at };
  } catch {
    return { status: "no_table" };
  }
}

/** Solo el dato bueno (para las señales cruce_sc_*): null si no hay snapshot OK. */
export async function getSearchConsoleData(): Promise<SearchConsoleData | null> {
  const s = await getSearchConsoleSnapshot();
  return s.status === "ok" && s.data.ok ? s.data : null;
}

/** Sync + persist. Un error TRANSITORIO no pisa un snapshot bueno previo; falta de permiso/sitio sí se guarda (la UI lo explica). */
export async function syncSearchConsole(): Promise<{ data: SearchConsoleData; persisted: boolean; keptPrevious: boolean }> {
  const d = await fetchSearchConsole();
  const env = sbEnv();
  if (!env) return { data: d, persisted: false, keptPrevious: false };
  try {
    if (!d.ok && d.code === "error") {
      const prev = await getSearchConsoleSnapshot();
      if (prev.status === "ok" && prev.data.ok) return { data: prev.data, persisted: false, keptPrevious: true };
    }
    const res = await fetch(`${env.url}/rest/v1/search_console_snapshot?on_conflict=id`, {
      method: "POST",
      headers: { ...env.headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: 1, data: d, updated_at: d.updatedAt }),
      cache: "no-store",
    });
    return { data: d, persisted: res.ok, keptPrevious: false };
  } catch {
    return { data: d, persisted: false, keptPrevious: false }; // migración 0107 no corrida → sin persistencia
  }
}
