/* =========================================================================
   BIP · Recorrido de la plataforma (tour de dashboards) — v2 fiel
   Animación determinística: todo el estado sale de window.__seek(t).
   DATOS 100% FICTICIOS: marca "Novara" + competidores inventados. Sin data real.
   Réplica del sistema visual real de cada dashboard (cards, tablas, gráficos).
   ========================================================================= */
const DUR = 117.0;
const SPEED = 1.0;
const LEAD = 0.42;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const S = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const eo = p => 1 - Math.pow(1 - p, 3);
const eio = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const lerp = (a, b, p) => a + (b - a) * p;
function mk(h) { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; }
function inUp(node, p, dist = 22) { if (!node) return; node.style.opacity = p; node.style.transform = `translateY(${(1 - p) * dist}px)`; }
function dash(el) { let L = 0; try { L = el.getTotalLength(); } catch { return 0; } el.style.strokeDasharray = L; return L; }

/* semáforo */
const SEM = { up: '#16a34a', mid: '#d97706', dn: '#dc2626', na: '#94a3b8' };
const SEMB = { up: 'rgba(22,163,74,.12)', mid: 'rgba(217,119,6,.14)', dn: 'rgba(220,38,38,.12)', na: 'rgba(100,116,139,.10)' };

/* ---------- iconos ---------- */
const I = {
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.4"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8.2 11 15.8 7M8.2 13l7.6 4"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.4 2.5 14.6 0 17M12 3.5c-2.5 2.4-2.5 14.6 0 17"/></svg>',
  store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 9 5.5 4h13L20 9M4.5 9v10a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V9M4 9h16"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6l1.9 4.6 4.6 1.9-4.6 1.9L12 15.6l-1.9-4.6L5.5 9l4.6-1.9zM18 15l.9 2.2 2.2.9-2.2.9L18 21.2l-.9-2.2-2.2-.9 2.2-.9z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20s-7-4.4-9.2-8.4C1 8.3 2.7 5 6 5c2 0 3.2 1.2 4 2.3C10.8 6.2 12 5 14 5c3.3 0 5 3.3 3.2 6.6C19 15.6 12 20 12 20Z"/></svg>',
  dollar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 2v20M7 6.5h8a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h9"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zM9 4v13M15 6.5v13"/></svg>',
};

const NAV = [
  { k: 'seg', label: 'Seguimiento de Objetivos', icon: I.target },
  { k: 'mapa', label: 'Mapa Estratégico', icon: I.map },
  { k: 'medios', label: 'Plan de Medios', icon: I.chart },
  { k: 'redes', label: 'Redes Sociales', icon: I.share },
  { k: 'web', label: 'Web / Ecommerce', icon: I.globe },
  { k: 'trade', label: 'Trade Marketing', icon: I.store },
  { k: 'marca', label: 'Salud de Marca', icon: I.heart },
  { k: 'inv', label: 'Inversión', icon: I.dollar },
  { k: 'ia', label: 'Copiloto IA', icon: I.spark },
];
const NAV_Y = k => { const i = NAV.findIndex(n => n.k === k); return 172 + i * 40; };

function shell(active, head, body) {
  const nav = NAV.map(n => `<a class="${n.k === active ? 'active' : ''}"><span class="ic">${n.icon}</span><span class="truncate">${n.label}</span></a>`).join('');
  return `<div class="app">
    <aside class="side">
      <div class="logo"><div class="bip">BIP<span class="tri"></span></div><div class="tag">Business<br>Impact<br>Platform</div></div>
      <nav class="nav">${nav}</nav>
    </aside>
    <div class="main">
      <div class="top"><div class="brand"><div class="bdot">N</div><div class="bn">Novara</div><span class="bs">· Electro</span></div>
        <div class="rt"><span class="pill">Datos ilustrativos</span><div class="av">ML</div></div></div>
      <div class="body">${head}${body}</div>
    </div>
  </div>`;
}
function phead(title, sub, right = '') { return `<div class="phead"><h2>${title}</h2><div class="ps">${sub}</div>${right}</div>`; }

/* ---------- componentes ---------- */
function mrow(label, sem, meta, chip, pct) {
  return `<div class="mrow"><div class="mrt"><span class="sdot" style="background:${SEM[sem]}"></span>
    <span class="mrl">${label} · meta <span class="mrm">${meta}</span></span>
    <span class="mchip" style="color:${SEM[sem]};background:${SEMB[sem]}">${chip}</span></div>
    <div class="mbar"><i data-w="${pct}" style="background:${SEM[sem]}"></i></div></div>`;
}
function metaCard(title, medida, head, hl, rows) {
  return `<div class="mcard"><div class="mt">${title}</div><div class="md">${medida}</div>
    <div class="mh"><b>${head}</b><small>${hl}</small></div>
    <div class="mrows">${rows.map(r => mrow(...r)).join('')}</div></div>`;
}
/* KPI tile simple */
function kpi(label, val, delta, dcls, hint) {
  return `<div class="kpi"><div class="kl">${label}</div><div class="kv num">${val}</div>
    ${delta ? `<span class="kd ${dcls}">${delta}</span>` : hint ? `<div style="font-size:12px;color:var(--faint);margin-top:9px;font-weight:600">${hint}</div>` : ''}</div>`;
}
/* barra horizontal genérica */
function hbar(label, wpct, valTxt, color) {
  return `<div style="display:flex;align-items:center;gap:14px;padding:8px 0">
    <div style="width:140px;font-size:14.5px;font-weight:600">${label}</div>
    <div style="flex:1;height:13px;border-radius:7px;background:var(--panel2);overflow:hidden"><i data-w="${wpct}" style="display:block;height:100%;border-radius:7px;background:${color}"></i></div>
    <div class="num" style="width:92px;text-align:right;font-family:var(--disp);font-weight:700;font-size:15px">${valTxt}</div></div>`;
}
/* barras verticales real-vs-meta (grouped) o simples */
function vbars(months, series, max, H = 140, bw = 0) {
  const grouped = series.length > 1;
  const w = bw || (grouped ? 15 : 26);
  const cols = months.map((m, i) => {
    const bars = series.map(s => `<div class="vbar" data-h="${clamp(s.vals[i] / max * 100, 0, 100).toFixed(1)}" style="width:${w}px;background:${s.color};border-radius:4px 4px 0 0;align-self:flex-end"></div>`).join('');
    return `<div style="flex:1;display:flex;align-items:flex-end;justify-content:center;gap:5px;height:100%">${bars}</div>`;
  }).join('');
  const labels = months.map(m => `<div style="flex:1;text-align:center;font-size:11px;color:var(--faint);font-weight:600">${m}</div>`).join('');
  return `<div style="display:flex;align-items:flex-end;height:${H}px;gap:5px">${cols}</div><div style="display:flex;gap:5px;margin-top:6px">${labels}</div>`;
}
/* barras verticales apiladas */
function vstack(months, colors, data, max, H = 150, sw = 26) {
  const cols = months.map((m, i) => {
    const segs = data[i].map((v, j) => `<div class="vbar" data-h="${(v / max * 100).toFixed(1)}" style="width:${sw}px;background:${colors[j]};border-radius:${j === data[i].length - 1 ? '4px 4px 0 0' : '0'}"></div>`).join('');
    return `<div style="flex:1;display:flex;flex-direction:column-reverse;align-items:center;height:100%">${segs}</div>`;
  }).join('');
  return `<div style="display:flex;align-items:flex-end;height:${H}px;gap:6px">${cols}</div>`;
}
/* línea real (navy) + meta (gris punteada) */
function lineSvg(id, real, meta, ymin, ymax, w = 900, h = 250) {
  const n = real.length, X = i => 26 + i * ((w - 52) / (n - 1)), Y = v => h - 18 - (v - ymin) / (ymax - ymin) * (h - 40);
  const path = a => a.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
  return `<svg id="${id}" viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px">
    <path d="${path(meta)}" fill="none" stroke="var(--meta2)" stroke-width="2.6" stroke-dasharray="7 6" stroke-linecap="round" opacity=".9"/>
    <path class="rl" d="${path(real)}" fill="none" stroke="var(--real)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
    <circle class="dot" r="6" fill="var(--real)" stroke="#fff" stroke-width="3" cx="${X(n - 1)}" cy="${Y(real[n - 1])}"/></svg>`;
}
/* sparkline mini (scorecard) */
function spark(real, meta) {
  const n = real.length, mn = Math.min(...real, ...meta), mx = Math.max(...real, ...meta);
  const X = i => 3 + i * (114 / (n - 1)), Y = v => 24 - (v - mn) / (mx - mn || 1) * 20;
  const p = a => a.map((v, i) => `${X(i).toFixed(0)},${Y(v).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 120 27" style="width:118px;height:27px"><polyline points="${p(meta)}" fill="none" stroke="var(--meta2)" stroke-width="1.5" stroke-dasharray="3 3"/><polyline points="${p(real)}" fill="none" stroke="var(--real)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
/* donut */
function donut(segs) {
  const R = 52, C = 2 * Math.PI * R; let off = 0;
  const arcs = segs.map(s => { const len = s[1] / 100 * C; const a = `<circle r="${R}" cx="75" cy="75" fill="none" stroke="${s[2]}" stroke-width="24" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 75 75)"/>`; off += len; return a; }).join('');
  const leg = segs.map(s => `<div style="display:flex;align-items:center;gap:8px;font-size:13px;margin:6px 0"><span style="width:11px;height:11px;border-radius:3px;background:${s[2]}"></span>${s[0]} · <b>${s[1]}%</b></div>`).join('');
  return `<div style="display:flex;align-items:center;gap:22px;margin-top:6px"><svg viewBox="0 0 150 150" style="width:150px;height:150px;flex:none">${arcs}</svg><div>${leg}</div></div>`;
}

/* ---------- motor ---------- */
const stage = document.getElementById('stage');
const SCENES = [];
function scene(id, start, end, html, init) {
  const node = mk(`<div class="scene" id="${id}">${html}</div>`);
  stage.appendChild(node);
  const o = { id, start: start * SPEED, end: end * SPEED, node };
  o.draw = init(node, o) || (() => { });
  SCENES.push(o);
  return o;
}
function grow(node, p) {
  node.querySelectorAll('[data-w]').forEach(e => { e.style.width = (+e.dataset.w * p) + '%'; });
  node.querySelectorAll('[data-h]').forEach(e => { e.style.height = (+e.dataset.h * p) + '%'; });
}
function stagger(nodes, lt, t0, step, d = 20) { nodes.forEach((n, i) => inUp(n, eo(S(lt, t0 + i * step, t0 + .55 + i * step)), d)); }

/* cursor */
const cursorEl = mk(`<div id="cursor"><svg viewBox="0 0 24 24" width="34" height="34">
  <path d="M5 2.4l13.2 8.1-5.9.9 3.3 6.6-2.6 1.3-3.3-6.6-4.7 3.7z" fill="#fff" stroke="#16202e" stroke-width="1.5" stroke-linejoin="round"/></svg></div>`);
const ringEl = mk('<div id="ring"></div>');
stage.appendChild(ringEl); stage.appendChild(cursorEl);
let cursorUsed = false;
function runCursor(kfs, lt, alpha = 1) {
  cursorUsed = true;
  let x = kfs[0].x, y = kfs[0].y;
  if (lt >= kfs[kfs.length - 1].t) { x = kfs[kfs.length - 1].x; y = kfs[kfs.length - 1].y; }
  else for (let i = 0; i < kfs.length - 1; i++) { const a = kfs[i], b = kfs[i + 1]; if (lt >= a.t && lt < b.t) { const p = eio(S(lt, a.t, b.t)); x = lerp(a.x, b.x, p); y = lerp(a.y, b.y, p); break; } }
  let ringP = -1, rx = 0, ry = 0, press = 0;
  for (const k of kfs) { if (!k.click) continue; if (lt >= k.t - .07 && lt <= k.t + .12) press = 1; const p = S(lt, k.t, k.t + .34); if (p > 0 && p < 1) { ringP = p; rx = k.x; ry = k.y; } }
  cursorEl.style.opacity = alpha; cursorEl.style.transform = `translate(${x}px,${y}px) scale(${press ? .84 : 1})`;
  if (ringP >= 0) { ringEl.style.opacity = (1 - ringP) * .8 * alpha; ringEl.style.transform = `translate(${rx - 39}px,${ry - 39}px) scale(${lerp(.32, 1.15, eo(ringP))})`; } else ringEl.style.opacity = 0;
}
function navCursor(key, toX, toY) {
  const ny = NAV_Y(key);
  return [{ t: 0, x: 150, y: ny + 120 }, { t: .5, x: 135, y: ny }, { t: .8, x: 135, y: ny, click: 1 }, { t: 2.2, x: toX, y: toY }, { t: 6, x: toX + 40, y: toY + 26 }];
}

/* =========================== ESCENAS =========================== */

/* 0 · Intro */
scene('intro', 0, 5, `<div class="cover">
  <div class="logo"><div class="bip">BIP<span class="tri"></span></div><div class="tag">Business<br>Impact<br>Platform</div></div>
  <h1>Un recorrido por <span class="hl">la plataforma.</span></h1>
  <p>De la estrategia al resultado, con todos los datos conectados.</p>
  <div class="note">Marca y datos ilustrativos · no representan a ninguna empresa real</div>
</div>`, (node) => {
  const parts = [node.querySelector('.logo'), node.querySelector('h1'), node.querySelector('.cover p'), node.querySelector('.note')];
  return (lt) => parts.forEach((p, i) => inUp(p, eo(S(lt, .2 + i * .28, 1.3 + i * .28)), 26));
});

/* 1 · Mapa Estratégico (la tesis: KPIs → objetivos) — coordenadas px en caja 1740x660 */
const M_KTOP = [30, 122, 214, 306, 398, 490, 582]; // top de cada KPI (alto ~46)
const M_OTOP = [60, 210, 360, 510];                // top de cada objetivo (alto ~62)
const M_OBJ = [['Awareness', '#7a5cf0', 40], ['Consideración', '#0ea5e9', 30], ['Intención de Compra', '#f59e0b', 20], ['Impacto en Negocio', '#16a34a', 10]];
const M_KPI = [['Alcance único', '35%'], ['Impresiones', '30%'], ['VTR (≥50%)', '45%'], ['Engagement orgánico', '40%'], ['Tráfico web', '35%'], ['Floor Share', '45%'], ['Facturación', '55%']];
// vínculos KPI(idx) -> objetivo(idx) con peso relativo (grosor/opacidad)
const M_LINK = [[0, 0, .35], [1, 0, .30], [2, 0, .20], [2, 2, .25], [3, 1, .40], [3, 2, .20], [4, 1, .35], [4, 2, .25], [5, 3, .45], [6, 3, .55], [0, 1, .15]];
const M_X1 = 360, M_X2 = 1310, M_MX = (360 + 1310) / 2;
const M_PATHS = M_LINK.map(l => { const y1 = M_KTOP[l[0]] + 23, y2 = M_OTOP[l[1]] + 31; return `<path class="mln" d="M${M_X1} ${y1} C${M_MX} ${y1} ${M_MX} ${y2} ${M_X2} ${y2}" fill="none" stroke="${M_OBJ[l[1]][1]}" stroke-width="${(1.4 + l[2] * 6).toFixed(1)}" opacity="${(.16 + l[2] * .5).toFixed(2)}" stroke-linecap="round"/>`; }).join('');
scene('mapa', 5, 16, `<div style="position:absolute;inset:0;background:var(--ground);padding:44px 90px 30px;display:flex;flex-direction:column">
  <div class="mhead" style="text-align:center;margin-bottom:14px">
    <div class="bip" style="font-family:var(--disp);font-weight:800;font-size:22px;color:var(--navy);display:inline-flex;align-items:center;gap:7px">BIP<span style="width:0;height:0;border-left:12px solid var(--cyan);border-top:8px solid transparent;border-bottom:8px solid transparent"></span></div>
    <h2 style="font-family:var(--disp);font-weight:800;font-size:38px;letter-spacing:-.025em;margin-top:6px">Mapa Estratégico</h2>
    <p style="font-size:18px;color:var(--muted);margin-top:6px;max-width:64ch;margin-left:auto;margin-right:auto">Cada KPI aporta —con un peso— a un objetivo. <b style="color:var(--ink)">Si cumplís las metas de los KPIs, cumplís los objetivos.</b></p>
  </div>
  <div style="position:relative;flex:1;display:flex;justify-content:center">
    <div style="position:relative;width:1740px;height:660px">
      <svg class="maplines" viewBox="0 0 1740 660" style="position:absolute;inset:0;width:1740px;height:660px;z-index:0;overflow:visible">${M_PATHS}</svg>
      <div style="position:absolute;left:20px;top:-14px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">KPIs · con su peso</div>
      <div style="position:absolute;right:20px;top:-14px;text-align:right;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">Objetivos estratégicos</div>
      ${M_KPI.map((k, i) => `<div class="mkpi mk${i}" style="position:absolute;left:20px;top:${M_KTOP[i]}px;width:340px;margin:0;z-index:1">${k[0]}<span class="mkw">${k[1]}</span></div>`).join('')}
      ${M_OBJ.map((o, i) => `<div class="mobj mo${i}" style="position:absolute;right:20px;top:${M_OTOP[i]}px;width:410px;margin:0;border-left-color:${o[1]};z-index:1"><span class="mn">${o[0]}</span><div style="margin-left:auto;text-align:right"><div class="mw">${o[2]}%</div><div class="mws">peso</div></div></div>`).join('')}
    </div>
  </div>
</div>`, (node) => {
  const head = node.querySelector('.mhead');
  const kpis = M_KPI.map((_, i) => node.querySelector('.mk' + i)), objs = M_OBJ.map((_, i) => node.querySelector('.mo' + i));
  const paths = [...node.querySelectorAll('.mln')]; paths.forEach(p => p.__L = 0);
  return (lt) => {
    inUp(head, eo(S(lt, .2, 1.2)), 20);
    kpis.forEach((k, i) => inUp(k, eo(S(lt, 1.1 + i * .11, 1.7 + i * .11)), 16));
    objs.forEach((o, i) => inUp(o, eo(S(lt, 1.5 + i * .16, 2.1 + i * .16)), 16));
    paths.forEach((p, i) => { if (!p.__L) p.__L = dash(p); const pr = eo(S(lt, 2.7 + i * .11, 4.2 + i * .11)); p.style.strokeDashoffset = (1 - pr) * p.__L; });
  };
});

/* 2 · Seguimiento de Objetivos */
const SEG_OBJ = [
  { n: 'Awareness', c: '#7a5cf0', peso: 40, cmes: 103, res: '40,4', meta: '40,0', ytd: 101, ap: [['VTR (≥50%)', 'up', 35, 104], ['Alcance único', 'up', 30, 101], ['Impresiones', 'up', 25, 102]] },
  { n: 'Consideración', c: '#0ea5e9', peso: 30, cmes: 100, res: '30,1', meta: '30,0', ytd: 100, ap: [['Engagement org.', 'mid', 40, 95], ['Tráfico web', 'up', 35, 106], ['Alcance único', 'up', 25, 101]] },
  { n: 'Intención', c: '#f59e0b', peso: 20, cmes: 102, res: '20,4', meta: '20,0', ytd: 102, ap: [['VTR (≥50%)', 'up', 30, 104], ['Tráfico web', 'up', 35, 106], ['Engagement', 'mid', 20, 95]] },
  { n: 'Impacto Negocio', c: '#16a34a', peso: 10, cmes: 106, res: '10,6', meta: '10,0', ytd: 104, ap: [['Floor Share', 'up', 55, 110], ['Facturación', 'up', 45, 98]] },
];
const SEG_SC = [
  ['Alcance único', 'Personas alcanzadas', 'Ago', '26,0M', '25,0M', 'up', '▲ 4%', '188M', '182M', 'up', '▲ 3%', [20, 22, 21, 24, 23, 26], [21, 21, 22, 23, 24, 25]],
  ['VTR (≥50%)', 'Vistas 50% ÷ impr. video', 'Ago', '30,6%', '30,0%', 'up', '▲ 2%', '29,4%', '29,0%', 'up', '▲ 1%', [27, 28, 29, 29, 30, 31], [28, 28, 29, 29, 30, 30]],
  ['Engagement rate', 'Interacciones ÷ alcance', 'Ago', '2,8%', '3,0%', 'mid', '▼ 7%', '2,9%', '3,0%', 'mid', '▼ 3%', [3.1, 2.9, 3.0, 2.8, 2.7, 2.8], [3, 3, 3, 3, 3, 3]],
  ['Tráfico web', 'Usuarios únicos del mes', 'Ago', '318K', '300K', 'up', '▲ 6%', '2,3M', '2,2M', 'up', '▲ 5%', [26, 28, 27, 30, 31, 32], [27, 28, 28, 29, 30, 30]],
  ['Floor Share', 'Share góndola (Σ cat×peso)', 'Ago', '34,2%', '31,0%', 'up', '▲ 10%', '33,1%', '31,0%', 'up', '▲ 7%', [30, 31, 32, 33, 33, 34], [31, 31, 31, 31, 31, 31]],
];
function objCard(o) {
  const cm = o.cmes >= 100 ? 'up' : o.cmes >= 90 ? 'mid' : 'dn', yt = o.ytd >= 100 ? 'up' : o.ytd >= 90 ? 'mid' : 'dn';
  return `<div class="objc">
    <div class="oh"><span class="och" style="background:${o.c}"></span><div><div class="on">${o.n}</div><div class="ope">peso estratégico ${o.peso}%</div></div>
      <div class="opill"><b style="color:${SEM[cm]};background:${SEMB[cm]}">${o.cmes}%</b><small>cumpl. mes</small></div></div>
    <div class="obig"><div class="ol">Resultado acum. · Meta</div><div class="ov" style="color:${SEM[yt]}">${o.res} <span>/ ${o.meta}</span></div>
      <div class="obar"><i data-w="${o.ytd}" style="background:${SEM[yt]}"></i></div><div class="oyt">Avance YTD <b>${o.ytd}%</b> de la meta</div></div>
    <div class="apo"><div class="aph">Aporte de KPIs · peso × cumpl</div>
      ${o.ap.map(a => `<div class="arow"><span class="sdot" style="background:${SEM[a[1]]}"></span><span class="an">${a[0]}</span><span class="ar"><span class="aw">${a[2]}%</span><span class="ac" style="color:${SEM[a[1]]}">${a[3]}%</span></span></div>`).join('')}</div>
  </div>`;
}
scene('seg', 16, 30, shell('seg',
  phead('Seguimiento de Objetivos', 'Cumplimiento de objetivos y KPIs vs metas mensuales · a Ago', '<div class="datep">Vista: General ▾</div>'), `
  <div class="salud">
    <div class="sh"><span class="badge" style="background:${SEM.up}">★</span>
      <div><div class="st">Salud de Marca</div><div class="ssub">Σ peso estratégico × cumplimiento de cada objetivo · a Ago</div></div>
      <div class="sr"><div class="sbig"><div class="sl">Resultado acum. · Meta</div><div class="sv" style="color:${SEM.up}">101,2 <span>/ 100</span></div><div class="sy">Avance YTD <b>101%</b> de la meta</div></div>
        <div class="spill"><b style="color:${SEM.up};background:${SEMB.up}">103%</b><small>cumpl. mes</small></div></div></div>
    <div class="sbar"><i data-w="100" style="background:${SEM.up}"></i></div></div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:14px">${SEG_OBJ.map(objCard).join('')}</div>
  <div class="panel" style="flex:1;padding:18px 22px"><div class="ph"><h3>KPIs por plan</h3><div class="lg"><span><i style="background:var(--real)"></i>Real</span><span><i style="background:var(--meta2)"></i>Meta</span><span style="color:var(--faint)">·</span><span><i style="background:${SEM.up}"></i>En meta</span><span><i style="background:${SEM.mid}"></i>En riesgo</span></div></div>
    <table class="sc2"><thead>
      <tr class="g1"><th class="l" rowspan="2">KPI</th><th rowspan="2">Mes</th><th colspan="3">Desvío del mes</th><th class="divx" rowspan="2"></th><th colspan="3">Acumulado YTD</th><th rowspan="2" style="text-align:center">Evolución</th></tr>
      <tr class="g2"><th>Real</th><th>Meta</th><th>Desv.</th><th>Real</th><th>Meta</th><th>Desv.</th></tr></thead>
    <tbody>${SEG_SC.map(r => `<tr><td class="l"><span class="kn">${r[0]}</span><span class="km">${r[1]}</span></td><td class="mv">${r[2]}</td>
      <td>${r[3]}</td><td class="mv">${r[4]}</td><td><span class="cc" style="color:${SEM[r[5]]};background:${SEMB[r[5]]}">${r[6]}</span></td><td class="divx"></td>
      <td>${r[7]}</td><td class="mv">${r[8]}</td><td><span class="cc" style="color:${SEM[r[9]]};background:${SEMB[r[9]]}">${r[10]}</span></td>
      <td style="text-align:center">${spark(r[11], r[12])}</td></tr>`).join('')}</tbody></table></div>`),
  (node) => {
    const banner = node.querySelector('.salud'), cards = [...node.querySelectorAll('.objc')], panel = node.querySelector('.panel'), rows = [...node.querySelectorAll('.sc2 tbody tr')];
    return (lt, a) => {
      inUp(banner, eo(S(lt, .3, 1.0)), 18); stagger(cards, lt, .7, .12, 18); inUp(panel, eo(S(lt, 1.5, 2.1)), 20);
      rows.forEach((r, i) => inUp(r, eo(S(lt, 2.2 + i * .12, 2.7 + i * .12)), 10));
      grow(node, eo(S(lt, .6, 2.6))); runCursor(navCursor('seg', 980, 620), lt, a);
    };
  });

/* 3 · Plan de Medios */
const MED_MEDIA = [
  ['Meta', '#0866FF', '$3,1M', '112M', '28,4M', '3,9', '—', '$27', 'g'],
  ['Google Search', '#FBBC05', '$2,4M', '86M', '—', '—', '2,1%', '$0,42', 'g'],
  ['YouTube', '#FF0000', '$1,6M', '64M', '19,8M', '3,2', '34%', '$25', 'g'],
  ['Programmatic', '#4285F4', '$1,0M', '48M', '14,1M', '3,4', '28%', '$21', 'a'],
  ['TikTok', '#111827', '$0,6M', '31M', '9,2M', '3,3', '31%', '$19', 'g'],
];
scene('medios', 30, 43, shell('medios',
  `<div class="phead" style="align-items:flex-start;flex-wrap:wrap"><div><h2>Plan de Medios</h2><div class="ps">Resultados ejecutados (Digital ON + TV + OOH) · Fuente: OMD</div>
    <div style="display:flex;gap:18px;margin-top:8px;font-size:12px;color:var(--faint);font-weight:600">${['DV360 al 07/09', 'Meta al 06/09', 'Plan/OMD al 03/09', 'Google Ads al 07/09'].map(s => `<span style="display:inline-flex;align-items:center;gap:6px"><i style="width:7px;height:7px;border-radius:50%;background:${SEM.up};display:inline-block"></i>${s}</span>`).join('')}</div></div></div>`, `
  <div class="tabs"><span class="tb on amber">Impacto Campaña</span><span class="tb">Eficiencia Medios</span><span class="tb">Insights Pauta</span></div>
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px"><span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--faint)">Categoría</span>
    <div class="seg"><b class="on">General</b><b>Lavado</b><b>Refrigeración</b><b>Cocinas</b></div></div>
  <div class="stitle">Impacto de campaña · metas del plan <span style="color:var(--faint);font-weight:500">(mes ref: Ago 2026)</span></div>
  <div class="mgrid" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
    ${metaCard('Inversión', 'Inversión total ejecutada (ARS)', '$81,2M', 'Ago', [['Mes', 'up', '$78,0M', '▲ 4%', 104], ['Acum. YTD', 'up', '$760M', '▲ 3%', 103]])}
    ${metaCard('Alcance único', 'Personas alcanzadas', '26,0M', 'Ago', [['Mes', 'up', '25,0M', '▲ 4%', 104], ['Acum. YTD', 'up', '229M', '▲ 0%', 100]])}
    ${metaCard('Frecuencia', 'Impresiones ÷ alcance', '2,0×', 'Ago', [['Mes', 'mid', '2,1×', '▼ 5%', 95], ['Acum. YTD', 'up', '2,0×', '▲ 0%', 100]])}
    ${metaCard('Impresiones', 'Impresiones del período', '52,0M', 'Ago', [['Mes', 'up', '50,0M', '▲ 4%', 104], ['Acum. YTD', 'up', '480M', '▲ 3%', 103]])}
    ${metaCard('VTR ≥50%', 'Vistas 50% ÷ impr. video', '30,6%', 'Ago', [['Mes', 'up', '30,0%', '▲ 2%', 102], ['Acum. YTD', 'up', '29,0%', '▲ 1%', 101]])}
    ${metaCard('Clicks', 'Clicks totales del período', '430,8K', 'Ago', [['Mes', 'mid', '450K', '▼ 4%', 96], ['Acum. YTD', 'up', '5,6M', '▲ 1%', 101]])}
  </div>
  <div class="panel" style="flex:1;padding:16px 22px"><div class="ph"><h3>Distribución de inversión</h3><div class="sub">mix del período</div></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:4px">
      <div><div style="font-size:14px;font-weight:700;margin-bottom:2px">Mix ON / OFF</div>${donut([['Digital', 58, '#2b4dff'], ['OOH', 42, '#f59e0b']])}</div>
      <div><div style="font-size:14px;font-weight:700;margin-bottom:2px">Inversión por medio</div>${donut([['Meta', 28, '#0866FF'], ['YouTube', 22, '#FF0000'], ['Programmatic', 16, '#4285F4'], ['Google', 14, '#FBBC05'], ['OOH', 12, '#94a3b8'], ['TikTok', 8, '#111827']])}</div>
      <div><div style="font-size:14px;font-weight:700;margin-bottom:2px">Inversión por categoría</div>${donut([['Brand', 34, '#0a1849'], ['Refrigeración', 26, '#0ea5e9'], ['Lavado', 24, '#a78bfa'], ['Cocción', 16, '#f59e0b']])}</div>
    </div></div>`),
  (node) => {
    const cards = [...node.querySelectorAll('.mcard')], panel = node.querySelector('.panel');
    return (lt, a) => {
      stagger(cards, lt, .4, .1, 18); inUp(panel, eo(S(lt, 1.6, 2.2)), 20);
      grow(node, eo(S(lt, .5, 2.4))); runCursor(navCursor('medios', 900, 560), lt, a);
    };
  });

/* 4 · Redes — IG orgánico */
scene('redes1', 43, 52, shell('redes',
  phead('Redes Sociales', 'Analítica orgánica de Novara · Instagram', '<div class="datep">Ago 2026 ▾</div>'), `
  <div class="panel" style="flex:1;padding:20px 24px;display:flex;flex-direction:column"><div class="ph" style="margin-bottom:16px"><div style="display:flex;align-items:center;gap:11px"><span style="width:30px;height:30px;border-radius:9px;display:grid;place-items:center;color:#fff;font-weight:800;font-size:14px;background:linear-gradient(45deg,#f09433,#dc2743,#bc1888)">IG</span><div><h3>Instagram orgánico — @novara</h3><div class="sub">KPIs del período · Agosto</div></div></div></div>
    <div class="mgrid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
      ${metaCard('Alcance (personas)', 'Suma del reach de los posts', '4,1M', 'Ago', [['Mes', 'up', '3,8M', '▲ 8%', 108], ['Acum. YTD', 'up', '29M', '▲ 5%', 105]])}
      ${metaCard('Engagement %', 'Interacciones ÷ alcance', '2,8%', 'Ago', [['Mes', 'mid', '3,0%', '▼ 7%', 93], ['Acum. YTD', 'mid', '3,0%', '▼ 3%', 97]])}
      <div class="mcard"><div class="mt">Followers</div><div class="md">@novara</div><div class="mh"><b>204K</b><small>+3,1K en el mes</small></div>
        <div class="mrows"><div class="mrow"><div class="mrt"><span class="sdot" style="background:${SEM.up}"></span><span class="mrl">Crecimiento sostenido 12 meses</span></div><div class="mbar"><i data-w="78" style="background:var(--real)"></i></div></div></div></div>
    </div>
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;gap:12px;margin-bottom:16px">
      <div style="border:2px solid #bfdbfe;background:#eff6ff;border-radius:14px;padding:13px 16px"><div style="font-size:12px;color:#2563eb;font-weight:700">Engagement total</div><div style="font-family:var(--disp);font-weight:800;font-size:25px;color:#1d4ed8;margin-top:3px">114K</div><div style="font-size:12px;color:#3b82f6;margin-top:2px">42 posts</div></div>
      ${kpi('Likes', '96K', '', '', '❤️ me gusta')}${kpi('Comentarios', '9,2K', '', '', '💬 respuestas')}${kpi('Guardados', '6,4K', '', '', '🔖 saves')}${kpi('Video views', '2,3M', '', '', '▶ reproducciones')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;flex:1;min-height:0">
      <div style="border:1px solid var(--line);border-radius:14px;padding:16px 18px"><h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:6px">Alcance mensual — real vs meta</h4>
        <div style="display:flex;gap:16px;font-size:12px;color:var(--muted);font-weight:600;margin-bottom:6px"><span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:var(--real);vertical-align:-1px;margin-right:5px"></i>Alcance (real)</span><span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:var(--meta);vertical-align:-1px;margin-right:5px"></i>Meta</span></div>
        ${vbars(['Abr', 'May', 'Jun', 'Jul', 'Ago'], [{ color: 'var(--meta)', vals: [3.4, 3.5, 3.6, 3.7, 3.8] }, { color: 'var(--real)', vals: [3.5, 3.4, 3.8, 3.6, 4.1] }], 4.6, 128)}</div>
      <div style="border:1px solid var(--line);border-radius:14px;padding:16px 18px" id="ig-combo"><h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:6px">Engagement % e interacciones por tipo</h4>
        <div style="display:flex;gap:14px;font-size:12px;color:var(--muted);font-weight:600;margin-bottom:6px"><span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#1e40af;vertical-align:-1px;margin-right:5px"></i>Likes</span><span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#60a5fa;vertical-align:-1px;margin-right:5px"></i>Coment.</span><span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#bfdbfe;vertical-align:-1px;margin-right:5px"></i>Guardados</span><span><i style="display:inline-block;width:16px;height:3px;background:#0f172a;vertical-align:3px;margin-right:5px"></i>Eng.%</span></div>
        <div style="position:relative">${vstack(['Abr', 'May', 'Jun', 'Jul', 'Ago'], ['#1e40af', '#60a5fa', '#bfdbfe'], [[60, 22, 14], [58, 20, 15], [66, 24, 16], [70, 22, 18], [78, 26, 20]], 130, 118, 30)}
          <svg viewBox="0 0 500 118" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:118px"><polyline class="rl2" points="50,44 150,50 250,36 350,42 450,30" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>
    </div>
    <div class="demo" style="display:grid;grid-template-columns:repeat(3,1fr);gap:26px;margin-top:16px">
      <div><h5>Edad</h5>${[['18–24', 22, 58], ['25–34', 38, 100], ['35–44', 24, 63], ['45+', 16, 42]].map(d => `<div class="dr"><div class="dt"><b>${d[0]}</b><span>${d[1]}%</span></div><div class="db"><i data-w="${d[2]}" style="background:#ec4899"></i></div></div>`).join('')}</div>
      <div><h5>Género</h5>${[['Mujeres', 61, 100], ['Hombres', 39, 64]].map(d => `<div class="dr"><div class="dt"><b>${d[0]}</b><span>${d[1]}%</span></div><div class="db"><i data-w="${d[2]}" style="background:#a855f7"></i></div></div>`).join('')}</div>
      <div><h5>Top provincias</h5>${[['Buenos Aires', 34, 100], ['Córdoba', 18, 53], ['Santa Fe', 14, 41], ['Mendoza', 9, 26]].map(d => `<div class="dr"><div class="dt"><b>${d[0]}</b><span>${d[1]}%</span></div><div class="db"><i data-w="${d[2]}" style="background:#3b82f6"></i></div></div>`).join('')}</div>
    </div></div>`),
  (node) => {
    const panel = node.querySelector('.panel'), cards = [...node.querySelectorAll('.mcard')], charts = [...node.querySelectorAll('#redes1 .panel > div > div')];
    const rl = node.querySelector('.rl2'); let L = 0;
    return (lt, a) => {
      inUp(panel, eo(S(lt, .3, 1.0)), 18); stagger(cards, lt, .7, .1, 16);
      grow(node, eo(S(lt, 1.2, 3.0)));
      if (rl && !L) L = dash(rl); if (rl) rl.style.strokeDashoffset = (1 - eo(S(lt, 1.8, 3.2))) * L;
      runCursor(navCursor('redes', 900, 560), lt, a);
    };
  });

/* 5 · Redes — competitivo */
const R_BENCH = [
  ['Novara', 1, '204K', '42', '2,8%', 58, 30, 12], ['Vanté', 0, '188K', '38', '1,2%', 41, 46, 13],
  ['Kova', 0, '142K', '31', '0,9%', 37, 49, 14], ['Areté', 0, '96K', '24', '0,4%', 33, 52, 15], ['Belmar', 0, '71K', '18', '0,3%', 29, 55, 16],
];
scene('redes2', 52, 61, shell('redes',
  phead('Redes Sociales · Análisis Competitivo', 'Novara vs Vanté · Kova · Areté · Belmar en IG, FB y TikTok', ''), `
  <div style="display:grid;grid-template-columns:1.35fr 1fr;gap:18px;flex:1;min-height:0">
    <div class="panel" style="padding:18px 22px"><div class="ph"><h3>Benchmark de marcas · KPIs comparados</h3></div>
      <table class="mt" style="font-size:13px"><colgroup><col style="width:26%"><col style="width:15%"><col style="width:11%"><col style="width:12%"><col style="width:12%"><col style="width:12%"><col style="width:12%"></colgroup>
      <thead><tr><th class="l">Marca</th><th>Follow.</th><th>Posts</th><th>Eng.</th><th>Pos</th><th>Neg</th><th>Neu</th></tr></thead>
      <tbody>${R_BENCH.map(b => `<tr><td class="l"><span class="mn"><i style="background:${b[1] ? '#dc2626' : '#94a3b8'}"></i>${b[0]}${b[1] ? ' <span style="color:#e11d48;font-weight:800">★</span>' : ''}</span></td><td class="md">${b[2]}</td><td class="md">${b[3]}</td><td style="font-weight:700">${b[4]}</td><td style="color:#16a34a;font-weight:700">${b[5]}%</td><td style="color:#dc2626;font-weight:700">${b[6]}%</td><td style="color:#64748b;font-weight:700">${b[7]}%</td></tr>`).join('')}</tbody></table>
      <div style="margin-top:18px"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">Engagement promedio por marca</div>
        <div class="rank">${R_BENCH.map(b => `<div class="rr"><div class="rl"><i style="background:${b[1] ? '#dc2626' : '#94a3b8'}"></i>${b[0]}${b[1] ? ' <span class="star">★</span>' : ''}</div><div class="rt"><i data-w="${b[4].replace(',', '.').replace('%', '') * 21}" style="background:${b[1] ? '#0a4da0' : '#cbd5e1'}"></i></div><div class="rv">${b[4]}</div></div>`).join('')}</div></div>
      <div style="margin-top:16px"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:6px">Engagement promedio por pilar</div>
        ${hbar('Producto', 82, '4,2%', '#dc2626')}${hbar('Lifestyle', 64, '3,3%', '#f97316')}${hbar('Promoción', 48, '2,5%', '#0ea5e9')}${hbar('Educativo', 30, '1,6%', '#7c3aed')}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:18px;min-height:0">
      <div class="panel sent" style="padding:18px 22px"><div class="ph"><h3>Sentimiento por marca</h3><div class="lg"><span><i style="background:${SEM.up}"></i>Pos</span><span><i style="background:${SEM.dn}"></i>Neg</span><span><i style="background:#64748b"></i>Neu</span></div></div>
        ${R_BENCH.map(b => `<div class="sr"><div class="sl">${b[0]}</div><div class="st"><i data-w="${b[5]}" style="background:${SEM.up}"></i><i data-w="${b[6]}" style="background:${SEM.dn}"></i><i data-w="${b[7]}" style="background:#64748b"></i></div></div>`).join('')}</div>
      <div class="panel" style="padding:18px 22px;flex:1"><div class="ph"><h3>Distribución por tipo de contenido</h3></div>
        ${donut([['Reel', 44, '#dc2626'], ['Feed', 33, '#f97316'], ['Carrusel', 15, '#0ea5e9'], ['Story', 8, '#7c3aed']])}
        <div style="border-top:1px solid var(--line);margin-top:14px;padding-top:14px"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">Análisis cualitativo del sentimiento</div>
          <div style="display:flex;flex-direction:column;gap:9px">${[['Novara', '#dc2626', 'Elogios a la durabilidad y al servicio post-venta; consultas por disponibilidad.'], ['Vanté', '#64748b', 'Demoras de entrega pesan sobre un producto bien valorado.'], ['Kova', '#64748b', 'Percepción de precio alto; buena imagen de diseño.']].map(x => `<div style="background:var(--panel2);border-radius:10px;padding:11px 13px"><div style="font-weight:700;font-size:13.5px;color:${x[1]}">${x[0]}</div><div style="font-size:12.5px;color:var(--muted);margin-top:3px;line-height:1.35">${x[2]}</div></div>`).join('')}</div></div></div>
    </div>
  </div>`),
  (node) => {
    const panels = [...node.querySelectorAll('.panel')], rows = [...node.querySelectorAll('.mt tbody tr')];
    return (lt, a) => {
      stagger(panels, lt, .3, .18, 20); rows.forEach((r, i) => inUp(r, eo(S(lt, 1.0 + i * .1, 1.5 + i * .1)), 10));
      grow(node, eo(S(lt, 1.2, 3.0))); runCursor([{ t: 0, x: 150, y: NAV_Y('redes') + 120 }, { t: .8, x: 600, y: 400 }, { t: 3, x: 1300, y: 360 }, { t: 6, x: 1300, y: 640 }], lt, a);
    };
  });

/* 6 · Web / Ecommerce */
scene('web', 61, 74, shell('web',
  phead('Web · Novara', 'Tráfico real de GA4 — performance, canales, categorías y ventas', '<div class="datep">Últimos 30 días ▾</div>'), `
  <div class="mgrid" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">
    ${metaCard('Tráfico web (usuarios)', 'Usuarios del mes', '318K', 'Ago', [['Mes', 'up', '300K', '▲ 6%', 106], ['Acum. YTD', 'up', '2,3M', '▲ 5%', 105]])}
    ${metaCard('Conversion rate', 'Conversiones ÷ sesiones', '2,4%', 'Ago', [['Mes', 'up', '2,3%', '▲ 4%', 104], ['Acum. YTD', 'up', '2,2%', '▲ 3%', 103]])}
    ${metaCard('Total Ingresos', 'Ingresos ecommerce del mes', '$1,28M', 'Ago', [['Mes', 'up', '$1,15M', '▲ 11%', 111], ['Acum. YTD', 'up', '$9,1M', '▲ 9%', 109]])}
  </div>
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:14px">
    ${kpi('Sesiones', '412K', '▲ 8%', 'up')}${kpi('Transacciones', '4,9K', '▲ 7%', 'up')}${kpi('Pageviews', '1,9M', '', '', '4,6 pág/sesión')}${kpi('Bounce rate', '38,2%', '▼ 2%', 'up')}${kpi('ROAS', '4,6×', '▲ 4%', 'up')}
  </div>
  <div style="display:grid;grid-template-columns:1.35fr 1fr;gap:18px;flex:1;min-height:0">
    <div class="panel" style="padding:18px 22px"><div class="ph"><h3>Evolución mensual · real vs meta</h3><div class="lg"><span><i style="background:var(--real)"></i>Real</span><span><i style="background:var(--meta2)"></i>Meta</span></div></div>
      ${lineSvg('web-l', [258, 272, 266, 288, 296, 318], [250, 258, 264, 272, 288, 300], 230, 340, 720, 190)}
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--faint);font-weight:600;margin-top:2px"><span>Mar</span><span>Abr</span><span>May</span><span>Jun</span><span>Jul</span><span>Ago</span></div>
      <div style="margin-top:14px"><h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:10px">Detalle por canal</h4>
        <table class="sc" style="font-size:13px"><thead><tr><th class="l">Canal</th><th>Usuarios</th><th>%</th><th>PV/ses</th></tr></thead><tbody>
        ${[['Organic Search', '#22c55e', '121K', '38%', '4,9'], ['Paid Search', '#f97316', '86K', '27%', '3,8'], ['Organic Social', '#a78bfa', '60K', '19%', '5,2'], ['Direct', '#64748b', '32K', '10%', '4,1'], ['Referral', '#0ea5e9', '19K', '6%', '3,6']].map(c => `<tr><td class="l"><span style="display:inline-flex;align-items:center;gap:8px"><i style="width:9px;height:9px;border-radius:50%;background:${c[1]}"></i>${c[0]}</span></td><td class="num">${c[2]}</td><td class="num">${c[3]}</td><td class="num">${c[4]}</td></tr>`).join('')}</tbody></table></div></div>
    <div style="display:flex;flex-direction:column;gap:16px;min-height:0">
      <div class="panel" style="padding:16px 20px"><div class="ph"><h3>Performance por categoría</h3></div>
        <table class="sc" style="font-size:13px"><thead><tr><th class="l">Categoría</th><th>Usuarios</th><th>%</th><th>Sesiones</th></tr></thead><tbody>
        ${[['Lavado', '#a78bfa', '121K', '38%', '156K'], ['Refrigeración', '#22c55e', '89K', '28%', '112K'], ['Cocinas', '#f97316', '73K', '23%', '94K'], ['Otros / Home', '#94a3b8', '35K', '11%', '50K']].map(c => `<tr><td class="l"><span style="display:inline-flex;align-items:center;gap:8px"><i style="width:9px;height:9px;border-radius:50%;background:${c[1]}"></i>${c[0]}</span></td><td class="num">${c[2]}</td><td class="num">${c[3]}</td><td class="num">${c[4]}</td></tr>`).join('')}</tbody></table></div>
      <div class="panel demo" style="padding:16px 20px;flex:1"><div class="ph"><h3>Audiencia (GA4)</h3></div>
        <h5>Dispositivos</h5>
        ${[['Mobile', 68, '#22c55e'], ['Desktop', 26, '#3b82f6'], ['Tablet', 6, '#a78bfa']].map(d => `<div class="dr"><div class="dt"><b>${d[0]}</b><span>${d[1]}%</span></div><div class="db"><i data-w="${d[1]}" style="background:${d[2]}"></i></div></div>`).join('')}</div>
    </div>
  </div>`),
  (node) => {
    const cards = [...node.querySelectorAll('.mcard')], kpis = [...node.querySelectorAll('.kpi')], panels = [...node.querySelectorAll('.body > div.panel, .body > div > .panel')];
    const rl = node.querySelector('#web-l .rl'); let L = 0;
    const allPanels = [...node.querySelectorAll('.panel')];
    return (lt, a) => {
      stagger(cards, lt, .3, .1, 16); kpis.forEach((k, i) => inUp(k, eo(S(lt, .8 + i * .07, 1.3 + i * .07)), 14));
      allPanels.forEach((p, i) => inUp(p, eo(S(lt, 1.3 + i * .14, 1.9 + i * .14)), 18));
      const g = eo(S(lt, 1.4, 3.2)); grow(node, g); if (rl && !L) L = dash(rl); if (rl) rl.style.strokeDashoffset = (1 - g) * L;
      runCursor(navCursor('web', 900, 560), lt, a);
    };
  });

/* 7 · Trade Marketing */
function kobj(title, medida, val, sem, chip, ctx, objl, pct) {
  return `<div class="kobj"><div class="kt">${title}</div><div class="km">${medida}</div>
    <div class="kr"><div class="kv" style="color:${SEM[sem]}">${val}</div><div class="kchip" style="color:${SEM[sem]};background:${SEMB[sem]}">${chip}</div></div>
    <div class="kctx">${ctx}</div><div class="kobjl">${objl}</div><div class="kbar"><i data-w="${pct}" style="background:${SEM[sem]}"></i></div></div>`;
}
scene('trade', 74, 87, shell('trade',
  phead('Floor Share', 'Share de góndola por categoría · Ranking de marcas · por cliente', '<div class="datep">Sem 34 · Ago ▾</div>'), `
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:14px">
    ${kobj('Floor Share — general', 'Novara · todas las categorías', '34,2%', 'up', '+3,6 pp', '18.240 / 53.300 · 342 tiendas', 'Objetivo 30,6%', 100)}
    ${kobj('Lavado', 'Share Novara góndola', '42,0%', 'up', '+10,0 pp', '9.870 / 23.500', 'Objetivo 32%', 100)}
    ${kobj('Refrigeración', 'Share Novara góndola', '31,0%', 'up', '+6,0 pp', '5.420 / 17.480', 'Objetivo 25%', 100)}
    ${kobj('Cocción', 'Share Novara góndola', '26,0%', 'up', '+3,0 pp', '2.950 / 11.340', 'Objetivo 23%', 100)}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1.15fr;gap:18px;flex:1;min-height:0">
    <div class="panel rank" style="padding:18px 22px"><div class="ph"><h3>🏆 Ranking de marcas</h3><div class="sub">share total góndola</div></div>
      ${[['Novara', 1, 34.2, '#2b4dff'], ['Aurex', 0, 22.5, '#fb923c'], ['Vanté', 0, 16.8, '#22c55e'], ['Kova', 0, 12.1, '#a78bfa'], ['Belmar', 0, 8.4, '#ec4899'], ['Otros', 0, 6.0, '#94a3b8']].map(b => `<div class="rr"><div class="rl">${b[0]}${b[1] ? ' <span class="star">★</span>' : ''}</div><div class="rt"><i data-w="${b[2] / 34.2 * 100}" style="background:${b[3]};opacity:${b[1] ? 1 : .65}"></i></div><div class="rv">${b[2].toFixed(1).replace('.', ',')}%</div></div>`).join('')}</div>
    <div class="panel" style="padding:18px 22px"><div class="ph"><h3>Performance por cliente</h3><div class="sub">Δ vs objetivo</div></div>
      <table class="sc2" style="font-size:13px"><thead><tr class="g1"><th class="l" rowspan="2">Cliente</th><th colspan="2">FS Lavado</th><th colspan="2">FS Refri</th><th colspan="2">FS Cocción</th></tr><tr class="g2"><th>%</th><th>Δ</th><th>%</th><th>Δ</th><th>%</th><th>Δ</th></tr></thead>
      <tbody>${[['Cadena Norte', ['44', '+12', 'up'], ['33', '+8', 'up'], ['28', '+5', 'up']], ['Retail Sur', ['41', '+9', 'up'], ['29', '+4', 'up'], ['24', '+1', 'up']], ['MayorCenter', ['38', '+6', 'up'], ['26', '+1', 'up'], ['21', '-2', 'mid']], ['Distrib. Este', ['35', '+3', 'up'], ['22', '-3', 'mid'], ['19', '-4', 'dn']]].map(r => `<tr><td class="l"><span class="kn">${r[0]}</span></td>${[1, 2, 3].map(i => `<td style="font-weight:700">${r[i][0]}%</td><td style="color:${SEM[r[i][2]]};font-weight:700">${r[i][1]}pp</td>`).join('')}</tr>`).join('')}</tbody></table>
      <div style="margin-top:16px"><h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:8px">Cuadros Básicos · cumplimiento por categoría</h4>
        <div style="display:flex;gap:14px;font-size:12px;color:var(--muted);font-weight:600;margin-bottom:6px"><span><i style="display:inline-block;width:11px;height:11px;border-radius:3px;background:#2b4dff;vertical-align:-1px;margin-right:5px"></i>% CB</span><span><i style="display:inline-block;width:11px;height:11px;border-radius:3px;background:#a78bfa;vertical-align:-1px;margin-right:5px"></i>Infaltables</span><span><i style="display:inline-block;width:11px;height:11px;border-radius:3px;background:#ec4899;vertical-align:-1px;margin-right:5px"></i>Estratégico</span></div>
        ${vbars(['Lavado', 'Refrig.', 'Cocción'], [{ color: '#2b4dff', vals: [88, 82, 79] }, { color: '#a78bfa', vals: [84, 78, 74] }, { color: '#ec4899', vals: [80, 75, 70] }], 100, 96, 20)}</div></div>
  </div>`),
  (node) => {
    const cards = [...node.querySelectorAll('.kobj')], panels = [...node.querySelectorAll('.panel')], rows = [...node.querySelectorAll('.sc2 tbody tr')];
    return (lt, a) => {
      stagger(cards, lt, .3, .1, 16); panels.forEach((p, i) => inUp(p, eo(S(lt, .9 + i * .16, 1.5 + i * .16)), 18));
      rows.forEach((r, i) => inUp(r, eo(S(lt, 1.6 + i * .1, 2.1 + i * .1)), 10));
      grow(node, eo(S(lt, 1.0, 3.0))); runCursor(navCursor('trade', 560, 420), lt, a);
    };
  });

/* 8 · Copiloto IA (cruza dashboards) */
scene('ia', 87, 100, shell('web',
  phead('Web · Novara', 'Tráfico real de GA4 — performance, canales, categorías y ventas', '<div class="datep">Últimos 30 días ▾</div>'), `
  <div style="opacity:.5;filter:blur(1.5px)">
    <div class="mgrid" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
      ${metaCard('Tráfico web', 'Usuarios del mes', '318K', 'Ago', [['Mes', 'up', '300K', '▲ 6%', 106]])}
      ${metaCard('Conversion rate', 'Conv ÷ sesiones', '2,4%', 'Ago', [['Mes', 'up', '2,3%', '▲ 4%', 104]])}
      ${metaCard('Ingresos', 'Ecommerce del mes', '$1,28M', 'Ago', [['Mes', 'up', '$1,15M', '▲ 11%', 111]])}
    </div>
    <div class="panel" style="padding:18px 22px">${lineSvg('ia-bg', [258, 272, 266, 288, 296, 318], [250, 258, 264, 272, 288, 300], 230, 340, 900, 150)}</div>
  </div>
  <div class="fab">✨ Preguntá a tus datos</div>
  <div class="cdrawer">
    <div class="ch"><b><span class="sp">${I.spark}</span>Copiloto de datos</b><span class="x">✕</span></div>
    <div class="cbody">
      <div class="chips"><p>Preguntame sobre tus datos o pedime un gráfico. Ejemplos:</p>
        <div class="chip2">¿Qué movió la Intención de Compra este mes?</div><div class="chip2">Graficá alcance vs engagement mensual</div></div>
      <div class="ubub">¿Qué movió la aguja en Refrigeración este mes?</div>
      <div class="abub"><div class="cop"><span class="sp">${I.spark}</span>Copiloto</div>
        La <b>pauta en YouTube</b> (Plan de Medios) subió el <b>VTR a 30,6%</b>, que empujó la <b>Intención de Compra +2,1 pts</b> (Salud de Marca) y arrastró la <b>facturación de Refrigeración +9%</b> (Web/Ecommerce).
        <svg viewBox="0 0 400 66" style="width:100%;height:66px;margin-top:10px"><polyline points="8,50 60,52 112,54 164,54 216,55" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 4"/><polyline class="rl2" points="8,52 60,46 112,48 164,34 216,30 268,20 330,16 392,10" fill="none" stroke="var(--real)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <div style="margin-top:8px;font-size:12px;color:var(--faint)">El hilo cruza 3 dashboards: Pauta → Marca → Negocio.</div></div>
    </div>
    <div class="cinp"><div class="box">Escribí tu pregunta…</div><div class="snd">➤</div></div>
  </div>`),
  (node) => {
    const fab = node.querySelector('.fab'), drawer = node.querySelector('.cdrawer'), chips = node.querySelector('.chips'), ub = node.querySelector('.ubub'), ab = node.querySelector('.abub');
    const rl = node.querySelector('.rl2'); let L = 0;
    return (lt, a) => {
      inUp(fab, eo(S(lt, .3, .9)), 14);
      const dp = eo(S(lt, 1.0, 1.8)); drawer.style.opacity = dp; drawer.style.transform = `translateX(${(1 - dp) * 100}%)`;
      inUp(chips, eo(S(lt, 1.9, 2.4)), 10); inUp(ub, eo(S(lt, 2.5, 3.0)), 14); inUp(ab, eo(S(lt, 3.4, 4.1)), 16);
      if (rl && !L) L = dash(rl); if (rl) rl.style.strokeDashoffset = (1 - eo(S(lt, 4.2, 5.6))) * L;
      runCursor([{ t: 0, x: 1600, y: 900 }, { t: .7, x: 1650, y: 1010 }, { t: 1.0, x: 1650, y: 1010, click: 1 }, { t: 2.2, x: 1500, y: 400 }, { t: 6, x: 1500, y: 560 }], lt, a);
    };
  });

/* 9 · Inversión de Marketing */
function cuad(id, label, badge, badgeCls, big, bg, rows) {
  return `<div class="cuad"><div style="display:flex;align-items:flex-start"><div><div class="ct">${id} · ${label}</div><div class="cs">Real vs BGT vigente · acum.</div></div><div class="cbadge" style="color:${badgeCls[0]};background:${badgeCls[1]}">${badge}</div></div>
    <div class="cbig">${big}</div><div class="cbg">${bg}</div>
    <div class="crow">${rows.map(r => mrow(...r)).join('')}</div></div>`;
}
scene('inv', 100, 111, shell('inv',
  phead('Inversión de Marketing', 'Ejecución del presupuesto y comparador de versiones (A vs B)', ''), `
  <div class="stitle">Ejecución del Presupuesto <span style="color:var(--faint);font-weight:500">· Real 2026 vs BGT vigente por cuatrimestre · meta: desvío &lt; 5% y Inv/Fact ≤ 1,3%</span></div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px">
    ${cuad('T1', 'BGT', 'cerrado', ['#047857', '#dcfce7'], 'US$ 4,9M', 'BGT vigente US$ 5,0M · Facturación US$ 402M', [['Desvío vs BGT', 'up', '&lt; 5%', '▼ 2,0%', 98], ['Inv / Facturación', 'up', '≤ 1,3%', '1,22%', 94]])}
    ${cuad('T2', '4+8', 'cerrado', ['#047857', '#dcfce7'], 'US$ 5,3M', 'BGT vigente US$ 5,2M · Facturación US$ 445M', [['Desvío vs BGT', 'up', '&lt; 5%', '▲ 1,9%', 98], ['Inv / Facturación', 'up', '≤ 1,3%', '1,19%', 92]])}
    ${cuad('T3', '8+4', 'en curso', ['#0a7fce', '#e6f4fe'], 'US$ 2,1M', 'BGT vigente US$ 5,4M · Facturación US$ 190M', [['Desvío vs BGT', 'na', '&lt; 5%', 'en curso', 40], ['Inv / Facturación', 'up', '≤ 1,3%', '1,11%', 85]])}
  </div>
  <div class="panel" style="flex:1;padding:18px 22px"><div class="ph"><h3>Comparador de presupuestos</h3><div class="sub">Real 2026 (A) vs 4+8 2026 (B) · año completo</div></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px">
      ${[['Presupuesto A', 'US$ 15,4M', '#1e40af', '2.140 registros'], ['Presupuesto B', 'US$ 15,9M', '#94a3b8', '2.086 registros'], ['Diferencia (A − B)', '−US$ 0,5M', '#dc2626', 'A queda debajo de B'], ['Variación %', '−3,1%', '#dc2626', 'A vs B']].map(k => `<div style="border:1px solid var(--line);border-radius:14px;padding:14px 16px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700">${k[0]}</div><div style="font-family:var(--disp);font-weight:800;font-size:26px;color:${k[2]};margin-top:6px;font-variant-numeric:tabular-nums">${k[1]}</div><div style="font-size:11px;color:var(--muted);margin-top:3px">${k[3]}</div></div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px"><div>
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:8px">Evolución mensual · A vs B</div>
      <div style="display:flex;gap:16px;font-size:12px;color:var(--muted);font-weight:600;margin-bottom:6px"><span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#1e40af;vertical-align:-1px;margin-right:5px"></i>Real (A)</span><span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#94a3b8;vertical-align:-1px;margin-right:5px"></i>4+8 (B)</span></div>
      ${vbars(['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A'], [{ color: '#94a3b8', vals: [1.2, 1.3, 1.3, 1.4, 1.5, 1.4, 1.5, 1.6] }, { color: '#1e40af', vals: [1.1, 1.3, 1.2, 1.4, 1.6, 1.3, 1.6, 1.7] }], 1.9, 120, 11)}</div>
      <div><div style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);font-weight:700;margin-bottom:8px">Acumulado del período</div>
      ${lineSvg('inv-l', [1.1, 2.4, 3.6, 5.0, 6.6, 7.9, 9.5, 11.2], [1.2, 2.5, 3.8, 5.2, 6.7, 8.1, 9.6, 11.1], 0, 12, 640, 150)}</div>
    </div></div>`),
  (node) => {
    const cuads = [...node.querySelectorAll('.cuad')], panel = node.querySelector('.panel'), kcards = [...node.querySelectorAll('.panel > div > div')];
    const rl = node.querySelector('#inv-l .rl'); let L = 0;
    return (lt, a) => {
      stagger(cuads, lt, .3, .14, 18); inUp(panel, eo(S(lt, 1.1, 1.7)), 20);
      const g = eo(S(lt, 1.4, 3.4)); grow(node, g); if (rl && !L) L = dash(rl); if (rl) rl.style.strokeDashoffset = (1 - g) * L;
      runCursor(navCursor('inv', 700, 640), lt, a);
    };
  });

/* 10 · Cierre */
scene('outro', 111, 117, `<div class="cover">
  <div class="logo"><div class="bip">BIP<span class="tri"></span></div><div class="tag">Business<br>Impact<br>Platform</div></div>
  <h1 id="o1" style="font-size:64px">Todo tu marketing,<br><span class="hl">conectado al resultado.</span></h1>
  <div id="o2" style="margin-top:44px;background:#9db9de55;border:1px solid #ffffff22;color:#fff;font-family:var(--disp);font-weight:700;font-size:24px;padding:20px 44px;border-radius:14px">Agendá una demo →</div>
</div>`, (node) => {
  const parts = [node.querySelector('.logo'), node.querySelector('#o1'), node.querySelector('#o2')];
  return (lt) => parts.forEach((p, i) => inUp(p, eo(S(lt, .2 + i * .28, 1.0 + i * .28)), 26));
});

/* ---------- motor seek ---------- */
window.__DURATION = DUR;
window.__seek = function (t) {
  cursorUsed = false;
  for (const s of SCENES) {
    const ai = s.start <= 0 ? 1 : eo(S(t, s.start - LEAD, s.start + .05));
    const ao = s.end >= DUR ? 1 : 1 - eo(S(t, s.end - LEAD, s.end + .05));
    const a = Math.min(ai, ao);
    if (a <= .002) { s.node.style.display = 'none'; continue; }
    s.node.style.display = 'block'; s.node.style.opacity = a;
    s.node.style.transform = `translateY(${(1 - ai) * 14}px) scale(${lerp(.997, 1, ai)})`;
    s.draw(Math.max(0, (t - s.start) / SPEED), a);
  }
  if (!cursorUsed) { cursorEl.style.opacity = 0; ringEl.style.opacity = 0; }
};
window.__seek(0);
window.__ready = true;
