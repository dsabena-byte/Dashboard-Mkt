// Capítulo 2 — Social media orgánico. Datos: datos/social.json + datos/sentimiento-mensual.json.
const L = require('./lib');
const D = require('./datos/social.json');
const SM = require('./datos/sentimiento-mensual.json');
const S = Object.fromEntries(D.series.map((s) => [s.id, s]));
const T = Object.fromEntries(D.tablas.map((t) => [t.id, t]));
const col = (t, c) => T[t].columnas.indexOf(c);
const filas = (t) => T[t].filas;
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const SEC = 'Social orgánico';
const F_IG = 'Fuente: Meta Graph API (meta_posts, Instagram @dreanargentina, posts de feed y reels).';
const NOTA = '† Oct parcial (al 19-oct). * Sin datos (mes futuro).';

module.exports = function capSocial(ctx) {
  const { pres } = ctx;
  pres.addSection({ title: SEC });
  let s = pres.addSlide({ masterName: 'SECCION', sectionTitle: SEC });
  s.addText('Capítulo 2', { placeholder: 'num' });
  s.addText('Social media orgánico', { placeholder: 'title' });
  s.addText('Instagram concentra el resultado orgánico. Marcelino es la campaña que mejor funciona; los sorteos inflan los picos; el sentimiento de los comentarios es mayoritariamente negativo y se explica por posventa.', { placeholder: 'sub' });

  // 1. Publicaciones
  s = L.contenido(ctx, { seccion: SEC, kicker: 'ACTIVIDAD · PUBLICACIONES POR MES',
    titulo: 'Drean pasó de 3 a 16–18 publicaciones por mes en Instagram desde mayo; las Stories, sumadas en junio, vienen bajando',
    fuente: `${F_IG} Facebook: meta_posts (Página). Stories: capturas cada 6 h (piso). ${NOTA}` });
  L.barras(ctx, s, { labels: L.etiquetasMes([S.ig_feed_count.meses2026]), series: [
    { name: 'Instagram feed + reels', values: S.ig_feed_count.meses2026 },
    { name: 'Instagram Stories', values: S.ig_stories_count.meses2026, color: L.P.sky },
    { name: 'Facebook', values: S.fb_posts_total.meses2026, color: L.P.gray }] });
  L.lectura(ctx, s, { interpretacion: 'La frecuencia de Instagram (16,4 posts/mes may–sep) ya está en el nivel de la categoría: Gafa 17,6, Whirlpool 14,2, Electrolux 13,2.',
    implicancia: 'El margen no está en publicar más sino en qué se publica (formato, categoría, campaña). Las Stories cayeron de 48 a 27 por mes: definir si son táctica o se discontinúan.', confianza: 'alta (conteo de posts)' });

  // 2. Interacciones apiladas por tipo
  const ig = ['ig_likes', 'ig_comments', 'ig_saves', 'ig_shares'];
  s = L.contenido(ctx, { seccion: SEC, kicker: 'INSTAGRAM · INTERACCIONES POR TIPO',
    titulo: 'Las interacciones de Instagram se multiplicaron por 5 entre enero y agosto; el pico de septiembre (4.680) es un sorteo',
    fuente: `${F_IG} Interacciones = me gusta + comentarios + guardados + compartidos (compartidos derivados). ${NOTA}` });
  L.barras(ctx, s, { labels: L.etiquetasMes([S.ig_interactions.meses2026]), apilado: true, valores: false, series: [
    { name: 'Me gusta', values: S.ig_likes.meses2026 }, { name: 'Comentarios', values: S.ig_comments.meses2026, color: L.P.accent },
    { name: 'Guardados', values: S.ig_saves.meses2026, color: L.P.blue }, { name: 'Compartidos', values: S.ig_shares.meses2026, color: L.P.sky }] });
  L.lectura(ctx, s, { interpretacion: 'Enero 352 → agosto 1.774 interacciones. En septiembre, 3.565 de las 4.680 vienen del sorteo de Casa FOA (22-sep): sin él, el mes queda en 1.115.',
    implicancia: 'Reportar los sorteos por separado. Desde junio cada post se mide a 7 días de publicado: los volúmenes jun–oct están subestimados frente a ene–may (ver alcance).', confianza: 'alta en cifras; media en la comparación ene–may vs jun–oct' });

  // 3–6. Una métrica por slide
  const met = [
    ['ig_likes', 'ME GUSTA', 'Los me gusta crecieron de 157 en enero a 1.538 en septiembre (×9,8); el salto ocurre en agosto con Marcelino',
      'Agosto (1.344) y septiembre (1.538) duplican el promedio mar–jul (~580). Coinciden con el arranque de "El tipo que vende Drean" (28-jul) y los teasers de "Una nueva era".',
      'Es el indicador de alcance de la conversación: mantener la serie de Marcelino y medir si el nivel de ago–sep se sostiene en octubre (parcial: 509 al 19-oct).', 'media (coincidencia temporal, no causalidad)'],
    ['ig_comments', 'COMENTARIOS', 'Sin el sorteo, los comentarios subieron de 31 a ~250 por mes; buena parte son reclamos de posventa',
      'Septiembre muestra 3.104, pero 2.950 son del post-sorteo de Casa FOA; sin él, 154. La tendencia de fondo (ene 31 → ago 256) acompaña el aumento de publicaciones.',
      'Más comentarios no es mejor: el 78,5% de los comentarios analizados en 2026 es negativo (ver sentimiento). Hace falta un protocolo de respuesta y derivación a servicio técnico.', 'alta'],
    ['ig_saves', 'GUARDADOS', 'Los guardados —la señal de intención— no siguen el crecimiento del resto: oscilan entre 17 y 134 por mes sin tendencia',
      'Los picos (abr 128, sep 134) vienen de piezas de producto y cocina; los meses de contenido de marca (jun 28, jul 47) quedan abajo. Cocción logra 13,5 guardados por post, el triple que Brand (2,6).',
      'Si el objetivo es intención de compra, sumar piezas utilitarias (recetas, uso, comparativas) que se guardan, en lugar de más contenido institucional.', 'media (n chico por mes)'],
    ['ig_shares', 'COMPARTIDOS', 'Los compartidos dependen de piezas puntuales (marzo 242, agosto 213) y no muestran una tendencia sostenida',
      'Marzo lo explica el reel de cocinas del 19-mar (96 compartidos); agosto, Marcelino y el post "Eterno" (31-ago). Los reels promedian 13,4 compartidos por post contra 3,2 del carrusel.',
      'El compartido es la vía de alcance orgánico nuevo: priorizar reels con humor o emoción (Marcelino) sobre carruseles de producto. Dato derivado (Meta no lo informa por separado).', 'media (métrica derivada)'],
  ];
  met.forEach(([id, k, tit, interp, impl, conf]) => {
    const ser = S[id];
    const values = ser.meses2026;
    const series = [{ name: '2026', values }];
    if (id === 'ig_comments') series.push({ name: '2026 sin sorteos', values: values.map((v, i) => (i === 8 ? v - 2950 : v)), color: L.P.accent });
    s = L.contenido(ctx, { seccion: SEC, kicker: `INSTAGRAM · ${k} POR MES`, titulo: tit,
      fuente: `${F_IG} 2025 no se grafica: la captura de 2025 es incompleta (sync desde jun-2025). ${NOTA}` });
    L.linea(ctx, s, { series: series.map((x) => ({ ...x })), etiquetas: L.etiquetasMes([values]) });
    L.lectura(ctx, s, { interpretacion: interp, implicancia: impl, confianza: conf });
  });

  // 7. Int/post IG vs FB
  s = L.contenido(ctx, { seccion: SEC, kicker: 'INSTAGRAM VS FACEBOOK · INTERACCIONES POR POST',
    titulo: 'Un post de Instagram genera entre 2 y 10 veces más interacciones que uno de Facebook, todos los meses del año',
    fuente: `${F_IG} Facebook: posts orgánicos (excluye pagos por isPaidOutlier). Septiembre IG incluye el sorteo. ${NOTA}` });
  L.linea(ctx, s, { series: [{ name: 'Instagram', values: S.ig_int_per_post.meses2026.map(r1) }, { name: 'Facebook', values: S.fb_int_per_post.meses2026.map(r1), color: L.P.gray }] });
  L.lectura(ctx, s, { interpretacion: 'Facebook se mantiene en 12–27 interacciones por post todo el año y suma ~360 seguidores por mes; Instagram oscila entre 32 y 117 (334 en septiembre por el sorteo).',
    implicancia: 'Facebook funciona como réplica de bajo costo: no conviene producir para Facebook ni medir objetivos ahí (coincide con medir Redes solo con Instagram).', confianza: 'alta' });

  // 8. ER con y sin sorteo
  s = L.contenido(ctx, { seccion: SEC, kicker: 'INSTAGRAM · ENGAGEMENT SOBRE ALCANCE',
    titulo: 'Sin sorteos, el engagement de Instagram subió de 2,0–3,2% (ene–may) a 3,2–4,6% (jul–oct)',
    fuente: `${F_IG} ER = interacciones ÷ alcance de los posts del mes (misma definición que /redes). ${NOTA}` });
  L.linea(ctx, s, { series: [{ name: 'Con sorteos', values: S.ig_er_reach.meses2026.map(r1), color: L.P.gray }, { name: 'Sin sorteos', values: S.ig_er_reach_sin_sorteo.meses2026.map(r1) }], unidad: '%', fmt: '0.0' });
  L.lectura(ctx, s, { interpretacion: 'La tasa es comparable en todo el año (numerador y denominador se leen juntos). La mejora de la segunda mitad coincide con más reels y con Marcelino. Septiembre con sorteo marca 12,2%: no es una mejora real.',
    implicancia: 'Usar el ER sin sorteos como KPI de calidad de contenido. Un sorteo multiplica el ER del mes por 3: no mezclarlo con el contenido de marca.', confianza: 'alta' });

  // 9. Alcance mediano y artefacto
  s = L.contenido(ctx, { seccion: SEC, kicker: 'INSTAGRAM · ALCANCE MEDIANO POR POST',
    titulo: 'La caída del alcance por post desde junio coincide con un cambio en cómo se mide: no está demostrado que sea real',
    fuente: `${F_IG} Desde jun-2026 ig-sync relee cada post solo 7 días; los posts ene–may se leyeron meses después (alcance maduro). ${NOTA}` });
  L.barras(ctx, s, { labels: L.etiquetasMes([S.ig_reach_median.meses2026]), series: [{ name: 'Alcance mediano por post', values: S.ig_reach_median.meses2026.map((v) => (v == null ? null : Math.round(v))) }] });
  L.lectura(ctx, s, { interpretacion: 'Ene–abr: 3.400–4.070 personas por post; jun–sep: 1.100–2.100. Los me gusta siguen creciendo +25% (mediana) después del día 7, así que parte de la caída es medición.',
    implicancia: 'No reportar la caída del alcance como hecho. Ampliar la ventana de lectura de Instagram (como Facebook, 70 días) para tener series comparables.', confianza: 'alta en el artefacto; media en la magnitud real' });

  // 10. Seguidores vs competencia
  const g = filas('bench_ig_followers_growth');
  const nm = { dreanargentina: 'Drean', electroluxar: 'Electrolux', gafaargentina: 'Gafa', 'philco.arg': 'Philco', whirlpoolarg: 'Whirlpool' };
  s = L.contenido(ctx, { seccion: SEC, kicker: 'INSTAGRAM · CRECIMIENTO DE SEGUIDORES VS COMPETENCIA',
    titulo: 'Drean sumó 6.438 seguidores en 20 días (+4,1%), casi 7 veces el ritmo del competidor que más creció',
    fuente: 'Fuente: Instagram Business Discovery (social_followers), serie diaria 28-sep → 18-oct-2026. Samsung y LG no están relevados.' });
  L.barras(ctx, s, { labels: g.map((f) => nm[f[0]] || f[0]), horizontal: true, fmt: '0.0"%"', series: [{ name: 'Crecimiento %', values: g.map((f) => f[col('bench_ig_followers_growth', 'neto_%')]) }],
    colores: [L.P.navy] });
  L.lectura(ctx, s, { interpretacion: 'Drean: 156.828 → 163.266. Gafa +0,58%, Electrolux +0,62%, Whirlpool +0,50%, Philco +0,24%. El pico (+1.787 el 30-sep) coincide con el sorteo de Casa FOA y los teasers de "Una nueva era".',
    implicancia: 'Medir cuántos de esos seguidores se quedan después del sorteo antes de repetir la táctica. La serie diaria existe recién desde el 28-sep: no hay comparación anual.', confianza: 'alta en la cifra; baja en la causa' });

  // 11. Formatos
  const fm = filas('ig_por_formato').filter((f) => ['Reel', 'Carrusel', 'Imagen'].includes(f[0]));
  s = L.contenido(ctx, { seccion: SEC, kicker: 'INSTAGRAM · RENDIMIENTO POR FORMATO (2026)',
    titulo: 'Los reels casi duplican las interacciones del carrusel y lo cuadruplican en compartidos',
    fuente: `${F_IG} 2026, sin sorteos, posts con ≥7 días. Reel n=53, carrusel n=34, imagen n=18 (imagen incluye el post "Eterno" del 31-ago).` });
  L.barras(ctx, s, { labels: fm.map((f) => f[0]), fmt: '0.0', series: [
    { name: 'Interacciones por post', values: fm.map((f) => f[col('ig_por_formato', 'int_por_post')]) },
    { name: 'Compartidos por post', values: fm.map((f) => f[col('ig_por_formato', 'compartidos_por_post')]), color: L.P.sky },
    { name: 'Guardados por post', values: fm.map((f) => f[col('ig_por_formato', 'guardados_por_post')]), color: L.P.accent }] });
  L.lectura(ctx, s, { interpretacion: 'Reel: 81,6 interacciones y 2.434 de alcance mediano por post. Carrusel: 44,4 y 1.436. La imagen tiene buen promedio (98,5) por un solo post viral; su mediana es 61.',
    implicancia: 'Reasignar producción de carruseles a reels. El carrusel es el formato más débil en todas las métricas.', confianza: 'media-alta (correlación formato–rendimiento)' });

  // 12. Categorías
  const ct = filas('ig_por_categoria').filter((f) => f[1] >= 10);
  s = L.contenido(ctx, { seccion: SEC, kicker: 'INSTAGRAM · RENDIMIENTO POR CATEGORÍA (2026)',
    titulo: 'Cocción es la categoría más eficiente (87 interacciones y 13,5 guardados por post); Refrigeración, la más débil',
    fuente: `${F_IG} Categoría asignada por clasificación IA del post. 2026, sin sorteos. Lavado n=42, Brand 38, Refrigeración 17, Cocción 15.` });
  L.barras(ctx, s, { labels: ct.map((f) => f[0]), fmt: '0.0', series: [
    { name: 'Interacciones por post', values: ct.map((f) => f[col('ig_por_categoria', 'int_por_post')]) },
    { name: 'Guardados por post', values: ct.map((f) => f[col('ig_por_categoria', 'guardados_por_post')]), color: L.P.accent }] });
  L.lectura(ctx, s, { interpretacion: 'Cocción genera guardados (recetas, uso): señal de intención. Refrigeración rinde 53 por post y ER 2,3%, debajo de Lavado (83 / 3,1%) y Brand (63 / 3,0%).',
    implicancia: 'Revisar el enfoque de Refrigeración (hoy técnico) y replicar la lógica de utilidad de Cocción.', confianza: 'media (n chico por categoría)' });

  // 13. Pilares + innovación
  const pl = filas('ig_por_pilar'), inn = filas('ig_innovacion');
  s = L.contenido(ctx, { seccion: SEC, kicker: 'INSTAGRAM · RENDIMIENTO POR PILAR DE CONTENIDO',
    titulo: '"Calidad superior" duplica la interacción del resto de los pilares; nombrar la tecnología no suma (61 vs 84 por post)',
    fuente: `${F_IG} Pilar asignado por clasificación IA (pilar_contenido). "Menciona tecnología/innovación" = búsqueda de palabras en el texto (n=54 vs 59).` });
  L.barras(ctx, s, { labels: [...pl.map((f) => f[0]), ...inn.map((f) => (f[0] === 'No menciona' ? 'No menciona tecnología' : 'Menciona tecnología'))], horizontal: true, fmt: '0.0',
    series: [{ name: 'Interacciones por post', values: [...pl.map((f) => f[col('ig_por_pilar', 'int_por_post')]), ...inn.map((f) => f[col('ig_innovacion', 'int_por_post')])] }] });
  L.lectura(ctx, s, { interpretacion: '"Calidad superior": 130 interacciones por post y 13,7 guardados. "Respaldo posventa" tiene el máximo de comentarios (21,2 por post): atrae reclamos.',
    implicancia: 'Contar la innovación a través del beneficio y la calidad, no de la especificación técnica. Evaluar si los posts de posventa convienen sin un equipo que responda.', confianza: 'media (clasificación IA, correlación)' });

  // 14. Campañas: índice vs base
  const cm = filas('campanias_resumen').filter((f) => f[0] === 'IG' && !f[1].startsWith('BASE') && f[5] >= 4);
  const cmVals = cm.map((f) => (f[1] === 'Casa FOA' ? r1(48.3 / 64.6) : f[col('campanias_resumen', 'indice_int_post_vs_base')]));
  s = L.contenido(ctx, { seccion: SEC, kicker: 'CAMPAÑAS · INTERACCIONES POR POST VS BASE (INSTAGRAM)',
    titulo: '"El tipo que vende Drean" (Marcelino) es la campaña orgánica más efectiva: +48% de interacciones por post sobre la base',
    fuente: `${F_IG} Base = 36 posts sin campaña ni sorteo jun–oct (64,6 interacciones/post). Campañas detectadas por texto del post. Casa FOA sin el post-sorteo.` });
  L.barras(ctx, s, { labels: cm.map((f) => f[1].replace(' (Marcelino)', '').replace(' (madre, enamorados, 25 de mayo, Yellow Day)', '')), fmt: '0.00"x"', horizontal: true,
    series: [{ name: 'Índice vs base (1,00 = base)', values: cmVals }] });
  L.lectura(ctx, s, { interpretacion: 'Marcelino: 15 posts, 95,5 interacciones por post, alcance mediano +65%, 25,5 comentarios por post (3 veces la base). "Una nueva era" 1,12x; Mundial 0,99x; Casa FOA sin sorteo 0,75x.',
    implicancia: 'Sostener la serie de personaje en Instagram. En Facebook no rinde (0,83x). 3 posts de lanzamiento figuran pautados: parte del alcance puede ser pago.', confianza: 'media (n=15, mezcla con pauta)' });

  // 15. Casa FOA
  const cf = filas('ig_casafoa_detalle').filter((f) => f[1] === 'instagram');
  s = L.contenido(ctx, { seccion: SEC, kicker: 'CAMPAÑA · CASA FOA (INSTAGRAM)',
    titulo: 'Casa FOA: el 96% de las interacciones vino del post-sorteo; el contenido de diseño quedó debajo de la base',
    fuente: `${F_IG} Posts de Casa FOA en Instagram, 8-ago → 22-sep-2026.` });
  L.barras(ctx, s, { labels: cf.map((f) => `${f[0].slice(8, 10)}/${f[0].slice(5, 7)} · ${f[2]}${f[6] ? ' (sorteo)' : ''}`), series: [{ name: 'Interacciones', values: cf.map((f) => f[4]) }] });
  L.lectura(ctx, s, { interpretacion: '3.565 de 3.710 interacciones (2.950 comentarios) son del sorteo del 22-sep. Los otros 3 posts suman 145 (48 por post, contra 64,6 de la base).',
    implicancia: 'Evaluar el sponsoreo por objetivos fuera de redes (presencia, prensa). En redes, el sorteo genera participación pero no conversación de marca.', confianza: 'alta' });

  // 16–17. Rankings
  const rank = (tid, titulo, kicker) => {
    const c = (n) => col(tid, n);
    s = L.contenido(ctx, { seccion: SEC, kicker, titulo, fuente: `${F_IG} 2026, ordenado por interacciones totales. Alcance a 7 días para posts desde junio.` });
    L.tabla(ctx, s, { area: { x: 0.5, y: 1.7, w: 12.3 }, anchos: [0.9, 1.0, 1.3, 2.0, 0.9, 1.0, 0.8, 0.8, 3.6],
      cols: ['Fecha', 'Formato', 'Categoría', 'Campaña', 'Alcance', 'Interacc.', 'ER %', 'Guard.', 'Texto'],
      filas: filas(tid).map((f) => [f[c('fecha')].slice(5).split('-').reverse().join('/'), f[c('formato')], f[c('categoria')], (f[c('campania')] || '—').replace(' (Marcelino)', '').replace(/ \(madre.*\)/, ''),
        f[c('alcance')], f[c('interacciones')], r1(f[c('ER_alcance_%')]), f[c('guardados')], (f[c('texto')] || '').slice(0, 58)]), fontSize: 10 });
  };
  rank('ig_top10_int', 'Los 10 posts con más interacciones: el sorteo de Casa FOA, el homenaje "Eterno", reels de cocinas y Marcelino', 'RANKING · TOP 10 POSTS DE INSTAGRAM 2026');
  rank('ig_bottom10_int', 'Los 10 posts con menos interacciones: carruseles de marca de junio y reels de mensaje racional', 'RANKING · BOTTOM 10 POSTS DE INSTAGRAM 2026');

  // 18. Sentimiento mensual 100%
  const ig26 = SM.INSTAGRAM_2026, ig25 = SM.INSTAGRAM_2025;
  const etqS = L.MESES.map((m, i) => (i > 9 ? m + '*' : (ig26[i]?.n_analizados || 0) < 3 ? `${m} (n=${ig26[i]?.n_analizados || 0})§` : `${m} (n=${ig26[i].n_analizados})`));
  const ok = (i, k) => (i <= 9 && (ig26[i]?.n_analizados || 0) >= 3 ? ig26[i][k] : null);
  s = L.contenido(ctx, { seccion: SEC, kicker: 'SENTIMIENTO · COMENTARIOS EN INSTAGRAM POR MES',
    titulo: 'El negativo bajó de 88–97% (ene–mar) a 50–83% (ago–oct), pero sigue siendo mayoría en todos los meses medidos',
    fuente: 'Fuente: social_posts (clasificación IA de comentarios scrapeados por post), promedio simple por post, sin sorteos. n = posts analizados. § muestra insuficiente (<3 posts): no se grafica. Facebook sin análisis.' });
  L.barras(ctx, s, { labels: etqS, apilado: true, pct: true, valores: false, series: [
    { name: 'Negativo', values: L.MESES.map((_, i) => ok(i, 'neg')), color: L.P.bad },
    { name: 'Neutral', values: L.MESES.map((_, i) => ok(i, 'neu')), color: L.P.gray },
    { name: 'Positivo', values: L.MESES.map((_, i) => ok(i, 'pos')), color: L.P.good }] });
  L.lectura(ctx, s, { interpretacion: 'Jul–oct mejora (positivo 9–31%), en línea con Marcelino y con piezas que generan comentarios positivos (lavarropas 16-sep: 100% positivo). Mayo y junio casi no tienen posts analizados.',
    implicancia: 'Los comentarios funcionan como canal de reclamos de posventa. Es una muestra scrapeada, no la opinión de toda la audiencia: sirve como alerta, no como índice de marca.', confianza: 'media (clasificación IA, muestra chica por mes)' });

  // 19. 2026 vs 2025 (% negativo)
  s = L.contenido(ctx, { seccion: SEC, kicker: 'SENTIMIENTO · % NEGATIVO 2026 VS 2025',
    titulo: 'Interanualmente el sentimiento no mejoró: 78,5% negativo en 2026 contra 74,9% en jul–dic 2025',
    fuente: 'Fuente: social_posts, Instagram @dreanargentina, promedio simple de % negativo por post, sin sorteos; meses con <3 posts analizados sin graficar. † Oct parcial. * Sin datos.' });
  const neg = (arr, i) => ((arr[i]?.n_analizados || 0) >= 3 ? arr[i].neg : null);
  L.linea(ctx, s, { series: [{ name: '2026', values: L.MESES.map((_, i) => (i <= 9 ? neg(ig26, i) : null)) }, { name: '2025', values: L.MESES.map((_, i) => neg(ig25, i)), color: L.P.gray, ref: true }], unidad: '% negativo', fmt: '0' });
  L.lectura(ctx, s, { interpretacion: 'En 2025 (meses con 3 o más posts analizados) el negativo fue de 65% a 96%. Los niveles son parecidos: no hay mejora estructural, solo meses mejores con contenido específico.',
    implicancia: 'El problema de fondo es de producto y posventa, no de comunicación. Coordinar con Servicio Técnico un circuito para responder los comentarios.', confianza: 'media' });

  // 20. Sentimiento vs competencia
  const sm = filas('sent_ig_marcas').filter((f) => f[1].startsWith('2026')).sort((a, b) => b[4] - a[4]);
  s = L.contenido(ctx, { seccion: SEC, kicker: 'SENTIMIENTO · BENCHMARK DE MARCAS (INSTAGRAM 2026)',
    titulo: 'Drean es la segunda marca con más comentarios negativos (78,5%), solo detrás de Philco (87,6%)',
    fuente: 'Fuente: social_posts, misma clasificación IA para todas las marcas, ene–oct 2026, promedio por post. Samsung y LG no están relevados.' });
  L.barras(ctx, s, { labels: sm.map((f) => nm[f[0]] || f[0]), apilado: true, pct: true, valores: true, fmt: '0', horizontal: true, series: [
    { name: 'Negativo', values: sm.map((f) => f[4]), color: L.P.bad }, { name: 'Positivo', values: sm.map((f) => f[3]), color: L.P.good },
    { name: 'Neutral', values: sm.map((f) => Math.max(0, r1(100 - f[3] - f[4]))), color: L.P.gray }] });
  L.lectura(ctx, s, { interpretacion: 'Whirlpool 38,9% y Gafa 48,8% negativo; Electrolux mejoró de 78,5% (2025) a 57,8% (2026). Drean empeoró levemente (74,9% → 78,5%).',
    implicancia: 'La reputación en comentarios es una desventaja competitiva medible. Electrolux muestra que se puede bajar 20 puntos en un año.', confianza: 'media (clasificación IA)' });

  // 21. Temas
  const tm = filas('sent_drean_temas').filter((f) => f[0] === '2026').sort((a, b) => b[4] - a[4]).slice(0, 7);
  s = L.contenido(ctx, { seccion: SEC, kicker: 'SENTIMIENTO · TEMAS DE LOS COMENTARIOS (2026)',
    titulo: 'Las quejas se concentran en fallas de producto (25 de 60 posts) y servicio técnico (14); lo positivo, en producto y entregas',
    fuente: 'Fuente: social_posts.resumen_sentimiento (resumen IA por post), 60 posts de Instagram con análisis en 2026. Conteo de posts cuyo resumen menciona el tema.' });
  L.barras(ctx, s, { labels: tm.map((f) => f[1]), horizontal: true, series: [
    { name: 'Posts que lo mencionan como negativo', values: tm.map((f) => f[4]), color: L.P.bad },
    { name: 'Como positivo', values: tm.map((f) => f[3]), color: L.P.good }] });
  L.lectura(ctx, s, { interpretacion: 'Ejemplos (anonimizados): "productos defectuosos, mal servicio y falta de repuestos" (1-ago, 155 comentarios); "alegría por el lavarropas" (16-sep, 100% positivo). El 13-oct, lo positivo: diseño y "marca argentina".',
    implicancia: 'Llevar estos temas al comité con Calidad y Posventa: la pauta amplifica la conversación, y hoy amplifica reclamos.', confianza: 'media (resúmenes IA)' });

  // 22. Benchmark IG
  const b = filas('bench_ig'), bc = (n) => col('bench_ig', n);
  s = L.contenido(ctx, { seccion: SEC, kicker: 'BENCHMARK · INSTAGRAM VS COMPETENCIA (MAY–OCT 2026)',
    titulo: 'Drean publica al ritmo de la categoría y tiene engagement medio, pero sus videos se ven 8 a 25 veces menos que los de Electrolux y Gafa',
    fuente: 'Fuente: social_posts + Business Discovery, posts ≥7 días, sin sorteos. ER = (me gusta + comentarios) ÷ seguidores, mediana por post. Views: mediana de videos (incluye reproducciones pagas).' });
  L.tabla(ctx, s, { area: { x: 0.5, y: 1.75, w: 8.6 }, anchos: [1.5, 1.2, 1.4, 1.5, 1.5, 1.5],
    cols: ['Marca', 'Posts/mes', 'Interacc. mediana', 'ER mediano %', 'Views mediana video', 'Seguidores'],
    filas: b.map((f) => [nm[f[0]] || f[0], f[bc('posts_por_mes_may-sep')], f[bc('int_mediana(likes+com)')], f[bc('ER_por_seguidor_mediano_%')], f[bc('views_mediana_video')], f[bc('seguidores_18oct')]]),
    heat: [4], fontSize: 11 });
  L.lectura(ctx, s, { interpretacion: 'Los posts que más rinden en la categoría son de creadores: Gafa "La Nonna" (2,1M views), Electrolux home tour con influencer (157 mil). Drean: 7% de contenido de influencers contra 18% de Electrolux.',
    implicancia: 'Si el objetivo es alcance orgánico de video, probar formatos con creadores o personaje (Marcelino va en esa dirección).', confianza: 'media (views de Business Discovery incluyen pauta)' });
};
