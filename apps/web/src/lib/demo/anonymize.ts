// =============================================================================
// MODO DEMO — anonimización de marcas y categorías.
//
// Objetivo: poder mostrar los dashboards reales sin exponer marcas ni categorías
// reales. Reemplaza los nombres reales por "Marca A/B/C…" y "Categoría 1/2/3…" de
// forma CONSISTENTE en todos los dashboards (la misma marca real → siempre la
// misma etiqueta).
//
// Enfoque de MÍNIMO RIESGO: se anonimiza SOLO el texto que se muestra (labels,
// leyendas, celdas, tooltips), pasándolo por brandLabel()/categoryLabel(). Los
// datos, las keys internas, las comparaciones y los mapas de color se dejan
// INTACTOS (keyeados por el nombre real) → es imposible romper la lógica.
//
// Aislamiento total de producción:
//  - Se activa SOLO cuando NEXT_PUBLIC_DEMO_MODE === "1". Ese flag lo setea
//    next.config a partir del nombre de la rama (`demo`) en build, así el preview
//    de Vercel de esa rama queda anonimizado y `main`/producción NO cambia
//    (DEMO=false → brandLabel/categoryLabel devuelven el string original).
//  - Isomórfico: lo pueden importar componentes server y client.
//  - No escribe nada; solo transforma texto al renderizar.
// =============================================================================

export const DEMO: boolean = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

// --- Normalización para matchear sin importar mayúsculas/acentos/espacios ------
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // saca acentos
    .toLowerCase()
    .trim();
}

// --- Marca propia -------------------------------------------------------------
// Drean es la marca del cliente → siempre "Marca A" (la protagonista/destacada).
const OWN_REAL = "drean";
export const OWN_BRAND_DEMO = "Marca A";

// --- Diccionario de MARCAS (real normalizado → etiqueta demo) -----------------
// Orden estable: Drean=A; el resto por relevancia/alfabético. Etiquetas fijas para
// que el color-por-entidad siga siendo consistente (misma marca → misma etiqueta
// → mismo color).
const BRAND_LABELS: Record<string, string> = {
  drean: "Marca A",
  whirlpool: "Marca B",
  samsung: "Marca C",
  lg: "Marca D",
  philco: "Marca E",
  gafa: "Marca F",
  electrolux: "Marca G",
  longvie: "Marca H",
  florencia: "Marca I",
  bgh: "Marca J",
  mabe: "Marca K",
  patrick: "Marca L",
  hisense: "Marca M",
  midea: "Marca N",
  escorial: "Marca O",
  orbis: "Marca P",
};

// Retailers (SEO competitivo / dónde se busca) → "Retailer A/B/C…".
const RETAILER_LABELS: Record<string, string> = {
  ml: "Retailer A",
  mercadolibre: "Retailer A",
  "mercado libre": "Retailer A",
  fravega: "Retailer B",
  naldo: "Retailer C",
  rodo: "Retailer D",
  cetrogar: "Retailer E",
  megatone: "Retailer F",
  "casa del audio": "Retailer G",
  coto: "Retailer H",
  oncity: "Retailer I",
};

// --- Diccionario de CATEGORÍAS (por familia semántica) ------------------------
// Todas las variantes/keys de una misma familia caen en la misma etiqueta, así
// Floor Share "Lavado", SEO "lavarropas" y Web "Lavado" muestran "Categoría 1".
const CATEGORY_LABELS: Record<string, string> = {
  // Familia Lavado → Categoría 1
  lavado: "Categoría 1",
  "lavado y secado": "Categoría 1",
  lavarropas: "Categoría 1",
  lavasecarropas: "Categoría 1",
  secarropas: "Categoría 1",
  // Familia Refrigeración → Categoría 2
  refrigeracion: "Categoría 2",
  refri: "Categoría 2",
  heladeras: "Categoría 2",
  heladera: "Categoría 2",
  // Familia Cocción → Categoría 3
  coccion: "Categoría 3",
  cocinas: "Categoría 3",
  cocina: "Categoría 3",
  hornos: "Categoría 3",
  anafes: "Categoría 3",
  // Otras categorías de producto
  lavavajillas: "Categoría 4",
};

// Etiquetas que NO son ni marca ni categoría de producto y se dejan como están
// (son pilares de campaña / genéricos, no revelan nada confidencial).
const PASSTHROUGH = new Set(["brand", "promocion", "promoción", "home", "otros", "otros / home", "total", "todas"]);

// --- API ----------------------------------------------------------------------

/** Etiqueta de marca anonimizada. Sin DEMO devuelve el original. */
export function brandLabel(name: string | null | undefined): string {
  const raw = (name ?? "").toString();
  if (!DEMO || !raw) return raw;
  const k = norm(raw);
  if (PASSTHROUGH.has(k)) return raw;
  return BRAND_LABELS[k] ?? RETAILER_LABELS[k] ?? fallbackBrand(raw);
}

/** Etiqueta de categoría anonimizada. Sin DEMO devuelve el original. */
export function categoryLabel(name: string | null | undefined): string {
  const raw = (name ?? "").toString();
  if (!DEMO || !raw) return raw;
  const k = norm(raw);
  if (PASSTHROUGH.has(k)) return raw;
  return CATEGORY_LABELS[k] ?? raw;
}

/** ¿Es la marca propia (Drean)? Útil para comparaciones que hoy hacen === "Drean". */
export function isOwnBrand(name: string | null | undefined): boolean {
  return norm((name ?? "").toString()) === OWN_REAL;
}

// Marcas reales desconocidas (no listadas): se les asigna una etiqueta estable
// derivada, para no filtrar el nombre real igual.
const dynBrand = new Map<string, string>();
let dynBrandN = 0;
function fallbackBrand(raw: string): string {
  const k = norm(raw);
  const known = new Set(Object.values(BRAND_LABELS));
  let lbl = dynBrand.get(k);
  if (!lbl) {
    // Siguiente letra libre después de las conocidas.
    dynBrandN += 1;
    lbl = `Marca ${String.fromCharCode(90 - (dynBrandN - 1))}`; // Z, Y, X… para no chocar con A..P
    while (known.has(lbl)) {
      dynBrandN += 1;
      lbl = `Marca ${String.fromCharCode(90 - (dynBrandN - 1))}`;
    }
    dynBrand.set(k, lbl);
  }
  return lbl;
}

/**
 * Remapea in-place los campos de texto de una fila que contengan marca/categoría.
 * Devuelve una copia con los campos anonimizados (solo si DEMO). Los campos que
 * son KEYS internas se dejan intactos salvo que se listen explícitamente.
 */
export function anonRow<T extends Record<string, unknown>>(
  row: T,
  opts: { brandFields?: (keyof T)[]; categoryFields?: (keyof T)[] } = {},
): T {
  if (!DEMO) return row;
  const out: Record<string, unknown> = { ...row };
  for (const f of opts.brandFields ?? []) {
    if (typeof out[f as string] === "string") out[f as string] = brandLabel(out[f as string] as string);
  }
  for (const f of opts.categoryFields ?? []) {
    if (typeof out[f as string] === "string") out[f as string] = categoryLabel(out[f as string] as string);
  }
  return out as T;
}

/** Igual que anonRow pero para arrays. */
export function anonRows<T extends Record<string, unknown>>(
  rows: T[],
  opts: { brandFields?: (keyof T)[]; categoryFields?: (keyof T)[] } = {},
): T[] {
  if (!DEMO) return rows;
  return rows.map((r) => anonRow(r, opts));
}

/** Re-keyea un mapa de constantes (color/label) por marca real → etiqueta demo. */
export function rekeyByBrand<V>(map: Record<string, V>): Record<string, V> {
  if (!DEMO) return map;
  const out: Record<string, V> = {};
  for (const [k, v] of Object.entries(map)) out[brandLabel(k)] = v;
  return out;
}

/** Re-keyea un mapa de constantes por categoría real → etiqueta demo. */
export function rekeyByCategory<V>(map: Record<string, V>): Record<string, V> {
  if (!DEMO) return map;
  const out: Record<string, V> = {};
  for (const [k, v] of Object.entries(map)) out[categoryLabel(k)] = v;
  return out;
}
