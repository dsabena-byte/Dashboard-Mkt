// Señales de WEB / ECOMMERCE (GA4). Sobre los reportes del snapshot (período actual vs
// anterior, canales, landings, ítems, serie mensual). Conversión: con ecommerce =
// transacciones/sesiones; sin ecommerce = eventos clave/sesiones. Por canal y por landing GA4
// solo trae eventos clave → la conversión por canal/sección es SIEMPRE por eventos clave.
// Puro: recibe los reportes ya leídos.
import type { WebReports, CompetitorWebData } from "./model";
import { webMonthlyArr, seccionDePath, esPaginaProducto } from "./model";
import { type Signal, sortSignals, median, sum, avg, deltaPct, fInt, fNum, fPct, fDelta, fMoney, clip, r2 } from "./types";

const num = (s?: string) => Number(s || 0);
const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Totales de un reporte cur/prev (índices de METRICS en ga4-reports).
export function webTotals(r: WebReports["cur"]) {
  const v = r.rows?.[0]?.metricValues ?? [];
  const at = (i: number) => num(v[i]?.value);
  const [users, sessions, pv, avgSession, bounce, tx, revenue, newUsers, ke] = [at(0), at(1), at(2), at(3), at(4), at(5), at(6), at(7), at(8)];
  return { users, sessions, pv, avgSession, bounce: bounce * 100, tx, revenue, newUsers, ke };
}
export function webChannels(r: WebReports) {
  return (r.chan.rows ?? []).map((x) => { const ses = num(x.metricValues[1]?.value), ke = num(x.metricValues[3]?.value); return { canal: x.dimensionValues[0]!.value, usuarios: num(x.metricValues[0]?.value), sesiones: ses, pageviews: num(x.metricValues[2]?.value), eventosClave: ke, conv: ses ? (ke / ses) * 100 : 0 }; });
}
export function webLandings(r: WebReports) {
  return (r.landing.rows ?? []).map((x) => { const ses = num(x.metricValues[0]?.value), ke = num(x.metricValues[2]?.value); return { path: x.dimensionValues[0]!.value, sesiones: ses, pageviews: num(x.metricValues[1]?.value), eventosClave: ke, conv: ses ? (ke / ses) * 100 : 0 }; });
}
export function webSections(r: WebReports) {
  const m = new Map<string, { sesiones: number; eventosClave: number }>();
  for (const l of webLandings(r)) { const k = seccionDePath(l.path); const a = m.get(k) ?? { sesiones: 0, eventosClave: 0 }; a.sesiones += l.sesiones; a.eventosClave += l.eventosClave; m.set(k, a); }
  return [...m.entries()].map(([seccion, a]) => ({ seccion, ...a, conv: a.sesiones ? (a.eventosClave / a.sesiones) * 100 : 0 })).sort((a, b) => b.sesiones - a.sesiones);
}
export function webItems(r: WebReports) {
  return (r.items.rows ?? []).map((x) => ({ nombre: x.dimensionValues[0]!.value, categoria: x.dimensionValues[1]?.value ?? "", vistos: num(x.metricValues[0]?.value), comprados: num(x.metricValues[1]?.value), ingresos: num(x.metricValues[2]?.value) })).filter((i) => i.vistos > 0 && i.nombre !== "(not set)");
}
// Sesiones por canal: últimos 7 días vs los 7 anteriores (del reporte diario del período).
export function webChannelTrend(r: WebReports): { canal: string; ult7: number; prev7: number; delta: number | null }[] {
  const rows = (r.chanDaily.rows ?? []).map((x) => ({ d: x.dimensionValues[0]!.value, canal: x.dimensionValues[1]!.value, ses: num(x.metricValues[0]?.value) }));
  const days = [...new Set(rows.map((x) => x.d))].sort();
  if (days.length < 14) return [];
  const last7 = new Set(days.slice(-7)), prev7 = new Set(days.slice(-14, -7));
  const m = new Map<string, { a: number; b: number }>();
  for (const x of rows) { const e = m.get(x.canal) ?? { a: 0, b: 0 }; if (last7.has(x.d)) e.a += x.ses; else if (prev7.has(x.d)) e.b += x.ses; m.set(x.canal, e); }
  return [...m.entries()].map(([canal, e]) => ({ canal, ult7: e.a, prev7: e.b, delta: deltaPct(e.a, e.b) })).sort((a, b) => b.ult7 - a.ult7);
}

export function computeWebSignals(reports: WebReports | null | undefined, opts?: { year?: number; now?: Date; periodo?: string; competitor?: CompetitorWebData | null }): Signal[] {
  const out: Signal[] = [];
  if (!reports) return opts?.competitor ? competitorWebSignals(opts.competitor) : out;
  const S = (s: Omit<Signal, "dash">) => out.push({ ...s, dash: "web" });
  const now = opts?.now ?? new Date();
  const year = opts?.year ?? now.getFullYear();
  const per = opts?.periodo ? ` (${opts.periodo})` : "";
  const c = webTotals(reports.cur), p = webTotals(reports.prev);
  const { arr, hasEcom } = webMonthlyArr(reports.monthly.rows, year);
  const ecom = hasEcom || c.tx > 0;
  const convOf = (t: typeof c) => (t.sessions ? ((ecom ? t.tx : t.ke) / t.sessions) * 100 : 0);
  const convLbl = ecom ? "% de visitas que terminan en compra (tasa de conversión: compras ÷ visitas)" : "% de visitas que terminan en una acción de negocio (tasa de conversión: eventos clave ÷ visitas)";

  // ── 1. Tráfico y conversión vs período anterior ──
  if (c.sessions > 0 && p.sessions > 0) {
    const d = deltaPct(c.sessions, p.sessions) ?? 0;
    if (d <= -15) S({
      key: "web_traffic_drop", tipo: "alerta", prioridad: d <= -30 ? "alta" : "media",
      titulo: `Las visitas a la web cayeron ${fDelta(d)} contra el período anterior${per} (sesiones)`,
      descripcion: `${fInt(c.sessions)} visitas contra ${fInt(p.sessions)} (personas distintas: ${fInt(c.users)} contra ${fInt(p.users)}). Hay que ver por dónde llegan menos.`,
      acciones: ["Mirá en el gráfico por canal por dónde llegan menos: Google sin pagar, avisos o redes", "Preguntale a la agencia si bajó la inversión en avisos, y fijate en el tablero SEO si bajaste en Google"],
      datos: { sesiones: c.sessions, sesionesPrevias: p.sessions, deltaPct: r2(d) },
      impacto: { metrica: "Sesiones perdidas", valor: Math.round(p.sessions - c.sessions), unidad: "sesiones" },
    });
    else if (d >= 20) S({
      key: "web_traffic_up", tipo: "info", prioridad: "baja",
      titulo: `Las visitas a la web crecieron ${fDelta(d)} contra el período anterior${per} (sesiones)`,
      descripcion: `${fInt(c.sessions)} contra ${fInt(p.sessions)}. Fijate que esas visitas también compren o consulten (que sean visitas de calidad).`,
      acciones: ["Confirmá por qué canal llegan las visitas nuevas", "Revisá que no caiga el % de visitas que terminan en compra o consulta (tasa de conversión)"],
      datos: { sesiones: c.sessions, sesionesPrevias: p.sessions, deltaPct: r2(d) },
    });
    const cc = convOf(c), cp = convOf(p);
    const dc = deltaPct(cc, cp);
    if (dc != null && cp > 0 && dc <= -15) S({
      key: "web_conversion_drop", tipo: "alerta", prioridad: dc <= -30 ? "alta" : "media",
      titulo: `Bajó ${fDelta(dc)} el ${convLbl.split(" (")[0]}: ${fPct(cc, 2)} contra ${fPct(cp, 2)}`,
      descripcion: `${convLbl}. Con el % anterior se habrían logrado ≈${fInt(((cp - cc) / 100) * c.sessions)} ${ecom ? "compras" : "consultas o acciones"} más en el período.`,
      acciones: ["Pedile al equipo web que revise el recorrido de compra (producto → carrito → pago) y si hay errores en el sitio", "Fijate si llegaron visitas de canales que casi no compran (gente con poco interés)", "Revisá precio y stock de los productos más vistos"],
      datos: { conv: r2(cc), convPrevia: r2(cp), deltaPct: r2(dc), ecommerce: ecom },
      impacto: { metrica: "Conversiones perdidas vs la tasa anterior", valor: Math.round(((cp - cc) / 100) * c.sessions), unidad: ecom ? "transacciones" : "eventos clave" },
    });
    else if (dc != null && cp > 0 && dc >= 15) S({
      key: "web_conversion_up", tipo: "info", prioridad: "baja",
      titulo: `Mejoró ${fDelta(dc)} el % de visitas que ${ecom ? "compran" : "consultan o compran"}: ${fPct(cc, 2)} contra ${fPct(cp, 2)} (tasa de conversión)`,
      descripcion: convLbl,
      acciones: ["Identificá qué lo explica (el canal, la página de entrada o la oferta) y seguí por ahí"],
      datos: { conv: r2(cc), convPrevia: r2(cp), deltaPct: r2(dc) },
    });
    if (ecom && c.tx > 0 && p.tx > 0) {
      const aov = c.revenue / c.tx, aovP = p.revenue / p.tx;
      const da = deltaPct(aov, aovP) ?? 0;
      if (da <= -15) S({
        key: "web_aov_drop", tipo: "alerta", prioridad: "media",
        titulo: `Cada compra online es ${fDelta(da)} más chica: ${fMoney(aov)} contra ${fMoney(aovP)} (ticket promedio)`,
        descripcion: `Ventas por ${fMoney(c.revenue)} en ${fInt(c.tx)} compras.`,
        acciones: ["Revisá qué productos se están vendiendo y qué promociones hay", "Probá combos de productos o envío gratis a partir de cierto monto"],
        datos: { aov: r2(aov), aovPrevio: r2(aovP), deltaPct: r2(da) },
        impacto: { metrica: "Ingresos perdidos por ticket", valor: Math.round((aovP - aov) * c.tx), unidad: "$" },
      });
    }
  }

  // ── 2. Medición: ecommerce / conversiones ausentes ──
  const productPages = (reports.pages.rows ?? []).filter((x) => esPaginaProducto(x.dimensionValues[0]!.value));
  if (!ecom && c.sessions > 0) {
    if (c.ke === 0) S({
      key: "web_no_conversions_tracked", tipo: "alerta", prioridad: "alta",
      titulo: "El sitio no registra conversiones (ni compras ni eventos clave)",
      descripcion: `${fInt(c.sessions)} sesiones en el período sin ningún evento clave marcado en GA4: no se puede medir qué canal o contenido genera negocio.`,
      acciones: ["En Google Analytics (GA4), marcar como conversión (evento clave) las acciones de negocio: formulario, WhatsApp, clic a tienda, compra", "Si hay tienda online, activar la medición de ventas de GA4 (ecommerce)"],
      datos: { sesiones: c.sessions },
    });
    else if (productPages.length >= 3) S({
      key: "web_ecommerce_absent", tipo: "oportunidad", prioridad: "media",
      titulo: `Hay ${productPages.length}+ páginas de producto pero GA4 no mide ecommerce`,
      descripcion: "Se mide conversión por eventos clave. Sin transacciones/ingresos no se puede calcular ROAS ni el valor por canal.",
      acciones: ["Pedirle al desarrollador que Analytics registre ver producto, agregar al carrito y comprar (eventos de ecommerce de GA4: view_item, add_to_cart, purchase)", "Si la venta es en retailers, contar los clics al botón de la tienda como conversión (evento clave)"],
      datos: { paginasProducto: productPages.length },
    });
  }

  // ── 3. Conversión por canal (eventos clave/sesión) ──
  const ch = webChannels(reports).filter((x) => x.sesiones > 0);
  const chTot = sum(ch.map((x) => x.sesiones));
  const chKe = sum(ch.map((x) => x.eventosClave));
  const siteConv = chTot ? (chKe / chTot) * 100 : 0;
  if (chTot > 0 && siteConv > 0) {
    for (const x of ch) {
      const sh = (x.sesiones / chTot) * 100;
      if (sh < 3) continue;
      if (x.conv >= siteConv * 1.5 && sh < 15) S({
        key: `web_channel_convert_${x.canal}`, tipo: "oportunidad", prioridad: "media",
        titulo: `Las visitas que llegan por ${x.canal} terminan en acción ${(x.conv / siteConv).toFixed(1)} veces más que el promedio (${fPct(x.conv, 2)}), pero son solo el ${fPct(sh, 0)} de las visitas`,
        descripcion: `${fInt(x.sesiones)} visitas y ${fInt(x.eventosClave)} acciones de negocio (eventos clave). Promedio del sitio: ${fPct(siteConv, 2)} (tasa de conversión).`,
        acciones: [`Escalá ${x.canal} (traé más visitas por ahí): más inversión, más contenido o publicar más seguido, según el canal`, "Usá el mismo mensaje de ese canal en los que menos convierten"],
        datos: { canal: x.canal, conv: r2(x.conv), convSitio: r2(siteConv), share: r2(sh) },
        impacto: { metrica: "Eventos clave adicionales con +20% de sesiones del canal", valor: Math.round(x.sesiones * 0.2 * (x.conv / 100)), unidad: "eventos clave" },
      });
      if (x.conv <= siteConv * 0.5 && sh >= 15) S({
        key: `web_channel_lowq_${x.canal}`, tipo: "alerta", prioridad: "media",
        titulo: `${x.canal} trae el ${fPct(sh, 0)} de las visitas pero solo el ${fPct(x.conv, 2)} termina en acción (${fPct((x.conv / siteConv) * 100, 0)} del promedio)`,
        descripcion: `Llega gente con poco interés, o la página donde aterrizan no tiene que ver con lo que prometía el aviso. Promedio del sitio: ${fPct(siteConv, 2)} (tasa de conversión).`,
        acciones: ["Revisá que la página de llegada (landing) diga lo mismo que el aviso o la publicación que trae a la gente", "Si son avisos pagos: pedile a la agencia que apunte a gente con ganas de comprar (segmentación y palabras de búsqueda)"],
        datos: { canal: x.canal, conv: r2(x.conv), convSitio: r2(siteConv), share: r2(sh) },
        impacto: { metrica: "Eventos clave si convirtiera al promedio", valor: Math.round(((siteConv - x.conv) / 100) * x.sesiones), unidad: "eventos clave" },
      });
    }
    const topCh = [...ch].sort((a, b) => b.sesiones - a.sesiones)[0];
    if (topCh && topCh.sesiones / chTot > 0.6) S({
      key: "web_channel_dependency", tipo: "alerta", prioridad: "baja",
      titulo: `La web depende de un solo canal: ${topCh.canal} trae el ${fPct((topCh.sesiones / chTot) * 100, 0)} de las visitas (tráfico)`,
      descripcion: "Si ese canal cambia sus reglas (algoritmo) o se corta la inversión, se mueve toda la web.",
      acciones: ["Sumá otras fuentes de visitas: posicionamiento en Google (SEO), mails y redes sin pauta"],
      datos: { canal: topCh.canal, share: r2((topCh.sesiones / chTot) * 100) },
    });
  }

  // ── 4. Tendencia por canal: últimos 7 días vs 7 previos ──
  for (const t of webChannelTrend(reports)) {
    const sh = chTot ? ((ch.find((x) => x.canal === t.canal)?.sesiones ?? 0) / chTot) * 100 : 0;
    if (t.delta == null || sh < 5 || t.prev7 < 50) continue;
    if (t.delta <= -30) S({
      key: `web_channel_drop_${t.canal}`, metrica: "sesiones", tipo: "alerta", prioridad: t.delta <= -50 ? "alta" : "media",
      titulo: `${t.canal}: las visitas cambiaron ${fDelta(t.delta)} en los últimos 7 días contra los 7 anteriores`,
      descripcion: `${fInt(t.ult7)} contra ${fInt(t.prev7)} visitas (sesiones).`,
      acciones: ["Preguntale a la agencia si se pausó una campaña, o fijate si bajaste en Google o se cayó un link", "Pedile al equipo web que revise que los links de ese canal estén bien marcados (etiquetas UTM)"],
      datos: t,
    });
    else if (t.delta >= 40) S({
      key: `web_channel_peak_${t.canal}`, tipo: "info", prioridad: "baja",
      titulo: `${t.canal}: las visitas subieron ${fDelta(t.delta)} en los últimos 7 días`,
      descripcion: `${fInt(t.ult7)} contra ${fInt(t.prev7)} visitas (sesiones). Confirmá de dónde vienen y si compran o consultan.`,
      acciones: ["Identificá qué campaña o publicación lo generó"],
      datos: t,
    });
  }

  // ── 5. Landings con mucho tráfico y baja conversión ──
  const land = webLandings(reports);
  const lTot = sum(land.map((l) => l.sesiones));
  const lConv = lTot ? (sum(land.map((l) => l.eventosClave)) / lTot) * 100 : 0;
  if (lTot > 0 && lConv > 0) {
    const leaks = land.filter((l) => l.sesiones >= Math.max(lTot * 0.01, 100) && l.conv <= lConv * 0.4)
      .map((l) => ({ ...l, perdidas: ((lConv - l.conv) / 100) * l.sesiones })).sort((a, b) => b.perdidas - a.perdidas).slice(0, 3);
    if (leaks.length) S({
      key: "web_landing_leak", tipo: "alerta", prioridad: sum(leaks.map((l) => l.sesiones)) / lTot >= 0.1 ? "alta" : "media",
      titulo: `${leaks.length} página${leaks.length > 1 ? "s" : ""} de entrada con muchas visitas donde casi nadie avanza: 40% o menos del promedio (landings)`,
      descripcion: leaks.map((l) => `${clip(l.path, 50)}: ${fInt(l.sesiones)} visitas, ${fPct(l.conv, 2)} termina en acción`).join(" · ") + `. Promedio: ${fPct(lConv, 2)}.`,
      acciones: ["Pedile al equipo web que revise que el botón principal se vea (llamado a la acción), que la página cargue rápido y que diga lo mismo que el aviso o la búsqueda que trae a la gente", "Sumar un camino claro al producto o al contacto"],
      datos: { convPromedio: r2(lConv), landings: leaks.map((l) => ({ path: l.path, sesiones: l.sesiones, conv: r2(l.conv) })) },
      impacto: { metrica: "Eventos clave si convirtieran al promedio", valor: Math.round(sum(leaks.map((l) => l.perdidas))), unidad: "eventos clave" },
    });
    // Secciones: mejor y peor conversión (≥ 5% de las sesiones).
    const secs = webSections(reports).filter((s) => s.sesiones / lTot >= 0.05);
    if (secs.length >= 3) {
      const best = [...secs].sort((a, b) => b.conv - a.conv)[0]!;
      if (best.conv >= lConv * 1.5) S({
        key: "web_section_best", tipo: "oportunidad", prioridad: "baja",
        titulo: `En la sección "${best.seccion}", el ${fPct(best.conv, 2)} de las visitas termina en acción: ${(best.conv / lConv).toFixed(1)} veces el promedio`,
        descripcion: `${fInt(best.sesiones)} visitas entraron por ahí. Es el mejor lugar para mandar a la gente desde los avisos y los links de redes.`,
        acciones: [`Pedile a la agencia y al equipo de redes que manden más gente a "${best.seccion}"`],
        datos: { secciones: secs.slice(0, 6).map((s) => ({ ...s, conv: r2(s.conv) })) },
      });
    }
  }

  // ── 6. Productos: muchas vistas y pocas (o ninguna) compras ──
  const items = webItems(reports);
  if (items.length >= 3 && sum(items.map((i) => i.comprados)) > 0) {
    const rate = (i: (typeof items)[number]) => (i.vistos ? (i.comprados / i.vistos) * 100 : 0);
    const medRate = median(items.map(rate));
    const weak = items.filter((i) => i.vistos >= Math.max(100, median(items.map((x) => x.vistos))) && rate(i) <= medRate * 0.3).slice(0, 3);
    if (weak.length) S({
      key: "web_products_no_purchase", tipo: "alerta", prioridad: "media",
      titulo: `${weak.length} producto${weak.length > 1 ? "s" : ""} que mucha gente mira pero casi nadie compra (30% o menos de lo normal)`,
      descripcion: weak.map((i) => `${clip(i.nombre, 40)}: ${fInt(i.vistos)} vistas, ${fInt(i.comprados)} compras`).join(" · ") + `. Lo normal: ${fPct(medRate, 2)} de las vistas terminan en compra.`,
      acciones: ["Revisá precio contra la competencia, stock y costo de envío", "Mejorá fotos, ficha técnica y opiniones de clientes", "Mostrá bien las cuotas y la financiación"],
      datos: { medianaVistaCompra: r2(medRate), productos: weak.map((i) => ({ ...i, tasa: r2(rate(i)) })) },
      impacto: { metrica: "Compras si convirtieran a la mediana", valor: Math.round(sum(weak.map((i) => i.vistos * (medRate / 100) - i.comprados))), unidad: "compras" },
    });
    const star = [...items].filter((i) => i.comprados >= 3).sort((a, b) => rate(b) - rate(a))[0];
    if (star && medRate > 0 && rate(star) >= medRate * 2) S({
      key: "web_product_star", tipo: "oportunidad", prioridad: "baja",
      titulo: `"${clip(star.nombre, 50)}": el ${fPct(rate(star), 2)} de los que lo miran lo compra (${(rate(star) / medRate).toFixed(1)} veces lo normal)`,
      descripcion: `${fInt(star.vistos)} vistas, ${fInt(star.comprados)} compras, ${fMoney(star.ingresos)} vendidos.`,
      acciones: ["Dale más lugar: en la home, en avisos de catálogo y en redes", "Usalo como producto gancho en las campañas"],
      datos: { ...star, tasa: r2(rate(star)) },
      impacto: { metrica: "Compras adicionales con +50% de vistas", valor: Math.round(star.comprados * 0.5), unidad: "compras" },
    });
  } else if (items.length >= 3 && ecom) {
    const top = items.slice(0, 3);
    S({
      key: "web_products_views_only", metrica: "transacciones", tipo: "alerta", prioridad: "media",
      titulo: "Los productos más vistos no tienen ninguna compra registrada en el período",
      descripcion: top.map((i) => `${clip(i.nombre, 40)}: ${fInt(i.vistos)} vistas`).join(" · ") + ". Puede ser un problema de medición más que de ventas.",
      acciones: ["Pedile al equipo web que verifique que, al comprar, Analytics registre qué productos se compraron (evento purchase con ítems)", "Que revise que el paso de pago (checkout) funcione"],
      datos: { productos: top },
    });
  }

  // ── 7. Serie mensual: último mes cerrado vs promedio de los 3 previos ──
  const closedIdx = arr.trafico.map((v, i) => (v != null && (year < now.getFullYear() || i < now.getMonth()) ? i : -1)).filter((i) => i >= 0);
  if (closedIdx.length >= 4) {
    const li = closedIdx[closedIdx.length - 1]!, base = closedIdx.slice(-4, -1);
    const mean = (k: keyof typeof arr) => avg(base.map((i) => arr[k][i] ?? 0));
    const dT = deltaPct(arr.trafico[li] ?? 0, mean("trafico")) ?? 0;
    if (dT <= -20) S({
      key: "web_monthly_traffic_drop", tipo: "alerta", prioridad: "media",
      titulo: `${MES[li]}: ${fDelta(dT)} personas visitaron la web contra el promedio de los 3 meses anteriores (usuarios)`,
      descripcion: `${fNum(arr.trafico[li] ?? 0)} contra ${fNum(mean("trafico"))}.`,
      acciones: ["Compará con la inversión en avisos de ese mes y con tu lugar en Google (tablero SEO)"],
      datos: { mes: MES[li], usuarios: arr.trafico[li], promedio3m: Math.round(mean("trafico")), deltaPct: r2(dT) },
    });
    const dC = deltaPct(arr.conversion[li] ?? 0, mean("conversion"));
    if (dC != null && dC <= -20) S({
      key: "web_monthly_conv_drop", tipo: "alerta", prioridad: "media",
      titulo: `${MES[li]}: el % de visitas que termina en compra o consulta cambió ${fDelta(dC)} contra los 3 meses anteriores (${fPct(arr.conversion[li] ?? 0, 2)} — tasa de conversión)`,
      descripcion: `Promedio anterior: ${fPct(mean("conversion"), 2)}.`,
      acciones: ["Preguntá si ese mes hubo cambios en la web o en los precios, y mirá si cambió de dónde llegan las visitas"],
      datos: { mes: MES[li], conv: r2(arr.conversion[li] ?? 0), promedio3m: r2(mean("conversion")), deltaPct: r2(dC) },
    });
  }

  if (opts?.competitor) out.push(...competitorWebSignals(opts.competitor));
  return sortSignals(out);
}

// ── Competencia web (SimilarWeb vía Apify) ──────────────────────────────────
// OJO: las visitas de SimilarWeb son ESTIMACIONES de panel, no las sesiones de tu GA4. Por eso
// se compara a la competencia entre sí (misma medición para todas las marcas, incluida la tuya
// si cargaste tu sitio) y tu tendencia contra la de ellos — nunca visitas SimilarWeb vs sesiones GA4.
export function competitorWebSignals(cw: CompetitorWebData | null | undefined): Signal[] {
  const out: Signal[] = [];
  const doms = (cw?.domains ?? []).filter((d) => d.visitas > 0 || d.monthly?.length);
  if (doms.length < 2) return out;
  const S = (s: Omit<Signal, "dash">) => out.push({ ...s, dash: "web" });
  const own = doms.find((d) => d.own);
  const rivals = doms.filter((d) => !d.own);
  const nota = "Visitas estimadas por SimilarWeb (la misma medición para todas las marcas; no se comparan con las visitas que mide tu Google Analytics).";
  const mon = (d: (typeof doms)[number]) => [...(d.monthly ?? [])].filter((m) => m.visitas > 0).sort((a, b) => a.mes.localeCompare(b.mes));
  const growth3 = (d: (typeof doms)[number]): number | null => { const m = mon(d); if (m.length < 4) return null; const a = m[m.length - 4]!.visitas, b = m[m.length - 1]!.visitas; return a > 0 ? ((b - a) / a) * 100 : null; };

  // 1. Tu tendencia de visitas vs la de la competencia (3 meses).
  if (own && rivals.length >= 1) {
    const gOwn = growth3(own);
    const gRiv = rivals.map(growth3).filter((v): v is number => v != null);
    if (gOwn != null && gRiv.length) {
      const medG = median(gRiv);
      if (gOwn <= medG - 15) S({
        key: "web_comp_trend_behind", tipo: "alerta", prioridad: gOwn < 0 && medG > 0 ? "alta" : "media",
        titulo: `Tus visitas cambiaron ${fDelta(gOwn)} en 3 meses; las de la competencia típica, ${fDelta(medG)}`,
        descripcion: `${nota} La competencia está sumando visitas más rápido que vos.`,
        acciones: ["Mirá en el tablero SEO si bajaste en Google o te buscan menos (share of search)", "Fijate de dónde le llegan las visitas a quien más crece (Google, redes, avisos)"],
        datos: { propio: r2(gOwn), medianaCompetencia: r2(medG), competidores: rivals.map((d) => ({ marca: d.marca, crecimiento3m: growth3(d) == null ? null : r2(growth3(d)!) })) },
      });
      else if (gOwn >= medG + 15 && gOwn > 0) S({
        key: "web_comp_trend_ahead", tipo: "info", prioridad: "baja",
        titulo: `Tus visitas crecen ${fDelta(gOwn)} en 3 meses, más que la competencia (${fDelta(medG)})`,
        descripcion: nota,
        acciones: ["Identificá qué canal explica el crecimiento y seguí por ahí"],
        datos: { propio: r2(gOwn), medianaCompetencia: r2(medG) },
      });
    }
    // Share de visitas del set (último mes vs 3 meses antes).
    const shareAt = (off: number) => {
      const meses = mon(own).map((m) => m.mes);
      const mes = meses[meses.length - 1 - off];
      if (!mes) return null;
      const vals = doms.map((d) => mon(d).find((m) => m.mes === mes)?.visitas ?? null);
      if (vals.some((v) => v == null)) return null;
      const tot = sum(vals as number[]);
      return tot > 0 ? { mes, share: ((mon(own).find((m) => m.mes === mes)!.visitas) / tot) * 100 } : null;
    };
    const sNow = shareAt(0), sPrev = shareAt(3);
    if (sNow && sPrev && Math.abs(sNow.share - sPrev.share) >= 3) S({
      key: sNow.share < sPrev.share ? "web_comp_share_down" : "web_comp_share_up", tipo: sNow.share < sPrev.share ? "alerta" : "info", prioridad: sNow.share < sPrev.share ? "media" : "baja",
      titulo: `Tu parte de las visitas entre las webs de la competencia ${sNow.share < sPrev.share ? "cayó" : "subió"} ${Math.abs(sNow.share - sPrev.share).toFixed(1)} puntos (${fPct(sPrev.share, 1)} → ${fPct(sNow.share, 1)})`,
      descripcion: `${sPrev.mes} → ${sNow.mes}. Tu parte = tus visitas ÷ las visitas de todas las marcas comparadas. ${nota}`,
      acciones: sNow.share < sPrev.share ? ["Compará con cuánto te buscan en Google (share of search) y con tu inversión de ese período"] : ["Mantené lo que explica la suba"],
      datos: { desde: sPrev, hasta: sNow },
    });
  }

  // 2. Calidad del tráfico: rebote / páginas por visita vs la competencia.
  const withQ = doms.filter((d) => d.bounce_rate > 0);
  if (own && own.bounce_rate > 0 && withQ.length >= 3) {
    const b = (d: (typeof doms)[number]) => (d.bounce_rate <= 1 ? d.bounce_rate * 100 : d.bounce_rate);
    const medB = median(withQ.filter((d) => !d.own).map(b));
    const rank = [...withQ].sort((x, y) => b(x) - b(y)).findIndex((d) => d.own) + 1;
    if (b(own) >= medB + 8) S({
      key: "web_comp_bounce_high", tipo: "alerta", prioridad: "media",
      titulo: `El ${fPct(b(own), 0)} de las visitas se va de tu web sin mirar nada más (rebote): puesto ${rank} de ${withQ.length}; en la competencia típica, ${fPct(medB, 0)}`,
      descripcion: `Páginas que mira cada visita: vos ${own.pages_per_visit.toFixed(1)}, la competencia típica ${median(withQ.filter((d) => !d.own).map((d) => d.pages_per_visit)).toFixed(1)}. ${nota}`,
      acciones: ["Pedile al equipo web que revise la velocidad y lo primero que se ve en las páginas por donde más gente entra", "Que la página de llegada diga lo mismo que el aviso que trae a la gente"],
      datos: { rebotePropio: r2(b(own)), medianaCompetencia: r2(medB), ranking: withQ.map((d) => ({ marca: d.marca, rebote: r2(b(d)), paginasPorVisita: r2(d.pages_per_visit), duracion: r2(d.avg_visit_duration) })) },
    });
    else if (rank === 1) S({
      key: "web_comp_quality_leader", tipo: "info", prioridad: "baja",
      titulo: `Tu web es la que menos gente pierde apenas entra, entre la competencia (${fPct(b(own), 0)} de rebote)`,
      descripcion: `La competencia típica: ${fPct(medB, 0)}. ${nota}`,
      acciones: ["Aprovechalo: mandá más gente desde avisos y redes a las páginas de llegada actuales"],
      datos: { rebotePropio: r2(b(own)), medianaCompetencia: r2(medB) },
    });
  }

  // 3. Un competidor crece rápido (último mes o 3 meses).
  for (const d of rivals) {
    const g = growth3(d);
    const mom = d.delta_mom;
    if ((mom != null && mom >= 30) || (g != null && g >= 40)) S({
      key: `web_comp_growing_${d.marca}`.replace(/\s+/g, "_"), tipo: "alerta", prioridad: (mom ?? 0) >= 50 || (g ?? 0) >= 80 ? "media" : "baja",
      titulo: `A la web de ${d.marca} le crecen rápido las visitas${mom != null && mom >= 30 ? ` (${fDelta(mom)} el último mes)` : ""}${g != null && g >= 40 ? ` (${fDelta(g)} en 3 meses)` : ""}`,
      descripcion: `${fNum(d.visitas)} visitas estimadas. De dónde llegan: ${d.fuentes ? Object.entries(d.fuentes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v <= 1 ? fPct(v * 100, 0) : fPct(v, 0)}`).join(", ") : "sin dato"}. ${nota}`,
      acciones: [`Mirá en Redes y en SEO qué está haciendo ${d.marca} (campaña, lanzamiento, promoción)`, "Seguí cuánto te buscan en Google (share of search) las próximas semanas"],
      datos: { marca: d.marca, visitas: d.visitas, deltaMensualPct: mom == null ? null : r2(mom), crecimiento3mPct: g == null ? null : r2(g) },
    });
  }
  return out;
}
