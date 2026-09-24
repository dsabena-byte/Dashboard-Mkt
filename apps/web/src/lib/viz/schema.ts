// Preparación de un dataset: infiere campos, aplica overrides del usuario (tipo/rol/formato/
// nombre), parsea TODO una sola vez a columnas tipadas (Float64Array para números/fechas) y
// evalúa los campos calculados de fila. Memoizado por (filas, ajustes) → las queries corren
// sobre columnas ya parseadas (100k filas sin re-parsear en cada interacción).
import type { BlendDef, Dataset, DatasetSettings, Field, FieldType } from "./types";
import { compile, evaluate, ExprError, type Compiled, type Val } from "./expr";
import { inferColumn, parseBool, parseDate, parseNumber, sampleCol, type NumLocale } from "./parse";

export const ROWS_FIELD = "__rows";
export const BIG_DATASET = 50_000;

export interface Prepared {
  ds: Dataset;
  n: number;
  fields: Field[];
  byId: Map<string, Field>;
  /** número / fecha (ms) / booleano (1/0) — NaN = vacío */
  num: Map<string, Float64Array>;
  /** texto (null = vacío) */
  str: Map<string, (string | null)[]>;
  compiled: Map<string, Compiled>;
  warnings: string[];
  /** caché interna (argumentos de agregados calculados, etc.) */
  cache: Map<string, unknown>;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

function parseColumn(n: number, raw: (i: number) => unknown, type: FieldType, locale: NumLocale): { num?: Float64Array; str?: (string | null)[]; monthOnly: boolean } {
  if (type === "text") {
    const str: (string | null)[] = new Array(n);
    for (let i = 0; i < n; i++) { const v = raw(i); str[i] = v == null || v === "" ? null : String(v).trim() || null; }
    return { str, monthOnly: false };
  }
  const num = new Float64Array(n);
  let monthOnly = true, anyDate = false;
  // Año de referencia para meses sin año: el de las fechas completas de la columna, o el actual.
  for (let i = 0; i < n; i++) {
    const v = raw(i);
    if (type === "number") { const x = parseNumber(v, locale); num[i] = x == null ? NaN : x; }
    else if (type === "boolean") { const b = parseBool(v); num[i] = b == null ? (parseNumber(v) ?? NaN) : b ? 1 : 0; }
    else {
      const d = parseDate(v, { serial: true });
      if (d) { anyDate = true; if (!d.monthOnly) monthOnly = false; num[i] = d.t; } else num[i] = NaN;
    }
  }
  return { num, monthOnly: type === "date" && anyDate && monthOnly };
}

const prepCache = new WeakMap<object, Map<string, Prepared>>();

/** Prepara un dataset con sus ajustes. `lookup` resuelve datasets remotos para blends. */
export function prepare(ds: Dataset, settings: DatasetSettings = {}, lookup?: (id: string) => Dataset | null | undefined): Prepared {
  const blendKey = (settings.blends ?? []).map((b) => { const r = lookup?.(b.datasetId); return `${b.datasetId}:${r?.rows.length ?? -1}`; }).join("|");
  const key = JSON.stringify(settings) + blendKey;
  let byKey = prepCache.get(ds.rows);
  if (!byKey) { byKey = new Map(); prepCache.set(ds.rows, byKey); }
  const hit = byKey.get(key);
  if (hit) return hit;
  const p = doPrepare(ds, settings, lookup);
  if (byKey.size > 12) byKey.clear();
  byKey.set(key, p);
  return p;
}

function doPrepare(ds: Dataset, settings: DatasetSettings, lookup?: (id: string) => Dataset | null | undefined): Prepared {
  const rows = ds.rows ?? [];
  const n = rows.length;
  const P: Prepared = { ds, n, fields: [], byId: new Map(), num: new Map(), str: new Map(), compiled: new Map(), warnings: [], cache: new Map() };
  if (n > BIG_DATASET) P.warnings.push(`La planilla tiene ${n.toLocaleString("es-AR")} filas: puede tardar un poco más en responder.`);
  const ov = settings.fields ?? {};

  const addRaw = (id: string, label: string, raw: (i: number) => unknown, sample: unknown[], source: Field["source"], col?: number) => {
    const inf = inferColumn(label, sample);
    const o = ov[id] ?? {};
    const type = o.type ?? inf.type;
    const parsed = parseColumn(n, raw, type, inf.locale);
    const f: Field = {
      id, label: o.label?.trim() || label, type,
      role: o.role ?? (type === inf.type ? inf.role : type === "number" ? "measure" : "dimension"),
      format: o.format ?? (type === "number" ? (type === inf.type ? inf.format : "number") : "auto"),
      source, col, hidden: o.hidden, monthOnly: parsed.monthOnly || undefined,
    };
    if (parsed.num) P.num.set(id, parsed.num);
    if (parsed.str) P.str.set(id, parsed.str);
    P.fields.push(f); P.byId.set(id, f);
  };

  // 1 · Columnas
  const labels = new Set<string>();
  ds.columns.forEach((c, i) => {
    let label = String(c ?? "").trim() || `Columna ${i + 1}`;
    while (labels.has(norm(label))) label = `${label} (${i + 1})`;
    labels.add(norm(label));
    addRaw(String(i), label, (r) => rows[r]?.[i], sampleCol(rows, i), "col", i);
  });

  // 2 · Blends (lookup a otro dataset por clave)
  for (const b of settings.blends ?? []) addBlend(P, b, lookup);

  // 3 · Calculados (en pasadas, para permitir que uno use a otro)
  const calcs = settings.calcs ?? [];
  const pending = [...calcs];
  for (let pass = 0; pass < 4 && pending.length; pass++) {
    for (let k = 0; k < pending.length; k++) {
      const c = pending[k];
      try {
        const comp = compile(c!.expr, (name) => resolveName(P, name));
        if (comp.refs.some((r) => P.byId.get(r)?.aggregate)) throw new ExprError("Un cálculo no puede usar otro cálculo agregado");
        addCalc(P, c!, comp);
        pending.splice(k--, 1);
      } catch (e) {
        if (pass === 3 || !(e instanceof ExprError) || !/No existe el campo/.test(e.message)) {
          const f: Field = { id: c!.id, label: c!.name, type: "number", role: "measure", format: c!.format ?? "auto", source: "calc", calc: c, error: e instanceof Error ? e.message : "Error" };
          P.fields.push(f); P.byId.set(c!.id, f);
          pending.splice(k--, 1);
        }
      }
    }
  }
  for (const c of pending) { const f: Field = { id: c.id, label: c.name, type: "number", role: "measure", format: c.format ?? "auto", source: "calc", calc: c, error: "Referencia a un campo inexistente" }; P.fields.push(f); P.byId.set(c.id, f); }
  return P;
}

function addBlend(P: Prepared, b: BlendDef, lookup?: (id: string) => Dataset | null | undefined) {
  const remote = lookup?.(b.datasetId);
  if (!remote) { P.warnings.push("Hay un cruce con otra planilla que no está disponible."); return; }
  const rk = Number(b.remoteKey);
  const idx = new Map<string, number>();
  remote.rows.forEach((r, i) => { const v = r?.[rk]; if (v != null && v !== "") { const k = norm(String(v)); if (!idx.has(k)) idx.set(k, i); } });
  const local = P.byId.get(b.localKey);
  if (!local) { P.warnings.push("El cruce usa una clave que ya no existe."); return; }
  const localStr = keyStrings(P, local.id);
  const match = new Int32Array(P.n);
  let hits = 0;
  for (let i = 0; i < P.n; i++) { const k = localStr[i]; const j = k == null ? undefined : idx.get(norm(k)); match[i] = j ?? -1; if (j != null) hits++; }
  if (P.n && hits / P.n < 0.5) P.warnings.push(`El cruce con “${remote.name}” encontró coincidencia en ${Math.round((hits / P.n) * 100)}% de las filas.`);
  for (const c of b.fields) {
    const ci = Number(c);
    const label = `${String(remote.columns[ci] ?? `Columna ${ci + 1}`)} · ${remote.name.replace(/\.(xlsx|xls|csv)$/i, "")}`;
    const raw = (i: number) => { const j = match[i]; return j! < 0 ? null : remote.rows[j!]?.[ci]; };
    const addRawBlend = (id: string) => {
      const sample = sampleCol(remote.rows, ci);
      const inf = inferColumn(label, sample);
      const o = {} as { type?: FieldType };
      const type = o.type ?? inf.type;
      const parsed = parseColumn(P.n, raw, type, inf.locale);
      const f: Field = { id, label, type, role: inf.role, format: inf.format, source: "blend" };
      if (parsed.num) P.num.set(id, parsed.num);
      if (parsed.str) P.str.set(id, parsed.str);
      P.fields.push(f); P.byId.set(id, f);
    };
    addRawBlend(`bl_${b.id}_${c}`);
  }
}

/** Valor de fila tipado (para expresiones). */
export function rowVal(P: Prepared, id: string, i: number): Val {
  const f = P.byId.get(id);
  if (!f) return null;
  const a = P.num.get(id);
  if (a) { const x = a[i]!; if (Number.isNaN(x)) return null; return f.type === "date" ? new Date(x) : f.type === "boolean" ? x === 1 : x; }
  const s = P.str.get(id);
  return s ? (s[i] as string | null) : null;
}

function addCalc(P: Prepared, c: { id: string; name: string; expr: string; format?: Field["format"] }, comp: Compiled) {
  P.compiled.set(c.id, comp);
  if (comp.aggregate) {
    const f: Field = { id: c.id, label: c.name, type: "number", role: "measure", format: c.format ?? guessCalcFormat(P, comp), source: "calc", calc: c as Field["calc"], aggregate: true };
    P.fields.push(f); P.byId.set(c.id, f);
    return;
  }
  const out: Val[] = new Array(P.n);
  const get = (i: number) => (id: string) => rowVal(P, id, i);
  for (let i = 0; i < P.n; i++) { try { out[i] = evaluate(comp.ast, get(i)); } catch { out[i] = null; } }
  let type: FieldType = "number";
  const sample = out.filter((v) => v != null).slice(0, 300);
  if (sample.length) {
    if (sample.every((v) => v instanceof Date)) type = "date";
    else if (sample.every((v) => typeof v === "boolean")) type = "boolean";
    else if (!sample.every((v) => typeof v === "number")) type = "text";
  }
  const f: Field = { id: c.id, label: c.name, type, role: type === "number" ? "measure" : "dimension", format: c.format ?? (type === "number" ? guessCalcFormat(P, comp) : "auto"), source: "calc", calc: c as Field["calc"] };
  if (type === "text") P.str.set(c.id, out.map((v) => (v == null || v === "" ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v))));
  else {
    const a = new Float64Array(P.n);
    for (let i = 0; i < P.n; i++) { const v = out[i]; a[i] = v == null ? NaN : v instanceof Date ? v.getTime() : typeof v === "boolean" ? (v ? 1 : 0) : typeof v === "number" ? v : NaN; }
    P.num.set(c.id, a);
  }
  P.fields.push(f); P.byId.set(c.id, f);
}

/** Formato razonable para un calculado: ratio de dos monedas → x; si la expresión multiplica por 100 → %. */
function guessCalcFormat(P: Prepared, comp: Compiled): Field["format"] {
  const refs = comp.refs.map((r) => P.byId.get(r)).filter(Boolean) as Field[];
  const src = JSON.stringify(comp.ast);
  const hasDiv = src.includes('"op":"/"');
  if (hasDiv && src.includes('"v":100')) return "percent";
  if (hasDiv && refs.length >= 2) return refs.every((f) => f.format === "currency") ? "ratio" : "decimal";
  if (refs.length && refs.every((f) => f.format === "currency")) return "currency";
  return "number";
}

/** Nombre → id (por etiqueta sin tildes ni mayúsculas, o por id). */
export function resolveName(P: Prepared, name: string): string | null {
  const k = norm(name);
  for (const f of P.fields) if (norm(f.label) === k) return f.id;
  if (P.byId.has(name)) return name;
  return null;
}

/** Claves de texto por fila (para blends y dimensiones). */
function keyStrings(P: Prepared, id: string): (string | null)[] {
  const s = P.str.get(id);
  if (s) return s;
  const a = P.num.get(id);
  const f = P.byId.get(id);
  const out: (string | null)[] = new Array(P.n);
  for (let i = 0; i < P.n; i++) { const x = a ? a[i]! : NaN; out[i] = Number.isNaN(x) ? null : f?.type === "date" ? new Date(x).toISOString().slice(0, 10) : String(x); }
  return out;
}

/** Lista de campos visibles (dimensiones primero). */
export function visibleFields(P: Prepared): Field[] {
  return P.fields.filter((f) => !f.hidden);
}

/** Primer campo de fecha (para filtros y comparaciones por defecto). */
export function firstDateField(P: Prepared): Field | undefined {
  return P.fields.find((f) => f.type === "date" && !f.hidden && !f.error);
}

/** Rango [min, max] de una columna de fecha/número. */
export function fieldRange(P: Prepared, id: string): [number, number] | null {
  const k = `range:${id}`;
  if (P.cache.has(k)) return P.cache.get(k) as [number, number] | null;
  const a = P.num.get(id);
  let mn = Infinity, mx = -Infinity;
  if (a) for (let i = 0; i < a.length; i++) { const x = a[i]!; if (x! < mn) mn = x; if (x! > mx) mx = x; }
  const r: [number, number] | null = mn <= mx ? [mn, mx] : null;
  P.cache.set(k, r);
  return r;
}

/** Valores distintos de una dimensión (para filtros), ordenados por frecuencia. */
export function distinctValues(P: Prepared, id: string, limit = 500): { key: string; count: number }[] {
  const k = `distinct:${id}`;
  if (P.cache.has(k)) return (P.cache.get(k) as { key: string; count: number }[]).slice(0, limit);
  const m = new Map<string, number>();
  const f = P.byId.get(id);
  const s = P.str.get(id), a = P.num.get(id);
  for (let i = 0; i < P.n; i++) {
    let key: string;
    if (s) key = s[i] ?? "(vacío)";
    else if (a) { const x = a[i]; key = Number.isNaN(x) ? "(vacío)" : f?.type === "boolean" ? (x === 1 ? "Sí" : "No") : String(x); }
    else continue;
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  const out = [...m.entries()].map(([key, count]) => ({ key, count })).sort((x, y) => y.count - x.count || x.key.localeCompare(y.key, "es"));
  P.cache.set(k, out);
  return out.slice(0, limit);
}
