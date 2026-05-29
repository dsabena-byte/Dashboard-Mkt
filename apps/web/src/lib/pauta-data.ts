// Tipos y helpers para Performance Pauta. La data vive en Supabase
// (tabla pauta_performance) y se obtiene vía getPautaPerformance().
// Objetivo: Build = Upper Funnel (Awareness), Consider = Mid Funnel (Consideración)

export interface PautaRow {
  mes: string;
  categoria: string;
  medio: string;
  objetivo: string; // "Build" | "Consider"
  tipo_compra: string; // "CPM" | "CPC" | "CPV"
  alcance_plan: number | null;
  alcance: number | null;
  frecuencia_plan: number | null;
  frecuencia: number | null;
  impresiones_plan: number | null;
  impresiones: number | null;
  clics_plan: number | null;
  clics: number | null;
  views_plan: number | null;
  views: number | null;
  inversion_plan: number | null;
  inversion: number | null;
  costo_plan: number | null;
  costo: number | null;
  ctr_plan: number | null;
  ctr: number | null;
}

// ===== Meses disponibles =====
// Deriva la lista de meses desde la data (orden cronológico ascendente).
// 'Abril 2026' < 'Mayo 2026' por el índice de mes, no por orden alfabético.
const MES_INDEX: Record<string, number> = {
  Enero: 1, Febrero: 2, Marzo: 3, Abril: 4, Mayo: 5, Junio: 6,
  Julio: 7, Agosto: 8, Septiembre: 9, Octubre: 10, Noviembre: 11, Diciembre: 12,
};

function mesKey(mes: string): number {
  const [name, year] = mes.split(" ");
  const m = MES_INDEX[name ?? ""] ?? 0;
  return Number(year ?? 0) * 100 + m;
}

export function extractMeses(rows: PautaRow[]): string[] {
  const set = new Set(rows.map((r) => r.mes));
  return [...set].sort((a, b) => mesKey(a) - mesKey(b));
}

export function defaultMes(meses: string[]): string {
  return meses[meses.length - 1] ?? "";
}

export const PAUTA_CATEGORIAS = ["Todas", "Brand", "Lavado", "Refrigeración", "Cocción", "Promoción"];

// Aprendizajes cualitativos por categoría (Fuente: reportes OMD Abril 2026)
export interface PautaInsight {
  conclusion: string;
  positivos: string[];
  alertas: string[];
}

export const PAUTA_INSIGHTS: Record<string, PautaInsight> = {
  Lavado: {
    conclusion:
      "La eficiencia del CPM ($242 vs $290 plan, -16,5%) y del CPC ($16,67 vs $90 plan, -81,5%) fue el driver central: entregó 120% de las impresiones planificadas y 4,5x el volumen de clics gastando el presupuesto exacto. El modelo CPM (awareness) + CPC (tráfico) funcionó como funnel real complementario.",
    positivos: [
      "CTR de Meta Mid 4,46% vs 0,80% plan (+458%) — creatividad altamente persuasiva.",
      "Mercado Ads: CPM -67% ($1.964 vs $6.000), CTR 1,29% y 19.892 clics (+2.552%).",
      "Google Demand Gen: CPC -80% ($12 vs $60), 195K clics (+397%), CTR 5,08%.",
    ],
    alertas: [
      "CPM de Meta con tendencia alcista: +52% entre el 6/4 ($189) y 30/4 ($287).",
      "TikTok frecuencia 6,44 vs 4,0 plan (+61%) y retención baja: 93,9% abandona antes del 25% del video. Mejorar hook inicial.",
      "74% de los clics de Meta Mid vino de usuarios 45+. Segmento 25-44 subrepresentado.",
    ],
  },
  Brand: {
    conclusion:
      "La campaña Brand de Meta superó el plan en métricas clave sin exceder presupuesto. El CPM -14,4% ($248 vs $290) se tradujo en +720K impresiones adicionales y un alcance 679% superior al plan (2,58M vs 331K planificadas) — Meta optimizó hacia alcance masivo.",
    positivos: [
      "Alcance 679% sobre el plan con frecuencia controlada (2,20x).",
      "Segmento 25-34 es el core: 43,3% de impresiones y 44,3% del alcance.",
      "TV Cable aportó 19,3M de impactos con frecuencia 6,85 (TRP's 195).",
    ],
    alertas: [
      "CPM con tendencia alcista: +26,5% durante el flight ($223 → $282).",
      "Subentrega en público femenino: solo 34,2% de impresiones (frec 1,92x).",
      "El planning de frecuencia 15x no aplica al inventario argentino: Meta entrega ~2,2x naturalmente.",
    ],
  },
  Cocción: {
    conclusion:
      "Ejecución muy eficiente: CPM -18% ($237 vs $290) entregó +22% de impresiones y +11% de alcance sobre lo proyectado. El CPC de Meta Mid -82% ($16 vs $90) generó 54.652 clics (+560%) con CTR 5,37%.",
    positivos: [
      "Google Demand Gen: CPC -87% ($8 vs $60), 127.809 clics (+748%), CTR 6,51%.",
      "Segmento 25-34 concentra el mayor alcance (988K).",
      "Mercado Ads CTR 1,55% con CPM -60%.",
    ],
    alertas: [
      "CPM de Meta con tendencia ascendente en la segunda quincena ($191 → $278).",
      "Google Search consumió solo 25% del presupuesto (baja de búsquedas de categoría).",
      "YouTube CPV subejecutado (53% del presupuesto).",
    ],
  },
  Refrigeración: {
    conclusion:
      "Ejecución altamente eficiente: presupuesto al 100%, impresiones +19,5% sobre el plan y alcance prácticamente en objetivo (+0,6%). CPM -16,3% ($242 vs $290) fue el factor clave. CPC de Meta Mid -60% ($36 vs $90).",
    positivos: [
      "Google Demand Gen: CPC -84% ($9,72), 160.901 clics (+528%), CTR 6,21%.",
      "Segmento 25-34 dominante: 1,51M usuarios únicos (39,6% del alcance).",
      "Mercado Ads: 17.679 clics (+3.118%) con CPM -63%.",
    ],
    alertas: [
      "Pico de CPM el 25/4 ($327, +35% sobre promedio) por mayor competencia.",
      "Tendencia alcista del CPM hacia fin de mes ($196 → $287, +46%).",
      "YouTube CPV subejecutado (53% del presupuesto).",
    ],
  },
  Promoción: {
    conclusion:
      "Campaña Dream Week (6-12 abril). Meta CPM -21,3% ($228 vs $290) generó +27% de impresiones y +16,7% de alcance. CTR de Meta Mid 3,81% vs 0,80% plan (+376%). Inversión ejecutada al 70% del plan (flight más corto).",
    positivos: [
      "Alcance de Meta Build 4,36M con CPM eficiente ($228).",
      "TikTok alcanzó 3,1M de personas con CPM -35%.",
      "YouTube CPV -43,6% ($1,41 vs $2,50) con VTR 94,99%.",
    ],
    alertas: [
      "Google Demand Gen sobreejecutado (178%) con CPC +17% ($70 vs $60) — único medio por encima del costo plan.",
      "Google Search consumió solo 2% del presupuesto (144 clics).",
      "Frecuencias bajas (1,3-1,8x) por flight corto de 1 semana.",
    ],
  },
};

// Colores por plataforma
export const MEDIO_COLORS: Record<string, string> = {
  "TV Cable": "#7C3AED",
  DOOH: "#EC4899",
  Meta: "#0866FF",
  TikTok: "#000000",
  YouTube: "#FF0000",
  Programmatic: "#4285F4",
  "Mercado Ads": "#FFE600",
  "Google Demand Gen": "#34A853",
  "Geo Mobile": "#9333EA",
  "Google Search": "#FBBC05",
};

export const CATEGORIA_COLORS: Record<string, string> = {
  Brand: "#0a1849",
  Lavado: "#2b4dff",
  Refrigeración: "#06b6d4",
  Cocción: "#f59e0b",
  Promoción: "#e63946",
};

export function investmentByCategoria(rows: PautaRow[]): Array<{ name: string; value: number; color: string }> {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.categoria, (map.get(r.categoria) ?? 0) + (r.inversion ?? 0));
  return [...map.entries()]
    .map(([name, value]) => ({ name, value, color: CATEGORIA_COLORS[name] ?? "#94a3b8" }))
    .sort((a, b) => b.value - a.value);
}

export interface FunnelTotals {
  alcance: number;
  impresiones: number;
  clics: number;
  views: number;
  inversion: number;
  inversion_plan: number;
  frecuenciaPond: number;
  cpm: number;
  cpc: number;
  ctr: number;
}

function emptyTotals(): FunnelTotals {
  return { alcance: 0, impresiones: 0, clics: 0, views: 0, inversion: 0, inversion_plan: 0, frecuenciaPond: 0, cpm: 0, cpc: 0, ctr: 0 };
}

// Build = upper funnel; Consider = mid funnel.
function isUpper(objetivo: string): boolean {
  return objetivo === "Build";
}
function isMid(objetivo: string): boolean {
  return objetivo === "Consider";
}

export function computeFunnel(rows: PautaRow[], stage: "upper" | "mid"): FunnelTotals {
  const t = emptyTotals();
  let freqWeightSum = 0;
  let freqReachSum = 0;
  for (const r of rows) {
    const inStage = stage === "upper" ? isUpper(r.objetivo) : isMid(r.objetivo);
    if (!inStage) continue;
    t.alcance += r.alcance ?? 0;
    t.impresiones += r.impresiones ?? 0;
    t.clics += r.clics ?? 0;
    t.views += r.views ?? 0;
    t.inversion += r.inversion ?? 0;
    t.inversion_plan += r.inversion_plan ?? 0;
    if (r.frecuencia != null && r.alcance != null) {
      freqWeightSum += r.frecuencia * r.alcance;
      freqReachSum += r.alcance;
    }
  }
  t.frecuenciaPond = freqReachSum > 0 ? freqWeightSum / freqReachSum : 0;
  t.cpm = t.impresiones > 0 ? (t.inversion / t.impresiones) * 1000 : 0;
  t.cpc = t.clics > 0 ? t.inversion / t.clics : 0;
  t.ctr = t.impresiones > 0 ? (t.clics / t.impresiones) * 100 : 0;
  return t;
}

export interface MedioAggregate {
  medio: string;
  inversion: number;
  impresiones: number;
  alcance: number;
  clics: number;
  cpm: number;
  cpc: number;
}

export function computeByMedio(rows: PautaRow[]): MedioAggregate[] {
  const map = new Map<string, MedioAggregate>();
  for (const r of rows) {
    const m = map.get(r.medio) ?? { medio: r.medio, inversion: 0, impresiones: 0, alcance: 0, clics: 0, cpm: 0, cpc: 0 };
    m.inversion += r.inversion ?? 0;
    m.impresiones += r.impresiones ?? 0;
    m.alcance += r.alcance ?? 0;
    m.clics += r.clics ?? 0;
    map.set(r.medio, m);
  }
  const arr = [...map.values()];
  for (const m of arr) {
    m.cpm = m.impresiones > 0 ? (m.inversion / m.impresiones) * 1000 : 0;
    m.cpc = m.clics > 0 ? m.inversion / m.clics : 0;
  }
  return arr.sort((a, b) => b.inversion - a.inversion);
}

// ===== Ranking de eficiencia (costo real vs plan) =====
export interface EfficiencyRow {
  medio: string;
  objetivo: string;
  etapa: string;
  tipo_compra: string;
  costo_plan: number;
  costo: number;
  varPct: number;
}

export function computeEfficiency(rows: PautaRow[]): EfficiencyRow[] {
  return rows
    .filter((r) => r.costo != null && r.costo_plan != null && r.costo_plan > 0)
    .map((r) => ({
      medio: r.medio,
      objetivo: r.objetivo,
      etapa: r.objetivo === "Build" ? "Upper" : "Mid",
      tipo_compra: r.tipo_compra,
      costo_plan: r.costo_plan!,
      costo: r.costo!,
      varPct: ((r.costo! - r.costo_plan!) / r.costo_plan!) * 100,
    }))
    .sort((a, b) => a.varPct - b.varPct);
}

// ===== Cumplimiento de volumen (KPI principal real vs plan) =====
export interface FulfillmentRow {
  medio: string;
  etapa: string;
  kpi: string;
  plan: number;
  real: number;
  pct: number;
}

export function computeFulfillment(rows: PautaRow[]): FulfillmentRow[] {
  const out: FulfillmentRow[] = [];
  for (const r of rows) {
    // KPI principal: CPM/TRP/OOH → impresiones; CPC → clics; CPV → views
    let kpi = "Impresiones";
    let plan = r.impresiones_plan;
    let real = r.impresiones;
    if (r.tipo_compra === "CPC") {
      kpi = "Clics";
      plan = r.clics_plan;
      real = r.clics;
    } else if (r.tipo_compra === "CPV") {
      kpi = "Views";
      plan = r.views_plan;
      real = r.views;
    }
    if (plan == null || real == null || plan === 0) continue;
    out.push({
      medio: r.medio,
      etapa: r.objetivo === "Build" ? "Upper" : "Mid",
      kpi,
      plan,
      real,
      pct: (real / plan) * 100,
    });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

// ===== Alcance por medio (upper) y acciones por medio (mid) =====
export function reachByMedio(rows: PautaRow[]): Array<{ medio: string; alcance: number }> {
  const map = new Map<string, number>();
  for (const r of rows) {
    if (r.objetivo === "Consider") continue;
    map.set(r.medio, (map.get(r.medio) ?? 0) + (r.alcance ?? 0));
  }
  return [...map.entries()].map(([medio, alcance]) => ({ medio, alcance })).filter((x) => x.alcance > 0).sort((a, b) => b.alcance - a.alcance);
}
