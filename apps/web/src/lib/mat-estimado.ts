// Puro y client-safe. Estima el MAT (año móvil) de un mes futuro de GfK a partir de la tendencia real.
// MAT(m) = MAT(m−1) + (mensual(m) − mensual(m−12)) / 12, con mensual(m) = promedio de los últimos 3 meses
// mensuales reales (nivel reciente). Solo completa campos vacíos: si GfK ya trae el dato, manda el real.
// shortcut: el índice de precio MAT se estima igual (aproximación: GfK lo pondera por ventas), suficiente para una proyección.

type Seg = "High" | "Mid" | "Low";
export interface MesSeg {
  vs: Record<Seg, number | null>;
  us: Record<Seg, number | null>;
  ip: Record<Seg, number | null>;
  usTotal: number | null;
  vsTotal: number | null;
}

const SEGS: Seg[] = ["High", "Mid", "Low"];
const mesKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}-01`;
function mover(mes: string, n: number): string {
  const [y, m] = mes.split("-").map(Number) as [number, number];
  const t = y * 12 + (m - 1) + n;
  return mesKey(Math.floor(t / 12), (t % 12) + 1);
}
const vacio = (): MesSeg => ({ vs: { High: null, Mid: null, Low: null }, us: { High: null, Mid: null, Low: null }, ip: { High: null, Mid: null, Low: null }, usTotal: null, vsTotal: null });

type Get = (s: MesSeg) => number | null;
type Set = (s: MesSeg, v: number) => void;
const CAMPOS: Array<[Get, Set]> = [
  ...SEGS.flatMap((g) => [
    [(s: MesSeg) => s.vs[g], (s: MesSeg, v: number) => { s.vs[g] = v; }],
    [(s: MesSeg) => s.us[g], (s: MesSeg, v: number) => { s.us[g] = v; }],
    [(s: MesSeg) => s.ip[g], (s: MesSeg, v: number) => { s.ip[g] = v; }],
  ] as Array<[Get, Set]>),
  [(s) => s.vsTotal, (s, v) => { s.vsTotal = v; }],
  [(s) => s.usTotal, (s, v) => { s.usTotal = v; }],
];

/** Devuelve una copia de `mat` con el mes `objetivo` completado (y los meses entre el último real y el objetivo). */
export function estimarMat(mat: Map<string, MesSeg>, mensual: Map<string, MesSeg>, objetivo: string): Map<string, MesSeg> {
  const out = new Map(mat);
  const reales = [...mat.keys()].sort();
  if (!reales.length) return out;
  // Meses a completar: desde el mes siguiente al último MAT con algún campo real hasta el objetivo.
  for (let mes = mover(objetivo, -11); mes <= objetivo; mes = mover(mes, 1)) {
    const actual = out.get(mes);
    const fila: MesSeg = actual ? structuredClone(actual) : vacio();
    let cambio = false;
    for (const [get, set] of CAMPOS) {
      if (get(fila) != null) continue;
      const prev = out.get(mover(mes, -1));
      const base = prev ? get(prev) : null;
      if (base == null) continue;
      const ult = [-1, -2, -3].map((k) => mensual.get(mover(mes, k))).map((r) => (r ? get(r) : null)).filter((v): v is number => v != null);
      const sale = mensual.get(mover(mes, -12));
      const sv = sale ? get(sale) : null;
      if (ult.length < 2 || sv == null) continue; // sin tendencia suficiente: no se inventa
      const entra = ult.reduce((a, b) => a + b, 0) / ult.length;
      set(fila, Math.round((base + (entra - sv) / 12) * 100) / 100);
      cambio = true;
    }
    if (cambio) out.set(mes, fila);
  }
  return out;
}
