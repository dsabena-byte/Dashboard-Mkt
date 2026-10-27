// "Cargar datos" de Trade: parseo PURO y client-safe de los archivos que hoy se suben al Drive
// (mismas reglas que el Apps Script "Sync Drive Tablero CB", syncCuadroBasico / syncFloorShare /
// syncReporteExistencia / syncContactos). Lo usan el navegador (vista previa) y el server (validación).
// Test: `npx tsx scripts/trade-carga.test.ts`.

export type TipoCarga = "cb" | "fs" | "u3" | "tiendas" | "exh";
export type CategoriaFs = "lavado" | "refrigeracion" | "coccion";
export const CATEGORIAS_FS: CategoriaFs[] = ["lavado", "refrigeracion", "coccion"];
export const TIPO_LABEL: Record<TipoCarga, string> = {
  cb: "Cuadro Básico semanal",
  fs: "Floor Share",
  u3: "Reporte de Existencias U3",
  tiendas: "Tiendas / promotor / supervisor",
  exh: "Exhibición de SKUs por tienda",
};

export interface FilaCb {
  tienda: string; numero_tienda: string | null; sku: string; cliente: string; division: string; categoria: string | null;
  target_cb: number; real_cb: number; target_inf: number; real_inf: number; tipo_sku: string;
}
export interface FilaFs { numero_tienda: string; nombre_tienda: string; marca: string; unidades: number; pct_raw: number | null }
export interface FilaU3 {
  id: number; fecha_captura: string | null; numero_tienda: string | null; tienda: string | null; cadena: string | null;
  formato: string | null; canal: string | null; division: string | null; categoria: string | null; subcategoria: string | null;
  marca: string | null; sku: string | null; ean: string | null; descripcion: string | null; existencia: number;
  estado: string | null; promotor: string | null; supervisor: string | null;
}
/** Reporte semanal de exhibición (ReportExhibitions): qué SKU está exhibido en qué tienda. Base de "Sugerencias de SKUs". */
export interface FilaExh {
  tienda: string; numero_tienda: string | null; cadena: string | null; formato: string | null; canal: string | null;
  division: string | null; categoria: string | null; subcategoria: string | null; marca: string | null; sku: string;
  descripcion: string | null; tipo_espacio: string | null; estatus_pdv: string | null; existencia: number; fecha_captura: string | null;
}
export interface FilaTienda {
  cadena: string; numero: string; nombre: string; segmentacion: string | null; provincia: string | null;
  localidad: string | null; promotor: string | null; supervisor: string | null;
}

// ───────────── texto / CSV ─────────────

/** Decodifica: UTF-8 y, si aparece el carácter de reemplazo, Windows-1252 (como readText del Apps Script). */
export function decodificar(buf: ArrayBuffer | Uint8Array): string {
  let t = new TextDecoder("utf-8").decode(buf);
  if (t.includes("�")) t = new TextDecoder("windows-1252").decode(buf);
  return t.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
}

export function detectarDelimitador(text: string): string {
  const first = text.split("\n")[0] ?? "";
  if (first.includes(";")) return ";";
  if (first.includes("\t")) return "\t";
  return ",";
}

/** CSV con comillas (RFC 4180 simple). */
export function parseCsv(text: string, delim = detectarDelimitador(text)): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); out.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); out.push(row); }
  return out;
}

export const normHeader = (h: string): string =>
  (h ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[\s_\-]+/g, " ").trim();

/** Clave de cadena/tienda: MAYÚSCULAS, sin acentos, espacios simples. "Chango Mas" = "CHANGO MÁS". */
export const normClave = (s: string | null | undefined): string =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

export function parseNumero(s: unknown): number | null {
  if (s == null) return null;
  let c = String(s).trim().replace(/\s/g, "").replace(/%/g, "").replace(/\$/g, "");
  if (!c) return null;
  if (c.includes(".") && c.includes(",")) c = c.replace(/\./g, "").replace(",", ".");
  else if (c.includes(",")) c = c.replace(",", ".");
  const n = Number(c);
  return Number.isFinite(n) ? n : null;
}

/** "74 - NOMBRE" → {numero:"74", nombre:"NOMBRE"}; null para filas Total. */
export function splitTienda(cell: string): { numero: string; nombre: string } | null {
  const t = (cell ?? "").trim();
  if (!t) return null;
  const u = t.toUpperCase();
  if (u === "TOTAL" || u.startsWith("TOTAL ") || u === "SUBTOTAL") return null;
  const m = t.match(/^(\d+)\s*[-–]\s*(.+)$/) ?? t.match(/^(\d+)\s+(.+)$/);
  if (m) return { numero: String(parseInt(m[1]!, 10)), nombre: m[2]!.trim() };
  return { numero: "", nombre: t };
}

export function normCategoria(s: string | null | undefined): CategoriaFs | null {
  const v = normHeader(s ?? "");
  if (v.includes("lav") || v.includes("seca")) return "lavado";
  if (v.includes("refri") || v.includes("frio") || v.includes("freez") || v.includes("helad")) return "refrigeracion";
  if (v.includes("cocc") || v.includes("cocin") || v.includes("estufa")) return "coccion";
  return null;
}

type Obj = Record<string, string>;
function aObjetos(grid: string[][]): Obj[] {
  const headers = (grid[0] ?? []).map(normHeader);
  const out: Obj[] = [];
  for (let i = 1; i < grid.length; i++) {
    const row = grid[i]!;
    if (!row.some((c) => c && c.trim())) continue;
    const o: Obj = {};
    headers.forEach((h, j) => { if (h) o[h] = (row[j] ?? "").trim(); });
    out.push(o);
  }
  return out;
}
const pick = (o: Obj, names: string[]): string => {
  for (const n of names) { const v = o[normHeader(n)]; if (v) return v; }
  return "";
};

// ───────────── detección por contenido ─────────────

const CB_HEADERS = ["targetcb", "realcb", "targetinf", "realinf", "%cumpcb", "%cumpinf", "sku mabe", "tienda hmpdv"];
/** Encabezados del CB: si aparecen como "marcas" de un Floor Share, el archivo está mal subido (caso 42-Coccion). */
export const esMarcaBasura = (m: string): boolean => {
  const v = normHeader(m).replace(/\s/g, "");
  return CB_HEADERS.some((h) => h.replace(/\s/g, "") === v) || /^%?cump/.test(v) || /^(target|real)(cb|inf)$/.test(v);
};

export function detectarTipo(grid: string[][]): { tipo: TipoCarga | null; motivo: string } {
  const h0 = (grid[0] ?? []).map(normHeader);
  const h1 = (grid[1] ?? []).map(normHeader);
  const has = (h: string[], x: string) => h.some((c) => c === x);
  if ((has(h0, "targetcb") || has(h0, "target cb")) && (has(h0, "sku mabe") || has(h0, "sku")))
    return { tipo: "cb", motivo: "tiene las columnas targetCB / SKU MABE" };
  // Antes que U3: el reporte de exhibición trae lo mismo que el U3 (ID, NO. DE TIENDA, SKU, EXISTENCIA EN EXHIBICIÓN)
  // más CÓDIGO EXHIBICIÓN y el estatus de colocación, que el U3 no tiene.
  if (has(h0, "sku") && has(h0, "codigo exhibicion"))
    return { tipo: "exh", motivo: "tiene CÓDIGO EXHIBICIÓN" };
  if (has(h0, "id") && has(h0, "sku") && h0.some((c) => c.includes("existencia")) && h0.some((c) => /no\.? de tienda|numero de tienda/.test(c)))
    return { tipo: "u3", motivo: "tiene ID, NO. DE TIENDA, SKU y EXISTENCIA" };
  if (has(h0, "promotor") && has(h0, "cadena") && h0.some((c) => c.includes("tienda") || c.includes("pdv")))
    return { tipo: "tiendas", motivo: "tiene Cadena, tienda y Promotor" };
  const filaPares = h1.some((c) => c.includes("participacion") || c === "%part" || c === "% part");
  if (filaPares && h1.some((c) => /^(tienda|pdv|punto de venta)$/.test(c)))
    return { tipo: "fs", motivo: "tiene la fila Participación Anaquel / %Part por marca" };
  return { tipo: null, motivo: "No reconozco el archivo: no tiene el formato de CB, Floor Share, Existencias U3 ni Tiendas." };
}

/** Semana / categoría / período desde el nombre del archivo (solo para prellenar; el usuario confirma). */
export function infoDesdeNombre(nombre: string): { semana: number | null; categoria: CategoriaFs | null; anio: number | null; mes: number | null } {
  const base = nombre.replace(/^.*[\\/]/, "");
  const m1 = base.match(/^(\d{4})-(\d{2})[_-](.+?)\.(?:csv|xlsx|xlsm|xls)$/i);
  if (m1) return { semana: null, categoria: normCategoria(m1[3]!), anio: Number(m1[1]), mes: Number(m1[2]) };
  const m2 = base.match(/^(\d{1,2})\s*[-_]\s*(.+?)\.(?:csv|xlsx|xlsm|xls)$/i);
  if (m2) return { semana: Number(m2[1]), categoria: normCategoria(m2[2]!), anio: null, mes: null };
  const mf = base.match(/semana[\s_-]*fiscal[\s_-]*(\d{1,2})(?!\d)/i); // "Exhibicion_Semana_Fiscal_43_Dani.xlsx"
  if (mf) return { semana: Number(mf[1]), categoria: null, anio: null, mes: null };
  const m3 = base.match(/^(\d{1,2})\.(?:csv|xlsx|xlsm|xls)$/i);
  if (m3) return { semana: Number(m3[1]), categoria: null, anio: null, mes: null };
  return { semana: null, categoria: null, anio: null, mes: null };
}

// ───────────── parsers ─────────────

export interface Parseo<T> { filas: T[]; avisos: string[]; errores: string[] }

/** CB semanal (= syncCuadroBasico): sin subtotales, real recortado a target, tipo_sku = Infaltable si targetCB == targetInf. */
export function parseCb(grid: string[][]): Parseo<FilaCb> {
  const filas: FilaCb[] = [];
  const avisos: string[] = [];
  const seen = new Map<string, number>();
  let recortes = 0;
  for (const o of aObjetos(grid)) {
    const tienda = pick(o, ["tienda hmpdv", "tienda"]);
    const sku = pick(o, ["sku mabe", "sku"]);
    if (!tienda || !sku) continue;
    const tu = tienda.toUpperCase();
    if (tu === "TOTAL" || tu.startsWith("TOTAL ") || tu === "SUBTOTAL" || sku.toUpperCase() === "TOTAL") continue;
    const targetCb = parseInt(pick(o, ["targetcb", "target cb"]), 10) || 0;
    let realCb = parseInt(pick(o, ["realcb", "real cb"]), 10) || 0;
    const targetInf = parseInt(pick(o, ["targetinf", "target inf"]), 10) || 0;
    let realInf = parseInt(pick(o, ["realinf", "real inf"]), 10) || 0;
    if (targetCb === 0 && targetInf === 0) continue;
    if (realCb > targetCb) { realCb = targetCb; recortes++; }
    if (realInf > targetInf) { realInf = targetInf; recortes++; }
    const cat = pick(o, ["categoria"]);
    const f: FilaCb = {
      tienda, numero_tienda: splitTienda(tienda)?.numero || null, sku,
      cliente: pick(o, ["cliente/cadena", "cliente cadena", "cliente"]), division: pick(o, ["division"]),
      categoria: cat && cat.toUpperCase() !== "TOTAL" ? cat : null,
      target_cb: targetCb, real_cb: realCb, target_inf: targetInf, real_inf: realInf,
      tipo_sku: targetCb - targetInf === 0 ? "Infaltable" : "Estratégico",
    };
    const k = `${tienda}|${sku}`;
    const prev = seen.get(k);
    if (prev != null) filas[prev] = f; else { seen.set(k, filas.length); filas.push(f); }
  }
  if (recortes) avisos.push(`${recortes} valores "real" mayores al "target" se recortaron al target (igual que hoy).`);
  const errores = filas.length ? [] : ["El archivo no tiene filas de detalle (tienda × SKU)."];
  return { filas, avisos, errores };
}

/** Floor Share (= syncFloorShare): formato ancho de Power BI, viejo (UTF-8 ",", con Formato) y nuevo (Win-1252 ";"). */
export function parseFs(grid: string[][]): Parseo<FilaFs> {
  const errores: string[] = [];
  if (grid.length < 3) return { filas: [], avisos: [], errores: ["El archivo está vacío."] };
  const marcasH = (grid[0] ?? []).map((c) => (c ?? "").trim());
  const colsH = (grid[1] ?? []).map((c) => normHeader(c ?? ""));
  let storeCol = colsH.findIndex((c) => /^(tienda|pdv|punto de venta)$/.test(c));
  if (storeCol < 0) storeCol = 0;
  const pares: { marca: string; u: number; p: number }[] = [];
  for (let col = storeCol + 1; col < marcasH.length; col += 2) {
    const marca = (marcasH[col] || marcasH[col + 1] || "").trim();
    if (!marca || /^total$/i.test(marca)) continue;
    pares.push({ marca, u: col, p: col + 1 });
  }
  const basura = pares.filter((x) => esMarcaBasura(x.marca));
  if (basura.length) errores.push(`Esto no es un Floor Share: las "marcas" son columnas del Cuadro Básico (${basura.map((b) => b.marca).slice(0, 3).join(", ")}). ¿Subiste el CB en lugar del FS?`);
  const filas: FilaFs[] = [];
  const seen = new Map<string, number>();
  for (let i = 2; i < grid.length; i++) {
    const row = grid[i]!;
    if (row.length <= storeCol) continue;
    const st = splitTienda(row[storeCol] ?? "");
    if (!st || !st.nombre || /^total\b/i.test(st.nombre)) continue;
    for (const par of pares) {
      if (esMarcaBasura(par.marca)) continue;
      const u = parseNumero(row[par.u]) ?? 0;
      if (u <= 0) continue;
      const f: FilaFs = { numero_tienda: st.numero, nombre_tienda: st.nombre, marca: par.marca, unidades: Math.round(u), pct_raw: parseNumero(row[par.p]) };
      const k = `${f.numero_tienda}|${f.nombre_tienda}|${f.marca}`;
      const prev = seen.get(k);
      if (prev != null) filas[prev] = f; else { seen.set(k, filas.length); filas.push(f); }
    }
  }
  if (!filas.length && !errores.length) errores.push("No encontré tiendas con unidades en el archivo.");
  return { filas, avisos: [], errores };
}

/** Existencias U3 (= syncReporteExistencia) + EAN, razón social, promotor y supervisor (antes se descartaban). */
export function parseU3(grid: string[][]): Parseo<FilaU3> {
  const headers = (grid[0] ?? []).map((h) => (h ?? "").trim());
  const idx = (...res: RegExp[]) => { for (const re of res) { const i = headers.findIndex((h) => re.test(h)); if (i >= 0) return i; } return -1; };
  const iId = idx(/^id$/i), iCad = idx(/^cadena$/i), iNum = idx(/no\.?\s*de\s*tienda/i, /numero\s*de\s*tienda/i), iTi = idx(/^tienda$/i);
  const iCanal = idx(/^canal$/i), iDiv = idx(/^divisi/i), iCat = idx(/^categor/i), iSub = idx(/subcategor/i), iMarca = idx(/^marca$/i);
  const iSku = idx(/^sku$/i), iDesc = idx(/descripci/i), iEx = idx(/existencia/i), iEst = idx(/^estado$/i);
  const iFecha = idx(/fecha\s*de\s*captura/i, /^fecha$/i), iEan = idx(/c[oó]digo\s*de\s*barras/i, /^ean$/i), iFormato = idx(/^formato$/i);
  const iProm = idx(/^promotor$/i), iSup = idx(/^supervisor$/i);
  if (iId < 0 || iNum < 0 || iSku < 0) return { filas: [], avisos: [], errores: ["Faltan columnas críticas (ID / NO. DE TIENDA / SKU)."] };
  const fecha = (s: string | undefined) => {
    const m = (s ?? "").trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (!m) return null;
    const y = Number(m[3]) < 100 ? Number(m[3]) + 2000 : Number(m[3]);
    return `${y}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  };
  const byId = new Map<number, FilaU3>();
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r]!;
    const id = parseInt(row[iId] ?? "", 10);
    if (!Number.isFinite(id)) continue;
    const c = (i: number) => (i >= 0 ? (row[i] ?? "").trim() || null : null);
    byId.set(id, {
      id, fecha_captura: fecha(row[iFecha]), numero_tienda: c(iNum), tienda: c(iTi), cadena: c(iCad), formato: c(iFormato),
      canal: c(iCanal), division: c(iDiv), categoria: c(iCat), subcategoria: c(iSub), marca: c(iMarca), sku: c(iSku),
      ean: c(iEan), descripcion: c(iDesc), existencia: parseInt(row[iEx] ?? "", 10) || 0, estado: c(iEst),
      promotor: c(iProm), supervisor: c(iSup),
    });
  }
  const filas = [...byId.values()];
  return { filas, avisos: [], errores: filas.length ? [] : ["Sin filas válidas."] };
}

/** Exhibición de SKUs por tienda: una fila por exhibición (tienda × SKU × espacio), tal cual el reporte. */
export function parseExh(grid: string[][]): Parseo<FilaExh> {
  const headers = (grid[0] ?? []).map((h) => normHeader(h ?? ""));
  const idx = (...res: RegExp[]) => { for (const re of res) { const i = headers.findIndex((h) => re.test(h)); if (i >= 0) return i; } return -1; };
  const iTi = idx(/^tienda$/), iNum = idx(/no\.? de tienda/, /numero de tienda/), iCad = idx(/^cadena$/), iFor = idx(/^formato$/), iCanal = idx(/^canal$/);
  const iDiv = idx(/^division$/), iCat = idx(/^categoria$/), iSub = idx(/^subcategoria$/), iMarca = idx(/^marca$/), iSku = idx(/^sku$/);
  const iDesc = idx(/^descripcion/), iEsp = idx(/^tipo de espacio$/), iEst = idx(/^estatus de colocacion pdv$/), iEx = idx(/existencia/);
  const iFecha = idx(/^fecha de captura$/);
  if (iTi < 0 || iSku < 0) return { filas: [], avisos: [], errores: ["Faltan columnas críticas (TIENDA / SKU)."] };
  const fecha = (s: string | undefined) => {
    const m = (s ?? "").trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (!m) return null;
    const y = Number(m[3]) < 100 ? Number(m[3]) + 2000 : Number(m[3]);
    return `${y}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  };
  const filas: FilaExh[] = [];
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r]!;
    const c = (i: number) => (i >= 0 ? (row[i] ?? "").trim() || null : null);
    const tienda = c(iTi), sku = c(iSku);
    if (!tienda || !sku) continue;
    filas.push({
      tienda, numero_tienda: c(iNum) ?? splitTienda(tienda)?.numero ?? null, cadena: c(iCad), formato: c(iFor), canal: c(iCanal),
      division: c(iDiv), categoria: c(iCat), subcategoria: c(iSub), marca: c(iMarca), sku, descripcion: c(iDesc),
      tipo_espacio: c(iEsp), estatus_pdv: c(iEst), existencia: parseInt(row[iEx] ?? "", 10) || 0, fecha_captura: fecha(row[iFecha]),
    });
  }
  return { filas, avisos: [], errores: filas.length ? [] : ["Sin filas válidas."] };
}

/** Tienda-promotor-supervisor (= syncContactos) + segmentación, provincia, localidad. */
export function parseTiendas(grid: string[][]): Parseo<FilaTienda> {
  const filas: FilaTienda[] = [];
  const seen = new Set<string>();
  for (const o of aObjetos(grid)) {
    const comb = pick(o, ["nombre de la tienda", "tienda hmpdv", "tienda nro nombre", "tienda numero y nombre"]);
    const st = comb ? splitTienda(comb) : null;
    const numero = st?.numero || pick(o, ["n tienda", "numero tienda", "nro tienda", "numero", "nro"]);
    const nombre = pick(o, ["nombre pdv"]) || st?.nombre || pick(o, ["nombre tienda", "tienda", "pdv", "nombre"]);
    if (!numero || !nombre) continue;
    const cadena = pick(o, ["cadena", "cliente/cadena", "cliente"]);
    const k = `${normClave(cadena)}|${numero}`;
    if (seen.has(k)) continue;
    seen.add(k);
    filas.push({
      cadena, numero, nombre,
      segmentacion: pick(o, ["segmentacion", "segmetacion"]) || null,
      provincia: pick(o, ["provincia"]) || null, localidad: pick(o, ["localidad"]) || null,
      promotor: pick(o, ["promotor"]) || null, supervisor: pick(o, ["supervisor"]) || null,
    });
  }
  return { filas, avisos: [], errores: filas.length ? [] : ["No encontré tiendas en el archivo."] };
}

export function parsear(tipo: TipoCarga, grid: string[][]): Parseo<FilaCb | FilaFs | FilaU3 | FilaTienda | FilaExh> {
  return tipo === "cb" ? parseCb(grid) : tipo === "fs" ? parseFs(grid) : tipo === "u3" ? parseU3(grid) : tipo === "exh" ? parseExh(grid) : parseTiendas(grid);
}

// ───────────── vista previa contra los maestros ─────────────

export interface MaestrosResumen {
  /** claves de cadena conocidas (clave + alias) → clave canónica */
  cadenas: Record<string, string>;
  /** "CLAVE_CADENA|numero" de tiendas conocidas */
  tiendas: string[];
  /** números de tienda conocidos (para FS, que no trae cadena) */
  numeros: string[];
  skus: string[];
}

export interface Resumen {
  filas: number; tiendas: number; skus: number; cadenas: number; marcas: number;
  nuevasCadenas: string[]; nuevasTiendas: string[]; nuevosSkus: string[];
}

export function resumir(tipo: TipoCarga, filas: unknown[], m: MaestrosResumen | null): Resumen {
  const tiendas = new Set<string>(), skus = new Set<string>(), cadenas = new Set<string>(), marcas = new Set<string>();
  const nC = new Set<string>(), nT = new Set<string>(), nS = new Set<string>();
  const known = { t: new Set(m?.tiendas ?? []), n: new Set(m?.numeros ?? []), s: new Set(m?.skus ?? []) };
  for (const f0 of filas) {
    if (tipo === "cb") {
      const f = f0 as FilaCb;
      tiendas.add(f.tienda); skus.add(f.sku); if (f.cliente) cadenas.add(f.cliente);
      if (m) {
        const cc = m.cadenas[normClave(f.cliente)];
        if (f.cliente && !cc) nC.add(f.cliente);
        if (f.numero_tienda && !known.t.has(`${cc ?? normClave(f.cliente)}|${f.numero_tienda}`)) nT.add(f.tienda);
        if (!known.s.has(f.sku)) nS.add(f.sku);
      }
    } else if (tipo === "fs") {
      const f = f0 as FilaFs;
      tiendas.add(`${f.numero_tienda} - ${f.nombre_tienda}`); marcas.add(f.marca);
      if (m && f.numero_tienda && !known.n.has(f.numero_tienda)) nT.add(`${f.numero_tienda} - ${f.nombre_tienda}`);
    } else if (tipo === "exh") {
      const f = f0 as FilaExh;
      tiendas.add(f.tienda); skus.add(f.sku); if (f.cadena) cadenas.add(f.cadena); if (f.marca) marcas.add(f.marca);
    } else if (tipo === "u3") {
      const f = f0 as FilaU3;
      if (f.numero_tienda) tiendas.add(`${f.cadena ?? ""}|${f.numero_tienda}`);
      if (f.sku) skus.add(f.sku); if (f.cadena) cadenas.add(f.cadena); if (f.marca) marcas.add(f.marca);
      if (m) {
        const cc = m.cadenas[normClave(f.cadena)];
        if (f.cadena && !cc) nC.add(f.cadena);
        if (f.sku && !known.s.has(f.sku)) nS.add(f.sku);
      }
    } else {
      const f = f0 as FilaTienda;
      tiendas.add(`${f.cadena}|${f.numero}`); cadenas.add(f.cadena);
      if (m) {
        const cc = m.cadenas[normClave(f.cadena)];
        if (f.cadena && !cc) nC.add(f.cadena);
        if (!known.t.has(`${cc ?? normClave(f.cadena)}|${f.numero}`)) nT.add(`${f.numero} - ${f.nombre}`);
      }
    }
  }
  const s = (x: Set<string>) => [...x].sort();
  return {
    filas: filas.length, tiendas: tiendas.size, skus: skus.size, cadenas: cadenas.size, marcas: marcas.size,
    nuevasCadenas: s(nC), nuevasTiendas: s(nT), nuevosSkus: s(nS),
  };
}

// ───────────── validación del lado del server (frontera de confianza) ─────────────

const txt = (v: unknown, max = 300): v is string => typeof v === "string" && v.length <= max;
const txtN = (v: unknown, max = 300) => v == null || txt(v, max);
const ent = (v: unknown, min = 0, max = 1_000_000) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/** null = fila válida; si no, el motivo. */
export function validarFila(tipo: TipoCarga, f: unknown): string | null {
  if (!f || typeof f !== "object") return "fila vacía";
  const o = f as Record<string, unknown>;
  if (tipo === "cb") {
    if (!txt(o.tienda) || !o.tienda || !txt(o.sku, 80) || !o.sku) return "falta tienda o SKU";
    if (!txtN(o.cliente) || !txtN(o.division) || !txtN(o.categoria) || !txtN(o.numero_tienda, 20)) return "texto inválido";
    if (!ent(o.target_cb, 0, 100) || !ent(o.real_cb, 0, 100) || !ent(o.target_inf, 0, 100) || !ent(o.real_inf, 0, 100)) return "target/real inválido";
    if ((o.real_cb as number) > (o.target_cb as number) || (o.real_inf as number) > (o.target_inf as number)) return "real mayor al target";
    if (o.tipo_sku !== "Infaltable" && o.tipo_sku !== "Estratégico") return "tipo_sku inválido";
    return null;
  }
  if (tipo === "fs") {
    if (!txt(o.numero_tienda, 20) || !txt(o.nombre_tienda) || !txt(o.marca, 120) || !o.marca) return "falta tienda o marca";
    if (esMarcaBasura(o.marca as string)) return "marca inválida (columna del CB)";
    if (!ent(o.unidades, 1)) return "unidades inválidas";
    if (o.pct_raw != null && (typeof o.pct_raw !== "number" || !Number.isFinite(o.pct_raw))) return "% inválido";
    return null;
  }
  if (tipo === "exh") {
    if (!txt(o.tienda) || !o.tienda || !txt(o.sku, 80) || !o.sku) return "falta tienda o SKU";
    for (const k of ["numero_tienda", "cadena", "formato", "canal", "division", "categoria", "subcategoria", "marca", "descripcion", "tipo_espacio", "estatus_pdv"]) {
      if (!txtN(o[k])) return `${k} inválido`;
    }
    if (o.fecha_captura != null && !(typeof o.fecha_captura === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.fecha_captura))) return "fecha inválida";
    if (!ent(o.existencia, 0)) return "existencia inválida";
    return null;
  }
  if (tipo === "u3") {
    if (!ent(o.id, 0, Number.MAX_SAFE_INTEGER)) return "ID inválido";
    for (const k of ["numero_tienda", "tienda", "cadena", "formato", "canal", "division", "categoria", "subcategoria", "marca", "sku", "ean", "descripcion", "estado", "promotor", "supervisor"]) {
      if (!txtN(o[k])) return `${k} inválido`;
    }
    if (o.fecha_captura != null && !(typeof o.fecha_captura === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.fecha_captura))) return "fecha inválida";
    if (!ent(o.existencia, -1_000_000)) return "existencia inválida";
    return null;
  }
  if (!txt(o.cadena) || !txt(o.numero, 20) || !o.numero || !txt(o.nombre) || !o.nombre) return "falta cadena, número o nombre";
  for (const k of ["segmentacion", "provincia", "localidad", "promotor", "supervisor"]) if (!txtN(o[k], 120)) return `${k} inválido`;
  return null;
}

// ───────────── qué falta cargar ─────────────

export interface Cargado { anio: number; semana: number; tipo: "cb" | "fs"; categoria: string | null; filas: number }
export interface Faltante { anio: number; semana: number; falta: string[] }

/** Semanas (entre la primera y la última cargada del año) sin CB o sin alguna categoría de FS. */
export function faltantes(cargado: Cargado[]): Faltante[] {
  const porAnio = new Map<number, Cargado[]>();
  for (const c of cargado) porAnio.set(c.anio, [...(porAnio.get(c.anio) ?? []), c]);
  const out: Faltante[] = [];
  for (const [anio, cs] of porAnio) {
    const sems = cs.map((c) => c.semana);
    const min = Math.min(...sems), max = Math.max(...sems);
    for (let s = min; s <= max; s++) {
      const de = cs.filter((c) => c.semana === s && c.filas > 0);
      const falta: string[] = [];
      if (!de.some((c) => c.tipo === "cb")) falta.push("Cuadro Básico");
      for (const cat of CATEGORIAS_FS) if (!de.some((c) => c.tipo === "fs" && c.categoria === cat)) falta.push(`Floor Share ${CAT_LABEL[cat]}`);
      if (falta.length) out.push({ anio, semana: s, falta });
    }
  }
  return out.sort((a, b) => b.anio - a.anio || b.semana - a.semana);
}
export const CAT_LABEL: Record<CategoriaFs, string> = { lavado: "Lavado", refrigeracion: "Refrigeración", coccion: "Cocción" };
