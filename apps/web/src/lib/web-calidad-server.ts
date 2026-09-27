import "server-only";
import { GA4_FUNNEL_EVENTS, AI_SOURCE_REGEX, type Ga4Report } from "./web-calidad";
import { iaMensualDesdeFilas, consentDesdeFilas, type WebCalidadSnapshot, type WebCalidadGa4 } from "./web-calidad-shared";

// ============================================================================
// Calidad del dato WEB (server). Lo corre SOLO el cron /api/cron/web-calidad (workflow
// web-cat-agg.yml, 1x/día) y guarda UNA fila en web_calidad_snapshot (migración 0117).
// El render de /web lee esa fila (getWebCalidadSnapshot). Las lecturas pesadas (paginar
// web_traffic de google/cpc, ~80k filas) viven acá, nunca en el render. Fail-safe: cada bloque
// que falla queda en `errores` y el resto se guarda igual; sin la migración, get → null.
// ============================================================================

const GA4_PROPERTY_ID = "250596979";
const GA4_API = "https://analyticsdata.googleapis.com/v1beta";

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, headers: { apikey: key, Authorization: `Bearer ${key}` } } : null;
}

/** Paginado por Range. La query DEBE traer un `order` único (ej. order=id): sin orden estable,
 *  PostgREST puede repetir/saltear filas entre páginas. */
async function fetchAll<T>(query: string, max = 200_000): Promise<T[]> {
  const env = sb();
  if (!env) return [];
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; from < max; from += page) {
    const res = await fetch(`${env.url}/rest/v1/${query}`, { headers: { ...env.headers, Range: `${from}-${from + page - 1}` }, cache: "no-store" });
    if (!res.ok) throw new Error(`${query.split("?")[0]} ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);

// ── GA4 (mismo OAuth que el cron ga4-web-traffic) ─────────────────────────────
async function ga4Token(): Promise<string> {
  const id = process.env.GOOGLE_CLIENT_ID, secret = process.env.GOOGLE_CLIENT_SECRET, refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (!id || !secret || !refresh) throw new Error("Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google OAuth ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return ((await res.json()) as { access_token: string }).access_token;
}
async function runReport(token: string, body: object): Promise<Ga4Report> {
  const res = await fetch(`${GA4_API}/properties/${GA4_PROPERTY_ID}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GA4 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as Ga4Report;
}

/** Reportes GA4 de los últimos 28 días (hasta ayer) vs los 28 previos. */
export async function fetchGa4Calidad(now = new Date()): Promise<WebCalidadGa4> {
  const end = addDays(now, -1), start = addDays(end, -27);
  const prevEnd = addDays(start, -1), prevStart = addDays(prevEnd, -27);
  const periodo = { start: ymd(start), end: ymd(end), prevStart: ymd(prevStart), prevEnd: ymd(prevEnd) };
  const empty: WebCalidadGa4 = { ok: false, periodo, reports: { landing: { rows: [] }, chan: { rows: [] } }, totals: { sessions: 0, tx: 0, revenue: 0, ke: 0, currency: null }, failed: [] };
  let token: string;
  try { token = await ga4Token(); } catch (e) { return { ...empty, error: (e as Error).message.slice(0, 200) }; }
  const cur = { startDate: periodo.start, endDate: periodo.end };
  const prev = { startDate: periodo.prevStart, endDate: periodo.prevEnd };
  const curPrev = [{ ...cur, name: "cur" }, { ...prev, name: "prev" }];
  const bySessions = [{ metric: { metricName: "sessions" }, desc: true }];
  const specs: [string, object][] = [
    ["tot", { dateRanges: [cur], metrics: [{ name: "sessions" }, { name: "transactions" }, { name: "purchaseRevenue" }, { name: "keyEvents" }] }],
    ["chan", { dateRanges: [cur], dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "totalUsers" }, { name: "sessions" }, { name: "screenPageViews" }, { name: "keyEvents" }], orderBys: bySessions, limit: 50 }],
    ["landing", { dateRanges: [cur], dimensions: [{ name: "landingPage" }], metrics: [{ name: "sessions" }, { name: "screenPageViews" }, { name: "keyEvents" }], orderBys: bySessions, limit: 3000 }],
    ["landingPrev", { dateRanges: [prev], dimensions: [{ name: "landingPage" }], metrics: [{ name: "sessions" }], orderBys: bySessions, limit: 2000 }],
    ["events", { dateRanges: curPrev, dimensions: [{ name: "eventName" }, { name: "deviceCategory" }], metrics: [{ name: "eventCount" }, { name: "totalUsers" }], dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: [...GA4_FUNNEL_EVENTS] } } }, limit: 500 }],
    ["aiRef", { dateRanges: curPrev, dimensions: [{ name: "sessionSource" }], metrics: [{ name: "sessions" }, { name: "engagedSessions" }, { name: "keyEvents" }, { name: "transactions" }], dimensionFilter: { filter: { fieldName: "sessionSource", stringFilter: { matchType: "PARTIAL_REGEXP", value: AI_SOURCE_REGEX, caseSensitive: false } } }, limit: 200 }],
  ];
  const failed: string[] = [];
  const got = new Map<string, Ga4Report>();
  // Secuencial en pares: la cuota de GA4 por propiedad tolera ~10 concurrentes, pero no hace falta.
  for (let i = 0; i < specs.length; i += 3) {
    await Promise.all(specs.slice(i, i + 3).map(async ([k, body]) => {
      try { got.set(k, await runReport(token, body)); } catch { failed.push(k); }
    }));
  }
  const tot = got.get("tot");
  const m = (i: number) => Number(tot?.rows?.[0]?.metricValues[i]?.value ?? 0) || 0;
  const ok = !!tot && !!got.get("landing");
  return {
    ok, periodo, failed,
    ...(ok ? {} : { error: `No se pudieron leer los reportes base de GA4 (${failed.join(", ") || "sin datos"}).` }),
    reports: { landing: got.get("landing") ?? { rows: [] }, chan: got.get("chan") ?? { rows: [] }, events: got.get("events"), aiRef: got.get("aiRef"), landingPrev: got.get("landingPrev") },
    totals: { sessions: m(0), tx: m(1), revenue: m(2), ke: m(3), currency: tot?.metadata?.currencyCode ?? null },
  };
}

// ── Supabase: tráfico desde IA + chequeo de consent ──────────────────────────
const AI_OR = "or=(utm_source.ilike.*chatgpt*,utm_source.ilike.*openai*,utm_source.ilike.*perplexity*,utm_source.ilike.*gemini.google*,utm_source.ilike.*bard.google*,utm_source.ilike.*copilot*,utm_source.ilike.*claude.ai*,utm_source.ilike.*deepseek*,utm_source.ilike.*meta.ai*,utm_source.ilike.*you.com*,utm_source.ilike.*poe.com*,utm_source.ilike.*mistral*,utm_source.ilike.*grok*)";

export async function runWebCalidad(now = new Date()): Promise<WebCalidadSnapshot> {
  const errores: string[] = [];
  const desdeIa = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));
  const desdeConsent = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1));
  const [ga4, iaMensual, consent] = await Promise.all([
    fetchGa4Calidad(now).catch((e) => { errores.push(`ga4: ${(e as Error).message}`); return null; }),
    (async () => {
      const [traf, compras, mensual] = await Promise.all([
        fetchAll<{ fecha: string; utm_source: string | null; sesiones: number | null }>(`web_traffic?fecha=gte.${ymd(desdeIa)}&${AI_OR}&select=fecha,utm_source,sesiones&order=id`),
        fetchAll<{ fecha: string; utm_source: string | null; purchases: number | null; revenue: number | null }>(`ga4_purchases_daily?fecha=gte.${ymd(desdeIa)}&${AI_OR}&select=fecha,utm_source,purchases,revenue&order=id`),
        fetchAll<{ mes: string; sesiones: number | null }>(`vw_drean_web_monthly?mes=gte.${ymd(desdeIa)}&select=mes,sesiones`),
      ]);
      const sesSitio: Record<string, number> = {};
      for (const r of mensual) sesSitio[String(r.mes).slice(0, 7)] = Number(r.sesiones) || 0;
      return iaMensualDesdeFilas(traf, compras, sesSitio);
    })().catch((e) => { errores.push(`ia: ${(e as Error).message}`); return []; }),
    (async () => {
      const [ads, ses] = await Promise.all([
        fetchAll<{ fecha: string; campaign_name: string | null; campaign_type: string | null; clicks: number | null }>(`ga4_google_ads_daily?fecha=gte.${ymd(desdeConsent)}&select=fecha,campaign_name,campaign_type,clicks&order=id`),
        fetchAll<{ fecha: string; utm_campaign: string | null; sesiones: number | null }>(`web_traffic?utm_source=eq.google&utm_medium=eq.cpc&fecha=gte.${ymd(desdeConsent)}&select=fecha,utm_campaign,sesiones&order=id`),
      ]);
      return consentDesdeFilas(ads, ses);
    })().catch((e) => { errores.push(`consent: ${(e as Error).message}`); return null; }),
  ]);
  if (ga4 && !ga4.ok && ga4.error) errores.push(`ga4: ${ga4.error}`);
  return { v: 1, updatedAt: now.toISOString(), ga4, iaMensual, consent, errores };
}

export type WebCalidadEstado = { status: "ok"; data: WebCalidadSnapshot } | { status: "empty" } | { status: "no_table" };

export async function getWebCalidadSnapshot(): Promise<WebCalidadEstado> {
  const env = sb();
  if (!env) return { status: "no_table" };
  try {
    const res = await fetch(`${env.url}/rest/v1/web_calidad_snapshot?id=eq.1&select=data`, { headers: env.headers, cache: "no-store" });
    if (!res.ok) return { status: "no_table" };
    const rows = (await res.json()) as { data: WebCalidadSnapshot | null }[];
    const d = rows[0]?.data;
    return d?.v === 1 ? { status: "ok", data: d } : { status: "empty" };
  } catch { return { status: "no_table" }; }
}

/** Corre y persiste. Si GA4 falló pero había reportes buenos, se conservan los anteriores. */
export async function syncWebCalidad(): Promise<{ data: WebCalidadSnapshot; persisted: boolean }> {
  const d = await runWebCalidad();
  const env = sb();
  if (!env) return { data: d, persisted: false };
  if (!d.ga4?.ok) {
    const prev = await getWebCalidadSnapshot();
    if (prev.status === "ok" && prev.data.ga4?.ok) d.ga4 = { ...prev.data.ga4, error: `Se muestran los reportes GA4 del ${prev.data.updatedAt.slice(0, 10)} (la última lectura falló).` };
  }
  try {
    const res = await fetch(`${env.url}/rest/v1/web_calidad_snapshot?on_conflict=id`, {
      method: "POST",
      headers: { ...env.headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: 1, data: d, updated_at: d.updatedAt }),
      cache: "no-store",
    });
    return { data: d, persisted: res.ok };
  } catch { return { data: d, persisted: false }; }
}
