import { NextResponse } from "next/server";
import { DV360_ADVERTISER_ID } from "@/lib/dv360-thumbs-shared";
import { dv360AccessToken, OauthError } from "@/lib/dv360-oauth";
import {
  DV360_PARTNER_ID,
  DV360_QUERY_CREATIVES,
  DV360_QUERY_REACH,
  aggCreatives,
  aggReach,
  decidirMes,
  planMeses,
  totalesPorMes,
  ymdStr,
  type CreativeRow,
  type Decision,
  type MesPlan,
  type ReachRow,
  type Totales,
  type Ymd,
} from "@/lib/dv360-report";

// DV360 → dv360_creatives + dv360_reach DIRECTO de la Bid Manager API v2 (reemplaza a syncDv360/syncDv360Reach del
// Apps Script, que leían el CSV del mail y pisaban meses con datos parciales). Pide meses CALENDARIO completos (el en
// curso hasta ayer) y nunca pisa un mes con menos impresiones/inversión que lo guardado (>2%) salvo ?force=1.
//
// GET /api/cron/dv360-sync                 → últimos 3 meses (en curso + 2 anteriores)
//     ?meses=N | ?desde=YYYY-MM            → ventana
//     ?dry=1                                → no escribe: compara guardado vs API por mes (solo números)
//     ?force=1                              → pisa aunque la API traiga menos
// Protegido con CRON_SECRET (workflow dv360-sync.yml). Lógica pura y test: lib/dv360-report.ts.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const API = "https://doubleclickbidmanager.googleapis.com/v2";
const SOURCE = "dv360_api";
const POLL_MS = 5000;
const POLL_HASTA_MS = 230_000;

class DvError extends Error {
  constructor(public estado: string, msg: string) { super(msg); }
}

/** Errores de Google → estado claro en castellano. */
function estadoDe(status: number, body: string): string {
  if (/SERVICE_DISABLED|has not been used|is disabled/i.test(body)) return "api_no_habilitada";
  if (status === 401) return "token_invalido";
  if (status === 403) return "sin_acceso";
  if (status === 400) return "consulta_invalida";
  if (status === 429) return "cuota";
  return "error_api";
}

async function bm<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new DvError(estadoDe(res.status, text), `Bid Manager ${res.status}: ${text.slice(0, 400)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

type QueryParams = { type?: string; groupBys?: string[]; filters?: { type: string; value: string }[]; metrics?: string[] };
type Query = { queryId?: string; metadata?: { title?: string }; params?: QueryParams };
type Report = {
  key?: { queryId?: string; reportId?: string };
  metadata?: { status?: { state?: string }; googleCloudStoragePath?: string; reportDataStartDate?: Ymd; reportDataEndDate?: Ymd };
};

/** Reusa la consulta por título (versionado: si cambian dimensiones/métricas, cambia el título y se crea otra). */
// Si la cuenta ve el reporte programado de OMD ("DV360 Video Drean" / "DV360 Reach Drean"), se copian SUS parámetros
// (tipo, dimensiones, métricas y filtros): mismos datos que llegaban por mail, sin adivinar nombres de la API.
async function asegurarQuery(token: string, existentes: Query[], titulo: string, q: { groupBys: string[]; metrics: string[] }, adv: string, fuente?: string): Promise<string> {
  const ya = existentes.find((x) => x.metadata?.title === titulo);
  if (ya?.queryId) return ya.queryId;
  const omd = fuente ? existentes.find((x) => (x.metadata?.title ?? "").toLowerCase().includes(fuente.toLowerCase()) && x.params?.metrics?.length) : undefined;
  if (omd?.params) {
    const copia = await bm<Query>(token, "/queries", {
      method: "POST",
      body: JSON.stringify({
        metadata: { title: titulo, dataRange: { range: "LAST_30_DAYS" }, format: "CSV" },
        params: { type: omd.params.type, groupBys: omd.params.groupBys, filters: omd.params.filters, metrics: omd.params.metrics },
        schedule: { frequency: "ONE_TIME" },
      }),
    });
    if (!copia.queryId) throw new DvError("error_api", "La API no devolvió queryId al copiar la consulta de OMD");
    return copia.queryId;
  }
  const creada = await bm<Query>(token, "/queries", {
    method: "POST",
    body: JSON.stringify({
      metadata: { title: titulo, dataRange: { range: "LAST_30_DAYS" }, format: "CSV" },
      params: {
        type: "STANDARD",
        groupBys: q.groupBys,
        filters: [{ type: "FILTER_PARTNER", value: DV360_PARTNER_ID }, { type: "FILTER_ADVERTISER", value: adv }],
        metrics: q.metrics,
      },
      schedule: { frequency: "ONE_TIME" },
    }),
  });
  if (!creada.queryId) throw new DvError("error_api", "La API no devolvió queryId al crear la consulta");
  return creada.queryId;
}

async function listarQueries(token: string): Promise<Query[]> {
  const out: Query[] = [];
  let pageToken = "";
  for (let i = 0; i < 10; i++) {
    const r = await bm<{ queries?: Query[]; nextPageToken?: string }>(token, `/queries?pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`);
    out.push(...(r.queries ?? []));
    pageToken = r.nextPageToken ?? "";
    if (!pageToken) break;
  }
  return out;
}

async function correrYBajar(token: string, queryId: string, desde: Ymd, hasta: Ymd, t0: number): Promise<{ csv: string; rep: Report }> {
  let rep = await bm<Report>(token, `/queries/${queryId}:run`, {
    method: "POST",
    body: JSON.stringify({ dataRange: { range: "CUSTOM_DATES", customStartDate: desde, customEndDate: hasta } }),
  });
  const reportId = rep.key?.reportId;
  if (!reportId) throw new DvError("error_api", "La API no devolvió reportId");
  while (rep.metadata?.status?.state !== "DONE") {
    if (rep.metadata?.status?.state === "FAILED") throw new DvError("reporte_fallido", `El reporte ${reportId} de DV360 falló`);
    if (Date.now() - t0 > POLL_HASTA_MS) throw new DvError("timeout", `El reporte ${reportId} no terminó a tiempo; reintentar más tarde`);
    await new Promise((r) => setTimeout(r, POLL_MS));
    rep = await bm<Report>(token, `/queries/${queryId}/reports/${reportId}`);
  }
  const path = rep.metadata?.googleCloudStoragePath;
  if (!path) throw new DvError("error_api", "Reporte DONE sin googleCloudStoragePath");
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new DvError("descarga_fallida", `Descarga del CSV ${res.status}`);
  return { csv: await res.text(), rep };
}

// ── Supabase (REST service key) ──────────────────────────────────────────────

function sb() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new DvError("sin_config", "Falta NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return { base: `${base}/rest/v1`, h: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } };
}

async function leerGuardado<T>(tabla: string, select: string, order: string, desde: string, hasta: string): Promise<T[]> {
  const { base, h } = sb();
  const out: T[] = [];
  for (let off = 0; off < 100_000; off += 1000) {
    const r = await fetch(`${base}/${tabla}?select=${select}&mes=gte.${desde}&mes=lte.${hasta}&order=${order}&limit=1000&offset=${off}`, { headers: h, cache: "no-store" });
    if (!r.ok) throw new DvError("error_db", `Lectura ${tabla} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const rows = (await r.json()) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

/** Upsert de las filas nuevas y DESPUÉS borra las claves del mes que ya no vienen (si el upsert falla, no se pierde nada). */
async function escribirMes<T extends Record<string, unknown>>(tabla: string, pk: string[], nuevas: T[], viejas: Record<string, unknown>[]): Promise<{ upsert: number; borradas: number }> {
  const { base, h } = sb();
  const ahora = new Date().toISOString();
  if (nuevas.length) {
    const r = await fetch(`${base}/${tabla}?on_conflict=${pk.join(",")}`, {
      method: "POST",
      headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(nuevas.map((x) => ({ ...x, updated_at: ahora }))),
    });
    if (!r.ok) throw new DvError("error_db", `Upsert ${tabla} ${r.status}: ${(await r.text()).slice(0, 300)}`);
  }
  const clave = (x: Record<string, unknown>) => pk.map((k) => String(x[k])).join("|");
  const vigentes = new Set(nuevas.map(clave));
  let borradas = 0;
  for (const v of viejas) {
    if (vigentes.has(clave(v))) continue;
    const qs = pk.map((k) => `${k}=eq.${encodeURIComponent(String(v[k]))}`).join("&");
    const r = await fetch(`${base}/${tabla}?${qs}`, { method: "DELETE", headers: h });
    if (!r.ok) throw new DvError("error_db", `Delete ${tabla} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    borradas++;
  }
  return { upsert: nuevas.length, borradas };
}

function hoyAR(): Ymd {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()).split("-").map(Number);
  return { year: y!, month: m!, day: d! };
}

const cmpYmd = (a: Ymd, b: Ymd) => ymdStr(a).localeCompare(ymdStr(b));

type Fila = { mes: string; guardado: Totales | null; api: Totales | null; accion: Decision["accion"]; motivo?: string; escritura?: { upsert: number; borradas: number } };

async function procesarTabla<T extends CreativeRow | ReachRow>(
  tabla: string, pk: string[], plan: MesPlan[], filasApi: T[], rep: Report, dry: boolean, force: boolean,
): Promise<Fila[]> {
  const desde = plan[0]!.mes, hasta = plan[plan.length - 1]!.mes;
  const guardadas = await leerGuardado<Record<string, unknown> & { mes: string; impresiones: number; revenue_usd: number }>(
    tabla, `${pk.join(",")},impresiones,revenue_usd`, pk.join(","), desde, hasta);
  const totG = totalesPorMes(guardadas), totA = totalesPorMes(filasApi);
  const fin = rep.metadata?.reportDataEndDate, ini = rep.metadata?.reportDataStartDate;
  const out: Fila[] = [];
  for (const p of plan) {
    const g = totG.get(p.mes) ?? null, a = totA.get(p.mes) ?? null;
    let d: Decision;
    // Mes completo = el reporte cubre del 1 al último día pedido (si la API informa el rango).
    if ((fin && cmpYmd(fin, p.hasta) < 0) || (ini && cmpYmd(ini, p.desde) > 0)) {
      d = { accion: "bloqueado", motivo: `el reporte no cubre el mes completo (${ini ? ymdStr(ini) : "?"} → ${fin ? ymdStr(fin) : "?"})` };
    } else d = decidirMes(g ?? undefined, a ?? undefined, force);
    const fila: Fila = { mes: p.mes, guardado: g, api: a, ...d };
    if (d.motivo) console.warn(`[dv360-sync] ${tabla} ${p.mes}: ${d.accion} — ${d.motivo}`);
    if (!dry && d.accion === "escribir") {
      fila.escritura = await escribirMes(tabla, pk, filasApi.filter((r) => r.mes === p.mes) as unknown as Record<string, unknown>[], guardadas.filter((r) => r.mes === p.mes));
    }
    out.push(fila);
  }
  return out;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const dry = url.searchParams.get("dry") === "1";
  const force = url.searchParams.get("force") === "1";
  const mesesParam = Number(url.searchParams.get("meses"));
  const desdeParam = url.searchParams.get("desde") ?? undefined;
  if (desdeParam && !/^\d{4}-\d{2}$/.test(desdeParam)) {
    return NextResponse.json({ ok: false, estado: "parametro_invalido", error: "desde debe ser YYYY-MM" }, { status: 400 });
  }
  const adv = DV360_ADVERTISER_ID;
  const t0 = Date.now();
  try {
    const plan = planMeses(hoyAR(), { meses: Number.isFinite(mesesParam) && mesesParam > 0 ? mesesParam : undefined, desde: desdeParam });
    if (!plan.length) return NextResponse.json({ ok: false, estado: "parametro_invalido", error: "Ventana vacía" }, { status: 400 });
    const desde = plan[0]!.desde, hasta = plan[plan.length - 1]!.hasta;

    const { token, scopes, fuente, tieneScope } = await dv360AccessToken("/doubleclickbidmanager");
    if (!tieneScope) {
      return NextResponse.json({
        ok: false, estado: "no_scope",
        error: `El token (${fuente}) no tiene el scope https://www.googleapis.com/auth/doubleclickbidmanager`,
        scopes: scopes.map((s) => s.replace("https://www.googleapis.com/auth/", "")),
      }, { status: 500 });
    }

    const existentes = await listarQueries(token);
    // ?ver=1 → qué consultas ve la cuenta (título, tipo, dimensiones, métricas, tipos de filtro). Solo lectura.
    if (url.searchParams.get("ver") === "1") {
      return NextResponse.json({ ok: true, fuente, consultas: existentes.map((x) => ({
        id: x.queryId, titulo: x.metadata?.title, tipo: x.params?.type, groupBys: x.params?.groupBys,
        metrics: x.params?.metrics, filtros: (x.params?.filters ?? []).map((f) => f.type),
      })) });
    }
    const [qCr, qRe] = await Promise.all([
      asegurarQuery(token, existentes, `dashboard-mkt dv360-sync creatives v2 (${adv})`, DV360_QUERY_CREATIVES, adv, "DV360 Video Drean"),
      asegurarQuery(token, existentes, `dashboard-mkt dv360-sync reach v2 (${adv})`, DV360_QUERY_REACH, adv, "DV360 Reach Drean"),
    ]);
    const [cr, re] = await Promise.all([correrYBajar(token, qCr, desde, hasta, t0), correrYBajar(token, qRe, desde, hasta, t0)]);
    const creatives = aggCreatives(cr.csv, SOURCE);
    const reach = aggReach(re.csv, SOURCE);

    const [tCr, tRe] = await Promise.all([
      procesarTabla("dv360_creatives", ["mes", "canal", "categoria", "rol", "creative"], plan, creatives.rows, cr.rep, dry, force),
      procesarTabla("dv360_reach", ["mes", "line_item"], plan, reach.rows, re.rep, dry, force),
    ]);
    const bloqueados = [...tCr, ...tRe].filter((f) => f.accion === "bloqueado").length;
    return NextResponse.json({
      ok: true, dry, force, fuenteToken: fuente,
      rango: `${ymdStr(desde)} → ${ymdStr(hasta)}`,
      meses: plan.map((p) => ({ mes: p.mes, hasta: ymdStr(p.hasta), cerrado: p.cerrado })),
      dv360_creatives: tCr, dv360_reach: tRe, bloqueados,
      ms: Date.now() - t0,
    });
  } catch (e) {
    const estado = e instanceof DvError ? e.estado : e instanceof OauthError ? "token_invalido" : "error";
    return NextResponse.json({ ok: false, estado, error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 }, { status: 500 });
  }
}
