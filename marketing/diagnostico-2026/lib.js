// Sistema visual del Diagnóstico Integral de Marketing 2026 (pptxgenjs, estilo consultora).
// Cada slide de contenido: título conclusivo → gráfico (evidencia) → panel "Lectura" (interpretación + implicancia) → fuente.
const pptxgen = require('pptxgenjs');
const { applyTheme } = require(process.env.SKILL + '/scripts/apply_theme.js');

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const P = { // paleta: un color dominante (navy), un gris de referencia y un acento para destacar
  ink: '111827', navy: '0B2545', blue: '1D4ED8', sky: '93C5FD', gray: '9CA3AF', light: 'E5E7EB',
  bg: 'F3F4F6', muted: '6B7280', accent: 'EA580C', good: '15803D', bad: 'B91C1C', white: 'FFFFFF',
};
const SERIES = [P.navy, P.blue, P.sky, P.accent, '0D9488', '7C3AED', 'CA8A04', P.gray];

const THEME = { name: 'Drean Diagnostico 2026', headFontFace: 'Arial', bodyFontFace: 'Arial',
  colors: { dk1: P.ink, lt1: P.white, dk2: P.navy, lt2: P.bg, accent1: P.navy, accent2: P.blue,
    accent3: P.sky, accent4: P.accent, accent5: '0D9488', accent6: P.muted, hlink: P.blue, folHlink: P.muted } };

function nuevo({ titulo = 'Diagnóstico integral de Marketing 2026 · Drean', pieTexto = 'Drean · Diagnóstico integral de Marketing 2026' } = {}) {
  const pres = new pptxgen(); pres.layout = 'LAYOUT_WIDE';
  pres.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial' };
  pres.title = titulo;
  const C = pres.SchemeColor;
  const pie = [{ text: { text: pieTexto, options: { x: 0.5, y: 7.08, w: 7, h: 0.25, fontSize: 9, color: C.accent6, margin: 0 } } }];
  pres.defineSlideMaster({ title: 'PORTADA', background: { color: P.navy }, objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.8, y: 2.3, w: 11.7, h: 1.6, fontSize: 44, bold: true, color: C.background1, valign: 'bottom', align: 'left', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'sub', type: 'body', x: 0.8, y: 4.1, w: 11.7, h: 1.0, fontSize: 18, color: C.accent3, valign: 'top', margin: 0 }, text: '' } },
  ] });
  pres.defineSlideMaster({ title: 'SECCION', background: { color: P.navy }, objects: [
    { placeholder: { options: { name: 'num', type: 'body', x: 0.8, y: 2.0, w: 4, h: 0.6, fontSize: 16, bold: true, color: C.accent3, margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', x: 0.8, y: 2.6, w: 11.7, h: 1.2, fontSize: 40, bold: true, color: C.background1, valign: 'top', align: 'left', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'sub', type: 'body', x: 0.8, y: 3.9, w: 10.5, h: 1.6, fontSize: 16, color: C.background1, valign: 'top', margin: 0 }, text: '' } },
  ] });
  pres.defineSlideMaster({ title: 'CONTENIDO', background: { color: P.white }, objects: [
    { placeholder: { options: { name: 'kicker', type: 'body', x: 0.5, y: 0.3, w: 12.3, h: 0.3, fontSize: 11, bold: true, color: C.accent2, margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 0.6, w: 12.3, h: 0.95, fontSize: 24, bold: true, color: C.text1, valign: 'top', align: 'left', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'fuente', type: 'body', x: 0.5, y: 6.78, w: 12.3, h: 0.28, fontSize: 9, color: C.accent6, margin: 0, valign: 'top' }, text: '' } },
    ...pie,
  ], slideNumber: { x: 12.3, y: 7.08, w: 0.5, h: 0.25, fontSize: 9, color: C.accent6, align: 'right' } });
  return { pres, C };
}

const AX = () => ({ catAxisLabelColor: P.muted, valAxisLabelColor: P.muted, catAxisLabelFontSize: 10, valAxisLabelFontSize: 10,
  catAxisLabelFontFace: '+mn-lt', valAxisLabelFontFace: '+mn-lt', valGridLine: { color: P.light, size: 0.5 }, catGridLine: { style: 'none' },
  catAxisLineShow: true, catAxisLineColor: P.gray, valAxisLineShow: false, legendFontSize: 10, legendFontFace: '+mn-lt', legendColor: P.muted,
  dataLabelFontFace: '+mn-lt', dataLabelFontSize: 9, dataLabelColor: P.ink, valAxisMinVal: 0 });

// Etiquetas de mes: un mes sin dato en TODAS las series 2026 lleva "*" (nota "* Sin datos" en la fuente).
// Octubre (índice 9) con dato lleva "†" = mes parcial (corte 19-oct-2026).
function etiquetasMes(series2026, parcial = 9) {
  return MESES.map((m, i) => (series2026.every((s) => s[i] == null) ? m + '*' : i === parcial ? m + '†' : m));
}

let N = 0;
function contenido(ctx, { seccion, kicker, titulo, fuente, notas }) {
  const s = ctx.pres.addSlide({ masterName: 'CONTENIDO', sectionTitle: seccion });
  s.addText(kicker, { placeholder: 'kicker' });
  s.addText(titulo, { placeholder: 'title' });
  s.addText(fuente, { placeholder: 'fuente' });
  if (notas) s.addNotes(notas);
  return s;
}

// Panel de lectura a la derecha: Interpretación + Implicancia (+ opcional Confianza).
function lectura(ctx, s, { interpretacion, implicancia, confianza, x = 9.35, y = 1.75, w = 3.45, h = 4.85 }) {
  const id = ++N, C = ctx.C;
  s.addShape(ctx.pres.shapes.RECTANGLE, { objectName: 'lect' + id, x, y, w, h, fill: { color: C.background2 }, line: { color: C.background2 } });
  const runs = [
    { text: 'Qué significa', options: { bold: true, color: C.accent2, fontSize: 11, breakLine: true } },
    { text: interpretacion, options: { color: C.text1, fontSize: 13, breakLine: true, paraSpaceAfter: 10 } },
    { text: 'Qué decisión habilita', options: { bold: true, color: C.accent2, fontSize: 11, breakLine: true } },
    { text: implicancia, options: { color: C.text1, fontSize: 13, breakLine: !!confianza, paraSpaceAfter: confianza ? 10 : 0 } },
  ];
  if (confianza) runs.push({ text: 'Confianza: ' + confianza, options: { color: C.accent6, fontSize: 10, italic: true } });
  s.addText(runs, { isTextBox: true, objectName: 'lectT' + id, x: x + 0.2, y: y + 0.2, w: w - 0.4, h: h - 0.4, valign: 'top', margin: 0 });
}

const AREA = { x: 0.5, y: 1.75, w: 8.6, h: 4.85 };

function linea(ctx, s, { series, unidad = '', fmt = '#,##0', area = AREA, etiquetas, destacarUltimo = true }) {
  // series: [{name, values[12], color?, ref?}] — ref=true (ej. 2025) no cuenta para marcar meses "Sin datos".
  const data = series.map((x) => ({ name: x.name, labels: etiquetas || etiquetasMes(series.filter((y) => !y.ref).map((y) => y.values)), values: x.values }));
  s.addChart(ctx.pres.charts.LINE, data, { ...AX(), ...area, chartColors: series.map((x, i) => x.color || SERIES[i]),
    lineSize: 2.25, lineDataSymbol: 'circle', lineDataSymbolSize: 5,
    showLegend: series.length > 1, legendPos: 't', valLabelFormatCode: fmt, displayBlanksAs: 'gap',
    showValue: false, valAxisTitle: unidad, showValAxisTitle: !!unidad, valAxisTitleFontSize: 10, valAxisTitleColor: P.muted });
}

function barras(ctx, s, { labels, series, fmt = '#,##0', area = AREA, horizontal, apilado, pct, valores = true, colores }) {
  const data = series.map((x) => ({ name: x.name, labels, values: x.values }));
  const o = { ...AX(), ...area, barDir: horizontal ? 'bar' : 'col', chartColors: colores || series.map((x, i) => x.color || SERIES[i]),
    barGapWidthPct: 55, showLegend: series.length > 1, legendPos: 't', valLabelFormatCode: fmt, dataLabelFormatCode: fmt,
    showValue: valores, dataLabelPosition: apilado ? 'ctr' : 'outEnd' };
  if (apilado) { o.barGrouping = pct ? 'percentStacked' : 'stacked'; o.dataLabelColor = P.white; if (pct) o.valAxisLabelFormatCode = '0%'; }
  if (horizontal) { o.catAxisOrientation = 'maxMin'; o.valAxisHidden = true; o.valGridLine = { style: 'none' }; }
  s.addChart(ctx.pres.charts.BAR, data, o);
}

function dispersion(ctx, s, { x, ys, nombreX, area = AREA, fmtX = '#,##0', fmtY = '#,##0' }) {
  // pptxgenjs scatter: primera serie = valores X; las demás = Y.
  const data = [{ name: nombreX, values: x }, ...ys.map((y) => ({ name: y.name, values: y.values }))];
  s.addChart(ctx.pres.charts.SCATTER, data, { ...AX(), ...area, lineSize: 0, lineDataSymbol: 'circle', lineDataSymbolSize: 9,
    chartColors: ys.map((y, i) => y.color || SERIES[i]), showLegend: ys.length > 1, legendPos: 't',
    valAxisLabelFormatCode: fmtY, catAxisLabelFormatCode: fmtX, showCatAxisTitle: true, catAxisTitle: nombreX, catAxisTitleFontSize: 10,
    catAxisTitleColor: P.muted, showValAxisTitle: !!ys[0].eje, valAxisTitle: ys[0].eje || '', valAxisTitleFontSize: 10, valAxisTitleColor: P.muted });
}

// Tabla limpia (rankings, anexos). `heat`: índice de columnas numéricas a colorear como mapa de calor.
function tabla(ctx, s, { cols, filas, area = AREA, anchos, heat = [], fontSize = 10, alinear }) {
  const C = ctx.C;
  const head = cols.map((c) => ({ text: c, options: { bold: true, color: C.accent6, fontSize: fontSize - 1, fill: { color: C.background1 }, border: [{ type: 'none' }, { type: 'none' }, { pt: 1, color: P.ink }, { type: 'none' }] } }));
  const max = {}, min = {};
  heat.forEach((j) => { const v = filas.map((f) => f[j]).filter((x) => typeof x === 'number'); max[j] = Math.max(...v); min[j] = Math.min(...v); });
  const body = filas.map((f) => f.map((v, j) => {
    let fill;
    if (heat.includes(j) && typeof v === 'number' && max[j] > min[j]) {
      const t = (v - min[j]) / (max[j] - min[j]); // 0..1 → blanco..navy claro
      const mix = (a, b) => Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
      fill = { color: (mix(255, 147) + mix(255, 197) + mix(255, 253)).toUpperCase() };
    }
    // Emojis y letras "decoradas" de Unicode no se ven en PowerPoint/LibreOffice: se sacan del texto de la tabla.
    const txt = typeof v === 'number' ? (f.__fmt?.[j] ? f.__fmt[j](v) : v.toLocaleString('es-AR')) : String(v ?? '—').replace(/[\u{1F000}-\u{1FFFF}\u{1D400}-\u{1D7FF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
    return { text: String(txt), options: { fontSize, color: C.text1, fill, align: alinear?.[j] || (typeof v === 'number' ? 'right' : 'left'),
      border: [{ type: 'none' }, { type: 'none' }, { pt: 0.5, color: P.light }, { type: 'none' }] } };
  }));
  const { h, ...pos } = area; // sin h: las filas toman su alto natural (con h se estiran)
  s.addTable([head, ...body], { ...pos, colW: anchos, rowH: 0.3, margin: [0.04, 0.06, 0.04, 0.06], autoPage: false });
}

// Fila de KPIs grandes (cifra + etiqueta + variación).
function kpis(ctx, s, items, { y = 1.85, x0 = 0.5, w = 12.3 } = {}) {
  const C = ctx.C, ancho = w / items.length;
  items.forEach((k, i) => {
    const x = x0 + i * ancho, id = ++N;
    s.addText(k.valor, { isTextBox: true, objectName: 'kv' + id, x, y, w: ancho - 0.2, h: 0.7, fontSize: 30, bold: true, color: C.text2, margin: 0 });
    s.addText(k.etiqueta, { isTextBox: true, objectName: 'kl' + id, x, y: y + 0.72, w: ancho - 0.2, h: 0.5, fontSize: 11, color: C.accent6, margin: 0, valign: 'top' });
    if (k.delta) s.addText(k.delta, { isTextBox: true, objectName: 'kd' + id, x, y: y + 1.2, w: ancho - 0.2, h: 0.35, fontSize: 11, bold: true, color: k.malo ? P.bad : P.good, margin: 0 });
  });
}

// Lista de texto con viñetas (para resúmenes y conclusiones).
function vinetas(ctx, s, items, area = { x: 0.5, y: 1.8, w: 12.3, h: 4.8 }, fontSize = 14) {
  s.addText(items.map((t, i) => (Array.isArray(t)
    ? { text: t[0], options: { bold: true, bullet: true, breakLine: false, fontSize } }
    : { text: t, options: { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: 8, fontSize } }))
    .flatMap((r, i) => (Array.isArray(items[i]) ? [r, { text: ' ' + items[i][1], options: { breakLine: i < items.length - 1, paraSpaceAfter: 8, fontSize } }] : [r])),
  { isTextBox: true, objectName: 'vin' + (++N), ...area, valign: 'top', margin: 0, color: ctx.C.text1 });
}

async function guardar(ctx, file) { await ctx.pres.writeFile({ fileName: file }); await applyTheme(file, THEME); }

module.exports = { AX, SERIES, etiquetasMes, nuevo, contenido, lectura, linea, barras, dispersion, tabla, kpis, vinetas, guardar, MESES, P, AREA };
