// ============================================================================
// Calculadora DETERMINÍSTICA del copiloto (tool `calc`). El modelo NO hace cuentas:
// correlación, elasticidad, variaciones, proyecciones y ratios de eficiencia salen de acá.
// Puro (sin server-only). Portado de BIP (lib/chat/calc.ts) sin cambios de lógica.
// ============================================================================
import { rd } from "@/lib/chat/util";

type Serie = (number | null | undefined)[];
const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const serie = (v: unknown): (number | null)[] => (Array.isArray(v) ? v.map(num) : []);

// Pares alineados (descarta posiciones donde falta alguno). lag>0: x[t] contra y[t+lag].
function pares(x: Serie, y: Serie, lag = 0): { xs: number[]; ys: number[]; idx: number[] } {
  const xs: number[] = [], ys: number[] = [], idx: number[] = [];
  for (let i = 0; i < x.length; i++) {
    const a = x[i], b = y[i + lag];
    if (a != null && b != null && Number.isFinite(a) && Number.isFinite(b)) { xs.push(a); ys.push(b); idx.push(i); }
  }
  return { xs, ys, idx };
}
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1);

export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i]! - mx, dy = ys[i]! - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}
// Recta MCO y = a + b·x.
function ols(xs: number[], ys: number[]): { a: number; b: number } | null {
  const n = xs.length;
  if (n < 2) return null;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i]! - mx) * (ys[i]! - my); sxx += (xs[i]! - mx) ** 2; }
  if (sxx === 0) return null;
  const b = sxy / sxx;
  return { a: my - b * mx, b };
}
const fuerza = (r: number) => {
  const a = Math.abs(r);
  const f = a >= 0.7 ? "fuerte" : a >= 0.4 ? "moderada" : a >= 0.2 ? "débil" : "nula o casi nula";
  return `${f} ${r >= 0 ? "positiva" : "negativa"}`;
};
const avisoN = (n: number) => (n < 6 ? `Solo ${n} pares de datos: tomalo como indicio, no como prueba.` : undefined);

export const CALC_OPS = ["correlacion", "elasticidad", "variacion", "ratio", "participacion", "proyeccion_cierre", "cpa", "roas", "cpcv", "reasignacion"] as const;
export type CalcOp = (typeof CALC_OPS)[number];

export function calc(args: Record<string, unknown>): unknown {
  const op = String(args.operacion ?? "") as CalcOp;
  switch (op) {
    case "correlacion": {
      const lag = Math.max(0, Math.min(6, Math.floor(Number(args.lag ?? 0)) || 0));
      const { xs, ys } = pares(serie(args.x), serie(args.y), lag);
      const r = pearson(xs, ys);
      if (r == null) return { error: "Hacen falta al menos 3 pares con dato y variación en ambas series." };
      const fit = ols(xs, ys);
      return {
        r: rd(r, 3), r2: rd(r * r, 3), n: xs.length, lag_meses: lag, fuerza: fuerza(r),
        pendiente: fit ? rd(fit.b, 4) : null,
        lectura: fit ? `Por cada unidad adicional de X, Y se mueve ${rd(fit.b, 4)} unidades (en promedio, sobre ${xs.length} períodos).` : undefined,
        advertencia: avisoN(xs.length) ?? "Correlación no implica causalidad; revisá estacionalidad y otros factores.",
      };
    }
    case "elasticidad": {
      // Pendiente log-log: +1% de X ⇒ +β% de Y.
      const { xs, ys } = pares(serie(args.x), serie(args.y), Math.max(0, Math.floor(Number(args.lag ?? 0)) || 0));
      const lx: number[] = [], ly: number[] = [];
      xs.forEach((v, i) => { if (v > 0 && ys[i]! > 0) { lx.push(Math.log(v)); ly.push(Math.log(ys[i]!)); } });
      const fit = ols(lx, ly);
      if (!fit || lx.length < 3) return { error: "Hacen falta al menos 3 pares con valores > 0 y variación en X." };
      const r = pearson(lx, ly);
      const b = fit.b;
      return {
        elasticidad: rd(b, 3), n: lx.length, r2_loglog: r != null ? rd(r * r, 3) : null,
        lectura: `Un +10% en X se asocia a ${b >= 0 ? "+" : ""}${rd(b * 10, 1)}% en Y (${Math.abs(b) < 1 ? "rendimiento decreciente / inelástico" : "elástico"}).`,
        advertencia: avisoN(lx.length),
      };
    }
    case "variacion": {
      const s = serie(args.serie);
      if (s.length) {
        const et = Array.isArray(args.etiquetas) ? args.etiquetas.map(String) : [];
        const pasos = [] as { de: string; a: string; variacion_pct: number | null }[];
        let prevI = -1;
        s.forEach((v, i) => {
          if (v == null) return;
          if (prevI >= 0) pasos.push({ de: et[prevI] ?? String(prevI + 1), a: et[i] ?? String(i + 1), variacion_pct: s[prevI] ? rd(((v - s[prevI]!) / Math.abs(s[prevI]!)) * 100, 1) : null });
          prevI = i;
        });
        const vals = s.filter((v): v is number => v != null);
        const first = vals[0], last = vals[vals.length - 1];
        return { variaciones: pasos, total_pct: first && last != null ? rd(((last - first) / Math.abs(first)) * 100, 1) : null, promedio: rd(mean(vals), 2), max: rd(Math.max(...vals), 2), min: rd(Math.min(...vals), 2) };
      }
      const a = num(args.actual), b = num(args.anterior);
      if (a == null || b == null) return { error: "Pasá actual y anterior, o una serie." };
      return { actual: a, anterior: b, diferencia: rd(a - b, 2), variacion_pct: b ? rd(((a - b) / Math.abs(b)) * 100, 1) : null };
    }
    case "ratio": {
      const n = num(args.numerador), d = num(args.denominador), esc = num(args.escala) ?? 1;
      if (n == null || d == null || d === 0) return { error: "numerador y denominador (≠0) requeridos." };
      return { ratio: rd((n / d) * esc, 4), escala: esc };
    }
    case "participacion": {
      const vals = serie(args.serie), et = Array.isArray(args.etiquetas) ? args.etiquetas.map(String) : [];
      const tot = vals.reduce<number>((s, v) => s + (v ?? 0), 0);
      if (!tot) return { error: "La serie suma 0." };
      return { total: rd(tot, 2), participacion: vals.map((v, i) => ({ item: et[i] ?? String(i + 1), valor: v, pct: v == null ? null : rd((v / tot) * 100, 1) })) };
    }
    case "proyeccion_cierre": {
      // serie = 12 valores Ene..Dic (null = sin dato). tipo sum (volumen) o rate (tasa).
      const s = serie(args.serie).slice(0, 12);
      const tipo = args.tipo === "rate" ? "rate" : "sum";
      const obs = s.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null);
      if (obs.length < 2) return { error: "Hacen falta al menos 2 meses con dato." };
      const last = obs[obs.length - 1]!.i;
      const fit = ols(obs.map((p) => p.i), obs.map((p) => p.v));
      const restantes = Array.from({ length: 11 - last }, (_, k) => last + 1 + k);
      const lineal = restantes.map((i) => Math.max(0, fit ? fit.a + fit.b * i : obs[obs.length - 1]!.v));
      const ult3 = obs.slice(-3).map((p) => p.v);
      const ritmo = mean(ult3);
      const ytd = obs.reduce((a, p) => a + p.v, 0);
      const meta = num(args.meta);
      const cierreLineal = tipo === "sum" ? ytd + lineal.reduce((a, b) => a + b, 0) : (lineal.length ? lineal[lineal.length - 1]! : obs[obs.length - 1]!.v);
      const cierreRitmo = tipo === "sum" ? ytd + ritmo * restantes.length : ritmo;
      const out: Record<string, unknown> = {
        tipo, meses_con_dato: obs.length, ultimo_mes_idx: last + 1,
        ytd: tipo === "sum" ? rd(ytd, 2) : rd(mean(obs.map((p) => p.v)), 2),
        tendencia_mensual: fit ? rd(fit.b, 2) : null,
        cierre_tendencia_lineal: rd(cierreLineal, 2),
        cierre_ritmo_ultimos_3m: rd(cierreRitmo, 2),
      };
      if (meta != null && meta !== 0) {
        out.meta = meta;
        out.cumplimiento_proyectado_pct = { lineal: rd((cierreLineal / meta) * 100, 1), ritmo: rd((cierreRitmo / meta) * 100, 1) };
        if (tipo === "sum" && restantes.length) {
          out.necesario_por_mes_restante = rd(Math.max(0, meta - ytd) / restantes.length, 2);
          out.vs_ritmo_actual_pct = ritmo ? rd(((Math.max(0, meta - ytd) / restantes.length) / ritmo - 1) * 100, 1) : null;
        }
      }
      return out;
    }
    case "cpa":
    case "roas":
    case "cpcv": {
      // Acepta números o series alineadas (por mes/campaña).
      const [nk, dk, mult, label] = op === "cpa" ? ["inversion", "conversiones", 1, "costo por conversión"] : op === "roas" ? ["ingresos", "inversion", 1, "ingresos por $ invertido"] : ["inversion", "vistas_completas", 1, "costo por vista completa"];
      const A = args[nk as string], B = args[dk as string];
      if (Array.isArray(A) && Array.isArray(B)) {
        const et = Array.isArray(args.etiquetas) ? args.etiquetas.map(String) : [];
        const rows = A.map((a, i) => { const x = num(a), y = num(B[i]); return { item: et[i] ?? String(i + 1), valor: x != null && y ? rd((x / y) * (mult as number), 4) : null }; });
        const sa = A.reduce<number>((s, v) => s + (num(v) ?? 0), 0), sb = B.reduce<number>((s, v) => s + (num(v) ?? 0), 0);
        return { operacion: op, descripcion: label, por_item: rows, total: sb ? rd(sa / sb, 4) : null };
      }
      const x = num(A), y = num(B);
      if (x == null || !y) return { error: `${nk} y ${dk} (≠0) requeridos.` };
      return { operacion: op, descripcion: label, valor: rd(x / y, 4) };
    }
    case "reasignacion": {
      // Mover `monto` de un destino con costo unitario X a otro con costo unitario Y.
      const m = num(args.monto), co = num(args.costo_unitario_origen), cd = num(args.costo_unitario_destino);
      if (m == null || !co || !cd) return { error: "monto, costo_unitario_origen y costo_unitario_destino (≠0) requeridos." };
      const pierde = m / co, gana = m / cd;
      return { resultados_que_se_pierden: rd(pierde, 1), resultados_que_se_ganan: rd(gana, 1), neto: rd(gana - pierde, 1), mejora_pct: rd(((gana - pierde) / pierde) * 100, 1), supuesto: "Costo unitario constante (sin saturación); en la práctica el rendimiento marginal cae al escalar." };
    }
    default:
      return { error: `operación desconocida: ${op}` };
  }
}

export const CALC_TOOL_PARAMS = {
  type: "object",
  properties: {
    operacion: { type: "string", enum: [...CALC_OPS], description: "correlacion/elasticidad: x,y (series alineadas, mismo orden de meses; lag opcional = meses de retardo de y). variacion: actual+anterior o serie. ratio: numerador/denominador(/escala). participacion: serie+etiquetas. proyeccion_cierre: serie de 12 meses Ene..Dic con null donde no hay dato, tipo sum|rate, meta anual opcional (sum) o meta de tasa (rate). cpa: inversion/conversiones. roas: ingresos/inversion. cpcv: inversion/vistas_completas (números o series). reasignacion: monto, costo_unitario_origen, costo_unitario_destino." },
    x: { type: "array", items: { type: ["number", "null"] } },
    y: { type: "array", items: { type: ["number", "null"] } },
    lag: { type: "integer", minimum: 0, maximum: 6 },
    serie: { type: "array", items: { type: ["number", "null"] } },
    etiquetas: { type: "array", items: { type: "string" } },
    actual: { type: "number" }, anterior: { type: "number" },
    numerador: { type: "number" }, denominador: { type: "number" }, escala: { type: "number" },
    tipo: { type: "string", enum: ["sum", "rate"] }, meta: { type: "number" },
    inversion: { anyOf: [{ type: "number" }, { type: "array", items: { type: ["number", "null"] } }] },
    conversiones: { anyOf: [{ type: "number" }, { type: "array", items: { type: ["number", "null"] } }] },
    ingresos: { anyOf: [{ type: "number" }, { type: "array", items: { type: ["number", "null"] } }] },
    vistas_completas: { anyOf: [{ type: "number" }, { type: "array", items: { type: ["number", "null"] } }] },
    monto: { type: "number" }, costo_unitario_origen: { type: "number" }, costo_unitario_destino: { type: "number" },
  },
  required: ["operacion"],
} as const;
