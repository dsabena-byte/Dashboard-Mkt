import { type PautaRow } from "@/lib/pauta-data";

// =============================================================================
// Análisis de Pauta — Mix óptimo de inversión para maximizar
// alcance / impresiones / impacto.
//
// Heurísticas (sin LLM):
//   1. Eficiencia por medio: CPM/CPC/CPV real vs plan, ranking.
//   2. Cumplimiento volumétrico: % entregado del KPI principal vs plan.
//   3. Recomendación de reasignación: si un medio tiene CPM 30%+ peor que el
//      promedio del stage, sugerimos mover X% de su presupuesto a los más
//      eficientes (ranking top 3).
//   4. Alertas: medios con CPM > 50% del plan, frecuencia > 8 (saturación),
//      CTR < 0.5% (creativo débil).
// =============================================================================

export interface MedioEfficiency {
  medio: string;
  stage: "upper" | "mid";       // upper = awareness (CPM/CPV); mid = consideración (CPC)
  tipo_compra: string;          // CPM | CPC | CPV | TRP | OOH
  inversion: number;
  inversion_plan: number;
  alcance: number;
  impresiones: number;
  clics: number;
  views: number;
  cpm_real: number | null;
  cpm_plan: number | null;
  cpc_real: number | null;
  cpc_plan: number | null;
  cpv_real: number | null;
  cpv_plan: number | null;
  ctr: number;
  frecuencia: number | null;
  // Métrica unificada de eficiencia: ratio entre KPI real entregado y plan.
  delivery_pct: number;         // 100% = entregó lo prometido, > 100 = sobreentrega
  // Costo unitario real vs plan en la métrica principal del medio
  cost_overrun_pct: number | null;
}

export interface PautaInsight {
  signal_key: string;
  prioridad: "alta" | "media" | "baja";
  tipo: "alerta" | "oportunidad" | "info";
  titulo: string;
  descripcion: string;
  acciones: string[];
  datos: Record<string, unknown>;
}

function isMid(objetivo: string): boolean {
  return objetivo === "Consideración";
}

// Agrega filas por (medio, tipo_compra) y devuelve métricas calculadas
export function computeMedioEfficiency(rows: PautaRow[]): MedioEfficiency[] {
  const map = new Map<string, MedioEfficiency>();
  for (const r of rows) {
    const key = `${r.medio}|${r.tipo_compra}|${r.objetivo}`;
    const stage: "upper" | "mid" = isMid(r.objetivo) ? "mid" : "upper";
    const acc = map.get(key) ?? {
      medio: r.medio,
      stage,
      tipo_compra: r.tipo_compra,
      inversion: 0, inversion_plan: 0,
      alcance: 0, impresiones: 0, clics: 0, views: 0,
      cpm_real: null, cpm_plan: null,
      cpc_real: null, cpc_plan: null,
      cpv_real: null, cpv_plan: null,
      ctr: 0, frecuencia: null,
      delivery_pct: 0, cost_overrun_pct: null,
    };
    acc.inversion += r.inversion ?? 0;
    acc.inversion_plan += r.inversion_plan ?? 0;
    acc.alcance += r.alcance ?? 0;
    acc.impresiones += r.impresiones ?? 0;
    acc.clics += r.clics ?? 0;
    acc.views += r.views ?? 0;
    if (r.frecuencia != null && acc.frecuencia == null) acc.frecuencia = r.frecuencia;
    map.set(key, acc);
  }
  // Cálculo de métricas derivadas
  const result: MedioEfficiency[] = [];
  for (const acc of map.values()) {
    if (acc.impresiones > 0) acc.cpm_real = (acc.inversion / acc.impresiones) * 1000;
    if (acc.clics > 0) acc.cpc_real = acc.inversion / acc.clics;
    if (acc.views > 0) acc.cpv_real = acc.inversion / acc.views;
    if (acc.impresiones > 0) acc.ctr = (acc.clics / acc.impresiones) * 100;
    // Delivery: comparamos KPI real vs plan según tipo de compra
    if (acc.tipo_compra === "CPC") {
      acc.delivery_pct = acc.inversion_plan > 0 ? (acc.clics / Math.max(1, acc.inversion_plan / (acc.cpc_real ?? 1))) * 100 : 0;
    } else if (acc.tipo_compra === "CPV") {
      acc.delivery_pct = acc.inversion_plan > 0 ? (acc.views / Math.max(1, acc.inversion_plan / (acc.cpv_real ?? 1))) * 100 : 0;
    } else {
      acc.delivery_pct = acc.inversion_plan > 0 ? (acc.impresiones / Math.max(1, acc.inversion_plan / ((acc.cpm_real ?? 0) / 1000))) * 100 : 0;
    }
    // Cost overrun: real vs plan en la métrica principal
    if (acc.tipo_compra === "CPC" && acc.cpc_plan && acc.cpc_real) {
      acc.cost_overrun_pct = ((acc.cpc_real - acc.cpc_plan) / acc.cpc_plan) * 100;
    } else if (acc.tipo_compra === "CPV" && acc.cpv_plan && acc.cpv_real) {
      acc.cost_overrun_pct = ((acc.cpv_real - acc.cpv_plan) / acc.cpv_plan) * 100;
    } else if (acc.cpm_plan && acc.cpm_real) {
      acc.cost_overrun_pct = ((acc.cpm_real - acc.cpm_plan) / acc.cpm_plan) * 100;
    }
    result.push(acc);
  }
  // Cost overrun usando promedio de cost_plan por fila (calculado aparte)
  return result.sort((a, b) => b.inversion - a.inversion);
}

// Calcula el promedio de la métrica principal por stage para usar como referencia
function avgCostByStage(efs: MedioEfficiency[]): { upper_cpm: number; mid_cpc: number } {
  let cpmSum = 0, cpmCount = 0;
  let cpcSum = 0, cpcCount = 0;
  for (const e of efs) {
    if (e.stage === "upper" && e.cpm_real != null && e.cpm_real > 0) {
      cpmSum += e.cpm_real; cpmCount++;
    }
    if (e.stage === "mid" && e.cpc_real != null && e.cpc_real > 0) {
      cpcSum += e.cpc_real; cpcCount++;
    }
  }
  return {
    upper_cpm: cpmCount > 0 ? cpmSum / cpmCount : 0,
    mid_cpc: cpcCount > 0 ? cpcSum / cpcCount : 0,
  };
}

function fmtPct(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(0)}%`;
}

function fmtARS(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

// ============================================================================
// Reglas de insights

function ruleCpmOutlier(e: MedioEfficiency, avgCpm: number): PautaInsight | null {
  if (e.stage !== "upper" || !e.cpm_real || avgCpm === 0) return null;
  const deltaVsAvg = ((e.cpm_real - avgCpm) / avgCpm) * 100;
  if (deltaVsAvg <= 25) return null; // solo flag si CPM > 25% más caro que el promedio
  const prioridad = deltaVsAvg > 50 ? "alta" : "media";
  return {
    signal_key: `cpm_outlier_${e.medio}_${e.tipo_compra}`,
    prioridad,
    tipo: "alerta",
    titulo: `${e.medio} (${e.tipo_compra}): CPM ${fmtARS(e.cpm_real)} es ${fmtPct(deltaVsAvg)} sobre el promedio del stage`,
    descripcion: `Pagaste ${fmtARS(e.inversion)} en ${e.medio} para ${e.impresiones.toLocaleString()} impresiones. El CPM promedio Awareness fue ${fmtARS(avgCpm)} — ${e.medio} salió ${fmtPct(deltaVsAvg)} más caro.`,
    acciones: [
      `Reducir asignación a ${e.medio} próximo mes y mover esa inversión a los medios top en CPM (ver tabla abajo)`,
      "Validar si la creatividad es la causa (formato, hook, calidad)",
      "Renegociar tarifa con OMD si es un medio comprado directo",
    ],
    datos: { medio: e.medio, cpm_real: e.cpm_real, cpm_avg: avgCpm, delta_pct: deltaVsAvg, inversion: e.inversion },
  };
}

function ruleCpcOutlier(e: MedioEfficiency, avgCpc: number): PautaInsight | null {
  if (e.stage !== "mid" || !e.cpc_real || avgCpc === 0) return null;
  const delta = ((e.cpc_real - avgCpc) / avgCpc) * 100;
  if (delta <= 25) return null;
  const prioridad = delta > 50 ? "alta" : "media";
  return {
    signal_key: `cpc_outlier_${e.medio}`,
    prioridad,
    tipo: "alerta",
    titulo: `${e.medio} CPC ${fmtARS(e.cpc_real)} es ${fmtPct(delta)} sobre el promedio Consideración`,
    descripcion: `CPC real ${fmtARS(e.cpc_real)} vs ${fmtARS(avgCpc)} promedio del stage. ${e.clics.toLocaleString()} clics traídos.`,
    acciones: [
      `Probar segmentación más estricta para bajar el CPC`,
      `Revisar copy y CTA — si el CTR es bajo, mejorar creativo`,
      `Reasignar parte del presupuesto a medios con CPC más bajo`,
    ],
    datos: { medio: e.medio, cpc_real: e.cpc_real, cpc_avg: avgCpc, delta_pct: delta },
  };
}

function ruleBestPerformer(efs: MedioEfficiency[], stage: "upper" | "mid"): PautaInsight | null {
  const filtered = efs.filter((e) => e.stage === stage && e.inversion > 100_000); // mínimo 100K para ser representativo
  if (filtered.length < 2) return null;
  const sorted = stage === "upper"
    ? filtered.filter((e) => e.cpm_real != null).sort((a, b) => (a.cpm_real ?? Infinity) - (b.cpm_real ?? Infinity))
    : filtered.filter((e) => e.cpc_real != null).sort((a, b) => (a.cpc_real ?? Infinity) - (b.cpc_real ?? Infinity));
  if (sorted.length === 0) return null;
  const best = sorted[0]!;
  const stageLabel = stage === "upper" ? "Awareness" : "Consideración";
  const metricLabel = stage === "upper" ? "CPM" : "CPC";
  const metricValue = stage === "upper" ? best.cpm_real! : best.cpc_real!;
  return {
    signal_key: `best_performer_${stage}`,
    prioridad: "media",
    tipo: "oportunidad",
    titulo: `${best.medio} es el medio más eficiente en ${stageLabel} (${metricLabel} ${fmtARS(metricValue)})`,
    descripcion: `Con ${fmtARS(best.inversion)} de inversión generó ${stage === "upper" ? best.impresiones.toLocaleString() + " impresiones" : best.clics.toLocaleString() + " clics"}. Es el mejor ratio del período.`,
    acciones: [
      `Aumentar asignación a ${best.medio} para el próximo mes`,
      `Si el inventario lo permite, doblar la apuesta en ${best.medio}`,
      `Replicar formato/segmentación en medios menos eficientes`,
    ],
    datos: { medio: best.medio, [metricLabel.toLowerCase() + "_real"]: metricValue, inversion: best.inversion },
  };
}

function ruleFrequencyHigh(e: MedioEfficiency): PautaInsight | null {
  if (e.frecuencia == null || e.frecuencia < 8) return null;
  return {
    signal_key: `frequency_high_${e.medio}`,
    prioridad: "media",
    tipo: "alerta",
    titulo: `${e.medio} con frecuencia ${e.frecuencia.toFixed(2)} — riesgo de saturación`,
    descripcion: `Frecuencia mayor a 8 significa que el promedio de la audiencia ya vio el aviso 8+ veces. Diminish returns y posible rechazo.`,
    acciones: [
      "Ampliar la segmentación para llegar a nueva audiencia",
      "Refrescar creativos (variantes con distintos hooks)",
      "Considerar pausar y reasignar a otro medio",
    ],
    datos: { medio: e.medio, frecuencia: e.frecuencia },
  };
}

function ruleCtrLow(e: MedioEfficiency): PautaInsight | null {
  if (e.impresiones < 10_000 || e.ctr === 0) return null;
  if (e.ctr >= 0.5) return null;
  return {
    signal_key: `ctr_low_${e.medio}`,
    prioridad: "media",
    tipo: "alerta",
    titulo: `${e.medio} CTR ${e.ctr.toFixed(2)}% — creativo débil`,
    descripcion: `Con ${e.impresiones.toLocaleString()} impresiones generó solo ${e.clics.toLocaleString()} clics. CTR < 0.5% indica problema creativo o de segmentación.`,
    acciones: [
      "Revisar copy + creativo principal — A/B test con variantes",
      "Validar si la segmentación es muy amplia (poca afinidad)",
      "Probar otro formato (carrousel vs video vs estático)",
    ],
    datos: { medio: e.medio, ctr: e.ctr, impresiones: e.impresiones, clics: e.clics },
  };
}

function ruleMixRecommendation(efs: MedioEfficiency[]): PautaInsight | null {
  // Si encontramos un medio con cost_overrun > 30% en su stage Y otro
  // del mismo stage con cost_overrun < -20% (mejor que plan), sugerimos
  // reasignar.
  const upperOver = efs.find((e) => e.stage === "upper" && (e.cost_overrun_pct ?? 0) > 30 && e.inversion > 500_000);
  const upperUnder = efs.filter((e) => e.stage === "upper" && (e.cost_overrun_pct ?? 0) < -20 && e.inversion > 100_000)
    .sort((a, b) => (a.cost_overrun_pct ?? 0) - (b.cost_overrun_pct ?? 0))[0];
  if (!upperOver || !upperUnder) return null;
  const reallocation = upperOver.inversion * 0.3; // sugerimos mover 30% del overrun
  return {
    signal_key: `mix_realloc_${upperOver.medio}_to_${upperUnder.medio}`,
    prioridad: "alta",
    tipo: "oportunidad",
    titulo: `Mix óptimo: mover ${fmtARS(reallocation)} de ${upperOver.medio} a ${upperUnder.medio}`,
    descripcion: `${upperOver.medio} salió ${fmtPct(upperOver.cost_overrun_pct ?? 0)} más caro que plan, mientras ${upperUnder.medio} fue ${fmtPct(upperUnder.cost_overrun_pct ?? 0)} (más barato). Una reasignación del 30% del presupuesto sobreejecutado liberaría inversión más eficiente.`,
    acciones: [
      `Próximo mes: reducir ${upperOver.medio} a ${fmtARS(upperOver.inversion * 0.7)} y subir ${upperUnder.medio} en ${fmtARS(reallocation)}`,
      "Validar que el inventario en el medio destino permita el aumento",
      "Si las creatividades funcionan mejor en un medio que otro, considerar adaptar",
    ],
    datos: {
      from: upperOver.medio,
      to: upperUnder.medio,
      reallocation,
      from_overrun: upperOver.cost_overrun_pct,
      to_overrun: upperUnder.cost_overrun_pct,
    },
  };
}

// ============================================================================
// Entry point

export function computePautaInsights(rows: PautaRow[]): {
  efficiency: MedioEfficiency[];
  insights: PautaInsight[];
  benchmarks: { upper_cpm: number; mid_cpc: number };
} {
  const efficiency = computeMedioEfficiency(rows);
  const benchmarks = avgCostByStage(efficiency);

  const insights: PautaInsight[] = [];

  // Reglas por medio
  for (const e of efficiency) {
    const r1 = ruleCpmOutlier(e, benchmarks.upper_cpm); if (r1) insights.push(r1);
    const r2 = ruleCpcOutlier(e, benchmarks.mid_cpc); if (r2) insights.push(r2);
    const r3 = ruleFrequencyHigh(e); if (r3) insights.push(r3);
    const r4 = ruleCtrLow(e); if (r4) insights.push(r4);
  }
  // Reglas globales
  const r5 = ruleBestPerformer(efficiency, "upper"); if (r5) insights.push(r5);
  const r6 = ruleBestPerformer(efficiency, "mid"); if (r6) insights.push(r6);
  const r7 = ruleMixRecommendation(efficiency); if (r7) insights.push(r7);

  // Ordenar
  const prioOrder: Record<string, number> = { alta: 0, media: 1, baja: 2 };
  const tipoOrder: Record<string, number> = { alerta: 0, oportunidad: 1, info: 2 };
  insights.sort((a, b) =>
    (prioOrder[a.prioridad] ?? 9) - (prioOrder[b.prioridad] ?? 9) ||
    (tipoOrder[a.tipo] ?? 9) - (tipoOrder[b.tipo] ?? 9)
  );

  return { efficiency, insights, benchmarks };
}
