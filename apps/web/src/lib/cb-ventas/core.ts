// CB Ventas · núcleo PURO y client-safe: lectura de los CSV de siempre (Clasificación y Cuadro básico -hom),
// armado del cuadro básico por cliente (mismo algoritmo que cuadros-basicos/lib/cb-drive.ts), procesamiento del
// payload del Office Script (mismo que cuadros-basicos/app/api/ventas) y alcance por vendedor/gerencia.
// Test: `npx tsx scripts/cb-ventas.test.ts`.
import { allSkusOfCB, normalizeCliente } from "./match";
import type {
  Categoria, ClasificacionCliente, CuadroBasicoItem, TipoCB, Tipologia, VentaRow, VentasFile, VentasPayload, VentasPayloadRow,
} from "./types";

export const TIPOLOGIAS: Tipologia[] = ["TOP 10", "GRANDES CUENTAS RESTO", "HIPERMERCADOS", "SMALL RETAILERS"];
export const CATEGORIAS: Categoria[] = ["LAVADO", "REFRIGERACION", "COCCION"];

/** Renglón del catálogo (= un renglón del -hom.csv). cliente null = todos los clientes de la tipología. */
export interface CatalogoRow {
  id?: number;
  tipologia: Tipologia;
  cliente: string | null;
  tipo: TipoCB;
  categoria: Categoria;
  modelo: string;
  homologos: string[];
  orden: number;
  /** Migración 0140: desde cuándo / hasta cuándo vale (hasta null = vigente). Ausentes = vale siempre. */
  vigente_desde?: string | null;
  vigente_hasta?: string | null;
}

// ---------- CSV (equivalente a PapaParse header:true que usaba la app vieja) ----------

const TIPOLOGIA_NORMALIZER: Record<string, Tipologia> = {
  "GRANDES CUENTAS TOP 10": "TOP 10",
  "GRANDES CUENTAS RESTO": "GRANDES CUENTAS RESTO",
  "GRANDES CUENTAS RESTO (46 CLIENTES)": "GRANDES CUENTAS RESTO",
  "HIPERMERCADOS": "HIPERMERCADOS",
  "SMALL RETAILERS": "SMALL RETAILERS",
};

export function normTipologia(raw: string): Tipologia | null {
  const t = raw.trim().toUpperCase();
  if (TIPOLOGIA_NORMALIZER[t]) return TIPOLOGIA_NORMALIZER[t];
  for (const [key, val] of Object.entries(TIPOLOGIA_NORMALIZER)) if (t.startsWith(key)) return val;
  return null;
}

function parsePeso(s: string): number {
  const n = Number(s.replace(/\s/g, "").replace(",", ".").replace("%", ""));
  return Number.isFinite(n) ? n / 100 : 0;
}

export function normalizeHeader(h: string): string {
  return h.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[\s_\-]+/g, " ").trim();
}

/** Decodifica UTF-8 (con BOM) y si aparecen caracteres de reemplazo, latin1 (exports viejos de SAP). */
export function decodeCsv(buf: Uint8Array): string {
  const t = new TextDecoder("utf-8").decode(buf).replace(/^﻿/, "");
  return t.includes("�") ? new TextDecoder("latin1").decode(buf) : t;
}

/** CSV → { headers, rows } con comillas dobles; separador ; tab o , según la 1ª línea (igual que la app vieja). */
export function parseCsv(textRaw: string): { headers: string[]; rows: string[][] } {
  const text = textRaw.replace(/^﻿/, "").replace(/\r\n/g, "\n").trim();
  const first = text.split("\n")[0] ?? "";
  const delim = first.includes(";") ? ";" : first.includes("\t") ? "\t" : ",";
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
    } else if (ch === '"' && cell === "") q = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); out.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  row.push(cell);
  out.push(row);
  const [h = [], ...rest] = out;
  // skipEmptyLines "greedy": fuera las filas con todos los campos en blanco.
  return { headers: h.map((x) => x.trim()), rows: rest.filter((r) => r.some((c) => c.trim() !== "")).map((r) => r.map((c) => c.trim())) };
}

function picker(headers: string[]) {
  const idx = new Map<string, number>();
  headers.forEach((h, i) => idx.set(normalizeHeader(h), i));
  return (row: string[], ...cands: string[]) => {
    for (const c of cands) { const i = idx.get(normalizeHeader(c)); if (i != null) return row[i] ?? ""; }
    return "";
  };
}

/** Clasificacion-clientes-*.csv → clientes (filas sin tipología válida se descartan, como antes). */
export function parseClasificacion(text: string): ClasificacionCliente[] {
  const { headers, rows } = parseCsv(text);
  const pick = picker(headers);
  const out: ClasificacionCliente[] = [];
  for (const r of rows) {
    const tip = normTipologia(pick(r, "TIPOLOGIA"));
    if (!tip) continue;
    out.push({
      id: pick(r, "ID"),
      cliente: pick(r, "CLIENTE"),
      pesoFacturacion: parsePeso(pick(r, "PESO FACTURACION", "PESO FACTURACIÓN")),
      tipologia: tip,
      vendedor: pick(r, "VENDEDOR"),
      gerente: pick(r, "GERENCIA", "GERENTE"),
    });
  }
  return out;
}

/** Cuadros Basicos-*-hom.csv → renglones del catálogo (homólogos = toda columna que empieza con HOMOLOGO). */
export function parseCatalogo(text: string): CatalogoRow[] {
  const { headers, rows } = parseCsv(text);
  const pick = picker(headers);
  const homCols = headers.map((h, i) => (normalizeHeader(h).startsWith("homologo") ? i : -1)).filter((i) => i >= 0);
  const out: CatalogoRow[] = [];
  for (const r of rows) {
    const tipologia = normTipologia(pick(r, "TIPOLOGIA"));
    if (!tipologia) continue;
    const cb = pick(r, "CUADRO BASICO", "CUADRO BÁSICO").trim().toUpperCase();
    if (cb !== "INFALTABLE" && cb !== "ESTRATEGICO") continue;
    const categoria = pick(r, "CATEGORIA", "CATEGORÍA").trim().toUpperCase();
    if (!(CATEGORIAS as string[]).includes(categoria)) continue;
    const modelo = pick(r, "MODELO", "SKU", "MATERIAL").trim();
    if (!modelo) continue;
    out.push({
      tipologia,
      cliente: pick(r, "CLIENTE").trim() || null,
      tipo: cb as TipoCB,
      categoria: categoria as Categoria,
      modelo,
      homologos: limpiarHomologos(modelo, homCols.map((i) => r[i] ?? "")),
      orden: out.length,
    });
  }
  return out;
}

/** Sin vacíos, sin el propio modelo y sin repetidos (mismo criterio que la app vieja). */
export function limpiarHomologos(modelo: string, hs: string[]): string[] {
  const seen = new Set<string>([modelo]);
  const out: string[] = [];
  for (const h of hs) { const v = (h ?? "").trim(); if (!v || seen.has(v)) continue; seen.add(v); out.push(v); }
  return out;
}

/** Catálogo + clasificación → cuadro básico por cliente. Renglón sin cliente = se expande a la tipología. */
export function expandirCatalogo(catalogo: CatalogoRow[], clasificacion: ClasificacionCliente[]): CuadroBasicoItem[] {
  const porTip = new Map<Tipologia, string[]>();
  for (const c of clasificacion) (porTip.get(c.tipologia) ?? porTip.set(c.tipologia, []).get(c.tipologia)!).push(c.cliente);
  const out: CuadroBasicoItem[] = [];
  for (const r of [...catalogo].sort((a, b) => a.orden - b.orden)) {
    const base: Omit<CuadroBasicoItem, "cliente"> = { tipologia: r.tipologia, tipo: r.tipo, categoria: r.categoria, sku: r.modelo, skuAliases: r.homologos };
    if (r.vigente_desde || r.vigente_hasta) Object.assign(base, { desde: r.vigente_desde ?? null, hasta: r.vigente_hasta ?? null });
    if (r.cliente) out.push({ ...base, cliente: r.cliente });
    else for (const cli of porTip.get(r.tipologia) ?? []) out.push({ ...base, cliente: cli });
  }
  return out;
}

// ---------- Ingesta del Office Script (copia de cuadros-basicos/app/api/ventas/route.ts) ----------

export function normalizeFecha(raw: string | number): string {
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (/^\d{7}$/.test(s)) {
    const monthNum = Number(s.slice(4, 7));
    if (monthNum >= 1 && monthNum <= 12) return `${s.slice(0, 4)}-${String(monthNum).padStart(2, "0")}-01`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  throw new Error(`Fecha inválida: "${raw}"`);
}

function toRow(p: VentasPayloadRow, tipo: "FC" | "BO"): VentaRow {
  if (!p.cliente) throw new Error("cliente requerido");
  if (!p.sku) throw new Error("sku requerido");
  const unidades = Number(p.unidades);
  if (!Number.isFinite(unidades)) throw new Error(`unidades inválidas para ${p.sku}: ${p.unidades}`);
  const fecha = normalizeFecha(p.fecha);
  let fechaFactura: string | undefined;
  if (p.fechaFactura != null && p.fechaFactura !== "") {
    try { fechaFactura = normalizeFecha(p.fechaFactura); } catch { fechaFactura = undefined; }
  }
  return {
    documentoVentas: p.documentoVentas != null ? String(p.documentoVentas) : "",
    cliente: p.cliente,
    sku: p.sku,
    tipo,
    unidades,
    fecha,
    mes: Number(fecha.slice(5, 7)),
    vendedor: p.vendedor ?? "",
    ...(fechaFactura ? { fechaFactura } : {}),
    ...(p.canal === "FOB" ? { canal: "FOB" as const } : {}),
  };
}

/** Pares "CLIENTE_NORMALIZADO|SKU" (modelo + homólogos) → lo que el Office Script usa para pre-filtrar. */
export function paresCB(cb: CuadroBasicoItem[]): string[] {
  const set = new Set<string>();
  for (const c of cb) { const n = normalizeCliente(c.cliente); for (const s of allSkusOfCB(c)) set.add(`${n}|${s}`); }
  return [...set];
}

export interface IngestaResultado {
  rows: VentaRow[];
  received: { fc: number; bo: number };
  matchedCB: { fc: number; bo: number };
  skippedNoCB: number;
  errors: string[];
}

/** Filtra contra el CB, canoniza el cliente y normaliza fechas. Filas sucias se descartan (no abortan). */
export function procesarPayload(payload: VentasPayload, cb: CuadroBasicoItem[]): IngestaResultado {
  const canon = new Map<string, string>();
  for (const c of cb) { const n = normalizeCliente(c.cliente); for (const s of allSkusOfCB(c)) canon.set(`${n}|${s}`, c.cliente); }
  const canonicalFor = (p: VentasPayloadRow) => canon.get(`${normalizeCliente(p.cliente)}|${p.sku}`);
  const fcCB = payload.fc.filter((p) => canonicalFor(p) !== undefined);
  const boCB = payload.bo.filter((p) => canonicalFor(p) !== undefined);
  const errors: string[] = [];
  const rows: VentaRow[] = [];
  const add = (arr: VentasPayloadRow[], tipo: "FC" | "BO", tag: string) =>
    arr.forEach((p, i) => {
      try { rows.push(toRow({ ...p, cliente: canonicalFor(p)! }, tipo)); } catch (e) {
        errors.push(`${tag}[${i}]: ${e instanceof Error ? e.message : "error"}`);
      }
    });
  add(fcCB, "FC", "fc");
  add(boCB, "BO", "bo");
  return {
    rows,
    received: { fc: payload.fc.length, bo: payload.bo.length },
    matchedCB: { fc: fcCB.length, bo: boCB.length },
    skippedNoCB: payload.fc.length - fcCB.length + (payload.bo.length - boCB.length),
    errors,
  };
}

// ---------- Alcance (lo aplica el SERVER antes de mandar datos al navegador) ----------

export interface Alcance { vendedor: string | null; gerencia: string | null }

/** Vendedor → solo sus clientes; gerencia → solo los de su gerencia; ninguno → todo. Igual que /ventas (match exacto). */
export function aplicarAlcance(
  data: { cuadroBasico: CuadroBasicoItem[]; clasificacion: ClasificacionCliente[]; ventas: VentasFile },
  a: Alcance,
) {
  if (!a.vendedor && !a.gerencia) return data;
  const ok = new Set(
    data.clasificacion
      .filter((c) => (!a.vendedor || c.vendedor === a.vendedor) && (!a.gerencia || c.gerente === a.gerencia))
      .map((c) => c.cliente),
  );
  return {
    clasificacion: data.clasificacion.filter((c) => ok.has(c.cliente)),
    cuadroBasico: data.cuadroBasico.filter((c) => ok.has(c.cliente)),
    ventas: { ...data.ventas, rows: data.ventas.rows.filter((r) => ok.has(r.cliente)) },
  };
}
