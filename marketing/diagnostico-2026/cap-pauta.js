// Capítulo 3 — Pauta digital y media effectiveness. Datos: datos/pauta.json.
const L = require('./lib');
const D = require('./datos/pauta.json');
const S = Object.fromEntries(D.series.map((s) => [s.id, s]));
const T = Object.fromEntries(D.tablas.map((t) => [t.id, t]));
const col = (t, c) => T[t].columnas.indexOf(c);
const filas = (t) => T[t].filas;
const M = (v, d = 1) => (v == null ? null : Math.round(v / 1e6 * 10 ** d) / 10 ** d); // millones
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const SEC = 'Pauta digital';
const NOTA = '† Oct parcial (al 17/18-oct). * Sin datos: no hay pauta cargada antes de abr-2026 ni datos de 2025.';
const F_MOD = 'Fuente: modelo de Pauta Mkt del tablero (API Meta, DV360, Google Ads + carga OMD para TikTok, Mercado Ads, Geo, offline). Montos nominales en $.';

module.exports = function capPauta(ctx) {
  const { pres } = ctx;
  pres.addSection({ title: SEC });
  let s = pres.addSlide({ masterName: 'SECCION', sectionTitle: SEC });
  s.addText('Capítulo 3', { placeholder: 'num' });
  s.addText('Pauta digital y efectividad de medios', { placeholder: 'title' });
  s.addText('Se invirtieron $1.113M entre abril y septiembre. El mes de mayor inversión (agosto) es el menos evaluable; Meta cambió de objetivo a video y abarató la vista completa; el click al sitio se encareció.', { placeholder: 'sub' });

  // 1. Inversión mensual digital vs offline
  const dig = S.inv_digital_ars.meses2026, off = S.inv_offline_ars.meses2026;
  s = L.contenido(ctx, { seccion: SEC, kicker: 'INVERSIÓN · MENSUAL, DIGITAL VS OFFLINE',
    titulo: 'Se invirtieron $1.113M entre abril y septiembre; agosto concentró el 30% ($338M) y junio fue el mes más bajo ($56M)',
    fuente: `${F_MOD} Offline = TV, TV Cable, OOH, DOOH, Radio. ${NOTA}` });
  L.barras(ctx, s, { labels: L.etiquetasMes([S.inv_total_ars.meses2026]), apilado: true, fmt: '#,##0', series: [
    { name: 'Digital (M$)', values: dig.map((v) => M(v, 0)) }, { name: 'Offline (M$)', values: off.map((v) => M(v, 0)), color: L.P.gray }] });
  L.lectura(ctx, s, { interpretacion: 'En USD: US$128k (abr) a US$224k (ago). El offline pesa 33,7% del semestre; septiembre ya incluye TikTok y Mercado Ads (cargados el 19-oct desde la planilla de OMD).',
    implicancia: 'La inversión no sigue un ritmo planificado mes a mes (de $56M a $338M). Junio puede ser un mes realmente bajo o un plan offline sin cargar: no se puede verificar.', confianza: 'alta (septiembre validado contra el tablero: $198,0M)' });

  // 2. Share por medio
  const sh = filas('share_medio_abr_sep').slice(0, 14);
  s = L.contenido(ctx, { seccion: SEC, kicker: 'INVERSIÓN · PARTICIPACIÓN POR MEDIO (ABR–SEP)',
    titulo: 'Meta, TV Cable y OOH explican el 45% de la inversión; el digital es dos tercios del total',
    fuente: `${F_MOD} Abril–septiembre 2026.` });
  L.barras(ctx, s, { labels: sh.map((f) => f[0]), horizontal: true, fmt: '0.0"%"', series: [{ name: '% de la inversión', values: sh.map((f) => f[2]) }] });
  L.lectura(ctx, s, { interpretacion: 'Meta 17,7%, TV Cable 14,6%, OOH 12,3%, YouTube 11,7%, TikTok 8,0%, Streaming 7,2%, Mercado Ads 6,2%. Google (Search + Demand Gen) suma 4,7%.',
    implicancia: 'Un tercio de la plata va a medios sin medición de performance en la base (TV, OOH, radio, streaming): su contribución no se puede evaluar con estos datos.', confianza: 'alta' });

  // 3. % sin impresiones
  s = L.contenido(ctx, { seccion: SEC, kicker: 'CALIDAD DE DATOS · INVERSIÓN SIN IMPRESIONES INFORMADAS',
    titulo: 'En agosto, 3 de cada 4 pesos no tienen impresiones informadas: el mes de mayor inversión es el menos evaluable',
    fuente: `${F_MOD} % de la inversión del mes en medios sin impresiones cargadas (OMD sin performance y offline). ${NOTA}` });
  L.barras(ctx, s, { labels: L.etiquetasMes([S.pct_inv_sin_impresiones.meses2026]), fmt: '0.0"%"', series: [{ name: '% de la inversión sin impresiones', values: S.pct_inv_sin_impresiones.meses2026.map(r1) }], colores: [L.P.accent] });
  L.lectura(ctx, s, { interpretacion: 'Agosto: $257,5M de $338,4M sin impresiones (Streaming $80M, TikTok $51M, OOH $36M, Diarios $25M, Medios directos $20M, Radio $17M, TV $16M, Mercado Ads $14M). Septiembre quedó completo.',
    implicancia: 'Pedirle a OMD el reporte de performance de agosto antes de evaluar ese mes. Exigir performance junto con cada carga de inversión.', confianza: 'alta' });

  // 4. Meta gasto diario
  const gd = filas('meta_gasto_diario');
  s = L.contenido(ctx, { seccion: SEC, kicker: 'META · INVERSIÓN DIARIA (JUL–OCT)',
    titulo: 'El 1, 2 y 3 de agosto se gastó el 66% del mes de Meta, en cuatro campañas "_Diario" de video',
    fuente: 'Fuente: API de Meta (meta_paid_daily), inversión por día. Julio, septiembre y octubre: los 3 días de mayor gasto suman 14–20% del mes.' });
  L.barras(ctx, s, { labels: gd.map((f) => `${f[0].slice(8, 10)}/${f[0].slice(5, 7)}`), valores: false, series: [{ name: 'Inversión diaria (M$)', values: gd.map((f) => M(f[1], 2)) }],
    colores: [L.P.navy] });
  L.lectura(ctx, s, { interpretacion: 'Campañas "MABE_Drean_Views_{Brand, Cocina, Heladera, Lavado}_Agosto_26_Diario": $41,6M en 3 días; pico de $19,85M el 2-ago. En el resto del período ningún día supera $3M.',
    implicancia: 'Poner un tope diario a las campañas de video y pedir justificación de toda ráfaga de más del 20% del mes en menos de 5 días (la alerta del tablero ya lo detecta).', confianza: 'alta' });

  // 5. CPV Diario vs mensual
  const cats = ['Lavado', 'Heladera', 'Cocina', 'Brand'];
  s = L.contenido(ctx, { seccion: SEC, kicker: 'META · COSTO POR VISTA COMPLETA (THRUPLAY), AGOSTO',
    titulo: 'Esa ráfaga pagó cada vista completa entre 1,5 y 2,4 veces más que la versión mensual de la misma categoría',
    fuente: 'Fuente: API de Meta (meta_paid_creatives), campañas de Views de agosto 2026. ThruPlay = video visto 15 s o completo.' });
  L.barras(ctx, s, { labels: cats, fmt: '"$"0.00', series: [{ name: 'Campaña "_Diario" (3 días)', values: [4.73, 4.41, 4.77, 4.40], color: L.P.accent }, { name: 'Campaña mensual', values: [3.22, 1.99, 2.02, 1.92] }] });
  L.lectura(ctx, s, { interpretacion: 'Total "_Diario": $4,58 por ThruPlay y CPM $1.231, contra $2,47 y $810 en las Views mensuales. Ojo: las mensuales invirtieron $0,4–5,8M; un presupuesto chico compra inventario más barato.',
    implicancia: 'Es correlación, no causa probada. Para la próxima ráfaga, testear el mismo presupuesto distribuido en 2 semanas y comparar.', confianza: 'media' });

  // 6. Meta por táctica
  const tac = ['alcance', 'views', 'trafico', 'interaccion'];
  const nomT = { alcance: 'Alcance', views: 'Views (video)', trafico: 'Tráfico', interaccion: 'Interacción' };
  const meses = L.etiquetasMes([S.meta_inv.meses2026]);
  s = L.contenido(ctx, { seccion: SEC, kicker: 'META · INVERSIÓN POR OBJETIVO',
    titulo: 'Desde agosto Meta pasó a campañas de video (87% del gasto): por eso el CPM promedio subió de ~$340 a ~$870',
    fuente: `Fuente: API de Meta (meta_paid_creatives), objetivo de campaña. Montos en M$. ${NOTA}` });
  L.barras(ctx, s, { labels: meses, apilado: true, valores: false, series: tac.map((t, i) => ({ name: nomT[t],
    values: S['meta_inv_tactica_' + t].meses2026.map((v, j) => (S.meta_inv.meses2026[j] == null ? null : M(v || 0))), color: [L.P.gray, L.P.navy, L.P.blue, L.P.accent][i] })) });
  L.lectura(ctx, s, { interpretacion: 'Dentro de cada objetivo el costo casi no cambió: el CPM de Alcance pasó de $240 (abr) a $297 (sep). Views cuesta ~4 veces el CPM de Alcance pero entrega video visto.',
    implicancia: 'Leer el CPM y el CPC de Meta siempre por objetivo. Comparar el CPM de ago–sep con el de abr–jul lleva a una conclusión equivocada.', confianza: 'alta' });

  // 7. ThruPlays y CPV
  s = L.contenido(ctx, { seccion: SEC, kicker: 'META · VISTAS COMPLETAS (THRUPLAY) POR MES',
    titulo: 'Las vistas completas de video se multiplicaron por 11 y su costo bajó de $17 a $4',
    fuente: `Fuente: API de Meta (meta_paid_creatives). Millones de ThruPlays. ${NOTA}` });
  L.barras(ctx, s, { labels: L.etiquetasMes([S.meta_thruplay.meses2026]), fmt: '0.0', series: [{ name: 'ThruPlays (millones)', values: S.meta_thruplay.meses2026.map((v) => M(v)) }] });
  L.lectura(ctx, s, { interpretacion: 'Jul 1,33M → ago 14,7M y sep 14,7M ThruPlays. Costo por ThruPlay: abr $28,6, jul $17,2, ago $4,27, sep $4,23. En septiembre las Views mejoraron frente a agosto: ThruPlay sobre impresiones 28,7% → 42,1%.',
    implicancia: 'El cambio a video fue eficiente en costo por vista. Falta conectar la vista con un resultado posterior (tráfico, búsqueda): ver capítulo 5.', confianza: 'alta' });

  // 8. CPC tráfico
  const om = filas('meta_objetivo_mes'), oc = (n) => col('meta_objetivo_mes', n);
  const mesIdx = { Abril: 3, Mayo: 4, Junio: 5, Julio: 6, Agosto: 7, Septiembre: 8, Octubre: 9 };
  const cpcMeta = Array(12).fill(null);
  om.filter((f) => f[oc('objetivo_tactico')] === 'Tráfico').forEach((f) => { cpcMeta[mesIdx[f[0].split(' ')[0]]] = r1(f[oc('cpc_link_ars')]); });
  s = L.contenido(ctx, { seccion: SEC, kicker: 'TRÁFICO · COSTO POR CLICK, MISMO OBJETIVO',
    titulo: 'El click al sitio se encareció en septiembre en todas las plataformas: Meta Tráfico $25 → $61, Demand Gen $10 → $20',
    fuente: `Fuente: API de Meta (campañas de Tráfico, CPC al enlace) y Google Ads (google_ads_creatives, Search y Demand Gen). $ nominales. ${NOTA}` });
  L.linea(ctx, s, { series: [{ name: 'Meta · Tráfico', values: cpcMeta }, { name: 'Google Search', values: S.google_search_cpc.meses2026.map(r1), color: L.P.accent },
    { name: 'Google Demand Gen', values: S.google_demand_gen_cpc.meses2026.map(r1), color: L.P.sky }], unidad: '$ por click', fmt: '0' });
  L.lectura(ctx, s, { interpretacion: 'No es solo precio de inventario: bajó el CTR (Meta Tráfico 3,99% → 2,40%; Demand Gen 6,6% → 4,1%). Coincide con el cambio de piezas de septiembre ("Imagen_Lineal_KV", "Video_Nueva comunicación Septiembre"). Search subió porque se multiplicó la inversión ($1,9M → $9,3M).',
    implicancia: 'Hipótesis a testear: A/B de las piezas de tráfico de septiembre contra las de abr–jun (CTR al enlace 5–6%). Fijar un techo de CPC por plataforma.', confianza: 'alta en las cifras; baja en la causa' });

  // 9. Retención video
  s = L.contenido(ctx, { seccion: SEC, kicker: 'VIDEO · % DE REPRODUCCIONES QUE LLEGAN AL FINAL',
    titulo: 'YouTube retiene más vistas completas que Meta (56% vs 38% en sep.); su caída de agosto viene de una sola línea de inventario',
    fuente: `Fuente: DV360 (YouTube: q100 ÷ inicios) y API de Meta (p100 ÷ reproducciones). Abr–may DV360 truncado (no comparable). ${NOTA}` });
  L.linea(ctx, s, { series: [{ name: 'YouTube (DV360)', values: S.youtube_retencion_q100.meses2026.map(r1) }, { name: 'Meta', values: S.meta_retencion_p100.meses2026.map(r1), color: L.P.accent }], unidad: '% vista completa', fmt: '0' });
  L.lectura(ctx, s, { interpretacion: 'YouTube: 74% (jun), 66% (jul), 42% (ago), 56% (sep). Las líneas por categoría están en 78–97% (Awareness) y 61–67% (Consideración); la línea "General" de agosto retuvo 4,6% con CPM de US$0,41. Meta subió de 2% a 38% al pasar a Views.',
    implicancia: 'Evaluar esa línea por costo por vista completa, no por CPM barato, y pedir a la agencia su formato.', confianza: 'alta en cifras; media en la causa' });

  // 10. CPM por medio
  const ef = filas('eficiencia_medio_abr_sep').filter((f) => f[col('eficiencia_medio_abr_sep', 'cpm_ars')] != null && f[0] !== 'OOH')
    .sort((a, b) => a[col('eficiencia_medio_abr_sep', 'cpm_ars')] - b[col('eficiencia_medio_abr_sep', 'cpm_ars')]);
  s = L.contenido(ctx, { seccion: SEC, kicker: 'EFICIENCIA · CPM POR MEDIO (ABR–SEP)',
    titulo: 'TikTok y Meta compran la exposición más barata ($436 y $546 por mil); Programmatic y Mercado Ads, la más cara',
    fuente: `${F_MOD} CPM = inversión con impresiones ÷ impresiones × 1.000. Solo medios con impresiones informadas.` });
  L.barras(ctx, s, { labels: ef.map((f) => f[0]), horizontal: true, fmt: '"$"#,##0', series: [{ name: 'CPM ($)', values: ef.map((f) => Math.round(f[col('eficiencia_medio_abr_sep', 'cpm_ars')])) }] });
  L.lectura(ctx, s, { interpretacion: 'El CPM no mide lo mismo en cada medio: Mercado Ads compra audiencia en el punto de compra y Search compra intención. Por CPC: Demand Gen $12,6, Search $72, Meta $94, TikTok $115, Mercado Ads $299.',
    implicancia: 'Fijar el KPI de eficiencia por rol del medio: CPM o costo por vista completa para awareness, CPC al enlace para tráfico. No comparar el CPC de YouTube con el de Demand Gen.', confianza: 'alta' });

  // 11. Scatter inversión vs impresiones/clicks
  const mm = filas('medio_mes').filter((f) => f[2] === 'digital' && f[6] > 0), mc = (n) => col('medio_mes', n);
  s = L.contenido(ctx, { seccion: SEC, kicker: 'RELACIÓN · INVERSIÓN VS EXPOSICIÓN Y CLICKS (MEDIO × MES)',
    titulo: 'La inversión explica las impresiones (r = 0,84) pero casi no los clicks (r = 0,34): el click depende del medio y el objetivo',
    fuente: `${F_MOD} Cada punto = un medio digital en un mes (abr–sep, n=43). r = correlación de Pearson sobre logaritmos. Ejes en M$ y millones.` });
  L.dispersion(ctx, s, { x: mm.map((f) => M(f[mc('inv_ars')], 2)), nombreX: 'Inversión (M$)',
    ys: [{ name: 'Impresiones (millones)', values: mm.map((f) => M(f[mc('impresiones')], 2)), eje: 'Millones' }, { name: 'Clicks (decenas de miles)', values: mm.map((f) => Math.round((f[mc('clicks')] || 0) / 1e4 * 100) / 100), color: L.P.accent }], fmtX: '0', fmtY: '0' });
  L.lectura(ctx, s, { interpretacion: 'Más plata compra más impresiones en cualquier medio. Los clicks dependen de que el medio y el objetivo estén hechos para generarlos (Demand Gen y Meta Tráfico sí; YouTube y Programmatic no).',
    implicancia: 'Correlación entre medios, no efecto causal dentro de cada uno, y con solo 6 meses. Para atribuir hace falta un diseño de test (geo o temporal).', confianza: 'media' });

  // 12. Ranking piezas Meta Views
  const cr = filas('meta_creativos'), cc = (n) => col('meta_creativos', n);
  const v = cr.filter((f) => String(f[cc('tactica')]).startsWith('Views') && f[cc('inv_ars')] >= 300000).sort((a, b) => b[cc('thruplay_sobre_impr_pct')] - a[cc('thruplay_sobre_impr_pct')]);
  const rk = [...v.slice(0, 6), ...v.slice(-6)];
  s = L.contenido(ctx, { seccion: SEC, kicker: 'EFECTIVIDAD CREATIVA · PIEZAS DE VIDEO EN META',
    titulo: 'Las piezas "Boost" de Marcelino 1.x y 2.1 retienen 94–98%; las versiones 3.x de octubre y "Una cocina que no te limita", menos de 20%',
    fuente: 'Fuente: API de Meta (meta_paid_creatives), campañas de Views, piezas con inversión ≥ $300 mil. Top 6 y bottom 6 por ThruPlay sobre impresiones.' });
  L.tabla(ctx, s, { area: { x: 0.5, y: 1.7, w: 12.3 }, anchos: [1.1, 5.3, 1.2, 1.5, 1.6, 1.6], heat: [3],
    cols: ['Mes', 'Pieza', 'Inversión M$', 'ThruPlay / impr. %', 'Costo x ThruPlay $', 'Vista al 100% %'],
    filas: rk.map((f) => [f[cc('mes')].split(' ')[0], String(f[cc('anuncio')]).slice(0, 70), M(f[cc('inv_ars')], 2), r1(f[cc('thruplay_sobre_impr_pct')]), f[cc('cpv_thruplay_ars')], r1(f[cc('ret100_pct')])]), fontSize: 10 });

  // 13. Costo por interacción por objetivo (sep)
  const sep = om.filter((f) => f[0] === 'Septiembre 2026');
  s = L.contenido(ctx, { seccion: SEC, kicker: 'META · COSTO POR INTERACCIÓN SEGÚN OBJETIVO (SEPTIEMBRE)',
    titulo: 'Las campañas de Interacción consiguen cada interacción a $37; Tráfico, Alcance y Views cuestan entre 16 y 47 veces más (no es su objetivo)',
    fuente: 'Fuente: API de Meta. Interacción = reacciones + comentarios + compartidos + guardados. Comparación informativa: cada objetivo optimiza un resultado distinto.' });
  L.barras(ctx, s, { labels: sep.map((f) => f[oc('objetivo_tactico')]), fmt: '"$"#,##0', series: [{ name: 'Costo por interacción', values: sep.map((f) => Math.round(f[oc('costo_interaccion_ars')])) }] });
  L.lectura(ctx, s, { interpretacion: 'Interacción: tasa de 4,65% de las impresiones. Marcelino_Interacciones logró $35,7 por interacción en septiembre y Mickey_Interacciones $47,1 en octubre.',
    implicancia: 'Si el objetivo es conversación o comunidad (Marcelino, Mickey), Interacción es la táctica eficiente. No exigirle engagement a Views o Alcance.', confianza: 'alta' });

  // 14. OMD vs API
  const ov = filas('meta_omd_vs_api').filter((f) => f[1] != null);
  s = L.contenido(ctx, { seccion: SEC, kicker: 'CALIDAD DE DATOS · META SEGÚN OMD VS SEGÚN LA API',
    titulo: 'La planilla de OMD subcontó Meta en $49M en agosto y $29M en septiembre: la fuente correcta es la API',
    fuente: 'Fuente: pauta_performance (fila Meta de OMD) vs meta_paid_creatives (API). El tablero ya usa la API para Meta. Octubre parcial.' });
  L.barras(ctx, s, { labels: ov.map((f) => f[0].split(' ')[0]), fmt: '0.0', series: [{ name: 'Planilla OMD (M$)', values: ov.map((f) => M(f[1])), color: L.P.gray }, { name: 'API de Meta (M$)', values: ov.map((f) => M(f[2])) }] });
  L.lectura(ctx, s, { interpretacion: 'Julio coincide al peso ($22,8M). Desde agosto la planilla deja afuera las campañas de video: ago $13,4M vs $62,7M; sep $33,0M vs $62,1M.',
    implicancia: 'Cualquier reporte o presupuesto armado con la planilla de OMD subestima Meta a la mitad. Avisar a quien consolida el REAL.', confianza: 'alta' });

  // 15. Competencia Ad Library
  const ci = filas('competencia_intensidad_meta').filter((f) => f[3] > 0), ic = (n) => col('competencia_intensidad_meta', n);
  s = L.contenido(ctx, { seccion: SEC, kicker: 'COMPETENCIA · AVISOS ACTIVOS EN META (FOTO 12-OCT)',
    titulo: 'Drean tiene 19 avisos activos y ninguno sostenido más de 30 días; Whirlpool lidera con 34 y Samsung sostiene los suyos ~6 meses',
    fuente: 'Fuente: Biblioteca de anuncios de Meta vía Apify (competitor_ads_snapshot). Solo cantidad y antigüedad: Meta no publica inversión ni resultados de anuncios comerciales en Argentina.' });
  L.barras(ctx, s, { labels: ci.map((f) => f[0]), horizontal: true, series: [
    { name: 'Avisos activos', values: ci.map((f) => f[ic('avisos_activos')]) }, { name: 'Sostenidos 30+ días', values: ci.map((f) => f[ic('sostenidos_30d_mas')]), color: L.P.accent }] });
  L.lectura(ctx, s, { interpretacion: 'Drean renovó todo con el teaser "Una nueva era está llegando" (6-oct): 5 días al aire en promedio. BGH sostiene 13 avisos 108 días en promedio; Samsung, 182 días.',
    implicancia: 'No hay benchmark válido de inversión, CPM ni CTR de la competencia. Esta foto solo indica actividad: hace falta una serie para leer tendencias.', confianza: 'media (una sola foto)' });

  // 16. VTR del tablero
  s = L.contenido(ctx, { seccion: SEC, kicker: 'MEDICIÓN · EL "VTR ≥50%" DEL TABLERO',
    titulo: 'El VTR del tablero pasó de 4,8% a 53,8%, pero la suba es por cambio de fuentes y objetivos, no por mejores piezas',
    fuente: `Fuente: modelo del tablero (VTR ≥50%), API de Meta (p50 ÷ reproducciones) y DV360 (q50 ÷ inicios). ${NOTA}` });
  L.linea(ctx, s, { series: [{ name: 'VTR ≥50% del tablero', values: S.vtr50_pct.meses2026.map(r1) }, { name: 'Meta (p50)', values: S.meta_retencion_p50.meses2026.map(r1), color: L.P.accent },
    { name: 'YouTube (q50)', values: S.youtube_retencion_q50.meses2026.map(r1), color: L.P.sky }], unidad: '%', fmt: '0' });
  L.lectura(ctx, s, { interpretacion: 'Abr–may el indicador es casi solo Meta Alcance (5–7%); en junio entra YouTube completo (~95%); desde agosto entran las Views de Meta (30–54%). Mezcla plataformas con definiciones distintas.',
    implicancia: 'Separar el KPI en "VTR Meta Views" y "vista completa YouTube" antes de usarlo para evaluar piezas.', confianza: 'alta' });
};
