// ============================================================================
// Marca vs activación en el Plan de Medios (portado de BIP, sep-2026; D3). Puro, client-safe.
//
// Binet & Field (IPA, "The Long and the Short of It", 2013; "Effectiveness in Context", 2018):
//  · MARCA = construye demanda futura (alcance amplio, video, TV/OOH/DOOH/radio, awareness).
//  · ACTIVACIÓN = captura la demanda de hoy (búsqueda, conversión, ecommerce, catálogo).
//  · Referencia promedio B2C ≈ 60:40 (marca:activación). Es una referencia, no una regla: varía por
//    categoría y etapa de la marca.
// Adaptación Drean: la pauta ya viene clasificada por ROL DE COMUNICACIÓN (Awareness /
// Consideración / Conversión: objetivo OMD, línea de DV360, tipo de compra Meta/TikTok, Google
// Demand Gen/Search = Consideración, ecommerce = Conversión). Awareness → marca; Conversión →
// activación; Consideración (tráfico, TrueView, Demand Gen, Search) sirve a los dos → "mixto" y se
// reparte 50/50. Medios offline (TV, OOH, DOOH, radio) → marca siempre.
// Test: scripts/inteligencia.test.ts
// ============================================================================

export type RolMedio = "marca" | "activacion" | "mixto";
export interface Clasificacion { rol: RolMedio; motivo: string }

const OFFLINE = /^(tv|tv cable|tv abierta|radio|ooh|dooh|v[ií]a p[uú]blica|cine)\b/i;

/** Clasifica un rol de comunicación (y/o medio) de Drean en marca / activación / mixto. */
export function clasificarRol(rol: string | null | undefined, medio?: string | null): Clasificacion {
  if (medio && OFFLINE.test(medio.trim())) return { rol: "marca", motivo: `medio offline (${medio})` };
  const r = (rol ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/awareness|alcance|branding|notoriedad|build/.test(r)) return { rol: "marca", motivo: "rol Awareness (alcance, video, recordación)" };
  if (/conversion|ecommerce|venta|performance|compra/.test(r)) return { rol: "activacion", motivo: "rol Conversión (ecommerce, compra)" };
  if (/consideracion|trafico|interaccion|engagement/.test(r)) return { rol: "mixto", motivo: "rol Consideración (tráfico, TrueView, Demand Gen, Search): sirve a los dos" };
  return { rol: "mixto", motivo: rol ? `rol "${rol}" sin clasificar` : "sin rol informado" };
}

export interface RefMarcaActivacion { marca: number; activacion: number; fuente: string }
export const REF_B2C: RefMarcaActivacion = { marca: 60, activacion: 40, fuente: "Binet & Field (IPA): promedio B2C ≈ 60:40" };
/** Banda de tolerancia en puntos alrededor de la referencia. */
export const TOLERANCIA_PTS = 10;

export interface ItemInversion { nombre: string; inversion: number; medio?: string | null }

export interface SplitMarcaActivacion {
  marca: number;
  activacion: number;
  mixto: number;
  total: number;
  /** % marca con lo mixto repartido 50/50. */
  pctMarca: number;
  pctActivacion: number;
  pctMixto: number;
  referencia: RefMarcaActivacion;
  /** Diferencia en puntos vs la referencia (+ = más marca que la referencia). */
  desvioPts: number;
  lectura: "en línea con la referencia" | "cargado a activación" | "cargado a marca";
  texto: string;
  items: { nombre: string; inversion: number; rol: RolMedio; motivo: string }[];
}

export function splitMarcaActivacion(items: ItemInversion[], opts: { referencia?: RefMarcaActivacion } = {}): SplitMarcaActivacion | null {
  const ref = opts.referencia ?? REF_B2C;
  let marca = 0, activacion = 0, mixto = 0;
  const out: SplitMarcaActivacion["items"] = [];
  for (const it of items) {
    if (!(it.inversion > 0)) continue;
    const cl = clasificarRol(it.nombre, it.medio);
    out.push({ nombre: it.nombre, inversion: it.inversion, rol: cl.rol, motivo: cl.motivo });
    if (cl.rol === "marca") marca += it.inversion;
    else if (cl.rol === "activacion") activacion += it.inversion;
    else mixto += it.inversion;
  }
  const total = marca + activacion + mixto;
  if (!(total > 0)) return null;
  const pctMarca = ((marca + mixto / 2) / total) * 100;
  const desvio = pctMarca - ref.marca;
  const lectura: SplitMarcaActivacion["lectura"] = Math.abs(desvio) <= TOLERANCIA_PTS ? "en línea con la referencia" : desvio < 0 ? "cargado a activación" : "cargado a marca";
  const r0 = (v: number) => Math.round(v);
  const texto = lectura === "en línea con la referencia"
    ? `La inversión va ${r0(pctMarca)}:${r0(100 - pctMarca)} (marca:activación), dentro de ±${TOLERANCIA_PTS} pts de la referencia ${ref.marca}:${ref.activacion}.`
    : lectura === "cargado a activación"
      ? `La inversión va ${r0(pctMarca)}:${r0(100 - pctMarca)}: ${r0(-desvio)} pts más a activación que la referencia ${ref.marca}:${ref.activacion}. Rinde hoy, pero sin inversión en marca la demanda futura se achica (más costo por venta con el tiempo).`
      : `La inversión va ${r0(pctMarca)}:${r0(100 - pctMarca)}: ${r0(desvio)} pts más a marca que la referencia ${ref.marca}:${ref.activacion}. Revisá que haya activación suficiente (búsqueda, ecommerce) para capturar la demanda que se genera.`;
  return {
    marca, activacion, mixto, total,
    pctMarca, pctActivacion: 100 - pctMarca, pctMixto: (mixto / total) * 100,
    referencia: ref, desvioPts: desvio, lectura, texto,
    items: out.sort((a, b) => b.inversion - a.inversion),
  };
}
