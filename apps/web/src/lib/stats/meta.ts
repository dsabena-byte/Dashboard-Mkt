// ============================================================================
// "¿Llego a la meta?" — cierre proyectado con rango y PROBABILIDAD por simulación. Puro.
//
//  · Serie = año anterior (si hay) + año en curso (meses cerrados), meses consecutivos.
//  · Se ajusta el pronóstico (lib/stats/forecast) y se simulan N trayectorias (2.000 por defecto)
//    de los meses que faltan, remuestreando los errores relativos históricos del propio método
//    (bootstrap). En suavizado el nivel se actualiza en cada paso → la incertidumbre crece con el
//    horizonte. PRNG con semilla → mismo resultado en cada render.
//  · Volumen (sum): cierre = Σ de los meses con meta (real donde hay, simulado donde falta).
//    Tasa (rate): cierre = promedio de esos meses. P(meta) = fracción de simulaciones con
//    cierre ≥ meta (dirección "down": ≤ meta).
//  · Dato insuficiente (no se muestra probabilidad): menos de 6 meses con dato, menos de 4
//    errores para estimar la incertidumbre, o CV del error > 50% (el pronóstico no es confiable).
// ============================================================================
import { ajustar, METODO_TEXTO, type Ajuste, type MetodoPronostico } from "./forecast";
import { crearUniformes, type Uniformes } from "./prng";

export const N_SIMS = 2000;
export const MIN_MESES = 6;
export const MAX_CV_ERROR = 0.5;

export interface EntradaMeta {
  /** 12 valores del año en curso (Ene..Dic), null = sin dato o por venir. */
  realM: (number | null)[];
  /** 12 metas mensuales, null = sin meta ese mes. */
  metaM: (number | null)[];
  /** 12 valores del año anterior (opcional; habilita la estacionalidad). */
  histM?: (number | null)[] | null;
  tipo: "sum" | "rate";
  direccion: "up" | "down";
  /** Uniformes compartidas entre KPIs (correlación); si no, se crean con `seed`. */
  uniformes?: Uniformes;
  seed?: number | string;
}

export interface MesProyectado { idx: number; p50: number; p10: number | null; p90: number | null }

export interface PronosticoMeta {
  metodo: MetodoPronostico | null;
  metodoTexto: string;
  /** Meses con dato usados (año anterior + actual). */
  n: number;
  /** true = la probabilidad es confiable y se muestra. */
  suficiente: boolean;
  /** Por qué no se muestra la probabilidad (dato insuficiente / sin meta). */
  motivo: string | null;
  /** No quedan meses por pronosticar (el año con meta ya está completo). */
  cerrado: boolean;
  /** Meta anual comparable: Σ metas (sum) o promedio de metas (rate). null sin meta. */
  metaAnual: number | null;
  /** Cierre proyectado (mediana) y rango esperado p10–p90 (null si dato insuficiente). */
  cierre: { p50: number; p10: number | null; p90: number | null } | null;
  /** Probabilidad (0-1) de llegar a la meta anual. null = no mostrar. */
  probabilidad: number | null;
  /** Cumplimiento proyectado (mediana, sin tope) vs la meta anual, en %. */
  cumplP50: number | null;
  /** Cuánto hay que rendir por encima (+) o por debajo (−) del ritmo proyectado para llegar, en %. */
  necesarioVsRitmoPct: number | null;
  /** Meses por venir del año en curso con su rango. */
  mensual: MesProyectado[];
  /** Error típico relativo del pronóstico (CV del error), para transparencia. */
  cvError: number | null;
}

export interface ResultadoMeta {
  resumen: PronosticoMeta;
  /** Cumplimiento anual simulado (capado en 100) por simulación; null si no es confiable. */
  cumplSims: Float64Array | null;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Cumplimiento % según dirección (mismo criterio que cumplimientoPct de lib/web-viz). */
export function cumplimiento(actual: number, meta: number, dir: "up" | "down"): number | null {
  if (!meta) return null;
  if (dir === "up") return (actual / meta) * 100;
  return actual > 0 ? (meta / actual) * 100 : Infinity;
}

function cuantil(sorted: Float64Array | number[], q: number): number {
  const n = sorted.length;
  if (!n) return NaN;
  const pos = (n - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

/** Simula `h` meses por trayectoria (matriz nSims × h) con los residuos del ajuste. */
export function simular(aj: Ajuste, h: number, U: Uniformes): Float64Array {
  const nS = U.nSims, out = new Float64Array(nS * h);
  const R = aj.residuos.length;
  // Residuos ordenados por tiempo (ya lo están): el sorteo u → mes histórico es común a los KPIs.
  for (let s = 0; s < nS; s++) {
    let nivel = aj.nivel ?? 0;
    for (let k = 0; k < h; k++) {
      const u = U.u[s * U.h + (k % U.h)]!;
      const e = R ? aj.residuos[Math.min(R - 1, Math.floor(u * R))]! : 0;
      let y: number;
      if (aj.metodo === "suavizado") {
        y = Math.max(0, nivel * (1 + e));
        nivel += (aj.alpha ?? 0) * (y - nivel);
      } else {
        y = Math.max(0, aj.puntos[k]! * (1 + e));
      }
      out[s * h + k] = y;
    }
  }
  return out;
}

export function pronosticoMeta(e: EntradaMeta): ResultadoMeta {
  const real = Array.from({ length: 12 }, (_, i) => (isNum(e.realM[i]) ? e.realM[i]! : null));
  const meta = Array.from({ length: 12 }, (_, i) => (isNum(e.metaM[i]) ? e.metaM[i]! : null));
  const hist = e.histM && e.histM.some(isNum) ? Array.from({ length: 12 }, (_, i) => (isNum(e.histM![i]) ? e.histM![i]! : null)) : null;
  const serie = hist ? [...hist, ...real] : real;
  const off = hist ? 12 : 0; // posición del mes 0 del año en curso dentro de la serie

  let lastCur = -1;
  for (let i = 11; i >= 0; i--) if (real[i] != null) { lastCur = i; break; }
  let lastSerie = -1;
  for (let i = serie.length - 1; i >= 0; i--) if (serie[i] != null) { lastSerie = i; break; }

  // Meses del año en curso a pronosticar: todos los posteriores al último dato.
  const futuros = Array.from({ length: 11 - lastCur }, (_, k) => lastCur + 1 + k);
  const hasMeta = meta.some((v) => v != null);
  // Meses que cuentan: con meta (si hay metas), y con dato real o por venir (un mes pasado sin
  // dato queda fuera de meta y de real: no se inventa).
  const cuenta = (i: number) => (hasMeta ? meta[i] != null : true) && (real[i] != null || i > lastCur);
  const M = Array.from({ length: 12 }, (_, i) => i).filter(cuenta);
  const F = futuros.filter(cuenta);
  const metaAnual = hasMeta && M.length ? (e.tipo === "sum" ? M.reduce((a, i) => a + meta[i]!, 0) : M.reduce((a, i) => a + meta[i]!, 0) / M.length) : null;

  const vacio = (motivo: string, aj: Ajuste | null = null): ResultadoMeta => ({
    resumen: { metodo: aj?.metodo ?? null, metodoTexto: aj ? METODO_TEXTO[aj.metodo] : "—", n: aj?.n ?? serie.filter((v) => v != null).length, suficiente: false, motivo, cerrado: false, metaAnual, cierre: null, probabilidad: null, cumplP50: null, necesarioVsRitmoPct: null, mensual: [], cvError: aj?.cvError ?? null },
    cumplSims: null,
  });
  if (lastSerie < 0) return vacio("sin datos");

  // Horizonte (en la serie) hasta diciembre del año en curso.
  const h = off + 11 - lastSerie;
  const aj = ajustar(serie, Math.max(0, h));
  if (!aj) return vacio("sin datos");

  const realizado = M.filter((i) => real[i] != null);
  const sumReal = realizado.reduce((a, i) => a + real[i]!, 0);
  const cierreDe = (vals: (i: number) => number) => {
    if (!M.length) return NaN;
    const tot = M.reduce((a, i) => a + (real[i] != null ? real[i]! : vals(i)), 0);
    return e.tipo === "sum" ? tot : tot / M.length;
  };
  const puntoMes = (i: number) => aj.puntos[off + i - lastSerie - 1] ?? aj.puntos[aj.puntos.length - 1] ?? 0;

  // Esfuerzo necesario vs ritmo proyectado (meses por venir; `ritmoDe` = valor esperado del mes).
  const necesarioCon = (ritmoDe: (i: number) => number): number | null => {
    if (metaAnual == null || !F.length) return null;
    const ritmo = F.reduce((a, i) => a + ritmoDe(i), 0);
    const falta = e.tipo === "sum" ? metaAnual - sumReal : metaAnual * M.length - sumReal;
    return ritmo > 0 ? (falta / ritmo - 1) * 100 : null;
  };
  const necesario = necesarioCon(puntoMes);

  // Sin meses por venir → el cierre ya es un hecho (probabilidad 0 ó 1).
  if (!F.length) {
    const c = cierreDe(() => 0);
    const ok = metaAnual != null && Number.isFinite(c) ? (e.direccion === "up" ? c >= metaAnual : c <= metaAnual) : null;
    const cp = metaAnual != null && Number.isFinite(c) ? cumplimiento(c, metaAnual, e.direccion) : null;
    const sims = cp != null ? new Float64Array(e.uniformes?.nSims ?? N_SIMS).fill(Math.min(100, cp)) : null;
    return {
      resumen: { metodo: aj.metodo, metodoTexto: METODO_TEXTO[aj.metodo], n: aj.n, suficiente: ok != null, motivo: ok == null ? "sin meta cargada" : null, cerrado: true, metaAnual, cierre: Number.isFinite(c) ? { p50: c, p10: c, p90: c } : null, probabilidad: ok == null ? null : ok ? 1 : 0, cumplP50: cp, necesarioVsRitmoPct: null, mensual: [], cvError: aj.cvError },
      cumplSims: sims,
    };
  }

  // Regla de dato insuficiente: punto sin rango ni probabilidad.
  let motivo: string | null = null;
  if (aj.n < MIN_MESES) motivo = `dato insuficiente: ${aj.n} ${aj.n === 1 ? "mes" : "meses"} con dato (mínimo ${MIN_MESES})`;
  else if (aj.residuos.length < 4) motivo = "dato insuficiente: muy pocos meses para medir el error del pronóstico";
  else if (aj.cvError == null || aj.cvError > MAX_CV_ERROR) motivo = `dato insuficiente: la serie es muy variable (error típico ${aj.cvError == null || !Number.isFinite(aj.cvError) ? "alto" : `${Math.round(aj.cvError * 100)}%`} del promedio)`;
  if (motivo) {
    const c = cierreDe(puntoMes);
    const cp = metaAnual != null && Number.isFinite(c) ? cumplimiento(c, metaAnual, e.direccion) : null;
    return {
      resumen: { metodo: aj.metodo, metodoTexto: METODO_TEXTO[aj.metodo], n: aj.n, suficiente: false, motivo, cerrado: false, metaAnual, cierre: Number.isFinite(c) ? { p50: c, p10: null, p90: null } : null, probabilidad: null, cumplP50: cp, necesarioVsRitmoPct: necesario, mensual: F.map((i) => ({ idx: i, p50: puntoMes(i), p10: null, p90: null })), cvError: aj.cvError },
      cumplSims: null,
    };
  }

  // ── Simulación ──
  const U = e.uniformes ?? crearUniformes(e.seed ?? 1, N_SIMS, Math.max(24, h));
  const sims = simular(aj, h, U);
  const nS = U.nSims;
  const cierres = new Float64Array(nS);
  const cumplSims = metaAnual != null ? new Float64Array(nS) : null;
  let exitos = 0;
  // Bucle caliente sin closures: real fijo precomputado + posiciones simuladas de cada mes.
  const fijo = realizado.reduce((a, i) => a + real[i]!, 0);
  const posM = Int32Array.from(M.filter((i) => real[i] == null).map((i) => off + i - lastSerie - 1));
  const posF = Int32Array.from(F.map((i) => off + i - lastSerie - 1));
  const porMes: Float64Array[] = F.map(() => new Float64Array(nS));
  const esSum = e.tipo === "sum", up = e.direccion === "up", nM = M.length;
  for (let s = 0, b = 0; s < nS; s++, b += h) {
    let tot = fijo;
    for (let j = 0; j < posM.length; j++) tot += sims[b + posM[j]!]!;
    const c = esSum ? tot : tot / nM;
    cierres[s] = c;
    for (let j = 0; j < posF.length; j++) porMes[j]![s] = sims[b + posF[j]!]!;
    if (metaAnual != null) {
      if (up ? c >= metaAnual : c <= metaAnual) exitos++;
      const cp = up ? (c / metaAnual) * 100 : c > 0 ? (metaAnual / c) * 100 : 100;
      cumplSims![s] = cp > 100 ? 100 : cp;
    }
  }
  const sorted = Float64Array.from(cierres).sort();
  const p50 = cuantil(sorted, 0.5);
  const mensual = F.map((i, j) => { const a = porMes[j]!.sort(); return { idx: i, p50: cuantil(a, 0.5), p10: cuantil(a, 0.1), p90: cuantil(a, 0.9) }; });
  return {
    resumen: {
      metodo: aj.metodo, metodoTexto: METODO_TEXTO[aj.metodo], n: aj.n,
      suficiente: metaAnual != null, motivo: metaAnual == null ? "sin meta cargada" : null, cerrado: false, metaAnual,
      cierre: { p50, p10: cuantil(sorted, 0.1), p90: cuantil(sorted, 0.9) },
      probabilidad: metaAnual != null ? exitos / nS : null,
      cumplP50: metaAnual != null ? cumplimiento(p50, metaAnual, e.direccion) : null,
      // Con simulación, el ritmo esperado es la mediana simulada de cada mes (incluye el sesgo
      // histórico de los errores), coherente con el cierre y la probabilidad.
      necesarioVsRitmoPct: necesarioCon((i) => mensual.find((m) => m.idx === i)?.p50 ?? puntoMes(i)), mensual, cvError: aj.cvError,
    },
    cumplSims,
  };
}

/** Etiqueta cualitativa de una probabilidad (patrón Tableau Pulse). */
export function lecturaProbabilidad(p: number): "probable" | "en riesgo" | "improbable" {
  return p >= 0.7 ? "probable" : p >= 0.3 ? "en riesgo" : "improbable";
}
