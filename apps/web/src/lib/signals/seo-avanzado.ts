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
    titulo: `Search Console (${inp.scSite}) ve solo ${fNum(inp.scImpresionesMes)} impresiones por mes`,
    descripcion: "Con decenas de miles de sesiones orgánicas por mes en GA4, esa propiedad no representa al sitio: probablemente el tráfico vive en otra propiedad (sc-domain:drean.com.ar o la versión sin www). Canibalización, decaimiento y CTR quedan subestimados.",
    acciones: ["Dar acceso a la cuenta de Google del token en la propiedad de dominio (sc-domain:drean.com.ar)", "Volver a correr el workflow Search Console sync"],
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
      titulo: `${can.length} búsqueda${can.length === 1 ? "" : "s"} donde varias páginas de drean.com.ar compiten entre sí (canibalización)`,
      descripcion: `${top.map((c) => `"${c.query}": ${c.urls.length} URLs (la 2ª se lleva el ${r0(c.segundaShare)}% de las impresiones, posición media ${c.posicionMedia.toFixed(1)})`).join(" · ")}. Umbral de práctica: 2ª URL ≥15% de impresiones con posición 3-20 (heurístico).`,
      acciones: ["Elegir una URL principal por búsqueda (la de mejor posición) y consolidar: 301 o canonical desde las otras, o reenfocar cada página a una intención distinta", "Alinear los enlaces internos para que apunten a la principal", "Revisar que los títulos no apunten todos a la misma búsqueda"],
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
      titulo: `${dec.length} página${dec.length === 1 ? "" : "s"} con caída sostenida de clics (−${fNum(perdidos)} clics en 90 días)`,
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
    titulo: hz.tipo === "pos_mobile" ? "Drean rankea peor en mobile que en desktop" : hz.tipo === "ctr_mobile" ? "En mobile el CTR rinde menos de lo esperado" : "Caen los clics desde mobile",
    descripcion: `${hz.texto} Google indexa la versión mobile: las diferencias suelen venir de la experiencia en el celular (velocidad, contenido oculto, intersticiales).`,
    acciones: ["Revisar Core Web Vitals mobile en la auditoría técnica", "Verificar que el contenido y los datos estructurados sean iguales en mobile y desktop", "Evitar pop-ups que tapan el contenido en el celular"],
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
      titulo: `${f.categoria}: ${gap.length} sitios que la IA cita cuando recomienda a la competencia y no a Drean`,
      descripcion: `${gap.slice(0, 6).map((x) => `${x.dominio} (${TIPO_FUENTE_LABEL[x.tipo].toLowerCase()}, ${x.soloCompetidores} respuestas)`).join(" · ")}. Los asistentes citan sobre todo medios y reseñas de terceros: estar ahí es la palanca más directa para aparecer.${f.citationSharePropio != null ? ` drean.com.ar es el ${f.citationSharePropio.toFixed(0)}% de las citas.` : ""}`,
      acciones: ["Conseguir presencia en esos sitios: reseñas, comparativas, notas de prensa o fichas completas en retailers", "Publicar datos citables propios (specs, consumo, garantía, precios con fecha)"],
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
      titulo: `Keywords en retroceso entre ${ev.desde} y ${ev.hasta}: ${ev.salieronTop10} salieron del top-10 (entraron ${ev.entraronTop10})`,
      descripcion: `Las de más peso (cambio × volumen): ${perd.slice(0, 6).map((k) => `"${k.keyword}" ${k.posDesde ?? "—"} → ${k.posHasta ?? "fuera"} (${fNum(k.volumen)}/mes)`).join(" · ")}. La SERP varía entre fotos: mirar la tendencia de varias corridas antes de reescribir una página.`,
      acciones: ["Mirar quién ocupó el lugar en esas búsquedas (matriz SEO competitivo) y qué tiene su página", "Revisar si la página cambió (contenido, título, canonical) o si decae en Search Console"],
      datos: { desde: ev.desde, hasta: ev.hasta, keywords: perd.slice(0, 8).map((k) => ({ keyword: k.keyword, desde: k.posDesde, hasta: k.posHasta, volumen: k.volumen })) },
    });
    const gan = ev.ganadoras.filter((k) => k.estado === "entro_top10");
    if (gan.length >= 2) S({
      key: "seo_kw_ganadas", tipo: "info", prioridad: "baja",
      titulo: `${ev.entraronTop10} keywords entraron al top-10 entre ${ev.desde} y ${ev.hasta}`,
      descripcion: gan.slice(0, 6).map((k) => `"${k.keyword}" ${k.posDesde ?? "fuera"} → ${k.posHasta}`).join(" · "),
      acciones: ["Identificar qué cambio lo explica y replicarlo en las páginas vecinas"],
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
      titulo: `${e.label}: ESoS ${u.esos > 0 ? "+" : ""}${u.esos.toFixed(1)} pp — ${baja ? "te buscan menos de lo que vendés (el share tiende a bajar)" : "te buscan más de lo que vendés (el share tiende a subir)"}`,
      descripcion: `Share of search de Drean (promedio 6 meses) ${u.sosMa?.toFixed(1)}% vs share de mercado GfK (año móvil, unidades) ${u.som?.toFixed(1)}% en ${u.mes}, ${e.res.racha} meses seguidos del mismo lado. Referencia Binet / IPA: el share of search anticipa al share de mercado.`,
      acciones: baja
        ? ["Reforzar awareness y demanda de marca en la categoría (pauta de alcance, contenido)", "Cruzar con Floor Share y Cuadros Básicos: la venta puede estar sostenida por presencia en góndola"]
        : ["Sostener la inversión en marca en la categoría", "Asegurar disponibilidad y precio para capturar la demanda (Floor Share / CB)"],
      datos: { mes: u.mes, sosMa: u.sosMa, som: u.som, esos: u.esos, ratio: u.ratio, racha: e.res.racha, mesesAlineados: e.res.mesesAlineados },
    });
  }

  // ── 8. Visibilidad en IA con muestra insuficiente ──
  const insuf = (inp.llmoN ?? []).filter((x) => x.n > 0 && x.n < LLMO_MIN_N);
  if (insuf.length) S({
    key: "seo_llmo_muestra_insuficiente", tipo: "info", prioridad: "baja",
    titulo: `Visibilidad en IA: la última medición tiene ${insuf.map((x) => `n=${x.n}`)[0]} respuestas por categoría (margen de error de ±20-45 pp)`,
    descripcion: `Con tan pocas respuestas las diferencias entre marcas no son significativas (intervalos de Wilson solapados). ${insuf.map((x) => x.label).join(", ")}. El sync semanal acumula 28 días (n ≈ 48 por categoría).`,
    acciones: ["No leer cambios de un mes a otro hasta que n ≥ 30", "Verificar que el workflow LLMO sync corra los lunes (y la migración 0118)"],
    datos: { categorias: insuf },
  });

  return sortSignals(out);
}
