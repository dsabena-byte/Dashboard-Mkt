// Deck "Indicadores de marketing" con el formato aprobado (ver formato.js). Datos: datos-2026-09.json
// (snapshot de getSeguimientoKpis/getSeguimientoObjetivos, base de producción). Los textos de las cards
// citan esos mismos números. Build: NODE_PATH=<dir con pptxgenjs>/node_modules SKILL=<skill pptx> node build.js
const path = require('path');
const pptxgen = require('pptxgenjs');
const { applyTheme } = require(process.env.SKILL + '/scripts/apply_theme.js');
const D = require('./datos-2026-09.json');

const THEME = { name: 'Drean Indicadores', headFontFace: 'Arial', bodyFontFace: 'Arial',
  colors: { dk1:'0F172A', lt1:'FFFFFF', dk2:'1E40AF', lt2:'F1F5F9', accent1:'1E40AF', accent2:'94A3B8',
    accent3:'16A34A', accent4:'D97706', accent5:'DC2626', accent6:'64748B', hlink:'1E40AF', folHlink:'64748B' } };
const VERDE = '16A34A', AMBAR = 'D97706', ROJO = 'DC2626', AZUL = '1E40AF';
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const pres = new pptxgen(); pres.layout = 'LAYOUT_WIDE';
pres.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial' };
pres.title = 'Indicadores de marketing · Drean · 2026';
const C = pres.SchemeColor;
pres.defineSlideMaster({ title: 'PORTADA', background: { color: 'FFFFFF' },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 2.6, w: 12.1, h: 1.2, fontSize: 44, bold: true, color: C.text1, valign: 'bottom', align: 'left', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'sub', type: 'body', x: 0.6, y: 3.9, w: 12.1, h: 0.9, fontSize: 18, color: C.accent6, valign: 'top', margin: 0 }, text: '' } },
    { text: { text: 'Drean · Marketing', options: { x: 0.6, y: 7.0, w: 6, h: 0.3, fontSize: 10, color: C.accent6, margin: 0 } } },
  ] });
pres.defineSlideMaster({ title: 'GRAFICO_CARDS', background: { color: 'FFFFFF' },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.4, w: 12.1, h: 0.7, fontSize: 32, bold: true, color: C.text1, valign: 'top', align: 'left', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'sub', type: 'body', x: 0.6, y: 1.1, w: 12.1, h: 0.4, fontSize: 14, color: C.accent6, margin: 0 }, text: '' } },
    { text: { text: 'Drean · Marketing', options: { x: 0.6, y: 7.0, w: 6, h: 0.3, fontSize: 10, color: C.accent6, margin: 0 } } },
  ], slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: C.accent6, align: 'right' } });

const CHART_BASE = () => ({ x: 0.6, y: 1.8, w: 8.3, h: 4.9, legendPos: 't', legendFontSize: 11, legendFontFace: '+mn-lt',
  catAxisLabelColor: '64748B', valAxisLabelColor: '64748B', catAxisLabelFontSize: 11, valAxisLabelFontSize: 11,
  catAxisLabelFontFace: '+mn-lt', valAxisLabelFontFace: '+mn-lt',
  valGridLine: { color: 'E2E8F0', size: 0.5 }, catGridLine: { style: 'none' }, valAxisMinVal: 0,
  showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 10, dataLabelColor: '0F172A', dataLabelFontFace: '+mn-lt' });

// Meses [desde, hasta] (índices 0-11) de un KPI, escalados por `div` y redondeados a `dec`.
const serie = (arr, desde, hasta, div = 1, dec = 0) =>
  arr.slice(desde, hasta + 1).map((v) => (v == null ? null : +(v / div).toFixed(dec)));

let n = 0;
function slide({ titulo, sub, labels, real, meta, fmt = '0', cards, notas, horizontal, dentro }) {
  const s = pres.addSlide({ masterName: 'GRAFICO_CARDS', sectionTitle: 'Indicadores' });
  s.addText(titulo, { placeholder: 'title' });
  s.addText(sub, { placeholder: 'sub' });
  const bar = { type: pres.charts.BAR, data: [{ name: 'Real', labels, values: real }],
    options: { chartColors: [AZUL], barGapWidthPct: 60, barDir: horizontal ? 'bar' : 'col' } };
  const opts = { ...CHART_BASE(), valLabelFormatCode: fmt, dataLabelFormatCode: fmt };
  // Barras pegadas a la meta: la etiqueta va adentro para no pisar la línea punteada.
  if (dentro) Object.assign(opts, { dataLabelPosition: 'inEnd', dataLabelColor: 'FFFFFF' });
  if (meta) {
    s.addChart([bar, { type: pres.charts.LINE, data: [{ name: 'Meta', labels, values: meta }],
      options: { chartColors: ['64748B'], lineSize: 2, lineDash: 'dash', lineDataSymbol: 'none', showValue: false } }],
    { ...opts, showLegend: true });
  } else {
    s.addChart(bar.type, bar.data, { ...opts, ...bar.options, showLegend: false });
  }
  cards.forEach(([col, tit, txt], i) => {
    const y = 1.8 + i * 1.7, id = `${++n}`;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { objectName: 'card' + id, x: 9.3, y, w: 3.4, h: 1.5, rectRadius: 0.1, fill: { color: C.background2 }, line: { color: C.background2 } });
    s.addShape(pres.shapes.OVAL, { objectName: 'dot' + id, x: 9.5, y: y + 0.25, w: 0.18, h: 0.18, fill: { color: col }, line: { color: col } });
    s.addText(tit, { isTextBox: true, objectName: 'cardT' + id, x: 9.8, y: y + 0.12, w: 2.8, h: 0.45, fontSize: 15, bold: true, color: C.text1, margin: 0, valign: 'middle' });
    s.addText(txt, { isTextBox: true, objectName: 'cardB' + id, x: 9.5, y: y + 0.6, w: 3.05, h: 0.85, fontSize: 14, color: C.text1, margin: 0, valign: 'top' });
  });
  if (notas) s.addNotes(notas);
}

const K = D.kpis;
const ENE_SEP = MESES.slice(0, 9), ABR_SEP = MESES.slice(3, 9);
const CIEN = (len) => Array(len).fill(100);

pres.addSection({ title: 'Portada' });
const p = pres.addSlide({ masterName: 'PORTADA', sectionTitle: 'Portada' });
p.addText('Indicadores de marketing', { placeholder: 'title' });
p.addText('Seguimiento de objetivos y planes de acción · enero–septiembre 2026', { placeholder: 'sub' });

pres.addSection({ title: 'Indicadores' });

slide({ titulo: 'Salud de Marca: cumplimiento mensual', dentro: true,
  sub: 'Seguimiento Objetivos · enero–septiembre 2026 · % de cumplimiento de las metas',
  labels: ENE_SEP, real: serie(D.saludMarca.serie, 0, 8, 1, 1), meta: CIEN(9), fmt: '0.0',
  cards: [
    [AMBAR, 'Acumulado: 96,5%', 'Faltan 3,5 puntos para el 100% de las metas del año.'],
    [AMBAR, 'Septiembre: 92,3%', 'Bajó 1,9 puntos vs agosto (94,2%).'],
    [AZUL, 'Qué explica la brecha', 'Frecuencia (1,1 pts), Cuadros Básicos (0,9) e Impresiones (0,6).'],
  ],
  notas: 'Salud de Marca = promedio ponderado de los 4 objetivos (25% cada uno). Cada objetivo = suma ponderada del cumplimiento de sus KPIs (tope 100% por KPI). Reparto de la brecha: Shapley del Seguimiento.' });

const objs = D.objetivos;
slide({ titulo: 'Objetivos estratégicos: cumplimiento acumulado', dentro: true,
  sub: 'Seguimiento Objetivos · acumulado enero–septiembre 2026 · % de cumplimiento',
  labels: objs.map((o) => o.nombre), real: objs.map((o) => +o.cumplYtd.toFixed(1)), meta: CIEN(objs.length), fmt: '0.0',
  cards: [
    [AMBAR, 'Los 4 objetivos, parejos', 'Entre 96,3% (TOM) y 96,7% (Poder de Marca) en el acumulado.'],
    [AMBAR, 'Septiembre, más bajo SOM', 'SOM 91,5% en el mes; Poder de Marca 92,9%, el más alto.'],
    [AMBAR, 'Por categoría, ~92–95%', 'Lavado 40,1 vs 43,6 de meta; Refrigeración 19,5 vs 21,1; Cocción 13,2 vs 13,9.'],
  ] });

// Planes de acción: cumplimiento acumulado (Σreal/Σmeta en sumas, promedio/promedio en tasas) de cada KPI con meta.
const ytd = (k) => {
  const i = k.real.map((v, j) => (v != null && k.meta[j] ? j : -1)).filter((j) => j >= 0 && j <= 8);
  const s = (a) => i.reduce((t, j) => t + a[j], 0);
  return +((s(k.real) / s(k.meta)) * 100).toFixed(1);
};
const conMeta = Object.entries(K).filter(([, k]) => k.meta.some((v) => v)).map(([nombre, k]) => [nombre, ytd(k)]).sort((a, b) => a[1] - b[1]);
slide({ titulo: 'Planes de acción: cumplimiento por KPI',
  sub: 'Pauta, Web, Instagram, Cuadros Básicos y Floor Share · acumulado 2026 hasta septiembre · % de la meta',
  labels: conMeta.map(([k]) => k), real: conMeta.map(([, v]) => v), fmt: '0', horizontal: true,
  cards: [
    [VERDE, '6 de 13 KPIs en meta', 'Engagement, conversión, sesión, alcance, VTR y clicks, en 100% o más.'],
    [AMBAR, 'Cerca: 90–98%', 'Tráfico web 97%, impresiones 95%, IG alcance 94%, Floor Share 94%, frecuencia 92%, CB 90%.'],
    [ROJO, 'Inversión 74%', 'Septiembre sin el reporte de OMD: de los medios sin API solo está cargado OOH.'],
  ],
  notas: 'Acumulado = suma real / suma meta (alcance, impresiones, clicks, inversión, usuarios) o promedio real / promedio meta (tasas), en los meses con dato y meta.' });

slide({ titulo: 'Inversión en pauta: real vs meta',
  sub: 'Pauta Mkt · abril–septiembre 2026 · millones de $',
  labels: ABR_SEP, real: serie(K['Inversión'].real, 3, 8, 1e6), meta: serie(K['Inversión'].meta, 3, 8, 1e6),
  cards: [
    [AMBAR, 'Abril–agosto: 93%', '$915M invertidos vs $981M de meta.'],
    [ROJO, 'Septiembre incompleto', '$156M vs $474M: de OMD solo está cargado OOH (en agosto el resto sumó ~$222M).'],
    [VERDE, 'Agosto, 95% de la meta', '$338M vs $355M; abril llegó al 100%.'],
  ],
  notas: 'Meta, YouTube, Programmatic y Google salen de las APIs; TikTok, Mercado Ads, Geo Mobile y offline, del reporte OMD. En agosto esos medios OMD sumaron cerca de $222M.' });

slide({ titulo: 'Alcance único: muchos más contactos, poca repetición',
  sub: 'Pauta Mkt · abril–septiembre 2026 · millones de personas',
  labels: ABR_SEP, real: serie(K['Alcance único'].real, 3, 8, 1e6, 1), meta: serie(K['Alcance único'].meta, 3, 8, 1e6, 1), fmt: '0.0',
  cards: [
    [VERDE, 'Acumulado: 102%', '287M de alcance vs 282M de meta.'],
    [VERDE, 'Septiembre: 52,2M', 'Casi el doble de la meta (28M).'],
    [ROJO, 'Frecuencia por debajo', 'Sep 2,25 vs 3,0 de meta (75%); es lo que más resta a Salud de Marca.'],
  ] });

slide({ titulo: 'Impresiones: real vs meta',
  sub: 'Pauta Mkt · abril–septiembre 2026 · millones',
  labels: ABR_SEP, real: serie(K['Impresiones'].real, 3, 8, 1e6, 1), meta: serie(K['Impresiones'].meta, 3, 8, 1e6, 1), fmt: '0.0',
  cards: [
    [AMBAR, 'Acumulado: 95%', '642M de impresiones vs 680M de meta.'],
    [VERDE, 'VTR en meta', 'Septiembre 53,8% de videos vistos a la mitad vs 50% de meta.'],
    [VERDE, 'Clicks: 100%', '5,65M acumulados, igual a la meta.'],
  ] });

slide({ titulo: 'Tráfico web: usuarios por mes',
  sub: 'Web / Ecommerce (GA4) · enero–septiembre 2026 · miles de usuarios',
  labels: ENE_SEP, real: serie(K['Tráfico web (usuarios)'].real, 0, 8, 1e3), meta: serie(K['Tráfico web (usuarios)'].meta, 0, 8, 1e3),
  cards: [
    [AMBAR, 'Acumulado: 97%', '2,88M usuarios vs 2,96M de meta.'],
    [AMBAR, 'Agosto y septiembre abajo', '92% y 94% de la meta; de enero a junio estuvo entre 99% y 106%.'],
    [AZUL, 'Septiembre: 562 mil', 'Segundo mes más alto del año, detrás de mayo (566 mil).'],
  ] });

slide({ titulo: 'Tasa de conversión web',
  sub: 'Web / Ecommerce (GA4) · enero–septiembre 2026 · % de sesiones con compra',
  labels: ENE_SEP, real: serie(K['Tasa de conversión'].real, 0, 8, 1, 2), meta: serie(K['Tasa de conversión'].meta, 0, 8, 1, 2), fmt: '0.00',
  cards: [
    [ROJO, 'Septiembre: 0,06%', 'El valor más bajo del año, 40% de la meta (0,15%).'],
    [AMBAR, 'Abril–julio debajo', 'Entre 52% y 75% de la meta; agosto la superó (0,16%).'],
    [VERDE, 'Tiempo de sesión: 129 s', 'Septiembre, sobre la meta de 120 segundos.'],
  ] });

slide({ titulo: 'Instagram: alcance orgánico',
  sub: 'Instagram @dreanargentina · enero–septiembre 2026 · miles de personas por mes',
  labels: ENE_SEP, real: serie(K['Alcance orgánico'].real, 0, 8, 1e3, 1), meta: serie(K['Alcance orgánico'].meta, 0, 8, 1e3, 1), fmt: '0.0',
  cards: [
    [AMBAR, 'Acumulado: 94%', '318 mil vs 338 mil de meta.'],
    [ROJO, 'Septiembre: 83%', '41,6 mil vs 50 mil de meta.'],
    [AZUL, 'Engagement 11,4% en sep', 'Lo explica el sorteo de Casa FOA (22-sep): 3.565 interacciones en un posteo.'],
  ] });

slide({ titulo: 'Cuadros Básicos: cumplimiento en tiendas', dentro: true,
  sub: 'Cuadros Básicos · marzo–septiembre 2026 · % del surtido presente',
  labels: MESES.slice(2, 9), real: serie(K['% Cumplimiento CB'].real, 2, 8, 1, 1), meta: serie(K['% Cumplimiento CB'].meta, 2, 8, 1, 1), fmt: '0.0',
  cards: [
    [VERDE, '+17 puntos desde marzo', 'De 58,4% a 75,2% en septiembre.'],
    [AMBAR, 'Septiembre: 95% de la meta', '75,2% vs 79%; agosto llegó al 98%.'],
    [AMBAR, 'Segundo en la brecha', 'Resta 0,9 puntos a Salud de Marca (acumulado 90%).'],
  ] });

slide({ titulo: 'Floor Share: exhibición en góndola', dentro: true,
  sub: 'Floor Share · marzo–septiembre 2026 · % del espacio de exhibición',
  labels: MESES.slice(2, 9), real: serie(K['Floor Share (exhibición)'].real, 2, 8, 1, 1), meta: serie(K['Floor Share (exhibición)'].meta, 2, 8, 1, 1), fmt: '0.0',
  cards: [
    [AMBAR, 'Agosto y septiembre: 97%', '23,8% vs 24,6% de meta.'],
    [AMBAR, 'Mayo–julio, lo más bajo', 'Entre 88% y 89% de la meta.'],
    [ROJO, 'Octubre sube la vara', 'La meta pasa a 27,5%: 3,7 puntos arriba del nivel actual.'],
  ] });

slide({ titulo: 'Share of Search: Drean en las búsquedas',
  sub: 'Mercado y competencia · enero–agosto 2026 · % de las búsquedas de la categoría (sin meta cargada)',
  labels: MESES.slice(0, 8), real: serie(K['Share of Search'].real, 0, 7, 1, 1), fmt: '0.0',
  cards: [
    [AZUL, 'Pico en julio: 26,4%', 'Agosto 23,8%: 2,1 puntos más que enero.'],
    [VERDE, 'Visibilidad en IA: 18,8%', 'Septiembre, vs 12,4% en agosto.'],
    [VERDE, 'Mejor posición en Google', 'Índice de posición 12,3 en septiembre vs 15,8 en agosto.'],
  ],
  notas: 'Share of Search = volumen de búsquedas de Drean / set competitivo (meses cerrados). Índice de posición SEO: menos es mejor. Estos KPIs no tienen meta cargada.' });

(async () => {
  const out = process.argv[2] || 'indicadores-marketing.pptx';
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log('ok', path.resolve(out));
})();
