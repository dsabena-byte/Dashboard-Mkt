const pptxgen = require('pptxgenjs');
const { applyTheme } = require(process.env.SKILL + '/scripts/apply_theme.js');
const THEME = { name: 'Drean Indicadores', headFontFace: 'Arial', bodyFontFace: 'Arial',
  colors: { dk1:'0F172A', lt1:'FFFFFF', dk2:'1E40AF', lt2:'F1F5F9', accent1:'1E40AF', accent2:'94A3B8',
    accent3:'16A34A', accent4:'D97706', accent5:'DC2626', accent6:'64748B', hlink:'1E40AF', folHlink:'64748B' } };
const pres = new pptxgen(); pres.layout = 'LAYOUT_WIDE';
pres.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial' };
const C = pres.SchemeColor;
pres.defineSlideMaster({ title: 'GRAFICO_CARDS', background: { color: 'FFFFFF' },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.4, w: 12.1, h: 0.7, fontSize: 32, bold: true, color: C.text1, valign: 'top', align: 'left', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'sub', type: 'body', x: 0.6, y: 1.1, w: 12.1, h: 0.4, fontSize: 14, color: C.accent6, margin: 0 }, text: '' } },
    { text: { text: 'Drean · Marketing', options: { x: 0.6, y: 7.0, w: 6, h: 0.3, fontSize: 10, color: C.accent6, margin: 0 } } },
  ], slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: C.accent6, align: 'right' } });

pres.addSection({ title: 'Formato' });
const s = pres.addSlide({ masterName: 'GRAFICO_CARDS', sectionTitle: 'Formato' });
s.addText('Inversión en pauta: real vs meta', { placeholder: 'title' });
s.addText('Pauta Mkt · abril–septiembre 2026 · millones de $ · DATOS DE EJEMPLO (validar formato)', { placeholder: 'sub' });
const meses = ['Abr','May','Jun','Jul','Ago','Sep'];
s.addChart([
  { type: pres.charts.BAR, data: [{ name: 'Real', labels: meses, values: [40,52,61,118,77,148] }],
    options: { chartColors: ['1E40AF'], barGapWidthPct: 60 } },
  { type: pres.charts.LINE, data: [{ name: 'Meta', labels: meses, values: [60,70,80,110,120,150] }],
    options: { chartColors: ['64748B'], lineSize: 2, lineDash: 'dash', lineDataSymbol: 'none', showValue: false } },
], { x: 0.6, y: 1.8, w: 8.3, h: 4.9, showLegend: true, legendPos: 't', legendFontSize: 11, legendFontFace: '+mn-lt',
  catAxisLabelColor: '64748B', valAxisLabelColor: '64748B', catAxisLabelFontSize: 11, valAxisLabelFontSize: 11,
  catAxisLabelFontFace: '+mn-lt', valAxisLabelFontFace: '+mn-lt',
  valGridLine: { color: 'E2E8F0', size: 0.5 }, catGridLine: { style: 'none' },
  showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 10, dataLabelColor: '0F172A', dataLabelFontFace: '+mn-lt' });
const cards = [
  ['A','16A34A','Septiembre cerró en meta','$148M vs $150M de meta: 99% de cumplimiento.'],
  ['B','D97706','Agosto, 36% abajo','$77M vs $120M. El gasto se concentró en 3 días.'],
  ['C','1E40AF','Acumulado: 90% de la meta','$496M invertidos vs $590M planificados.'],
];
cards.forEach(([id, col, tit, txt], i) => {
  const y = 1.8 + i * 1.7;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { objectName: 'card' + id, x: 9.3, y, w: 3.4, h: 1.5, rectRadius: 0.1, fill: { color: C.background2 }, line: { color: C.background2 } });
  s.addShape(pres.shapes.OVAL, { objectName: 'dot' + id, x: 9.5, y: y + 0.25, w: 0.18, h: 0.18, fill: { color: col }, line: { color: col } });
  s.addText(tit, { isTextBox: true, objectName: 'cardT' + id, x: 9.8, y: y + 0.12, w: 2.8, h: 0.45, fontSize: 15, bold: true, color: C.text1, margin: 0, valign: 'middle' });
  s.addText(txt, { isTextBox: true, objectName: 'cardB' + id, x: 9.5, y: y + 0.6, w: 3.05, h: 0.85, fontSize: 14, color: C.text1, margin: 0, valign: 'top' });
});
(async () => { await pres.writeFile({ fileName: 'formato.pptx' }); await applyTheme('formato.pptx', THEME); })();
