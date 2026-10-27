// DV360 → dv360_creatives / dv360_reach: lógica PURA (client-safe, sin imports).
// Port literal de las funciones del Apps Script "Sync Drive Tablero CB" (syncDv360 / syncDv360Reach + helpers
// dv360Num_/dv360EstadoRank_/dv360Canal_/dv360Categoria_/dv360Rol_/dv360DataRow_, ver docs/dv360-sync.md):
// mismas claves de agregación, clasificación por Line Item, rango de estado y redondeos. Lo usa
// /api/cron/dv360-sync, que baja el CSV de la Bid Manager API en vez de leerlo del mail.
// Test de paridad: cd apps/web && npx tsx scripts/dv360-report.test.ts

export const DV360_PARTNER_ID = "7996192225"; // "Mabe Argentina"

// Consultas de la Bid Manager API v2 (mismas dimensiones/métricas que los reportes programados por mail).
export const DV360_QUERY_CREATIVES = {
  groupBys: ["FILTER_DATE", "FILTER_CREATIVE", "FILTER_LINE_ITEM", "FILTER_LINE_ITEM_NAME", "FILTER_LINE_ITEM_STATUS"],
  metrics: [
    "METRIC_IMPRESSIONS", "METRIC_CLICKS", "METRIC_REVENUE_USD",
    "METRIC_RICH_MEDIA_VIDEO_PLAYS", "METRIC_RICH_MEDIA_VIDEO_SKIPS",
    "METRIC_RICH_MEDIA_VIDEO_FIRST_QUARTILE_COMPLETES", "METRIC_RICH_MEDIA_VIDEO_MIDPOINTS",
    "METRIC_RICH_MEDIA_VIDEO_THIRD_QUARTILE_COMPLETES", "METRIC_RICH_MEDIA_VIDEO_COMPLETIONS",
  ],
};
export const DV360_QUERY_REACH = {
  // Month (no Date) y sin Creative: si no, DV360 deshabilita Unique Reach.
  groupBys: ["FILTER_MONTH", "FILTER_LINE_ITEM", "FILTER_LINE_ITEM_NAME"],
  metrics: [
    "METRIC_IMPRESSIONS", "METRIC_REVENUE_USD",
    "METRIC_UNIQUE_REACH_IMPRESSION_REACH", "METRIC_UNIQUE_REACH_AVERAGE_IMPRESSION_FREQUENCY",
  ],
};

/** CSV → grilla (comillas dobles con "" escapado, CRLF/LF), como Utilities.parseCsv. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f); rows.push(row); row = []; f = "";
    } else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows;
}

export function dv360Num(x: unknown): number {
  const n = parseFloat(String(x).replace("%", "").replace(/,/g, "").trim());
  return isNaN(n) ? 0 : n;
}
export function dv360EstadoRank(s: unknown): number {
  const l = String(s || "").toLowerCase();
  if (l.includes("active")) return 3;
  if (l.includes("paused")) return 2;
  if (l.includes("archiv")) return 1;
  return 0;
}
export function dv360Canal(name: unknown): string {
  const l = String(name || "").toLowerCase();
  if (l.includes("youtube") || l.includes("trueview") || l.includes("bumper")) return "YouTube";
  if (l.includes("demand gen") || l.includes("demandgen")) return "Demand Gen";
  if (l.includes("marketplace")) return "Marketplace";
  if (l.includes("search")) return "Search";
  return "Programmatic";
}
export function dv360Categoria(name: unknown): string {
  const l = String(name || "").toLowerCase();
  if (l.includes("lavado")) return "Lavado";
  if (l.includes("refriger") || l.includes("heladera")) return "Refrigeración";
  if (l.includes("coccion") || l.includes("cocción") || l.includes("cocina")) return "Cocción";
  if (l.includes("promoc") || l.includes("drean week")) return "Promoción";
  if (l.includes("brand")) return "Brand";
  return "General";
}
export function dv360Rol(name: unknown): string {
  const l = String(name || "").toLowerCase();
  if (l.includes("cpv") || l.includes("trueview") || l.includes("demand gen") || l.includes("demandgen")) return "Consideración";
  return "Awareness";
}
const SKIP = ["Report Time", "Date Range", "Group By", "MRC", "Filter by", "Reporting numbers", "This report", "A dash"];
export function dv360DataRow(row: string[] | undefined): boolean {
  if (!row || !row[0] || row.length < 5) return false;
  const c0 = String(row[0]);
  return !SKIP.some((s) => c0.startsWith(s));
}

export type CreativeRow = {
  mes: string; canal: string; categoria: string; rol: string; creative: string;
  impresiones: number; clicks: number; starts: number; q25: number; q50: number; q75: number; q100: number; skips: number;
  revenue_usd: number; line_item_status: string | null; source: string;
};
export type ReachRow = {
  mes: string; canal: string; line_item: string; impresiones: number; revenue_usd: number; reach: number; frequency: number; source: string;
};

// El reporte por mail trae "2026/04/15"; se acepta también "2026-04-15" por si la API lo da con guiones.
const MES_RE = /^\d{4}-\d{2}-01$/;

/** = syncDv360 (piezas). Devuelve filas + meses presentes. Tira si falta una columna clave. */
export function aggCreatives(csv: string, source: string): { rows: CreativeRow[]; meses: string[] } {
  const g = parseCsv(csv), h = g[0] ?? [];
  const ix = (n: string) => h.indexOf(n);
  const iCr = ix("Creative"), iLI = ix("Line Item"), iD = ix("Date"), iImp = ix("Impressions"), iClk = ix("Clicks"),
    iRev = ix("Revenue (USD)"), iSt = ix("Starts (Video)"), iSk = ix("Skips (Video)"),
    iQ1 = ix("First-Quartile Views (Video)"), iM = ix("Midpoint Views (Video)"),
    iQ3 = ix("Third-Quartile Views (Video)"), iC = ix("Complete Views (Video)");
  let iEst = ix("Line Item Status"); if (iEst < 0) iEst = ix("Status");
  if (iD < 0 || iImp < 0 || iCr < 0) throw new Error(`Header inesperado (piezas): ${h.join(" | ").slice(0, 300)}`);
  const agg = new Map<string, CreativeRow & { _stRank: number }>(), meses = new Set<string>();
  for (let r = 1; r < g.length; r++) {
    const row = g[r]!; if (!dv360DataRow(row)) continue;
    const pr = String(row[iD] || "").split(/[/-]/); if (pr.length < 2) continue;
    const li = String(row[iLI] || ""), mes = `${pr[0]}-${pr[1]}-01`;
    if (!MES_RE.test(mes)) continue;
    const cn = dv360Canal(li), cat = dv360Categoria(li), rl = dv360Rol(li), name = String(row[iCr] || "");
    const k = `${mes}|${cn}|${cat}|${rl}|${name}`;
    let a = agg.get(k);
    if (!a) {
      a = { mes, canal: cn, categoria: cat, rol: rl, creative: name, impresiones: 0, clicks: 0, starts: 0, q25: 0, q50: 0, q75: 0, q100: 0, skips: 0, revenue_usd: 0, line_item_status: null, source, _stRank: -1 };
      agg.set(k, a);
    }
    a.impresiones += dv360Num(row[iImp]); a.clicks += dv360Num(row[iClk]); a.revenue_usd += dv360Num(row[iRev]);
    a.starts += dv360Num(row[iSt]); a.skips += dv360Num(row[iSk]);
    a.q25 += dv360Num(row[iQ1]); a.q50 += dv360Num(row[iM]); a.q75 += dv360Num(row[iQ3]); a.q100 += dv360Num(row[iC]);
    // Estado "más activo" entre las líneas del creative (Active > Paused > Archived).
    if (iEst >= 0) {
      const st = String(row[iEst] || "").trim(), rk = dv360EstadoRank(st);
      if (rk > a._stRank) { a._stRank = rk; a.line_item_status = st || a.line_item_status; }
    }
    meses.add(mes);
  }
  const rows = [...agg.values()].map(({ _stRank, ...a }) => {
    for (const f of ["impresiones", "clicks", "starts", "skips", "q25", "q50", "q75", "q100"] as const) a[f] = Math.round(a[f]);
    a.revenue_usd = Math.round(a.revenue_usd * 10000) / 10000;
    return a;
  });
  return { rows, meses: [...meses] };
}

/** = syncDv360Reach. frequency = la de la ÚLTIMA fila de la clave (igual que el script). */
export function aggReach(csv: string, source: string): { rows: ReachRow[]; meses: string[] } {
  const g = parseCsv(csv), h = g[0] ?? [];
  const ix = (n: string) => h.indexOf(n);
  const iMo = ix("Month"), iLI = ix("Line Item"), iImp = ix("Impressions"), iRev = ix("Revenue (USD)"),
    iR = ix("Unique Reach: Impression Reach"), iF = ix("Unique Reach: Average Impression Frequency");
  if (iMo < 0 || iLI < 0 || iR < 0) throw new Error(`Header inesperado (reach): ${h.join(" | ").slice(0, 300)}`);
  const agg = new Map<string, ReachRow>(), meses = new Set<string>();
  for (let r = 1; r < g.length; r++) {
    const row = g[r]!; if (!dv360DataRow(row)) continue;
    const mes = String(row[iMo] || "").replace(/[/-]/, "-") + "-01";
    if (mes.length < 7 || !MES_RE.test(mes)) continue;
    const li = String(row[iLI] || ""), cn = dv360Canal(li), k = `${mes}|${li}`;
    let a = agg.get(k);
    if (!a) { a = { mes, canal: cn, line_item: li, impresiones: 0, revenue_usd: 0, reach: 0, frequency: 0, source }; agg.set(k, a); }
    a.impresiones += dv360Num(row[iImp]); a.revenue_usd += dv360Num(row[iRev]);
    a.reach += dv360Num(row[iR]); a.frequency = dv360Num(row[iF]);
    meses.add(mes);
  }
  const rows = [...agg.values()].map((a) => ({
    ...a,
    impresiones: Math.round(a.impresiones), reach: Math.round(a.reach),
    revenue_usd: Math.round(a.revenue_usd * 10000) / 10000, frequency: Math.round(a.frequency * 10000) / 10000,
  }));
  return { rows, meses: [...meses] };
}

// ── Ventana de meses ─────────────────────────────────────────────────────────

export type Ymd = { year: number; month: number; day: number };
const pad = (n: number) => String(n).padStart(2, "0");
export const ymdStr = (d: Ymd) => `${d.year}-${pad(d.month)}-${pad(d.day)}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export type MesPlan = { mes: string; desde: Ymd; hasta: Ymd; cerrado: boolean };

/**
 * Meses a traer: los últimos `meses` (incluye el en curso) o desde `desde` (YYYY-MM) hasta hoy.
 * Mes cerrado = calendario completo; mes en curso = hasta AYER (hoy = fecha AR). El día 1 el mes en curso no entra.
 */
export function planMeses(hoy: Ymd, opts: { meses?: number; desde?: string }): MesPlan[] {
  const ayer = new Date(Date.UTC(hoy.year, hoy.month - 1, hoy.day - 1));
  const fin: Ymd = { year: ayer.getUTCFullYear(), month: ayer.getUTCMonth() + 1, day: ayer.getUTCDate() };
  let y: number, m: number;
  const md = opts.desde?.match(/^(\d{4})-(\d{2})$/);
  if (md) { y = +md[1]!; m = +md[2]!; }
  else {
    const n = Math.max(1, Math.min(24, opts.meses ?? 3));
    const d = new Date(Date.UTC(hoy.year, hoy.month - n, 1)); y = d.getUTCFullYear(); m = d.getUTCMonth() + 1;
  }
  const out: MesPlan[] = [];
  while (y < fin.year || (y === fin.year && m <= fin.month)) {
    const cerrado = !(y === fin.year && m === fin.month && fin.day < lastDay(y, m));
    out.push({ mes: `${y}-${pad(m)}-01`, desde: { year: y, month: m, day: 1 }, hasta: { year: y, month: m, day: cerrado ? lastDay(y, m) : fin.day }, cerrado });
    if (++m > 12) { m = 1; y++; }
    if (out.length > 36) break;
  }
  return out;
}

// ── Guarda: nunca pisar un mes con menos datos ───────────────────────────────

export type Totales = { impresiones: number; revenue_usd: number; filas: number };
export const TOLERANCIA_BAJA = 0.02;

export function totalesPorMes<T extends { mes: string; impresiones: number; revenue_usd: number }>(rows: T[]): Map<string, Totales> {
  const m = new Map<string, Totales>();
  for (const r of rows) {
    const t = m.get(r.mes) ?? { impresiones: 0, revenue_usd: 0, filas: 0 };
    t.impresiones += Number(r.impresiones) || 0; t.revenue_usd += Number(r.revenue_usd) || 0; t.filas++;
    m.set(r.mes, t);
  }
  for (const t of m.values()) t.revenue_usd = Math.round(t.revenue_usd * 100) / 100;
  return m;
}

export type Decision = { accion: "escribir" | "bloqueado" | "sin_datos"; motivo?: string };

/** Bloquea si la API trae >2% menos impresiones o inversión que lo guardado (salvo force). */
export function decidirMes(guardado: Totales | undefined, api: Totales | undefined, force: boolean): Decision {
  const g = guardado ?? { impresiones: 0, revenue_usd: 0, filas: 0 };
  const a = api ?? { impresiones: 0, revenue_usd: 0, filas: 0 };
  if (!a.filas && !g.filas) return { accion: "sin_datos" };
  const baja = (nuevo: number, viejo: number) => viejo > 0 && nuevo < viejo * (1 - TOLERANCIA_BAJA);
  const bajas: string[] = [];
  if (baja(a.impresiones, g.impresiones)) bajas.push(`impresiones ${g.impresiones} → ${a.impresiones}`);
  if (baja(a.revenue_usd, g.revenue_usd)) bajas.push(`revenue_usd ${g.revenue_usd} → ${a.revenue_usd}`);
  if (bajas.length && !force) return { accion: "bloqueado", motivo: `la API trae menos que lo guardado (${bajas.join("; ")}); usar ?force=1 para pisarlo` };
  if (bajas.length) return { accion: "escribir", motivo: `force: ${bajas.join("; ")}` };
  return { accion: "escribir" };
}
