// Datos de performance de pauta digital — Abril 2026
// Fuente: Control Digital_Abril.xlsx (OMD)
// Objetivo: Build = Upper Funnel (Awareness), Consider = Mid Funnel (Consideración)

export interface PautaRow {
  mes: string;
  categoria: string;
  medio: string;
  objetivo: string; // "Build" | "Consider" | "Build & Consider"
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

type RawRow = Omit<PautaRow, "mes">;

// ===== ABRIL 2026 — Fuente: Control Digital_Abril.xlsx (OMD) =====
const ABRIL_2026: RawRow[] = [
  // ===== BRAND =====
  // TV Cable (medio offline, período 13-30/4). Impactos=impresiones, alcance=impactos/frecuencia.
  { categoria: "Brand", medio: "TV Cable", objetivo: "Build", tipo_compra: "TRP", alcance_plan: null, alcance: 2817518, frecuencia_plan: null, frecuencia: 6.85, impresiones_plan: null, impresiones: 19300000, clics_plan: null, clics: null, views_plan: null, views: null, inversion_plan: 65253780, inversion: 65253780, costo_plan: null, costo: null, ctr_plan: null, ctr: null },
  { categoria: "Brand", medio: "Meta", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 331617, alcance: 2584074, frecuencia_plan: 15, frecuencia: 2.20, impresiones_plan: 4974262, impresiones: 5695747, clics_plan: 7461, clics: 2243, views_plan: null, views: null, inversion_plan: 1442536, inversion: 1414405.57, costo_plan: 290, costo: 248.33, ctr_plan: 0.15, ctr: 0.04 },
  { categoria: "Brand", medio: "TikTok", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 133333, alcance: 662680, frecuencia_plan: 15, frecuencia: 4.91, impresiones_plan: 2000000, impresiones: 3252934, clics_plan: 3000, clics: 3484, views_plan: null, views: null, inversion_plan: 1000000, inversion: 999826.71, costo_plan: 500, costo: 307.36, ctr_plan: 0.15, ctr: 0.11 },
  { categoria: "Brand", medio: "YouTube", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 740741, alcance: 1278104, frecuencia_plan: 1.5, frecuencia: 0.98, impresiones_plan: 1111111, impresiones: 1248123, clics_plan: 3000, clics: 1245, views_plan: null, views: null, inversion_plan: 1000000, inversion: 987154, costo_plan: 900, costo: 790.91, ctr_plan: 0.15, ctr: 0.10 },
  { categoria: "Brand", medio: "YouTube", objetivo: "Build & Consider", tipo_compra: "CPV", alcance_plan: 1142857, alcance: 1550013, frecuencia_plan: 1.5, frecuencia: 1.29, impresiones_plan: 1714286, impresiones: 1992900, clics_plan: 3000, clics: 2619, views_plan: 1200000, views: 1306329, inversion_plan: 3000000, inversion: 2958346.79, costo_plan: 2.50, costo: 2.26, ctr_plan: 0.15, ctr: 0.13 },
  { categoria: "Brand", medio: "Programmatic", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 277778, alcance: 642704, frecuencia_plan: 4, frecuencia: 2.08, impresiones_plan: 1111111, impresiones: 1338987, clics_plan: 3000, clics: 3189, views_plan: null, views: null, inversion_plan: 2000000, inversion: 2003216.20, costo_plan: 1800, costo: 1496.07, ctr_plan: 0.15, ctr: 0.24 },

  // ===== COCCIÓN =====
  { categoria: "Cocción", medio: "Meta", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 2525724, alcance: 2797395, frecuencia_plan: 2, frecuencia: 2.21, impresiones_plan: 5051448, impresiones: 6172573, clics_plan: 7577, clics: 2695, views_plan: null, views: null, inversion_plan: 1464920, inversion: 1464784, costo_plan: 290, costo: 237.31, ctr_plan: 0.15, ctr: 0.04 },
  { categoria: "Cocción", medio: "Meta", objetivo: "Consider", tipo_compra: "CPC", alcance_plan: 67820, alcance: 389329, frecuencia_plan: 18, frecuencia: 2.61, impresiones_plan: 1220767, impresiones: 1016878, clics_plan: 9766, clics: 54652, views_plan: null, views: null, inversion_plan: 878952, inversion: 878832, costo_plan: 90, costo: 16.08, ctr_plan: 0.80, ctr: 5.37 },
  { categoria: "Cocción", medio: "TikTok", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 366118, alcance: 485386, frecuencia_plan: 4, frecuencia: 5.12, impresiones_plan: 1464471, impresiones: 2485367, clics_plan: 2197, clics: 2050, views_plan: null, views: null, inversion_plan: 732235.72, inversion: 732195, costo_plan: 500, costo: 294.60, ctr_plan: 0.15, ctr: 0.08 },
  { categoria: "Cocción", medio: "YouTube", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 542563, alcance: 893884, frecuencia_plan: 1.5, frecuencia: 0.90, impresiones_plan: 813844, impresiones: 807550, clics_plan: 1221, clics: 8620, views_plan: null, views: null, inversion_plan: 732460, inversion: 729146, costo_plan: 900, costo: 902.91, ctr_plan: 0.15, ctr: 1.07 },
  { categoria: "Cocción", medio: "YouTube", objetivo: "Build & Consider", tipo_compra: "CPV", alcance_plan: 1436459, alcance: 1140014, frecuencia_plan: 1.5, frecuencia: 1.40, impresiones_plan: 2154688, impresiones: 1598740, clics_plan: 3232, clics: null, views_plan: 1508282, views: 1096756, inversion_plan: 3770704.08, inversion: 2012787.63, costo_plan: 2.50, costo: 1.84, ctr_plan: 0.15, ctr: 0.00 },
  { categoria: "Cocción", medio: "Programmatic", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 305175, alcance: null, frecuencia_plan: 4, frecuencia: null, impresiones_plan: 1220699, impresiones: 1376071, clics_plan: 1831, clics: 1430, views_plan: null, views: null, inversion_plan: 2197259, inversion: 2197211.57, costo_plan: 1800, costo: 1596.73, ctr_plan: 0.15, ctr: 0.10 },
  { categoria: "Cocción", medio: "Mercado Ads", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 24415, alcance: 190863, frecuencia_plan: 10, frecuencia: 2, impresiones_plan: 244153, impresiones: 314403, clics_plan: 366, clics: 4882, views_plan: null, views: null, inversion_plan: 1464920, inversion: 750668, costo_plan: 6000, costo: 2387.60, ctr_plan: 0.15, ctr: 1.55 },
  { categoria: "Cocción", medio: "Google Demand Gen", objetivo: "Consider", tipo_compra: "CPC", alcance_plan: null, alcance: 772223, frecuencia_plan: null, frecuencia: 2.54, impresiones_plan: 1709073, impresiones: 1963083, clics_plan: 17091, clics: 127809, views_plan: null, views: null, inversion_plan: 1025444, inversion: 1024872, costo_plan: 60, costo: 8.02, ctr_plan: 1.00, ctr: 6.51 },
  { categoria: "Cocción", medio: "Geo Mobile", objetivo: "Consider", tipo_compra: "CPC", alcance_plan: null, alcance: null, frecuencia_plan: null, frecuencia: null, impresiones_plan: 205089, impresiones: 370166, clics_plan: 2051, clics: 2058, views_plan: null, views: null, inversion_plan: 717810.80, inversion: 717810.80, costo_plan: 350, costo: 348.79, ctr_plan: 1.00, ctr: 0.56 },
  { categoria: "Cocción", medio: "Google Search", objetivo: "Consider", tipo_compra: "CPC", alcance_plan: null, alcance: null, frecuencia_plan: null, frecuencia: null, impresiones_plan: 52319, impresiones: 56285, clics_plan: 523, clics: 1318, views_plan: null, views: null, inversion_plan: 292984, inversion: 72814, costo_plan: 560, costo: 55.25, ctr_plan: 1.00, ctr: 2.34 },

  // ===== LAVADO =====
  // DOOH (vía pública digital, medio offline). Impactos=impresiones, alcance 1.94M, frecuencia 8.8.
  { categoria: "Lavado", medio: "DOOH", objetivo: "Build", tipo_compra: "OOH", alcance_plan: null, alcance: 1940000, frecuencia_plan: null, frecuencia: 8.8, impresiones_plan: null, impresiones: 17000000, clics_plan: null, clics: null, views_plan: null, views: null, inversion_plan: 22500000, inversion: 22500000, costo_plan: null, costo: null, ctr_plan: null, ctr: null },
  { categoria: "Lavado", medio: "Meta", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 5789172, alcance: 5299938, frecuencia_plan: 2, frecuencia: 2.62, impresiones_plan: 11578345, impresiones: 13869699, clics_plan: 17368, clics: 658, views_plan: null, views: null, inversion_plan: 3357720, inversion: 3357435, costo_plan: 290, costo: 242.07, ctr_plan: 0.15, ctr: 0.00 },
  { categoria: "Lavado", medio: "Meta", objetivo: "Consider", tipo_compra: "CPC", alcance_plan: 120429, alcance: 638592, frecuencia_plan: 18, frecuencia: 2.73, impresiones_plan: 2167722, impresiones: 1740214, clics_plan: 17342, clics: 77654, views_plan: null, views: null, inversion_plan: 1560760, inversion: 1560476, costo_plan: 90, costo: 20.10, ctr_plan: 0.80, ctr: 4.46 },
  { categoria: "Lavado", medio: "TikTok", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 1218192, alcance: 1160405, frecuencia_plan: 4, frecuencia: 6.44, impresiones_plan: 4872768, impresiones: 7471551, clics_plan: 7309, clics: 6754, views_plan: null, views: null, inversion_plan: 2436384.05, inversion: 2435959, costo_plan: 500, costo: 326.03, ctr_plan: 0.15, ctr: 0.09 },
  { categoria: "Lavado", medio: "YouTube", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 2199852, alcance: 3029247, frecuencia_plan: 1.5, frecuencia: 1.02, impresiones_plan: 3299778, impresiones: 3083213, clics_plan: 4950, clics: 1381, views_plan: null, views: null, inversion_plan: 2969800, inversion: 2788944, costo_plan: 900, costo: 904.56, ctr_plan: 0.15, ctr: 0.04 },
  { categoria: "Lavado", medio: "YouTube", objetivo: "Build & Consider", tipo_compra: "CPV", alcance_plan: 2671398, alcance: 2734476, frecuencia_plan: 1.5, frecuencia: 1.97, impresiones_plan: 4007097, impresiones: 5389939, clics_plan: 6011, clics: 5298, views_plan: 2804968, views: 3717310, inversion_plan: 7012420, inversion: 7012771, costo_plan: 2.50, costo: 1.89, ctr_plan: 0.15, ctr: 0.10 },
  { categoria: "Lavado", medio: "Programmatic", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 556944, alcance: 642704, frecuencia_plan: 4, frecuencia: 3.89, impresiones_plan: 2227778, impresiones: 2498743, clics_plan: 3342, clics: 2920, views_plan: null, views: null, inversion_plan: 4010000, inversion: 3991059.02, costo_plan: 1800, costo: 1597.23, ctr_plan: 0.15, ctr: 0.12 },
  { categoria: "Lavado", medio: "Mercado Ads", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 250000, alcance: 767735, frecuencia_plan: 2, frecuencia: 2, impresiones_plan: 500000, impresiones: 1538115, clics_plan: 750, clics: 19892, views_plan: null, views: null, inversion_plan: 3000000, inversion: 3020934, costo_plan: 6000, costo: 1964.05, ctr_plan: 0.15, ctr: 1.29 },
  { categoria: "Lavado", medio: "Google Demand Gen", objetivo: "Consider", tipo_compra: "CPC", alcance_plan: null, alcance: 1606671, frecuencia_plan: null, frecuencia: 2.39, impresiones_plan: 3929533, impresiones: 3843913, clics_plan: 39295, clics: 195407, views_plan: null, views: null, inversion_plan: 2357720, inversion: 2355730, costo_plan: 60, costo: 12.06, ctr_plan: 1.00, ctr: 5.08 },
  { categoria: "Lavado", medio: "Geo Mobile", objetivo: "Consider", tipo_compra: "CPC", alcance_plan: null, alcance: null, frecuencia_plan: null, frecuencia: null, impresiones_plan: 557169, impresiones: 1421503, clics_plan: 5572, clics: 5602, views_plan: null, views: null, inversion_plan: 1950090, inversion: 1950090, costo_plan: 350, costo: 348.11, ctr_plan: 1.00, ctr: 0.39 },
  { categoria: "Lavado", medio: "Google Search", objetivo: "Consider", tipo_compra: "CPC", alcance_plan: null, alcance: null, frecuencia_plan: null, frecuencia: null, impresiones_plan: 104986, impresiones: 313048, clics_plan: 1050, clics: 6061, views_plan: null, views: null, inversion_plan: 587920, inversion: 315000, costo_plan: 560, costo: 51.97, ctr_plan: 1.00, ctr: 1.94 },

  // ===== REFRIGERACIÓN =====
  { categoria: "Refrigeración", medio: "Meta", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 3788586, alcance: 3812410, frecuencia_plan: 2, frecuencia: 2.38, impresiones_plan: 7577172, impresiones: 9056344, clics_plan: 11366, clics: 3326, views_plan: null, views: null, inversion_plan: 2197380, inversion: 2197130.42, costo_plan: 290, costo: 242.61, ctr_plan: 0.15, ctr: 0.04 },
  { categoria: "Refrigeración", medio: "Meta", objetivo: "Consider", tipo_compra: "CPC", alcance_plan: 915575, alcance: 551469, frecuencia_plan: 2, frecuencia: 2.20, impresiones_plan: 1831150, impresiones: 1213701, clics_plan: 14649, clics: 36518, views_plan: null, views: null, inversion_plan: 1318428, inversion: 1318322.50, costo_plan: 90, costo: 36.10, ctr_plan: 0.80, ctr: 3.01 },
  { categoria: "Refrigeración", medio: "TikTok", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 549177, alcance: 627860, frecuencia_plan: 4, frecuencia: 5.67, impresiones_plan: 2196707, impresiones: 3557516, clics_plan: 3295, clics: 2941, views_plan: null, views: null, inversion_plan: 1098353.59, inversion: 1098069, costo_plan: 500, costo: 308.66, ctr_plan: 0.15, ctr: 0.08 },
  { categoria: "Refrigeración", medio: "YouTube", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 813682, alcance: 1250559, frecuencia_plan: 1.5, frecuencia: 0.97, impresiones_plan: 1220523, impresiones: 1208880, clics_plan: 1831, clics: 586, views_plan: null, views: null, inversion_plan: 1098470.26, inversion: 1090897, costo_plan: 900, costo: 902.40, ctr_plan: 0.15, ctr: 0.05 },
  { categoria: "Refrigeración", medio: "YouTube", objetivo: "Build & Consider", tipo_compra: "CPV", alcance_plan: 2154688, alcance: 1269795, frecuencia_plan: 1.5, frecuencia: 1.72, impresiones_plan: 3232032, impresiones: 2185462, clics_plan: 4848, clics: 2581, views_plan: 2262422, views: 1459815, inversion_plan: 5656056.12, inversion: 3019183, costo_plan: 2.50, costo: 2.07, ctr_plan: 0.15, ctr: 0.12 },
  { categoria: "Refrigeración", medio: "Programmatic", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 457788, alcance: 910456, frecuencia_plan: 4, frecuencia: 2, impresiones_plan: 1831150, impresiones: 2066736, clics_plan: 2747, clics: 2716, views_plan: null, views: null, inversion_plan: 3296070, inversion: 3295964.97, costo_plan: 1800, costo: 1594.77, ctr_plan: 0.15, ctr: 0.13 },
  { categoria: "Refrigeración", medio: "Mercado Ads", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 183115, alcance: 506374, frecuencia_plan: 2, frecuencia: 2, impresiones_plan: 366230, impresiones: 1006220, clics_plan: 549, clics: 17679, views_plan: null, views: null, inversion_plan: 2197380, inversion: 2210823, costo_plan: 6000, costo: 2197.16, ctr_plan: 0.15, ctr: 1.76 },
  { categoria: "Refrigeración", medio: "Google Demand Gen", objetivo: "Consider", tipo_compra: "CPC", alcance_plan: null, alcance: 954472, frecuencia_plan: null, frecuencia: 2.72, impresiones_plan: 2563610, impresiones: 2592881, clics_plan: 25636, clics: 160901, views_plan: null, views: null, inversion_plan: 1538166, inversion: 1563373, costo_plan: 60, costo: 9.72, ctr_plan: 1.00, ctr: 6.21 },
  { categoria: "Refrigeración", medio: "Geo Mobile", objetivo: "Consider", tipo_compra: "CPC", alcance_plan: null, alcance: null, frecuencia_plan: null, frecuencia: null, impresiones_plan: 307633, impresiones: 841844, clics_plan: 3076, clics: 3093, views_plan: null, views: null, inversion_plan: 1076716.20, inversion: 1076716.20, costo_plan: 350, costo: 348.11, ctr_plan: 1.00, ctr: 0.37 },
  { categoria: "Refrigeración", medio: "Google Search", objetivo: "Consider", tipo_compra: "CPC", alcance_plan: null, alcance: null, frecuencia_plan: null, frecuencia: null, impresiones_plan: 78478, impresiones: 46613, clics_plan: 785, clics: 1139, views_plan: null, views: null, inversion_plan: 439476, inversion: 60261, costo_plan: 560, costo: 52.91, ctr_plan: 1.00, ctr: 2.44 },

  // ===== PROMOCIÓN =====
  { categoria: "Promoción", medio: "Meta", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 533738, alcance: 4361947, frecuencia_plan: 15, frecuencia: 1.63, impresiones_plan: 8006069, impresiones: 7118529, clics_plan: 12009, clics: 1926, views_plan: null, views: null, inversion_plan: 2321760, inversion: 1625232, costo_plan: 290, costo: 228.31, ctr_plan: 0.15, ctr: 0.03 },
  { categoria: "Promoción", medio: "Meta", objetivo: "Consider", tipo_compra: "CPC", alcance_plan: 107489, alcance: 452443, frecuencia_plan: 18, frecuencia: 1.61, impresiones_plan: 1934800, impresiones: 728405, clics_plan: 15478, clics: 18598, views_plan: null, views: null, inversion_plan: 1393056, inversion: 975139, costo_plan: 90, costo: 52.43, ctr_plan: 0.80, ctr: 2.55 },
  { categoria: "Promoción", medio: "TikTok", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 341386, alcance: 3106298, frecuencia_plan: 15, frecuencia: 1.76, impresiones_plan: 5120792, impresiones: 5480384, clics_plan: 7681, clics: 6208, views_plan: null, views: null, inversion_plan: 2560396, inversion: 1791879, costo_plan: 500, costo: 326.96, ctr_plan: 0.15, ctr: 0.11 },
  { categoria: "Promoción", medio: "YouTube", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 103189, alcance: 1344053, frecuencia_plan: 15, frecuencia: 1.02, impresiones_plan: 1547840, impresiones: 1375269, clics_plan: 2322, clics: 1196, views_plan: null, views: null, inversion_plan: 1393056, inversion: 974971, costo_plan: 900, costo: 708.93, ctr_plan: 0.15, ctr: 0.09 },
  { categoria: "Promoción", medio: "YouTube", objetivo: "Build & Consider", tipo_compra: "CPV", alcance_plan: 227665, alcance: 2356784, frecuencia_plan: 15, frecuencia: 1.32, impresiones_plan: 3414977, impresiones: 3120543, clics_plan: 5122, clics: 1341, views_plan: 2390484, views: 2964102, inversion_plan: 5976210.24, inversion: 4179364, costo_plan: 2.50, costo: 1.41, ctr_plan: 0.15, ctr: 0.04 },
  { categoria: "Promoción", medio: "Programmatic", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 93157, alcance: null, frecuencia_plan: 18, frecuencia: null, impresiones_plan: 1676827, impresiones: 1193053, clics_plan: 2515, clics: 1113, views_plan: null, views: null, inversion_plan: 3018288, inversion: 2112234.83, costo_plan: 1800, costo: 1770.45, ctr_plan: 0.15, ctr: 0.09 },
  { categoria: "Promoción", medio: "Mercado Ads", objetivo: "Build", tipo_compra: "CPM", alcance_plan: 38696, alcance: 350462, frecuencia_plan: 10, frecuencia: 2, impresiones_plan: 386960, impresiones: 583385, clics_plan: 580, clics: 13104, views_plan: null, views: null, inversion_plan: 2321760, inversion: 1706957, costo_plan: 6000, costo: 2925.95, ctr_plan: 0.15, ctr: 2.25 },
  { categoria: "Promoción", medio: "Google Demand Gen", objetivo: "Consider", tipo_compra: "CPC", alcance_plan: null, alcance: 41265, frecuencia_plan: null, frecuencia: 9.49, impresiones_plan: 2708720, impresiones: 391630, clics_plan: 29692, clics: 41189, views_plan: null, views: null, inversion_plan: 1625232, inversion: 2886337, costo_plan: 60, costo: 70.08, ctr_plan: 1.10, ctr: 10.52 },
  { categoria: "Promoción", medio: "Google Search", objetivo: "Consider", tipo_compra: "CPC", alcance_plan: null, alcance: null, frecuencia_plan: null, frecuencia: null, impresiones_plan: 82920, impresiones: 2587, clics_plan: 829, clics: 144, views_plan: null, views: null, inversion_plan: 464352, inversion: 8010, costo_plan: 560, costo: 55.63, ctr_plan: 1.00, ctr: 5.57 },
];

// ===== Registro de meses disponibles =====
// Para agregar un mes nuevo: definir su array (ej. MAYO_2026) y sumarlo acá.
const MESES_RAW: Record<string, RawRow[]> = {
  "Abril 2026": ABRIL_2026,
  // "Mayo 2026": MAYO_2026,
};

// Lista de meses para el selector (más reciente primero)
export const PAUTA_MESES = Object.keys(MESES_RAW);
export const PAUTA_MES_DEFAULT = PAUTA_MESES[PAUTA_MESES.length - 1]!;

// Data completa con mes incorporado
export const PAUTA_DATA: PautaRow[] = Object.entries(MESES_RAW).flatMap(([mes, rows]) =>
  rows.map((r) => ({ ...r, mes })),
);

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
      "YouTube Build & Consider subejecutado (53% del presupuesto).",
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
      "YouTube Build & Consider subejecutado (53% del presupuesto).",
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

// Build = upper funnel; Consider = mid funnel; "Build & Consider" aporta a ambos
function isUpper(objetivo: string): boolean {
  return objetivo === "Build" || objetivo === "Build & Consider";
}
function isMid(objetivo: string): boolean {
  return objetivo === "Consider" || objetivo === "Build & Consider";
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
      etapa: r.objetivo === "Build" ? "Upper" : r.objetivo === "Consider" ? "Mid" : "Upper+Mid",
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
      etapa: r.objetivo === "Build" ? "Upper" : r.objetivo === "Consider" ? "Mid" : "Upper+Mid",
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
