// Presupuesto de Marketing cargado desde el tablero (migración 0125). Lógica PURA y client-safe:
// la usan el server (importación, API), la pantalla /funnel/carga y el test scripts/presupuesto.test.ts.
// Reglas: todo en pesos; USD = $ ÷ tipo de cambio del mes de la versión (lo pasa finanzas).

export const MESES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
] as const;

export type TipoVersion = "BGT" | "4+8" | "8+4" | "REAL" | "OTRO";

export interface Version { nombre: string; tipo: TipoVersion; anio: number; cerrada: boolean }
export interface Tc { version: string; mes: number; tc: number }

/** Renglón de gasto / presupuesto tal como se guarda en bgt_lineas (sin metadatos). */
export interface LineaIn {
  version: string;
  mes: number; // 1..12
  ceco: string;
  cuenta: string;
  nombre_cta: string;
  concepto: string;
  nro_proveedor: string | null;
  proveedor: string | null;
  detalle: string | null;
  solped: string | null;
  oc: string | null;
  nro_recepcion: string | null;
  nro_doc_contable: string | null;
  fecha_contabilizacion: string | null; // YYYY-MM-DD
  factura: string | null;
  provision: "SI" | "NO" | null;
  ars: number;
}
export interface Linea extends LineaIn {
  id: string;
  origen: "import" | "manual" | "copia";
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
export const normTxt = (v: unknown) => sinAcentos(String(v ?? "")).toUpperCase().replace(/\s+/g, " ").trim();

/** "BGT 2026" → {BGT, 2026}; "BGT 2024 CRISIS" → {OTRO, 2024}; sin año → null. */
export function tipoDeVersion(nombre: string): { tipo: TipoVersion; anio: number } | null {
  const n = normTxt(nombre);
  const y = n.match(/\b(20\d{2})\b/);
  if (!y) return null;
  const anio = Number(y[1]);
  const m = n.match(/^(BGT|4\+8|8\+4|REAL) (20\d{2})$/);
  return { tipo: m ? (m[1] as TipoVersion) : "OTRO", anio };
}

/** Mes desde "ENERO" / "Enero" / 1..12 → 1..12 (null si no se entiende). */
export function parseMes(v: unknown): number | null {
  if (typeof v === "number") return Number.isInteger(v) && v >= 1 && v <= 12 ? v : null;
  const t = normTxt(v);
  if (/^\d{1,2}$/.test(t)) return parseMes(Number(t));
  const i = MESES.findIndex((m) => m === t || (t.length >= 3 && m.startsWith(t)) || (t === "SETIEMBRE" && m === "SEPTIEMBRE"));
  return i >= 0 ? i + 1 : null;
}

/** Monto en pesos: número, "$ 1.810.000", "23.217.600,00", "-5.000". null si no es un número. */
export function parseMonto(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").replace(/[$\s]|ARS/gi, "").trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");          // es-AR: 1.234,56
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");      // 1.810.000
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

/** Fecha: serial de Excel, "dd/mm/aaaa" o "aaaa-mm-dd" → "aaaa-mm-dd". null si no es una fecha. */
export function parseFecha(v: unknown): string | null {
  const iso = (y: number, m: number, d: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
      ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
  };
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    if (v < 20000 || v > 80000) return null; // serial de Excel entre 1954 y 2119
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
    return dt.toISOString().slice(0, 10);
  }
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) { const y = Number(m[3]); return iso(y < 100 ? 2000 + y : y, Number(m[2]), Number(m[1])); }
  return null;
}

const txt = (v: unknown): string | null => {
  if (v == null) return null;
  const s = (typeof v === "number" ? String(v) : String(v)).replace(/\s+/g, " ").trim();
  return s ? s : null;
};

// Encabezados de la planilla "Planilla carga BGT - Facturas" (y del pegado desde Excel) → campo.
type Campo = keyof LineaIn | "anio" | "fecha_o_doc" | "usd";
const ENCABEZADOS: [RegExp, Campo][] = [
  [/^PRESUPUESTO$/, "version"],
  [/^CECO$/, "ceco"],
  [/^CUENTA$/, "cuenta"],
  [/^NOMBRE CTA|^NOMBRE CUENTA/, "nombre_cta"],
  [/^ANO$/, "anio"],
  [/^MES$/, "mes"],
  [/^CONCEPTO$/, "concepto"],
  [/^(NRO|N°|NUMERO) ?PROV/, "nro_proveedor"],
  [/^PROVEEDOR$/, "proveedor"],
  [/^DETALLE/, "detalle"],
  [/^SOLPED$/, "solped"],
  [/^OC$|^ORDEN DE COMPRA/, "oc"],
  [/RECEPCI/, "nro_recepcion"],
  [/^FECHA CONTAB/, "fecha_o_doc"],
  [/DOC\.? CONTABLE/, "nro_doc_contable"],
  [/^FACTURA$/, "factura"],
  [/^\$$|^PESOS$|^MONTO/, "ars"],
  [/^USD$/, "usd"],
  [/^PROVISION$/, "provision"],
];
// Orden de columnas de la planilla (para pegar SIN la fila de títulos).
const ORDEN_PLANILLA: Campo[] = [
  "version", "ceco", "cuenta", "nombre_cta", "anio", "mes", "concepto", "nro_proveedor", "proveedor", "detalle",
  "solped", "oc", "nro_recepcion", "fecha_o_doc", "factura", "ars", "usd", "provision",
];

export interface ParseResult {
  lineas: LineaIn[];
  errores: { fila: number; error: string }[]; // fila = número de fila de la planilla (1 = primera)
  omitidas: number; // filas vacías o sin monto
}

function mapaColumnas(aoa: unknown[][]): { header: number; cols: Map<Campo, number> } | null {
  for (let r = 0; r < Math.min(aoa.length, 15); r++) {
    const cols = new Map<Campo, number>();
    (aoa[r] ?? []).forEach((c, i) => {
      const h = normTxt(c);
      if (!h) return;
      const hit = ENCABEZADOS.find(([re]) => re.test(h));
      if (hit && !cols.has(hit[1])) cols.set(hit[1], i);
    });
    if (cols.has("version") && cols.has("ars") && cols.has("mes")) return { header: r, cols };
  }
  return null;
}

/**
 * Filas de una planilla (array de arrays, como sheet_to_json header:1 o un pegado TSV) → renglones.
 * Con fila de títulos usa los títulos; sin títulos asume el orden de la planilla de Seguimiento
 * (con o sin la columna clave de la izquierda). Los USD de la planilla se IGNORAN.
 * `versionPorDefecto` = la versión elegida en pantalla (si la columna PRESUPUESTO viene vacía).
 */
export function parsePlanilla(aoa: unknown[][], opts: { versionPorDefecto?: string } = {}): ParseResult {
  let start = 0;
  let cols: Map<Campo, number>;
  const m = mapaColumnas(aoa);
  if (m) { start = m.header + 1; cols = m.cols; }
  else {
    const first = aoa.find((r) => r && r.some((c) => txt(c)));
    const off = first && !tipoDeVersion(String(first[0] ?? "")) && tipoDeVersion(String(first[1] ?? "")) ? 1 : 0;
    cols = new Map(ORDEN_PLANILLA.map((c, i) => [c, i + off] as [Campo, number]));
  }
  const get = (row: unknown[], c: Campo) => { const i = cols.get(c); return i == null ? undefined : row[i]; };

  const out: ParseResult = { lineas: [], errores: [], omitidas: 0 };
  for (let r = start; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    if (!row.some((c) => txt(c))) { out.omitidas++; continue; }
    const version = txt(get(row, "version")) ?? opts.versionPorDefecto ?? "";
    const montoRaw = get(row, "ars");
    const ars = parseMonto(montoRaw);
    if (ars == null) {
      if (txt(montoRaw) == null) { out.omitidas++; continue; } // sin monto (filas vacías de la planilla)
      out.errores.push({ fila: r + 1, error: `Monto "${String(montoRaw)}" no es un número` });
      continue;
    }
    const v = tipoDeVersion(version);
    if (!v) { out.errores.push({ fila: r + 1, error: `Presupuesto "${version}" no tiene año (ej. "REAL 2026")` }); continue; }
    const mes = parseMes(get(row, "mes"));
    if (!mes) { out.errores.push({ fila: r + 1, error: `Mes "${String(get(row, "mes") ?? "")}" no se entiende` }); continue; }
    const anio = get(row, "anio");
    if (anio != null && txt(anio) && Number(anio) !== v.anio) {
      out.errores.push({ fila: r + 1, error: `El año ${String(anio)} no coincide con ${version}` });
      continue;
    }
    // La columna "FECHA CONTABILIZ" de la planilla vieja mezcla fechas, números de documento (5100010974)
    // y notas ("se anuló línea con NC"): fecha → fecha; número → nro doc. contable; texto → al detalle.
    const fd = get(row, "fecha_o_doc");
    const fecha = parseFecha(fd);
    const fdTxt = fecha ? null : txt(fd);
    const doc = fdTxt && /^\d{5,}$/.test(fdTxt) ? fdTxt : null;
    const nota = fdTxt && !doc && /[a-z0-9]/i.test(fdTxt) ? fdTxt : null;
    const detalle = txt(get(row, "detalle"));
    const prov = normTxt(get(row, "provision"));
    out.lineas.push({
      version: version.replace(/\s+/g, " ").trim(),
      mes,
      ceco: txt(get(row, "ceco")) ?? "",
      cuenta: txt(get(row, "cuenta")) ?? "",
      nombre_cta: txt(get(row, "nombre_cta")) ?? "",
      concepto: txt(get(row, "concepto")) ?? "",
      nro_proveedor: txt(get(row, "nro_proveedor")),
      proveedor: txt(get(row, "proveedor")),
      detalle: nota ? (detalle ? `${detalle} · Nota: ${nota}` : `Nota: ${nota}`) : detalle,
      solped: txt(get(row, "solped")),
      oc: txt(get(row, "oc")),
      nro_recepcion: txt(get(row, "nro_recepcion")),
      nro_doc_contable: txt(get(row, "nro_doc_contable")) ?? doc,
      fecha_contabilizacion: fecha,
      factura: txt(get(row, "factura")),
      provision: prov === "SI" || prov === "NO" ? prov : null,
      ars,
    });
  }
  return out;
}

/** Plantilla de tipos de cambio: fila de títulos "MES | <versión> | <versión>…" y una fila por mes. */
export function parseTcPlantilla(aoa: unknown[][]): { tcs: Tc[]; errores: string[] } {
  const errores: string[] = [];
  const h = aoa.findIndex((r) => normTxt(r?.[0]) === "MES");
  if (h < 0) return { tcs: [], errores: ['No encontré la fila de títulos ("MES" en la primera columna).'] };
  const versiones = (aoa[h] ?? []).map((c) => txt(c));
  const tcs: Tc[] = [];
  for (let r = h + 1; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    const mes = parseMes(row[0]);
    if (!mes) { if (txt(row[0])) errores.push(`Fila ${r + 1}: mes "${String(row[0])}" no se entiende`); continue; }
    for (let c = 1; c < versiones.length; c++) {
      const version = versiones[c];
      if (!version || txt(row[c]) == null) continue;
      const tc = parseMonto(row[c]);
      if (tc == null || tc <= 0) { errores.push(`${version} ${MESES[mes - 1]}: "${String(row[c])}" no es un tipo de cambio válido`); continue; }
      if (!tipoDeVersion(version)) { errores.push(`Columna "${version}": falta el año`); continue; }
      tcs.push({ version, mes, tc });
    }
  }
  return { tcs, errores };
}

/** Validación de un renglón antes de guardarlo (alta/edición desde la pantalla). */
export function validarLinea(l: Partial<LineaIn>, versiones: Version[]): string | null {
  const v = versiones.find((x) => x.nombre === l.version);
  if (!v) return "Elegí el presupuesto (versión).";
  if (v.cerrada) return `${v.nombre} está cerrada: no se puede modificar.`;
  if (!l.mes || l.mes < 1 || l.mes > 12) return "Elegí el mes.";
  if (!l.cuenta && !l.nombre_cta) return "Elegí la cuenta.";
  if (!l.concepto) return "Elegí el concepto.";
  const validos = l.cuenta ? CUENTA_CONCEPTOS[l.cuenta] : undefined;
  if (validos && !validos.includes(l.concepto)) return `El concepto ${l.concepto} no corresponde a la cuenta ${l.cuenta} (${validos.join(", ")}).`;
  if (typeof l.ars !== "number" || !Number.isFinite(l.ars) || l.ars === 0) return "Cargá el monto en pesos.";
  if (l.fecha_contabilizacion && !parseFecha(l.fecha_contabilizacion)) return "La fecha de contabilización no es válida.";
  return null;
}

/** Posible duplicado: misma versión, misma factura, mismo proveedor y mismo monto. */
export function claveDuplicado(l: Pick<LineaIn, "version" | "factura" | "nro_proveedor" | "proveedor" | "ars">): string | null {
  if (!l.factura) return null;
  return [l.version, normTxt(l.factura), normTxt(l.nro_proveedor ?? l.proveedor ?? ""), Math.round(l.ars * 100)].join("|");
}

export const usd = (ars: number, tc: number | undefined) => (tc && tc > 0 ? ars / tc : null);

/** Fila agregada con la forma que usa el tablero /funnel (BgtRow de bgt-queries). */
export interface FilaAgregada { presupuesto: string; cuenta: string; anio: string; mes: string; concepto: string; ars: number; usd: number }

/**
 * Renglones → filas del tablero (suma por versión × mes × cuenta × concepto). USD con el TC de la
 * versión y el mes; sin TC → usd 0 y el (versión, mes) va a `faltaTc`.
 */
export function agregarParaTablero(
  lineas: Pick<LineaIn, "version" | "mes" | "nombre_cta" | "concepto" | "ars">[],
  versiones: Pick<Version, "nombre" | "anio">[],
  tcs: Tc[],
): { rows: FilaAgregada[]; faltaTc: { version: string; mes: number }[] } {
  const anio = new Map(versiones.map((v) => [v.nombre, v.anio]));
  const tc = new Map(tcs.map((t) => [`${t.version}|${t.mes}`, t.tc]));
  const acc = new Map<string, FilaAgregada>();
  const falta = new Set<string>();
  for (const l of lineas) {
    const k = `${l.version}|${l.mes}|${l.nombre_cta}|${l.concepto}`;
    let f = acc.get(k);
    if (!f) {
      f = { presupuesto: l.version, cuenta: l.nombre_cta, anio: String(anio.get(l.version) ?? ""), mes: MESES[l.mes - 1] ?? "", concepto: l.concepto, ars: 0, usd: 0 };
      acc.set(k, f);
    }
    f.ars += l.ars;
    const t = tc.get(`${l.version}|${l.mes}`);
    if (t) f.usd += l.ars / t; else falta.add(`${l.version}|${l.mes}`);
  }
  const faltaTc = [...falta].map((k) => { const [version, mes] = k.split("|"); return { version: version!, mes: Number(mes) }; })
    .sort((a, b) => a.version.localeCompare(b.version) || a.mes - b.mes);
  return { rows: [...acc.values()], faltaTc };
}

/** Totales en $ por versión (para el control de la importación contra la planilla / el tablero viejo). */
export function totalesPorVersion(lineas: Pick<LineaIn, "version" | "ars">[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const l of lineas) t[l.version] = (t[l.version] ?? 0) + l.ars;
  return t;
}

/** Diferencias entre dos objetos (para el historial: solo los campos que cambiaron). */
export function camposCambiados<T extends object>(antes: T, despues: Partial<T>): Partial<Record<keyof T, { antes: unknown; despues: unknown }>> {
  const out: Partial<Record<keyof T, { antes: unknown; despues: unknown }>> = {};
  for (const k of Object.keys(despues) as (keyof T)[]) {
    const a = antes[k] ?? null, d = despues[k] ?? null;
    if (String(a) !== String(d)) out[k] = { antes: a, despues: d };
  }
  return out;
}

export interface ItemCatalogo { tipo: "cuenta" | "concepto" | "proveedor" | "ceco"; clave: string; nombre: string }

/**
 * Catálogo (listas de la carga): hoja "Menu Desplegable" de la planilla (si viene) + lo que aparece en los
 * renglones. Cuenta = código → nombre; proveedor = nro → nombre; CECO = código → nombre; concepto = nombre.
 */
export function armarCatalogo(menu: unknown[][] | null, lineas: LineaIn[]): ItemCatalogo[] {
  const out = new Map<string, ItemCatalogo>();
  const put = (tipo: ItemCatalogo["tipo"], clave: string | null, nombre: string | null) => {
    const c = (clave ?? "").trim();
    if (!c) return;
    const k = `${tipo}|${c}`;
    const prev = out.get(k);
    if (!prev || (!prev.nombre && nombre)) out.set(k, { tipo, clave: c, nombre: (nombre ?? "").trim() });
  };
  if (menu) {
    const h = menu.findIndex((r) => (r ?? []).some((c) => normTxt(c) === "NOMBRE CTA"));
    if (h >= 0) {
      const head = (menu[h] ?? []).map(normTxt);
      const idx = (name: string, nth = 0) => head.reduce<number[]>((a, c, i) => (c === name ? [...a, i] : a), [])[nth] ?? -1;
      const iCta = idx("CUENTA"), iNom = idx("NOMBRE CTA"), iProv = idx("PROVEEDOR"), iNro = idx("NRO PROVEEDOR");
      const iCon = idx("CONCEPTO"), iCeco = idx("CECO"), iCecoN = idx("CECO", 1);
      for (const r of menu.slice(h + 1)) {
        if (!r) continue;
        if (iCta >= 0) put("cuenta", txt(r[iCta]), txt(r[iNom]));
        if (iNro >= 0) put("proveedor", txt(r[iNro]), txt(r[iProv]));
        if (iCon >= 0) put("concepto", txt(r[iCon]), txt(r[iCon]));
        if (iCeco >= 0) put("ceco", txt(r[iCeco]), iCecoN >= 0 ? txt(r[iCecoN]) : null);
      }
    }
  }
  for (const l of lineas) {
    put("cuenta", l.cuenta || null, l.nombre_cta || null);
    put("concepto", l.concepto || null, l.concepto || null);
    put("ceco", l.ceco || null, null);
    if (l.nro_proveedor) put("proveedor", l.nro_proveedor, l.proveedor);
  }
  return [...out.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.nombre.localeCompare(b.nombre) || a.clave.localeCompare(b.clave));
}

/** Unifica el nombre de la cuenta con el catálogo por código (ej. "PUBLICIDAD. PRODUCCION Y AGENCIA" → el nombre oficial). */
export function normalizarCuentas<T extends Pick<LineaIn, "cuenta" | "nombre_cta">>(lineas: T[], catalogo: ItemCatalogo[]): T[] {
  const porCodigo = new Map(catalogo.filter((c) => c.tipo === "cuenta" && c.nombre).map((c) => [c.clave, c.nombre]));
  const porNombre = new Map(catalogo.filter((c) => c.tipo === "cuenta" && c.nombre).map((c) => [normTxt(c.nombre), c.clave]));
  return lineas.map((l) => {
    const cuenta = l.cuenta || porNombre.get(normTxt(l.nombre_cta)) || "";
    return { ...l, cuenta, nombre_cta: porCodigo.get(cuenta) ?? l.nombre_cta };
  });
}

/** Circuito del gasto: Solped → OC → recepción/factura → contabilizado. La etapa sale de los datos cargados. */
export const ETAPAS = [
  { key: "solped", label: "Solped" },
  { key: "oc", label: "OC emitida" },
  { key: "factura", label: "Facturado" },
  { key: "contabilizado", label: "Contabilizado" },
] as const;
export type Etapa = (typeof ETAPAS)[number]["key"] | "sin_datos";

export function etapaDe(l: Pick<LineaIn, "solped" | "oc" | "nro_recepcion" | "factura" | "fecha_contabilizacion" | "nro_doc_contable">): Etapa {
  if (l.fecha_contabilizacion || l.nro_doc_contable) return "contabilizado";
  if (l.factura || l.nro_recepcion) return "factura";
  if (l.oc) return "oc";
  if (l.solped) return "solped";
  return "sin_datos";
}

/** Listas base de la carga (hoja "Menu Desplegable" de la planilla de Seguimiento, 16-oct-2026). */
export const CATALOGO_BASE: ItemCatalogo[] = [
  ...([
    ["6202010034", "PUBLICIDAD.PRODUCCION Y AGENCIAS"], ["6202010036", "PUBLICIDAD.MATERIALES GRAFICOS"], ["6202010069", "PUBLICIDAD TV"],
    ["6202010071", "PUBLICIDAD PROMOCIONES AL CONSUMIDOR"], ["6202010072", "PUBLICIDAD EXHIBICIONES"], ["6202010077", "INTEGRALES"],
    ["6202010078", "PUBLICIDAD ESTUDIOS DE MERCADO"], ["6202010082", "PUBLICIDAD EVENTOS"], ["6202010084", "PUBLICIDAD COMPARTIDA"],
    ["6202010033", "GASTOS VAR- PAUTA DIGITAL"],
  ] as const).map(([clave, nombre]) => ({ tipo: "cuenta" as const, clave, nombre })),
  ...[
    "PRODUCCIÓN CONTENIDOS", "AGENCIAS VARIAS", "MATERIAL POP", "MERCHANDISING", "ACTIVACIONES WOW", "PAUTA ATL", "PAUTA DIGITAL", "BIC",
    "INVESTIGACIONES MERCADO", "EVENTOS GRUPOS DE COMPRA", "ACCIONES COMPARTIDAS", "CAPACITACIONES", "INTEGRALES", "REGISTRO MARCAS",
    "OTROS EVENTOS", "OTROS GASTOS", "OTRAS ACCIONES MKT",
  ].map((c) => ({ tipo: "concepto" as const, clave: c, nombre: c })),
  ...([["W014402001", "DREAN MKT"], ["W014402002", "DREAN TRADE"], ["W012400003", "KRONEN"]] as const)
    .map(([clave, nombre]) => ({ tipo: "ceco" as const, clave, nombre })),
];

/** Conceptos válidos de cada cuenta (estructura del BGT que pasó el user, 16-oct-2026). Cuenta sin entrada = cualquier concepto. */
export const CUENTA_CONCEPTOS: Record<string, string[]> = {
  "6202010077": ["INTEGRALES"],
  "6202010034": ["PRODUCCIÓN CONTENIDOS", "AGENCIAS VARIAS", "REGISTRO MARCAS", "PAUTA DIGITAL"],
  "6202010069": ["PAUTA ATL"],
  "6202010078": ["INVESTIGACIONES MERCADO"],
  "6202010036": ["MATERIAL POP"],
  "6202010072": ["ACTIVACIONES WOW"],
  "6202010071": ["MERCHANDISING", "OTROS GASTOS"],
  "6202010082": ["EVENTOS GRUPOS DE COMPRA", "OTROS EVENTOS"],
  "6202010084": ["ACCIONES COMPARTIDAS"],
};
export const conceptosDeCuenta = (cuenta: string): string[] | null => CUENTA_CONCEPTOS[cuenta] ?? null;
