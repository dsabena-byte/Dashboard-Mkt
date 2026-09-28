// ============================================================================
// Search Console A FONDO (gap G4 de docs/estado-del-arte/seo-geo.md §4.4-4.5). PURO y client-safe.
//   · Canibalización: varias URLs propias reparten las impresiones de la misma búsqueda (§4.4).
//   · Contenido que decae: páginas con caída sostenida de clics, 90 días vs 90 previos y vs el
//     mismo período del año anterior (controla estacionalidad), con la causa probable (§4.5).
//   · Corte por dispositivo: mobile vs desktop (posición, CTR vs esperado, variación).
// Portado de BIP (sep-2026). Lo usan la UI (components/seo-search/seo-avanzado-section.tsx) y las
// señales (lib/signals/seo.ts → computeSeoAvanzadoSignals). Test: scripts/seo-avanzado.test.ts.
// Los umbrales son los de práctica que cita el doc (heurísticos, se muestran como tales).
// ============================================================================
import type { ScRow, ScQueryPage } from "./signals/model";
import { ctrAt, type CtrCurve } from "./ctr-curve";

export interface ScDevice { device: string; clicks: number; impressions: number; ctr: number; position: number }

const normQ = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
/** URL canónica para comparar (sin #fragmento, sin barra final; el query string se conserva). */
export function normUrl(u: string): string {
  const s = (u || "").trim().replace(/#.*$/, "");
  return s.length > 1 ? s.replace(/\/+$/, "").replace(/\/+\?/, "?").toLowerCase() : s.toLowerCase();
}
const brandRe = (brand?: string | null) => {
  const b = normQ(brand ?? "");
  return b.length >= 3 ? new RegExp(`(^|[^a-z0-9])${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`) : null;
};

// ── Canibalización ───────────────────────────────────────────────────────────
export const CANIBAL_MIN_IMPR = 200;       // impresiones de la búsqueda (90 días)
export const CANIBAL_MIN_SEGUNDA = 0.15;   // share de impresiones de la 2ª URL
export const CANIBAL_POS = [3, 20] as const;

/** Pre-filtro para PERSISTIR en el snapshot solo lo necesario: filas query×página de búsquedas
 *  con ≥2 URLs distintas (≥5 impresiones cada una). Ordena por impresiones de la búsqueda. */
export function prefiltroCanibal(rows: ScQueryPage[], cap = 1500): ScQueryPage[] {
  const by = new Map<string, ScQueryPage[]>();
  for (const r of rows) { if (!(r.impressions >= 5)) continue; const k = normQ(r.query); const a = by.get(k) ?? []; a.push(r); by.set(k, a); }
  const groups = [...by.values()].filter((g) => new Set(g.map((r) => normUrl(r.page))).size >= 2);
  groups.sort((a, b) => b.reduce((s, r) => s + r.impressions, 0) - a.reduce((s, r) => s + r.impressions, 0));
  const out: ScQueryPage[] = [];
  for (const g of groups) { if (out.length + g.length > cap) break; out.push(...g); }
  return out;
}

export interface CanibalUrl { page: string; impresiones: number; clicks: number; ctr: number; posicion: number; share: number }
export interface Canibalizacion {
  query: string; impresiones: number; clicks: number;
  posicionMedia: number; posicionMejor: number;
  urls: CanibalUrl[];
  hhi: number; segundaShare: number;
  /** Clics/mes (≈ 90 días / 3) que se ganarían consolidando en una URL que suba 1 posición. */
  clicksGanables: number;
  severidad: "alta" | "media";
  principal: string;
}

export function detectarCanibalizacion(
  rows: ScQueryPage[] | null | undefined,
  opts: { ownBrand?: string | null; curve?: CtrCurve | null; minImpr?: number; minSegunda?: number; dias?: number } = {},
): Canibalizacion[] {
  const minImpr = opts.minImpr ?? CANIBAL_MIN_IMPR, minSeg = opts.minSegunda ?? CANIBAL_MIN_SEGUNDA;
  const meses = (opts.dias ?? 90) / 30;
  const bre = brandRe(opts.ownBrand);
  const by = new Map<string, { query: string; urls: Map<string, { page: string; i: number; c: number; pw: number }> }>();
  for (const r of rows ?? []) {
    const k = normQ(r.query);
    if (!k || (bre && bre.test(k))) continue;   // las búsquedas de marca rankean varias URLs a propósito
    const g = by.get(k) ?? { query: r.query, urls: new Map() };
    const u = normUrl(r.page);
    const e = g.urls.get(u) ?? { page: r.page, i: 0, c: 0, pw: 0 };
    e.i += r.impressions; e.c += r.clicks; e.pw += r.position * r.impressions;
    g.urls.set(u, e); by.set(k, g);
  }
  const out: Canibalizacion[] = [];
  for (const g of by.values()) {
    const urls = [...g.urls.values()].filter((u) => u.i > 0).sort((a, b) => b.i - a.i);
    if (urls.length < 2) continue;
    const tot = urls.reduce((s, u) => s + u.i, 0);
    if (tot < minImpr) continue;
    const shares = urls.map((u) => u.i / tot);
    if (shares[1]! < minSeg) continue;
    const pos = urls.map((u) => u.pw / u.i);
    const posMedia = urls.reduce((s, u) => s + u.pw, 0) / tot;
    if (posMedia < CANIBAL_POS[0] || posMedia > CANIBAL_POS[1]) continue;
    const clicks = urls.reduce((s, u) => s + u.c, 0);
    const posMejor = Math.min(...pos);
    // Ganancia ≈ Imp × [CTR(Pos_mejor − 1) − Σ s_i·CTR_i]  (§4.4), CTR_i observado.
    const ctrObs = clicks / tot * 100;
    const ctrObj = ctrAt(Math.max(1, posMejor - 1), { curve: opts.curve ?? null });
    const ganancia = Math.max(0, (tot * (ctrObj - ctrObs)) / 100) / meses;
    const hhi = shares.reduce((s, x) => s + x * x, 0);
    const iMejor = pos.indexOf(posMejor);
    out.push({
      query: g.query, impresiones: tot, clicks, posicionMedia: posMedia, posicionMejor: posMejor,
      urls: urls.map((u, i) => ({ page: u.page, impresiones: u.i, clicks: u.c, ctr: u.i ? (u.c / u.i) * 100 : 0, posicion: pos[i]!, share: shares[i]! * 100 })),
      hhi, segundaShare: shares[1]! * 100, clicksGanables: Math.round(ganancia),
      severidad: shares[1]! >= 0.3 || ganancia >= 50 ? "alta" : "media",
      principal: urls[iMejor]?.page ?? urls[0]!.page,
    });
  }
  return out.sort((a, b) => b.clicksGanables - a.clicksGanables || b.impresiones - a.impresiones);
}

// ── Contenido que decae ──────────────────────────────────────────────────────
export const DECAY_D90 = -0.2;        // −20% vs 90 días previos
export const DECAY_YOY = -0.3;        // −30% vs mismo período del año anterior
export const DECAY_D90_SIN_YOY = -0.35;
export const DECAY_MIN_IMPR_PREV = 1000;

export type CausaDecay = "ranking" | "serp" | "demanda" | "mixta";
export interface PaginaDecae {
  page: string;
  clicks: number; clicksPrev: number; clicksYoY: number | null;
  d90: number; dYoY: number | null;    // variación relativa (−0,35 = −35%)
  impr: number; imprPrev: number; pos: number; posPrev: number; ctr: number; ctrPrev: number;
  causa: CausaDecay; clicksPerdidos: number; sinInteranual: boolean;
}
export const CAUSA_TXT: Record<CausaDecay, { titulo: string; accion: string }> = {
  ranking: { titulo: "bajó de lugar en Google", accion: "Actualizá y ampliá el contenido de la página (datos al día, los temas que cubren las páginas que te pasaron) y sumá links hacia ella desde otras páginas del sitio (enlaces internos)." },
  serp: { titulo: "mismo lugar en Google, pero menos clics (cambió cómo se ven los resultados)", accion: "La página aparece en el mismo lugar pero la gente hace menos clic: probablemente Google ahora muestra un Resumen con IA u otros recuadros arriba. Buscá que la IA te cite (datos concretos, especificaciones, comparativas) y mejorá el título y la descripción que muestra Google." },
  demanda: { titulo: "bajaron las búsquedas", accion: "Sigue en el mismo lugar pero aparece menos veces: es que la gente busca menos (por la época del año o el mercado). Antes de tocar la página, compará con las búsquedas de la categoría." },
  mixta: { titulo: "cayó sin una causa clara", accion: "Pedile al equipo web que revise la página: contenido viejo, cambios técnicos recientes (redirecciones, etiquetas canonical o noindex) y cómo se ven hoy los resultados de Google para sus búsquedas principales." },
};

export function detectarDecaimiento(
  cur: ScRow[] | null | undefined, prev: ScRow[] | null | undefined, yoy: ScRow[] | null | undefined,
  opts: { minImprPrev?: number; truncado?: number } = {},
): PaginaDecae[] {
  const minImpr = opts.minImprPrev ?? DECAY_MIN_IMPR_PREV;
  const truncado = opts.truncado ?? 500;   // la lista actual llegó al rowLimit → una página ausente no es "0 clics"
  const curM = new Map((cur ?? []).map((r) => [normUrl(r.key), r]));
  const yoyM = yoy ? new Map(yoy.map((r) => [normUrl(r.key), r])) : null;
  const curFull = (cur ?? []).length >= truncado;
  const out: PaginaDecae[] = [];
  for (const p of prev ?? []) {
    if (p.impressions < minImpr || p.clicks < 10) continue;
    const k = normUrl(p.key);
    const c = curM.get(k);
    if (!c && curFull) continue;
    const clicks = c?.clicks ?? 0, impr = c?.impressions ?? 0;
    const d90 = clicks / p.clicks - 1;
    const y = yoyM?.get(k) ?? null;
    const conYoY = !!y && y.clicks >= 10;
    const dYoY = conYoY ? clicks / y!.clicks - 1 : null;
    const decae = conYoY ? d90 <= DECAY_D90 && dYoY! <= DECAY_YOY : d90 <= DECAY_D90_SIN_YOY;
    if (!decae) continue;
    const pos = c?.position ?? 0, ctr = c?.ctr ?? 0;
    const dPos = c ? pos - p.position : 99;
    const dImpr = p.impressions ? impr / p.impressions - 1 : 0;
    const dCtr = p.ctr ? ctr / p.ctr - 1 : 0;
    const causa: CausaDecay = dPos >= 1.5 ? "ranking" : dCtr <= -0.2 && dImpr > -0.2 ? "serp" : dImpr <= -0.2 && Math.abs(dPos) < 1.5 ? "demanda" : "mixta";
    out.push({
      page: p.key, clicks, clicksPrev: p.clicks, clicksYoY: conYoY ? y!.clicks : null, d90, dYoY,
      impr, imprPrev: p.impressions, pos, posPrev: p.position, ctr, ctrPrev: p.ctr,
      causa, clicksPerdidos: Math.max(0, p.clicks - clicks), sinInteranual: !conYoY,
    });
  }
  return out.sort((a, b) => b.clicksPerdidos - a.clicksPerdidos);
}

// ── Dispositivos ─────────────────────────────────────────────────────────────
export interface DispositivoFila {
  device: string; label: string;
  clicks: number; impressions: number; ctr: number; position: number;
  shareClicks: number; shareImpr: number;
  ctrEsperado: number; ctrVsEsperado: number | null;   // CTR ÷ esperado para su posición
  dClicks: number | null;                              // variación vs 90 días previos
}
export interface DispositivosAnalisis {
  filas: DispositivoFila[];
  hallazgo: { tipo: "pos_mobile" | "ctr_mobile" | "caida_mobile"; texto: string } | null;
}
const DEV_LABEL: Record<string, string> = { MOBILE: "Mobile", DESKTOP: "Desktop", TABLET: "Tablet" };

export function analizarDispositivos(cur: ScDevice[] | null | undefined, prev: ScDevice[] | null | undefined, curve?: CtrCurve | null): DispositivosAnalisis {
  const rows = (cur ?? []).filter((r) => r.impressions > 0);
  if (!rows.length) return { filas: [], hallazgo: null };
  const tc = rows.reduce((s, r) => s + r.clicks, 0), ti = rows.reduce((s, r) => s + r.impressions, 0);
  const pm = new Map((prev ?? []).map((r) => [r.device.toUpperCase(), r]));
  const filas: DispositivoFila[] = rows.map((r) => {
    const dev = r.device.toUpperCase();
    const esp = ctrAt(r.position, { curve: curve ?? null });
    const p = pm.get(dev);
    return {
      device: dev, label: DEV_LABEL[dev] ?? r.device, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position,
      shareClicks: tc ? (r.clicks / tc) * 100 : 0, shareImpr: (r.impressions / ti) * 100,
      ctrEsperado: esp, ctrVsEsperado: esp > 0 ? r.ctr / esp : null,
      dClicks: p && p.clicks > 0 ? r.clicks / p.clicks - 1 : null,
    };
  }).sort((a, b) => b.impressions - a.impressions);
  const m = filas.find((f) => f.device === "MOBILE"), d = filas.find((f) => f.device === "DESKTOP");
  let hallazgo: DispositivosAnalisis["hallazgo"] = null;
  if (m && d && m.shareImpr >= 40 && d.impressions >= 200 && m.impressions >= 200) {
    if (m.position - d.position >= 2) hallazgo = { tipo: "pos_mobile", texto: `En mobile rankeás en promedio ${(m.position - d.position).toFixed(1)} posiciones más abajo que en desktop (${m.position.toFixed(1)} vs ${d.position.toFixed(1)}) y mobile es el ${Math.round(m.shareImpr)}% de las impresiones.` };
    else if (m.ctrVsEsperado != null && d.ctrVsEsperado != null && d.ctrVsEsperado > 0 && m.ctrVsEsperado < d.ctrVsEsperado * 0.7) hallazgo = { tipo: "ctr_mobile", texto: `En mobile el CTR rinde ${Math.round(m.ctrVsEsperado * 100)}% de lo esperado para su posición vs ${Math.round(d.ctrVsEsperado * 100)}% en desktop.` };
    else if (m.dClicks != null && d.dClicks != null && m.dClicks <= -0.2 && m.dClicks - d.dClicks <= -0.15) hallazgo = { tipo: "caida_mobile", texto: `Los clics desde mobile cayeron ${Math.round(-m.dClicks * 100)}% vs los 90 días previos (desktop ${d.dClicks >= 0 ? "+" : ""}${Math.round(d.dClicks * 100)}%).` };
  }
  return { filas, hallazgo };
}

// ── Todo junto ───────────────────────────────────────────────────────────────
export interface ScDeepInput {
  ok: boolean;
  queryPage?: ScQueryPage[]; queryPageMulti?: ScQueryPage[];
  pages?: ScRow[]; pagesPrev?: ScRow[]; pagesYoY?: ScRow[];
  devices?: ScDevice[]; devicesPrev?: ScDevice[];
  pagesLimit?: number;
}
export interface ScDeep {
  disponible: boolean;               // el snapshot trae los datos nuevos (tras el próximo sync)
  canibalizacion: Canibalizacion[];
  decaimiento: PaginaDecae[];
  dispositivos: DispositivosAnalisis;
  sitioD90: number | null;           // variación de clics del sitio (páginas top) 90d vs 90d previos
}
export function analyzeScDeep(d: ScDeepInput | null | undefined, opts: { ownBrand?: string | null; curve?: CtrCurve | null } = {}): ScDeep {
  const empty: ScDeep = { disponible: false, canibalizacion: [], decaimiento: [], dispositivos: { filas: [], hallazgo: null }, sitioD90: null };
  if (!d?.ok) return empty;
  const disponible = !!(d.queryPageMulti || d.pagesPrev || d.devices);
  const canibalizacion = detectarCanibalizacion(d.queryPageMulti ?? d.queryPage ?? [], opts);
  const decaimiento = d.pagesPrev ? detectarDecaimiento(d.pages, d.pagesPrev, d.pagesYoY ?? null, { truncado: d.pagesLimit ?? 500 }) : [];
  const sc = (d.pages ?? []).reduce((s, r) => s + r.clicks, 0), sp = (d.pagesPrev ?? []).reduce((s, r) => s + r.clicks, 0);
  return { disponible, canibalizacion, decaimiento, dispositivos: analizarDispositivos(d.devices, d.devicesPrev, opts.curve), sitioD90: d.pagesPrev && sp > 0 ? sc / sp - 1 : null };
}
