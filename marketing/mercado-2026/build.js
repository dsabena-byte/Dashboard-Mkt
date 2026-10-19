// Market Intelligence & Competitive Performance 2026 — Drean (PPT ejecutiva, ~17 slides).
// Datos: datos/mercado.json (lo arma analisis.py desde el extracto GfK de mercado_share del 19-oct-2026).
// Build: NODE_PATH=<dir con pptxgenjs>/node_modules SKILL=<skill pptx> node build.js salida.pptx
const L = require('../diagnostico-2026/lib');
const I = require('./insights');
const O = require('./datos/mercado.json');
const { P } = L;
const ctx = L.nuevo({ titulo: 'Market Intelligence 2026 · Drean', pieTexto: 'Drean · Market Intelligence & Competitive Performance 2026' });
const { pres } = ctx;
const CATS = ['Lavado', 'Refrigeración', 'Cocción'];
const C = (cat) => O.categorias[cat];
const T = (cat, b) => C(cat).tabla[b];
const FUENTE = 'Fuente: GfK (Brands Timeseries) cargado en el tablero de Mercado; extracto del 19-oct-2026. MAT = acumulado móvil 12 meses. Último mes disponible: jul-2026. Ranking sin contar "Otras".';
const nom = (b) => ({ 'Tradebrands and exclusives': 'Marcas propias', Others: 'Otras', BGH: 'BGH', LG: 'LG', TCL: 'TCL', 'GE(MABE)': 'GE (Mabe)' }[b] || b.charAt(0) + b.slice(1).toLowerCase());
const pp = (x) => (x == null ? '—' : (x > 0 ? '+' : '') + x.toFixed(1).replace('.', ',') + ' pp');
const n1 = (x) => (x == null ? '—' : x.toFixed(1).replace('.', ','));
const ins = (id) => I.find((x) => x.id === id);

// Barras divergentes (ganancias/pérdidas): eje sin piso en 0, verde/rojo solo como estado.
function divergente(s, { labels, values, area = L.AREA, fmt = '+0.0;-0.0' }) {
  s.addChart(pres.charts.BAR, [{ name: 'Δ pp', labels, values }], { ...L.AX(), ...area, valAxisMinVal: undefined,
    barDir: 'bar', catAxisOrientation: 'maxMin', valAxisHidden: true, valGridLine: { style: 'none' }, barGapWidthPct: 45,
    chartColors: values.map((v) => (v >= 0 ? P.good : P.bad)), showLegend: false, showValue: true,
    dataLabelPosition: 'outEnd', dataLabelFormatCode: fmt, invertIfNegative: false, catAxisLabelFontSize: 10, catAxisLabelPos: 'low' });
}
function seccion(num, titulo, sub) {
  pres.addSection({ title: titulo });
  const s = pres.addSlide({ masterName: 'SECCION', sectionTitle: titulo });
  s.addText(num, { placeholder: 'num' }); s.addText(titulo, { placeholder: 'title' }); s.addText(sub, { placeholder: 'sub' });
}
const lect = (s, id, extra = {}) => L.lectura(ctx, s, { interpretacion: ins(id).interpretacion, implicancia: ins(id).implicancia, confianza: `${ins(id).confianza.toLowerCase()} · ${ins(id).tipo.toLowerCase()}`, ...extra });

// ── Portada ──
pres.addSection({ title: 'Inicio' });
let s = pres.addSlide({ masterName: 'PORTADA', sectionTitle: 'Inicio' });
s.addText('Market Intelligence & Competitive Performance 2026', { placeholder: 'title' });
s.addText('Drean · Lavado, Refrigeración y Cocción · GfK enero–julio 2026 vs 2025 e histórico', { placeholder: 'sub' });

// ── 1. Resumen ejecutivo ──
s = L.contenido(ctx, { seccion: 'Inicio', kicker: 'RESUMEN EJECUTIVO',
  titulo: 'Drean lidera Lavado y Refrigeración, pero pierde share en Lavado frente a retadores de precio; Cocción es su motor de crecimiento',
  fuente: FUENTE });
L.kpis(ctx, s, CATS.map((cat) => {
  const t = T(cat, 'DREAN').us, rank = C(cat).marcas.filter((b) => b !== 'Others').indexOf('DREAN') + 1;
  return { valor: n1(t.mat26) + '%', etiqueta: `${cat} · share en unidades MAT jul-26 (#${rank})`, delta: pp(t.d_mat) + ' vs MAT jul-25', malo: t.d_mat < 0 };
}), { y: 1.8 });
L.vinetas(ctx, s, [
  ['Lavado:', 'líder con 26,6%, pero −6,1 pp en un año y caída sostenida desde 2024. Philco quedó a 10,4 pp (a 2 pp en junio). La mayor pérdida está en el segmento bajo (−15,8 pp).'],
  ['Refrigeración:', 'líder con 18,5%. La caída se frenó: el MAT sube desde mayo y julio dio 20,2% (+5,0 pp vs jul-25). Drean es fuerte en el segmento sin no-frost y casi no tiene presencia en no-frost.'],
  ['Cocción:', 'de 3,0% a 9,9% en un año (+6,9 pp en unidades y +8,4 pp en valor), con precio premium (índice 122). El líder Escorial cede −7,6 pp.'],
  ['Mercado:', 'Philco gana en las tres categorías; Samsung y Whirlpool retroceden; los segmentos premium (carga alta, no-frost) los ganan marcas con precio 16–25% bajo el mercado.'],
  ['Precio:', 'Drean es premium dentro de cada segmento, pero su índice total en Lavado (98) y Refrigeración (88) queda bajo 100 por su mezcla de segmentos.'],
], { x: 0.5, y: 3.65, w: 12.3, h: 3.0 }, 13);

// ── 2. Alcance y calidad del dato ──
s = L.contenido(ctx, { seccion: 'Inicio', kicker: 'CÓMO LEER ESTE DIAGNÓSTICO',
  titulo: 'Qué permiten los datos de mercado y qué no: no hay volúmenes absolutos, así que el share global no se puede calcular',
  fuente: FUENTE + ' Validación: el índice de precio coincide con share en valor ÷ share en unidades × 100 (mediana de la diferencia 0,0; 3.142 filas).' });
L.tabla(ctx, s, { cols: ['Qué pide el análisis', 'Disponible', 'Cómo se resolvió'], anchos: [3.6, 2.6, 6.1], fontSize: 11, area: { x: 0.5, y: 1.75, w: 12.3 }, filas: [
  ['Share en unidades y en valor, índice de precio', 'Sí, por marca', 'GfK mensual y MAT; Total y 3 segmentos por categoría.'],
  ['Volumen, facturación y precio promedio del mercado', 'No', 'La base guarda solo shares. Falta la fila "Market" de GfK: no hay tamaño ni evolución del mercado.'],
  ['Mercado global (suma de categorías) e índice ponderado', 'No', 'Sin volúmenes no se puede ponderar. Se presenta la posición de Drean categoría por categoría.'],
  ['Meses de 2026', 'Ene–jul', 'Ago–dic sin datos (marcados con *). Agosto y septiembre todavía no están cargados.'],
  ['Mismo mes 2025', 'Parcial', 'Lavado total: unidades ene–jul (abril sin dato). Refrigeración y Cocción total: solo julio. Segmentos: desde abril.'],
  ['YTD 2026 vs YTD 2025', 'No', 'Requiere unidades por mes. Se usa el MAT (12 meses) a jul-26 vs jul-25, que no promedia shares.'],
  ['vs dic-2025 e histórico', 'Sí', 'Mensual jul-26 vs dic-25; MAT desde 2023–2024.'],
  ['Real vs nominal', 'No aplica', 'El share y el índice de precio son relativos: no dependen de la inflación.'],
] });

// ── 3. Global ──
seccion('Capítulo 1', 'Mercado global y posición de Drean', 'Lectura por categoría. Sin volúmenes de mercado no se puede consolidar un total global, así que no se suman ni se promedian shares.');
s = L.contenido(ctx, { seccion: 'Mercado global y posición de Drean', kicker: 'POSICIÓN GLOBAL DE DREAN',
  titulo: 'Drean es #1 en unidades en Lavado y Refrigeración y #3 en Cocción; pierde en las dos primeras y gana en Cocción',
  fuente: FUENTE + ' Índice de precio = precio promedio de Drean ÷ precio promedio del mercado × 100 (GfK, unidades).' });
const filasG = [];
for (const cat of CATS) for (const [k, lab] of [['us', 'Share unidades'], ['vs', 'Share valor'], ['pi', 'Índice de precio']]) {
  const t = T(cat, 'DREAN')[k], u = k === 'pi' ? ' pts' : ' pp', f = (x) => (x == null ? '—' : (x > 0 ? '+' : '') + n1(x) + u);
  filasG.push([cat, lab, n1(t.mat25), n1(t.mat26), f(t.d_mat), n1(t.jul26), f(t.d_jul25), f(t.d_dic25)]);
}
L.tabla(ctx, s, { cols: ['Categoría', 'Métrica', 'MAT jul-25', 'MAT jul-26', 'Δ MAT', 'Jul-26 (mes)', 'vs jul-25', 'vs dic-25'],
  anchos: [1.4, 1.5, 0.95, 0.95, 1.0, 1.05, 0.9, 0.9], fontSize: 10, area: { x: 0.5, y: 1.75, w: 8.65 }, filas: filasG,
  alinear: [null, null, 'right', 'right', 'right', 'right', 'right', 'right'] });
L.lectura(ctx, s, { interpretacion: 'Las tres categorías van en direcciones distintas: Lavado cae, Refrigeración se estabiliza y Cocción crece. Un promedio global escondería esto.',
  implicancia: 'Gestionar con una estrategia por categoría. Para tener un número global, cargar el volumen de mercado de GfK (hallazgo 18).', confianza: 'alta · hecho' });

// ── 4. Ganadores y perdedores ──
s = L.contenido(ctx, { seccion: 'Mercado global y posición de Drean', kicker: 'GANADORES Y PERDEDORES',
  titulo: 'Philco, Midea y Drean en Cocción son los que más ganan; Drean en Lavado, Escorial, Samsung y Whirlpool los que más pierden',
  fuente: FUENTE + ' Δ = share en unidades MAT jul-26 menos MAT jul-25. Sin "Otras" ni marcas propias.' });
const movs = [];
for (const cat of CATS) for (const b of C(cat).marcas) { const d = T(cat, b).us.d_mat; if (d != null && !['Others', 'Tradebrands and exclusives'].includes(b)) movs.push([`${nom(b)} · ${cat}`, d]); }
movs.sort((a, b) => b[1] - a[1]);
const sel = [...movs.slice(0, 7), ...movs.slice(-7)];
divergente(s, { labels: sel.map((x) => x[0]), values: sel.map((x) => x[1]) });
L.lectura(ctx, s, { interpretacion: 'Las ganancias se concentran en retadores de precio (Philco, Midea, Smartlife, BGH) y en Drean en Cocción. Las pérdidas, en líderes históricos (Drean en Lavado, Escorial) y en premium globales (Samsung, Whirlpool).',
  implicancia: 'El mapa competitivo se mueve hacia el precio. Drean es ganador en una categoría y perdedor en otra.', confianza: 'alta · hecho' });

// ── Mercados ──
function mercado(cat, num, sub, a, b) {
  seccion(num, cat, sub);
  const c = C(cat), d = c.mensual.DREAN;
  // A: evolución mensual 2026 vs 2025 + valor + histórico MAT
  let s = L.contenido(ctx, { seccion: cat, kicker: `${cat.toUpperCase()} · EVOLUCIÓN DE DREAN`, titulo: a.titulo,
    fuente: FUENTE + ' Línea gris = mismo mes 2025 (donde hay dato). * = sin datos.' });
  L.linea(ctx, s, { unidad: 'share %', fmt: '0.0', area: { x: 0.5, y: 1.75, w: 5.6, h: 4.85 }, series: [
    { name: 'Unidades 2026', values: d.us['2026'], color: P.navy },
    { name: 'Valor 2026', values: d.vs['2026'], color: P.blue },
    { name: 'Unidades 2025', values: d.us['2025'], color: P.gray, ref: true }] });
  const top = c.marcas.filter((x) => !['Others', 'Tradebrands and exclusives'].includes(x)).slice(0, 4);
  s.addChart(pres.charts.LINE, top.map((b, i) => ({ name: nom(b), labels: c.mat_meses.map((m) => L.MESES[+m.slice(5, 7) - 1] + ' ' + m.slice(2, 4)), values: c.mat[b].us })),
    { ...L.AX(), x: 6.15, y: 1.75, w: 3.05, h: 4.85, chartColors: top.map((b, i) => (b === 'DREAN' ? P.navy : [P.accent, P.sky, P.gray, '0D9488'][i % 4])),
      lineSize: 1.75, lineDataSymbol: 'none', showLegend: true, legendPos: 'b', legendFontSize: 9, catAxisLabelFontSize: 8, displayBlanksAs: 'gap',
      showTitle: true, title: 'Share unidades MAT', titleFontSize: 10, titleColor: P.muted });
  lect(s, a.ins);
  // B: competidores y segmentos
  s = L.contenido(ctx, { seccion: cat, kicker: `${cat.toUpperCase()} · COMPETIDORES Y SEGMENTOS`, titulo: b.titulo,
    fuente: FUENTE + ' Segmentos según GfK: ' + b.segs + '.' });
  const filas = c.marcas.slice(0, 10).map((m) => { const t = T(cat, m); return [nom(m), t.us.mat26, t.us.d_mat, t.vs.mat26, t.vs.d_mat, t.pi.mat26, t.pi.d_mat]; });
  filas.forEach((f) => { f.__fmt = { 1: n1, 2: (x) => pp(x).replace(' pp', ''), 3: n1, 4: (x) => pp(x).replace(' pp', ''), 5: (x) => String(x), 6: (x) => (x > 0 ? '+' : '') + x }; });
  L.tabla(ctx, s, { cols: ['Marca (MAT jul-26)', 'Unid. %', 'Δ pp', 'Valor %', 'Δ pp', 'Índ. precio', 'Δ pts'], anchos: [1.75, 0.75, 0.7, 0.75, 0.7, 0.85, 0.7],
    area: { x: 0.5, y: 1.75, w: 6.2 }, fontSize: 9, heat: [1], filas });
  const segF = ['Low', 'Mid', 'High'].map((sg) => { const z = c.segmentos[sg], t = z.tabla.DREAN, lider = z.marcas.find((x) => x !== 'Others');
    return [b.nombres[sg], t ? n1(t.us.mat26) + '%' : '—', t ? pp(t.us.d_mat) : '—', t ? String(t.pi.mat26) : '—', t ? '#' + (z.marcas.filter((x) => x !== 'Others').indexOf('DREAN') + 1) : '—', lider === 'DREAN' ? 'Drean' : `${nom(lider)} ${n1(z.tabla[lider].us.mat26)}%`]; });
  s.addText('Drean por segmento (MAT jul-26)', { x: 6.9, y: 1.75, w: 5.9, h: 0.3, fontSize: 11, bold: true, color: P.navy, margin: 0 });
  L.tabla(ctx, s, { cols: ['Segmento', 'Share', 'Δ', 'Índ.', 'Rank', 'Líder'], anchos: [1.35, 0.75, 1.0, 0.55, 0.6, 1.65], area: { x: 6.9, y: 2.1, w: 5.9 }, fontSize: 9, filas: segF,
    alinear: [null, 'right', 'right', 'right', 'right', 'left'] });
  s.addText(b.bullets.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < b.bullets.length - 1, paraSpaceAfter: 6 } })),
    { x: 6.9, y: 3.6, w: 5.9, h: 3.0, fontSize: 11, color: P.ink, valign: 'top', margin: 0 });
}

mercado('Lavado', 'Capítulo 2', 'Drean lidera, pero el share cae desde 2024 y Philco se acerca. El segmento bajo concentra la pérdida.',
  { titulo: 'Lavado: Drean cayó a 26,6% de share (−6,1 pp en el año) y cada mes de 2026 quedó debajo de 2025', ins: 1 },
  { titulo: 'Lavado: Philco +9,2 pp y nuevo líder de carga alta; Drean pierde 15,8 pp en el segmento bajo con precio en alza',
    segs: 'bajo hasta 7,4 kg · medio 7,5–8,9 kg · alto 9 kg o más (automáticos)', nombres: { Low: 'Bajo (≤7,4 kg)', Mid: 'Medio (7,5–8,9)', High: 'Alto (≥9 kg)' },
    bullets: [ins(3).evidencia, ins(5).evidencia, 'Índice de precio de Drean en el segmento bajo: 103 → 109 mientras perdía share. Es una correlación, no prueba causa.'] });
mercado('Refrigeración', 'Capítulo 3', 'Drean lidera y la caída se frenó en 2026. Es fuerte en el segmento sin no-frost y casi no está en no-frost.',
  { titulo: 'Refrigeración: la caída se frenó; julio 2026 dio 20,2% de share (+5,0 pp vs jul-25) y el año móvil vuelve a subir', ins: 8 },
  { titulo: 'Refrigeración: Drean es líder y premium sin no-frost (28,7%, índice 117), pero marginal en no-frost, donde ganan Philco y BGH',
    segs: 'bajo = sin no-frost · medio = no-frost 1–2 puertas freezer arriba · alto = no-frost side by side, 3+ puertas o freezer abajo', nombres: { Low: 'Sin no-frost', Mid: 'No-frost medio', High: 'No-frost alto' },
    bullets: [ins(10).evidencia, ins(11).evidencia, 'Índice total 88: Drean vende por debajo del precio promedio porque su mezcla está en el segmento básico (hallazgo 15).'] });
mercado('Cocción', 'Capítulo 4', 'La categoría donde Drean más crece, con precio premium y foco en los anchos de más valor.',
  { titulo: 'Cocción: Drean triplicó su share en un año (3,0% → 9,9%) y en valor ya tiene 12,1%', ins: 12 },
  { titulo: 'Cocción: Drean crece con precio premium en los segmentos medio y alto mientras el líder Escorial pierde 7,6 pp',
    segs: 'bajo hasta 54 cm · medio 55–56 cm · alto 57 cm o más', nombres: { Low: 'Bajo (≤54 cm)', Mid: 'Medio (55–56)', High: 'Alto (≥57 cm)' },
    bullets: [ins(13).evidencia, ins(14).evidencia] });

// ── 5. Transversal ──
seccion('Capítulo 5', 'Análisis transversal', 'Matriz competitiva, precio y dinámica del mercado.');
s = L.contenido(ctx, { seccion: 'Análisis transversal', kicker: 'MATRIZ COMPETITIVA ENTRE MERCADOS',
  titulo: 'Philco es el único competidor que gana en las tres categorías; Samsung y Whirlpool pierden en todas donde compiten',
  fuente: FUENTE + ' Δ share en unidades MAT jul-26 vs jul-25 (pp) e índice de precio MAT jul-26. "—" = la marca no figura en esa categoría.' });
const marcasX = ['DREAN', 'PHILCO', 'SAMSUNG', 'WHIRLPOOL', 'MIDEA', 'BGH', 'SMARTLIFE', 'LG', 'ELECTROLUX', 'GAFA', 'ESCORIAL', 'FLORENCIA'];
const filasX = marcasX.map((b) => { const f = [nom(b)]; for (const cat of CATS) { const t = T(cat, b); f.push(t?.us.d_mat ?? '—', t?.us.mat26 ?? '—', t?.pi.mat26 ?? '—'); } return f; });
filasX.forEach((f) => { f.__fmt = { 1: (x) => pp(x).replace(' pp', ''), 4: (x) => pp(x).replace(' pp', ''), 7: (x) => pp(x).replace(' pp', ''), 2: n1, 5: n1, 8: n1 }; });
L.tabla(ctx, s, { cols: ['Marca', 'Lav. Δ', 'Lav. %', 'Lav. índ.', 'Refri Δ', 'Refri %', 'Refri índ.', 'Cocc. Δ', 'Cocc. %', 'Cocc. índ.'],
  anchos: [1.35, 0.8, 0.75, 0.8, 0.8, 0.75, 0.8, 0.8, 0.75, 0.8], area: { x: 0.5, y: 1.75, w: 8.4 }, fontSize: 9, heat: [1, 4, 7], filas: filasX });
lect(s, 16, { interpretacion: ins(16).interpretacion + ' ' + ins(17).interpretacion });

s = L.contenido(ctx, { seccion: 'Análisis transversal', kicker: 'PRICING',
  titulo: 'Drean es premium dentro de cada segmento, pero su índice total en Lavado y Refrigeración queda bajo 100 por la mezcla',
  fuente: FUENTE + ' Índice de precio de Drean, MAT jul-26. Base 100 = precio promedio del mercado (o del segmento). Sin barra: Drean con menos de 1% de share en ese segmento (Cocción bajo: 0,1%).' });
const segN = { Low: 'Segmento bajo', Mid: 'Segmento medio', High: 'Segmento alto' };
L.barras(ctx, s, { labels: CATS, fmt: '0', series: [
  { name: 'Total categoría', values: CATS.map((c) => T(c, 'DREAN').pi.mat26), color: P.navy },
  ...['Low', 'Mid', 'High'].map((sg, i) => ({ name: segN[sg], values: CATS.map((c) => { const t = C(c).segmentos[sg].tabla.DREAN; return t && t.us.mat26 >= 1 ? t.pi.mat26 : null; }), color: [P.blue, P.sky, P.gray][i] }))] });
lect(s, 15);

s = L.contenido(ctx, { seccion: 'Análisis transversal', kicker: 'DINÁMICA COMPETITIVA',
  titulo: 'Los segmentos premium cambian de manos: los mayores avances son de Philco y BGH, con precios 16–25% bajo el mercado; Samsung y Whirlpool pierden 11 a 18 pp',
  fuente: FUENTE + ' Segmento alto de cada categoría, Δ share en unidades MAT jul-26 vs jul-25.' });
const alto = [];
for (const cat of ['Lavado', 'Refrigeración']) { const z = C(cat).segmentos.High; for (const b of z.marcas) { const t = z.tabla[b]; if (t.us.d_mat != null && Math.abs(t.us.d_mat) >= 2 && b !== 'Others') alto.push([`${nom(b)} · ${cat} (índ. ${t.pi.mat26})`, t.us.d_mat]); } }
alto.sort((a, b) => b[1] - a[1]);
divergente(s, { labels: alto.map((x) => x[0]), values: alto.map((x) => x[1]) });
lect(s, 11, { interpretacion: ins(5).interpretacion + ' ' + ins(11).interpretacion });

// ── 6. Hallazgos e implicancias ──
seccion('Capítulo 6', 'Hallazgos e implicancias', 'Qué dicen los datos y qué decisiones habilitan para 2027.');
s = L.contenido(ctx, { seccion: 'Hallazgos e implicancias', kicker: 'HALLAZGOS CLAVE',
  titulo: 'Diez hallazgos con evidencia: la matriz completa de 18 está en el anexo',
  fuente: FUENTE + ' Tipo: hecho = dato medido; correlación = coincidencia temporal (no prueba causa).' });
L.tabla(ctx, s, { cols: ['#', 'Mercado', 'Hallazgo', 'Tipo', 'Confianza'], anchos: [0.4, 1.4, 8.3, 1.2, 1.0], area: { x: 0.5, y: 1.75, w: 12.3 }, fontSize: 10,
  filas: [1, 2, 3, 4, 5, 8, 10, 12, 15, 16].map((id) => { const x = ins(id); return [String(id), x.mercado, x.hallazgo, x.tipo, x.confianza]; }) });

s = L.contenido(ctx, { seccion: 'Hallazgos e implicancias', kicker: 'IMPLICANCIAS 2027',
  titulo: 'Defender Lavado frente a Philco, entrar en no-frost y escalar Cocción sin resignar precio', fuente: FUENTE });
L.vinetas(ctx, s, [
  ['Lavado (defender):', 'plan específico para el segmento bajo y la carga alta frente a Philco. Revisar precio relativo, surtido y promoción por canal. Antes, validar con sell-out la hipótesis de que la brecha de precio explica la pérdida (hallazgos 3–5).'],
  ['Refrigeración (crecer donde no está):', 'Drean es líder solo en el segmento sin no-frost. La recuperación de 2026 hay que sostenerla, y el crecimiento estructural pasa por no-frost, donde el premium se está abaratando (hallazgos 8, 10 y 11).'],
  ['Cocción (escalar):', 'mantener inversión y surtido en 55–57 cm o más, cuidando el índice premium (122). Seguir a Escorial en el segmento medio (hallazgos 12–14).'],
  ['Precio:', 'medir y fijar objetivos de índice de precio por segmento, no por total: el total esconde la mezcla (hallazgo 15).'],
  ['Competencia:', 'seguimiento mensual dedicado a Philco en las tres categorías (hallazgo 16).'],
  ['Medición (condición previa):', 'cargar agosto y septiembre de GfK, la fila "Market" (unidades y facturación) y ene–jun 2025 mensual de Refrigeración y Cocción. Así habrá share global, YTD y tamaño de mercado (hallazgo 18).'],
], { x: 0.5, y: 1.75, w: 12.3, h: 4.9 }, 13);

// ── Anexo ──
seccion('Anexo', 'Metodología y limitaciones', 'Fuentes, definiciones, validaciones y vacíos de la base.');
s = L.contenido(ctx, { seccion: 'Metodología y limitaciones', kicker: 'METODOLOGÍA',
  titulo: 'Definiciones, validaciones y vacíos de la base de mercado', fuente: FUENTE });
L.vinetas(ctx, s, [
  ['Fuente:', 'exports "Brands Timeseries" de GfK cargados a mano en la tabla mercado_share (9.311 filas). Share en unidades, share en valor e índice de precio (unidades), por marca, categoría y segmento, mensual y MAT.'],
  ['Consolidación:', 'el Total de cada categoría es un pull aparte de GfK, no la suma de los segmentos. No se promedian shares. Sin volúmenes, no hay total global ni índice ponderado.'],
  ['Validaciones:', 'cada mes suma 100% (Total 2026); no hay duplicados; el índice de precio coincide con share en valor ÷ share en unidades × 100. Se excluyen las filas MAT de nov-2026 (proyección, no dato).'],
  ['Comparabilidad:', 'Lavado total ene-24 a jun-25 sin share en valor ni índice. Refrigeración y Cocción MAT antes de jul-25 con menos marcas listadas (suma 78–89%); el share de Drean es comparable. Cocción alto se redefinió (57 cm o más) en ago-2026. El total de Lavado podría incluir semiautomáticos (los segmentos son automáticos): sin verificar.'],
  ['Mensual vs MAT:', 'el mensual es volátil (un mes con promoción mueve 3–5 pp); las conclusiones de tendencia se apoyan en el MAT.'],
  ['Inflación:', 'no aplica: share e índice de precio son relativos. Correlación no es causalidad: las coincidencias temporales se marcan como tales.'],
], { x: 0.5, y: 1.75, w: 12.3, h: 4.9 }, 12);

L.guardar(ctx, process.argv[2] || 'market-intelligence-2026.pptx').then(() => console.log('ok'));
