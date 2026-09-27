// ============================================================================
// FATIGA CREATIVA por pieza (Plan de Medios) — PURO y client-safe (imports relativos, sin I/O).
// Portado de BIP (lib/pauta-fatiga.ts, #130) y adaptado a la data de Drean.
// Criterio (Motion / playbooks de Meta): una pieza está FATIGADA cuando su tasa de respuesta cae
// ≥25% contra los períodos previos MIENTRAS su frecuencia sube (la misma gente la ve más veces y
// cada vez responde menos).
//
// Diferencia con BIP: Drean guarda la pauta por pieza y por MES (meta_paid_creatives,
// dv360_creatives), no por semana → la serie es MENSUAL:
//  · Pieza = mismo creativo en el tiempo. Meta: permalink de Instagram (o creative_id / ad_id): un
//    mismo posteo suele correr con ad_id distintos cada mes. DV360: canal + nombre del creativo.
//  · Tasa: piezas de VIDEO → VTR ≥50% (p50/q50 ÷ impresiones); el resto → CTR.
//  · Frecuencia: Meta = impresiones ÷ alcance de la pieza en el mes (alcance sumado entre ad_id:
//    aproximado). DV360 no da alcance por pieza → frecuencia de la LÍNEA del mismo canal × categoría
//    (dv360_reach, Σ impresiones ÷ Σ alcance). Se rotula.
//  · Último mes vs los 1-2 meses previos con volumen (≥ 10.000 impresiones, ponderado por impresiones).
//    Si el último es el mes EN CURSO se marca "parcial": su frecuencia está subestimada (el alcance
//    todavía acumula), así que la regla es conservadora (cuesta más que marque fatiga).
//  · Frecuencia mensual alta: > 5 (guía de BIP para frecuencia de período; Meta recomienda 1,5-3
//    exposiciones por semana para recordación).
// Test: cd apps/web && npx tsx scripts/pauta-fatiga.test.ts
// ============================================================================
import { PAUTA_MES_FULL } from "./pauta-medios-model";

export const FATIGA_CAIDA = 25;            // % de caída de la tasa (CTR o VTR) vs meses previos
export const FRECUENCIA_MES_ALTA = 5;      // frecuencia mensual alta
export const FATIGA_MIN_IMPR = 10_000;     // impresiones mínimas por mes para opinar

export type FatigaEstado = "fatiga" | "frecuencia_alta" | "ok";

export interface FatigaMes { mes: string; impr: number; clicks: number; v50: number; reach: number | null; freq: number | null; tasa: number; inv: number }
export interface FatigaPieza {
  key: string;
  fuente: "Meta" | "DV360";
  canal: string;              // Meta / YouTube / Programmatic
  nombre: string;
  categoria: string | null;
  thumb: string | null;
  permalink: string | null;
  metrica: "VTR" | "CTR";
  frecFuente: "pieza" | "línea";
  meses: FatigaMes[];         // meses con volumen, ordenados
  tasaUlt: number; tasaPrev: number; caidaPct: number | null;
  frecUlt: number | null; frecPrev: number | null;
  mesUlt: string;             // YYYY-MM
  parcial: boolean;           // el último mes es el mes en curso
  estado: FatigaEstado;
  motivo: string;
}
export interface FatigaResumen {
  piezas: FatigaPieza[];      // solo las que tienen 2+ meses con volumen (fatiga primero)
  evaluadas: number;          // piezas con volumen en el último mes
  sinSerie: number;           // de esas, con un solo mes (rotan antes de poder medir desgaste)
  mesEnCurso: string;
}

// Filas mínimas (estructurales) — compatibles con MetaPaidCreativeRow / Dv360CreativeRow / Dv360ReachRow.
export interface FatigaMetaRow { ad_id: string; creative_id?: string | null; instagram_permalink_url?: string | null; permalink_url?: string | null; mes: string; plataforma: string; ad_name?: string | null; categoria?: string | null; thumbnail_url?: string | null; image_url?: string | null; impresiones: number | null; alcance: number | null; clicks: number | null; spend?: number | null; video_p25?: number | null; video_p50: number | null; video_p75?: number | null }
export interface FatigaDvRow { mes: string; canal: string; categoria: string | null; creative: string; impresiones: number | null; clicks: number | null; starts: number | null; q50: number | null; revenue_usd?: number | null }
export interface FatigaDvReachRow { mes: string; canal: string; categoria?: string | null; impresiones: number | null; reach: number | null }

const n0 = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v ?? 0) || 0);
const f1 = (v: number) => v.toLocaleString("es-AR", { maximumFractionDigits: 1 });
const f2 = (v: number) => v.toLocaleString("es-AR", { maximumFractionDigits: 2 });
const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const mesCorto = (ym: string) => `${MES_CORTO[Number(ym.slice(5, 7)) - 1] ?? ym}${ym.slice(2, 4) ? ` ${ym.slice(2, 4)}` : ""}`;
/** "Agosto 2026" → "2026-08". */
export function ymDeLabel(label: string): string | null {
  const [full, y] = label.split(" ");
  const i = PAUTA_MES_FULL.indexOf(full ?? "");
  return i >= 0 && y ? `${y}-${String(i + 1).padStart(2, "0")}` : null;
}

interface Acc { impr: number; clicks: number; v50: number; reach: number; inv: number; video: boolean }

function evaluar(base: Omit<FatigaPieza, "meses" | "tasaUlt" | "tasaPrev" | "caidaPct" | "frecUlt" | "frecPrev" | "mesUlt" | "parcial" | "estado" | "motivo" | "metrica">, porMes: Map<string, Acc>, freqDe: (mes: string, a: Acc) => number | null, mesEnCurso: string): FatigaPieza | null {
  const ms = [...porMes.entries()].filter(([, a]) => a.impr >= FATIGA_MIN_IMPR).sort((a, b) => a[0].localeCompare(b[0]));
  if (!ms.length) return null;
  const video = ms.some(([, a]) => a.video && a.v50 > 0);
  const metrica: FatigaPieza["metrica"] = video ? "VTR" : "CTR";
  const tasa = (a: { impr: number; clicks: number; v50: number }) => (a.impr > 0 ? ((video ? a.v50 : a.clicks) / a.impr) * 100 : 0);
  const meses: FatigaMes[] = ms.map(([mes, a]) => ({ mes, impr: a.impr, clicks: a.clicks, v50: a.v50, reach: a.reach > 0 ? a.reach : null, freq: freqDe(mes, a), tasa: tasa(a), inv: a.inv }));
  const ult = meses[meses.length - 1]!;
  const prev = meses.slice(-3, -1);
  const pAgg = prev.reduce((s, m) => ({ impr: s.impr + m.impr, clicks: s.clicks + m.clicks, v50: s.v50 + m.v50 }), { impr: 0, clicks: 0, v50: 0 });
  const tasaUlt = ult.tasa, tasaPrev = prev.length ? tasa(pAgg) : 0;
  const caidaPct = prev.length && tasaPrev > 0 ? ((tasaUlt - tasaPrev) / tasaPrev) * 100 : null;
  const fPrevVals = prev.map((m) => m.freq).filter((v): v is number => v != null);
  const frecPrev = fPrevVals.length ? fPrevVals.reduce((a, v) => a + v, 0) / fPrevVals.length : null;
  const frecUlt = ult.freq;
  const parcial = ult.mes === mesEnCurso;
  const tU = metrica === "VTR" ? `${f1(tasaUlt)}%` : `${f2(tasaUlt)}%`, tP = metrica === "VTR" ? `${f1(tasaPrev)}%` : `${f2(tasaPrev)}%`;
  const cuando = `${mesCorto(ult.mes)}${parcial ? " (mes en curso)" : ""}`;
  const fTxt = base.frecFuente === "línea" ? "frecuencia de la línea" : "frecuencia";
  let estado: FatigaEstado = "ok", motivo: string;
  if (caidaPct != null && caidaPct <= -FATIGA_CAIDA && frecUlt != null && frecPrev != null && frecUlt > frecPrev) {
    estado = "fatiga";
    motivo = `${metrica} ${tU} en ${cuando} vs ${tP} los meses previos (${Math.round(caidaPct)}%) con la ${fTxt} subiendo de ${f1(frecPrev)} a ${f1(frecUlt)}.`;
  } else if (frecUlt != null && frecUlt > FRECUENCIA_MES_ALTA) {
    estado = "frecuencia_alta";
    motivo = `${fTxt[0]!.toUpperCase()}${fTxt.slice(1)} ${f1(frecUlt)} en ${cuando} (alta para un mes). ${caidaPct != null && caidaPct < 0 ? `El ${metrica} bajó ${Math.round(-caidaPct)}%.` : `El ${metrica} todavía no cae.`}`;
  } else if (caidaPct == null) {
    motivo = `Un solo mes con volumen (${cuando}): sin tendencia.`;
  } else {
    motivo = `${metrica} ${tU} (${caidaPct >= 0 ? "+" : ""}${Math.round(caidaPct)}% vs meses previos)${frecUlt != null ? ` · ${fTxt} ${f1(frecUlt)}${frecPrev != null ? ` (antes ${f1(frecPrev)})` : ""}` : ""}${caidaPct <= -FATIGA_CAIDA ? " · la caída no viene con más frecuencia: no es desgaste por repetición (revisar segmentación/puja)" : ""}.`;
  }
  return { ...base, metrica, meses, tasaUlt, tasaPrev, caidaPct, frecUlt, frecPrev, mesUlt: ult.mes, parcial, estado, motivo };
}

/**
 * Fatiga por pieza del año de la pauta (Meta + DV360). `mesEnCurso` = YYYY-MM de hoy (para rotular el
 * mes parcial). `fx` opcional (iso → ARS por USD) solo para ordenar DV360 por inversión.
 */
export function fatigaPiezas(inp: { metaPaid: FatigaMetaRow[]; dv360: FatigaDvRow[]; dv360Reach: FatigaDvReachRow[]; mesEnCurso: string; fxRates?: Record<string, number> }): FatigaResumen {
  const out: FatigaPieza[] = [];
  let evaluadas = 0, sinSerie = 0;
  const ultimoGlobal = (() => {
    const all = [...inp.metaPaid.map((r) => ymDeLabel(r.mes)), ...inp.dv360.map((r) => r.mes.slice(0, 7))].filter((x): x is string => !!x && x <= inp.mesEnCurso);
    return all.sort().pop() ?? inp.mesEnCurso;
  })();
  const push = (p: FatigaPieza | null) => {
    if (!p) return;
    if (p.mesUlt !== ultimoGlobal) return; // solo piezas que siguen al aire en el último mes con dato
    evaluadas++;
    if (p.meses.length < 2) { sinSerie++; return; }
    out.push(p);
  };

  // ── Meta ──
  const meta = new Map<string, { row: FatigaMetaRow; porMes: Map<string, Acc> }>();
  for (const r of inp.metaPaid) {
    if (r.plataforma !== "meta") continue;
    const ym = ymDeLabel(r.mes);
    if (!ym || ym > inp.mesEnCurso) continue;
    const key = r.instagram_permalink_url || r.creative_id || r.ad_id;
    const e = meta.get(key) ?? { row: r, porMes: new Map<string, Acc>() };
    const a = e.porMes.get(ym) ?? { impr: 0, clicks: 0, v50: 0, reach: 0, inv: 0, video: false };
    a.impr += n0(r.impresiones); a.clicks += n0(r.clicks); a.v50 += n0(r.video_p50); a.reach += n0(r.alcance); a.inv += n0(r.spend);
    if (n0(r.video_p25) + n0(r.video_p50) + n0(r.video_p75) > 0) a.video = true;
    e.porMes.set(ym, a);
    if (n0(r.impresiones) > n0(e.row.impresiones)) e.row = r; // nombre/miniatura de la fila más grande
    meta.set(key, e);
  }
  for (const [key, e] of meta) {
    push(evaluar({
      key: `meta_${key}`, fuente: "Meta", canal: "Meta", nombre: e.row.ad_name || "(sin nombre)", categoria: e.row.categoria ?? null,
      thumb: e.row.thumbnail_url || e.row.image_url || null, permalink: e.row.instagram_permalink_url || e.row.permalink_url || null, frecFuente: "pieza",
    }, e.porMes, (_m, a) => (a.reach > 0 ? a.impr / a.reach : null), inp.mesEnCurso));
  }

  // ── DV360 (frecuencia de la línea canal × categoría) ──
  const lineas = new Map<string, { impr: number; reach: number }>();
  for (const r of inp.dv360Reach) {
    const k = `${r.mes.slice(0, 7)}|${r.canal}|${r.categoria ?? ""}`;
    const a = lineas.get(k) ?? { impr: 0, reach: 0 };
    a.impr += n0(r.impresiones); a.reach += n0(r.reach); lineas.set(k, a);
  }
  const dv = new Map<string, { row: FatigaDvRow; porMes: Map<string, Acc> }>();
  for (const r of inp.dv360) {
    const ym = r.mes.slice(0, 7);
    if (ym > inp.mesEnCurso) continue;
    const key = `${r.canal}|${r.creative}`;
    const e = dv.get(key) ?? { row: r, porMes: new Map<string, Acc>() };
    const a = e.porMes.get(ym) ?? { impr: 0, clicks: 0, v50: 0, reach: 0, inv: 0, video: false };
    a.impr += n0(r.impresiones); a.clicks += n0(r.clicks); a.v50 += n0(r.q50);
    a.inv += n0(r.revenue_usd) * (inp.fxRates?.[`${ym}-01`] ?? 1);
    if (n0(r.starts) > 0) a.video = true;
    e.porMes.set(ym, a);
    dv.set(key, e);
  }
  for (const [key, e] of dv) {
    const cat = e.row.categoria ?? "";
    const nombre = /^unknown$/i.test(e.row.creative) ? `${e.row.canal} (sin nombre de pieza)` : e.row.creative;
    push(evaluar({
      key: `dv_${key}`, fuente: "DV360", canal: e.row.canal, nombre, categoria: e.row.categoria ?? null, thumb: null, permalink: null, frecFuente: "línea",
    }, e.porMes, (mes) => { const l = lineas.get(`${mes}|${e.row.canal}|${cat}`); return l && l.reach > 0 ? l.impr / l.reach : null; }, inp.mesEnCurso));
  }

  const ord: Record<FatigaEstado, number> = { fatiga: 0, frecuencia_alta: 1, ok: 2 };
  out.sort((a, b) => ord[a.estado] - ord[b.estado] || (b.meses[b.meses.length - 1]?.impr ?? 0) - (a.meses[a.meses.length - 1]?.impr ?? 0));
  return { piezas: out, evaluadas, sinSerie, mesEnCurso: inp.mesEnCurso };
}
