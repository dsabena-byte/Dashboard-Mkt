// ============================================================================
// Edad × medio y formato (Eficiencia Medios). Puro y client-safe.
// Meta da la pauta por EDAD y por UBICACIÓN de cada anuncio, pero nunca las dos juntas (no es una
// combinación de breakdowns permitida). El cruce se estima DENTRO de cada anuncio y mes: lo que el anuncio
// logró en una edad se reparte entre sus ubicaciones según el peso de cada ubicación en esa misma métrica.
// Con un anuncio que corre en una sola ubicación el cruce es exacto. Los totales por edad y por formato
// siempre son exactos (cada celda se reparte en proporción, la suma se conserva).
// ============================================================================

export const METRICAS = ["impresiones", "alcance", "clicks", "link_clicks", "landing_views", "interacciones", "video_p100", "thruplay", "spend"] as const;
export type Metrica = (typeof METRICAS)[number];
type Valores = Record<Metrica, number>;

export interface FilaBreakdown extends Partial<Valores> {
  mes: string; // YYYY-MM
  ad_id: string;
  dim: "edad" | "ubicacion";
  valor: string;
}

/** Celda agregada: mes × tipo de pieza × edad × formato. */
export interface CeldaEdad extends Valores {
  mes: string;
  video: boolean;
  edad: string;
  formato: string;
  /** Inversión que viene de anuncios en una sola ubicación (cruce exacto). */
  spendExacto: number;
}

export const EDADES = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
export const edadLabel = (e: string) => (e === "unknown" ? "Sin dato" : e);

const POS: Record<string, string> = {
  "instagram|feed": "IG Feed",
  "instagram|instagram_reels": "IG Reels",
  "instagram|instagram_stories": "IG Stories",
  "instagram|instagram_explore": "IG Explore",
  "instagram|instagram_explore_grid_home": "IG Explore",
  "instagram|instagram_search": "IG Explore",
  "instagram|instagram_profile_feed": "IG Perfil",
  "instagram|instagram_profile_reels": "IG Reels",
  "facebook|feed": "FB Feed",
  "facebook|facebook_reels": "FB Reels",
  "facebook|facebook_reels_overlay": "FB Reels",
  "facebook|facebook_stories": "FB Stories",
  "facebook|instream_video": "FB Video",
  "facebook|video_feeds": "FB Video",
  "facebook|marketplace": "FB Marketplace",
};
/** "instagram|instagram_reels" → "IG Reels". */
export function formatoDe(valor: string): string {
  if (POS[valor]) return POS[valor]!;
  const [plat] = valor.split("|");
  if (plat === "instagram") return "IG Otros";
  if (plat === "facebook") return "FB Otros";
  if (plat === "audience_network") return "Audience Network";
  if (plat === "messenger") return "Messenger";
  if (plat === "threads") return "Threads";
  return "Otros";
}

const vacio = (): Valores => Object.fromEntries(METRICAS.map((m) => [m, 0])) as Valores;
function sumar(a: Valores, b: Partial<Valores>, f = 1) {
  for (const m of METRICAS) a[m] += (b[m] ?? 0) * f;
}

/** Cruza edad × formato por anuncio y mes y agrega por mes × tipo de pieza × edad × formato. */
export function cruzarEdadFormato(filas: FilaBreakdown[], esVideo: (adId: string) => boolean): CeldaEdad[] {
  const porAd = new Map<string, { edad: Map<string, Valores>; ubic: Map<string, Valores> }>();
  for (const f of filas) {
    const k = `${f.mes}|${f.ad_id}`;
    let a = porAd.get(k);
    if (!a) porAd.set(k, (a = { edad: new Map(), ubic: new Map() }));
    const mapa = f.dim === "edad" ? a.edad : a.ubic;
    const clave = f.dim === "edad" ? f.valor : formatoDe(f.valor);
    let v = mapa.get(clave);
    if (!v) mapa.set(clave, (v = vacio()));
    sumar(v, f);
  }
  const celdas = new Map<string, CeldaEdad>();
  for (const [k, a] of porAd) {
    const [mes, adId] = k.split("|") as [string, string];
    const video = esVideo(adId);
    const ubic = [...a.ubic.entries()];
    const totUbic = vacio();
    for (const [, v] of ubic) sumar(totUbic, v);
    const exacto = ubic.length === 1;
    for (const [edad, ve] of a.edad) {
      const destinos = ubic.length ? ubic : [["Sin dato", vacio()] as [string, Valores]];
      for (const [formato, vu] of destinos) {
        const ck = `${mes}|${video}|${edad}|${formato}`;
        let c = celdas.get(ck);
        if (!c) celdas.set(ck, (c = { mes, video, edad, formato, spendExacto: 0, ...vacio() }));
        for (const m of METRICAS) {
          // Peso de la ubicación en ESA métrica; sin dato de esa métrica, por impresiones; si no, partes iguales.
          const base: Metrica = totUbic[m] > 0 ? m : totUbic.impresiones > 0 ? "impresiones" : m;
          const w = ubic.length === 0 ? 1 : totUbic[base] > 0 ? vu[base] / totUbic[base] : 1 / destinos.length;
          c[m] += ve[m] * w;
        }
        if (exacto) c.spendExacto += ve.spend;
      }
    }
  }
  return [...celdas.values()];
}

export interface FiltroEdad {
  meses?: string[]; // vacío = todos
  tipo: "todas" | "video" | "imagen";
}
export interface ResumenEdad {
  edades: string[];
  formatos: string[];
  /** edad → formato → valores */
  celda: (edad: string, formato: string) => Valores;
  porEdad: Map<string, Valores>;
  porFormato: Map<string, Valores>;
  total: Valores;
  pctExacto: number;
}

export function resumir(celdas: CeldaEdad[], f: FiltroEdad): ResumenEdad {
  const meses = f.meses?.length ? new Set(f.meses) : null;
  const sel = celdas.filter((c) => (!meses || meses.has(c.mes)) && (f.tipo === "todas" || c.video === (f.tipo === "video")));
  const m = new Map<string, Valores>();
  const porEdad = new Map<string, Valores>();
  const porFormato = new Map<string, Valores>();
  const total = vacio();
  let exacto = 0;
  for (const c of sel) {
    const k = `${c.edad}|${c.formato}`;
    if (!m.has(k)) m.set(k, vacio());
    sumar(m.get(k)!, c);
    if (!porEdad.has(c.edad)) porEdad.set(c.edad, vacio());
    sumar(porEdad.get(c.edad)!, c);
    if (!porFormato.has(c.formato)) porFormato.set(c.formato, vacio());
    sumar(porFormato.get(c.formato)!, c);
    sumar(total, c);
    exacto += c.spendExacto;
  }
  const edades = [...porEdad.keys()].sort((a, b) => (EDADES.indexOf(a) + 1 || 99) - (EDADES.indexOf(b) + 1 || 99));
  const formatos = [...porFormato.entries()].sort((a, b) => b[1].spend - a[1].spend).map(([k]) => k);
  return {
    edades, formatos, porEdad, porFormato, total,
    celda: (e, fo) => m.get(`${e}|${fo}`) ?? vacio(),
    pctExacto: total.spend > 0 ? exacto / total.spend : 0,
  };
}

/** Mejor formato de una edad = menor costo por resultado entre los que tienen ≥5% de la inversión de esa edad y ≥10 resultados. */
export function mejorFormato(r: ResumenEdad, edad: string, res: Metrica): { formato: string; costo: number } | null {
  const tot = r.porEdad.get(edad);
  if (!tot) return null;
  let best: { formato: string; costo: number } | null = null;
  for (const fo of r.formatos) {
    const v = r.celda(edad, fo);
    if (v[res] < 10 || v.spend < tot.spend * 0.05) continue;
    const costo = v.spend / v[res];
    if (!best || costo < best.costo) best = { formato: fo, costo };
  }
  return best;
}
