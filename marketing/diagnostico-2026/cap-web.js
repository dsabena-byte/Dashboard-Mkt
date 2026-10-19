// Capítulo 4 — Web y ecosistema digital. Datos: datos/web.json.
const L = require('./lib');
const D = require('./datos/web.json');
const S = Object.fromEntries(D.series.map((s) => [s.id, s]));
const T = Object.fromEntries(D.tablas.map((t) => [t.id, t]));
const col = (t, c) => T[t].columnas.indexOf(c);
const filas = (t) => T[t].filas;
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const K = (v) => (v == null ? null : Math.round(v / 1000));
const SEC = 'Web';
const F_GA = 'Fuente: GA4 drean.com.ar (web_traffic, web_monthly_by_channel, ga4_purchases_daily).';
const NOTA = '† Oct parcial (1–17 oct). * Sin datos (mes futuro). Sin comparación con 2025: el tracking actual arranca el 26-nov-2025.';

module.exports = function capWeb(ctx) {
  const { pres } = ctx;
  pres.addSection({ title: SEC });
  let s = pres.addSlide({ masterName: 'SECCION', sectionTitle: SEC });
  s.addText('Capítulo 4', { placeholder: 'num' });
  s.addText('Web y ecosistema digital', { placeholder: 'title' });
  s.addText('El tráfico se multiplicó por 5, pero casi la mitad viene de pauta de alcance que no compra. La venta la sostienen la búsqueda, el directo y PMax; el celular es el cuello de botella.', { placeholder: 'sub' });

  // 1. Usuarios y sesiones
  s = L.contenido(ctx, { seccion: SEC, kicker: 'TRÁFICO · USUARIOS Y SESIONES POR MES',
    titulo: 'Los usuarios del sitio se multiplicaron por 5,3 entre enero y septiembre (105 mil → 562 mil), con picos en mayo y septiembre',
    fuente: `${F_GA} Miles. Usuarios de septiembre validados contra el Seguimiento (562.088). ${NOTA}` });
  L.linea(ctx, s, { series: [{ name: 'Sesiones (miles)', values: S.A_sesiones_wt.meses2026.map(K), color: L.P.sky }, { name: 'Usuarios (miles)', values: S.A_usuarios.meses2026.map(K) }] });
  L.lectura(ctx, s, { interpretacion: 'El salto es desde abril, cuando arranca la pauta de tráfico (Meta, Demand Gen, TikTok). El 82–94% de los usuarios es nuevo todos los meses.',
    implicancia: 'Crecer en usuarios no es por sí solo un buen resultado: hay que mirar de qué canal vienen y si compran (siguientes slides).', confianza: 'alta' });

  // 2. Sesiones por canal
  const can = [['Paid Social', 'B_ses_paid_social', L.P.accent], ['Demand Gen', 'B_ses_demand_gen', 'FDBA74'], ['PMax', 'B_ses_cross-network_pmax', L.P.sky],
    ['Paid Search', 'B_ses_paid_search', L.P.blue], ['Búsqueda orgánica', 'B_ses_organic_search', L.P.navy], ['Directo', 'B_ses_direct', '0D9488']];
  const otros = L.MESES.map((_, i) => { const tot = S.A_sesiones_wt.meses2026[i]; if (tot == null) return null; return K(tot - can.reduce((a, c) => a + (S[c[1]].meses2026[i] || 0), 0)); });
  s = L.contenido(ctx, { seccion: SEC, kicker: 'TRÁFICO · SESIONES POR CANAL',
    titulo: 'Desde abril, la pauta de alcance (Paid Social + Demand Gen) aporta la mitad de las visitas; antes pesaba menos del 5%',
    fuente: `${F_GA} Canal por UTM de sesión (agrupación del tablero). Miles de sesiones. ${NOTA}` });
  L.barras(ctx, s, { labels: L.etiquetasMes([S.A_sesiones_wt.meses2026]), apilado: true, valores: false, series: [
    ...can.map(([n, id, c]) => ({ name: n, values: S[id].meses2026.map(K), color: c })), { name: 'Otros', values: otros, color: L.P.light }] });
  L.lectura(ctx, s, { interpretacion: 'Paid Social pasó de 6.750 sesiones (ene) a 237.545 (sep); dentro de él, TikTok de 12 mil (jul) a 123 mil (sep). La búsqueda orgánica se mantiene en 30–40 mil todo el año.',
    implicancia: 'El "Tráfico web" del Seguimiento crece sobre todo por compra de clicks de alcance: separarlo del tráfico con intención antes de usarlo como KPI.', confianza: 'alta' });

  // 3. Share sesiones vs share compras
  const bc = filas('B_canales_ytd').slice(0, 9), bcc = (n) => col('B_canales_ytd', n);
  s = L.contenido(ctx, { seccion: SEC, kicker: 'CONVERSIÓN · PARTICIPACIÓN EN VISITAS VS EN COMPRAS (ENE–SEP)',
    titulo: 'Paid Social y Demand Gen suman el 48% de las visitas y el 0,5% de las compras; Paid Search, Directo, Orgánico y PMax hacen el 93% de las ventas',
    fuente: `${F_GA} Compras atribuidas last-click por UTM de sesión: no mide el efecto indirecto (view-through) de la pauta de alcance. Ene–sep: 3.805 compras, $3.462M.` });
  L.barras(ctx, s, { labels: bc.map((f) => f[0]), horizontal: true, fmt: '0.0', series: [
    { name: '% de las sesiones', values: bc.map((f) => f[bcc('share ses %')]), color: L.P.gray }, { name: '% de las compras', values: bc.map((f) => f[bcc('share compras %')]) }] });
  L.lectura(ctx, s, { interpretacion: 'Paid Search: 11% de las visitas y 32,6% de las compras (conversión 0,31%). Paid Social: 26,4% de las visitas y 17 compras. Las visitas de alcance duran 83 s y ven 1,0–1,3 páginas; las de búsqueda, 208–245 s y 2,2–2,5 páginas.',
    implicancia: 'Proteger Search de marca y PMax. Medir la pauta de alcance por su objetivo (atención, recordación), no por visitas al sitio.', confianza: 'alta (atribución last-click)' });

  // 4. Índice sesiones vs compras
  const idx = (arr) => arr.map((v) => (v == null ? null : Math.round(v / arr[0] * 100)));
  s = L.contenido(ctx, { seccion: SEC, kicker: 'CONVERSIÓN · EVOLUCIÓN DE VISITAS Y COMPRAS (ÍNDICE ENERO = 100)',
    titulo: 'Las visitas crecieron ×4,8 y las compras no las acompañaron: septiembre sumó 60% más sesiones que agosto y 38% menos compras',
    fuente: `${F_GA} Índice base enero = 100. Compras = transacciones de ga4_purchases_daily. ${NOTA}` });
  L.linea(ctx, s, { series: [{ name: 'Sesiones', values: idx(S.A_sesiones_wt.meses2026), color: L.P.sky }, { name: 'Compras', values: idx(S.A_compras.meses2026) }], unidad: 'índice (ene = 100)' });
  L.lectura(ctx, s, { interpretacion: 'Compras por mes: 346 (ene), 610 (may, Hot Sale), 254 (jun, mínimo), 679 (ago, máximo), 418 (sep). Ingresos ene–sep: $3.462M; octubre ya lleva 417 compras en 17 días.',
    implicancia: 'La venta online no responde al volumen de visitas sino a eventos y a demanda con intención. Planificar la pauta de conversión alrededor del calendario comercial.', confianza: 'alta' });

  // 5. Tasa de conversión total vs intención
  s = L.contenido(ctx, { seccion: SEC, kicker: 'CONVERSIÓN · TASA DE COMPRA DEL SITIO',
    titulo: 'La conversión no cayó: se infló el denominador. Sin la pauta de alcance, el sitio convierte estable entre 0,14% y 0,30%',
    fuente: `${F_GA} Tasa = compras ÷ sesiones. "Sin pauta de alcance" excluye Paid Social, Demand Gen, Display y Paid Video. ${NOTA}` });
  L.linea(ctx, s, { series: [{ name: 'Total del sitio', values: S.A_tasa_conversion.meses2026.map(r2), color: L.P.gray }, { name: 'Sin pauta de alcance', values: S.A_tasa_conv_intencion.meses2026.map(r2) }], unidad: '% de sesiones con compra', fmt: '0.00' });
  L.lectura(ctx, s, { interpretacion: 'El total cae de 0,23% (ene) a 0,06% (sep) solo por la mezcla. En septiembre Paid Search duplicó sesiones (107 mil) con menor conversión (0,13% vs 0,46% en agosto): se sumó una capa nueva de Search de la agencia.',
    implicancia: 'Revisar las keywords de la capa de Search de septiembre: más sesiones con −71% de conversión (hipótesis: menos términos de marca, sin verificar).', confianza: 'alta (total); baja (causa de septiembre)' });

  // 6. Hot Sale
  const ed = filas('E_diario_2026'), ec = (n) => col('E_diario_2026', n);
  const may = ed.filter((f) => f[0].startsWith('2026-05'));
  s = L.contenido(ctx, { seccion: SEC, kicker: 'VENTA · COMPRAS DIARIAS, MAYO',
    titulo: 'El Hot Sale (11–13 de mayo) hizo 343 compras en 3 días, el 56% de las ventas del mes',
    fuente: 'Fuente: GA4 (ga4_purchases_daily), compras por día de mayo 2026. La campaña "hot-sale-2026" aparece en los UTM de las compras.' });
  L.barras(ctx, s, { labels: may.map((f) => f[0].slice(8, 10)), valores: false, series: [{ name: 'Compras por día', values: may.map((f) => f[ec('compras')]) }] });
  L.lectura(ctx, s, { interpretacion: 'Pico de 148 compras el 11-may ($307M en 3 días). Fuera de eventos la venta es plana (250–680 compras por mes). El ticket medio subió de $780.536 (ene) a $1.026.260 (sep), +31% nominal.',
    implicancia: 'El calendario promocional mueve más la venta online que el tráfico pagado. Concentrar la pauta de conversión y el stock web en Hot Sale, Cyber Monday (nov) y Día de la Madre.', confianza: 'alta' });

  // 7. Categorías
  const ccat = [['Lavado', 'C_share_lavado', L.P.navy], ['Refrigeración', 'C_share_refrig', L.P.blue], ['Cocinas', 'C_share_cocina', L.P.accent], ['Home', 'C_share_home', L.P.sky], ['Otros', 'C_share_otros', L.P.gray]];
  s = L.contenido(ctx, { seccion: SEC, kicker: 'CATEGORÍAS · PARTICIPACIÓN EN LAS SESIONES DE ENTRADA',
    titulo: 'Lavado domina el tráfico (32–44%); Refrigeración fue la que más creció (×5,7) y Cocinas tuvo su pico en marzo con PMax',
    fuente: `Fuente: GA4 (web_daily_by_category), categoría de la página de entrada. Lavavajillas (<2%) incluido en Otros. ${NOTA}` });
  L.barras(ctx, s, { labels: L.etiquetasMes([S.C_share_lavado.meses2026]), apilado: true, pct: true, valores: false, series: ccat.map(([n, id, c]) => ({ name: n, values: S[id].meses2026, color: c })) });
  L.lectura(ctx, s, { interpretacion: 'Refrigeración: 26 mil sesiones (ene) → 150 mil (sep). Cocinas: 35,8% en marzo (campaña PMax de cocinas, 54 mil sesiones). Lavado cae al 19% en octubre al terminar TikTok lavado.',
    implicancia: 'Por ingresos manda Lavarropas (36,4%) y Lavasecarropas es la #2 (15,3%), pero su tráfico cayó de 69 mil (jun) a 14 mil (sep): revisar el mix de pauta.', confianza: 'media-alta' });

  // 8. PDP: más visitadas vs más vendidas (tabla)
  const pdp = filas('D_top_pdp_ytd').slice(0, 7), it = filas('D_top_items_vendidos');
  // Unidades de las 7 PDP más visitadas: ga4_items_daily ene–sep (cálculo del análisis web, hallazgo 4; varias quedan fuera del top 20 de D_top_items_vendidos).
  const UND_PDP = { LSCDR1208SG0: 2, DTP469LKRSS0: 26, CD5617AI0: 64, LFDR1114ISG0: 28, LPDR1165LG: 34, DSP480LKRSS0: 22, CD7609EI: 17 };
  const und = (sku) => UND_PDP[sku] ?? '—';
  const top4 = [...it].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sesDe = (nombre) => { const f = filas('D_top_pdp_ytd').find((x) => nombre.includes(x[0])); return f ? f[2] : '—'; };
  s = L.contenido(ctx, { seccion: SEC, kicker: 'PRODUCTOS · PÁGINAS MÁS VISITADAS VS PRODUCTOS MÁS VENDIDOS (ENE–SEP)',
    titulo: 'Las 7 páginas de producto más visitadas sumaron 767 mil sesiones y 193 unidades vendidas; los 4 productos más vendidos entraron con 32 mil',
    fuente: 'Fuente: GA4 (web_landing_daily: sesiones de entrada a la página del producto; ga4_items_daily: unidades vendidas, cubre ~71% de los ingresos). No se puede cruzar página con canal.' });
  L.tabla(ctx, s, { area: { x: 0.5, y: 1.7, w: 8.6 }, anchos: [5.2, 1.7, 1.7],
    cols: ['Producto', 'Sesiones de entrada', 'Unidades vendidas'],
    filas: [...pdp.map((f) => [f[1].replace(/-/g, ' ').replace(/ Drean.*$/, '').slice(0, 62), f[2], und(f[0])]),
      ['Más vendidos ↓', '', ''], ...top4.map((f) => [f[0].replace(/ Drean.*$/, '').slice(0, 62), sesDe(f[0]), f[1]])], fontSize: 10 });
  L.lectura(ctx, s, { interpretacion: 'El lavasecarropas LSCDR1208SG0 tuvo 170 mil sesiones y vendió 2 unidades; el LSCDR1106I vendió 114 con 9.500 sesiones. Las páginas más empujadas concentraron su tráfico en abr–jun, cuando corrían las campañas de tráfico de OMD.',
    implicancia: 'Si el objetivo de la pauta de tráfico es vender, dirigirla a los SKUs que convierten. Si es instalar productos héroe, no evaluarla por sesiones del sitio.', confianza: 'media (la relación con la pauta es temporal)' });

  // 9. Embudo mobile vs desktop
  const em = filas('A_embudo_28d').filter((f) => f[0] === 'cur' && f[1] !== 'all'), emc = (n) => col('A_embudo_28d', n);
  const pasos = [['Agrega al carrito / vista', 'atc/view %'], ['Inicia checkout / carrito', 'checkout/atc %'], ['Carga pago / checkout', 'pago/checkout %'], ['Compra / pago', 'compra/pago %']];
  s = L.contenido(ctx, { seccion: SEC, kicker: 'EMBUDO · CELULAR VS ESCRITORIO (ÚLTIMOS 28 DÍAS)',
    titulo: 'En celular está el 82% de las vistas de producto pero se compra 6 veces menos que en escritorio (0,14% vs 0,92%)',
    fuente: 'Fuente: GA4 (web_calidad_snapshot), foto del 20-sep al 17-oct-2026. Solo hay dos ventanas de 28 días: no hay serie mensual del embudo.' });
  L.barras(ctx, s, { labels: pasos.map((p) => p[0]), fmt: '0.0', series: em.map((f, i) => ({ name: f[1] === 'mobile' ? 'Celular' : 'Escritorio', values: pasos.map((p) => f[emc(p[1])]), color: i ? L.P.gray : L.P.navy })) });
  L.lectura(ctx, s, { interpretacion: 'El paso más débil del sitio es de checkout a carga del pago (29,5%). En celular, además, solo el 58% de los que cargan el pago termina comprando (91% en escritorio). La conversión en celular bajó de 0,22% a 0,14% frente a los 28 días previos.',
    implicancia: 'Auditar la experiencia de pago en celular (medios de pago, cuotas, formulario): es la palanca de venta más directa del canal propio. La causa es hipótesis: no hay datos de errores.', confianza: 'media (dos ventanas)' });

  // 10. Campañas vs tráfico (tabla)
  const ev = filas('E_ventanas_campana'), evc = (n) => col('E_ventanas_campana', n);
  s = L.contenido(ctx, { seccion: SEC, kicker: 'CAMPAÑAS · QUÉ PASÓ EN EL SITIO DURANTE CADA CAMPAÑA',
    titulo: 'Las campañas de agosto a octubre multiplicaron las visitas del día, pero no movieron la búsqueda orgánica, el directo ni las compras',
    fuente: 'Fuente: GA4 diario (E_diario_2026) y API de Meta (gasto diario). Promedio por día en la ventana de la campaña vs el período previo de igual duración. Coincidencia temporal, no causalidad.' });
  L.tabla(ctx, s, { area: { x: 0.5, y: 1.7, w: 12.3 }, anchos: [3.4, 1.4, 1.4, 1.1, 1.25, 1.25, 1.25, 1.25], heat: [3],
    cols: ['Campaña (ventana)', 'Sesiones/día', 'Previo', 'Var. %', 'Orgánico/día (previo)', 'Directo/día (previo)', 'Compras/día (previo)', 'Gasto Meta/día M$'],
    filas: ev.map((f) => [f[0], Math.round(f[evc('ses/día ventana')]), Math.round(f[evc('ses/día período previo')]), r1(f[evc('var %')]),
      `${f[evc('organic search/día ventana')]} (${f[evc('organic/día previo')]})`, `${f[evc('direct/día ventana')]} (${f[evc('direct/día previo')]})`,
      `${f[evc('compras/día ventana')]} (${f[evc('compras/día previo')]})`, r1(f[evc('gasto Meta/día ventana')] / 1e6)]), fontSize: 11 });
  s.addText([{ text: 'Sesiones y compras atribuidas por UTM: ', options: { bold: true } },
    { text: 'TikTok lavado 104.620 sesiones y 0 compras · Mickey/"Nueva Era" 49.730 y 1 · Marcelino 30.685 y 0 · Casa FOA 10.030 y 0. El único indicio de efecto de marca es el directo durante el teaser Mickey (684 → 1.113 por día). Si estas campañas son de branding, su KPI no debería ser el tráfico web; si se espera tráfico, falta un destino que convierta.' }],
  { isTextBox: true, objectName: 'campNota', x: 0.5, y: 4.4, w: 12.3, h: 1.8, fontSize: 13, color: ctx.C.text1, valign: 'top', margin: 0 });

  // 11. Calidad de la visita
  s = L.contenido(ctx, { seccion: SEC, kicker: 'CALIDAD · PÁGINAS POR SESIÓN',
    titulo: 'La visita promedio se acortó al entrar la pauta de tráfico: de 1,88 a 1,57 páginas y de 163 a 129 segundos (ene → sep)',
    fuente: `${F_GA} El "engagement rate" de GA4 da 97–99% todos los meses: no discrimina (probable configuración del tag, sin verificar). ${NOTA}` });
  L.linea(ctx, s, { series: [{ name: 'Páginas por sesión', values: S.A_pv_por_sesion.meses2026.map(r2) }], fmt: '0.0' });
  L.lectura(ctx, s, { interpretacion: 'Es efecto mezcla: los canales de intención mantienen su calidad (búsqueda orgánica: 2,2 páginas y 245–261 s). La home como página de entrada bajó de 4,24 a 2,03 páginas por sesión.',
    implicancia: 'Reportar la calidad por canal, no el promedio del sitio. Revisar la configuración de engagement de GA4 antes de fijar metas 2027.', confianza: 'alta' });

  // 12. Share of search
  s = L.contenido(ctx, { seccion: SEC, kicker: 'COMPETENCIA · SHARE OF SEARCH DE DREAN POR CATEGORÍA',
    titulo: 'Drean lidera la búsqueda de lavarropas (41,8%, más del doble que Samsung) y crece en cocinas; en heladeras está 12 puntos debajo del líder',
    fuente: 'Fuente: Google Ads Keyword Planner (search_volume / vw_share_of_search): búsquedas de la marca ÷ búsquedas del set competitivo. Es dato de búsquedas, no de ventas. Llega hasta agosto. * Sin datos.' });
  L.linea(ctx, s, { series: [{ name: 'Lavarropas', values: S.F_sos_lava_drean.meses2026 }, { name: 'Cocinas', values: S.F_sos_coci_drean.meses2026, color: L.P.accent }, { name: 'Heladeras', values: S.F_sos_hela_drean.meses2026, color: L.P.sky }],
    unidad: '% de las búsquedas', fmt: '0', etiquetas: L.MESES.map((m, i) => (i > 7 ? m + '*' : m)) });
  L.lectura(ctx, s, { interpretacion: 'Agosto: lavarropas 41,8% (Samsung 18,7%, Whirlpool 10,2%; ago-2025: 42,8%). Cocinas 12,9% (11,6% en ago-2025), pico de 15,2% en julio empatado con Electrolux. Heladeras 9,7% (8,2% en ago-2025) vs Samsung y Whirlpool 21,7%.',
    implicancia: 'Heladeras es la oportunidad de demanda más grande. Es también la categoría con más inversión de pauta en el segundo semestre: seguir si el share acompaña.', confianza: 'media (los volúmenes de Google Ads vienen redondeados)' });

  // 13. SimilarWeb
  const sw = filas('F_similarweb_benchmark').filter((f) => !f[0].startsWith('Samsung')).sort((a, b) => b[2] - a[2]), swc = (n) => col('F_similarweb_benchmark', n);
  s = L.contenido(ctx, { seccion: SEC, kicker: 'COMPETENCIA · VISITAS A SITIOS DE FABRICANTES (SIMILARWEB, SEPTIEMBRE)',
    titulo: 'drean.com.ar es el sitio de fabricante más visitado (338 mil, 1,8 veces el segundo) y el que más creció, pero el de menos páginas por visita',
    fuente: 'Fuente: SimilarWeb (competitor_web), estimación de panel, misma fuente para todas las marcas. Samsung (sitio global) excluido. Miles de visitas.' });
  L.barras(ctx, s, { labels: sw.map((f) => f[0].replace(/ \(.*\)$/, '')), horizontal: true, series: [{ name: 'Visitas sep (miles)', values: sw.map((f) => K(f[2])) }] });
  L.lectura(ctx, s, { interpretacion: 'Jul–sep vs abr–jun: Drean +37,8%, Electrolux +14,9%, Gafa −7,0%, Newsan −22,2%, Whirlpool −25,8%. Páginas por visita: Drean 2,11, la más baja (Newsan 3,44). Electrolux y Gafa traen 6–7% por email; Drean 0,4%.',
    implicancia: 'Drean lidera en atención web entre fabricantes. Hay margen en email/CRM y en la profundidad de la visita.', confianza: 'media (estimación de panel)' });

  // 14. SEO
  const sr = filas('F_seo_rankings').filter((f) => f[0] === '2026-09-01' && ['Drean', 'Whirlpool', 'ML', 'Frávega'].includes(f[2]));
  const catsSeo = ['lavarropas', 'heladeras', 'cocinas'];
  const marcaSeo = ['Drean', 'Whirlpool', 'ML', 'Frávega'];
  s = L.contenido(ctx, { seccion: SEC, kicker: 'SEO · KEYWORDS GENÉRICAS EN EL TOP 10 DE GOOGLE (FOTO 1-SEP)',
    titulo: 'Drean es la marca con más presencia orgánica en Google (top 10 en 259 de 486 búsquedas), pero Mercado Libre y Frávega la superan',
    fuente: 'Fuente: DataForSEO (seo_rankings), foto del 1-sep-2026. Lavarropas 174 keywords, heladeras 228, cocinas 84. Search Console no se usa: está conectado a la propiedad equivocada.' });
  L.barras(ctx, s, { labels: catsSeo.map((c) => c[0].toUpperCase() + c.slice(1)), series: marcaSeo.map((m, i) => ({ name: m === 'ML' ? 'Mercado Libre' : m,
    values: catsSeo.map((c) => (sr.find((f) => f[1] === c && f[2] === m) || [])[6] ?? null), color: [L.P.navy, L.P.gray, 'CA8A04', L.P.accent][i] })) });
  L.lectura(ctx, s, { interpretacion: 'Lavarropas: Drean en el top 10 en 140 de 174 keywords y top 3 en 100 (Whirlpool 40 y 24). Heladeras: 85 de 228 (Gafa 50). En IA, Drean es la marca más citada en lavarropas (20,5% de las menciones) y queda detrás de Whirlpool en heladeras.',
    implicancia: 'La fortaleza orgánica de lavado coincide con el share of search. Corregir la propiedad de Search Console para poder auditar el SEO.', confianza: 'media (una foto)' });

  // 15. Tráfico desde IA
  s = L.contenido(ctx, { seccion: SEC, kicker: 'NUEVO CANAL · VISITAS DESDE ASISTENTES DE IA',
    titulo: 'Las visitas desde asistentes de IA crecieron ×4,8 en el año y compran mejor que el promedio, aunque son el 0,3% del tráfico',
    fuente: `${F_GA} Sesiones con referrer de asistentes de IA (97% ChatGPT). ${NOTA}` });
  L.barras(ctx, s, { labels: L.etiquetasMes([S.A_ia_sesiones.meses2026]), series: [{ name: 'Sesiones desde IA', values: S.A_ia_sesiones.meses2026 }] });
  L.lectura(ctx, s, { interpretacion: 'Enero 422 → septiembre 2.027 sesiones. En ago–sep generaron 10–12 compras por mes: conversión de ~0,5%, diez veces la del sitio (0,06%).',
    implicancia: 'Canal chico pero de alta calidad: monitorearlo junto con la visibilidad de la marca en respuestas de IA.', confianza: 'media (volúmenes chicos)' });
};
