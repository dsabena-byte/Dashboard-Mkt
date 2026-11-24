// ============================================================================
// Edad × medio (Eficiencia Medios). Puro y client-safe.
// Cada medio con API entrega su pauta por rango de edad (tabla pauta_edad, crons con ?edad=1). Acá se
// normalizan las edades a tramos comunes y se resume por edad × formato (o × medio) con filtros de tipo y mes.
// Formato = ubicación en Meta (IG Feed, IG Reels, IG Stories, IG Explore, FB Feed…); en los demás medios = el medio.
// Meta no da edad y ubicación juntas: `cruzarMeta` estima el cruce dentro de cada anuncio.
// ============================================================================

export const MEDIOS_EDAD = ["Meta", "TikTok", "YouTube", "Programmatic", "Google Search", "Demand Gen"] as const;
export const EDADES = ["18-24", "25-34", "35-44", "45-54", "55+", "Sin dato"];

/** Tramos de cada plataforma → tramo común (55-64 y 65+ se juntan: TikTok solo da 55+). */
export function normEdad(raw: string | null | undefined): string {
  const s = String(raw ?? "").toUpperCase().replace(/^AGE_RANGE_|^AGE_/, "").replace(/_/g, "-").replace(/\s/g, "");
  if (/^13-17/.test(s)) return "13-17";
  if (/^18-24/.test(s)) return "18-24";
  if (/^25-34/.test(s)) return "25-34";
  if (/^35-44/.test(s)) return "35-44";
  if (/^45-54/.test(s)) return "45-54";
  if (/^(55|65)/.test(s)) return "55+";
  return "Sin dato";
}

export interface FilaEdad {
  medio: string;
  mes: string; // YYYY-MM
  pieza_id: string;
  edad: string;
  formato: string;
  estimado: boolean;
  tipo: string | null; // video | imagen | texto
  impresiones: number;
  clicks: number;
  video_completos: number;
  /** Reproducciones de video que llegaron al 50% o más (sin dato en filas viejas: 0). */
  video_p50: number;
  interacciones: number;
  spend: number; // ya en $
}

export const METRICAS = ["impresiones", "clicks", "video_completos", "video_p50", "interacciones", "spend"] as const;
export type Metrica = (typeof METRICAS)[number];
export type Valores = Record<Metrica, number>;
const vacio = (): Valores => ({ impresiones: 0, clicks: 0, video_completos: 0, video_p50: 0, interacciones: 0, spend: 0 });

export interface FiltroEdad { meses?: string[]; tipo: "todas" | "video" | "imagen" | "texto"; por?: "formato" | "medio" }
export interface ResumenEdad {
  edades: string[];
  /** Columnas: formatos (IG Reels, TikTok…) o medios, según `por`. */
  medios: string[];
  /** Inversión de anuncios de Meta en más de una ubicación (cruce edad × formato estimado) ÷ inversión total. */
  pctEstimado: number;
  celda: (edad: string, medio: string) => Valores;
  porEdad: Map<string, Valores>;
  porMedio: Map<string, Valores>;
  total: Valores;
}

export function resumir(filas: FilaEdad[], f: FiltroEdad): ResumenEdad {
  const meses = f.meses?.length ? new Set(f.meses) : null;
  const m = new Map<string, Valores>(), porEdad = new Map<string, Valores>(), porMedio = new Map<string, Valores>();
  const total = vacio();
  let estimado = 0;
  const col = (r: FilaEdad) => (f.por === "medio" ? r.medio : r.formato || r.medio);
  const add = (map: Map<string, Valores>, k: string, r: FilaEdad) => {
    let v = map.get(k);
    if (!v) map.set(k, (v = vacio()));
    for (const x of METRICAS) v[x] += r[x];
  };
  for (const r of filas) {
    if (meses && !meses.has(r.mes)) continue;
    if (f.tipo !== "todas" && r.tipo !== f.tipo) continue;
    const e = normEdad(r.edad);
    if (e === "13-17") continue; // Drean no pauta a menores; si aparece es ruido de la plataforma.
    add(m, `${e}|${col(r)}`, r);
    add(porEdad, e, r);
    add(porMedio, col(r), r);
    if (r.estimado) estimado += r.spend;
    for (const x of METRICAS) total[x] += r[x];
  }
  const orden = (a: string, b: string, lista: readonly string[]) => (lista.indexOf(a) + 1 || 99) - (lista.indexOf(b) + 1 || 99);
  return {
    edades: [...porEdad.keys()].sort((a, b) => orden(a, b, EDADES)),
    medios: [...porMedio.keys()].sort((a, b) => orden(medioDe(a), medioDe(b), MEDIOS_EDAD) || (porMedio.get(b)!.spend - porMedio.get(a)!.spend)),
    pctEstimado: total.spend > 0 ? estimado / total.spend : 0,
    celda: (e, me) => m.get(`${e}|${me}`) ?? vacio(),
    porEdad, porMedio, total,
  };
}

/** Mejor medio de una edad = menor costo por resultado entre los que tienen ≥5% de la inversión de esa edad y ≥10 resultados. */
export function mejorMedio(r: ResumenEdad, edad: string, res: Metrica): { medio: string; costo: number } | null {
  const tot = r.porEdad.get(edad);
  if (!tot) return null;
  let best: { medio: string; costo: number } | null = null;
  for (const me of r.medios) {
    const v = r.celda(edad, me);
    if (v[res] < 10 || v.spend < tot.spend * 0.05) continue;
    const costo = v.spend / v[res];
    if (!best || costo < best.costo) best = { medio: me, costo };
  }
  return best;
}

export interface PuestoFormato { formato: string; costo: number; resultados: number; spend: number }
/**
 * Formatos de una edad ordenados del más barato al más caro por resultado. Entran los que tienen ≥5% de la inversión de
 * esa edad y ≥10 resultados (con menos, el costo es ruido).
 */
export function rankingFormatos(r: ResumenEdad, edad: string, res: Metrica, n = 3): PuestoFormato[] {
  const tot = r.porEdad.get(edad);
  if (!tot) return [];
  const out: PuestoFormato[] = [];
  for (const fo of r.medios) {
    const v = r.celda(edad, fo);
    if (v[res] < 10 || v.spend < tot.spend * 0.05) continue;
    out.push({ formato: fo, costo: v.spend / v[res], resultados: v[res], spend: v.spend });
  }
  return out.sort((a, b) => a.costo - b.costo).slice(0, n);
}

const POS: Record<string, string> = {
  "instagram|feed": "IG Feed", "instagram|instagram_reels": "IG Reels", "instagram|instagram_profile_reels": "IG Reels",
  "instagram|instagram_stories": "IG Stories", "instagram|instagram_explore": "IG Explore",
  "instagram|instagram_explore_grid_home": "IG Explore", "instagram|instagram_search": "IG Explore",
  "instagram|instagram_profile_feed": "IG Perfil", "facebook|feed": "FB Feed", "facebook|facebook_reels": "FB Reels",
  "facebook|facebook_reels_overlay": "FB Reels", "facebook|facebook_stories": "FB Stories", "facebook|instream_video": "FB Video",
  "facebook|video_feeds": "FB Video", "facebook|marketplace": "FB Marketplace",
};
/** "instagram|instagram_reels" (publisher_platform|platform_position) → "IG Reels". */
export function formatoMeta(valor: string): string {
  if (POS[valor]) return POS[valor]!;
  const plat = valor.split("|")[0];
  return plat === "instagram" ? "IG Otros" : plat === "facebook" ? "FB Otros" : plat === "audience_network" ? "Audience Network"
    : plat === "messenger" ? "Messenger" : plat === "threads" ? "Threads" : "Meta Otros";
}
/** Columna (formato) → su medio, para ordenar: los formatos de Meta empiezan con IG/FB/… */
function medioDe(col: string): string {
  return (MEDIOS_EDAD as readonly string[]).includes(col) ? col : "Meta";
}

type Base = Omit<FilaEdad, "medio" | "mes" | "formato" | "estimado" | "edad" | "pieza_id">;
/**
 * Meta: cruza la apertura por edad y la apertura por ubicación de UN anuncio. Lo que el anuncio logró en cada edad se
 * reparte entre sus ubicaciones según el peso de cada una en esa misma métrica (sin dato de la métrica: por impresiones).
 * Exacto si el anuncio corrió en una sola ubicación. Los totales por edad y por formato se conservan.
 */
export function cruzarMeta(porEdad: Array<Base & { edad: string }>, porUbic: Array<Base & { ubicacion: string }>): Array<Base & { edad: string; formato: string; estimado: boolean }> {
  const ub = new Map<string, Valores>();
  for (const u of porUbic) {
    const k = formatoMeta(u.ubicacion);
    const v = ub.get(k) ?? vacio();
    for (const x of METRICAS) v[x] += u[x];
    ub.set(k, v);
  }
  const tot = vacio();
  for (const v of ub.values()) for (const x of METRICAS) tot[x] += v[x];
  const destinos = ub.size ? [...ub.entries()] : [["Meta Otros", vacio()] as [string, Valores]];
  const estimado = destinos.length > 1;
  const out: Array<Base & { edad: string; formato: string; estimado: boolean }> = [];
  for (const e of porEdad) {
    for (const [formato, v] of destinos) {
      const fila = { ...e, formato, estimado };
      for (const x of METRICAS) {
        const base: Metrica = tot[x] > 0 ? x : "impresiones";
        fila[x] = ub.size === 0 ? e[x] : tot[base] > 0 ? (e[x] * v[base]) / tot[base] : e[x] / destinos.length;
      }
      out.push(fila);
    }
  }
  return out;
}
