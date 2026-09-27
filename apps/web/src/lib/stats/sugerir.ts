// ============================================================================
// Metas sugeridas por pronóstico (D2 de objetivos-inteligencia.md). Puro, client-safe.
//
//  meta sugerida(mes) = línea base(mes) × ambición
//  · Línea base = lo que pasaría si seguís igual: pronóstico de lib/stats/forecast (estacional con
//    el año anterior × tendencia si hay ≥13 meses; si no, suavizado exponencial; <3 meses, ritmo).
//  · Ambición: conservadora (+0%: sostener tu tendencia), realista (+10%), agresiva (+20%). Para
//    KPIs "menor es mejor" (costos) la ambición BAJA el valor (−0/−10/−20%).
//  · Probabilidad de llegar = la misma simulación del Seguimiento (lib/stats/meta.pronosticoMeta):
//    2.000 trayectorias remuestreando los errores históricos del pronóstico → % que alcanza la
//    suma (volumen) o el promedio (tasa) de las metas sugeridas de los meses que faltan.
//  · Solo se sugiere para los meses SIN cerrar (los meses con real no se reescriben). Con dato
//    insuficiente se propone la línea base igual, pero SIN probabilidad (se dice por qué).
// FPP3: pronóstico ≠ meta ≠ plan. Locke & Latham: metas difíciles pero alcanzables.
// ============================================================================
import { ajustar, METODO_TEXTO } from "./forecast";
import { pronosticoMeta } from "./meta";

export type Ambicion = "conservadora" | "realista" | "agresiva";
export const AMBICIONES: { id: Ambicion; label: string; uplift: number; texto: string }[] = [
  { id: "conservadora", label: "Conservadora", uplift: 0, texto: "sostener tu tendencia" },
  { id: "realista", label: "Realista", uplift: 0.1, texto: "10% mejor que tu tendencia" },
  { id: "agresiva", label: "Agresiva", uplift: 0.2, texto: "20% mejor que tu tendencia" },
];

export interface EntradaSugerir {
  /** 12 valores del año de las metas (Ene..Dic); null = sin dato / por venir. Solo meses cerrados en volumen. */
  realM: (number | null)[];
  /** 12 del año anterior (opcional; habilita estacionalidad). */
  histM?: (number | null)[] | null;
  tipo: "sum" | "rate";
  direccion: "up" | "down";
  ambicion: Ambicion;
  /** Unidad "%": las tasas se acotan a [0,100]. */
  unidad?: string;
  seed?: string | number;
}

export interface Sugerencia {
  ambicion: Ambicion;
  /** 12 posiciones: valor sugerido para los meses por venir; null en meses cerrados (no se tocan). */
  valores: (number | null)[];
  /** Línea base (sin ambición) de los meses por venir. */
  base: (number | null)[];
  /** Índices 0-11 de los meses sugeridos. */
  meses: number[];
  /** P(llegar) a la suma/promedio de las metas sugeridas (0-1). null = dato insuficiente. */
  probabilidad: number | null;
  metodoTexto: string;
  /** Meses con dato usados. */
  n: number;
  motivo: string | null;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Redondeo "de planilla": 2 cifras significativas para números grandes, 1 decimal para tasas. */
export function redondearMeta(v: number, tipo: "sum" | "rate"): number {
  if (!Number.isFinite(v)) return v;
  if (tipo === "rate" || Math.abs(v) < 100) return Math.round(v * 10) / 10;
  const e = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.abs(v))) - 2));
  return Math.round(v / e) * e;
}

export function sugerirMetas(e: EntradaSugerir): Sugerencia {
  const real = Array.from({ length: 12 }, (_, i) => (isNum(e.realM[i]) ? e.realM[i]! : null));
  const hist = e.histM && e.histM.some(isNum) ? Array.from({ length: 12 }, (_, i) => (isNum(e.histM![i]) ? e.histM![i]! : null)) : null;
  const amb = AMBICIONES.find((a) => a.id === e.ambicion) ?? AMBICIONES[1]!;
  const factor = e.direccion === "down" ? 1 - amb.uplift : 1 + amb.uplift;
  let lastCur = -1;
  for (let i = 11; i >= 0; i--) if (real[i] != null) { lastCur = i; break; }
  const meses = Array.from({ length: 11 - lastCur }, (_, k) => lastCur + 1 + k);
  const vacio = (motivo: string, metodoTexto = "—", n = 0): Sugerencia => ({ ambicion: amb.id, valores: Array(12).fill(null), base: Array(12).fill(null), meses: [], probabilidad: null, metodoTexto, n, motivo });
  if (!meses.length) return vacio("el año ya está cerrado: no quedan meses por delante");

  const serie = hist ? [...hist, ...real] : real;
  const off = hist ? 12 : 0;
  let lastSerie = -1;
  for (let i = serie.length - 1; i >= 0; i--) if (serie[i] != null) { lastSerie = i; break; }
  if (lastSerie < 0) return vacio("todavía no hay datos de este KPI para proyectar");
  const h = off + 11 - lastSerie;
  const aj = ajustar(serie, h);
  if (!aj) return vacio("todavía no hay datos de este KPI para proyectar");

  const base: (number | null)[] = Array(12).fill(null);
  const valores: (number | null)[] = Array(12).fill(null);
  const tope = (v: number) => (e.unidad === "%" ? Math.min(100, Math.max(0, v)) : Math.max(0, v));
  for (const i of meses) {
    const p = aj.puntos[off + i - lastSerie - 1];
    if (!isNum(p)) continue;
    base[i] = p;
    valores[i] = redondearMeta(tope(p * factor), e.tipo);
  }
  const conMeta = meses.filter((i) => valores[i] != null);
  if (!conMeta.length) return vacio("no se pudo proyectar", METODO_TEXTO[aj.metodo], aj.n);

  // Probabilidad con la misma simulación del Seguimiento (metas SOLO en los meses por venir).
  const r = pronosticoMeta({ realM: real, metaM: valores, histM: hist, tipo: e.tipo, direccion: e.direccion, seed: e.seed ?? "bip-sugerir" }).resumen;
  return {
    ambicion: amb.id, valores, base, meses: conMeta,
    probabilidad: r.suficiente ? r.probabilidad : null,
    metodoTexto: METODO_TEXTO[aj.metodo], n: aj.n,
    motivo: r.suficiente ? null : r.motivo,
  };
}

/** Las tres ambiciones de una vez (para la tabla del MetaPanel). */
export function sugerirTodas(e: Omit<EntradaSugerir, "ambicion">): Record<Ambicion, Sugerencia> {
  return {
    conservadora: sugerirMetas({ ...e, ambicion: "conservadora" }),
    realista: sugerirMetas({ ...e, ambicion: "realista" }),
    agresiva: sugerirMetas({ ...e, ambicion: "agresiva" }),
  };
}
