// Señales SEO/GEO AVANZADAS (portado de BIP, sep-2026): Search Console a fondo (canibalización,
// contenido que decae, dispositivo), auditoría técnica + Core Web Vitals, fuentes que cita la IA
// ("fuentes que te faltan"), evolución de posiciones (seo_rankings) + (Drean) ESoS por categoría,
// visibilidad en IA con dato insuficiente y propiedad de Search Console casi vacía.
// PURO: recibe todo ya leído/analizado (lib/seo-avanzado-server.ts). Imports relativos (testeable).
import { type Signal, sortSignals, sum, fNum } from "./types";
import { CAUSA_TXT, type ScDeep } from "../sc-deep";
import type { AuditIssue, BotAcceso } from "../seo-audit-core";
import { TIPO_FUENTE_LABEL, type FuentesIa } from "../llmo-fuentes";
import type { KwEvolResumen } from "../seo-kw-evolucion";
import type { EsosResult } from "../marca-indices";
import { LLMO_MIN_N } from "../llmo-stats";

export interface SeoAvanzadoInput {
  scDeep?: ScDeep | null;
  scSite?: string | null;
  scImpresionesMes?: number | null;
  audit?: { issues?: AuditIssue[]; bots?: BotAcceso[]; paginas?: number } | null;
  fuentes?: FuentesIa[] | null;
  kwEvol?: KwEvolResumen | null;
  esos?: { categoria: string; label: string; res: EsosResult }[] | null;
  llmoN?: { categoria: string; label: string; n: number }[] | null;
}

const path = (u: string) => { try { const x = new URL(u); return (x.pathname + x.search) || "/"; } catch { return u; } };
const r0 = (v: number) => Math.round(v);

export function computeSeoAvanzadoSignals(inp: SeoAvanzadoInput): Signal[] {
  const out: Signal[] = [];
  const S = (s: Omit<Signal, "dash">) => out.push({ ...s, dash: "seo-search" });

  // ── 0. Propiedad de Search Console casi vacía (el análisis no representa al sitio) ──
  if (inp.scSite && inp.scImpresionesMes != null && inp.scImpresionesMes < 20000) S({
    key: "seo_sc_propiedad_chica", tipo: "alerta", prioridad: "media",
    titulo: `Search Console (${inp.scSite}) solo ve ${fNum(inp.scImpresionesMes)} apariciones en Google por mes (impresiones): está mirando una parte chica de la web`,
    descripcion: "Google Analytics (GA4) registra decenas de miles de visitas por mes desde Google sin pagar, así que esa versión del sitio en Search Console no representa a toda la web: lo más probable es que el grueso esté en otra (sc-domain:drean.com.ar o la versión sin www). Por eso las páginas que compiten entre sí, las que pierden visitas y el % de clics quedan por debajo de la realidad.",
    acciones: ["Pedile a quien administra Search Console que le dé acceso a la cuenta de Google del tablero en la propiedad de todo el dominio (sc-domain:drean.com.ar)", "Después, volvé a correr la actualización \"Search Console sync\" (GitHub Actions) o pedíselo a quien mantiene el tablero"],
    datos: { site: inp.scSite, impresionesMes: inp.scImpresionesMes },
  });

  // ── 1. Canibalización ──
  const can = inp.scDeep?.canibalizacion ?? [];
  if (can.length) {
    const top = can.slice(0, 5);
    const gan = sum(can.map((c) => c.clicksGanables));
    const alta = can.filter((c) => c.severidad === "alta").length;
    if (alta || gan >= 20) S({
      key: "seo_sc_canibalizacion", tipo: "oportunidad", prioridad: gan >= 200 ? "alta" : "media",
      titulo: `${can.length} búsqueda${can.length === 1 ? "" : "s"} donde varias páginas de drean.com.ar se pelean entre sí por aparecer en Google (canibalización)`,
      descripcion: `${top.map((c) => `"${c.query}": ${c.urls.length} páginas (la segunda se lleva el ${r0(c.segundaShare)}% de las apariciones; lugar promedio ${c.posicionMedia.toFixed(1)})`).join(" · ")}. Regla práctica: se marca cuando la segunda página tiene 15% o más de las apariciones y está entre el lugar 3 y el 20.`,
      acciones: ["Pedile al equipo web que elija una página principal por búsqueda (la que mejor aparece) y junte las otras en esa (redirección 301 o etiqueta canonical), o que cada página apunte a una búsqueda distinta", "Que los links internos del sitio apunten a la página principal", "Revisar que los títulos de las páginas no apunten todos a la misma búsqueda"],
      datos: { casos: top.map((c) => ({ busqueda: c.query, impresiones: c.impresiones, posicionMedia: Math.round(c.posicionMedia * 10) / 10, urls: c.urls.slice(0, 3).map((u) => ({ pagina: path(u.page), share: r0(u.share), posicion: Math.round(u.posicion * 10) / 10 })), principal: path(c.principal), clicksGanables: c.clicksGanables })) },
      impacto: { metrica: "Clicks/mes estimados al consolidar", valor: gan, unidad: "clicks/mes" },
    });
  }

  // ── 2. Contenido que decae ──
  const dec = inp.scDeep?.decaimiento ?? [];
  if (dec.length) {
    const perdidos = sum(dec.map((d) => d.clicksPerdidos));
    const top = dec.slice(0, 5);
    const sitio = inp.scDeep?.sitioD90;
    S({
      key: "seo_sc_decay", tipo: "alerta", prioridad: perdidos >= 300 ? "alta" : "media",
      titulo: `${dec.length} página${dec.length === 1 ? "" : "s"} que viene${dec.length === 1 ? "" : "n"} perdiendo visitas desde Google mes a mes (−${fNum(perdidos)} clics en 90 días)`,
      descripcion: `${top.map((d) => `${path(d.page)}: ${fNum(d.clicksPrev)} → ${fNum(d.clicks)} clics (${r0(d.d90 * 100)}%${d.dYoY != null ? `; ${r0(d.dYoY * 100)}% interanual` : ", sin dato interanual"}) — ${CAUSA_TXT[d.causa].titulo}`).join(" · ")}.${sitio != null ? ` El sitio en total varió ${sitio >= 0 ? "+" : ""}${r0(sitio * 100)}%.` : ""}`,
      acciones: [...new Set(top.map((d) => CAUSA_TXT[d.causa].accion))].slice(0, 3),
      datos: { paginas: top.map((d) => ({ pagina: path(d.page), clicks: d.clicks, clicksPrev: d.clicksPrev, variacion90Pct: r0(d.d90 * 100), variacionInteranualPct: d.dYoY != null ? r0(d.dYoY * 100) : null, causa: d.causa })) },
      impacto: { metrica: "Clicks/mes a recuperar", valor: r0(perdidos / 3), unidad: "clicks/mes" },
    });
  }

  // ── 3. Dispositivo ──
  const hz = inp.scDeep?.dispositivos?.hallazgo;
  if (hz) S({
    key: `seo_sc_device_${hz.tipo}`, tipo: "alerta", prioridad: "media",
    titulo: hz.tipo === "pos_mobile" ? "En Google, Drean aparece más abajo cuando buscan desde el celular que desde la computadora" : hz.tipo === "ctr_mobile" ? "Desde el celular, menos gente de la esperada hace clic en Drean (CTR)" : "Caen los clics desde el celular",
    descripcion: `${hz.texto} Google arma sus resultados mirando la versión para celular de la web: las diferencias suelen venir de cómo se usa en el celular (velocidad, contenido escondido, ventanas que tapan la página).`,
    acciones: ["Pedile al equipo web que revise la velocidad en celular en la auditoría técnica (Core Web Vitals)", "Que el contenido y las marcas para Google (datos estructurados) sean iguales en celular y computadora", "Sacar las ventanas emergentes (pop-ups) que tapan la página en el celular"],
    datos: { dispositivos: (inp.scDeep?.dispositivos.filas ?? []).map((f) => ({ dispositivo: f.label, clicks: f.clicks, posicion: Math.round(f.position * 10) / 10, ctr: Math.round(f.ctr * 100) / 100 })) },
  });

  // ── 4. Auditoría técnica + CWV (errores y advertencias; los avisos quedan en el tablero) ──
  for (const i of (inp.audit?.issues ?? []).filter((x) => x.severidad !== "notice").slice(0, 6)) {
    S({
      key: `seo_audit_${i.check}`, tipo: "alerta", prioridad: i.severidad === "error" ? "alta" : "media",
      titulo: i.paginasAfectadas ? `${i.titulo} (${i.paginasAfectadas} de ${inp.audit?.paginas ?? i.paginasAfectadas})` : i.titulo,
      descripcion: `${i.porQue} ${i.urls.slice(0, 3).map((u) => `${u.url ? path(u.url) + ": " : ""}${u.detalle}`).join(" · ")}`,
      acciones: i.como,
      datos: { check: i.check, severidad: i.severidad, paginas: i.paginasAfectadas, clicksAfectados90d: i.clicksAfectados, recurso: i.recurso.href },
    });
  }

  // ── 5. Fuentes de las respuestas de IA: "fuentes que te faltan" ──
  for (const f of inp.fuentes ?? []) {
    if (f.respuestasConFuentes < 10) continue;
    const gap = f.faltantes.filter((x) => x.soloCompetidores >= 2);
    if (gap.length >= 2) S({
      key: `seo_ia_fuentes_gap_${f.categoria}`.replace(/\s+/g, "_"), tipo: "oportunidad", prioridad: "media",
      titulo: `${f.categoria}: ${gap.length} sitios que la IA usa como fuente cuando recomienda a la competencia y no a Drean`,
      descripcion: `${gap.slice(0, 6).map((x) => `${x.dominio} (${TIPO_FUENTE_LABEL[x.tipo].toLowerCase()}, ${x.soloCompetidores} respuestas)`).join(" · ")}. Los asistentes de IA citan sobre todo medios y reseñas de terceros: estar ahí es lo más directo para que te nombren.${f.citationSharePropio != null ? ` drean.com.ar es el ${f.citationSharePropio.toFixed(0)}% de las citas.` : ""}`,
      acciones: ["Conseguí presencia en esos sitios: reseñas, comparativas, notas de prensa o fichas completas en las tiendas online de las cadenas", "Publicá en la web datos que se puedan citar (especificaciones, consumo, garantía, precios con fecha)"],
      datos: { respuestas: f.respuestas, conFuentes: f.respuestasConFuentes, citationSharePropioPct: f.citationSharePropio != null ? Math.round(f.citationSharePropio * 10) / 10 : null, faltantes: gap.slice(0, 8).map((x) => ({ dominio: x.dominio, tipo: x.tipo, respuestasSoloCompetencia: x.soloCompetidores })) },
    });
  }

  // ── 6. Evolución de posiciones (fotos de seo_rankings) ──
  const ev = inp.kwEvol;
  if (ev && ev.semanas >= 2) {
    const perd = ev.perdedoras.filter((k) => k.volumen > 0);
    const salen = perd.filter((k) => k.estado === "salio_top10" || k.estado === "perdida");
    if (salen.length >= 2 || perd.length >= 4) S({
      key: "seo_kw_perdidas", tipo: "alerta", prioridad: salen.length >= 3 ? "alta" : "media",
      titulo: `Búsquedas donde bajaste en Google entre ${ev.desde} y ${ev.hasta}: ${ev.salieronTop10} salieron de los 10 primeros resultados (entraron ${ev.entraronTop10})`,
      descripcion: `Las que más pesan (cuánto bajaron × cuánto se buscan): ${perd.slice(0, 6).map((k) => `"${k.keyword}" lugar ${k.posDesde ?? "—"} → ${k.posHasta ?? "fuera"} (${fNum(k.volumen)} por mes)`).join(" · ")}. Los resultados de Google se mueven de una medición a otra: mirá la tendencia de varias semanas antes de reescribir una página.`,
      acciones: ["Mirá quién quedó en tu lugar en esas búsquedas (matriz SEO competitivo) y qué tiene su página", "Pedile al equipo web que revise si la página cambió (contenido, título, etiqueta canonical) o si viene perdiendo clics en Search Console"],
      datos: { desde: ev.desde, hasta: ev.hasta, keywords: perd.slice(0, 8).map((k) => ({ keyword: k.keyword, desde: k.posDesde, hasta: k.posHasta, volumen: k.volumen })) },
    });
    const gan = ev.ganadoras.filter((k) => k.estado === "entro_top10");
    if (gan.length >= 2) S({
      key: "seo_kw_ganadas", tipo: "info", prioridad: "baja",
      titulo: `${ev.entraronTop10} búsquedas entraron a los 10 primeros resultados de Google entre ${ev.desde} y ${ev.hasta}`,
      descripcion: gan.slice(0, 6).map((k) => `"${k.keyword}" lugar ${k.posDesde ?? "fuera"} → ${k.posHasta}`).join(" · "),
      acciones: ["Identificá qué cambio lo explica y repetilo en páginas parecidas"],
      datos: { keywords: gan.slice(0, 8).map((k) => ({ keyword: k.keyword, desde: k.posDesde, hasta: k.posHasta })) },
    });
  }

  // ── 7. ESoS por categoría (share of search vs share GfK) ──
  for (const e of inp.esos ?? []) {
    const u = e.res.ultimo;
    if (!u || u.esos == null || e.res.lectura === "neutral" || e.res.lectura == null) continue;
    const baja = e.res.lectura === "baja";
    S({
      key: `seo_esos_${baja ? "negativo" : "positivo"}_${e.categoria}`, tipo: baja ? "alerta" : "oportunidad", prioridad: baja && u.esos <= -5 ? "alta" : "media",
      titulo: `${e.label}: ${baja ? "te buscan menos de lo que vendés (las ventas tienden a bajar)" : "te buscan más de lo que vendés (las ventas tienden a subir)"} — diferencia de ${u.esos > 0 ? "+" : ""}${u.esos.toFixed(1)} puntos (ESoS)`,
      descripcion: `Tu parte de las búsquedas en Google (share of search, promedio de 6 meses) es ${u.sosMa?.toFixed(1)}% y tu parte de las ventas del mercado (share GfK, últimos 12 meses, en unidades) es ${u.som?.toFixed(1)}% en ${u.mes}, ${e.res.racha} meses seguidos del mismo lado. Según estudios de Binet (IPA), lo que se busca anticipa lo que después se vende.`,
      acciones: baja
        ? ["Reforzá en esa categoría los avisos para que te conozcan y el contenido que genera búsquedas de la marca", "Mirá el espacio en góndola (Floor Share) y los modelos en tienda (Cuadros Básicos): puede que hoy se venda por estar bien exhibido"]
        : ["Mantené la inversión en marca en esa categoría", "Asegurate de tener stock, buen precio y buena exhibición para aprovechar esas búsquedas (Floor Share / Cuadro Básico)"],
      datos: { mes: u.mes, sosMa: u.sosMa, som: u.som, esos: u.esos, ratio: u.ratio, racha: e.res.racha, mesesAlineados: e.res.mesesAlineados },
    });
  }

  // ── 8. Visibilidad en IA con muestra insuficiente ──
  const insuf = (inp.llmoN ?? []).filter((x) => x.n > 0 && x.n < LLMO_MIN_N);
  if (insuf.length) S({
    key: "seo_llmo_muestra_insuficiente", tipo: "info", prioridad: "baja",
    titulo: `Visibilidad en IA: la última medición tiene pocas respuestas por categoría (${insuf.map((x) => `n=${x.n}`)[0]}), así que el margen de error es grande (±20-45 puntos)`,
    descripcion: `Con tan pocas respuestas, las diferencias entre marcas pueden ser casualidad (los márgenes de error se superponen — intervalos de Wilson). ${insuf.map((x) => x.label).join(", ")}. La actualización semanal junta 28 días (≈48 respuestas por categoría).`,
    acciones: ["Todavía no saques conclusiones de un mes a otro: esperá a tener 30 respuestas o más", "Pedile a quien mantiene el tablero que verifique que la actualización \"LLMO sync\" corra los lunes (y que esté corrida la migración 0118)"],
    datos: { categorias: insuf },
  });

  return sortSignals(out);
}
