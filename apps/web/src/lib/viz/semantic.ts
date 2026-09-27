// ============================================================================
// "Armame el tablero" en lenguaje natural — capa SEMÁNTICA (pura, client-safe).
//  · Mapea términos del pedido ("inversión", "ventas", "CPA", "por medio", "por mes") a campos de
//    cualquier dataset (planillas + fuentes nativas del dashboard) usando el catálogo único de métricas
//    (lib/metricas.ts: nombre + sinónimos) y los nombres reales de las columnas.
//  · Recetas de métricas DERIVADAS con la definición única (CPA = Inversión ÷ Conversiones, CPM, CTR,
//    CPC, ROAS, Frecuencia, Ticket promedio, Engagement rate, Inversión/Facturación) → Calc agregado.
//  · Validación ESTRICTA del JSON que devuelve el modelo (validateNlOutput): lista de errores concretos
//    para el reintento de reparación.
//  · Fallback determinístico (fallbackPlan): arma el tablero sin IA a partir de lo resuelto.
// Imports SOLO relativos (se compila suelto en scripts/tablero-nl.test.ts).
// ============================================================================
import { METRICAS, canonMetrica, metricaPorNombre, type Metrica } from "../metricas";
import type { AiDataset, AiField } from "./ai-schema";
import type { Agg, ChartType, DateGrain, NumFormat } from "./types";
import { CHART_TYPES } from "./dashboard";

const canon = canonMetrica;
const stem = (w: string) => (w.length > 5 && w.endsWith("es") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);
const stemPhrase = (s: string) => canon(s).split(" ").map(stem).join(" ");

// ── Componentes de las recetas (términos que identifican una COLUMNA de volumen) ──
type Comp = "inversion" | "impresiones" | "clicks" | "alcance" | "conversiones" | "ingresos" | "interacciones";
const COMP_TERMS: Record<Comp, string[]> = {
  inversion: ["inversion", "inversion total", "gasto", "spend", "inversion en medios", "costo total", "importe invertido"],
  impresiones: ["impresiones", "impressions"],
  clicks: ["clicks", "clics", "click", "clic"],
  alcance: ["alcance", "reach", "alcance unico"],
  conversiones: ["conversiones", "leads", "resultados", "compras", "transacciones", "pedidos", "ordenes"],
  ingresos: ["ingresos", "revenue", "valor de conversiones", "valor de conversion", "ventas", "ventas netas", "venta", "facturacion", "facturacion neta"],
  interacciones: ["interacciones", "engagement"],
};

export interface Recipe { num: Comp; den: Comp; mult: number; format: NumFormat; name: string }
/** Métricas derivadas del catálogo → fórmula agregada (una sola definición en toda la app). */
export const RECIPES: Record<string, Recipe> = {
  cpa: { num: "inversion", den: "conversiones", mult: 1, format: "currency", name: "CPA" },
  cpm: { num: "inversion", den: "impresiones", mult: 1000, format: "currency", name: "CPM" },
  cpc: { num: "inversion", den: "clicks", mult: 1, format: "currency", name: "CPC" },
  ctr: { num: "clicks", den: "impresiones", mult: 100, format: "percent", name: "CTR" },
  roas: { num: "ingresos", den: "inversion", mult: 1, format: "ratio", name: "ROAS" },
  frecuencia: { num: "impresiones", den: "alcance", mult: 1, format: "ratio", name: "Frecuencia" },
  aov: { num: "ingresos", den: "conversiones", mult: 1, format: "currency", name: "Ticket promedio" },
  engagement: { num: "interacciones", den: "alcance", mult: 100, format: "percent", name: "Engagement rate" },
  inv_facturacion: { num: "inversion", den: "ingresos", mult: 100, format: "percent", name: "Inversión / Facturación" },
};

/** Componente de receta que representa una columna (por su nombre), o null. */
export function fieldComp(label: string): Comp | null {
  const c = canon(label).replace(/\s*%.*$/, "");
  let best: { comp: Comp; len: number } | null = null;
  for (const [comp, terms] of Object.entries(COMP_TERMS) as [Comp, string[]][]) {
    for (const t of terms) {
      if (c === t || c.startsWith(`${t} `) || c.endsWith(` ${t}`)) { if (!best || t.length > best.len) best = { comp, len: t.length }; }
    }
  }
  return best?.comp ?? null;
}

/** Métrica del catálogo que representa una columna (por nombre exacto o término dentro del nombre). */
export function fieldMetrica(label: string): Metrica | undefined {
  const exact = metricaPorNombre(label) ?? metricaPorNombre(label.replace(/\s*\(.*\)\s*$/, ""));
  if (exact) return exact;
  const c = ` ${canon(label)} `;
  for (const { term, m } of PROMPT_TERMS) if (term.length >= 4 && c.includes(` ${term} `)) return m;
  return undefined;
}

// Términos del catálogo para reconocer métricas en el PEDIDO (más largo primero). "ventas" entra
// (en metricaEnTexto es stopword por ser genérico dentro de textos largos, acá es la intención).
const PROMPT_TERMS: { term: string; m: Metrica }[] = (() => {
  const out: { term: string; m: Metrica }[] = [];
  for (const m of METRICAS) for (const a of [m.nombre, m.etiqueta, ...m.sinonimos, ...(m.claves ?? [])]) {
    if (!a) continue;
    const t = canon(a);
    if (t.length >= 2) out.push({ term: t, m });
  }
  return out.sort((a, b) => b.term.length - a.term.length);
})();

// ── Esquema enriquecido para la IA ────────────────────────────────────────────
export interface SemanticField extends AiField { metrica?: string; definicion?: string; agg?: Agg }
export interface SemanticDataset extends Omit<AiDataset, "fields"> { fields: SemanticField[]; nativo?: boolean; derivadas?: { metrica: string; name: string; expr: string; format: NumFormat }[] }

const isRateFormat = (f: string) => f === "percent" || f === "pct_frac" || f === "ratio";

/** Suma a cada campo su métrica del catálogo (definición única) y el agregado correcto; y a cada dataset
 *  las métricas derivadas que se pueden calcular con sus columnas. */
export function annotateSchema(ds: AiDataset): SemanticDataset {
  const fields: SemanticField[] = ds.fields.map((f) => {
    const out: SemanticField = { ...f };
    if (f.role === "measure" || f.type === "number") {
      const m = fieldMetrica(f.label);
      if (m) { out.metrica = m.id; out.definicion = m.formula; }
      out.agg = isRateFormat(f.format) || (m?.tipo === "rate" && !fieldComp(f.label)) ? "avg" : "sum";
    }
    return out;
  });
  const derivadas: SemanticDataset["derivadas"] = [];
  for (const [id, r] of Object.entries(RECIPES)) {
    const calc = recipeCalc(ds, r);
    if (calc) derivadas.push({ metrica: id, ...calc });
  }
  return { ...ds, fields, nativo: ds.id.startsWith("nat:"), derivadas };
}

function compField(ds: AiDataset, comp: Comp): AiField | undefined {
  const cands = ds.fields.filter((f) => f.type === "number" && f.role === "measure" && fieldComp(f.label) === comp);
  // Preferí el nombre más corto (la columna "Inversión" antes que "Inversión offline").
  return cands.sort((a, b) => a.label.length - b.label.length)[0];
}

/** Calc agregado de una receta sobre las columnas de un dataset (null si falta un componente). */
export function recipeCalc(ds: AiDataset, r: Recipe): { name: string; expr: string; format: NumFormat } | null {
  const n = compField(ds, r.num), d = compField(ds, r.den);
  if (!n || !d || n.id === d.id) return null;
  const mult = r.mult !== 1 ? ` * ${r.mult}` : "";
  return { name: r.name, expr: `SUM([${n.label}]) / SUM([${d.label}])${mult}`, format: r.format };
}

// ── Resolución del pedido ─────────────────────────────────────────────────────
export interface MetricCand { datasetId: string; fieldId?: string; calc?: { name: string; expr: string; format: NumFormat }; label: string; agg: Agg }
export interface ResolvedMetric { term: string; metrica?: string; nombre: string; cands: MetricCand[] }
export interface ResolvedDim { term: string; grain?: DateGrain; cands: { datasetId: string; fieldId: string; label: string }[] }
export interface NlResolution { metrics: ResolvedMetric[]; dims: ResolvedDim[]; grain?: DateGrain; compare: boolean; sinResolver: string[] }

const GRAIN_WORDS: [RegExp, DateGrain][] = [
  [/^(dia|dias|diario|diaria|fecha)$/, "day"], [/^(semana|semanas|semanal)$/, "week"],
  [/^(mes|meses|mensual|mensuales)$/, "month"], [/^(trimestre|trimestres|trimestral|quarter)$/, "quarter"],
  [/^(ano|anos|anio|anios|anual)$/, "year"],
];
const STOP_DIM = new Set(["y", "e", "vs", "versus", "contra", "con", "en", "el", "la", "los", "las", "de", "del", "para", "que", "comparado", "comparada", "cada", "su", "sus", "mi", "mis", "a", "al", "o", "u", "segun", "entre", "desde", "hasta", "ultimos", "ultimo", "este", "esta"]);

/** Resuelve métricas y aperturas del pedido contra los datasets disponibles. */
export function resolvePrompt(prompt: string, datasets: AiDataset[]): NlResolution {
  const text = ` ${canon(prompt)} `;
  const used: [number, number][] = [];
  const overlaps = (a: number, b: number) => used.some(([x, y]) => a < y && b > x);
  const metrics: ResolvedMetric[] = [];
  const pushMetric = (rm: ResolvedMetric) => { if (!metrics.some((m) => (rm.metrica && m.metrica === rm.metrica) || m.nombre === rm.nombre)) metrics.push(rm); };

  // 1 · Columnas nombradas LITERALMENTE (tienen prioridad: "interacciones" = la columna, no el ER).
  const labelTerms: { term: string; ds: AiDataset; f: AiField }[] = [];
  for (const ds of datasets) for (const f of ds.fields) {
    if (f.type !== "number" || f.role !== "measure") continue;
    const t = canon(f.label.replace(/\s*\(.*\)\s*$/, ""));
    if (t.length >= 4) labelTerms.push({ term: t, ds, f });
  }
  // 2 · Términos del catálogo.
  type Hit = { start: number; end: number; term: string; kind: "label" | "cat"; m?: Metrica };
  const hits: Hit[] = [];
  const find = (term: string, cb: (s: number) => void) => { let i = text.indexOf(` ${term} `); while (i >= 0) { cb(i + 1); i = text.indexOf(` ${term} `, i + 1); } };
  for (const lt of labelTerms) find(lt.term, (s) => hits.push({ start: s, end: s + lt.term.length, term: lt.term, kind: "label" }));
  for (const pt of PROMPT_TERMS) find(pt.term, (s) => hits.push({ start: s, end: s + pt.term.length, term: pt.term, kind: "cat", m: pt.m }));
  hits.sort((a, b) => (b.end - b.start) - (a.end - a.start) || (a.kind === "label" ? -1 : 1));
  const accepted: Hit[] = [];
  for (const h of hits) { if (overlaps(h.start, h.end)) continue; used.push([h.start, h.end]); accepted.push(h); }
  accepted.sort((a, b) => a.start - b.start);

  for (const h of accepted) {
    // ¿La palabra está justo después de "por"? → es una apertura, no una métrica ("por medio").
    if (/\bpor\s*$/.test(text.slice(0, h.start))) continue;
    const recipe = h.kind === "cat" && h.m ? RECIPES[h.m.id] : undefined;
    const direct = labelTerms.filter((lt) => lt.term === h.term);
    if (direct.length) {
      const m = fieldMetrica(direct[0]!.f.label);
      pushMetric({ term: h.term, metrica: m?.id, nombre: direct[0]!.f.label, cands: direct.map((d) => ({ datasetId: d.ds.id, fieldId: d.f.id, label: d.f.label, agg: isRateFormat(d.f.format) ? "avg" : "sum" })) });
      continue;
    }
    if (h.kind !== "cat" || !h.m) continue;
    const m = h.m;
    if (recipe) {
      const cands: MetricCand[] = [];
      for (const ds of datasets) { const c = recipeCalc(ds, recipe); if (c) cands.push({ datasetId: ds.id, calc: c, label: c.name, agg: "sum" }); }
      // Columna que YA trae la métrica (ej. "CPA" en la planilla) → también vale.
      for (const ds of datasets) for (const f of ds.fields) if (f.type === "number" && fieldMetrica(f.label)?.id === m.id && !fieldComp(f.label)) cands.push({ datasetId: ds.id, fieldId: f.id, label: f.label, agg: "avg" });
      pushMetric({ term: h.term, metrica: m.id, nombre: recipe.name, cands });
      continue;
    }
    const cands: MetricCand[] = [];
    const comp = fieldComp(h.term);
    for (const ds of datasets) for (const f of ds.fields) {
      if (f.type !== "number" || f.role !== "measure") continue;
      const fm = fieldMetrica(f.label);
      if (fm?.id === m.id || (comp && fieldComp(f.label) === comp)) cands.push({ datasetId: ds.id, fieldId: f.id, label: f.label, agg: isRateFormat(f.format) || (m.tipo === "rate" && !comp) ? "avg" : "sum" });
    }
    // Columna exacta primero (ej. "Inversión" antes que "Inversión offline").
    cands.sort((a, b) => a.label.length - b.label.length);
    pushMetric({ term: h.term, metrica: m.id, nombre: m.nombre, cands });
  }

  // 3 · Aperturas "por X".
  const dims: ResolvedDim[] = [];
  let grain: DateGrain | undefined;
  const words = text.trim().split(" ");
  for (let i = 0; i < words.length; i++) {
    if (words[i] !== "por") continue;
    const seg: string[] = [];
    for (let j = i + 1; j < words.length && seg.length < 3; j++) {
      const wj = words[j]!;
      if (STOP_DIM.has(wj) && seg.length) break;
      if (STOP_DIM.has(wj)) continue;
      seg.push(wj);
      if (GRAIN_WORDS.some(([re]) => re.test(wj))) break;
    }
    if (!seg.length) continue;
    const seg0 = seg[0]!;
    const g = GRAIN_WORDS.find(([re]) => re.test(seg0))?.[1];
    if (g) { grain = grain ?? g; dims.push({ term: seg0, grain: g, cands: [] }); continue; }
    // Dimensión: la frase más larga que coincide con una columna de texto de algún dataset.
    let found: ResolvedDim | null = null;
    for (let k = seg.length; k >= 1 && !found; k--) {
      const phrase = seg.slice(0, k).map(stem).join(" ");
      const cands: ResolvedDim["cands"] = [];
      for (const ds of datasets) for (const f of ds.fields) {
        if (f.role !== "dimension" || f.type === "date") continue;
        const lab = stemPhrase(f.label);
        if (lab === phrase || lab.split(" ").includes(phrase) || (phrase.length >= 4 && lab.includes(phrase))) cands.push({ datasetId: ds.id, fieldId: f.id, label: f.label });
      }
      if (cands.length) found = { term: seg.slice(0, k).join(" "), cands };
    }
    dims.push(found ?? { term: seg0, cands: [] });
  }
  // "mensual", "evolución", "tendencia" sin "por" → por mes.
  if (!grain && /\s(mensual|mes a mes|evolucion|tendencia|en el tiempo|historico)\s/.test(text)) grain = "month";

  const compare = /\s(vs|versus|contra|comparad[oa]|comparar|frente a)\s/.test(text);
  const sinResolver = dims.filter((d) => !d.grain && !d.cands.length).map((d) => d.term);
  return { metrics: metrics.slice(0, 6), dims, grain, compare, sinResolver };
}

/** Orden de relevancia de los datasets para el pedido (más métricas y aperturas resueltas primero). */
export function rankDatasets(res: NlResolution, datasets: AiDataset[], primary?: string | null): string[] {
  const score = new Map<string, number>(datasets.map((d) => [d.id, d.id === primary ? 0.5 : 0]));
  for (const m of res.metrics) for (const id of new Set(m.cands.map((c) => c.datasetId))) score.set(id, (score.get(id) ?? 0) + 3);
  for (const d of res.dims) for (const id of new Set(d.cands.map((c) => c.datasetId))) score.set(id, (score.get(id) ?? 0) + 2);
  if (res.grain) for (const ds of datasets) if (ds.fields.some((f) => f.type === "date")) score.set(ds.id, (score.get(ds.id) ?? 0) + 0.5);
  return datasets.map((d) => d.id).sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0));
}

/** Frases "Entendí: …" para mostrarle al usuario cómo se mapeó su pedido. */
export function explainResolution(res: NlResolution, names: Record<string, string>): string[] {
  const out: string[] = [];
  for (const m of res.metrics) {
    const c = m.cands[0];
    out.push(c ? `“${m.term}” → ${m.nombre}${c.calc ? ` (${c.calc.expr.replace(/SUM\(\[([^\]]+)\]\)/g, "$1")})` : ""} · ${names[c.datasetId] ?? c.datasetId}` : `“${m.term}” → no está en tus fuentes`);
  }
  for (const d of res.dims) if (!d.grain) out.push(d.cands[0] ? `“por ${d.term}” → ${d.cands[0].label}` : `“por ${d.term}” → no encontré esa columna`);
  if (res.grain) out.push(`por ${({ day: "día", week: "semana", month: "mes", quarter: "trimestre", year: "año" } as const)[res.grain]}`);
  return out;
}

// ── Salida del modelo: tipos + validación estricta ────────────────────────────
export interface NlCalc { datasetId: string; name: string; expr: string; format?: NumFormat }
export interface NlBlend { id: string; datasetId: string; remoteDatasetId: string; localKey: string; remoteKey: string; fields: string[]; grain?: "month" }
export interface NlOutput { widgets: Record<string, unknown>[]; calcs: NlCalc[]; blends: NlBlend[]; reply?: string; motivo?: string }

const AGGS: Agg[] = ["sum", "avg", "min", "max", "count", "countd", "median", "last"];
const GRAINS: DateGrain[] = ["day", "week", "month", "quarter", "year"];
const FORMATS: NumFormat[] = ["auto", "number", "integer", "decimal", "currency", "percent", "pct_frac", "ratio"];
const NEEDS_X: ChartType[] = ["bar", "line", "area", "combo", "pie", "donut", "funnel", "waterfall", "heatmap", "scatter"];
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const normName = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Valida el JSON del modelo contra los esquemas reales. Estricto: todo campo referenciado tiene que
 * existir en SU dataset (columna, "__rows", "calc:<nombre>" declarado o campo de un cruce "bl_<id>_<col>").
 * Devuelve los errores (para el reintento de reparación) y la parte válida (widgets que pasan enteros).
 */
export function validateNlOutput(raw: unknown, datasets: AiDataset[], primary: string): { ok: boolean; errors: string[]; value: NlOutput } {
  const errors: string[] = [];
  const value: NlOutput = { widgets: [], calcs: [], blends: [] };
  if (!isObj(raw)) return { ok: false, errors: ["La respuesta no es un objeto JSON."], value };
  if (typeof raw.reply === "string") value.reply = raw.reply.slice(0, 300);
  if (typeof raw.motivo === "string") value.motivo = raw.motivo.slice(0, 300);
  const byId = new Map(datasets.map((d) => [d.id, d]));
  if (!Array.isArray(raw.widgets)) { errors.push('Falta "widgets" (array).'); return { ok: false, errors, value }; }
  if (!raw.widgets.length && !value.motivo) errors.push('"widgets" está vacío y no hay "motivo".');
  if (raw.widgets.length > 12) errors.push('"widgets" tiene más de 12 gráficos.');

  // Campos válidos por dataset: columnas + calcs + campos de cruce.
  const valid = new Map<string, Set<string>>(datasets.map((d) => [d.id, new Set(d.fields.map((f) => f.id))]));
  const types = new Map<string, Map<string, string>>(datasets.map((d) => [d.id, new Map(d.fields.map((f) => [f.id, f.type]))]));
  const labels = new Map(datasets.map((d) => [d.id, new Set(d.fields.map((f) => normName(f.label)))]));

  const calcsRaw = raw.calcs === undefined ? [] : raw.calcs;
  if (!Array.isArray(calcsRaw)) errors.push('"calcs" tiene que ser un array.');
  else calcsRaw.slice(0, 12).forEach((c, i) => {
    if (!isObj(c) || typeof c.name !== "string" || !c.name.trim() || typeof c.expr !== "string" || !c.expr.trim()) { errors.push(`calcs[${i}]: faltan "name" o "expr".`); return; }
    const dsId = typeof c.datasetId === "string" ? c.datasetId : primary;
    if (!byId.has(dsId)) { errors.push(`calcs[${i}]: el dataset "${dsId}" no existe.`); return; }
    const refs = [...c.expr.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
    if (!refs.length) { errors.push(`calcs[${i}] "${c.name}": la fórmula no usa ningún [Campo].`); return; }
    const pendingNames = calcsRaw.filter(isObj).map((x) => normName(String(x.name ?? "")));
    const bad = refs.filter((r): r is string => r != null).filter((r) => !labels.get(dsId)!.has(normName(r)) && !pendingNames.includes(normName(r)));
    if (bad.length) { errors.push(`calcs[${i}] "${c.name}": [${bad.join("], [")}] no es un campo de "${dsId}" (usá el label exacto).`); return; }
    const fmt = FORMATS.includes(c.format as NumFormat) ? (c.format as NumFormat) : undefined;
    value.calcs.push({ datasetId: dsId, name: c.name.slice(0, 80), expr: c.expr.slice(0, 2000), format: fmt });
    valid.get(dsId)!.add(`calc:${c.name}`);
    types.get(dsId)!.set(`calc:${c.name}`, "number");
  });

  const blendsRaw = raw.blends === undefined ? [] : raw.blends;
  if (!Array.isArray(blendsRaw)) errors.push('"blends" tiene que ser un array.');
  else blendsRaw.slice(0, 3).forEach((b, i) => {
    if (!isObj(b)) { errors.push(`blends[${i}] no es un objeto.`); return; }
    const local = String(b.datasetId ?? ""), remote = String(b.remoteDatasetId ?? "");
    const id = typeof b.id === "string" && /^[a-z0-9_]{1,20}$/i.test(b.id) ? b.id : `b${i}`;
    if (!byId.has(local) || !byId.has(remote) || local === remote) { errors.push(`blends[${i}]: "datasetId" y "remoteDatasetId" tienen que ser dos datasets distintos del esquema.`); return; }
    const lk = String(b.localKey ?? ""), rk = String(b.remoteKey ?? "");
    if (!valid.get(local)!.has(lk)) { errors.push(`blends[${i}]: localKey "${lk}" no existe en "${local}".`); return; }
    if (!types.get(remote)!.has(rk)) { errors.push(`blends[${i}]: remoteKey "${rk}" no existe en "${remote}".`); return; }
    const grain = b.grain === "month" ? "month" as const : undefined;
    if (grain && (types.get(local)!.get(lk) !== "date" || types.get(remote)!.get(rk) !== "date")) { errors.push(`blends[${i}]: el cruce por mes necesita claves de tipo fecha en los dos datasets.`); return; }
    const fields = Array.isArray(b.fields) ? b.fields.map(String) : [];
    const badF = fields.filter((f) => !types.get(remote)!.has(f));
    if (!fields.length || badF.length) { errors.push(`blends[${i}]: "fields" tiene que listar ids de columnas de "${remote}"${badF.length ? ` (no existen: ${badF.join(", ")})` : ""}.`); return; }
    value.blends.push({ id, datasetId: local, remoteDatasetId: remote, localKey: lk, remoteKey: rk, fields: fields.slice(0, 6), grain });
    for (const f of fields) { valid.get(local)!.add(`bl_${id}_${f}`); types.get(local)!.set(`bl_${id}_${f}`, types.get(remote)!.get(f)!); }
  });

  raw.widgets.slice(0, 12).forEach((w, i) => {
    const errs: string[] = [];
    const tag = `widgets[${i}]`;
    if (!isObj(w)) { errors.push(`${tag} no es un objeto.`); return; }
    const type = w.type as ChartType;
    if (!CHART_TYPES.includes(type)) errs.push(`${tag}.type "${String(w.type)}" no es válido (${CHART_TYPES.join("|")}).`);
    if (typeof w.title !== "string" || !w.title.trim()) errs.push(`${tag}.title falta.`);
    const dsId = w.datasetId == null ? primary : String(w.datasetId);
    if (!byId.has(dsId)) { errs.push(`${tag}.datasetId "${dsId}" no existe.`); errors.push(...errs); return; }
    const V = valid.get(dsId)!;
    const T = types.get(dsId)!;
    const okF = (f: unknown) => typeof f === "string" && V.has(f);
    const q = isObj(w.q) ? w.q : null;
    if (!q) { errs.push(`${tag}.q falta.`); errors.push(...errs); return; }
    if (type !== "text") {
      const ms = Array.isArray(q.measures) ? q.measures : [];
      if (!ms.length && type !== "table") errs.push(`${tag}.q.measures está vacío.`);
      ms.forEach((m, j) => {
        if (!isObj(m)) { errs.push(`${tag}.q.measures[${j}] no es un objeto.`); return; }
        if (m.field !== "__rows" && !okF(m.field)) errs.push(`${tag}.q.measures[${j}].field "${String(m.field)}" no existe en "${dsId}".`);
        else if (m.field !== "__rows" && T.get(String(m.field)) !== "number" && !["count", "countd"].includes(String(m.agg))) errs.push(`${tag}.q.measures[${j}]: "${String(m.field)}" no es numérico (usá agg count/countd).`);
        if (m.agg !== undefined && !AGGS.includes(m.agg as Agg)) errs.push(`${tag}.q.measures[${j}].agg "${String(m.agg)}" no es válido.`);
      });
    }
    for (const k of ["x", "series", "dateField"] as const) if (q[k] != null && !okF(q[k])) errs.push(`${tag}.q.${k} "${String(q[k])}" no existe en "${dsId}".`);
    for (const k of ["rows", "cols"] as const) if (q[k] != null) { if (!Array.isArray(q[k]) || !(q[k] as unknown[]).every(okF)) errs.push(`${tag}.q.${k} tiene campos que no existen.`); }
    if (NEEDS_X.includes(type) && q.x == null) errs.push(`${tag}: un gráfico "${type}" necesita q.x.`);
    if (q.grain != null && !GRAINS.includes(q.grain as DateGrain)) errs.push(`${tag}.q.grain "${String(q.grain)}" no es válido.`);
    if (q.grain != null && q.x != null && T.get(String(q.x)) !== "date") errs.push(`${tag}.q.grain solo aplica si q.x es una fecha.`);
    if (Array.isArray(q.filters)) q.filters.forEach((f, j) => { if (!isObj(f) || !okF(f.field)) errs.push(`${tag}.q.filters[${j}].field no existe.`); });
    if (errs.length) { errors.push(...errs); return; }
    value.widgets.push({ ...w, datasetId: dsId });
  });
  return { ok: errors.length === 0 && value.widgets.length > 0, errors, value };
}

// ── Fallback determinístico (sin IA) ──────────────────────────────────────────
const dateFieldOf = (ds: AiDataset) => ds.fields.find((f) => f.type === "date");
let seq = 0;
const wid = () => `nl_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** Arma un tablero razonable con lo resuelto (KPI, evolución, apertura, combo o cruce por mes).
 *  null = no se reconoció ninguna métrica disponible en las fuentes. */
export function fallbackPlan(res: NlResolution, datasets: AiDataset[]): NlOutput | null {
  const byId = new Map(datasets.map((d) => [d.id, d]));
  const out: NlOutput = { widgets: [], calcs: [], blends: [] };
  const catDims = res.dims.filter((d) => !d.grain && d.cands.length);
  const wantTime = !!res.grain || !catDims.length;
  const grain = res.grain ?? "month";

  // Elegir el candidato de cada métrica: con la apertura pedida > con fecha > el primero.
  const picks: { m: ResolvedMetric; c: MetricCand; ds: AiDataset }[] = [];
  for (const m of res.metrics) {
    if (!m.cands.length) continue;
    const score = (c: MetricCand) => {
      const ds = byId.get(c.datasetId); if (!ds) return -1;
      let s = 0;
      if (catDims.some((d) => d.cands.some((x) => x.datasetId === c.datasetId))) s += 4;
      if (wantTime && dateFieldOf(ds)) s += 2;
      if (picks.some((p) => p.ds.id === c.datasetId)) s += 1; // mismo dataset que otra métrica → combo posible
      if (c.fieldId) s += 0.5;
      return s;
    };
    const c = [...m.cands].sort((a, b) => score(b) - score(a))[0]!;
    const ds = byId.get(c.datasetId);
    if (ds) picks.push({ m, c, ds });
  }
  if (!picks.length) return null;

  const measureOf = (p: { c: MetricCand; ds: AiDataset }) => {
    if (p.c.calc) {
      if (!out.calcs.some((x) => x.datasetId === p.ds.id && x.name === p.c.calc!.name)) out.calcs.push({ datasetId: p.ds.id, ...p.c.calc });
      return { field: `calc:${p.c.calc.name}`, agg: "sum" as Agg, label: p.c.calc.name };
    }
    return { field: p.c.fieldId!, agg: p.c.agg, label: p.c.label };
  };

  // KPIs (máx. 4).
  for (const p of picks.slice(0, 4)) {
    const df = dateFieldOf(p.ds);
    out.widgets.push({ id: wid(), type: "kpi", title: p.m.nombre, datasetId: p.ds.id, w: 1, h: "s", q: { measures: [{ id: "m0", ...measureOf(p) }], dateField: df?.id }, opts: { kpiMode: "total", compare: df ? "prev_period" : "none", spark: !!df } });
  }

  // Evolución: "A vs B por mes" → combo en un dataset o cruce por mes entre dos.
  if (wantTime) {
    const done = new Set<number>();
    if (res.compare && picks.length >= 2) {
      const a = picks[0]!, b = picks[1]!;
      const dfA = dateFieldOf(a.ds), dfB = dateFieldOf(b.ds);
      if (a.ds.id === b.ds.id && dfA) {
        out.widgets.push({ id: wid(), type: "combo", title: `${a.m.nombre} vs ${b.m.nombre} por ${grainLabel(grain)}`, datasetId: a.ds.id, w: 4, h: "m", q: { x: dfA.id, grain, measures: [{ id: "m0", ...measureOf(a), mark: "bar", axis: "left" }, { id: "m1", ...measureOf(b), mark: "line", axis: "right" }] }, opts: {} });
        done.add(0); done.add(1);
      } else if (dfA && dfB && b.c.fieldId && grain === "month") {
        const id = `b${out.blends.length}`;
        out.blends.push({ id, datasetId: a.ds.id, remoteDatasetId: b.ds.id, localKey: dfA.id, remoteKey: dfB.id, fields: [b.c.fieldId], grain: "month" });
        out.widgets.push({ id: wid(), type: "combo", title: `${a.m.nombre} vs ${b.m.nombre} por mes`, subtitle: `${b.m.nombre}: ${b.ds.name} (cruce por mes)`, datasetId: a.ds.id, w: 4, h: "m", q: { x: dfA.id, grain: "month", measures: [{ id: "m0", ...measureOf(a), mark: "bar", axis: "left" }, { id: "m1", field: `bl_${id}_${b.c.fieldId}`, agg: "sum", label: b.m.nombre, mark: "line", axis: "right" }] }, opts: {} });
        done.add(0); done.add(1);
      }
    }
    picks.forEach((p, i) => {
      if (done.has(i)) return;
      const df = dateFieldOf(p.ds);
      if (!df) return;
      if (catDims.some((d) => d.cands.some((x) => x.datasetId === p.ds.id)) && !res.grain) return;
      out.widgets.push({ id: wid(), type: p.c.calc || p.c.agg === "avg" ? "line" : "bar", title: `${p.m.nombre} por ${grainLabel(grain)}`, datasetId: p.ds.id, w: picks.length > 1 ? 2 : 4, h: "m", q: { x: df.id, grain, measures: [{ id: "m0", ...measureOf(p) }] }, opts: {} });
    });
  }

  // Aperturas por categoría (ranking horizontal).
  for (const d of catDims) for (const p of picks) {
    const dim = d.cands.find((x) => x.datasetId === p.ds.id);
    if (!dim) continue;
    out.widgets.push({ id: wid(), type: "bar", title: `${p.m.nombre} por ${dim.label.toLowerCase()}`, datasetId: p.ds.id, w: 2, h: "m", q: { x: dim.fieldId, measures: [{ id: "m0", ...measureOf(p) }], sort: { by: "value", dir: "desc" }, topN: { n: 15, others: true } }, opts: { orientation: "h" } });
  }
  return out.widgets.length ? out : null;
}

const grainLabel = (g: DateGrain) => ({ day: "día", week: "semana", month: "mes", quarter: "trimestre", year: "año" } as const)[g];
