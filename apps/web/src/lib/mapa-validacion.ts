// ============================================================================
// Validación empírica del Mapa (portado de BIP, sep-2026; D4): arma las series de 24 meses (año anterior + actual) de cada
// KPI vinculado y del RESULTADO de negocio, y corre lib/stats/validacion. PURO (imports relativos).
// Montos en $ nominales, tal cual (28-sep-2026: sin ajuste por inflación en ningún cálculo).
// ============================================================================
import { validarMapa, type ValidacionMapa } from "./stats/validacion";

export interface KpiHist { plan: string; kpi: string; unit: string; direccion: "up" | "down"; realM: (number | null)[]; histM?: (number | null)[] | null }
export interface MapaMin { objetivos: { id: string; nombre: string }[]; planes: { nombre: string; kpis: { nombre: string; vinculos: Record<string, number> }[] }[] }
export interface ResultadoCandidato { id: string; nombre: string; plan?: string; kpi?: string; serie24: (number | null)[]; nota?: string }
export interface ValidacionPorResultado extends ValidacionMapa { id: string; nota?: string }

/** 24 meses (Ene año−1 … Dic año), valores tal cual (montos en $ nominales). */
export function serie24(k: Pick<KpiHist, "realM" | "histM">): (number | null)[] {
  const h = Array.from({ length: 12 }, (_, i) => k.histM?.[i] ?? null);
  const r = Array.from({ length: 12 }, (_, i) => k.realM[i] ?? null);
  return [...h, ...r];
}

/** Serie mensual "YYYY-MM" → 24 posiciones del eje. */
export function porMesA24(puntos: { mes: string; valor: number }[], anio: number): (number | null)[] {
  const out: (number | null)[] = Array(24).fill(null);
  for (const p of puntos) {
    const y = Number(p.mes.slice(0, 4)), m = Number(p.mes.slice(5, 7)) - 1;
    const idx = (y - (anio - 1)) * 12 + m;
    if (idx >= 0 && idx < 24 && Number.isFinite(p.valor)) out[idx] = p.valor;
  }
  return out;
}

export function validarMapaConDatos(mapa: MapaMin, kpis: KpiHist[], resultados: ResultadoCandidato[]): ValidacionPorResultado[] {
  // Drean: el Mapa y el Seguimiento cruzan los KPIs por NOMBRE (el plan del Mapa puede llamarse
  // distinto que el plan del Seguimiento, ej. Redes Sociales ↔ Instagram).
  const byKey = new Map(kpis.map((k) => [k.kpi, k]));
  const vinculos = mapa.planes.flatMap((p) => p.kpis.flatMap((k) => {
    const ks = byKey.get(k.nombre);
    return Object.entries(k.vinculos ?? {}).filter(([, w]) => w > 0).map(([objetivoId, peso]) => ({
      plan: p.nombre, kpi: k.nombre, objetivoId, peso, direccion: ks?.direccion ?? "up" as const,
      serie: ks ? serie24(ks) : Array(24).fill(null),
    }));
  }));
  return resultados
    .filter((r) => r.serie24.filter((v) => v != null).length >= 13)
    .map((r) => ({ id: r.id, nota: r.nota, ...validarMapa(vinculos, { nombre: r.nombre, serie: r.serie24, plan: r.plan, kpi: r.kpi }) }));
}
