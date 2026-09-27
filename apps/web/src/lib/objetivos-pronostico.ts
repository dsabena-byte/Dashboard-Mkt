// ============================================================================
// Pace-to-goal + "qué explica la brecha" del Seguimiento Objetivos (puro, client-safe; portado de
// BIP lib/objetivos-pronostico.ts + el reparto de Shapley de lib/objetivos-rollup.ts, sep-2026).
//  · Pronóstico por KPI (lib/stats/meta): cierre proyectado del año con rango p10–p90 y
//    PROBABILIDAD de llegar a la meta anual (2.000 simulaciones bootstrap, semilla fija, uniformes
//    compartidas → se conserva la correlación entre KPIs). Dato insuficiente (n<6, <4 errores o
//    CV del error >50%) → punto sin rango ni probabilidad, y se dice por qué.
//  · Propagación por el rollup del Mapa (lib/stats/rollup): objetivo y Salud de Marca.
//  · Shapley (lib/stats/shapley): cuánto de la brecha YTD (100 − cumplimiento) explica cada KPI, y
//    qué KPI movió el cumplimiento del mes de referencia vs el anterior. Suma EXACTA del total.
//  · "¿Por qué se movió?" (volumen × tasa) para los KPIs con driver natural (Pauta Mkt).
// Lo usan lib/objetivos-rollup.ts y lib/objetivos-por-categoria.ts (server) y el test
// scripts/stats.test.ts. SOLO devuelve resúmenes serializables (sin Float64Array) → se pueden pasar
// a componentes cliente.
// ============================================================================
import { crearUniformes } from "./stats/prng";
import { pronosticoMeta, N_SIMS, type PronosticoMeta, type ResultadoMeta } from "./stats/meta";
import { propagarPonderado } from "./stats/rollup";
import { descomponerConDriver } from "./stats/descomposicion";
import { contribucionBrecha, contribucionVariacion, type ContribucionShapley, type AporteShapley, type AporteGrupo } from "./stats/shapley";

export interface KpiSerie {
  plan: string;
  kpi: string;
  tipo: "sum" | "rate";
  direccion: "up" | "down";
  realM: (number | null)[];
  metaM: (number | null)[];
  histM?: (number | null)[] | null;
}

export const kpiKey = (k: { plan: string; kpi: string }) => `${k.plan}||${k.kpi}`;

/**
 * Historia del año anterior apta para PRONOSTICAR: solo si está casi completa (≥10 meses con dato).
 * Una historia con huecos (ej. GA4 2025 sin jun-oct, IG 2025 desde jun) no habilita la
 * estacionalidad y, pegada a la serie, mete saltos que inflan el error (validado con data real:
 * Tráfico web pasaba de CV 47% a 97% y quedaba "dato insuficiente"). La validación de pesos del
 * Mapa sí usa la historia cruda (necesita meses, no estacionalidad).
 */
export function histParaPronostico(h: (number | null)[] | null | undefined): (number | null)[] | null {
  return h && h.filter((v) => v != null && Number.isFinite(v)).length >= 10 ? h : null;
}

/** Resumen seguro para cruzar la frontera server → client (sin Infinity/NaN). */
export function sanitizarPronostico(p: PronosticoMeta): PronosticoMeta {
  const fin = (v: number | null) => (v == null || !Number.isFinite(v) ? null : v);
  return {
    ...p,
    cvError: fin(p.cvError),
    cumplP50: fin(p.cumplP50),
    necesarioVsRitmoPct: fin(p.necesarioVsRitmoPct),
    metaAnual: fin(p.metaAnual),
    cierre: p.cierre && Number.isFinite(p.cierre.p50) ? { p50: p.cierre.p50, p10: fin(p.cierre.p10), p90: fin(p.cierre.p90) } : null,
  };
}

/** Pronóstico de todos los KPIs con UNA matriz de uniformes compartida (correlación entre KPIs). */
export function pronosticarKpis<K extends KpiSerie>(kpis: K[], seed: string | number = "drean-seguimiento"): Map<string, ResultadoMeta> {
  const U = crearUniformes(seed, N_SIMS, 24);
  const out = new Map<string, ResultadoMeta>();
  for (const k of kpis) out.set(kpiKey(k), pronosticoMeta({ realM: k.realM, metaM: k.metaM, histM: histParaPronostico(k.histM), tipo: k.tipo, direccion: k.direccion, uniformes: U }));
  return out;
}

/** Proyección agregada (objetivo / Salud de Marca): cumplimiento al cierre y P(llegar al 100%). */
export interface ProyeccionAgregada {
  suficiente: boolean;
  motivo: string | null;
  p50: number | null;
  p10: number | null;
  p90: number | null;
  probabilidad: number | null;
  /** % del peso con pronóstico confiable. */
  cobertura: number;
}

const insuf = (motivo: string, cobertura = 0): ProyeccionAgregada => ({ suficiente: false, motivo, p50: null, p10: null, p90: null, probabilidad: null, cobertura });

export interface ObjetivoLinks { id: string; pesoEstrategico: number; aportes: { key: string; w: number }[] }

export function pronosticarObjetivos(objs: ObjetivoLinks[], res: Map<string, ResultadoMeta>): { objetivos: Map<string, ProyeccionAgregada>; global: ProyeccionAgregada } {
  const objetivos = new Map<string, ProyeccionAgregada>();
  const simsObj: { w: number; sims: Float64Array | null }[] = [];
  for (const o of objs) {
    const items = o.aportes.filter((a) => a.w > 0).map((a) => ({ w: a.w, sims: res.get(a.key)?.cumplSims ?? null }));
    const r = items.length ? propagarPonderado(items) : null;
    if (!r) {
      const wT = items.reduce((s, x) => s + x.w, 0), wC = items.filter((x) => x.sims).reduce((s, x) => s + x.w, 0);
      const cob = wT ? (wC / wT) * 100 : 0;
      objetivos.set(o.id, insuf(items.length ? `dato insuficiente: solo el ${Math.round(cob)}% del peso tiene un pronóstico confiable` : "sin KPIs vinculados", cob));
      simsObj.push({ w: o.pesoEstrategico, sims: null });
    } else {
      objetivos.set(o.id, { suficiente: true, motivo: null, p50: r.p50, p10: r.p10, p90: r.p90, probabilidad: r.probabilidad, cobertura: r.cobertura });
      simsObj.push({ w: o.pesoEstrategico, sims: r.sims });
    }
  }
  const g = propagarPonderado(simsObj);
  const wT = simsObj.reduce((s, x) => s + x.w, 0), wC = simsObj.filter((x) => x.sims).reduce((s, x) => s + x.w, 0);
  const global = g ? { suficiente: true, motivo: null, p50: g.p50, p10: g.p10, p90: g.p90, probabilidad: g.probabilidad, cobertura: g.cobertura }
    : insuf(`dato insuficiente: solo el ${Math.round(wT ? (wC / wT) * 100 : 0)}% del peso estratégico tiene proyección confiable`, wT ? (wC / wT) * 100 : 0);
  return { objetivos, global };
}

// ── "¿Por qué se movió?" — KPI = driver × tasa, último mes vs el anterior ──
export interface DriverDef { plan: string; kpi: string; driver: string; volumen: string; tasa: string }
export const DRIVERS: DriverDef[] = [
  { plan: "Pauta Mkt", kpi: "Impresiones", driver: "Inversión", volumen: "inversión", tasa: "impresiones por $ (CPM)" },
  { plan: "Pauta Mkt", kpi: "Alcance único", driver: "Inversión", volumen: "inversión", tasa: "alcance por $" },
  { plan: "Pauta Mkt", kpi: "Clicks", driver: "Impresiones", volumen: "impresiones", tasa: "CTR" },
];

export interface PorQue {
  mesAntes: number; // 0-11
  mesDespues: number;
  variacionPct: number;
  /** Puntos porcentuales de la variación explicados por el volumen y por la tasa (suman variacionPct). */
  ptsVolumen: number;
  ptsTasa: number;
  volumen: string;
  tasa: string;
}

/** Descompone la variación del último mes con dato vs el anterior para los KPIs con driver. */
export function porQueSeMovio(kpi: KpiSerie, todos: KpiSerie[]): PorQue | null {
  const def = DRIVERS.find((d) => d.plan === kpi.plan && d.kpi === kpi.kpi);
  if (!def) return null;
  const drv = todos.find((k) => k.plan === def.plan && k.kpi === def.driver);
  if (!drv) return null;
  let i1 = -1;
  for (let i = 11; i >= 0; i--) if (kpi.realM[i] != null) { i1 = i; break; }
  const i0 = i1 - 1;
  if (i0 < 0) return null;
  const y0 = kpi.realM[i0], y1 = kpi.realM[i1], v0 = drv.realM[i0], v1 = drv.realM[i1];
  if (y0 == null || y1 == null || v0 == null || v1 == null) return null;
  const d = descomponerConDriver(y0, y1, v0, v1);
  if (!d || d.variacionPct == null || d.ptsVolumen == null || d.ptsTasa == null) return null;
  return { mesAntes: i0, mesDespues: i1, variacionPct: d.variacionPct, ptsVolumen: d.ptsVolumen, ptsTasa: d.ptsTasa, volumen: def.volumen, tasa: def.tasa };
}

// ── Shapley sobre el rollup del Mapa ─────────────────────────────────────────
/** Un KPI conectado a un objetivo: peso inbound + cumplimiento YTD + serie mensual de cumplimiento (capados en 100). */
export interface ConexionKpi { kpi: string; plan: string; peso: number; cumplYtd: number | null; serie: (number | null)[] }

/** Brecha YTD por KPI y cambio del mes `refIdx` vs el anterior (null si no hay dato). */
export function contribucionesObjetivo(seed: string, conex: ConexionKpi[], refIdx: number): { contribucion: ContribucionShapley | null; variacion: ContribucionShapley | null } {
  const jug = conex.filter((c) => c.peso > 0).map((c) => ({ nombre: c.kpi, grupo: c.plan, w: c.peso, c }));
  const contribucion = contribucionBrecha(jug.map((j) => ({ nombre: j.nombre, grupo: j.grupo, w: j.w, cumpl: j.c.cumplYtd })), { seed });
  const variacion = refIdx > 0
    ? contribucionVariacion(jug.map((j) => ({ nombre: j.nombre, grupo: j.grupo, w: j.w, cumpl: j.c.serie[refIdx] ?? null, cumplAntes: j.c.serie[refIdx - 1] ?? null })), { seed })
    : null;
  return { contribucion, variacion };
}

/** Brecha de la Salud de Marca repartida por objetivo, por KPI y por plan. */
export interface ContribucionGlobal {
  porObjetivo: ContribucionShapley | null;
  porKpi: AporteShapley[];
  porGrupo: AporteGrupo[];
  total: number;
}

/**
 * Shapley por objetivo (sobre el peso estratégico) y, por linealidad del rollup, por KPI y por
 * plan: φ_KPI(global) = Σ_objetivos (peso normalizado del objetivo) × φ_KPI(objetivo).
 */
export function contribucionGlobal(objetivos: { nombre: string; pesoEstrategico: number; cumplYtd: number | null; contribucion?: ContribucionShapley | null }[]): ContribucionGlobal | null {
  const porObjetivo = contribucionBrecha(objetivos.map((o) => ({ nombre: o.nombre, w: o.pesoEstrategico, cumpl: o.cumplYtd })), { seed: "global" });
  if (!porObjetivo) return null;
  const conDato = objetivos.filter((o) => o.cumplYtd != null && o.pesoEstrategico > 0 && o.contribucion);
  const sw = conDato.reduce((a, o) => a + o.pesoEstrategico, 0);
  const kpiMap = new Map<string, AporteShapley>();
  for (const o of conDato) for (const a of o.contribucion!.aportes) {
    const k = `${a.grupo}||${a.nombre}`;
    const x = kpiMap.get(k) ?? { nombre: a.nombre, grupo: a.grupo, puntos: 0, pctDelTotal: null };
    x.puntos += (o.pesoEstrategico / (sw || 1)) * a.puntos;
    kpiMap.set(k, x);
  }
  const total = porObjetivo.total;
  const pct = (x: number) => (Math.abs(total) > 1e-9 ? (x / total) * 100 : null);
  const porKpi = [...kpiMap.values()].map((a) => ({ ...a, pctDelTotal: pct(a.puntos) })).sort((a, b) => a.puntos - b.puntos);
  const g = new Map<string, { p: number; k: number }>();
  for (const a of porKpi) { const k = a.grupo ?? "Otros"; const x = g.get(k) ?? { p: 0, k: 0 }; x.p += a.puntos; x.k++; g.set(k, x); }
  return { porObjetivo, porKpi, porGrupo: [...g.entries()].map(([grupo, x]) => ({ grupo, puntos: x.p, pctDelTotal: pct(x.p), kpis: x.k })).sort((a, b) => a.puntos - b.puntos), total };
}

export type { PronosticoMeta, ContribucionShapley, AporteShapley, AporteGrupo };
