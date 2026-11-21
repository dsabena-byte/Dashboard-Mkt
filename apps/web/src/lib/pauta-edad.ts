// ============================================================================
// Edad × medio (Eficiencia Medios). Puro y client-safe.
// Cada medio con API entrega su pauta por rango de edad (tabla pauta_edad, crons con ?edad=1). Acá se
// normalizan las edades a tramos comunes y se resume por edad × medio con filtros de tipo de pieza y mes.
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
  tipo: string | null; // video | imagen | texto
  impresiones: number;
  clicks: number;
  video_completos: number;
  interacciones: number;
  spend: number; // ya en $
}

export const METRICAS = ["impresiones", "clicks", "video_completos", "interacciones", "spend"] as const;
export type Metrica = (typeof METRICAS)[number];
export type Valores = Record<Metrica, number>;
const vacio = (): Valores => ({ impresiones: 0, clicks: 0, video_completos: 0, interacciones: 0, spend: 0 });

export interface FiltroEdad { meses?: string[]; tipo: "todas" | "video" | "imagen" | "texto" }
export interface ResumenEdad {
  edades: string[];
  medios: string[];
  celda: (edad: string, medio: string) => Valores;
  porEdad: Map<string, Valores>;
  porMedio: Map<string, Valores>;
  total: Valores;
}

export function resumir(filas: FilaEdad[], f: FiltroEdad): ResumenEdad {
  const meses = f.meses?.length ? new Set(f.meses) : null;
  const m = new Map<string, Valores>(), porEdad = new Map<string, Valores>(), porMedio = new Map<string, Valores>();
  const total = vacio();
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
    add(m, `${e}|${r.medio}`, r);
    add(porEdad, e, r);
    add(porMedio, r.medio, r);
    for (const x of METRICAS) total[x] += r[x];
  }
  const orden = (a: string, b: string, lista: readonly string[]) => (lista.indexOf(a) + 1 || 99) - (lista.indexOf(b) + 1 || 99);
  return {
    edades: [...porEdad.keys()].sort((a, b) => orden(a, b, EDADES)),
    medios: [...porMedio.keys()].sort((a, b) => orden(a, b, MEDIOS_EDAD)),
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
