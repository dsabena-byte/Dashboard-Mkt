// ============================================================================
// ESCALAR / PROBAR / CORTAR por pieza de VIDEO (Plan de Medios · Eficiencia Medios) — PURO y client-safe.
// Adaptado del método "Scale & Kill" + "CPMr vs CPA" a la pauta de MARCA de Drean: no hay ventas por anuncio,
// así que el resultado es el VIDEO VISTO COMPLETO (100%) y el costo = inversión ÷ videos completos.
//  · Gráfico 1: cada pieza = inversión acumulada del año (x) vs costo por video completo (y). Con la inversión
//    los videos completos son un conteo → K ~ Poisson(inversión × tasa). Posterior de la tasa (videos por $):
//    Gamma(K + 0,5, inversión) (prior de Jeffreys). Escalar = 90% seguro de que el costo está por DEBAJO de la
//    meta; cortar = 90% seguro de que está por ENCIMA; si no, sigue en prueba. Con poca plata casi todo es
//    "prueba"; las curvas se cierran hacia la meta ±20% (MARGEN) a medida que sube la inversión.
//  · Gráfico 2: costo por mil personas alcanzadas (Meta/TikTok, alcance sumado por mes: aproximado) o por mil
//    impresiones (DV360 no da alcance por pieza) vs costo por video completo, cortado en las medianas del medio.
//  · Meta del costo = mediana del costo por video completo de las piezas del MISMO medio (editable en pantalla).
// Test: cd apps/web && npx tsx scripts/pauta-escalar.test.ts
// ============================================================================
import { ymDeLabel } from "./pauta-fatiga";

export type Zona = "escalar" | "probar" | "cortar";
export type Cuadrante = "eficiente" | "alcance" | "precision" | "caro";
export interface PiezaVideo {
  key: string;
  medio: string;            // Meta · TikTok · Programmatic · Demand Gen · Marketplace
  nombre: string;
  link: string | null;
  activa: boolean | null;
  inv: number;
  completos: number;        // videos vistos al 100%
  impr: number;
  alcance: number | null;   // null = el medio no da alcance por pieza
}
export interface PiezaEval extends PiezaVideo {
  costo: number | null;     // inversión ÷ videos completos (null sin completos)
  costoMil: number | null;  // por mil alcanzados (o impresiones si no hay alcance)
  zona: Zona;
  cuadrante: Cuadrante | null;
  accion: string;
}
export interface MedioEval { medio: string; meta: number; medianaMil: number | null; porAlcance: boolean; piezas: PiezaEval[]; curva: { inv: number; escalar: number; cortar: number }[] }

const Z90 = 1.2815515655446004; // cuantil 90% de la normal
/** Margen alrededor de la meta: con miles de videos completos cualquier diferencia es "segura" (una pieza 3% más cara
 *  quedaba "cortar"); solo se marca lo que se aparta más de ±20% de la meta. */
export const MARGEN = 0.2;
export const MIN_COMPLETOS = 10;
/** Cuantil de Gamma(a, 1) con Wilson-Hilferty. shortcut: impreciso con a < 1 (piezas con 0 videos completos), alcanza para decidir "prueba"; si se necesita exacto, invertir la gamma incompleta. */
export function gammaQ(a: number, z: number): number {
  const c = 1 / (9 * a);
  return Math.max(0, a * Math.pow(1 - c + z * Math.sqrt(c), 3));
}
/** Zona de una pieza contra la meta de costo por video completo. */
export function zona(inv: number, completos: number, meta: number): Zona {
  if (!(inv > 0) || !(meta > 0)) return "probar";
  const a = completos + 0.5;
  if (gammaQ(a, -Z90) / inv > 1 / (meta * (1 - MARGEN))) return "escalar"; // 90% seguro: cuesta < meta −20%
  if (gammaQ(a, Z90) / inv < 1 / (meta * (1 + MARGEN))) return "cortar";   // 90% seguro: cuesta > meta +20%
  return "probar";
}
/** Costo por video completo en el que una pieza con esa inversión pasa a "escalar" o "cortar" (curvas del gráfico 1). */
export function limites(inv: number, meta: number): { escalar: number; cortar: number } {
  // K tal que el cuantil de la tasa iguala la meta (bisección: el cuantil crece con K).
  const solve = (z: number, r0: number) => { let lo = 0, hi = inv * r0 * 4 + 50; for (let i = 0; i < 60; i++) { const k = (lo + hi) / 2; if (gammaQ(k + 0.5, z) / inv < r0) lo = k; else hi = k; } return (lo + hi) / 2; };
  const kEsc = solve(-Z90, 1 / (meta * (1 - MARGEN))), kCor = solve(Z90, 1 / (meta * (1 + MARGEN)));
  return { escalar: kEsc > 0 ? inv / kEsc : Infinity, cortar: kCor > 0 ? inv / kCor : Infinity };
}
const mediana = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2) : null; };

const ACCION: Record<Zona, Partial<Record<Cuadrante | "sin", string>>> = {
  escalar: { eficiente: "Subile 15–20% de inversión: rinde y llega barato a gente nueva.", precision: "Subile 5–15% y mirá que el costo se sostenga.", alcance: "Subile 5–15%.", caro: "Subile 5–15% y mirá que el costo se sostenga.", sin: "Subile 5–15%." },
  probar: { sin: "Dejala correr: todavía no hay datos suficientes para decidir." }, // "cerca de la meta" se arma abajo
  cortar: { caro: "Cortala: cuesta más que la meta y además es cara para llegar a la gente.", alcance: "Llega barato a gente nueva pero pocos ven el video entero: si el objetivo de la campaña es alcance, dejala; si es que vean el mensaje, cortala.", eficiente: "Cortala o cambiá la pieza: el video completo sale más caro que la meta.", precision: "Cortala o cambiá la pieza: el video completo sale más caro que la meta.", sin: "Cortala: el video completo sale más caro que la meta." },
};

/** Evalúa las piezas de un medio. `meta` opcional (si no, mediana del costo de las piezas del medio con ≥30 videos completos). */
export function evaluarMedio(medio: string, piezas: PiezaVideo[], meta?: number | null): MedioEval | null {
  const ps = piezas.filter((p) => p.inv > 0);
  if (!ps.length) return null;
  const base = mediana(ps.filter((p) => p.completos >= 30).map((p) => p.inv / p.completos));
  const m = meta && meta > 0 ? meta : base;
  if (!m) return null;
  const porAlcance = ps.some((p) => (p.alcance ?? 0) > 0);
  const mil = (p: PiezaVideo) => { const d = porAlcance ? p.alcance ?? 0 : p.impr; return d > 0 ? (p.inv / d) * 1000 : null; };
  const medianaMil = mediana(ps.map(mil).filter((v): v is number => v != null));
  const out: PiezaEval[] = ps.map((p) => {
    const costo = p.completos > 0 ? p.inv / p.completos : null;
    const costoMil = mil(p);
    const z = zona(p.inv, p.completos, m);
    const cuadrante: Cuadrante | null = costo == null || costoMil == null || medianaMil == null ? null
      : costoMil <= medianaMil ? (costo <= m ? "eficiente" : "alcance") : (costo <= m ? "precision" : "caro");
    const acc = ACCION[z];
    // En la franja de ±20%: si ya hay datos suficientes no es "falta probar", es que rinde parecido a la meta.
    const cerca = z === "probar" && costo != null && p.completos >= 100 && Math.abs(costo / m - 1) <= MARGEN;
    const accion = cerca ? "Rinde cerca de la meta: dejala como está." : (cuadrante && acc[cuadrante]) || acc.sin!;
    return { ...p, costo, costoMil, zona: z, cuadrante, accion };
  });
  const invs = ps.map((p) => p.inv);
  const lo = Math.max(1, Math.min(...invs) / 2), hi = Math.max(...invs) * 1.5;
  const curva = Array.from({ length: 40 }, (_, i) => { const inv = lo * Math.pow(hi / lo, i / 39); return { inv, ...limites(inv, m) }; });
  return { medio, meta: m, medianaMil, porAlcance, piezas: out, curva };
}

// ── Entrada: filas de las tablas que ya llegan a /performance ──
export interface EscMetaRow { ad_id: string; creative_id?: string | null; instagram_permalink_url?: string | null; permalink_url?: string | null; mes: string; plataforma: string; ad_name?: string | null; spend?: number | null; impresiones: number | null; alcance: number | null; video_p100?: number | null; activa?: boolean | null }
export interface EscDvRow { mes: string; canal: string; creative: string; impresiones: number | null; q100?: number | null; revenue_usd?: number | null }
export interface EscTtRow { ad_id: string; mes: string; ad_name: string; inv: number; impr: number; alcance: number; p100: number; link: string | null; activa: boolean | null }

const n0 = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v ?? 0) || 0);

/** Piezas de video del año (`anio`) por medio. DV360 viene en USD → $ con el TC del mes (`fxRates` "YYYY-MM-01"). */
export function piezasVideo(inp: { anio: number; metaPaid: EscMetaRow[]; dv360: EscDvRow[]; tiktok: EscTtRow[]; fxRates?: Record<string, number> }): Record<string, PiezaVideo[]> {
  const y = String(inp.anio);
  const acc = new Map<string, PiezaVideo>();
  const add = (p: Omit<PiezaVideo, "inv" | "completos" | "impr" | "alcance">, inv: number, completos: number, impr: number, alcance: number | null) => {
    const e = acc.get(p.key) ?? { ...p, inv: 0, completos: 0, impr: 0, alcance: alcance == null ? null : 0 };
    e.inv += inv; e.completos += completos; e.impr += impr;
    if (alcance != null) e.alcance = (e.alcance ?? 0) + alcance;
    if (p.activa != null) e.activa = p.activa;
    acc.set(p.key, e);
  };
  for (const r of inp.metaPaid) {
    if (r.plataforma !== "meta" || !ymDeLabel(r.mes)?.startsWith(y)) continue;
    const k = r.instagram_permalink_url || r.creative_id || r.ad_id;
    add({ key: `meta_${k}`, medio: "Meta", nombre: r.ad_name || "(sin nombre)", link: r.instagram_permalink_url || r.permalink_url || null, activa: r.activa ?? null }, n0(r.spend), n0(r.video_p100), n0(r.impresiones), n0(r.alcance));
  }
  for (const r of inp.dv360) {
    const ym = r.mes.slice(0, 7);
    if (!ym.startsWith(y) || /^unknown$/i.test(r.creative)) continue; // YouTube llega sin nombre de pieza
    add({ key: `dv_${r.canal}|${r.creative}`, medio: r.canal, nombre: r.creative, link: null, activa: null }, n0(r.revenue_usd) * (inp.fxRates?.[`${ym}-01`] ?? 1), n0(r.q100), n0(r.impresiones), null);
  }
  for (const r of inp.tiktok) {
    if (!r.mes.startsWith(y)) continue;
    add({ key: `tt_${r.ad_id}`, medio: "TikTok", nombre: r.ad_name || "(sin nombre)", link: r.link, activa: r.activa }, n0(r.inv), n0(r.p100), n0(r.impr), n0(r.alcance));
  }
  const out: Record<string, PiezaVideo[]> = {};
  // Solo piezas de VIDEO con gasto: con menos de 10 videos completos es un aviso de imagen/clic (ej. Meta CPC con 1 "video").
  for (const p of acc.values()) if (p.completos >= MIN_COMPLETOS && p.inv > 0) (out[p.medio] ??= []).push(p);
  return out;
}
