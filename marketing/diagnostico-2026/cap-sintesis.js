// Portada, capítulo 1 (executive), capítulo 5 (campañas integradas), capítulo 6 (conclusiones) y anexos.
// Las cifras citadas salen de datos/*.json (ver cap-social/cap-pauta/cap-web y la matriz de insights).
const L = require('./lib');
const M = require('./matriz');
const W = require('./datos/web.json');
const P = require('./datos/pauta.json');
const SO = require('./datos/social.json');
const ser = (d, id) => d.series.find((s) => s.id === id).meses2026;
const K = (v) => (v == null ? null : Math.round(v / 1000));
const Mi = (v) => (v == null ? null : Math.round(v / 1e6));

function portada(ctx) {
  const { pres } = ctx;
  pres.addSection({ title: 'Inicio' });
  let s = pres.addSlide({ masterName: 'PORTADA', sectionTitle: 'Inicio' });
  s.addText('Diagnóstico integral de Marketing 2026', { placeholder: 'title' });
  s.addText('Drean · Resultados reales enero–septiembre (octubre parcial) · Redes, pauta, web y campañas', { placeholder: 'sub' });

  s = L.contenido(ctx, { seccion: 'Inicio', kicker: 'CÓMO LEER ESTE DIAGNÓSTICO',
    titulo: 'Qué cubre, con qué datos y qué quedó afuera',
    fuente: 'Fuente: base de datos del tablero de Marketing (Supabase), leída el 19-oct-2026. Detalle completo en el registro de limitaciones (anexo).' });
  L.vinetas(ctx, s, [
    ['Período:', 'enero–septiembre 2026 con meses cerrados; octubre parcial (marcado †); noviembre–diciembre sin datos (marcado *). Todos los gráficos mensuales muestran enero–diciembre.'],
    ['Solo resultados reales:', 'no se usan metas ni valores presupuestados como datos ni en los gráficos.'],
    ['Excluidos por pedido:', 'Salud de marca, Top of Mind, Share of Mind, Intención de compra, Cuadros Básicos y Floor Share.'],
    ['Fuentes:', 'Meta Graph API e Instagram Business Discovery (redes), APIs de Meta, DV360 y Google Ads + carga OMD (pauta), GA4 (web), SimilarWeb, Google Ads Keyword Planner, DataForSEO y Biblioteca de anuncios de Meta (competencia).'],
    ['Comparación con 2025:', 'no es posible en pauta (no hay datos antes de abril 2026) ni en web (el tracking actual arranca el 26-nov-2025). Sí en sentimiento de comentarios y en share of search.'],
    ['Montos:', 'pesos nominales; USD solo donde se indica (dólar BCRA del mes).'],
    ['Lectura de cada slide:', 'título = hallazgo; gráfico = evidencia; panel derecho = qué significa y qué decisión habilita, con su nivel de confianza. Hecho, correlación e hipótesis se distinguen en el texto.'],
  ], { x: 0.5, y: 1.75, w: 12.3, h: 4.9 }, 13);
}

function ejecutivo(ctx) {
  const { pres } = ctx;
  const SEC = 'Executive';
  pres.addSection({ title: SEC });
  let s = pres.addSlide({ masterName: 'SECCION', sectionTitle: SEC });
  s.addText('Capítulo 1', { placeholder: 'num' });
  s.addText('Executive marketing performance', { placeholder: 'title' });
  s.addText('2026 fue un año de escala: más inversión, más publicaciones, más tráfico. El desafío que deja es convertir esa escala en venta y en reputación.', { placeholder: 'sub' });

  // KPIs
  const inv = ser(P, 'inv_total_ars').slice(3, 9).reduce((a, b) => a + b, 0);
  const ses = ser(W, 'A_sesiones_wt').slice(0, 9).reduce((a, b) => a + b, 0);
  const comp = ser(W, 'A_compras').slice(0, 9).reduce((a, b) => a + b, 0);
  const ing = ser(W, 'A_ingresos').slice(0, 9).reduce((a, b) => a + b, 0);
  const igInt = ser(SO, 'ig_interactions').slice(0, 9).reduce((a, b) => a + b, 0);
  s = L.contenido(ctx, { seccion: SEC, kicker: 'PANORAMA 2026 (ENE–SEP)',
    titulo: 'El año en cinco números: $1.113M de pauta, 3,7 millones de visitas, 3.805 compras online y una comunidad de Instagram que creció 13%',
    fuente: 'Fuente: modelo de Pauta Mkt del tablero (abr–sep), GA4 (ene–sep), Meta Graph API (ene–sep) e Instagram Business Discovery (seguidores 1-may → 18-oct).' });
  L.kpis(ctx, s, [
    { valor: `$${Math.round(inv / 1e6).toLocaleString('es-AR')}M`, etiqueta: 'Inversión en pauta abr–sep (US$760 mil)' },
    { valor: `${(ses / 1e6).toFixed(1).replace('.', ',')}M`, etiqueta: 'Sesiones en drean.com.ar', delta: '×4,8 enero → septiembre' },
    { valor: comp.toLocaleString('es-AR'), etiqueta: `Compras online · $${Math.round(ing / 1e6).toLocaleString('es-AR')}M`, delta: 'Conversión 0,23% → 0,06%', malo: true },
    { valor: igInt.toLocaleString('es-AR'), etiqueta: 'Interacciones orgánicas en Instagram', delta: '+19.266 seguidores (+13%)' },
    { valor: '78,5%', etiqueta: 'Comentarios negativos en Instagram', delta: '74,9% en jul–dic 2025', malo: true },
  ], { y: 1.9 });
  L.vinetas(ctx, s, [
    ['Escala:', 'la pauta digital llevó el tráfico del sitio de 145 mil a 697 mil sesiones por mes y Meta pasó a video (ThruPlays ×11).'],
    ['Conversión:', 'la venta no siguió al tráfico: 93% de las compras vienen de búsqueda, directo y PMax; la pauta de alcance trae visitas que no compran.'],
    ['Contenido:', 'Marcelino y los reels funcionan; el carrusel y el contenido técnico no. Los sorteos inflan los picos.'],
    ['Reputación:', 'los comentarios son un canal de reclamos de producto y servicio técnico, y la pauta los amplifica.'],
  ], { x: 0.5, y: 3.8, w: 12.3, h: 2.8 }, 14);

  // Relación inversión → tráfico → compras (por mes)
  const meses = [3, 4, 5, 6, 7, 8];
  s = L.contenido(ctx, { seccion: SEC, kicker: 'RELACIÓN · INVERSIÓN, VISITAS Y COMPRAS POR MES (ABR–SEP)',
    titulo: 'Más inversión trae más visitas, pero no más compras: mayo (Hot Sale) vendió casi lo mismo que agosto con un tercio de su inversión digital',
    fuente: 'Fuente: modelo de Pauta Mkt (inversión total, M$) y GA4 (sesiones en miles, compras). Cada punto = un mes, abr–sep 2026. n=6: lectura descriptiva, no estadística.' });
  L.dispersion(ctx, s, { x: meses.map((i) => Mi(ser(P, 'inv_total_ars')[i])), nombreX: 'Inversión en pauta del mes (M$)',
    ys: [{ name: 'Sesiones (miles)', values: meses.map((i) => K(ser(W, 'A_sesiones_wt')[i])), eje: 'Sesiones (miles) · Compras' }, { name: 'Compras', values: meses.map((i) => ser(W, 'A_compras')[i]), color: L.P.accent }], fmtX: '0', fmtY: '0' });
  L.lectura(ctx, s, { interpretacion: 'Mayo: $218M ($90M digital) y 610 compras (Hot Sale). Agosto: $338M ($270M digital) y 679 compras. Septiembre: $198M, el segundo mayor tráfico (697 mil) y 418 compras. Las compras siguen al calendario comercial, no al monto invertido.',
    implicancia: 'Asignar la pauta de conversión por eventos y por canal de intención; evaluar la pauta de alcance con métricas de marca, no de venta online.', confianza: 'media (6 meses, sin modelo de atribución)' });

  // 10 hallazgos
  s = L.contenido(ctx, { seccion: SEC, kicker: 'LOS 10 HALLAZGOS ESTRATÉGICOS DEL AÑO',
    titulo: 'Diez hallazgos que explican el 2026 de Marketing',
    fuente: 'Detalle, evidencia y nivel de confianza de cada hallazgo en los capítulos 2–5 y en la matriz de insights (anexo).' });
  L.tabla(ctx, s, { area: { x: 0.5, y: 1.65, w: 12.3 }, anchos: [0.4, 9.4, 1.3, 1.2], fontSize: 11.5, alinear: { 0: 'center' },
    cols: ['#', 'Hallazgo', 'Tipo', 'Confianza'], filas: M.top10.map((h, i) => [String(i + 1), h.titulo, h.tipo, h.confianza]) });
}

function campanas(ctx) {
  const { pres } = ctx;
  const SEC = 'Campañas';
  pres.addSection({ title: SEC });
  let s = pres.addSlide({ masterName: 'SECCION', sectionTitle: SEC });
  s.addText('Capítulo 5', { placeholder: 'num' });
  s.addText('Campañas y categorías', { placeholder: 'title' });
  s.addText('Cada campaña cruzada en orgánico, pauta y web. Marcelino es la que mejor funciona en redes; ninguna movió la venta online durante su ventana.', { placeholder: 'sub' });

  s = L.contenido(ctx, { seccion: SEC, kicker: 'VISTA COMPARADA DE CAMPAÑAS',
    titulo: 'Marcelino funciona en orgánico y en video pago; Casa FOA vive del sorteo; ninguna campaña generó ventas online atribuibles',
    fuente: 'Fuentes: Meta Graph API (orgánico IG, índice vs base de 64,6 interacciones/post), API de Meta (pauta), GA4 (sesiones y compras por UTM). — = sin dato en esa fuente.' });
  L.tabla(ctx, s, { area: { x: 0.5, y: 1.65, w: 12.3 }, anchos: [2.4, 1.6, 2.6, 2.6, 1.6, 1.5], fontSize: 12,
    cols: ['Campaña', 'Orgánico IG (índice int./post)', 'Pauta (resultado clave)', 'Web (sesiones / compras)', 'Sentimiento', 'Veredicto'],
    filas: M.campanas.map((c) => [c.nombre, c.organico, c.pauta, c.web, c.sentimiento, c.veredicto]) });

  M.campanas.forEach((c) => {
    s = L.contenido(ctx, { seccion: SEC, kicker: `FICHA DE CAMPAÑA · ${c.nombre.toUpperCase()}`, titulo: c.titulo, fuente: c.fuente });
    const filas = [['Orgánico', c.ficha.organico], ['Pauta', c.ficha.pauta], ['Web', c.ficha.web], ['Fortalezas', c.ficha.fortalezas], ['Debilidades', c.ficha.debilidades], ['Aprendizaje', c.ficha.aprendizaje]];
    L.tabla(ctx, s, { area: { x: 0.5, y: 1.7, w: 12.3 }, anchos: [1.8, 10.5], cols: ['', ''], filas, fontSize: 14 });
  });

  // Categorías transversal
  s = L.contenido(ctx, { seccion: SEC, kicker: 'CATEGORÍAS · VISIÓN TRANSVERSAL',
    titulo: 'Lavado domina búsqueda, tráfico y venta; Cocción es la más eficiente en contenido; Refrigeración crece en tráfico pero rinde menos en redes',
    fuente: 'Fuentes: Meta Graph API (IG 2026), GA4 (sesiones de entrada e ingresos por ítem ene–sep), Google Ads Keyword Planner (share of search agosto).' });
  L.tabla(ctx, s, { area: { x: 0.5, y: 1.7, w: 12.3 }, anchos: [1.8, 2.1, 2.0, 2.2, 2.2, 2.0], fontSize: 13,
    cols: ['Categoría', 'IG int./post (guardados)', 'Sesiones ene→sep', 'Ingresos online (% ítems)', 'Share of search ago', 'Lectura'],
    filas: M.categorias });
}

function conclusiones(ctx) {
  const { pres } = ctx;
  const SEC = 'Conclusiones';
  pres.addSection({ title: SEC });
  let s = pres.addSlide({ masterName: 'SECCION', sectionTitle: SEC });
  s.addText('Capítulo 6', { placeholder: 'num' });
  s.addText('Conclusiones y aprendizajes estratégicos', { placeholder: 'title' });
  s.addText('Ordenadas por importancia estratégica, impacto potencial y solidez de la evidencia.', { placeholder: 'sub' });

  M.conclusiones.forEach((b) => {
    s = L.contenido(ctx, { seccion: SEC, kicker: b.kicker, titulo: b.titulo, fuente: b.fuente });
    L.tabla(ctx, s, { area: { x: 0.5, y: 1.7, w: 12.3 }, anchos: [3.6, 6.9, 1.8], cols: b.cols, filas: b.filas, fontSize: 13 });
  });
}

function anexos(ctx) {
  const { pres } = ctx;
  const SEC = 'Anexos';
  pres.addSection({ title: SEC });
  let s = pres.addSlide({ masterName: 'SECCION', sectionTitle: SEC });
  s.addText('Anexos', { placeholder: 'num' });
  s.addText('Matriz de insights y registro de limitaciones', { placeholder: 'title' });
  s.addText('Las tablas de datos y cálculos que sustentan cada gráfico están en el anexo analítico (Excel).', { placeholder: 'sub' });

  const porPag = 5;
  for (let i = 0; i < M.matriz.length; i += porPag) {
    s = L.contenido(ctx, { seccion: SEC, kicker: `MATRIZ DE INSIGHTS (${i / porPag + 1}/${Math.ceil(M.matriz.length / porPag)})`,
      titulo: 'Hallazgo, evidencia, comparación, interpretación, implicancia y confianza', fuente: 'Ids de evidencia = series y tablas del anexo analítico (Excel).' });
    L.tabla(ctx, s, { area: { x: 0.5, y: 1.6, w: 12.3 }, anchos: [2.3, 2.6, 1.7, 2.3, 2.3, 1.1], fontSize: 10,
      cols: ['Hallazgo', 'Evidencia', 'Comparación', 'Interpretación', 'Implicancia', 'Confianza'],
      filas: M.matriz.slice(i, i + porPag).map((m) => [m.hallazgo, m.evidencia, m.comparacion, m.interpretacion, m.implicancia, m.confianza]) });
  }
  const pp = 7;
  for (let i = 0; i < M.limitaciones.length; i += pp) {
    s = L.contenido(ctx, { seccion: SEC, kicker: `REGISTRO DE LIMITACIONES (${i / pp + 1}/${Math.ceil(M.limitaciones.length / pp)})`,
      titulo: 'Información faltante, benchmarks no disponibles y comparaciones no válidas', fuente: 'Detalle por área en limitaciones.md del anexo.' });
    L.tabla(ctx, s, { area: { x: 0.5, y: 1.6, w: 12.3 }, anchos: [1.4, 3.6, 4.2, 3.1], fontSize: 11,
      cols: ['Área', 'Limitación', 'Efecto en el diagnóstico', 'Cómo resolverlo'], filas: M.limitaciones.slice(i, i + pp) });
  }
}

module.exports = { portada, ejecutivo, campanas, conclusiones, anexos };
