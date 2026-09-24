// ============================================================================
// Señales CRUZADAS: combinan datos PROPIOS (pauta, redes, web GA4, Search Console) con datos de
// MERCADO (share of search, demanda de la categoría, competencia social y web, SERP, regiones).
// Es lo que no ve ninguna regla de un solo tablero. Cada señal pertenece a UN tablero (dash)
// pero se marca `cruce: true` y se puede mostrar también en la visión general.
// Umbrales RELATIVOS (período anterior, mediana del set competitivo, promedio de la demanda).
// Solo disparan si la data existe. Puro (sin server-only): lo prueba scripts/cruces.test.ts.
// ============================================================================
import type { PautaMonth, SeoData, CompetitorPost, CompetitorWebData, WebReports, SearchConsoleData } from "./model";
import { analyzeSearchConsole, ctrEsperado, sosMonthly, demandaMonthly, shareOfEngagement, seoPositionIndex, pearson } from "./model";
import { keywordBuckets } from "./seo";
import { type Signal, type SignalDash, sortSignals, median, avg, sum, fNum, fPct, fDelta, fMoney, r2 } from "./types";

const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesLbl = (ym: string | undefined) => { const [y, m] = String(ym ?? "").split("-").map(Number); return `${MES[(m ?? 1) - 1]} ${String(y).slice(2)}`; };
const ymOf = (y: number, mIdx: number) => `${y}-${String(mIdx + 1).padStart(2, "0")}`;

export interface CrucesInput {
  now?: Date;
  ownBrand?: string | null;
  pauta?: { monthly: PautaMonth[]; currency: string | null; year?: number } | null;
  seo?: SeoData | null;
  social?: { posts: CompetitorPost[]; ownBrand: string } | null;
  web?: WebReports | null;
  competitorWeb?: CompetitorWebData | null;
  searchConsole?: SearchConsoleData | null;
}

// Inversión mensual CERRADA (sin el mes en curso) → "YYYY-MM" → $.
export function spendByMonth(p: CrucesInput["pauta"], now: Date): Map<string, number> {
  const out = new Map<string, number>();
  if (!p) return out;
  const curYm = ymOf(now.getFullYear(), now.getMonth());
  for (const m of p.monthly ?? []) {
    const yy = Number(String(m.mes ?? "").match(/(\d{2,4})\s*$/)?.[1] ?? NaN);
    const year = Number.isFinite(yy) ? (yy < 100 ? 2000 + yy : yy) : (p.year ?? now.getFullYear());
    const k = ymOf(year, m.mesIdx);
    if (k >= curYm || !(m.inv > 0)) continue;
    out.set(k, (out.get(k) ?? 0) + m.inv);
  }
  return out;
}

// Nombre de provincia normalizado (GA4 "Cordoba"/"Buenos Aires Province" ↔ Trends "Córdoba").
export function normProv(s: string): string {
  const t = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\b(province|provincia de|provincia|state|autonomous city of)\b/g, "").replace(/[()]/g, "").replace(/\s+/g, " ").trim();
  if (/(ciudad autonoma|capital federal|^caba$|ciudad de buenos aires)/.test(t)) return "capital federal";
  if (t === "tierra del fuego antartida e islas del atlantico sur") return "tierra del fuego";
  return t;
}

// Fuentes de tráfico → shares (el actor puede dar fracciones 0-1 o porcentajes).
function fuentesShare(f: Record<string, number> | null | undefined): Record<string, number> | null {
  if (!f) return null;
  const tot = sum(Object.values(f).map((v) => Math.max(0, Number(v) || 0)));
  if (tot <= 0) return null;
  return Object.fromEntries(Object.entries(f).map(([k, v]) => [k, (Math.max(0, Number(v) || 0) / tot) * 100]));
}

const PAID_CH = /^(paid|display|cross-network|paid shopping|paid video|paid social|paid search|paid other|audio|sms)/i;

export function computeCrucesSignals(inp: CrucesInput): Signal[] {
  const out: Signal[] = [];
  const now = inp.now ?? new Date();
  const S = (dash: SignalDash, s: Omit<Signal, "dash" | "cruce">) => out.push({ ...s, dash, cruce: true });
  const cur = inp.pauta?.currency ?? null;
  const spend = spendByMonth(inp.pauta, now);
  const sos = sosMonthly(inp.seo);
  const sosBy = new Map(sos.map((s) => [s.mes, s.share]));
  const ownBrand = inp.ownBrand ?? inp.social?.ownBrand ?? inp.seo?.brands?.find((b) => b.own)?.marca ?? "";

  // ── 1. ESOV (proxy): inversión propia vs Share of Search, mes a mes ─────────
  const aligned = [...spend.keys()].filter((k) => sosBy.has(k)).sort();
  if (aligned.length >= 4) {
    const last = aligned.slice(-3), prev = aligned.slice(-6, -3);
    const sL = avg(last.map((k) => spend.get(k)!)), sP = avg(prev.map((k) => spend.get(k)!));
    const oL = avg(last.map((k) => sosBy.get(k)!)), oP = avg(prev.map((k) => sosBy.get(k)!));
    const dSpend = sP ? ((sL - sP) / sP) * 100 : null;
    const dSos = oL - oP;
    const r = aligned.length >= 5 ? pearson(aligned.map((k) => spend.get(k)!), aligned.map((k) => sosBy.get(k)!)) : null;
    const per = `${mesLbl(prev[0])}–${mesLbl(prev[prev.length - 1])} vs ${mesLbl(last[0])}–${mesLbl(last[last.length - 1])}`;
    const esov = "Regla ESOV (en simple): cuando tu presencia publicitaria supera tu participación de mercado, la marca tiende a crecer; cuando queda por debajo, tiende a achicarse. No conocemos la inversión de la competencia, así que usamos tu share of search (qué parte de las búsquedas de marcas del set son de tu marca) como termómetro de mercado.";
    const datos = { periodo: per, inversionPromPrevia: Math.round(sP), inversionPromReciente: Math.round(sL), deltaInversionPct: dSpend == null ? null : r2(dSpend), sharePrevio: r2(oP), shareReciente: r2(oL), deltaSharePp: r2(dSos), correlacion: r == null ? null : r2(r), meses: aligned.map((k) => ({ mes: k, inversion: Math.round(spend.get(k)!), share: r2(sosBy.get(k)!) })) };
    if (dSpend != null && Math.abs(dSos) >= 1.5 && Math.abs(dSpend) >= 15) {
      if (dSos < 0 && dSpend < 0) S("performance", {
        key: "cruce_esov_sos_down_spend_down", tipo: "alerta", prioridad: dSos <= -3 ? "alta" : "media",
        titulo: `Tu share of search cae ${Math.abs(dSos).toFixed(1)} pp mientras bajaste la inversión ${fDelta(dSpend)}`,
        descripcion: `${per}: inversión promedio ${fMoney(sP, cur)} → ${fMoney(sL, cur)} por mes; share of search ${fPct(oP)} → ${fPct(oL)}. ${esov}${r != null ? ` Correlación inversión↔share en ${aligned.length} meses: r=${r.toFixed(2)}.` : ""}`,
        acciones: ["Recuperar la inversión de awareness (video/alcance) al menos al nivel previo", "Priorizar formatos que generan búsqueda de marca (video con la marca en los primeros segundos)", "Seguir el share of search mes a mes: es el indicador adelantado de share de mercado"],
        datos, impacto: { metrica: "Share of search perdido", valor: r2(dSos), unidad: "pp" },
      });
      else if (dSos > 0 && dSpend > 0) {
        const elas = dSos / (dSpend / 10);
        S("performance", {
          key: "cruce_esov_spend_up_sos_up", tipo: "oportunidad", prioridad: "media",
          titulo: `Invertiste ${fDelta(dSpend)} más y tu share of search subió ${dSos.toFixed(1)} pp`,
          descripcion: `${per}. Aproximadamente +${elas.toFixed(2)} pp de share por cada +10% de inversión (lectura de tendencia, no causalidad probada). ${esov}`,
          acciones: ["Sostener el nivel de inversión en awareness mientras el share responda", "Identificar qué campañas/medios explican la suba y darles más peso", "Probar un escalón más de inversión y medir si la respuesta del share se mantiene"],
          datos: { ...datos, ppPorMas10Inversion: r2(elas) }, impacto: { metrica: "pp de share of search por cada +10% de inversión", valor: r2(elas), unidad: "pp" },
        });
      } else if (dSos < 0 && dSpend > 0) S("performance", {
        key: "cruce_esov_spend_up_sos_down", tipo: "alerta", prioridad: "alta",
        titulo: `Invertiste ${fDelta(dSpend)} más pero tu share of search cayó ${Math.abs(dSos).toFixed(1)} pp`,
        descripcion: `${per}. La pauta no se está traduciendo en búsquedas de tu marca: o el mix está volcado a conversión/tráfico (no construye marca) o un competidor aceleró más fuerte. ${esov}`,
        acciones: ["Revisar el mix: qué parte de la inversión fue a awareness vs conversión", "Mirar en Redes si algún competidor aceleró su actividad en el mismo período", "Asegurar que las piezas nombren/muestren la marca en los primeros segundos"],
        datos, impacto: { metrica: "Share of search perdido", valor: r2(dSos), unidad: "pp" },
      });
      else S("performance", {
        key: "cruce_esov_sos_up_spend_down", tipo: "info", prioridad: "baja",
        titulo: `Tu share of search subió ${dSos.toFixed(1)} pp aun invirtiendo ${fDelta(dSpend)}`,
        descripcion: `${per}. El crecimiento viene de otra fuente (orgánico, PR, estacionalidad o caída de la competencia). Buen momento para medir cuánto de la inversión previa era necesaria.`,
        acciones: ["Identificar el motor del crecimiento (redes orgánicas, prensa, lanzamientos)", "No recortar más sin mirar el share mes a mes"],
        datos,
      });
    }
  }

  // ── 2. Estacionalidad: demanda de la categoría vs inversión propia por mes ──
  const dem = demandaMonthly(inp.seo);
  if (dem.length >= 10 && spend.size >= 1) {
    const byCal = new Map<number, number>(); // mes calendario → último dato disponible
    for (const d of dem) byCal.set(Number(d.mes.slice(5, 7)) - 1, d.busquedas);
    const demAvg = avg([...byCal.values()]);
    const idx = (m: number) => (demAvg > 0 && byCal.has(m) ? byCal.get(m)! / demAvg : null);
    // 2a. Pauta fuera de los picos (meses con inversión del año).
    const sm = [...spend.entries()].map(([k, v]) => ({ k, m: Number(k.slice(5, 7)) - 1, v })).filter((x) => idx(x.m) != null);
    if (sm.length >= 4) {
      const dTot = sum(sm.map((x) => byCal.get(x.m)!)), sTot = sum(sm.map((x) => x.v));
      const picos = sm.filter((x) => idx(x.m)! >= 1.1);
      const dPicos = sum(picos.map((x) => byCal.get(x.m)!)) / dTot * 100, sPicos = sum(picos.map((x) => x.v)) / sTot * 100;
      const r = pearson(sm.map((x) => x.v), sm.map((x) => byCal.get(x.m)!));
      if (picos.length && dPicos > 0 && sPicos < dPicos * 0.75) S("performance", {
        key: "cruce_seasonality_misaligned", tipo: "alerta", prioridad: sPicos < dPicos * 0.5 ? "alta" : "media",
        titulo: `Pautás fuera de los picos de demanda: ${picos.map((x) => MES[x.m]).join(", ")} concentran el ${fPct(dPicos, 0)} de las búsquedas y solo el ${fPct(sPicos, 0)} de tu inversión`,
        descripcion: `Demanda genérica de la categoría (búsquedas en Google) vs tu inversión mensual en ${sm.length} meses.${r != null ? ` Correlación inversión↔demanda: r=${r.toFixed(2)}${r < 0 ? " (invertís más cuando la gente busca menos)" : ""}.` : ""} Invertir cuando la categoría está en la cabeza del comprador suele rendir más por peso.`,
        acciones: ["Mover presupuesto de los meses valle a los meses pico de demanda", "Armar el calendario de pauta a partir de la curva de demanda del año anterior"],
        datos: { mesesPico: picos.map((x) => MES[x.m]), shareDemandaPicos: r2(dPicos), shareInversionPicos: r2(sPicos), correlacion: r == null ? null : r2(r), meses: sm.map((x) => ({ mes: x.k, inversion: Math.round(x.v), indiceDemanda: r2(idx(x.m)!) })) },
        impacto: { metrica: "Brecha entre peso de la demanda y de tu inversión en los picos", valor: r2(dPicos - sPicos), unidad: "pp" },
      });
    }
    // 2b. Próximo pico (usa la curva de los últimos 12 meses como pronóstico).
    const nxt = [1, 2, 3].map((o) => (now.getMonth() + o) % 12).find((m) => (idx(m) ?? 0) >= 1.15);
    if (nxt != null) {
      const i = idx(nxt)!;
      const lead = ((nxt - now.getMonth() + 12) % 12);
      S("performance", {
        key: "cruce_seasonality_next_peak", tipo: "oportunidad", prioridad: lead <= 1 ? "alta" : "media",
        titulo: `Próximo pico de demanda en ${MES_LARGO[nxt]} (${fDelta((i - 1) * 100)} sobre el promedio): adelantá presupuesto`,
        descripcion: `Según la demanda de la categoría del último año, ${MES_LARGO[nxt]} tuvo ${fNum(byCal.get(nxt)!)} búsquedas vs ${fNum(demAvg)} de promedio. Pronóstico basado en el año anterior (la estacionalidad suele repetirse).`,
        acciones: [`Planificar el pico: subir inversión de awareness 2-4 semanas antes de ${MES_LARGO[nxt]}`, "Asegurar presupuesto de Search para capturar la demanda genérica en el pico", "Tener listas las piezas y el stock para esas semanas"],
        datos: { mes: MES[nxt], indiceDemanda: r2(i), busquedas: byCal.get(nxt), promedio: Math.round(demAvg) },
        impacto: { metrica: "Búsquedas extra de la categoría vs un mes promedio", valor: Math.round(byCal.get(nxt)! - demAvg), unidad: "búsquedas" },
      });
    }
  }

  // ── 3. Share of engagement vs Share of Search ─────────────────────────────
  const soe = inp.social ? shareOfEngagement(inp.social.posts, inp.social.ownBrand) : null;
  const sosLast = sos[sos.length - 1] ?? null;
  if (soe) {
    const rivals = soe.porMarca.filter((b) => !b.propia);
    const leader = rivals[0];
    const own = soe.porMarca.find((b) => b.propia)!;
    const per = `${soe.desde} → ${soe.hasta}`;
    const ranking = soe.porMarca.map((b) => ({ marca: b.marca, share: r2(b.share), interacciones: b.interacciones, posts: b.posts }));
    if (sosLast) {
      const gap = soe.sharePropio - sosLast.share;
      if (Math.abs(gap) >= Math.max(8, sosLast.share * 0.35)) S("redes", gap < 0 ? {
        key: "cruce_soe_below_sos", tipo: "oportunidad", prioridad: gap <= -15 ? "alta" : "media",
        titulo: `Te buscan más de lo que conversan con vos: share of search ${fPct(sosLast.share, 0)} vs share of engagement ${fPct(soe.sharePropio, 0)}`,
        descripcion: `Share of engagement = tus interacciones (likes + comentarios) sobre las de todo el set competitivo en ${per}. La marca tiene demanda en Google pero en redes la conversación la capitaliza la competencia${leader ? ` (${leader.marca} ${fPct(leader.share, 0)})` : ""}.`,
        acciones: ["Subir cadencia y formatos conversacionales (preguntas, encuestas, colaboraciones)", "Amplificar con pauta las piezas orgánicas de mejor engagement", "Analizar las piezas top del líder en conversación"],
        datos: { shareEngagement: r2(soe.sharePropio), shareSearch: r2(sosLast.share), mesSearch: sosLast.mes, ventana: per, ranking },
        impacto: { metrica: "Brecha share of engagement vs share of search", valor: r2(gap), unidad: "pp" },
      } : {
        key: "cruce_soe_above_sos", tipo: "oportunidad", prioridad: "media",
        titulo: `Conversan con vos más de lo que te buscan: share of engagement ${fPct(soe.sharePropio, 0)} vs share of search ${fPct(sosLast.share, 0)}`,
        descripcion: `En ${per} tu marca se lleva una parte de la conversación social mayor que su parte de las búsquedas: el engagement no se está convirtiendo en intención de compra.`,
        acciones: ["Sumar llamados a buscar/visitar (nombre de producto, link a la web, CTA a tienda)", "Llevar las piezas de mejor engagement a pauta con objetivo de tráfico o consideración", "Revisar si el engagement viene de contenido de entretenimiento sin producto"],
        datos: { shareEngagement: r2(soe.sharePropio), shareSearch: r2(sosLast.share), mesSearch: sosLast.mes, ventana: per, ranking },
        impacto: { metrica: "Brecha share of engagement vs share of search", valor: r2(gap), unidad: "pp" },
      });
    }
    if (leader && own && leader.share >= Math.max(own.share * 2, 20)) S("redes", {
      key: "cruce_soe_leader_gap", tipo: "alerta", prioridad: own.share < 100 / soe.porMarca.length / 2 ? "alta" : "media",
      titulo: `${leader.marca} se lleva el ${fPct(leader.share, 0)} de la conversación del set vs tu ${fPct(own.share, 0)}`,
      descripcion: `Interacciones totales en ${per} (${soe.redes.join(" + ")}). Por post: ${leader.marca} ${fNum(leader.porPost)} vs vos ${fNum(own.porPost)}${leader.posts > own.posts ? `; además publicó ${leader.posts} piezas vs tus ${own.posts}` : ""}.`,
      acciones: [leader.porPost > own.porPost * 1.5 ? `El problema es de calidad por pieza: analizar formatos y pilares de ${leader.marca}` : `El problema es de volumen: igualar la cadencia de ${leader.marca} con tus formatos más fuertes`],
      datos: { ventana: per, ranking },
    });
  }

  // ── 4. Aceleración de un competidor (redes) × pico de tráfico web ──────────
  if (inp.social?.posts?.length) {
    const posts = inp.social.posts.filter((p) => p.fecha && p.marca !== inp.social!.ownBrand);
    const allDates = inp.social.posts.map((p) => p.fecha ?? "").filter(Boolean).sort();
    const ref = Math.min(now.getTime(), Date.parse(allDates[allDates.length - 1] ?? "") || now.getTime());
    const d14 = ref - 14 * 864e5, d30 = ref - 30 * 864e5, d60 = ref - 60 * 864e5;
    for (const marca of [...new Set(posts.map((p) => p.marca))]) {
      const bp = posts.filter((p) => p.marca === marca).map((p) => ({ ...p, t: Date.parse(p.fecha!) })).filter((p) => Number.isFinite(p.t));
      if (bp.length < 6) continue;
      const first = Math.min(...bp.map((p) => p.t));
      const recent = bp.filter((p) => p.t > d14).length;
      const before = bp.filter((p) => p.t <= d14);
      const wBefore = (d14 - first) / (7 * 864e5);
      const rateR = recent / 2, rateB = wBefore >= 2 && before.length >= 4 ? before.length / wBefore : null;
      const payR = bp.filter((p) => p.t > d30 && p.tipo === "PAUTA").length, payB = bp.filter((p) => p.t > d60 && p.t <= d30 && p.tipo === "PAUTA").length;
      const burstPosts = rateB != null && recent >= 4 && rateR >= rateB * 2;
      const burstPaid = payR >= 3 && payR >= payB * 2;
      if (!burstPosts && !burstPaid) continue;
      const dom = inp.competitorWeb?.domains?.find((d) => !d.own && d.marca.trim().toLowerCase() === marca.trim().toLowerCase());
      const refYm = new Date(ref).toISOString().slice(0, 7);
      let webPeak: { mes: string; delta: number } | null = null;
      if (dom?.monthly?.length) {
        const mo = [...dom.monthly].sort((a, b) => a.mes.localeCompare(b.mes));
        for (let i = mo.length - 1; i >= 1; i--) {
          if (mo[i]!.mes > refYm) continue;
          const dl = mo[i - 1]!.visitas > 0 ? ((mo[i]!.visitas - mo[i - 1]!.visitas) / mo[i - 1]!.visitas) * 100 : null;
          if (dl != null && dl >= 20 && mo[i]!.mes >= new Date(d60).toISOString().slice(0, 7)) webPeak = { mes: mo[i]!.mes, delta: dl };
          break;
        }
      }
      const partes = [burstPosts ? `publicó ${recent} piezas en los últimos 14 días (${rateR.toFixed(1)}/semana vs ${rateB!.toFixed(1)} antes)` : null, burstPaid ? `${payR} posts pautados en 30 días (vs ${payB} en los 30 previos)` : null].filter(Boolean);
      S("redes", {
        key: `cruce_comp_burst_${marca}`.replace(/\s+/g, "_"), tipo: "alerta", prioridad: webPeak ? "alta" : "media",
        titulo: `${marca} aceleró en redes${burstPaid ? ` (${payR} posts pautados)` : ""}${webPeak ? ` y tuvo un pico de tráfico web (${fDelta(webPeak.delta)} en ${mesLbl(webPeak.mes)})` : ""}`,
        descripcion: `${marca} ${partes.join(" y ")}.${webPeak ? " El pico de visitas a su sitio el mismo mes sugiere una campaña (lanzamiento, promo o evento)." : ""} Visitas web estimadas por SimilarWeb.`,
        acciones: [`Ver las piezas recientes de ${marca} en la sección de competencia (tema, oferta, formato)`, "Decidir si responder (contra-oferta, refuerzo de pauta) o sostener tu plan", "Vigilar tu share of search las próximas semanas"],
        datos: { marca, postsUlt14d: recent, ritmoReciente: r2(rateR), ritmoPrevio: rateB == null ? null : r2(rateB), pautadosUlt30d: payR, pautadosPrev30d: payB, picoWeb: webPeak ? { mes: webPeak.mes, deltaPct: r2(webPeak.delta) } : null },
      });
    }
  }

  // ── 5. Mix de fuentes de tráfico vs competidores (SimilarWeb) + GA4 propio ──
  const dom = inp.competitorWeb?.domains ?? [];
  const rivalsF = dom.filter((d) => !d.own).map((d) => ({ d, f: fuentesShare(d.fuentes) })).filter((x) => x.f) as { d: (typeof dom)[number]; f: Record<string, number> }[];
  const ownDom = dom.find((d) => d.own);
  const ownF = fuentesShare(ownDom?.fuentes);
  const ga4Ch = (inp.web?.chan.rows ?? []).map((x) => ({ canal: x.dimensionValues[0]!.value, ses: Number(x.metricValues[1]?.value || 0) }));
  const ga4Tot = sum(ga4Ch.map((c) => c.ses));
  const ga4Paid = ga4Tot ? (sum(ga4Ch.filter((c) => PAID_CH.test(c.canal)).map((c) => c.ses)) / ga4Tot) * 100 : null;
  const ga4Org = ga4Tot ? (sum(ga4Ch.filter((c) => /^organic search$/i.test(c.canal)).map((c) => c.ses)) / ga4Tot) * 100 : null;
  if (rivalsF.length >= 2) {
    const medSearch = median(rivalsF.map((x) => x.f.search ?? 0));
    const medDirect = median(rivalsF.map((x) => x.f.direct ?? 0));
    const ownSearch = ownF ? (ownF.search ?? 0) : ga4Org;
    const fuente = ownF ? "SimilarWeb (misma medición para todas las marcas)" : "tu GA4 (canal Organic Search) contra SimilarWeb de la competencia — mediciones distintas, tomalo como orientación";
    if (ownSearch != null && medSearch > 0 && ownSearch <= medSearch * 0.7 && medSearch - ownSearch >= 5) S("web", {
      key: "cruce_web_search_share_low", tipo: "oportunidad", prioridad: ownSearch <= medSearch * 0.5 ? "alta" : "media",
      titulo: `Solo el ${fPct(ownSearch, 0)} de tu tráfico llega desde buscadores vs ${fPct(medSearch, 0)} de la mediana de la competencia`,
      descripcion: `Fuente: ${fuente}. La competencia captura más demanda desde Google: oportunidad de SEO (contenido por intención de búsqueda, fichas optimizadas).`,
      acciones: ["Atacar las keywords faltantes y quick wins del tablero SEO", "Optimizar títulos y descripciones de las páginas que ya rankean", "Crear páginas de categoría/guía para las búsquedas genéricas"],
      datos: { propioPct: r2(ownSearch), medianaCompetencia: r2(medSearch), competidores: rivalsF.map((x) => ({ marca: x.d.marca, busquedaPct: r2(x.f.search ?? 0) })) },
      impacto: ownF && ownDom?.visitas ? { metrica: "Visitas mensuales extra si igualaras la mediana (estimación SimilarWeb)", valor: Math.round(((medSearch - ownSearch) / 100) * ownDom.visitas), unidad: "visitas/mes" } : undefined,
    });
    const ownOrganicLike = ownF ? (ownF.search ?? 0) + (ownF.direct ?? 0) : null;
    const medOrganicLike = medSearch + medDirect;
    if (ga4Paid != null && ga4Paid >= 45 && (ownOrganicLike == null || ownOrganicLike < medOrganicLike - 5)) S("web", {
      key: "cruce_web_paid_dependency", tipo: "alerta", prioridad: ga4Paid >= 60 ? "alta" : "media",
      titulo: `Tu sitio depende de la pauta: ${fPct(ga4Paid, 0)} de las sesiones vienen de canales pagos`,
      descripcion: `GA4 del período.${ownOrganicLike != null ? ` Tu tráfico directo + buscadores es ${fPct(ownOrganicLike, 0)} vs ${fPct(medOrganicLike, 0)} de la mediana de la competencia (SimilarWeb).` : ""} Si se corta la inversión, el tráfico cae en proporción: poca demanda propia.`,
      acciones: ["Construir tráfico propio: SEO, email/CRM y redes orgánicas", "Medir cuánto del tráfico pago es de marca (lo capturarías igual) vs genérico"],
      datos: { pagoGa4Pct: r2(ga4Paid), directoMasBusquedaPropioPct: ownOrganicLike == null ? null : r2(ownOrganicLike), medianaCompetenciaPct: r2(medOrganicLike) },
    });
  }

  // ── 6. SEO ↔ Web ─────────────────────────────────────────────────────────
  const sc = inp.searchConsole?.ok ? inp.searchConsole : null;
  const sca = analyzeSearchConsole(sc, ownBrand);
  if (sc) {
    const cer = (sc.monthly ?? []).filter((m) => m.dias >= 20);
    if (cer.length >= 3) {
      const L = cer[cer.length - 1]!, P = cer.slice(-3, -1);
      const dC = ((L.clicks - avg(P.map((m) => m.clicks))) / (avg(P.map((m) => m.clicks)) || 1)) * 100;
      const dPos = L.position - avg(P.map((m) => m.position));
      const sL = sosBy.get(L.mes), sP = P.map((m) => sosBy.get(m.mes)).filter((v): v is number => v != null);
      const dSos = sL != null && sP.length ? sL - avg(sP) : null;
      if (dC <= -15) S("seo-search", dSos == null || dSos > -1 ? {
        key: "cruce_seo_clicks_drop_not_demand", tipo: "alerta", prioridad: dC <= -30 ? "alta" : "media",
        titulo: `Perdés clicks orgánicos (${fDelta(dC)} en ${mesLbl(L.mes)}) ${dSos == null ? "" : "aunque la demanda de tu marca se mantiene"}`,
        descripcion: `Search Console: ${fNum(L.clicks)} clicks vs ${fNum(avg(P.map((m) => m.clicks)))} de promedio en los 2 meses previos; posición promedio ${L.position.toFixed(1)} (${dPos > 0 ? "empeoró" : "mejoró"} ${Math.abs(dPos).toFixed(1)}).${dSos != null ? ` Share of search ${fPct(sL!)} (${dSos >= 0 ? "+" : ""}${dSos.toFixed(1)} pp).` : ""} Es un problema de posiciones/CTR en Google, no de demanda.`,
        acciones: ["Revisar qué páginas perdieron clicks (tabla de páginas de Search Console)", "Chequear cambios recientes del sitio (URLs, títulos, velocidad, indexación)", "Recuperar las búsquedas que bajaron de posición con contenido actualizado"],
        datos: { mes: L.mes, clicks: L.clicks, promedioPrevio: Math.round(avg(P.map((m) => m.clicks))), deltaPct: r2(dC), deltaPosicion: r2(dPos), deltaSharePp: dSos == null ? null : r2(dSos) },
        impacto: { metrica: "Clicks orgánicos perdidos vs los meses previos", valor: Math.round(avg(P.map((m) => m.clicks)) - L.clicks), unidad: "clicks/mes" },
      } : {
        key: "cruce_seo_clicks_drop_demand", tipo: "info", prioridad: "media",
        titulo: `Caen los clicks orgánicos (${fDelta(dC)}) junto con tu share of search (${dSos.toFixed(1)} pp)`,
        descripcion: `${mesLbl(L.mes)}. La baja de tráfico desde Google viene de menos búsquedas de tu marca: es un tema de notoriedad/demanda más que de SEO técnico.`,
        acciones: ["Reforzar awareness (ver señales de inversión vs share of search)", "Proteger las búsquedas genéricas donde ya rankeás bien"],
        datos: { mes: L.mes, deltaClicksPct: r2(dC), deltaSharePp: r2(dSos) },
      });
    }
  }
  // 6b. Quick wins de la matriz SERP ↔ tu landing real (Search Console) ↔ su conversión (GA4).
  if (inp.seo?.serp?.length) {
    const b = keywordBuckets(inp.seo.serp);
    const land = new Map((inp.web?.landing.rows ?? []).map((x) => { const ses = Number(x.metricValues[0]?.value || 0), ke = Number(x.metricValues[2]?.value || 0); return [x.dimensionValues[0]!.value.split("?")[0], { ses, conv: ses ? (ke / ses) * 100 : 0 }] as const; }));
    const pathOf = (u: string) => { try { return new URL(u).pathname; } catch { return u; } };
    if (sc) {
      const rows = b.quickWins.map((q) => {
        const hit = (sc.queryPage ?? []).filter((r) => r.query.toLowerCase() === q.keyword.toLowerCase()).sort((a, c) => c.impressions - a.impressions)[0];
        if (!hit) return null;
        const extra = q.vol * Math.max(0, ctrEsperado(3) - ctrEsperado(q.pos)) / 100;
        const l = land.get(pathOf(hit.page));
        return { keyword: q.keyword, posicion: q.pos, volumen: q.vol, pagina: hit.page, impresionesSC: hit.impressions, ctrSC: r2(hit.ctr), clicksExtra: Math.round(extra), convLanding: l ? r2(l.conv) : null, conversionesExtra: l ? Math.round(extra * l.conv / 100) : null };
      }).filter((x): x is NonNullable<typeof x> => x != null).sort((a, c) => c.clicksExtra - a.clicksExtra).slice(0, 5);
      if (rows.length) {
        const gain = sum(rows.map((r) => r.clicksExtra));
        const conv = sum(rows.map((r) => r.conversionesExtra ?? 0));
        S("seo-search", {
          key: "cruce_seo_quick_wins_landing", tipo: "oportunidad", prioridad: gain >= 300 ? "alta" : "media",
          titulo: `${rows.length} búsquedas donde estás cerca del top (posición ${Math.min(...rows.map((r) => r.posicion))}-${Math.max(...rows.map((r) => r.posicion))}) ya tienen su página: llevarlas al top-3 suma ≈${fNum(gain)} clicks/mes${conv ? ` (≈${fNum(conv)} conversiones)` : ""}`,
          descripcion: rows.map((r) => `"${r.keyword}" #${r.posicion} → ${pathOf(r.pagina)}${r.convLanding != null ? ` (convierte ${fPct(r.convLanding, 2)})` : ""}`).join(" · ") + ". Páginas según Search Console; conversión de la landing según GA4.",
          acciones: ["Optimizar esas páginas (no crear nuevas): title/H1 con la búsqueda, contenido más completo, FAQ", "Enlazarlas desde la home y las páginas con más autoridad", "Priorizar las que ya convierten mejor"],
          datos: { keywords: rows },
          impacto: { metrica: "Clicks orgánicos adicionales estimados", valor: Math.round(gain), unidad: "clicks/mes" },
        });
      }
    } else if (ga4Org != null && ga4Tot > 0) {
      // Sin Search Console: orgánico propio (GA4) vs posición competitiva.
      const pi = seoPositionIndex(inp.seo);
      const rivals = pi.porMarca.filter((m) => !m.propia);
      const medRiv = rivals.length ? median(rivals.map((m) => m.indice)) : null;
      if (pi.propio != null && medRiv != null && pi.propio > medRiv * 1.15 && ga4Org < 25) S("web", {
        key: "cruce_web_organic_vs_position", tipo: "oportunidad", prioridad: "media",
        titulo: `El orgánico es solo el ${fPct(ga4Org, 0)} de tus sesiones y tu posición promedio en Google (${pi.propio.toFixed(0)}) está detrás de la competencia (${medRiv.toFixed(0)})`,
        descripcion: "Índice de posición = posición promedio ponderada por volumen de búsqueda de las keywords relevadas (100 = no aparecés; menor es mejor). Mejorar posiciones es la palanca de tráfico propio más barata. Conectá Search Console para ver clicks y páginas reales.",
        acciones: ["Trabajar los quick wins (posición 4-20) del tablero SEO", "Conectar Search Console para medir el efecto en clicks"],
        datos: { organicoPct: r2(ga4Org), indicePropio: r2(pi.propio), medianaCompetencia: r2(medRiv) },
      });
    }
  }

  // ── 7. Regional: demanda de la categoría alta y poco tráfico propio (GA4) ──
  const regRows = inp.web?.region.rows ?? [];
  const cats = inp.seo?.categorias?.length ? inp.seo.categorias : inp.seo?.categoria ? [inp.seo.categoria] : [];
  if (regRows.length >= 3 && cats.length && inp.seo?.regions?.length) {
    const gen = new Map<string, { nombre: string; v: number[] }>();
    const marcaI = new Map<string, number[]>();
    for (const r of inp.seo.regions) {
      const k = normProv(r.provincia);
      if (r.marca === "Genérico") { const e = gen.get(k) ?? { nombre: r.provincia, v: [] }; e.v.push(r.interes); gen.set(k, e); }
      else if (ownBrand && r.marca === ownBrand) marcaI.set(k, [...(marcaI.get(k) ?? []), r.interes]);
    }
    const genAvg = new Map([...gen.entries()].map(([k, e]) => [k, { nombre: e.nombre, v: avg(e.v) }]));
    if (genAvg.size >= 5) {
      const ses = new Map<string, number>();
      for (const x of regRows) { const k = normProv(x.dimensionValues[0]!.value); ses.set(k, (ses.get(k) ?? 0) + Number(x.metricValues[0]?.value || 0)); }
      const sesTot = sum([...ses.values()]);
      const genTot = sum([...genAvg.values()].map((g) => g.v));
      const truncated = regRows.length >= 8;
      const rows = [...genAvg.entries()].filter(([, g]) => g.v >= 50).map(([k, g]) => {
        const own = ses.get(k) ?? 0;
        const idx = (own / (sesTot || 1)) / (g.v / (genTot || 1));
        return { provincia: g.nombre, interesGenerico: Math.round(g.v), sesiones: own, fueraDelTop: !ses.has(k) && truncated, indice: idx, interesMarca: marcaI.has(k) ? Math.round(avg(marcaI.get(k)!)) : null };
      }).filter((r) => r.indice <= 0.5 && r.provincia).sort((a, b) => b.interesGenerico - a.interesGenerico).slice(0, 3);
      if (rows.length) S("performance", {
        key: "cruce_geo_demand_gap", tipo: "oportunidad", prioridad: "media",
        titulo: `${rows.map((r) => r.provincia).join(", ")}: alta demanda de la categoría y poco tráfico a tu web`,
        descripcion: rows.map((r) => `${r.provincia}: interés de la categoría ${r.interesGenerico}/100, ${r.fueraDelTop ? "fuera de tus 8 regiones con más tráfico" : `${Math.round((r.sesiones / (sesTot || 1)) * 100)}% de tus sesiones`}${r.interesMarca != null ? `, interés en tu marca ${r.interesMarca}/100` : ""}`).join(" · ") + ". Interés = Google Trends; tráfico = GA4 del período.",
        acciones: ["Segmentar pauta geográfica hacia esas provincias (probar 10-15% del presupuesto)", "Revisar distribución y retailers con presencia en esas zonas", "Medir el efecto en sesiones por región el mes siguiente"],
        datos: { provincias: rows.map((r) => ({ ...r, indice: r2(r.indice) })) },
      });
    }
  }

  // ── 8. Formato ganador del mercado vs tu mix (competencia social) ─────────
  if (inp.social?.posts?.length) {
    const ob = inp.social.ownBrand;
    const rv = inp.social.posts.filter((p) => p.marca !== ob && p.content_type);
    const own = inp.social.posts.filter((p) => p.marca === ob && p.content_type);
    const fm = new Map<string, number[]>();
    for (const p of rv) fm.set(p.content_type!, [...(fm.get(p.content_type!) ?? []), p.engagement ?? 0]);
    const rows = [...fm.entries()].filter(([, v]) => v.length >= 5).map(([f, v]) => ({ formato: f, er: avg(v), posts: v.length })).sort((a, b) => b.er - a.er);
    if (rows.length >= 2 && own.length >= 5) {
      const top = rows[0]!;
      const medEr = median(rows.map((r) => r.er));
      const ownShare = (own.filter((p) => p.content_type === top.formato).length / own.length) * 100;
      if (top.er >= medEr * 1.3 && ownShare < 15) S("redes", {
        key: "cruce_comp_format_gap", tipo: "oportunidad", prioridad: "media",
        titulo: `En tu mercado ganan los ${fmtLbl(top.formato)} (${fPct(top.er, 2)} de engagement por seguidor) y son solo el ${fPct(ownShare, 0)} de tus piezas`,
        descripcion: `Engagement promedio por formato en la competencia: ${rows.slice(0, 4).map((r) => `${fmtLbl(r.formato)} ${fPct(r.er, 2)} (${r.posts} posts)`).join(" · ")}. Mediana ${fPct(medEr, 2)}.`,
        acciones: [`Testear 4-6 ${fmtLbl(top.formato)} en el próximo mes con tus pilares más fuertes`, "Comparar su engagement contra tu mediana antes de escalar"],
        datos: { formatosCompetencia: rows.slice(0, 5).map((r) => ({ ...r, er: r2(r.er) })), sharePropio: r2(ownShare) },
      });
    }
  }

  // ── 9. Search Console: CTR bajo con buena posición, quick wins, marca vs genérico ──
  if (sc) {
    if (sca.ctrBajo.length) {
      const top = sca.ctrBajo.slice(0, 5);
      const extra = sum(top.map((r) => r.clicksExtra));
      S("seo-search", {
        key: "cruce_sc_ctr_low", tipo: "oportunidad", prioridad: extra >= 300 ? "alta" : "media",
        titulo: `${sca.ctrBajo.length} búsquedas donde estás top-5 pero pocos hacen click: reescribir título y descripción suma ≈${fNum(extra)} clicks`,
        descripcion: top.map((r) => `"${r.key}" pos ${r.position.toFixed(1)}, CTR ${fPct(r.ctr, 1)} (esperado ~${fPct(r.ctrEsperado, 0)})`).join(" · ") + `. Search Console, ${sc.monthly?.[0]?.mes ?? ""} → ${sc.monthly?.[sc.monthly.length - 1]?.mes ?? ""}.`,
        acciones: ["Reescribir el title y la meta description de esas páginas (beneficio concreto, precio/cuotas, año)", "Sumar datos estructurados (producto, reseñas, FAQ) para ganar espacio en el resultado", "Revisar si la página responde a la intención de la búsqueda"],
        datos: { busquedas: top.map((r) => ({ busqueda: r.key, posicion: r2(r.position), ctr: r2(r.ctr), ctrEsperado: r2(r.ctrEsperado), impresiones: r.impressions, clicksExtra: r.clicksExtra, pagina: r.pagina })) },
        impacto: { metrica: "Clicks extra si el CTR llegara al esperado para su posición (período de 3 meses)", valor: extra, unidad: "clicks" },
      });
    }
    if (sca.quickWins.length) {
      const top = sca.quickWins.slice(0, 5);
      const extra = sum(top.map((r) => r.clicksExtra));
      S("seo-search", {
        key: "cruce_sc_quick_wins", tipo: "oportunidad", prioridad: extra >= 300 ? "alta" : "media",
        titulo: `${sca.quickWins.length} búsquedas reales en posición 8-20 con muchas impresiones: llevarlas al top-3 suma ≈${fNum(extra)} clicks`,
        descripcion: top.map((r) => `"${r.key}" pos ${r.position.toFixed(1)} (${fNum(r.impressions)} impresiones)`).join(" · ") + ". Datos reales de Search Console (no estimación de volumen).",
        acciones: ["Mejorar la página que ya aparece para cada búsqueda (contenido, title, enlaces internos)", "Priorizar las de mayor impresiones y más cerca de la página 1"],
        datos: { busquedas: top.map((r) => ({ busqueda: r.key, posicion: r2(r.position), impresiones: r.impressions, clicksExtra: r.clicksExtra, pagina: r.pagina })) },
        impacto: { metrica: "Clicks extra estimados (período de 3 meses)", valor: extra, unidad: "clicks" },
      });
    }
    if (sca.marca && sca.marca.shareGenerico < 25 && sca.totales && sca.totales.clicks >= 200) S("seo-search", {
      key: "cruce_sc_brand_dependency", tipo: "alerta", prioridad: "media",
      titulo: `El ${fPct(100 - sca.marca.shareGenerico, 0)} de tus clicks orgánicos son búsquedas con tu marca: casi no capturás demanda genérica`,
      descripcion: `Clicks de búsquedas sin la marca: ${fNum(sca.marca.clicksGenerico)} de ${fNum(sca.totales.clicks)}. Quien todavía no te conoce no te encuentra en Google.`,
      acciones: ["Crear contenido para búsquedas de categoría (\"mejor…\", \"cómo elegir…\", \"precio…\")", "Cruzar con las keywords faltantes del tablero SEO"],
      datos: { ...sca.marca },
    });
  }

  return sortSignals(out);
}

function fmtLbl(f: string): string {
  const m: Record<string, string> = { REEL: "reels", VIDEO: "videos", IMAGE: "imágenes", SIDECAR: "carruseles" };
  return m[f] ?? f.toLowerCase();
}
