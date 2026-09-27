// Umbrales propios de alertas (portado de BIP, sep-2026): "avisame si el CPM supera $X o las sesiones
// caen 20%". PURO y client-safe. Se evalúa sobre el ÚLTIMO MES CERRADO (un mes parcial nunca dispara) de
// las series mensuales que arman los datasets nativos (lib/native-datasets-core: Plan de Medios con el
// gap-fill del dash, Web GA4 mensual, Instagram), así la definición de cada métrica es la misma que se ve
// en "Mis tableros". Los disparos entran a /alerts y a los emails. Imports solo relativos (test suelto).
import type { Dataset } from "./viz/types";

export type UmbralCond = "mayor" | "menor" | "cae_pct" | "sube_pct";
export interface Umbral { id: string; metrica: string; cond: UmbralCond; valor: number }
export type UmbralFuente = "pauta" | "web" | "redes";
export interface UmbralMetrica { id: string; nombre: string; fuente: UmbralFuente; unidad: "$" | "" | "%" | "x"; dash: string }

export const UMBRAL_METRICAS: UmbralMetrica[] = [
  { id: "inversion", nombre: "Inversión (Plan de Medios)", fuente: "pauta", unidad: "$", dash: "performance" },
  { id: "impresiones", nombre: "Impresiones", fuente: "pauta", unidad: "", dash: "performance" },
  { id: "alcance", nombre: "Alcance (suma por medio)", fuente: "pauta", unidad: "", dash: "performance" },
  { id: "clicks", nombre: "Clicks", fuente: "pauta", unidad: "", dash: "performance" },
  { id: "cpm", nombre: "CPM", fuente: "pauta", unidad: "$", dash: "performance" },
  { id: "cpc", nombre: "CPC", fuente: "pauta", unidad: "$", dash: "performance" },
  { id: "ctr", nombre: "CTR", fuente: "pauta", unidad: "%", dash: "performance" },
  { id: "frecuencia", nombre: "Frecuencia", fuente: "pauta", unidad: "x", dash: "performance" },
  { id: "trafico", nombre: "Usuarios web", fuente: "web", unidad: "", dash: "web" },
  { id: "sesiones", nombre: "Sesiones", fuente: "web", unidad: "", dash: "web" },
  { id: "conversiones", nombre: "Conversiones web", fuente: "web", unidad: "", dash: "web" },
  { id: "conversion", nombre: "Tasa de conversión web", fuente: "web", unidad: "%", dash: "web" },
  { id: "alcance_organico", nombre: "Alcance orgánico de Instagram", fuente: "redes", unidad: "", dash: "redes" },
  { id: "engagement", nombre: "Engagement rate de Instagram", fuente: "redes", unidad: "%", dash: "redes" },
];
export const COND_LABEL: Record<UmbralCond, string> = { mayor: "supera", menor: "queda por debajo de", cae_pct: "cae más de", sube_pct: "sube más de" };
export const MAX_UMBRALES = 10;

/** Sanea la lista que manda el cliente (métricas conocidas, valores finitos, % entre 1 y 100). */
export function cleanUmbrales(raw: unknown): Umbral[] {
  if (!Array.isArray(raw)) return [];
  const out: Umbral[] = [];
  for (const r of raw.slice(0, MAX_UMBRALES)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const metrica = String(o.metrica ?? "");
    if (!UMBRAL_METRICAS.some((m) => m.id === metrica)) continue;
    const cond = (["mayor", "menor", "cae_pct", "sube_pct"] as const).find((c) => c === o.cond);
    const valor = typeof o.valor === "number" ? o.valor : Number(String(o.valor ?? "").replace(/\./g, "").replace(",", "."));
    if (!cond || !Number.isFinite(valor) || valor < 0) continue;
    if ((cond === "cae_pct" || cond === "sube_pct") && (valor < 1 || valor > 100)) continue;
    const id = typeof o.id === "string" && /^[a-z0-9_-]{1,24}$/i.test(o.id) ? o.id : `u${out.length}_${Math.round(valor)}`;
    out.push({ id, metrica, cond, valor });
  }
  return out;
}

const fmtN = (v: number, u: UmbralMetrica["unidad"]) => {
  const n = v.toLocaleString("es-AR", { maximumFractionDigits: u === "%" || u === "x" ? 2 : 0 });
  return u === "$" ? `$ ${n}` : u === "%" ? `${n}%` : u === "x" ? `${n}x` : n;
};
export function describirUmbral(u: Umbral): string {
  const m = UMBRAL_METRICAS.find((x) => x.id === u.metrica);
  if (!m) return u.metrica;
  return u.cond === "cae_pct" || u.cond === "sube_pct" ? `${m.nombre} ${COND_LABEL[u.cond]} ${u.valor}% vs el mes anterior` : `${m.nombre} ${COND_LABEL[u.cond]} ${fmtN(u.valor, m.unidad)}`;
}

// ── Series mensuales desde los datasets nativos (mismas columnas que lib/native-datasets-core) ──
export type Serie = { mes: string; valor: number | null }[];
function col(ds: Dataset | null | undefined, name: string): number { return ds ? ds.columns.indexOf(name) : -1; }
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function seriesDesdeNativos(src: { pauta?: Dataset | null; web?: Dataset | null; redes?: Dataset | null }): Record<string, Serie> {
  const out: Record<string, Serie> = {};
  const P = src.pauta;
  if (P && P.rows.length) {
    const [iM, iInv, iImp, iAlc, iClk, iInvI] = ["Mes", "Inversión", "Impresiones", "Alcance", "Clicks", "Inversión de medios con impresiones"].map((c) => col(P, c)) as [number, number, number, number, number, number];
    // CPM/CPC sobre la inversión de medios CON impresiones (las filas OMD sin performance inflarían el costo).
    const rows = P.rows.map((r) => { const inv = num(r[iInv]); return { mes: String(r[iM]).slice(0, 7), inv, invI: iInvI >= 0 ? num(r[iInvI]) : inv, imp: num(r[iImp]), alc: num(r[iAlc]), clk: num(r[iClk]) }; });
    out.inversion = rows.map((r) => ({ mes: r.mes, valor: r.inv }));
    out.impresiones = rows.map((r) => ({ mes: r.mes, valor: r.imp }));
    out.clicks = rows.map((r) => ({ mes: r.mes, valor: r.clk }));
    out.alcance = rows.map((r) => ({ mes: r.mes, valor: r.alc }));
    out.cpm = rows.map((r) => ({ mes: r.mes, valor: r.invI != null && r.imp ? (r.invI / r.imp) * 1000 : null }));
    out.cpc = rows.map((r) => ({ mes: r.mes, valor: r.invI != null && r.clk ? r.invI / r.clk : null }));
    out.ctr = rows.map((r) => ({ mes: r.mes, valor: r.clk != null && r.imp ? (r.clk / r.imp) * 100 : null }));
    out.frecuencia = rows.map((r) => ({ mes: r.mes, valor: r.imp != null && r.alc ? r.imp / r.alc : null }));
  }
  const W = src.web;
  if (W && W.rows.length) {
    const idx = (c: string) => col(W, c);
    const map: [string, string][] = [["trafico", "Usuarios"], ["sesiones", "Sesiones"], ["conversiones", "Conversiones"], ["conversion", "Tasa de conversión (%)"]];
    for (const [id, c] of map) { const i = idx(c); if (i >= 0) out[id] = W.rows.map((r) => ({ mes: String(r[idx("Mes")]).slice(0, 7), valor: num(r[i]) })); }
  }
  const R = src.redes;
  if (R && R.rows.length) {
    const iM = col(R, "Mes"), iA = col(R, "Alcance"), iI = col(R, "Interacciones");
    const by = new Map<string, { a: number; i: number; n: number }>();
    for (const r of R.rows) {
      const k = String(r[iM]).slice(0, 7);
      const cur = by.get(k) ?? { a: 0, i: 0, n: 0 };
      const a = num(r[iA]), i = num(r[iI]);
      if (a != null) { cur.a += a; cur.n++; }
      if (i != null) cur.i += i;
      by.set(k, cur);
    }
    const keys = [...by.keys()].sort();
    out.alcance_organico = keys.map((k) => ({ mes: k, valor: by.get(k)!.n ? by.get(k)!.a : null }));
    out.engagement = keys.map((k) => { const v = by.get(k)!; return { mes: k, valor: v.a > 0 ? (v.i / v.a) * 100 : null }; });
  }
  return out;
}

export interface Disparo { umbral: Umbral; metrica: UmbralMetrica; mes: string; valor: number; previo: number | null; cambioPct: number | null; titulo: string; descripcion: string }
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesTxt = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1] ?? ym} ${ym.slice(0, 4)}`;

/** Evalúa cada umbral sobre el último mes CERRADO con dato (y el anterior para las variaciones). */
export function evaluarUmbrales(umbrales: Umbral[], series: Record<string, Serie>, hoy = new Date()): Disparo[] {
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const out: Disparo[] = [];
  for (const u of umbrales) {
    const m = UMBRAL_METRICAS.find((x) => x.id === u.metrica);
    const s = (series[u.metrica] ?? []).filter((p) => p.valor != null && p.mes < mesActual).sort((a, b) => a.mes.localeCompare(b.mes));
    if (!m || !s.length) continue;
    const last = s[s.length - 1]!, prev = s.length > 1 ? s[s.length - 2] : null;
    const v = last.valor!, pv = prev?.valor ?? null;
    const cambio = pv != null && pv !== 0 ? ((v - pv) / Math.abs(pv)) * 100 : null;
    let hit = false;
    if (u.cond === "mayor") hit = v > u.valor;
    else if (u.cond === "menor") hit = v < u.valor;
    else if (u.cond === "cae_pct") hit = cambio != null && cambio <= -u.valor;
    else if (u.cond === "sube_pct") hit = cambio != null && cambio >= u.valor;
    if (!hit) continue;
    const pct = cambio == null ? "" : ` (${cambio > 0 ? "+" : ""}${cambio.toFixed(1).replace(".", ",")}% vs ${mesTxt(prev!.mes)})`;
    out.push({
      umbral: u, metrica: m, mes: last.mes, valor: v, previo: pv, cambioPct: cambio,
      titulo: `${m.nombre} en ${mesTxt(last.mes)}: ${fmtN(v, m.unidad)}${pct}`,
      descripcion: `Se cumplió tu umbral: ${describirUmbral(u)}.`,
    });
  }
  return out;
}
