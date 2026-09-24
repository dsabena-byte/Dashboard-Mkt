// ============================================================================
// Research (plan Accelerate) — núcleo PURO y client-safe (imports RELATIVOS; se usa en el
// server, en el setup del cliente y en el chat). Dos tableros alimentados por planilla:
//   · Salud de Marca: tracking de marca por ola (TOM, SOM / conocimiento, consideración,
//     intención, poder de marca, hélice) por marca y categoría.
//   · Share de mercado: share por período / marca / categoría / segmento (valor y unidades),
//     mensual o año móvil (MAT), índice de precio.
// Mismo patrón que medios offline (lib/pauta-offline-core): campos canónicos + sinónimos de
// encabezado → detectMapping, parse con lib/viz/parse, plantilla descargable, config en una fila
// RESERVADA de tenant_dashboards (slug research-salud / research-mercado; sin migraciones).
// ============================================================================

import { parseNumber, parseDate, detectLocale, sampleCol, type NumLocale } from "./viz/parse";

export type ResearchKind = "salud" | "mercado";
export const RESEARCH_SLUG: Record<ResearchKind, string> = { salud: "research-salud", mercado: "research-mercado" };

export interface FieldDef { key: string; label: string; required?: boolean; hint: string; exact: string[]; contains: string[]; not?: RegExp; numeric?: boolean }
export type Mapping = Record<string, number>; // campo → índice de columna

export interface ResearchConfig {
  kind: ResearchKind;
  datasetId: string;
  mapping: Mapping;
  marcaPropia?: string | null; // nombre de tu marca TAL COMO está en la planilla
  yaMat?: boolean;             // mercado: los datos ya vienen como año móvil (MAT)
}

export const normTxt = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9%+]+/g, " ").trim();

// ── Campos ─────────────────────────────────────────────────────────────────
export const SALUD_IND = ["tom", "som", "consideracion", "intencion", "poder", "significancia", "diferenciacion", "saliencia"] as const;
export type SaludInd = (typeof SALUD_IND)[number];
export const SALUD_LABEL: Record<SaludInd, string> = {
  tom: "Top of mind", som: "Conocimiento (SOM)", consideracion: "Consideración", intencion: "Intención de compra",
  poder: "Poder de marca", significancia: "Significancia", diferenciacion: "Diferenciación", saliencia: "Saliencia",
};
/** Embudo de marca en orden (los de la hélice son índices, no etapas). */
export const SALUD_FUNNEL: SaludInd[] = ["tom", "som", "consideracion", "intencion"];

export const SALUD_FIELDS: FieldDef[] = [
  { key: "ola", label: "Ola / fecha", required: true, hint: "Momento de la medición (ej. nov-25, 2025-11, Ola 3 2025).", exact: ["ola", "wave", "fecha", "periodo", "medicion", "mes", "oleada", "date", "period"], contains: ["ola", "wave", "fecha", "periodo", "medicion", "oleada"] },
  { key: "marca", label: "Marca", required: true, hint: "Tu marca y las de la competencia.", exact: ["marca", "brand", "marcas", "empresa"], contains: ["marca", "brand"] },
  { key: "categoria", label: "Categoría", hint: "Opcional: si medís varias categorías.", exact: ["categoria", "category", "segmento", "linea", "producto", "rubro"], contains: ["categoria", "category", "rubro"] },
  { key: "tom", label: "Top of mind (TOM)", numeric: true, hint: "% que menciona la marca en primer lugar.", exact: ["tom", "top of mind", "top mind", "primera mencion", "recordacion espontanea primera mencion"], contains: ["top of mind", "tom", "primera mencion"] },
  { key: "som", label: "Conocimiento / SOM", numeric: true, hint: "% que conoce o menciona la marca (espontáneo o total).", exact: ["som", "share of mind", "conocimiento", "awareness", "conocimiento total", "recordacion", "recordacion espontanea", "conocimiento espontaneo", "notoriedad"], contains: ["share of mind", "conocimiento", "awareness", "recordacion", "notoriedad", "som"] },
  { key: "consideracion", label: "Consideración", numeric: true, hint: "% que la consideraría.", exact: ["consideracion", "consideration", "consideraria", "considera"], contains: ["consideracion", "consideration", "consider"] },
  { key: "intencion", label: "Intención de compra", numeric: true, hint: "% que la elegiría / primera opción.", exact: ["intencion", "intencion de compra", "purchase intent", "intent", "primera opcion", "preferencia", "seria mi primera opcion"], contains: ["intencion", "intent", "primera opcion", "preferencia"] },
  { key: "poder", label: "Poder de marca", numeric: true, hint: "Índice de poder / valor de marca (ej. Kantar Brand Power).", exact: ["poder", "poder de marca", "brand power", "power", "brand equity", "equity", "valor de marca"], contains: ["poder", "power", "equity"] },
  { key: "significancia", label: "Significancia", numeric: true, hint: "Opcional (hélice): índice base 100.", exact: ["significancia", "meaningful", "significativa", "significado"], contains: ["significa", "meaningful"] },
  { key: "diferenciacion", label: "Diferenciación", numeric: true, hint: "Opcional (hélice): índice base 100.", exact: ["diferenciacion", "different", "diferente", "diferenciada"], contains: ["diferenc", "different"] },
  { key: "saliencia", label: "Saliencia", numeric: true, hint: "Opcional (hélice): índice base 100.", exact: ["saliencia", "salient", "salience", "prominencia"], contains: ["salien", "prominen"] },
];

export const MERCADO_FIELDS: FieldDef[] = [
  { key: "periodo", label: "Período (mes)", required: true, hint: "Mes del dato (2026-03, mar-26, 01/03/2026).", exact: ["periodo", "mes", "fecha", "period", "month", "date", "ano mes", "mes ano"], contains: ["periodo", "mes", "fecha", "month", "period"] },
  { key: "marca", label: "Marca", required: true, hint: "Tu marca y las de la competencia (incluí \"Otras\" si la tenés).", exact: ["marca", "brand", "marcas", "fabricante", "manufacturer"], contains: ["marca", "brand", "fabricante"] },
  { key: "categoria", label: "Categoría", hint: "Opcional: línea / categoría de producto.", exact: ["categoria", "category", "rubro", "linea", "producto"], contains: ["categoria", "category", "rubro"] },
  { key: "segmento", label: "Segmento", hint: "Opcional: segmento de precio / tamaño / canal.", exact: ["segmento", "segment", "subcategoria", "tier", "canal", "channel"], contains: ["segment", "subcategoria", "tier"] },
  { key: "share_valor", label: "Share en valor (%)", numeric: true, hint: "Participación en facturación.", exact: ["share valor", "value share", "share en valor", "share $", "market share valor", "participacion valor", "share value", "vs %", "value share %"], contains: ["value share", "share valor", "share en valor", "participacion valor"] },
  { key: "share_unidades", label: "Share en unidades (%)", numeric: true, hint: "Participación en unidades vendidas.", exact: ["share unidades", "unit share", "share en unidades", "share volumen", "volume share", "participacion unidades", "unit share %", "us %"], contains: ["unit share", "share unidades", "share en unidades", "volume share", "share volumen"] },
  { key: "ventas_valor", label: "Ventas en valor", numeric: true, hint: "Facturación de la marca (si no tenés el share, lo calculamos).", exact: ["ventas valor", "ventas", "facturacion", "sales value", "value sales", "valor", "importe", "revenue", "ventas $"], contains: ["ventas valor", "facturacion", "value sales", "sales value", "revenue"], not: /(share|unidad|unit|%)/ },
  { key: "ventas_unidades", label: "Ventas en unidades", numeric: true, hint: "Unidades vendidas de la marca.", exact: ["unidades", "ventas unidades", "units", "unit sales", "sales units", "volumen", "cantidad"], contains: ["unidades", "unit sales", "sales units", "volumen"], not: /(share|%)/ },
  { key: "precio", label: "Precio / índice de precio", numeric: true, hint: "Precio promedio o índice (base 100).", exact: ["precio", "precio promedio", "price", "avg price", "indice de precio", "price index", "indice precio", "ticket promedio"], contains: ["precio", "price"] },
];

export const FIELDS: Record<ResearchKind, FieldDef[]> = { salud: SALUD_FIELDS, mercado: MERCADO_FIELDS };

/** Detecta el mapeo columna → campo por encabezado (sin repetir columnas). */
export function detectMapping(kind: ResearchKind, columns: string[]): Mapping {
  const defs = FIELDS[kind];
  const heads = columns.map(normTxt);
  const score = (f: FieldDef, h: string): number => {
    if (!h || (f.not && f.not.test(h))) return 0;
    if (f.exact.includes(h)) return 3;
    if (f.contains.some((c) => h.startsWith(c))) return 2;
    if (f.contains.some((c) => (` ${h} `).includes(` ${c.trim()}`))) return 1;
    return 0;
  };
  const cands: { f: string; i: number; s: number; ord: number }[] = [];
  defs.forEach((f, ord) => heads.forEach((h, i) => { const s = score(f, h); if (s) cands.push({ f: f.key, i, s, ord }); }));
  cands.sort((a, b) => b.s - a.s || a.ord - b.ord || a.i - b.i);
  const out: Mapping = {};
  const used = new Set<number>();
  for (const c of cands) { if (out[c.f] != null || used.has(c.i)) continue; out[c.f] = c.i; used.add(c.i); }
  return out;
}

/** Qué falta para poder guardar (obligatorios + al menos una medida). */
export function missingFields(kind: ResearchKind, m: Mapping): string[] {
  const defs = FIELDS[kind];
  const miss = defs.filter((f) => f.required && (m[f.key] == null || m[f.key]! < 0)).map((f) => f.label);
  const hasMeasure = defs.some((f) => f.numeric && m[f.key] != null && m[f.key]! >= 0);
  if (!hasMeasure) miss.push(kind === "salud" ? "al menos un indicador (TOM, conocimiento, intención…)" : "share o ventas (valor o unidades)");
  return miss;
}

export function sanitizeConfig(raw: unknown): ResearchConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = r.kind === "mercado" ? "mercado" : r.kind === "salud" ? "salud" : null;
  const datasetId = typeof r.datasetId === "string" ? r.datasetId.trim() : "";
  if (!kind || !datasetId) return null;
  const keys = new Set(FIELDS[kind].map((f) => f.key));
  const mapping: Mapping = {};
  for (const [k, v] of Object.entries((r.mapping as Record<string, unknown>) ?? {})) if (keys.has(k) && Number.isInteger(v) && (v as number) >= 0 && (v as number) < 500) mapping[k] = v as number;
  const mp = typeof r.marcaPropia === "string" ? r.marcaPropia.trim().slice(0, 120) : "";
  return { kind, datasetId, mapping, marcaPropia: mp || null, yaMat: kind === "mercado" ? r.yaMat === true : undefined };
}

// ── Parse ───────────────────────────────────────────────────────────────────
const txt = (v: unknown) => { const s = String(v ?? "").replace(/\s+/g, " ").trim(); return s || null; };
const brandKey = (s: string) => normTxt(s);

function numCols(kind: ResearchKind, columns: string[], rows: unknown[][], mapping: Mapping) {
  const col = (k: string) => (mapping[k] != null && mapping[k] >= 0 && mapping[k] < Math.max(columns.length, 1) ? mapping[k] : -1);
  const loc: Record<string, NumLocale> = {};
  const frac: Record<string, boolean> = {};
  for (const f of FIELDS[kind]) {
    if (!f.numeric) continue;
    const i = col(f.key); if (i < 0) continue;
    const sample = sampleCol(rows, i, 300);
    loc[f.key] = detectLocale(sample);
    // Porcentajes como fracción (0,42) → ×100. Solo para % (no ventas/precio/poder).
    const isPct = ["tom", "som", "consideracion", "intencion", "share_valor", "share_unidades"].includes(f.key);
    if (isPct) {
      const vals = sample.map((v) => parseNumber(v, loc[f.key])).filter((v): v is number => v != null);
      frac[f.key] = vals.length > 0 && vals.every((v) => v >= 0 && v <= 1.0001) && !sample.some((v) => /%/.test(String(v)));
    }
  }
  const num = (r: unknown[], k: string) => { const i = col(k); if (i < 0) return null; const v = parseNumber(r[i], loc[k] ?? "es"); return v == null ? null : frac[k] ? v * 100 : v; };
  return { col, num };
}

export interface Ola { key: string; label: string; t: number | null; ord: number }
export interface SaludRow { ola: string; marca: string; categoria: string; v: Partial<Record<SaludInd, number>> }
export interface SaludData { olas: Ola[]; marcas: string[]; categorias: string[]; rows: SaludRow[]; descartadas: number; motivos: string[] }

const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const olaLabelFromT = (t: number) => { const d = new Date(t); return `${MES_CORTO[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`; };

export function parseSalud(columns: string[], rows: unknown[][], mapping: Mapping): SaludData {
  const { col, num } = numCols("salud", columns, rows, mapping);
  const olas = new Map<string, Ola>();
  const marcas = new Map<string, string>();
  const cats = new Set<string>();
  const byKey = new Map<string, SaludRow>();
  const motivos = new Map<string, number>();
  let desc = 0;
  const skip = (m: string) => { desc++; motivos.set(m, (motivos.get(m) ?? 0) + 1); };
  rows.forEach((r) => {
    if (!Array.isArray(r) || r.every((v) => v == null || String(v).trim() === "")) return;
    const oi = col("ola"), mi = col("marca"), ci = col("categoria");
    const rawOla = oi >= 0 ? r[oi] : null;
    const olaTxt = txt(rawOla);
    if (!olaTxt) return skip("sin ola / fecha");
    const d = parseDate(typeof rawOla === "string" ? rawOla.trim() : rawOla, { serial: true });
    const t = d && !d.monthOnly ? Date.UTC(new Date(d.t).getUTCFullYear(), new Date(d.t).getUTCMonth(), 1) : null;
    const key = t != null ? `t${t}` : `l${normTxt(olaTxt)}`;
    if (!olas.has(key)) olas.set(key, { key, label: t != null ? olaLabelFromT(t) : olaTxt, t, ord: olas.size });
    const marca = mi >= 0 ? txt(r[mi]) : null;
    if (!marca) return skip("sin marca");
    const bk = brandKey(marca);
    if (!marcas.has(bk)) marcas.set(bk, marca);
    const categoria = (ci >= 0 ? txt(r[ci]) : null) ?? "Total";
    cats.add(categoria);
    const v: Partial<Record<SaludInd, number>> = {};
    for (const ind of SALUD_IND) { const x = num(r, ind); if (x != null && Number.isFinite(x)) v[ind] = x; }
    if (!Object.keys(v).length) return skip("sin indicadores");
    const k = `${key}|${bk}|${categoria}`;
    const prev = byKey.get(k);
    byKey.set(k, { ola: key, marca: marcas.get(bk)!, categoria, v: { ...(prev?.v ?? {}), ...v } });
  });
  const olaList = [...olas.values()].sort((a, b) => (a.t != null && b.t != null ? a.t - b.t : a.ord - b.ord));
  return { olas: olaList, marcas: [...marcas.values()], categorias: [...cats], rows: [...byKey.values()], descartadas: desc, motivos: [...motivos.entries()].map(([m, n]) => `${n}: ${m}`) };
}

export interface MercadoRow { ym: string; marca: string; categoria: string; segmento: string; sv: number | null; su: number | null; vv: number | null; vu: number | null; precio: number | null }
export interface MercadoData { meses: string[]; marcas: string[]; categorias: string[]; segmentos: string[]; rows: MercadoRow[]; descartadas: number; motivos: string[]; tiene: { sv: boolean; su: boolean; vv: boolean; vu: boolean; precio: boolean } }

const ymOf = (t: number) => { const d = new Date(t); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

export function parseMercado(columns: string[], rows: unknown[][], mapping: Mapping, opts: { year?: number } = {}): MercadoData {
  const { col, num } = numCols("mercado", columns, rows, mapping);
  const out: MercadoRow[] = [];
  const marcas = new Map<string, string>();
  const cats = new Set<string>(), segs = new Set<string>(), meses = new Set<string>();
  const motivos = new Map<string, number>();
  let desc = 0;
  const skip = (m: string) => { desc++; motivos.set(m, (motivos.get(m) ?? 0) + 1); };
  rows.forEach((r) => {
    if (!Array.isArray(r) || r.every((v) => v == null || String(v).trim() === "")) return;
    const pi = col("periodo");
    const raw = pi >= 0 ? r[pi] : null;
    const fv = typeof raw === "string" && /^\d{6}$/.test(raw.trim()) ? Number(raw.trim()) : raw;
    let ym: string | null = null;
    if (typeof fv === "number" && Number.isInteger(fv) && fv >= 190001 && fv <= 210012 && fv % 100 >= 1 && fv % 100 <= 12) ym = `${Math.floor(fv / 100)}-${String(fv % 100).padStart(2, "0")}`;
    else { const d = parseDate(typeof fv === "string" ? fv.trim() : fv, { serial: true, year: opts.year }); if (d) ym = ymOf(d.t); }
    if (!ym) return skip("sin período reconocible");
    const marca = col("marca") >= 0 ? txt(r[col("marca")]) : null;
    if (!marca) return skip("sin marca");
    const bk = brandKey(marca);
    if (!marcas.has(bk)) marcas.set(bk, marca);
    const categoria = (col("categoria") >= 0 ? txt(r[col("categoria")]) : null) ?? "Total";
    const segmento = (col("segmento") >= 0 ? txt(r[col("segmento")]) : null) ?? "Total";
    const row: MercadoRow = { ym, marca: marcas.get(bk)!, categoria, segmento, sv: num(r, "share_valor"), su: num(r, "share_unidades"), vv: num(r, "ventas_valor"), vu: num(r, "ventas_unidades"), precio: num(r, "precio") };
    if (row.sv == null && row.su == null && row.vv == null && row.vu == null) return skip("sin share ni ventas");
    cats.add(categoria); segs.add(segmento); meses.add(ym);
    out.push(row);
  });
  const tiene = { sv: out.some((x) => x.sv != null), su: out.some((x) => x.su != null), vv: out.some((x) => x.vv != null), vu: out.some((x) => x.vu != null), precio: out.some((x) => x.precio != null) };
  return { meses: [...meses].sort(), marcas: [...marcas.values()], categorias: [...cats], segmentos: [...segs], rows: out, descartadas: desc, motivos: [...motivos.entries()].map(([m, n]) => `${n}: ${m}`), tiene };
}

/** Busca la marca propia en la lista (config > perfil), tolerante a mayúsculas/acentos. */
export function findOwnBrand(marcas: string[], ...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (!c) continue;
    const k = brandKey(c);
    const exact = marcas.find((m) => brandKey(m) === k);
    if (exact) return exact;
    const part = marcas.find((m) => brandKey(m).includes(k) || k.includes(brandKey(m)));
    if (part) return part;
  }
  return null;
}

// ── Análisis: Salud de Marca ────────────────────────────────────────────────
export interface SaludIndStat { ind: SaludInd; valor: number | null; prev: number | null; delta: number | null; lider: string | null; valorLider: number | null; gap: number | null; rank: number | null; n: number }
export interface SaludAnalysis {
  categoria: string; own: string | null; olas: Ola[]; ultima: Ola | null; anterior: Ola | null;
  inds: SaludInd[];
  stats: SaludIndStat[];
  serie: Record<SaludInd, { ola: string; label: string; valores: Record<string, number | null> }[]>;
  funnel: { marca: string; own: boolean; etapas: (number | null)[]; conv: number | null }[];
  marcas: string[];
}

export function analyzeSalud(d: SaludData, categoria: string, own: string | null): SaludAnalysis {
  const rows = d.rows.filter((r) => r.categoria === categoria);
  const olasCat = d.olas.filter((o) => rows.some((r) => r.ola === o.key));
  const inds = SALUD_IND.filter((i) => rows.some((r) => r.v[i] != null));
  const marcas = [...new Set(rows.map((r) => r.marca))];
  const val = (ola: string, marca: string, ind: SaludInd) => rows.find((r) => r.ola === ola && r.marca === marca)?.v[ind] ?? null;
  // Última ola con dato de la marca propia (si no, la última ola).
  const ownOlas = own ? olasCat.filter((o) => rows.some((r) => r.ola === o.key && r.marca === own)) : [];
  const ultima = (ownOlas.length ? ownOlas : olasCat)[(ownOlas.length ? ownOlas : olasCat).length - 1] ?? null;
  const idxU = ultima ? olasCat.indexOf(ultima) : -1;
  const anterior = idxU > 0 ? olasCat[idxU - 1]! : null;
  const stats: SaludIndStat[] = inds.map((ind) => {
    const valor = own && ultima ? val(ultima.key, own, ind) : null;
    const prev = own && anterior ? val(anterior.key, own, ind) : null;
    const all = ultima ? marcas.map((m) => ({ m, v: val(ultima.key, m, ind) })).filter((x): x is { m: string; v: number } => x.v != null).sort((a, b) => b.v - a.v) : [];
    const liderRow = all.find((x) => x.m !== own) ?? null;
    const top = all[0] ?? null;
    const rank = own ? all.findIndex((x) => x.m === own) : -1;
    return {
      ind, valor, prev, delta: valor != null && prev != null ? valor - prev : null,
      lider: top ? (top.m === own ? liderRow?.m ?? null : top.m) : null,
      valorLider: top ? (top.m === own ? liderRow?.v ?? null : top.v) : null,
      gap: valor != null && top ? (top.m === own ? (liderRow ? valor - liderRow.v : null) : valor - top.v) : null,
      rank: rank >= 0 ? rank + 1 : null, n: all.length,
    };
  });
  const serie = Object.fromEntries(inds.map((ind) => [ind, olasCat.map((o) => ({ ola: o.key, label: o.label, valores: Object.fromEntries(marcas.map((m) => [m, val(o.key, m, ind)])) }))])) as SaludAnalysis["serie"];
  const funnelInds = SALUD_FUNNEL.filter((i) => inds.includes(i));
  const funnel = ultima ? marcas.map((m) => {
    const et = funnelInds.map((i) => val(ultima.key, m, i));
    // Conversión = intención (o la última etapa) ÷ conocimiento (SOM; si no hay, TOM).
    const baseI = funnelInds.includes("som") ? funnelInds.indexOf("som") : 0;
    const first = et[baseI] ?? null;
    const lastI = et.length - 1;
    const last = lastI > baseI ? et[lastI] ?? null : null;
    return { marca: m, own: m === own, etapas: et, conv: first && last != null ? (last / first) * 100 : null };
  }).filter((f) => f.etapas.some((x) => x != null)) : [];
  return { categoria, own, olas: olasCat, ultima, anterior, inds, stats, serie, funnel, marcas };
}

// ── Análisis: Share de mercado ─────────────────────────────────────────────
export type ShareBase = "valor" | "unidades";
export interface ShareSeries { meses: string[]; share: Record<string, (number | null)[]>; metodo: "ventas" | "share" | "promedio"; precioIdx: Record<string, (number | null)[]> }

const isTotal = (s: string) => /^(total|todos|todas|all)$/i.test(s.trim());

/**
 * Share mensual por marca para un filtro (categoría / segmento; "__all" = todas). Con ventas se
 * calcula (marca ÷ total del mes); si solo hay shares se usan los informados (si hay varias filas
 * por marca y mes — por ej. varios segmentos sin fila Total — se promedian: aproximado).
 * mat=true: año móvil (suma 12 meses de ventas; con solo shares, promedio de 12 meses). Si la
 * planilla ya viene en MAT (yaMat), se usa tal cual.
 */
export function shareSeries(d: MercadoData, f: { categoria: string; segmento: string; base: ShareBase; mat: boolean; yaMat?: boolean }): ShareSeries {
  let rows = d.rows.filter((r) => (f.categoria === "__all" || r.categoria === f.categoria));
  if (f.segmento === "__all") {
    // Si hay filas "Total" de segmento, usar solo esas; si no, todas (se suman ventas o se promedian shares).
    if (rows.some((r) => isTotal(r.segmento)) && rows.some((r) => !isTotal(r.segmento))) rows = rows.filter((r) => isTotal(r.segmento));
  } else rows = rows.filter((r) => r.segmento === f.segmento);
  const meses = [...new Set(rows.map((r) => r.ym))].sort();
  const marcas = [...new Set(rows.map((r) => r.marca))];
  const vKey = f.base === "valor" ? "vv" : "vu", sKey = f.base === "valor" ? "sv" : "su";
  const hasVentas = rows.some((r) => r[vKey] != null);
  const idx = new Map(meses.map((m, i) => [m, i]));
  const share: Record<string, (number | null)[]> = Object.fromEntries(marcas.map((m) => [m, meses.map(() => null)]));
  const precioIdx: Record<string, (number | null)[]> = Object.fromEntries(marcas.map((m) => [m, meses.map(() => null)]));
  let metodo: ShareSeries["metodo"] = hasVentas ? "ventas" : "share";

  if (hasVentas) {
    const vent: Record<string, number[]> = Object.fromEntries(marcas.map((m) => [m, meses.map(() => 0)]));
    for (const r of rows) { const v = r[vKey]; if (v != null) vent[r.marca]![idx.get(r.ym)!]! += v; }
    const win = f.mat && !f.yaMat ? 12 : 1;
    for (let i = 0; i < meses.length; i++) {
      if (i + 1 < win) continue;
      let tot = 0; const by: Record<string, number> = {};
      for (const m of marcas) { let s = 0; for (let k = i - win + 1; k <= i; k++) s += vent[m]![k]!; by[m] = s; tot += s; }
      if (tot > 0) for (const m of marcas) share[m]![i] = (by[m]! / tot) * 100;
    }
  } else {
    const acc: Record<string, { s: number; n: number }[]> = Object.fromEntries(marcas.map((m) => [m, meses.map(() => ({ s: 0, n: 0 }))]));
    for (const r of rows) { const v = r[sKey]; if (v != null) { const a = acc[r.marca]![idx.get(r.ym)!]; a!.s += v; a!.n++; } }
    if (Object.values(acc).some((arr) => arr.some((a) => a.n > 1))) metodo = "promedio";
    const monthly: Record<string, (number | null)[]> = Object.fromEntries(marcas.map((m) => [m, acc[m]!.map((a) => (a.n ? a.s / a.n : null))]));
    const win = f.mat && !f.yaMat ? 12 : 1;
    for (const m of marcas) for (let i = 0; i < meses.length; i++) {
      if (win === 1) { share[m]![i] = monthly[m]![i]!; continue; }
      if (i + 1 < win) continue;
      const xs = monthly[m]!.slice(i - win + 1, i + 1).filter((x): x is number => x != null);
      share[m]![i] = xs.length >= 9 ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    }
  }
  // Índice de precio: precio de la marca ÷ promedio ponderado del mercado (por ventas si hay) × 100.
  if (rows.some((r) => r.precio != null)) {
    for (let i = 0; i < meses.length; i++) {
      const rs = rows.filter((r) => r.ym === meses[i] && r.precio != null);
      let wSum = 0, pw = 0;
      for (const r of rs) { const w = (r[vKey] ?? r[sKey] ?? 1) || 1; wSum += w; pw += r.precio! * w; }
      const avg = wSum > 0 ? pw / wSum : null;
      // Si los precios ya parecen índice (promedio ~100), se usan tal cual.
      const looksIndex = avg != null && avg > 60 && avg < 160 && rs.every((r) => r.precio! > 20 && r.precio! < 400);
      for (const r of rs) precioIdx[r.marca]![i] = looksIndex ? r.precio! : avg ? (r.precio! / avg) * 100 : null;
    }
  }
  return { meses, share, metodo, precioIdx };
}

export interface ShareBrandStat { marca: string; own: boolean; share: number | null; dMes: number | null; dAnio: number | null; precio: number | null; rank: number }
export interface MercadoAnalysis { ref: string | null; stats: ShareBrandStat[]; own: ShareBrandStat | null; lider: ShareBrandStat | null; gapLider: number | null; serie: ShareSeries }

export function analyzeMercado(serie: ShareSeries, own: string | null): MercadoAnalysis {
  const n = serie.meses.length;
  let refI = -1;
  for (let i = n - 1; i >= 0; i--) if (Object.values(serie.share).some((arr) => arr[i] != null)) { refI = i; break; }
  if (refI < 0) return { ref: null, stats: [], own: null, lider: null, gapLider: null, serie };
  const ref = serie.meses[refI]!;
  const [ry, rm] = ref!.split("-").map(Number);
  const yAgo = `${ry! - 1}-${String(rm).padStart(2, "0")}`;
  const iY = serie.meses.indexOf(yAgo);
  const stats = Object.entries(serie.share).map(([marca, arr]) => {
    const s = arr[refI]!;
    return { marca, own: marca === own, share: s, dMes: s != null && refI > 0 && arr[refI - 1] != null ? s - arr[refI - 1]! : null, dAnio: s != null && iY >= 0 && arr[iY] != null ? s - arr[iY]! : null, precio: serie.precioIdx[marca]?.[refI] ?? null, rank: 0 };
  }).filter((x) => x.share != null).sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
  stats.forEach((x, i) => (x.rank = i + 1));
  const ownS = stats.find((x) => x.own) ?? null;
  const lider = stats.find((x) => !x.own && !/^otr[ao]s?$/i.test(x.marca.trim())) ?? null;
  return { ref, stats, own: ownS, lider, gapLider: ownS?.share != null && lider?.share != null ? ownS.share - lider.share : null, serie };
}

// ── Señales ─────────────────────────────────────────────────────────────────
export interface ResearchSignal { key: string; prioridad: "alta" | "media" | "baja"; tipo: "alerta" | "oportunidad" | "info"; titulo: string; descripcion: string }
const f1 = (v: number) => v.toLocaleString("es-AR", { maximumFractionDigits: 1 });
const pp = (v: number) => `${v > 0 ? "+" : ""}${f1(v)} pp`;

export function saludSignals(a: SaludAnalysis): ResearchSignal[] {
  const out: ResearchSignal[] = [];
  if (!a.own || !a.ultima) return out;
  const st = (i: SaludInd) => a.stats.find((s) => s.ind === i);
  for (const s of a.stats) {
    if (s.delta == null || s.valor == null) continue;
    const rel = s.prev ? Math.abs(s.delta / s.prev) : 0;
    if (s.delta < 0 && (Math.abs(s.delta) >= 3 || rel >= 0.1)) out.push({ key: `salud_${s.ind}_cae`, prioridad: Math.abs(s.delta) >= 5 || rel >= 0.15 ? "alta" : "media", tipo: "alerta", titulo: `${SALUD_LABEL[s.ind]} cae ${pp(s.delta)} en ${a.ultima.label}`, descripcion: `Pasó de ${f1(s.prev!)} a ${f1(s.valor)} vs la ola anterior (${a.anterior?.label}).${s.lider && s.gap != null ? ` Brecha con ${s.lider}: ${pp(s.gap)}.` : ""}` });
    if (s.delta > 0 && (s.delta >= 3 || rel >= 0.1)) out.push({ key: `salud_${s.ind}_sube`, prioridad: "baja", tipo: "info", titulo: `${SALUD_LABEL[s.ind]} sube ${pp(s.delta)} en ${a.ultima.label}`, descripcion: `De ${f1(s.prev!)} a ${f1(s.valor)}.` });
  }
  // Conversión del embudo: te conocen pero no te eligen.
  const own = a.funnel.find((f) => f.own);
  const others = a.funnel.filter((f) => !f.own && f.conv != null).map((f) => f.conv!).sort((x, y) => x - y);
  if (own?.conv != null && others.length >= 2) {
    const med = others[Math.floor(others.length / 2)];
    if (own.conv < med! * 0.85) out.push({ key: "salud_conversion_baja", prioridad: "alta", tipo: "oportunidad", titulo: "Te conocen, pero te eligen menos que a la competencia", descripcion: `De cada 100 que te conocen/recuerdan, ${f1(own.conv)} te tienen como intención; la mediana de la competencia es ${f1(med!)}. La palanca está en consideración/preferencia (producto, precio, argumentos), no en más alcance.` });
  }
  const pod = st("poder");
  if (pod?.gap != null && pod.gap < 0 && pod.lider) out.push({ key: "salud_poder_gap", prioridad: pod.gap < -5 ? "media" : "baja", tipo: "info", titulo: `Poder de marca ${pp(pod.gap)} vs ${pod.lider}`, descripcion: `Tu poder de marca es ${f1(pod.valor!)} vs ${f1(pod.valorLider!)} del líder.` });
  return out;
}

export function mercadoSignals(m: MercadoAnalysis): ResearchSignal[] {
  const out: ResearchSignal[] = [];
  const o = m.own;
  if (!o || o.share == null || !m.ref) return out;
  const arr = m.serie.share[o.marca] ?? [];
  // Caída 3 meses seguidos
  const last = arr.map((v, i) => ({ v, i })).filter((x) => x.v != null).slice(-4);
  if (last.length === 4 && last[1]!.v! < last[0]!.v! && last[2]!.v! < last[1]!.v! && last[3]!.v! < last[2]!.v!) out.push({ key: "share_cae_3m", prioridad: "alta", tipo: "alerta", titulo: `Tu share cae 3 períodos seguidos (${pp(last[3]!.v! - last[0]!.v!)})`, descripcion: `De ${f1(last[0]!.v!)}% a ${f1(last[3]!.v!)}%. Revisá precio, distribución y la presión de pauta de la competencia en esos meses.` });
  if (o.dAnio != null && o.dAnio <= -1) out.push({ key: "share_cae_anio", prioridad: o.dAnio <= -2 ? "alta" : "media", tipo: "alerta", titulo: `Share ${pp(o.dAnio)} vs el mismo mes del año pasado`, descripcion: `Hoy ${f1(o.share)}%.` });
  if (o.dAnio != null && o.dAnio >= 1) out.push({ key: "share_sube_anio", prioridad: "baja", tipo: "info", titulo: `Share ${pp(o.dAnio)} vs el año pasado`, descripcion: `Hoy ${f1(o.share)}%.` });
  // Brecha con el líder que se amplía
  if (m.lider && m.gapLider != null && o.dAnio != null && m.lider.dAnio != null && m.lider.dAnio - o.dAnio >= 1) out.push({ key: "share_lider_se_aleja", prioridad: "media", tipo: "alerta", titulo: `${m.lider.marca} se aleja: la brecha creció ${f1(m.lider.dAnio - o.dAnio)} pp en el año`, descripcion: `Brecha actual ${pp(m.gapLider)}.` });
  // Precio premium que sube con share que baja
  if (o.precio != null && o.precio > 105 && o.dMes != null && o.dMes < 0) out.push({ key: "share_precio_premium", prioridad: "media", tipo: "alerta", titulo: `Precio ${f1(o.precio - 100)}% sobre el mercado y share en baja`, descripcion: "El diferencial de precio puede estar frenando la conversión. Mirá promociones y el segmento donde más perdés." });
  return out;
}

/**
 * Cruce Salud de Marca × Share: compara la variación del indicador (TOM, o el primero disponible)
 * entre las dos últimas olas con la del share en los mismos meses.
 */
export function crossSignals(a: SaludAnalysis, serie: ShareSeries | null, own: string | null): ResearchSignal[] {
  if (!serie || !own || !a.ultima?.t || !a.anterior?.t) return [];
  const ind: SaludInd | undefined = (["tom", "som", "intencion", "poder"] as SaludInd[]).find((i) => a.inds.includes(i));
  const st = ind ? a.stats.find((s) => s.ind === ind) : null;
  if (!ind || !st || st.delta == null) return [];
  const shareAt = (t: number) => {
    const ym = ymOf(t); const arr = serie.share[own] ?? [];
    let best: number | null = null;
    serie.meses.forEach((m, i) => { if (m <= ym && arr[i] != null) best = arr[i]; });
    return best as number | null;
  };
  const s1 = shareAt(a.anterior.t), s2 = shareAt(a.ultima.t);
  if (s1 == null || s2 == null) return [];
  const ds = s2 - s1;
  if (st.delta <= -2 && ds >= 0.5) return [{ key: "cruce_marca_cae_share_sube", prioridad: "alta", tipo: "alerta", titulo: `Tu ${SALUD_LABEL[ind]} cae mientras el share sube`, descripcion: `${SALUD_LABEL[ind]} ${pp(st.delta)} entre ${a.anterior.label} y ${a.ultima.label}, pero el share ${pp(ds)}. Hoy vendés por precio / distribución / promo, no por marca: si la memoria de marca sigue bajando, el share lo va a sentir en las próximas olas.` }];
  if (st.delta >= 2 && ds <= -0.5) return [{ key: "cruce_marca_sube_share_cae", prioridad: "media", tipo: "oportunidad", titulo: `Tu ${SALUD_LABEL[ind]} sube pero el share cae`, descripcion: `${SALUD_LABEL[ind]} ${pp(st.delta)} y share ${pp(ds)} en el mismo período. La marca está más presente, pero no convierte en el punto de venta: revisá precio, surtido y disponibilidad.` }];
  return [];
}

// ── Plantillas ─────────────────────────────────────────────────────────────
export const TEMPLATE: Record<ResearchKind, { headers: string[]; rows: (string | number)[][]; sheet: string; file: string; instr: string[] }> = {
  salud: {
    sheet: "Salud de Marca", file: "bip-salud-de-marca-plantilla.xlsx",
    headers: ["Ola", "Marca", "Categoría", "Top of mind", "Conocimiento", "Consideración", "Intención de compra", "Poder de marca", "Significancia", "Diferenciación", "Saliencia"],
    rows: [
      ["nov-24", "Tu marca", "Lavado", 44, 74, 58, 40, 19.2, 147, 115, 232],
      ["nov-24", "Competidor A", "Lavado", 10, 51, 45, 35, 17.9, 159, 186, 114],
      ["nov-25", "Tu marca", "Lavado", 40, 69, 55, 40, 17.4, 127, 106, 237],
      ["nov-25", "Competidor A", "Lavado", 14, 47, 44, 34, 16.0, 131, 179, 124],
    ],
    instr: [
      "Una fila por ola (medición), marca y categoría. Borrá las filas de ejemplo.",
      "Obligatorias: Ola y Marca, y al menos un indicador. El resto suma lecturas.",
      "Ola: una fecha o mes (nov-25, 2025-11, 01/11/2025) o un nombre (\"Ola 3\"). Con fecha, se ordenan solas.",
      "Indicadores en % (40 o 40% o 0,40). Poder de marca e índices de la hélice como vienen (índice).",
      "Si tu estudio trae otros nombres de columna, no pasa nada: al sumar la planilla elegís qué es cada una.",
    ],
  },
  mercado: {
    sheet: "Share de mercado", file: "bip-share-de-mercado-plantilla.xlsx",
    headers: ["Mes", "Marca", "Categoría", "Segmento", "Share valor %", "Share unidades %", "Ventas valor", "Ventas unidades", "Precio promedio"],
    rows: [
      ["2026-01", "Tu marca", "Lavado", "Total", 32.1, 29.4, 1250000000, 3400, 367000],
      ["2026-01", "Competidor A", "Lavado", "Total", 18.5, 21.0, 720000000, 2430, 296000],
      ["2026-01", "Otras", "Lavado", "Total", 49.4, 49.6, 1925000000, 5740, 335000],
      ["2026-02", "Tu marca", "Lavado", "Total", 31.4, 28.9, 1190000000, 3310, 359000],
    ],
    instr: [
      "Una fila por mes, marca, categoría y segmento. Borrá las filas de ejemplo.",
      "Obligatorias: Mes y Marca, y el share o las ventas (en valor o unidades). Con ventas, BIP calcula el share.",
      "Incluí la fila \"Otras\" (el resto del mercado) para que el total sume 100%.",
      "Si tu dato ya es año móvil (MAT / U12M), marcalo al sumar la planilla.",
      "Precio: promedio de la marca o índice de precio (base 100). Mes: 2026-03, mar-26 o 01/03/2026.",
    ],
  },
};
