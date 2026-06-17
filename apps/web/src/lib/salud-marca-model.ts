// Modelo de Salud de Marca (compartido entre el dashboard /salud-marca y el card
// Obj.4 de /overview). Acá vive la data Kantar por marca/ola y el cálculo de la
// Salud de Marca consolidada de Drean (por categoría + ponderada). Así, cuando se
// actualizan los share/proyecciones, ambos lados leen de la misma fuente.
import type { DreanMesSeg } from "./salud-marca-queries";

export type KVals = { tom: number | null; som: number | null; int: number | null; poder: number | null; sig: number | null; dif: number | null; sal: number | null };
export const NK: KVals = { tom: null, som: null, int: null, poder: null, sig: null, dif: null, sal: null };

// Kantar por marca y ola. TOM/SOM/Intención en %; Poder en %; hélice (sig/dif/sal) en índice base 100.
// Intención de compra = "Sería mi primera opción". Competidores: nov-23 solo Poder+hélice; nov-26 sin dato.
export const KANTAR_LAVADO: Record<string, Record<string, KVals>> = {
  Drean: {
    "nov-23": { tom: 54, som: 80, int: 34, poder: 18.4, sig: 138, dif: 109, sal: 262 },
    "jun-24": { tom: 53, som: 77, int: 43, poder: 19.9, sig: 151, dif: 107, sal: 251 },
    "nov-24": { tom: 44, som: 74, int: 40, poder: 19.2, sig: 147, dif: 115, sal: 232 },
    "jun-25": { tom: 45, som: 74, int: 38, poder: 19.6, sig: 143, dif: 107, sal: 246 },
    "nov-25": { tom: 40.1, som: 69.1, int: 40, poder: 17.4, sig: 127, dif: 106, sal: 237 },
  },
  Samsung: {
    "nov-23": { tom: 13, som: 55, int: 37, poder: 16.7, sig: 140, dif: 196, sal: 121 },
    "jun-24": { tom: 12, som: 54, int: 28, poder: 16.6, sig: 139, dif: 181, sal: 126 },
    "nov-24": { tom: 10, som: 51, int: 35, poder: 17.9, sig: 159, dif: 186, sal: 114 },
    "jun-25": { tom: 11, som: 51, int: 37, poder: 17.4, sig: 154, dif: 184, sal: 124 },
    "nov-25": { tom: 14, som: 47, int: 34, poder: 16.0, sig: 131, dif: 179, sal: 124 },
  },
  Whirlpool: {
    "nov-23": { tom: 13, som: 47, int: 26, poder: 14.1, sig: 129, dif: 145, sal: 128 },
    "jun-24": { tom: 9, som: 50, int: 25, poder: 13.8, sig: 127, dif: 146, sal: 119 },
    "nov-24": { tom: 14, som: 47, int: 32, poder: 15.1, sig: 134, dif: 150, sal: 130 },
    "jun-25": { tom: 13, som: 43, int: 28, poder: 13.5, sig: 135, dif: 144, sal: 119 },
    "nov-25": { tom: 12, som: 38, int: 24, poder: 13.6, sig: 130, dif: 150, sal: 116 },
  },
  LG: {
    "nov-23": { tom: 5, som: 28, int: 19, poder: 11.0, sig: 105, dif: 151, sal: 83 },
    "jun-24": { tom: 5, som: 36, int: 21, poder: 11.0, sig: 104, dif: 149, sal: 94 },
    "nov-24": { tom: 7, som: 27, int: 17, poder: 10.9, sig: 103, dif: 154, sal: 88 },
    "jun-25": { tom: 7, som: 35, int: 15, poder: 10.7, sig: 98, dif: 153, sal: 101 },
    "nov-25": { tom: 7, som: 30, int: 18, poder: 10.7, sig: 115, dif: 131, sal: 93 },
  },
  Philco: {
    "nov-23": { tom: 1, som: 11, int: 7, poder: 5.4, sig: 81, dif: 75, sal: 73 },
    "jun-24": { tom: 2, som: 9, int: 7, poder: 5.5, sig: 89, dif: 82, sal: 67 },
    "nov-24": { tom: 1, som: 12, int: 8, poder: 5.7, sig: 83, dif: 83, sal: 70 },
    "jun-25": { tom: 2, som: 15, int: 9, poder: 5.9, sig: 89, dif: 71, sal: 79 },
    "nov-25": { tom: 3, som: 15, int: 14, poder: 6.1, sig: 87, dif: 75, sal: 87 },
  },
};

// Kantar Refrigeración. TOM/SOM de las barras; Intención = "Sería mi primera
// opción"; Poder + hélice (sig/dif/sal índice base 100). Sin Patrick ni Electrolux.
export const KANTAR_REFRI: Record<string, Record<string, KVals>> = {
  Drean: {
    "nov-23": { tom: 12, som: 34, int: 13, poder: 9.3, sig: 98, dif: 97, sal: 119 },
    "jun-24": { tom: 9, som: 29, int: 14, poder: 9.2, sig: 109, dif: 94, sal: 106 },
    "nov-24": { tom: 10, som: 37, int: 20, poder: 10.4, sig: 111, dif: 112, sal: 119 },
    "jun-25": { tom: 9, som: 29, int: 19, poder: 9.2, sig: 103, dif: 94, sal: 111 },
    "nov-25": { tom: 13, som: 36, int: 25, poder: 10.4, sig: 114, dif: 94, sal: 123 },
  },
  Samsung: {
    "nov-23": { tom: 10, som: 52, int: 36, poder: 16.5, sig: 165, dif: 177, sal: 118 },
    "jun-24": { tom: 14, som: 46, int: 36, poder: 15.6, sig: 137, dif: 171, sal: 126 },
    "nov-24": { tom: 14, som: 52, int: 41, poder: 16.4, sig: 130, dif: 194, sal: 133 },
    "jun-25": { tom: 13, som: 48, int: 41, poder: 16.3, sig: 143, dif: 189, sal: 130 },
    "nov-25": { tom: 11, som: 43, int: 37, poder: 13.3, sig: 133, dif: 167, sal: 122 },
  },
  Gafa: {
    "nov-23": { tom: 19, som: 50, int: 22, poder: 11.8, sig: 119, dif: 87, sal: 157 },
    "jun-24": { tom: 20, som: 53, int: 25, poder: 12.0, sig: 128, dif: 89, sal: 164 },
    "nov-24": { tom: 19, som: 47, int: 22, poder: 10.8, sig: 119, dif: 75, sal: 159 },
    "jun-25": { tom: 15, som: 50, int: 27, poder: 12.2, sig: 129, dif: 91, sal: 149 },
    "nov-25": { tom: 20, som: 47, int: 35, poder: 12.7, sig: 134, dif: 93, sal: 156 },
  },
  Whirlpool: {
    "nov-23": { tom: 15, som: 46, int: 29, poder: 12.3, sig: 124, dif: 135, sal: 132 },
    "jun-24": { tom: 16, som: 50, int: 30, poder: 14.5, sig: 132, dif: 157, sal: 146 },
    "nov-24": { tom: 13, som: 43, int: 33, poder: 13.7, sig: 134, dif: 145, sal: 125 },
    "jun-25": { tom: 16, som: 41, int: 31, poder: 14.1, sig: 126, dif: 146, sal: 135 },
    "nov-25": { tom: 12, som: 41, int: 33, poder: 12.6, sig: 124, dif: 152, sal: 127 },
  },
  LG: {
    "nov-23": { tom: 1, som: 14, int: 11, poder: 8.6, sig: 99, dif: 136, sal: 64 },
    "jun-24": { tom: 3, som: 20, int: 18, poder: 10.2, sig: 103, dif: 156, sal: 71 },
    "nov-24": { tom: 4, som: 26, int: 20, poder: 10.2, sig: 109, dif: 134, sal: 87 },
    "jun-25": { tom: 1, som: 17, int: 17, poder: 9.4, sig: 101, dif: 146, sal: 72 },
    "nov-25": { tom: 3, som: 22, int: 30, poder: 9.8, sig: 107, dif: 144, sal: 82 },
  },
  Philco: {
    "nov-23": { tom: 6, som: 20, int: 10, poder: 6.5, sig: 83, dif: 76, sal: 93 },
    "jun-24": { tom: 1, som: 12, int: 7, poder: 5.4, sig: 77, dif: 74, sal: 74 },
    "nov-24": { tom: 2, som: 16, int: 10, poder: 5.7, sig: 78, dif: 86, sal: 77 },
    "jun-25": { tom: 3, som: 21, int: 10, poder: 6.3, sig: 88, dif: 80, sal: 89 },
    "nov-25": { tom: 6, som: 25, int: 19, poder: 8.2, sig: 99, dif: 101, sal: 96 },
  },
};

// Kantar Cocción. TOM/SOM de las barras; Intención = "Sería mi primera opción";
// Poder + hélice (sig/dif/sal índice base 100). Florencia sin TOM/SOM en el cuadro de barras.
export const KANTAR_COCCION: Record<string, Record<string, KVals>> = {
  Drean: {
    "nov-23": { tom: 2, som: 8, int: 12, poder: 8.9, sig: 111, dif: 112, sal: 78 },
    "jun-24": { tom: 2, som: 11, int: 13, poder: 9.4, sig: 105, dif: 133, sal: 83 },
    "nov-24": { tom: 4, som: 12, int: 14, poder: 9.8, sig: 101, dif: 131, sal: 86 },
    "jun-25": { tom: 3, som: 10, int: 21, poder: 10.4, sig: 117, dif: 121, sal: 78 },
    "nov-25": { tom: 5, som: 17, int: 14, poder: 10.4, sig: 99, dif: 132, sal: 105 },
  },
  Whirlpool: {
    "nov-23": { tom: 5, som: 18, int: 26, poder: 11.3, sig: 118, dif: 155, sal: 92 },
    "jun-24": { tom: 8, som: 21, int: 26, poder: 12.3, sig: 120, dif: 165, sal: 109 },
    "nov-24": { tom: 5, som: 19, int: 27, poder: 13.9, sig: 143, dif: 159, sal: 97 },
    "jun-25": { tom: 6, som: 27, int: 36, poder: 14.3, sig: 128, dif: 166, sal: 105 },
    "nov-25": { tom: 5, som: 19, int: 29, poder: 12.8, sig: 134, dif: 169, sal: 88 },
  },
  Escorial: {
    "nov-23": { tom: 19, som: 40, int: 26, poder: 11.7, sig: 114, dif: 99, sal: 172 },
    "jun-24": { tom: 12, som: 29, int: 22, poder: 9.8, sig: 117, dif: 76, sal: 136 },
    "nov-24": { tom: 10, som: 28, int: 25, poder: 8.5, sig: 109, dif: 82, sal: 134 },
    "jun-25": { tom: 18, som: 34, int: 24, poder: 11.5, sig: 111, dif: 91, sal: 155 },
    "nov-25": { tom: 10, som: 28, int: 24, poder: 10.2, sig: 111, dif: 77, sal: 132 },
  },
  Gafa: {
    "nov-23": { tom: 6, som: 16, int: 14, poder: 8.8, sig: 105, dif: 108, sal: 94 },
    "jun-24": { tom: 5, som: 16, int: 24, poder: 9.9, sig: 107, dif: 117, sal: 104 },
    "nov-24": { tom: 3, som: 12, int: 23, poder: 8.9, sig: 105, dif: 104, sal: 88 },
    "jun-25": { tom: 5, som: 16, int: 20, poder: 9.7, sig: 106, dif: 102, sal: 96 },
    "nov-25": { tom: 8, som: 18, int: 19, poder: 11.0, sig: 116, dif: 98, sal: 111 },
  },
  Electrolux: {
    "nov-23": { tom: 1, som: null, int: 18, poder: 9.1, sig: 109, dif: 123, sal: 85 },
    "jun-24": { tom: 1, som: 16, int: 22, poder: 9.1, sig: 102, dif: 118, sal: 79 },
    "nov-24": { tom: 1, som: 14, int: 17, poder: 9.5, sig: 103, dif: 120, sal: 89 },
    "jun-25": { tom: 4, som: 17, int: 14, poder: 9.9, sig: 97, dif: 133, sal: 94 },
    "nov-25": { tom: 6, som: 19, int: 19, poder: 11.4, sig: 115, dif: 133, sal: 104 },
  },
  Longvie: {
    "nov-23": { tom: 13, som: 23, int: 18, poder: 9.9, sig: 119, dif: 93, sal: 122 },
    "jun-24": { tom: 10, som: 22, int: 22, poder: 8.8, sig: 98, dif: 101, sal: 118 },
    "nov-24": { tom: 15, som: 29, int: 18, poder: 9.7, sig: 104, dif: 100, sal: 147 },
    "jun-25": { tom: 11, som: 24, int: 20, poder: 8.8, sig: 98, dif: 87, sal: 116 },
    "nov-25": { tom: 14, som: 22, int: 21, poder: 9.4, sig: 102, dif: 96, sal: 126 },
  },
  Florencia: {
    "nov-23": { tom: 5, som: 16, int: 11, poder: null, sig: null, dif: null, sal: null },
    "jun-24": { tom: null, som: null, int: 17, poder: 4.8, sig: 90, dif: 59, sal: 100 },
    "nov-24": { tom: null, som: null, int: 11, poder: 4.7, sig: 80, dif: 62, sal: 96 },
    "jun-25": { tom: null, som: null, int: 12, poder: 5.7, sig: 82, dif: 81, sal: 97 },
    "nov-25": { tom: null, som: null, int: 8, poder: 4.9, sig: 68, dif: 57, sal: 91 },
  },
};

// Olas de la investigación (la vista consolidada usa solo las de noviembre = anuales).
export const SM_WAVES = ["nov-23", "jun-24", "nov-24", "jun-25", "nov-25", "nov-26"] as const;
// Peso (mix) de cada categoría por ola, para ponderar la Salud de Marca global de Drean.
export const SM_WEIGHTS: Record<string, { lav: number; ref: number; coc: number }> = {
  "nov-23": { lav: 0.60, ref: 0.30, coc: 0.10 },
  "jun-24": { lav: 0.61, ref: 0.33, coc: 0.06 },
  "nov-24": { lav: 0.61, ref: 0.33, coc: 0.06 },
  "jun-25": { lav: 0.62, ref: 0.35, coc: 0.03 },
  "nov-25": { lav: 0.62, ref: 0.35, coc: 0.03 },
  "nov-26": { lav: 0.62, ref: 0.35, coc: 0.03 },
};

const wPrev12 = (mes: string) => { const [y, m] = mes.split("-"); return `${Number(y) - 1}-${m}-01`; };
const wBlend = (fn: (s?: DreanMesSeg) => number | null, serie: Map<string, DreanMesSeg>, mes: string): number | null => {
  const a = fn(serie.get(mes)), b = fn(serie.get(wPrev12(mes)));
  return a == null || b == null ? null : 0.5 * a + 0.5 * b;
};
// Estimación nov-26 de Drean por categoría/dimensión (coeficientes calibrados por OLS).
// Devuelve el valor amortiguado, o null si no hay ecuación/serie → se arrastra nov-25.
export function dreanEstNov26(cat: "lav" | "ref" | "coc", dim: "tom" | "som" | "int" | "poder", serie: Map<string, DreanMesSeg>, anchor: number | null): number | null {
  const mes = "2026-11-01";
  if (cat === "lav") {
    if (dim === "tom") { const d = wBlend((s) => { const H = s?.vs.High, M = s?.vs.Mid; return H == null || M == null ? null : 0.85 * H + 0.15 * M; }, serie, mes); return d == null ? null : 13.23 + 1.154 * d; }
    if (dim === "som") { const d = wBlend((s) => s?.usTotal ?? null, serie, mes); return d == null ? null : 33.73 + 1.083 * d; }
    return null; // Intención/Poder no se estiman en Lavado
  }
  if (cat === "coc") {
    const dMH = (s?: DreanMesSeg) => { const M = s?.us.Mid, H = s?.us.High; return M == null || H == null ? null : M + H; };
    const coef: Partial<Record<string, [number, number]>> = { tom: [-0.05, 0.637], som: [3.74, 1.538], poder: [8.53, 0.245] };
    const c = coef[dim]; if (!c) return null; // Intención no se estima en Cocción
    const d = wBlend(dMH, serie, mes); if (d == null) return null;
    const model = c[0] + c[1] * d;
    return anchor == null ? model : 0.3 * model + 0.7 * anchor; // damp 0,3
  }
  return null; // Refrigeración: Drean no se estima desde mercado → arrastra nov-25
}

export type SMState = "real" | "proj" | "carry";
export type SMCell = { v: number | null; s: SMState };
export type SMCatWave = { tom: SMCell; som: SMCell; int: SMCell; poder: SMCell; sm: SMCell };
export type SMRow = { w: string; lav: SMCatWave; ref: SMCatWave; coc: SMCatWave; wt: { lav: number; ref: number; coc: number }; comp: number | null };
type CatDef = { key: "lav" | "ref" | "coc"; kantar: Record<string, Record<string, KVals>> };

export const SM_DIMS: ReadonlyArray<{ key: "tom" | "som" | "int" | "poder"; label: string }> = [
  { key: "tom", label: "Top of Mind" },
  { key: "som", label: "Share of Mind" },
  { key: "int", label: "Intención de compra" },
  { key: "poder", label: "Poder de Marca" },
];

// Salud de Marca consolidada de Drean por ola. SM categoría = 0,25·(TOM+SOM+Int+Poder);
// Global = Σ SM·peso. Para nov-26: proyecta donde hay modelo, si no arrastra nov-25.
// novOnly=true (default) deja solo las olas de noviembre (las mediciones anuales).
export function computeDreanConsolidado(
  series: Record<"lav" | "ref" | "coc", Map<string, DreanMesSeg>>,
  novOnly = true,
): SMRow[] {
  const waves = (novOnly ? SM_WAVES.filter((w) => w.startsWith("nov")) : [...SM_WAVES]);
  const CAT_LAV: CatDef = { key: "lav", kantar: KANTAR_LAVADO };
  const CAT_REF: CatDef = { key: "ref", kantar: KANTAR_REFRI };
  const CAT_COC: CatDef = { key: "coc", kantar: KANTAR_COCCION };
  const catWave = (cat: CatDef, w: string): SMCatWave => {
    const real = cat.kantar["Drean"]?.[w];
    const a25 = cat.kantar["Drean"]?.["nov-25"];
    const cell = (dim: "tom" | "som" | "int" | "poder"): SMCell => {
      if (w !== "nov-26") return { v: real?.[dim] ?? null, s: "real" };
      const anchor = a25?.[dim] ?? null;
      const est = dreanEstNov26(cat.key, dim, series[cat.key], anchor);
      return est != null ? { v: est, s: "proj" } : { v: anchor, s: "carry" };
    };
    const tom = cell("tom"), som = cell("som"), int = cell("int"), poder = cell("poder");
    const all = [tom.v, som.v, int.v, poder.v];
    const smV = all.every((v) => v != null) ? 0.25 * (all[0]! + all[1]! + all[2]! + all[3]!) : null;
    const smS: SMState = [tom, som, int, poder].some((x) => x.s === "proj") ? "proj" : [tom, som, int, poder].some((x) => x.s === "carry") ? "carry" : "real";
    return { tom, som, int, poder, sm: { v: smV, s: smS } };
  };
  return waves.map((w) => {
    const lav = catWave(CAT_LAV, w), ref = catWave(CAT_REF, w), coc = catWave(CAT_COC, w);
    const wt = SM_WEIGHTS[w] ?? { lav: 0, ref: 0, coc: 0 };
    const comp = lav.sm.v == null || ref.sm.v == null || coc.sm.v == null ? null : lav.sm.v * wt.lav + ref.sm.v * wt.ref + coc.sm.v * wt.coc;
    return { w, lav, ref, coc, wt, comp };
  });
}
