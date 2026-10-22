// Metas del año para Web, Redes (IG + FB) y SEO / mercado, proyectadas desde el Plan anual
// (/performance/plan, sección 6). Puro, client-safe: el server arma la historia (lib/plan-otros-kpis-server.ts)
// y el cálculo corre igual en el navegador (vista previa) y en el POST que escribe las metas.
//
//  · Web: "mejorar lo que ya hicimos" → mismo mes del año base × (1 + ambición). Meses del año base que todavía no
//    cerraron = pronóstico (lib/stats/forecast).
//  · Redes IG: mes "normal" (mediana de los últimos 6 meses cerrados) + efecto de las campañas del Gantt.
//    Efecto por tipo e intensidad (baja ×0,5, media ×1, alta ×1,5), en % sobre el mes normal; se suman entre tipos.
//  · Facebook: mes normal × (1 + ambición) (sin campañas: el reach de FB no separa pago de orgánico).
//  · ROAS = ingresos proyectados ÷ (inversión del plan del mes + inversión de conversión ecommerce del mismo mes del año
//    base): en el año base no hubo pauta hasta abril y el ROAS de esos meses no sirve como referencia.
//  · SEO / mercado: continuidad × (1 ± ambición): Share of Search = mismo mes (es estacional); Share of engagement =
//    mediana de 6 meses (un sorteo lo dispara); IA e índice de posición = último relevamiento (son fotos).
import { ajustar } from "./stats/forecast";
import { MERCADO_KPIS } from "./mercado-kpis";

const N = 12;
type Serie = (number | null)[];

export const TIPOS_CAMPANA = [
  { id: "marca", label: "Marca / emocional", ej: "tipo Marcelino" },
  { id: "lanzamiento", label: "Lanzamiento", ej: "ej. lavarropas 3 tambores" },
  { id: "promo", label: "Promocional", ej: "Hot Sale, Cyber Monday, Black Friday" },
  { id: "producto", label: "Producto / Categoría / Marca", ej: "posteos de línea" },
  { id: "evento", label: "Evento / Cobranding", ej: "sorteos, Casa FOA" },
  { id: "influencers", label: "Influencers / Colaboraciones", ej: "creadores, colabs" },
] as const;
export type TipoCampana = (typeof TIPOS_CAMPANA)[number]["id"];
export const INTENSIDADES = ["—", "Baja", "Media", "Alta"] as const;
const FACTOR_INT = [0, 0.5, 1, 1.5];

/** Efecto de un mes de campaña de intensidad media: % extra de alcance e interacciones sobre el mes normal y seguidores extra. */
export interface Efecto { alc: number; int: number; seg: number }
export const EFECTOS_DEFAULT: Record<TipoCampana, Efecto> = {
  marca: { alc: 15, int: 15, seg: 500 },
  lanzamiento: { alc: 20, int: 25, seg: 500 },
  promo: { alc: 10, int: 20, seg: 300 },
  producto: { alc: 5, int: 5, seg: 100 },
  // Calibrado con sep-2026 (sorteo Casa FOA): el posteo sumó 11.772 de alcance y 3.565 interacciones sobre un mes
  // de ~26,7k y ~1.115 → +44% y +320%. Los seguidores son supuesto (no hay serie diaria antes del 28-sep).
  evento: { alc: 44, int: 320, seg: 2000 },
  influencers: { alc: 20, int: 20, seg: 800 },
};
/** Tipos cuyo efecto sale de un dato real (el resto es supuesto editable). */
export const EFECTO_CALIBRADO: Partial<Record<TipoCampana, string>> = { evento: "sorteo Casa FOA sep-2026 (alcance e interacciones)" };

/** Categorías del negocio para planes y metas (Brand / Institucional cierra el total). */
export const CATS_PLAN = ["Lavado", "Refrigeración", "Cocción", "Brand"] as const;

export interface OtrosConfig {
  gantt: Record<TipoCampana, number[]>; // 12 meses, 0–3 (sin / baja / media / alta)
  /** Categoría a la que apunta la campaña de ese mes; null = todas. */
  ganttCat: Record<TipoCampana, (string | null)[]>;
  efectos: Record<TipoCampana, Efecto>;
  amb: { web: number; fb: number; seo: number }; // % de mejora sobre la base
}

export function otrosDefault(): OtrosConfig {
  const gantt = Object.fromEntries(TIPOS_CAMPANA.map((t) => [t.id, Array(N).fill(0)])) as Record<TipoCampana, number[]>;
  gantt.promo[4] = 2; // Hot Sale (mayo)
  gantt.promo[10] = 2; // Cyber Monday + Black Friday (noviembre)
  const ganttCat = Object.fromEntries(TIPOS_CAMPANA.map((t) => [t.id, Array(N).fill(null)])) as Record<TipoCampana, (string | null)[]>;
  return { gantt, ganttCat, efectos: structuredClone(EFECTOS_DEFAULT), amb: { web: 10, fb: 0, seo: 0 } };
}

const num = (v: unknown, min: number, max: number, def = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
export function sanearOtros(raw: unknown): OtrosConfig {
  const d = otrosDefault();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Partial<OtrosConfig>;
  for (const t of TIPOS_CAMPANA) {
    const g = (r.gantt as Record<string, unknown> | undefined)?.[t.id];
    if (Array.isArray(g)) d.gantt[t.id] = Array.from({ length: N }, (_, i) => Math.round(num(g[i], 0, 3)));
    const gc = (r.ganttCat as Record<string, unknown> | undefined)?.[t.id];
    if (Array.isArray(gc)) d.ganttCat[t.id] = Array.from({ length: N }, (_, i) => ((CATS_PLAN as readonly string[]).includes(gc[i] as string) ? (gc[i] as string) : null));
    const e = (r.efectos as Record<string, Partial<Efecto>> | undefined)?.[t.id];
    if (e) d.efectos[t.id] = { alc: num(e.alc, -100, 1000, d.efectos[t.id].alc), int: num(e.int, -100, 1000, d.efectos[t.id].int), seg: num(e.seg, -1e6, 1e6, d.efectos[t.id].seg) };
  }
  const a = (r.amb ?? {}) as Partial<OtrosConfig["amb"]>;
  d.amb = { web: num(a.web, -50, 100, 10), fb: num(a.fb, -50, 100, 0), seo: num(a.seo, -50, 100, 0) };
  return d;
}

// ── Historia (la arma el server) ─────────────────────────────────────────────
export interface HistOtros {
  anioBase: number; // año con datos reales (el anterior al del plan)
  /** "plan|kpi" → 12 meses del año base (solo meses cerrados; null = sin dato / por cerrar). */
  series: Record<string, Serie>;
  seguidores: { ultimo: number | null; fecha: string | null; porMes: number };
  /** "plan|kpi" → participación de cada categoría (CATS_PLAN, suma 1) en los últimos meses cerrados. */
  shares?: Record<string, Record<string, number>>;
  /** "plan|kpi" → serie por categoría (KPIs de tasa con dato propio por categoría: SEO / mercado). */
  seriesCat?: Record<string, Record<string, Serie>>;
  /** Mezcla típica de las interacciones de IG por tipo (suma 1). */
  igMix?: { likes: number; comentarios: number; guardados: number } | null;
}

export interface KpiProyectado {
  plan: string; kpi: string; unidad: string; direccion: "up" | "down"; tipo: "sum" | "rate";
  valores: number[]; base: number[]; metodo: string;
  /** Proyección por categoría (solo KPIs con dato por categoría). */
  porCat?: Record<string, number[]>;
}

export const PLANES_OTROS = [
  { plan: "Web / Ecommerce", area: "web", titulo: "Web / Ecommerce" },
  { plan: "Redes Sociales", area: "redes", titulo: "Redes · Instagram" },
  { plan: "Facebook", area: "fb", titulo: "Redes · Facebook" },
  { plan: "Mercado y competencia", area: "seo", titulo: "SEO / Mercado y competencia" },
] as const;

const WEB: [string, string, "sum" | "rate", "up" | "down"][] = [
  ["Tráfico web (usuarios)", "", "sum", "up"], ["Sesiones", "", "sum", "up"], ["Avg Sesión (segundos)", "s", "rate", "up"],
  ["Tasa de conversión", "%", "rate", "up"], ["Transacciones", "", "sum", "up"], ["Total Ingresos", "$", "sum", "up"], ["ROAS", "x", "rate", "up"],
];
export const KPIS_OTROS: Record<string, [string, string, "sum" | "rate", "up" | "down"][]> = {
  "Web / Ecommerce": WEB,
  "Redes Sociales": [["Alcance orgánico", "", "sum", "up"], ["Interacciones", "", "sum", "up"], ["Engagement rate", "%", "rate", "up"], ["Seguidores", "", "rate", "up"], ["Sentiment", "%", "rate", "up"]],
  "Facebook": [["Alcance orgánico", "", "sum", "up"], ["Engagement rate", "%", "rate", "up"]],
  "Mercado y competencia": MERCADO_KPIS.map((k) => [k.key, k.unidad, "rate", k.direccion] as [string, string, "sum" | "rate", "up" | "down"]),
};

const ok = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const mediana = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
const ultimos = (s: Serie, k: number) => s.filter(ok).slice(-k);
const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Mismo mes del año base; los meses sin dato se completan con el pronóstico (forecast) o, si no alcanza, el último valor. */
export function baseMismoMes(s: Serie | undefined): { base: (number | null)[]; pronosticados: number } {
  const real = Array.from({ length: N }, (_, i) => (ok(s?.[i]) ? s![i]! : null));
  let last = -1;
  for (let i = N - 1; i >= 0; i--) if (real[i] != null) { last = i; break; }
  if (last < 0) return { base: real, pronosticados: 0 };
  const aj = last < N - 1 ? ajustar(real, N - 1 - last) : null;
  const ult = real[last]!;
  let pron = 0;
  const base = real.map((v, i) => {
    if (v != null) return v;
    pron++;
    if (i > last) { const p = aj?.puntos[i - last - 1]; return ok(p) ? p : ult; }
    // hueco antes del último dato: promedio de los vecinos con dato
    const prev = real.slice(0, i).reverse().find(ok), next = real.slice(i + 1).find(ok);
    return prev != null && next != null ? (prev + next) / 2 : (prev ?? next ?? null);
  });
  return { base, pronosticados: pron };
}

const redondear = (v: number, tipo: "sum" | "rate", unidad: string) => {
  if (unidad === "%" ) return Math.round(Math.min(100, Math.max(0, v)) * 100) / 100;
  if (tipo === "rate" || Math.abs(v) < 100) return Math.round(v * 100) / 100;
  const e = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.abs(v))) - 2));
  return Math.round(v / e) * e;
};

/** Efecto de las campañas en el mes i (fracción): {alc, int, seg absoluto}. */
/** Con `cat`, solo cuentan las campañas de esa categoría o de todas. */
export function efectoMes(cfg: OtrosConfig, i: number, cat?: string): Efecto {
  const o = { alc: 0, int: 0, seg: 0 };
  for (const t of TIPOS_CAMPANA) {
    const f = FACTOR_INT[cfg.gantt[t.id]?.[i] ?? 0] ?? 0;
    if (!f) continue;
    const ct = cfg.ganttCat?.[t.id]?.[i] ?? null;
    if (cat && ct && ct !== cat) continue;
    const e = cfg.efectos[t.id];
    o.alc += (f * e.alc) / 100; o.int += (f * e.int) / 100; o.seg += f * e.seg;
  }
  return o;
}

/** `invPlan` = inversión total del Plan de Medios por mes (calcInversion().total). */
export function proyectarOtros(cfg: OtrosConfig, h: HistOtros, anio: number, invPlan: number[] = []): Record<string, KpiProyectado[]> {
  const out: Record<string, KpiProyectado[]> = {};
  const mk = (plan: string, kpi: string, base: (number | null)[], factor: (i: number) => number, metodo: string): KpiProyectado | null => {
    const spec = KPIS_OTROS[plan]!.find((k) => k[0] === kpi)!;
    if (!base.some(ok)) return null;
    const b = base.map((v) => (ok(v) ? v : 0));
    return { plan, kpi, unidad: spec[1], direccion: spec[3], tipo: spec[2], base: b, valores: b.map((v, i) => redondear(v * factor(i), spec[2], spec[1])), metodo };
  };
  const ambF = (pct: number, dir: "up" | "down") => () => (dir === "down" ? 1 - pct / 100 : 1 + pct / 100);
  const push = (plan: string, k: KpiProyectado | null) => { if (k) (out[plan] ??= []).push(k); };

  // Web: mismo mes del año base × (1 + ambición).
  for (const [kpi, , , dir] of WEB) {
    if (kpi === "ROAS") continue;
    const { base, pronosticados } = baseMismoMes(h.series[`Web / Ecommerce|${kpi}`]);
    push("Web / Ecommerce", mk("Web / Ecommerce", kpi, base, ambF(cfg.amb.web, dir), `${h.anioBase} mismo mes${pronosticados ? ` (${pronosticados} mes${pronosticados > 1 ? "es" : ""} pronosticado${pronosticados > 1 ? "s" : ""})` : ""} ${cfg.amb.web >= 0 ? "+" : ""}${cfg.amb.web}%`));
  }
  const ing = out["Web / Ecommerce"]?.find((k) => k.kpi === "Total Ingresos");
  if (ing && invPlan.some((v) => v > 0)) {
    const conv = baseMismoMes(h.series["Web / Ecommerce|Inversión conversión"]).base;
    const roas = ing.valores.map((v, i) => { const d = (invPlan[i] ?? 0) + (conv[i] ?? 0); return d > 0 ? v / d : null; });
    push("Web / Ecommerce", mk("Web / Ecommerce", "ROAS", roas, () => 1, "ingresos proyectados ÷ (inversión del plan + conversión ecommerce)"));
  }

  // Instagram: mes normal + campañas del Gantt.
  const igAlc = mediana(ultimos(h.series["Redes Sociales|Alcance orgánico"] ?? [], 6));
  const igInt = mediana(ultimos(h.series["Redes Sociales|Interacciones"] ?? [], 6));
  // Con participación por categoría, cada categoría recibe solo sus campañas y el total es la suma.
  const igSh = h.shares?.["Redes Sociales|Alcance orgánico"];
  const igKpi = (kpi: string, base: number, campo: "alc" | "int") => {
    const k = mk("Redes Sociales", kpi, Array(N).fill(base), (i) => 1 + efectoMes(cfg, i)[campo], "mes normal (mediana 6 meses) + campañas");
    if (k && igSh) {
      k.porCat = Object.fromEntries(CATS_PLAN.map((c) => [c, Array.from({ length: N }, (_, i) => Math.round(base * (igSh[c] ?? 0) * (1 + efectoMes(cfg, i, c)[campo])))]));
      k.valores = Array.from({ length: N }, (_, i) => redondear(CATS_PLAN.reduce((t, c) => t + k.porCat![c]![i]!, 0), "sum", ""));
      k.metodo += " · por categoría con la participación del alcance";
    }
    push("Redes Sociales", k);
    return k;
  };
  const kAlc = igAlc != null ? igKpi("Alcance orgánico", igAlc, "alc") : null;
  const kInt = igInt != null ? igKpi("Interacciones", igInt, "int") : null;
  if (kAlc && kInt && igAlc) {
    const er = (igInt! / igAlc) * 100;
    const k = mk("Redes Sociales", "Engagement rate", Array(N).fill(er), () => 1, "interacciones ÷ alcance proyectados");
    if (k) k.valores = kAlc.valores.map((a, i) => redondear(a > 0 ? (kInt.valores[i]! / a) * 100 : 0, "rate", "%"));
    push("Redes Sociales", k);
  }
  const s = h.seguidores;
  if (s.ultimo != null && s.fecha) {
    // Stock: desde el último dato se suma el crecimiento orgánico del mes + lo que agregan las campañas.
    const [y, m] = s.fecha.split("-").map(Number) as [number, number];
    const mesesHastaEne = Math.max(0, (anio - y) * 12 - m);
    let st = s.ultimo + s.porMes * mesesHastaEne;
    const base: number[] = [], vals: number[] = [];
    for (let i = 0; i < N; i++) { st += s.porMes; base.push(st); vals.push(st); }
    let extra = 0;
    for (let i = 0; i < N; i++) { extra += efectoMes(cfg, i).seg; vals[i] = vals[i]! + extra; }
    push("Redes Sociales", { plan: "Redes Sociales", kpi: "Seguidores", unidad: "", direccion: "up", tipo: "rate", base, valores: vals.map((v) => Math.round(v / 100) * 100), metodo: `último ${s.ultimo.toLocaleString("es-AR")} + ${Math.round(s.porMes).toLocaleString("es-AR")}/mes + campañas` });
  }
  const sent = promedio(ultimos(h.series["Redes Sociales|Sentiment"] ?? [], 6));
  if (sent != null) push("Redes Sociales", mk("Redes Sociales", "Sentiment", Array(N).fill(sent), () => 1, "promedio 6 meses (continuidad)"));

  // Web: usuarios por categoría con la participación de los últimos meses (las metas por categoría suman el total).
  const webSh = h.shares?.["Web / Ecommerce|Tráfico web (usuarios)"];
  const kUs = out["Web / Ecommerce"]?.find((k) => k.kpi === "Tráfico web (usuarios)");
  if (kUs && webSh) kUs.porCat = Object.fromEntries(CATS_PLAN.map((c) => [c, kUs.valores.map((v) => redondear(v * (webSh[c] ?? 0), "sum", ""))]));

  // Facebook: mes normal × (1 + ambición).
  for (const kpi of ["Alcance orgánico", "Engagement rate"]) {
    const v = mediana(ultimos(h.series[`Facebook|${kpi}`] ?? [], 6));
    if (v != null) push("Facebook", mk("Facebook", kpi, Array(N).fill(v), ambF(cfg.amb.fb, "up"), `mes normal (mediana 6 meses) ${cfg.amb.fb >= 0 ? "+" : ""}${cfg.amb.fb}%`));
  }

  // SEO / mercado: continuidad.
  const ambTxt = cfg.amb.seo ? ` ${cfg.amb.seo > 0 ? "+" : ""}${cfg.amb.seo}%` : "";
  for (const k of MERCADO_KPIS) {
    const regla = (s0: Serie): [(number | null)[], string] => k.key === "Share of Search" ? [baseMismoMes(s0).base, `${h.anioBase} mismo mes`]
      : k.key === "Share of engagement" ? [Array(N).fill(mediana(ultimos(s0, 6))), "mediana 6 meses"]
      : [Array(N).fill(ultimos(s0, 1)[0] ?? null), "último relevamiento"];
    const [base, como] = regla(h.series[`Mercado y competencia|${k.key}`] ?? []);
    const km = mk("Mercado y competencia", k.key, base, ambF(cfg.amb.seo, k.direccion), `continuidad: ${como}${ambTxt}`);
    const sc = h.seriesCat?.[`Mercado y competencia|${k.key}`];
    if (km && sc) {
      const f = ambF(cfg.amb.seo, k.direccion)();
      const pc: Record<string, number[]> = {};
      for (const c of CATS_PLAN) { const b = regla(sc[c] ?? [])[0]; if (b.some(ok)) pc[c] = b.map((v) => redondear((v ?? 0) * f, "rate", k.unidad)); }
      if (Object.keys(pc).length) km.porCat = pc;
    }
    push("Mercado y competencia", km);
  }
  return out;
}

const MES3 = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
/** Aplanado para el historial de cambios (difPlan). */
export function otrosPlano(c: OtrosConfig): Record<string, string | number> {
  const o: Record<string, string | number> = {};
  for (const t of TIPOS_CAMPANA) {
    c.gantt[t.id].forEach((v, i) => { o[`Campaña ${t.label} ${MES3[i]}`] = `${INTENSIDADES[v] ?? "—"}${v && c.ganttCat?.[t.id]?.[i] ? ` · ${c.ganttCat[t.id]![i]}` : ""}`; });
    const e = c.efectos[t.id];
    o[`Efecto ${t.label} alcance %`] = e.alc; o[`Efecto ${t.label} interacciones %`] = e.int; o[`Efecto ${t.label} seguidores`] = e.seg;
  }
  o["Ambición Web %"] = c.amb.web; o["Ambición Facebook %"] = c.amb.fb; o["Ambición SEO %"] = c.amb.seo;
  return o;
}
