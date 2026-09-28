// Señales de PLAN DE MEDIOS (Meta Ads + Google Ads). Port de pauta-insights + el motor
// inline de Drean (eficiencia por medio, CPM efectivo por VTR, reasignación con ganancia
// cuantificada, frecuencia, CTR bajo, video desperdiciado) + la spec de alertas
// (docs/alertas-plan-medios.md de Drean): CPCV como métrica madre, benchmark = lo MEJOR propio
// (cuartil superior), outliers vs la mediana del bucket (3× / 8×), gasto sin resultados y
// ritmo de gasto. Lo que la spec pide y la data de BIP no trae (días activos por pieza →
// burst/burn rate; presupuesto plan → sobre/sub-ejecución) queda afuera a propósito.
// Medios OFFLINE (planilla): las reglas de arriba corren SOLO sobre campañas digitales (las filas
// offline no tienen impresiones/clicks/VTR); las offline tienen su bloque (offlineSignals): CPM de
// contactos vs mediana, concentración en un medio, costo por GRP fuera de rango, meses con offline
// sin soporte digital y share offline vs el histórico propio.
// Puro y client-safe (lo usa también el tab Insights de /performance sin IA).
import type { PautaFull, CampaignRow, CreativeRow, PautaMonth } from "./model";
import { type Signal, sortSignals, median, quantile, sum, avg, deltaPct, fInt, fNum, fPct, fDelta, fMoney, clip, r2 } from "./types";
import { rangoEsperado, dentroDeLoNormal, datosRango } from "./banda";
import type { PacingMes } from "../pauta-pacing";
import type { FatigaResumen } from "../pauta-fatiga";

export type Rol = "Awareness" | "Consideración" | "Conversión";
// Mismo criterio que el tablero (performance-tabs rolDe): objetivo de Meta o tipo de campaña de Google.
export function rolDe(obj: string | null | undefined): Rol {
  const o = (obj ?? "").toUpperCase();
  if (/SALE|CONVERSION|CATALOG|LEAD|PURCHASE|PERFORMANCE_MAX|SHOPPING/.test(o)) return "Conversión";
  if (/AWARENESS|REACH|BRAND|VIDEO|VIEW|DISPLAY/.test(o)) return "Awareness";
  return "Consideración";
}
export const medioDe = (c: { medio?: string }) => c.medio ?? "Meta";
const invDig = (m: PautaMonth) => Math.max(0, m.inv - (m.invOff ?? 0));
const isSearch = (c: CampaignRow) => /SEARCH/i.test(c.objective ?? "");
const cpcvOf = (c: { spend: number; p100: number }) => (c.p100 > 0 ? c.spend / c.p100 : 0);

export interface MedioAgg { medio: string; spend: number; impressions: number; clicks: number; reach: number; p50: number; p100: number; vbase: number; cpm: number; cpc: number; ctr: number; vtr50: number; cpcv: number; campañas: number }
export function aggBy(camps: CampaignRow[], keyOf: (c: CampaignRow) => string): MedioAgg[] {
  const m = new Map<string, MedioAgg>();
  for (const c of camps) {
    const k = keyOf(c);
    const a = m.get(k) ?? { medio: k, spend: 0, impressions: 0, clicks: 0, reach: 0, p50: 0, p100: 0, vbase: 0, cpm: 0, cpc: 0, ctr: 0, vtr50: 0, cpcv: 0, campañas: 0 };
    a.spend += c.spend; a.impressions += c.impressions; a.clicks += c.clicks; a.reach += c.reach; a.p50 += c.p50; a.p100 += c.p100; a.vbase += c.vbase; a.campañas++;
    m.set(k, a);
  }
  return [...m.values()].map((a) => ({ ...a, cpm: a.impressions ? (a.spend / a.impressions) * 1000 : 0, cpc: a.clicks ? a.spend / a.clicks : 0, ctr: a.impressions ? (a.clicks / a.impressions) * 100 : 0, vtr50: a.vbase ? (a.p50 / a.vbase) * 100 : 0, cpcv: a.p100 ? a.spend / a.p100 : 0 })).sort((a, b) => b.spend - a.spend);
}

export function computePautaSignals(pauta: PautaFull | null | undefined, opts?: { now?: Date }): Signal[] {
  const out: Signal[] = [];
  if (!pauta || pauta.ok === false) return out;
  const S = (s: Omit<Signal, "dash">) => out.push({ ...s, dash: "performance" });
  const cur = pauta.currency;
  const $ = (v: number) => fMoney(v, cur);
  const now = opts?.now ?? new Date();
  offlineSignals(pauta, S, now);
  // Con monedas distintas, las reglas que comparan montos corren solo sobre Meta (la moneda del tablero).
  // Solo DIGITAL: las filas offline no tienen impresiones/clicks/VTR.
  const camps = (pauta.byCampaign ?? []).filter((c) => !c.offline && c.spend > 0 && (!pauta.mixedCurrency || medioDe(c) === "Meta"));
  const total = sum(camps.map((c) => c.spend));
  if (!camps.length || total <= 0) return sortSignals(out);
  const share = (c: { spend: number }) => (c.spend / total) * 100;
  const sig = (c: CampaignRow) => share(c) >= 2; // campañas con peso suficiente para opinar
  const tag = (c: CampaignRow) => `${medioDe(c)} · ${rolDe(c.objective)}`;

  // ── 1. VIDEO — CPCV (costo por vista completa) como métrica madre ──
  const vid = camps.filter((c) => c.vbase > 0 && c.p100 > 0 && sig(c));
  if (vid.length >= 3) {
    const cpcvs = vid.map(cpcvOf);
    const med = median(cpcvs);
    const best = quantile(cpcvs, 0.25); // benchmark = cuartil más eficiente propio
    for (const c of vid) {
      const x = cpcvOf(c) / med;
      if (x >= 3) S({
        key: `pauta_cpcv_outlier_${c.id}`, tipo: "alerta", prioridad: x >= 8 ? "alta" : "media",
        titulo: `"${clip(c.name, 50)}": cada persona que ve el video completo sale ${x.toFixed(1)} veces más cara que en tus otras campañas (costo por video visto completo o CPCV: ${$(cpcvOf(c))})`,
        descripcion: `${tag(c)}. Se invirtieron ${$(c.spend)} (${fPct(share(c), 0)} del total) y ${fInt(c.p100)} personas vieron el video hasta el final; lo terminó el ${fPct(c.vtr100, 1)} de los que lo empezaron (VTR). En tus campañas de video, un video completo cuesta normalmente ${$(med)} (valor del medio o mediana); en las más eficientes, ${$(best)}.`,
        acciones: ["Pedile a la agencia que revise el formato (si se puede saltear, cuánto dura) y los primeros 3 segundos del video: ahí se decide si la gente sigue mirando", "Bajale presupuesto y pasá esa plata a las campañas de video donde ver el video completo sale más barato", "Si el video no se puede saltear y aun así casi nadie lo termina, pedile a la agencia que revise la medición y si hay visitas falsas (tráfico inválido)"],
        datos: { campaña: c.name, medio: medioDe(c), rol: rolDe(c.objective), cpcv: r2(cpcvOf(c)), medianaCpcv: r2(med), benchmarkP25: r2(best), inversion: Math.round(c.spend), vistasCompletas: c.p100 },
        impacto: { metrica: "Vistas completas adicionales al costo mediano", valor: Math.round(c.spend / med - c.p100), unidad: "vistas completas" },
      });
    }
    // Reasignación (port Drean): peor → mejor CPCV, mover 30%.
    const byEff = [...vid].sort((a, b) => cpcvOf(a) - cpcvOf(b));
    const b = byEff[0]!, w = byEff[byEff.length - 1]!;
    if (w !== b && cpcvOf(w) > cpcvOf(b) * 1.5) {
      const mover = w.spend * 0.3;
      const gain = mover / cpcvOf(b) - mover / cpcvOf(w);
      S({
        key: "pauta_realloc_video", tipo: "oportunidad", prioridad: "alta",
        titulo: `Pasá ${$(mover)} de "${clip(w.name, 40)}" a "${clip(b.name, 40)}": con la misma plata, ≈${fNum(gain)} personas más verían el video completo`,
        descripcion: `En "${clip(w.name, 40)}" cada video visto completo cuesta ${$(cpcvOf(w))}; en "${clip(b.name, 40)}", ${$(cpcvOf(b))}: ${(cpcvOf(w) / cpcvOf(b)).toFixed(1)} veces más caro (costo por video completo o CPCV). "${clip(w.name, 40)}" se lleva el ${fPct(share(w), 0)} de la inversión. Supuesto: la campaña barata sigue igual de barata al darle más plata (confirmá con la agencia que tiene público de sobra antes de subirla).`,
        acciones: [`Pedile a la agencia que achique "${clip(w.name, 40)}" un 30%`, `Que esa plata (${$(mover)}) vaya a "${clip(b.name, 40)}", y a las 2 semanas mirá que el costo por video completo no haya subido`],
        datos: { desde: { campaña: w.name, cpcv: r2(cpcvOf(w)), inversion: Math.round(w.spend) }, hacia: { campaña: b.name, cpcv: r2(cpcvOf(b)), inversion: Math.round(b.spend) }, mover: Math.round(mover) },
        impacto: { metrica: "Vistas completas adicionales", valor: Math.round(gain), unidad: "vistas completas" },
      });
    }
    // Escalables: CPCV en el cuartil más eficiente y < 12% del gasto.
    for (const c of vid) if (cpcvOf(c) <= best && share(c) < 12 && c !== b) S({
      key: `pauta_scalable_video_${c.id}`, tipo: "oportunidad", prioridad: "media",
      titulo: `"${clip(c.name, 50)}": video barato de ver completo (${$(cpcvOf(c))} por video completo — CPCV) que recibe solo el ${fPct(share(c), 0)} de la inversión`,
      descripcion: `Está entre el 25% más eficiente de tus campañas de video (lo termina el ${fPct(c.vtr100, 1)} de los que lo empiezan — VTR). Le podés dar más plata.`,
      acciones: ["Pedile a la agencia que le suba el presupuesto 30-50%, de a poco (por ejemplo, un escalón por semana)", "Al subirlo, mirá que la gente no lo vea demasiadas veces (frecuencia) y que el costo por video completo no suba"],
      datos: { campaña: c.name, cpcv: r2(cpcvOf(c)), share: r2(share(c)) },
      impacto: { metrica: "Vistas completas adicionales con +50% de inversión", valor: Math.round(c.p100 * 0.5), unidad: "vistas completas" },
    });
    // Hook débil: retención al 25% muy por debajo de las demás.
    const ret = vid.filter((c) => c.p25 > 0).map((c) => ({ c, r: c.p25 / c.vbase }));
    if (ret.length >= 3) {
      const mr = median(ret.map((x) => x.r));
      const weak = ret.filter((x) => x.r <= mr * 0.5).sort((a, b) => b.c.spend - a.c.spend)[0];
      if (weak) S({
        key: `pauta_hook_weak_${weak.c.id}`, tipo: "alerta", prioridad: "media",
        titulo: `"${clip(weak.c.name, 50)}": solo el ${fPct(weak.r * 100, 0)} de la gente mira el primer cuarto del video (en tus otros videos, ${fPct(mr * 100, 0)})`,
        descripcion: "La gente se va en los primeros segundos: el problema es cómo arranca el video (el gancho o hook), no que sea largo.",
        acciones: ["Pedile a la agencia que reedite los primeros 2-3 segundos: que se vea el producto o el beneficio de entrada", "Probar una versión más corta del mismo video"],
        datos: { campaña: weak.c.name, retencion25: r2(weak.r * 100), mediana: r2(mr * 100) },
      });
    }
  }

  // ── 2. Video desperdiciado (total) ──
  const t = pauta.totals;
  const vbase = t.vbase ?? 0;
  if (vbase > 0 && t.p50 >= 0) {
    const vtr50 = (t.p50 / vbase) * 100;
    if (vtr50 < 50) {
      const vidSpend = sum(camps.filter((c) => c.vbase > 0).map((c) => c.spend));
      S({
        key: "pauta_video_waste", tipo: "alerta", prioridad: vtr50 < 30 ? "alta" : "media",
        titulo: `El ${fPct(100 - vtr50, 0)} de las veces que se mostró un video, la gente no llegó a ver la mitad`,
        descripcion: `Solo el ${fPct(vtr50, 1)} de ${fNum(vbase)} reproducciones llegó a la mitad del video (VTR al 50%). Más o menos ${$(vidSpend * (1 - vtr50 / 100))} de lo invertido en video se fue en videos que no se vieron ni hasta la mitad.`,
        acciones: ["Pedile a la agencia que use más videos cortos o formatos que no se puedan saltear", "Pasá plata a las campañas donde más gente ve el video hasta la mitad (mejor VTR)", "Revisá los primeros segundos de los videos que peor retienen: ahí se pierde a la gente"],
        datos: { vtr50: r2(vtr50), impresionesVideo: vbase, inversionVideo: Math.round(vidSpend) },
        impacto: { metrica: "Inversión en video que no llega al 50%", valor: Math.round(vidSpend * (1 - vtr50 / 100)), unidad: cur ?? "$" },
      });
    }
  }

  // ── 3. CPM fuera de rango dentro de su medio × rol (Awareness) ──
  const aw = camps.filter((c) => rolDe(c.objective) === "Awareness" && c.impressions > 0 && sig(c));
  for (const [k, group] of groupBy(aw, (c) => medioDe(c))) {
    if (group.length < 3) continue;
    const med = median(group.map((c) => c.cpm));
    for (const c of group) {
      const d = deltaPct(c.cpm, med) ?? 0;
      if (d > 25) S({
        key: `pauta_cpm_outlier_${c.id}`, tipo: "alerta", prioridad: d > 50 ? "alta" : "media",
        titulo: `"${clip(c.name, 50)}": mostrar el aviso mil veces cuesta ${$(c.cpm)} (costo por mil o CPM), ${fDelta(d)} más que en tus otras campañas para que te conozcan en ${k}`,
        descripcion: `Se invirtieron ${$(c.spend)} para mostrar el aviso ${fNum(c.impressions)} veces (impresiones). En tus campañas para que te conozcan (Awareness) en ${k}, mil impresiones cuestan normalmente ${$(med)}.`,
        acciones: ["Pedile a la agencia que revise a quién le muestra el aviso: un público muy chico encarece cada impresión (segmentación)", "Que revise dónde aparece el aviso (ubicaciones) y si la pieza es buena: las piezas flojas se pagan más caro", "Pasá parte de la plata a las campañas donde mostrar el aviso sale más barato"],
        datos: { campaña: c.name, medio: k, cpm: r2(c.cpm), medianaCpm: r2(med), inversion: Math.round(c.spend) },
        impacto: { metrica: "Impresiones adicionales al CPM mediano", valor: Math.round((c.spend / med) * 1000 - c.impressions), unidad: "impresiones" },
      });
    }
  }

  // ── 4. Clicks: reasignación entre campañas de Consideración (CPC) ──
  const cons = camps.filter((c) => rolDe(c.objective) === "Consideración" && c.clicks >= 100 && share(c) >= 3);
  if (cons.length >= 2) {
    const byCpc = [...cons].sort((a, b) => a.cpc - b.cpc);
    const b = byCpc[0]!, w = byCpc[byCpc.length - 1]!;
    if (w.cpc > b.cpc * 1.5) {
      const mover = w.spend * 0.3;
      const gain = mover / b.cpc - mover / w.cpc;
      S({
        key: "pauta_realloc_clicks", tipo: "oportunidad", prioridad: "alta",
        titulo: `Pasá ${$(mover)} de "${clip(w.name, 40)}" a "${clip(b.name, 40)}": con la misma plata, ≈${fNum(gain)} clics más`,
        descripcion: `Cada clic cuesta ${$(w.cpc)} en "${clip(w.name, 40)}" (${medioDe(w)}) y ${$(b.cpc)} en "${clip(b.name, 40)}" (${medioDe(b)}): ${(w.cpc / b.cpc).toFixed(1)} veces más caro (costo por clic o CPC). Supuesto: la campaña barata sigue igual de barata al darle más plata. Antes de mover, mirá en Web que esas visitas baratas también compren o consulten (tasa de conversión).`,
        acciones: [`Pedile a la agencia que baje "${clip(w.name, 40)}" un 30%`, `Que suba "${clip(b.name, 40)}" con esa plata, y a las 2 semanas revisá que el costo por clic no haya subido y que en Web esas visitas sigan comprando o consultando`],
        datos: { desde: { campaña: w.name, cpc: r2(w.cpc), ctr: r2(w.ctr) }, hacia: { campaña: b.name, cpc: r2(b.cpc), ctr: r2(b.ctr) }, mover: Math.round(mover) },
        impacto: { metrica: "Clicks adicionales", valor: Math.round(gain), unidad: "clicks" },
      });
    }
    const p25 = quantile(cons.map((c) => c.cpc), 0.25);
    for (const c of cons) if (c.cpc <= p25 && share(c) < 12 && c !== b) S({
      key: `pauta_scalable_clicks_${c.id}`, tipo: "oportunidad", prioridad: "media",
      titulo: `"${clip(c.name, 50)}": clics baratos (${$(c.cpc)} cada uno — costo por clic o CPC) y recibe solo el ${fPct(share(c), 0)} de la inversión`,
      descripcion: `Está entre el 25% de tus campañas de visitas con el clic más barato. Hace clic el ${fPct(c.ctr, 2)} de los que ven el aviso (CTR). Le podés dar más plata.`,
      acciones: ["Pedile a la agencia que le suba el presupuesto 30-50%, de a poco", "Si el costo por clic sube más de 20%, frená la suba"],
      datos: { campaña: c.name, cpc: r2(c.cpc), share: r2(share(c)) },
      impacto: { metrica: "Clicks adicionales con +50% de inversión", valor: Math.round(c.clicks * 0.5), unidad: "clicks" },
    });
  }

  // ── 5. CTR bajo (tráfico): Search < 2%; resto de Consideración < 0,6% (🔴 < 0,3%) ──
  for (const c of camps) {
    if (c.impressions < 10_000 || rolDe(c.objective) !== "Consideración") continue;
    const lim = isSearch(c) ? 2 : 0.6;
    if (c.ctr < lim) S({
      key: `pauta_ctr_low_${c.id}`, tipo: "alerta", prioridad: (!isSearch(c) && c.ctr < 0.3) || (isSearch(c) && c.ctr < 1) ? "alta" : "media",
      titulo: `"${clip(c.name, 50)}": solo el ${fPct(c.ctr, 2)} de los que ven el aviso hace clic (CTR), en una campaña que busca visitas o tráfico (lo esperable es ${fPct(lim, 1)} o más)`,
      descripcion: `El aviso se mostró ${fNum(c.impressions)} veces y tuvo ${fInt(c.clicks)} clics. ${isSearch(c) ? "En Google (búsqueda), esto suele querer decir que el aviso aparece en búsquedas que no tienen que ver, o que el texto no responde lo que la gente busca." : "La pieza o el público no están conectando: la gente lo ve pero no le interesa."}`,
      acciones: isSearch(c) ? ["Pedile a la agencia que revise qué búsquedas reales activan el aviso y excluya las que no sirven (palabras negativas)", "Que el título del aviso repita lo que la persona buscó (anuncios más relevantes)"] : ["Pedile a la agencia que pruebe 2 versiones de pieza y texto a la vez y se quede con la de más clics (prueba A/B)", "Achicar el público a gente más interesada (segmentación)", "Probar otro formato: carrusel o video corto"],
      datos: { campaña: c.name, medio: medioDe(c), ctr: r2(c.ctr), referencia: lim, impresiones: c.impressions },
    });
  }

  // ── 6. Frecuencia (saturación): Awareness/Consideración > 4 (🔴 > 6); Conversión > 8 ──
  for (const c of camps) {
    if (!(c.reach > 0) || !(c.frequency > 0) || !sig(c)) continue;
    const rol = rolDe(c.objective);
    const [lim, alto] = rol === "Conversión" ? [8, 12] : [4, 6];
    if (c.frequency > lim) S({
      key: `pauta_frequency_high_${c.id}`, tipo: "alerta", prioridad: c.frequency > alto ? "alta" : "media",
      titulo: `"${clip(c.name, 50)}": cada persona vio el aviso ${c.frequency.toFixed(1)} veces en promedio (frecuencia) — la gente se puede cansar`,
      descripcion: `Campaña de ${rol}: ${fNum(c.reach)} personas distintas vieron el aviso (alcance), ${c.frequency.toFixed(1)} veces cada una. Pasado cierto punto, repetir más no suma y hasta molesta.`,
      acciones: ["Pedile a la agencia que le muestre el aviso a más gente distinta (ampliar el público) o que excluya a quienes ya lo vieron mucho", "Sumar versiones nuevas de la pieza con otro arranque, para que no sea siempre la misma", "Pedile que ponga un máximo de veces por persona (tope de frecuencia)"],
      datos: { campaña: c.name, frecuencia: r2(c.frequency), alcance: c.reach, rol },
      impacto: { metrica: `Impresiones por encima de frecuencia ${lim}`, valor: Math.round(c.impressions - c.reach * lim), unidad: "impresiones" },
    });
  }

  // ── 7. Gasto sin resultados (mal configurada) ──
  for (const c of camps) {
    if (share(c) < 1) continue;
    if (c.clicks === 0 && c.p100 === 0 && (c.reach === 0 || c.impressions < 1000)) S({
      key: `pauta_spend_no_results_${c.id}`, tipo: "alerta", prioridad: "alta",
      titulo: `"${clip(c.name, 50)}" gastó ${$(c.spend)} y no tuvo ni un clic ni un video visto completo`,
      descripcion: `Se mostró ${fNum(c.impressions)} veces, con 0 clics y 0 videos completos. Casi seguro está mal configurada (la medición, dónde aparece el aviso o cómo se paga — puja).`,
      acciones: ["Pedile a la agencia que revise la configuración de la campaña y la medición (píxel o etiquetas)", "Pausala hasta que esté corregida"],
      datos: { campaña: c.name, inversion: Math.round(c.spend), impresiones: c.impressions },
      impacto: { metrica: "Inversión sin resultado medible", valor: Math.round(c.spend), unidad: cur ?? "$" },
    });
  }

  // ── 8. Meta vs Google (misma moneda): eficiencia por medio ──
  if (!pauta.mixedCurrency) {
    const byMedio = aggBy(camps, medioDe);
    const meta = byMedio.find((m) => m.medio === "Meta"), goog = byMedio.find((m) => m.medio === "Google");
    if (meta && goog && meta.clicks >= 100 && goog.clicks >= 100) {
      const [hi, lo] = meta.cpc > goog.cpc ? [meta, goog] : [goog, meta];
      if (hi.cpc >= lo.cpc * 1.5) {
        const mover = hi.spend * 0.2;
        S({
          key: "pauta_medio_cpc_gap", tipo: "oportunidad", prioridad: "media",
          titulo: `En ${lo.medio} cada clic sale ${(hi.cpc / lo.cpc).toFixed(1)} veces más barato que en ${hi.medio} (${$(lo.cpc)} contra ${$(hi.cpc)} — costo por clic o CPC)`,
          descripcion: `${hi.medio}: ${$(hi.spend)} invertidos y ${fNum(hi.clicks)} clics (hace clic el ${fPct(hi.ctr, 2)} de los que ven el aviso — CTR). ${lo.medio}: ${$(lo.spend)} y ${fNum(lo.clicks)} clics (${fPct(lo.ctr, 2)}). Ojo: no cumplen el mismo rol (en Google la gente ya está buscando; en Meta se genera el interés) — antes de mover, mirá también cuántas de esas visitas compran o consultan en la web.`,
          acciones: [`Si lo que buscás son visitas a la web, pasá ~20% (${$(mover)}) de ${hi.medio} a ${lo.medio}`, "Antes de decidir, mirá en el tablero Web qué canal convierte mejor (tasa de conversión por canal)"],
          datos: { medios: byMedio.map((m) => ({ medio: m.medio, inversion: Math.round(m.spend), cpm: r2(m.cpm), cpc: r2(m.cpc), ctr: r2(m.ctr), cpcv: r2(m.cpcv) })) },
          impacto: { metrica: "Clicks adicionales (20% reasignado)", valor: Math.round(mover / lo.cpc - mover / hi.cpc), unidad: "clicks" },
        });
      }
    }
  }

  // ── 9. Concentración del presupuesto ──
  if (camps.length >= 3) {
    const sorted = [...camps].sort((a, b) => b.spend - a.spend);
    const top = sorted[0]!;
    if (share(top) > 50) S({
      key: "pauta_budget_concentration", tipo: "alerta", prioridad: "media",
      titulo: `"${clip(top.name, 50)}" se lleva el ${fPct(share(top), 0)} de toda la inversión digital`,
      descripcion: `Todo depende de una sola campaña: si la gente se cansa de verla o se encarece, arrastra todo el plan. Las otras ${camps.length - 1} campañas suman ${fPct(100 - share(top), 0)}.`,
      acciones: ["Pedile a la agencia 1 o 2 campañas de prueba con otros formatos o públicos", "Revisá cada semana, en la campaña principal, cuántas veces ve el aviso cada persona (frecuencia) y cuánto cuesta mostrarlo mil veces (CPM)"],
      datos: { campaña: top.name, share: r2(share(top)), campañas: camps.length },
    });
  }

  // ── 10. Mensual: costo (CPM) y ritmo del mes en curso — sobre la inversión DIGITAL ──
  // Drean: el CPM usa solo la inversión de medios con impresiones informadas (invConImpr).
  const mo = [...(pauta.monthly ?? [])].sort((a, b) => a.mesIdx - b.mesIdx).map((m) => ({ ...m, inv: m.invConImpr ?? invDig(m) }));
  const closed = mo.filter((m) => m.mesIdx < now.getMonth() && m.impr > 0);
  if (closed.length >= 4) {
    const last = closed[closed.length - 1]!, base = closed.slice(-4, -1);
    const cpm = (m: typeof last) => (m.impr ? (m.inv / m.impr) * 1000 : 0);
    const d = deltaPct(cpm(last), avg(base.map(cpm))) ?? 0;
    // Rango esperado del CPM con toda la historia cerrada (lib/stats): dentro de lo normal no alerta.
    // Con menos de 6 meses no hay banda → decide el umbral fijo de siempre.
    const ev = rangoEsperado(closed.slice(0, -1).map(cpm), cpm(last));
    const rango = datosRango(ev);
    const txtRango = rango ? ` Fuera del rango esperado (${$(rango.min)}–${$(rango.max)}).` : "";
    if (dentroDeLoNormal(ev)) { /* variación dentro del rango normal de la serie → sin señal */ }
    else if (d >= 25) S({
      key: "pauta_cpm_inflation", tipo: "alerta", prioridad: d >= 50 ? "alta" : "media",
      titulo: `${last.mes}: mostrar el aviso mil veces salió ${fDelta(d)} más caro que en los 3 meses anteriores (${$(cpm(last))} — costo por mil o CPM)`,
      descripcion: `Antes costaba ${$(avg(base.map(cpm)))} en promedio.${txtRango} Con la misma plata, el aviso se mostró menos veces.`,
      acciones: ["Fijate si ese mes cambió la mezcla de medios u objetivos (algunos medios son más caros por naturaleza)", "Pedile a la agencia que amplíe los públicos o renueve las piezas: cuando la gente se cansa de un aviso, mostrarlo sale más caro", "Tené en cuenta la época del año: en fechas con mucha competencia (Hot Sale, Día de la Madre, fin de año) los avisos se encarecen"],
      datos: { mes: last.mes, cpm: r2(cpm(last)), promedio3m: r2(avg(base.map(cpm))), deltaPct: r2(d), ...(rango ? { rangoEsperado: rango } : {}) },
      impacto: { metrica: "Impresiones perdidas vs CPM previo", valor: Math.round((last.inv / avg(base.map(cpm))) * 1000 - last.impr), unidad: "impresiones" },
    });
    else if (d <= -20) S({
      key: "pauta_cpm_improved", tipo: "info", prioridad: "baja",
      titulo: `${last.mes}: mostrar el aviso mil veces salió ${fDelta(d)} más barato que en los 3 meses anteriores (costo por mil o CPM)`,
      descripcion: `${$(cpm(last))} contra ${$(avg(base.map(cpm)))} de antes.${txtRango} Es buen momento para llegar a más gente con la misma plata.`,
      acciones: ["Evaluá con la agencia adelantar inversión mientras está barato"],
      datos: { mes: last.mes, cpm: r2(cpm(last)), deltaPct: r2(d), ...(rango ? { rangoEsperado: rango } : {}) },
    });
  }
  const curM = mo.find((m) => m.mesIdx === now.getMonth());
  const lastClosed = mo.filter((m) => m.mesIdx < now.getMonth() && m.inv > 0).slice(-3);
  if (curM && lastClosed.length >= 2 && now.getDate() >= 7) {
    const daysIn = (i: number) => new Date(now.getFullYear(), i + 1, 0).getDate();
    const ratePrev = avg(lastClosed.map((m) => m.inv / daysIn(m.mesIdx)));
    const rateCur = curM.inv / now.getDate();
    const x = ratePrev ? rateCur / ratePrev : 0;
    const proy = rateCur * daysIn(now.getMonth());
    if (x >= 1.3 || (x > 0 && x <= 0.7)) S({
      key: x >= 1.3 ? "pauta_pacing_fast" : "pauta_pacing_slow", tipo: x >= 1.3 ? "alerta" : "info", prioridad: "media",
      titulo: `Este mes se está gastando ${$(rateCur)} por día: ${x.toFixed(1)} veces lo de los últimos meses`,
      descripcion: `A este ritmo el mes cierra en ≈${$(proy)} (antes se gastaban ${$(ratePrev)} por día). ${x >= 1.3 ? "Si no hay una campaña especial planificada, hay que revisar cuánto gasta cada campaña por día." : "Puede que se esté gastando menos de lo planeado: confirmá si es a propósito."}`,
      acciones: x >= 1.3 ? ["Pedile a la agencia el presupuesto diario de cada campaña y qué campañas nuevas arrancaron", "Confirmá que el aumento estaba en el plan"] : ["Preguntale a la agencia si hay campañas pausadas o avisos rechazados por Meta o Google"],
      datos: { gastoDiario: r2(rateCur), gastoDiarioPrevio: r2(ratePrev), proyeccionMes: Math.round(proy) },
    });
  }

  // ── 11. Piezas (top creativos de Meta) ──
  const cr = (pauta.topCreatives ?? []).filter((c) => c.impressions >= 5000 && c.spend > 0);
  if (cr.length >= 4) {
    const crTot = sum(cr.map((c) => c.spend));
    const medCtr = median(cr.map((c) => c.ctr));
    const star = [...cr].sort((a, b) => b.ctr - a.ctr)[0]!;
    if (medCtr > 0 && star.ctr >= medCtr * 2 && star.spend / crTot < 0.15) S({
      key: `pauta_creative_star_${star.id}`, metrica: "inversion", tipo: "oportunidad", prioridad: "media",
      titulo: `Una pieza a la que la gente le hace clic ${(star.ctr / medCtr).toFixed(1)} veces más que a las demás (${fPct(star.ctr, 2)} — CTR) recibe poca plata`,
      descripcion: `"${clip(star.name, 60)}": ${$(star.spend)} (solo el ${fPct((star.spend / crTot) * 100, 0)} de lo invertido en las piezas principales).`,
      acciones: ["Pedile a la agencia que le dé más presupuesto o que la use también en otras campañas", "Producir versiones nuevas con la misma idea"],
      datos: creativeData(star, medCtr),
    });
    const fat = cr.filter((c) => c.frequency > 5 && c.spend / crTot >= 0.05).sort((a, b) => b.frequency - a.frequency)[0];
    if (fat) S({
      key: `pauta_creative_fatigue_${fat.id}`, tipo: "alerta", prioridad: "media",
      titulo: `Una pieza que cada persona ya vio ${fat.frequency.toFixed(1)} veces (frecuencia): la gente se puede cansar de verla (fatiga creativa)`,
      descripcion: `"${clip(fat.name, 60)}": ${$(fat.spend)} invertidos; hace clic el ${fPct(fat.ctr, 2)} de los que la ven (CTR).`,
      acciones: ["Pedile a la agencia versiones nuevas para rotar la pieza", "Que le muestre el aviso a un público más amplio"],
      datos: creativeData(fat, medCtr),
    });
    const cara = cr.filter((c) => c.spend / crTot >= 0.08 && c.ctr <= medCtr * 0.5).sort((a, b) => b.spend - a.spend)[0];
    if (cara) S({
      key: `pauta_creative_costly_${cara.id}`, metrica: "inversion", tipo: "alerta", prioridad: "media",
      titulo: `Una pieza se lleva el ${fPct((cara.spend / crTot) * 100, 0)} de la plata y la gente le hace la mitad de clics que a las demás (${fPct(cara.ctr, 2)} — CTR)`,
      descripcion: `"${clip(cara.name, 60)}": ${$(cara.spend)} para mostrarse ${fNum(cara.impressions)} veces.${cara.vtr100 > 0 ? ` Ve el video completo el ${fPct(cara.vtr100, 1)} (VTR).` : ""} Si la pieza es para que te conozcan (alcance), puede estar bien; si es para llevar gente a la web, no.`,
      acciones: ["Confirmá con la agencia para qué es esa pieza (que te conozcan o traer visitas)", "Si es para traer visitas: pausala o reemplazala por la pieza con más clics"],
      datos: creativeData(cara, medCtr),
    });
  }

  return sortSignals(out);
}

// ── Medios OFFLINE (planilla) ────────────────────────────────────────────────
function offlineSignals(pauta: PautaFull, S: (s: Omit<Signal, "dash">) => void, now: Date) {
  const off = pauta.offline;
  if (!off || !off.byMedio.length || off.totals.spend <= 0) return;
  const oc = off.currency ?? pauta.currency;
  const $ = (v: number) => fMoney(v, oc);
  const sameCur = !pauta.mixedCurrency || (off.currency ?? pauta.currency) === pauta.currency;
  const offTotal = off.totals.spend;
  const rows = (pauta.byCampaign ?? []).filter((c) => c.offline && c.spend > 0);
  const digCamps = (pauta.byCampaign ?? []).filter((c) => !c.offline && c.spend > 0);
  const hasDigital = digCamps.length > 0 || (pauta.monthly ?? []).some((m) => invDig(m) > 0);

  // 1. CPM de contactos por soporte vs la mediana de su medio.
  for (const [medio, group] of groupBy(rows.filter((c) => (c.contactos ?? 0) > 0 && (c.cpmContactos ?? 0) > 0), (c) => c.medio ?? "Otro")) {
    if (group.length < 3) continue;
    const med = median(group.map((c) => c.cpmContactos ?? 0));
    for (const c of group) {
      const x = med > 0 ? (c.cpmContactos ?? 0) / med : 0;
      if (x >= 1.5 && c.spend / offTotal >= 0.02) S({
        key: `pauta_off_cpm_${c.id}`, tipo: "alerta", prioridad: x >= 2.5 ? "alta" : "media",
        titulo: `${medio} · "${clip(c.name, 50)}": llegar a mil personas cuesta ${x.toFixed(1)} veces más que en el resto de ${medio} (${$(c.cpmContactos ?? 0)} — costo por mil contactos o CPM)`,
        descripcion: `Se invirtieron ${$(c.spend)} para ${fNum(c.contactos ?? 0)} contactos (personas expuestas al aviso). En ${medio}, mil contactos cuestan normalmente ${$(med)}. Si este espacio no llega a un público distinto (otro perfil, otra zona), está caro.`,
        acciones: ["Pedile a la agencia de medios que renegocie la tarifa o pida bonificación", "Llevá parte de la plata a los espacios más baratos del mismo medio", "Pedile a la agencia que confirme que los contactos informados son de tu público objetivo y no el total de la audiencia"],
        datos: { medio, soporte: c.name, cpmContactos: r2(c.cpmContactos ?? 0), medianaMedio: r2(med), inversion: Math.round(c.spend), contactos: c.contactos ?? 0 },
        impacto: { metrica: "Contactos adicionales al CPM mediano", valor: Math.round((c.spend / med) * 1000 - (c.contactos ?? 0)), unidad: "contactos" },
      });
    }
  }

  // 1b. CPM por medio vs la mediana de tus medios (offline por contactos, digital por impresiones).
  const medioCpm = off.byMedio.filter((m) => (m.cpmContactos ?? 0) > 0 && m.spend / offTotal >= 0.05).map((m) => ({ medio: m.medio, cpm: m.cpmContactos!, spend: m.spend, offline: true }));
  if (sameCur) for (const m of aggBy(digCamps, medioDe)) if (m.impressions > 0) medioCpm.push({ medio: m.medio, cpm: m.cpm, spend: m.spend, offline: false });
  if (medioCpm.length >= 3) {
    const med = median(medioCpm.map((m) => m.cpm));
    const caro = medioCpm.filter((m) => m.offline && m.cpm >= med * 2).sort((a, b) => b.spend - a.spend)[0];
    if (caro) S({
      key: `pauta_off_medio_cpm_${caro.medio}`, metrica: "contactos", tipo: "alerta", prioridad: "media",
      titulo: `${caro.medio}: llegar a mil personas cuesta ${$(caro.cpm)}, ${(caro.cpm / med).toFixed(1)} veces más que en tus otros medios (costo por mil o CPM)`,
      descripcion: `En tus medios, mil contactos o impresiones cuestan normalmente ${$(med)}. Ojo: ver un cartel o un aviso de TV no es lo mismo que ver un aviso en el celular (cuánto se ve, cuánta atención, a quién llega); la comparación da una idea del orden de magnitud, no reemplaza el rol de cada medio.`,
      acciones: ["Preguntale a la agencia qué aporta ese medio que los demás no (gente nueva, tu público, zonas del país)", "Negociar la tarifa o probar una mezcla con más peso en los medios que llegan a la gente más barato"],
      datos: { medios: medioCpm.map((m) => ({ medio: m.medio, cpm: r2(m.cpm), inversion: Math.round(m.spend), tipo: m.offline ? "offline" : "online" })), mediana: r2(med) },
    });
  }

  // 2. Concentración en un medio (online + offline, misma moneda).
  const shares = [...off.byMedio.map((m) => ({ medio: m.medio, spend: m.spend }))];
  if (sameCur) for (const m of aggBy(digCamps, medioDe)) shares.push({ medio: m.medio, spend: m.spend });
  const tot = sum(shares.map((m) => m.spend));
  if (shares.length >= 2 && tot > 0) {
    const top = [...shares].sort((a, b) => b.spend - a.spend)[0]!;
    const sh = (top.spend / tot) * 100;
    if (sh > 60) S({
      key: "pauta_off_medio_concentration", tipo: "alerta", prioridad: sh > 80 ? "alta" : "media",
      titulo: `${top.medio} se lleva el ${fPct(sh, 0)} de la inversión en medios`,
      descripcion: `${$(top.spend)} de ${$(tot)} (${shares.length} medios con inversión). Depender de un medio te deja atado a su precio y a su techo: pasado cierto punto, poner más plata en el mismo medio le repite el aviso a las mismas personas en vez de llegar a gente nueva.`,
      acciones: ["Evaluá con la agencia sumar otro medio que llegue a gente nueva (alcance incremental)", "Antes de darle más plata al medio principal, pedile a la agencia cuánta gente nueva sumaría (curva de alcance)"],
      datos: { medios: shares.map((m) => ({ medio: m.medio, inversion: Math.round(m.spend), share: r2((m.spend / tot) * 100) })) },
    });
  }

  // 3. Costo por GRP (CPP) fuera de rango dentro del mismo medio (TV / radio).
  for (const [medio, group] of groupBy(rows.filter((c) => (c.grps ?? 0) > 0 && (c.cpp ?? 0) > 0), (c) => c.medio ?? "Otro")) {
    if (group.length < 3) continue;
    const med = median(group.map((c) => c.cpp ?? 0));
    const worst = group.filter((c) => (c.cpp ?? 0) >= med * 1.5).sort((a, b) => b.spend - a.spend)[0];
    if (worst) S({
      key: `pauta_off_cpp_${worst.id}`, tipo: "alerta", prioridad: (worst.cpp ?? 0) >= med * 2.5 ? "alta" : "media",
      titulo: `${medio} · "${clip(worst.name, 50)}": cada punto de rating cuesta ${$(worst.cpp ?? 0)}, ${((worst.cpp ?? 0) / med).toFixed(1)} veces más que en el resto de ${medio} (costo por GRP o CPP)`,
      descripcion: `Se compraron ${fNum(worst.grps ?? 0)} puntos de rating (GRPs: cuánto del público vio el aviso, sumando repeticiones) por ${$(worst.spend)}. En ${medio}, cada punto cuesta normalmente ${$(med)}. Pagar más solo vale la pena si ese espacio llega a gente que los otros no (horario, programa, zona).`,
      acciones: ["Pedile a la agencia que revise horarios y programas: el horario central (prime time) encarece cada punto", "Pedile cuánta gente nueva suma ese espacio (curva de alcance): si solo le repite el aviso a los mismos, bajalo", "Negociar bonificación o paquetes"],
      datos: { medio, soporte: worst.name, cpp: r2(worst.cpp ?? 0), medianaCpp: r2(med), grps: r2(worst.grps ?? 0), inversion: Math.round(worst.spend) },
      impacto: { metrica: "GRPs adicionales al CPP mediano", valor: Math.round(worst.spend / med - (worst.grps ?? 0)), unidad: "GRPs" },
    });
  }

  // 4. Meses con inversión offline y sin actividad digital (falta de soporte digital).
  if (hasDigital) {
    const digByMonth = new Map((pauta.monthly ?? []).map((m) => [m.mesIdx, invDig(m)]));
    const huecos = off.meses.map((k) => Number(k.slice(5, 7)) - 1).filter((i) => i <= now.getMonth() && (digByMonth.get(i) ?? 0) <= 0);
    if (huecos.length) {
      const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      S({
        key: "pauta_off_sin_digital", tipo: "alerta", prioridad: "media",
        titulo: `${huecos.length === 1 ? "Un mes" : `${huecos.length} meses`} con TV, radio o vía pública pero sin avisos digitales (${huecos.map((i) => MES[i]).join(", ")})`,
        descripcion: "La TV, la radio o la vía pública despiertan interés que la gente después busca en Google, en la web o en redes. Si ese mes no hay avisos digitales, ese interés no se aprovecha: nadie aparece cuando la persona busca ni le vuelve a mostrar la marca.",
        acciones: ["Cada vez que salga TV, radio o vía pública, pedile a la agencia avisos en Google para cuando busquen la marca y avisos para quienes ya visitaron la web (remarketing)", "Mirá en Web si esos meses subieron las búsquedas de la marca y las visitas directas: eso muestra el efecto"],
        datos: { meses: huecos.map((i) => MES[i]) },
      });
    }
  }

  // 5. Share offline del último mes cerrado vs el promedio propio.
  if (sameCur && !pauta.mixedCurrency) {
    const closed = (pauta.monthly ?? []).filter((m) => m.mesIdx < now.getMonth() && m.inv > 0).sort((a, b) => a.mesIdx - b.mesIdx);
    if (closed.length >= 4) {
      const shareOf = (m: PautaMonth) => ((m.invOff ?? 0) / m.inv) * 100;
      const last = closed[closed.length - 1]!;
      const base = avg(closed.slice(0, -1).map(shareOf));
      const d = shareOf(last) - base;
      if (Math.abs(d) >= 15) S({
        key: "pauta_off_share_shift", tipo: "info", prioridad: "baja",
        titulo: `${last.mes}: TV, radio y vía pública (offline) fueron el ${fPct(shareOf(last), 0)} de la inversión (antes, ${fPct(base, 0)} en promedio)`,
        descripcion: `La mezcla de medios se movió ${Math.abs(d).toFixed(0)} puntos ${d > 0 ? "hacia" : "fuera de"} los medios offline. Si no fue planificado, revisá si respondió a un objetivo (un lanzamiento, una temporada) y cómo se movieron ese mes la gente alcanzada y las búsquedas.`,
        acciones: ["Confirmá con la agencia que el cambio estaba en el plan", "Compará ese mes contra los anteriores: gente alcanzada, búsquedas de la marca y visitas a la web"],
        datos: { mes: last.mes, shareOffline: r2(shareOf(last)), promedioPrevio: r2(base) },
      });
    }
  }
}

function creativeData(c: CreativeRow, medCtr: number) {
  return { pieza: c.name, id: c.id, permalink: c.permalink, inversion: Math.round(c.spend), impresiones: c.impressions, ctr: r2(c.ctr), medianaCtr: r2(medCtr), frecuencia: r2(c.frequency), vtr100: r2(c.vtr100) };
}
function groupBy<T>(xs: T[], k: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) { const key = k(x); m.set(key, [...(m.get(key) ?? []), x]); }
  return m;
}

// ============================================================================
// PACING y FATIGA (portado de BIP #130, adaptado a Drean). Entradas ya calculadas por las funciones
// puras lib/pauta-pacing (computePacing) y lib/pauta-fatiga (fatigaPiezas) — las mismas que muestra
// el Tablero (Impacto Campaña → Ritmo de inversión; Eficiencia Medios → Fatiga creativa).
// ============================================================================

/** Pacing vs la meta de Inversión del mes: alerta si la proyección a cierre sale de ±10% del plan
 *  (con rango: "sub" = hasta el techo queda debajo; "sobre" = hasta el piso queda arriba). */
export function pacingSignals(p: PacingMes | null | undefined): Signal[] {
  if (!p || p.preliminar || p.base !== "plan" || p.plan == null || (p.estado !== "sobre" && p.estado !== "sub")) return [];
  const $ = (v: number) => fMoney(v, "ARS");
  const sobre = p.estado === "sobre";
  const dias = Math.round(p.diasTranscurridos);
  const diasRest = Math.max(1, p.diasMes - p.diasTranscurridos);
  const restante = Math.max(0, p.plan - p.gastado - (p.rango.central - p.rango.piso));
  const dCentral = p.desvioPct ?? 0;
  const pend = p.pendientes.length ? ` Faltan cargar de OMD: ${p.pendientes.join(", ")} (estimados por su promedio de 3 meses en el valor central y por su máximo en el techo).` : "";
  return [{
    key: sobre ? "pauta_pacing_plan_over" : "pauta_pacing_plan_under", metrica: "inversion",
    dash: "performance",
    tipo: "alerta",
    prioridad: Math.abs(dCentral) >= 25 ? "alta" : "media",
    titulo: sobre
      ? `${p.mes}: a este ritmo de gasto (pacing), el mes cierra entre ${$(p.rango.piso)} y ${$(p.rango.techo)}: más de lo planeado (${$(p.plan)})`
      : `${p.mes}: a este ritmo de gasto (pacing), el mes cierra entre ${$(p.rango.piso)} y ${$(p.rango.techo)}: menos de lo planeado (${$(p.plan)})`,
    descripcion: `Día ${dias} de ${p.diasMes}: van ${$(p.gastado)} gastados (${fPct(p.avancePct ?? 0, 0)} del plan; a esta altura tendrían que ir ${$(p.planALaFecha ?? 0)}). Lo más probable es cerrar en ${$(p.rango.central)} (${fDelta(dCentral)} contra el plan). Los medios que se leen solos (Meta, Google, DV360) se proyectan al ritmo actual; lo que carga la agencia (OMD) se toma como está.${pend}${p.bgt ? ` Presupuesto vigente de la cuenta de pauta (${p.bgt.version}): ${$(p.bgt.valor)}.` : ""}`,
    acciones: sobre
      ? ["Pedile a la agencia que baje el gasto diario de las campañas que más gastan", "Confirmá si el gasto extra es por algo planificado (un lanzamiento, una fecha especial)", "Si el plan cambió, actualizá la meta de Inversión"]
      : ["Pedile a OMD cuánto se lleva gastado este mes en los medios que no se leen solos (TikTok, Mercado Ads, Geo, TV/Streaming)", `Preguntale a la agencia si hay campañas pausadas o que se quedaron sin presupuesto (para llegar al plan harían falta ≈${$(restante / diasRest)} por día en lo que queda del mes)`, "Si gastar menos es a propósito, actualizá la meta de Inversión"],
    datos: { mes: p.mes, dia: r2(p.diasTranscurridos), diasMes: p.diasMes, gastado: Math.round(p.gastado), plan: Math.round(p.plan), planALaFecha: Math.round(p.planALaFecha ?? 0), piso: Math.round(p.rango.piso), central: Math.round(p.rango.central), techo: Math.round(p.rango.techo), desvioPct: r2(dCentral), pendientesOmd: p.pendientes },
    impacto: { metrica: sobre ? "Sobregasto proyectado a cierre (piso)" : "Inversión sin ejecutar proyectada a cierre (techo)", valor: Math.round(Math.abs(sobre ? p.rango.piso - p.plan : p.plan - p.rango.techo)), unidad: "ARS" },
  }];
}

/** Fatiga creativa: piezas cuya tasa (CTR o VTR ≥50%) cae ≥25% con la frecuencia subiendo. Hasta 5. */
export function fatigaSignals(f: FatigaResumen | null | undefined): Signal[] {
  if (!f) return [];
  const out: Signal[] = [];
  for (const x of f.piezas.filter((p) => p.estado === "fatiga").slice(0, 5)) {
    const ult = x.meses[x.meses.length - 1]!;
    out.push({
      key: `pauta_creative_fatigue_${x.key.replace(/[^a-z0-9]+/gi, "_").slice(0, 60)}`,
      dash: "performance", tipo: "alerta", prioridad: (x.caidaPct ?? 0) <= -50 && !x.parcial ? "alta" : "media",
      titulo: `La gente se está cansando de "${clip(x.nombre, 50)}" (${x.fuente === "DV360" ? `DV360 ${x.canal}` : "Meta"}): su respuesta (${x.metrica}) cayó ${fDelta(x.caidaPct ?? 0)} mientras cada persona la ve más veces (fatiga creativa)`,
      descripcion: `${x.motivo} Se mostró ${fInt(ult.impr)} veces en el último mes.${x.frecFuente === "línea" ? " DV360 no dice a cuánta gente distinta llegó cada pieza: las veces por persona (frecuencia) son las de su línea (canal × categoría)." : ""}${x.parcial ? " El último mes todavía está en curso (las veces por persona siguen sumando)." : ""}`,
      acciones: ["Pedile a la agencia que cambie la pieza o sume versiones nuevas del mismo mensaje", "Que baje el máximo de veces por persona (tope de frecuencia) o le muestre el aviso a más gente", "Pasá plata a las piezas que siguen funcionando igual"],
      datos: { pieza: x.nombre, fuente: x.fuente, canal: x.canal, categoria: x.categoria, metrica: x.metrica, tasaUltimo: r2(x.tasaUlt), tasaPrevios: r2(x.tasaPrev), caidaPct: r2(x.caidaPct ?? 0), frecuenciaUltimo: x.frecUlt != null ? r2(x.frecUlt) : null, frecuenciaPrevios: x.frecPrev != null ? r2(x.frecPrev) : null, mes: x.mesUlt, parcial: x.parcial },
    });
  }
  const altas = f.piezas.filter((p) => p.estado === "frecuencia_alta");
  if (altas.length) out.push({
    key: "pauta_frecuencia_mensual_alta", dash: "performance", tipo: "info", prioridad: "baja",
    titulo: `${altas.length} pieza${altas.length === 1 ? "" : "s"} que cada persona vio más de 5 veces en el mes (frecuencia alta), todavía sin que la gente responda menos`,
    descripcion: altas.slice(0, 4).map((p) => `"${clip(p.nombre, 40)}": ${p.motivo}`).join(" "),
    acciones: ["Pedile a la agencia que vaya preparando piezas nuevas antes de que la gente se canse", "Que revise el máximo de veces por persona (tope de frecuencia)"],
    datos: { piezas: altas.map((p) => p.nombre).slice(0, 10) },
  });
  return out;
}
