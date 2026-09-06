/* =========================================================================
   BIP · Recorrido de la plataforma (tour de dashboards)
   Animación determinística: todo el estado sale de window.__seek(t).
   DATOS 100% FICTICIOS: marca "Novara" + competidores inventados. Sin data real.
   ========================================================================= */
const BASE = 30.0;
const DUR = 64.0;
const SPEED = DUR / BASE;
const LEAD = 0.26 * SPEED;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const S = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const eo = p => 1 - Math.pow(1 - p, 3);
const eio = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const lerp = (a, b, p) => a + (b - a) * p;
const nf = (n, d = 0) => n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
function el(t, c, h) { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
function mk(h) { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; }
function inUp(node, p, dist = 22) { node.style.opacity = p; node.style.transform = `translateY(${(1 - p) * dist}px)`; }
/* longitud de trazo (lazy: solo cuando la escena ya está renderizada, no en display:none) */
function dash(el) { let L = 0; try { L = el.getTotalLength(); } catch { return 0; } el.style.strokeDasharray = L; return L; }

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
};

const NAV = [
  { k: 'seg', label: 'Seguimiento de Objetivos', icon: I.target },
  { k: 'medios', label: 'Plan de Medios', icon: I.chart },
  { k: 'redes', label: 'Redes Sociales', icon: I.share },
  { k: 'web', label: 'Web / Ecommerce', icon: I.globe },
  { k: 'trade', label: 'Trade Marketing', icon: I.store },
  { k: 'marca', label: 'Salud de Marca', icon: I.heart },
  { k: 'inv', label: 'Inversión', icon: I.dollar },
  { k: 'ia', label: 'Copiloto IA', icon: I.spark },
];
const NAV_Y = k => { const i = NAV.findIndex(n => n.k === k); return 176 + i * 41; };

function shell(active, body) {
  const nav = NAV.map(n => `<a class="${n.k === active ? 'active' : ''}"><span class="ic">${n.icon}</span><span class="truncate">${n.label}</span></a>`).join('');
  return `<div class="app">
    <aside class="side">
      <div class="logo"><div class="bip">BIP<span class="tri"></span></div><div class="tag">Business<br>Impact<br>Platform</div></div>
      <nav class="nav">${nav}</nav>
    </aside>
    <div class="main">
      <div class="top"><div class="brand"><div class="bdot">N</div><div class="bn">Novara</div><span class="bs">· Electro</span></div>
        <div class="rt"><span class="pill">Datos ilustrativos</span><div class="av">ML</div></div></div>
      <div class="body">${body}</div>
    </div>
  </div>`;
}

/* KPI tile */
function kpi(label, cv, suf, dec, delta, dcls) {
  return `<div class="kpi"><div class="kl">${label}</div>
    <div class="kv num"><span data-cv="${cv}" data-suf="${suf || ''}" data-dec="${dec || 0}"></span></div>
    ${delta ? `<span class="kd ${dcls}">${delta}</span>` : ''}</div>`;
}
/* barra horizontal */
function hbar(label, wpct, valTxt, color) {
  return `<div style="display:flex;align-items:center;gap:14px;padding:9px 0">
    <div style="width:150px;font-size:15px;font-weight:600">${label}</div>
    <div style="flex:1;height:14px;border-radius:8px;background:var(--panel2);overflow:hidden"><i data-w="${wpct}" style="display:block;height:100%;border-radius:8px;background:${color}"></i></div>
    <div class="num" style="width:96px;text-align:right;font-family:var(--disp);font-weight:700;font-size:16px">${valTxt}</div></div>`;
}

/* motor */
const stage = document.getElementById('stage');
const SCENES = [];
function scene(id, start, end, html, init) {
  const node = mk(`<div class="scene" id="${id}">${html}</div>`);
  stage.appendChild(node);
  const o = { id, start: start * SPEED, end: end * SPEED, node };
  o.draw = init(node, o) || (() => {});
  SCENES.push(o);
  return o;
}
/* animación genérica: cuenta-up + barras */
function grow(node, p) {
  node.querySelectorAll('[data-cv]').forEach(e => { e.textContent = nf(+e.dataset.cv * p, +(e.dataset.dec || 0)) + (e.dataset.suf || ''); });
  node.querySelectorAll('[data-w]').forEach(e => { e.style.width = (+e.dataset.w * p) + '%'; });
}
function staggerPanels(nodes, lt, t0 = .2, step = .18) { nodes.forEach((n, i) => inUp(n, eo(S(lt, t0 + i * step, t0 + .5 + i * step)), 22)); }

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
/* cursor que entra por la nav del dash y va a un punto del contenido */
function navCursor(key, toX, toY) {
  const ny = NAV_Y(key);
  return [{ t: 0, x: 150, y: ny + 120 }, { t: .18, x: 135, y: ny }, { t: .28, x: 135, y: ny, click: 1 }, { t: 1.1, x: toX, y: toY }, { t: 2.4, x: toX + 40, y: toY + 30 }];
}

/* mini line chart svg: real (navy) + meta (gris punteada). devuelve {svg, animate(p)} */
function lineSvg(id, real, meta, ymin, ymax, w = 900, h = 250) {
  const n = real.length, X = i => 30 + i * ((w - 60) / (n - 1)), Y = v => h - 20 - (v - ymin) / (ymax - ymin) * (h - 44);
  const path = a => a.map((v, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1)).join(' ');
  return `<svg id="${id}" viewBox="0 0 ${w} ${h}" style="width:100%;height:${h}px">
    <path d="${path(meta)}" fill="none" stroke="var(--meta2)" stroke-width="3" stroke-dasharray="8 7" stroke-linecap="round" opacity=".9"/>
    <path class="rl" d="${path(real)}" fill="none" stroke="var(--real)" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle class="dot" r="7" fill="var(--real)" stroke="#fff" stroke-width="3.5" cx="${X(n - 1)}" cy="${Y(real[n - 1])}"/>
  </svg>`;
}

/* =========================== ESCENAS =========================== */

/* 0 · Intro */
scene('intro', 0, 1.6, `<div class="cover">
  <div class="logo"><div class="bip">BIP<span class="tri"></span></div><div class="tag">Business<br>Impact<br>Platform</div></div>
  <h1>Un recorrido por <span class="hl">la plataforma.</span></h1>
  <p>Dashboards conectados, de la estrategia al resultado.</p>
  <div class="note">Marca y datos ilustrativos · no representan a ninguna empresa real</div>
</div>`, (node) => {
  const parts = [node.querySelector('.logo'), node.querySelector('h1'), node.querySelector('.cover p'), node.querySelector('.note')];
  return (lt) => parts.forEach((p, i) => inUp(p, eo(S(lt, .1 + i * .16, .8 + i * .16)), 26));
});

/* 1 · Seguimiento de Objetivos */
const OBJ = [
  ['Top of Mind', '#a855f7', 92, '31,4', '33,0', 95], ['Share of Mind', '#16a34a', 90, '58,5', '62,0', 93],
  ['Intención de Compra', '#f59e0b', 91, '34,1', '36,0', 92], ['Facturación', '#3b82f6', 94, 'US$ 14,4M', 'US$ 15,5M', 94],
];
const SCROWS = [
  ['Alcance único', '26,0M', '25,0M', 'up', '▲ 4%'], ['Frecuencia', '3,5×', '3,4×', 'up', '▲ 3%'],
  ['Impresiones', '212,0M', '200,0M', 'up', '▲ 6%'], ['VTR (≥50%)', '30,6%', '30,0%', 'up', '▲ 2%'],
  ['Clicks', '1,65M', '1,70M', 'mid', '▼ 3%'],
];
scene('seg', 1.6, 5.8, shell('seg', `
  <div class="phead"><h2>Seguimiento de Objetivos</h2><div class="ps">Real vs meta · Septiembre</div><div class="mo">● 4 en verde</div></div>
  <div class="ocards" style="margin-bottom:20px">
    ${OBJ.map(o => `<div class="ocard"><div class="oh"><span class="odot" style="background:${o[1]}"></span><span class="on">${o[0]}</span><span class="oc"><b>${o[2]}%</b><small>Cumpl. mes</small></span></div>
      <div class="obig">${o[3]} <span>/ ${o[4]}</span></div><div class="obar"><i data-w="${o[5]}"></i></div><div class="olbl">Avance YTD ${o[5]}% de la meta</div></div>`).join('')}
  </div>
  <div class="panel" style="flex:1"><div class="ph"><h3>KPIs por plan</h3><div class="lg"><span><i style="background:var(--real)"></i>Real</span><span><i style="background:var(--meta2)"></i>Meta</span></div></div>
    <table class="sc"><thead><tr><th class="l">KPI</th><th>Real</th><th>Meta</th><th>Desvío</th><th class="l" style="padding-left:34px">Evolución</th></tr></thead><tbody>
    ${SCROWS.map((r, i) => `<tr><td class="l"><span class="kn">${r[0]}</span></td><td class="num">${r[1]}</td><td class="num mv">${r[2]}</td><td><span class="chip ${r[3]}">${r[4]}</span></td>
      <td class="l" style="padding-left:34px"><svg viewBox="0 0 120 26" style="width:120px;height:26px"><polyline points="2,20 22,14 42,17 62,9 82,12 100,6 118,4" fill="none" stroke="var(--real)" stroke-width="2.4" stroke-linecap="round"/><polyline points="2,18 22,16 42,15 62,13 82,12 100,10 118,9" fill="none" stroke="var(--meta2)" stroke-width="1.6" stroke-dasharray="3 3"/></svg></td></tr>`).join('')}
    </tbody></table></div>`), (node) => {
  const cards = [...node.querySelectorAll('.ocard')], panel = node.querySelector('.panel');
  return (lt, a) => { cards.forEach((c, i) => inUp(c, eo(S(lt, .3 + i * .1, .8 + i * .1)), 20)); inUp(panel, eo(S(lt, .8, 1.3)), 22);
    grow(node, eo(S(lt, .5, 2.2))); runCursor(navCursor('seg', 900, 300), lt, a); };
});

/* 2 · Plan de Medios */
scene('medios', 5.8, 9.8, shell('medios', `
  <div class="phead"><h2>Plan de Medios · ON + OFF</h2><div class="ps">Eficiencia e inversión por medio</div></div>
  <div class="kpirow" style="margin-bottom:20px">
    ${kpi('Inversión', 8.9, 'M', 1, '▲ 6%', 'up')}${kpi('Alcance único', 26.0, 'M', 1, '▲ 4%', 'up')}${kpi('Frecuencia', 3.5, '×', 1, '▲ 3%', 'up')}${kpi('VTR ≥50%', 30.6, '%', 1, '▲ 2%', 'up')}
  </div>
  <div class="grid" style="grid-template-columns:1.15fr .85fr;flex:1">
    <div class="panel"><div class="ph"><h3>Inversión por medio</h3><div class="sub">Mix del mes</div></div>
      ${hbar('Meta', 92, 'US$ 3,1M', 'var(--navy)')}${hbar('Google', 74, 'US$ 2,4M', 'var(--navy)')}${hbar('YouTube', 55, 'US$ 1,6M', 'var(--cyan-ink)')}${hbar('DV360', 40, 'US$ 1,0M', 'var(--cyan-ink)')}${hbar('TikTok', 24, 'US$ 0,6M', 'var(--cyan)')}
    </div>
    <div class="panel"><div class="ph"><h3>Eficiencia (CPM)</h3><div class="lg"><span><i style="background:var(--real)"></i>Real</span></div></div>
      ${lineSvg('med-l', [16, 14, 13, 11, 12, 10, 9], [15, 15, 14, 14, 13, 13, 12], 6, 18, 620, 210)}
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--faint);font-weight:600;margin-top:-6px"><span>Ene</span><span>Abr</span><span>Jul</span><span>Sep</span></div></div>
  </div>`), (node) => {
  const panels = [...node.querySelectorAll('.panel')], kpis = [...node.querySelectorAll('.kpi')];
  const rl = node.querySelector('#med-l .rl'); let L = 0;
  return (lt, a) => { if (rl && !L) L = dash(rl); kpis.forEach((k, i) => inUp(k, eo(S(lt, .3 + i * .08, .75 + i * .08)), 18)); panels.forEach((p, i) => inUp(p, eo(S(lt, .7 + i * .12, 1.2 + i * .12)), 22));
    const g = eo(S(lt, .5, 2.2)); grow(node, g); if (rl) rl.style.strokeDashoffset = (1 - g) * L; runCursor(navCursor('medios', 500, 340), lt, a); };
});

/* 3 · Redes Sociales */
const BENCH = [
  ['Novara', '204K', '2,8%', 60, '#0a4da0'], ['Vanté', '188K', '1,2%', 26, '#94a3b8'],
  ['Kova', '142K', '0,9%', 21, '#94a3b8'], ['Areté', '96K', '0,4%', 12, '#94a3b8'], ['Belmar', '71K', '0,3%', 8, '#94a3b8'],
];
const SENT = [['Novara', 58, 30, 12], ['Vanté', 41, 46, 13], ['Kova', 37, 49, 14], ['Areté', 33, 52, 15]];
scene('redes', 9.8, 13.8, shell('redes', `
  <div class="phead"><h2>Redes Sociales</h2><div class="ps">Orgánico + competencia · Instagram</div></div>
  <div class="kpirow" style="margin-bottom:20px">
    ${kpi('Engagement prom.', 2.8, '%', 1, '▲ 5%', 'up')}${kpi('Alcance', 4.1, 'M', 1, '▲ 8%', 'up')}${kpi('Seguidores', 204, 'K', 0, '▲ 3%', 'up')}${kpi('Posteos', 42, '', 0, '', '')}
  </div>
  <div class="grid" style="grid-template-columns:1fr 1fr;flex:1">
    <div class="panel"><div class="ph"><h3>Benchmark de marcas</h3><div class="sub">vs competencia</div></div>
      ${BENCH.map(b => hbar(b[0] + '  ' + b[2], b[3], b[2] + ' eng', b[4])).join('')}</div>
    <div class="panel"><div class="ph"><h3>Sentimiento por marca</h3><div class="lg"><span><i style="background:var(--g)"></i>Pos</span><span><i style="background:var(--r)"></i>Neg</span><span><i style="background:var(--meta2)"></i>Neu</span></div></div>
      ${SENT.map(s => `<div style="display:flex;align-items:center;gap:12px;padding:11px 0"><div style="width:78px;font-size:15px;font-weight:600">${s[0]}</div>
        <div style="flex:1;height:22px;border-radius:6px;overflow:hidden;display:flex;background:var(--panel2)"><i data-w="${s[1]}" style="background:var(--g);height:100%"></i><i data-w="${s[2]}" style="background:var(--r);height:100%"></i><i data-w="${s[3]}" style="background:var(--meta2);height:100%"></i></div></div>`).join('')}</div>
  </div>`), (node) => {
  const panels = [...node.querySelectorAll('.panel')], kpis = [...node.querySelectorAll('.kpi')];
  return (lt, a) => { kpis.forEach((k, i) => inUp(k, eo(S(lt, .3 + i * .08, .75 + i * .08)), 18)); panels.forEach((p, i) => inUp(p, eo(S(lt, .7 + i * .12, 1.2 + i * .12)), 22));
    grow(node, eo(S(lt, .5, 2.3))); runCursor(navCursor('redes', 480, 360), lt, a); };
});

/* 4 · Web / Ecommerce */
scene('web', 13.8, 17.8, shell('web', `
  <div class="phead"><h2>Web / Ecommerce</h2><div class="ps">Tráfico, fuentes y ventas</div></div>
  <div class="kpirow" style="margin-bottom:20px">
    ${kpi('Usuarios', 318, 'K', 0, '▲ 11%', 'up')}${kpi('Transacciones', 4.9, 'K', 1, '▲ 7%', 'up')}${kpi('Ingresos', 1.28, 'M', 2, '▲ 9%', 'up')}${kpi('ROAS', 4.6, '×', 1, '▲ 4%', 'up')}
  </div>
  <div class="grid" style="grid-template-columns:1.3fr .7fr;flex:1">
    <div class="panel"><div class="ph"><h3>Tráfico</h3><div class="lg"><span><i style="background:var(--real)"></i>Este año</span><span><i style="background:var(--meta2)"></i>Año anterior</span></div></div>
      ${lineSvg('web-l', [120, 150, 140, 190, 210, 240, 260], [110, 120, 130, 135, 150, 160, 170], 90, 280, 700, 250)}
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--faint);font-weight:600"><span>Mar</span><span>May</span><span>Jul</span><span>Sep</span></div></div>
    <div class="panel"><div class="ph"><h3>Fuentes de tráfico</h3></div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:6px">
        ${[['Orgánico', 38, 'var(--navy)'], ['Pago', 27, 'var(--cyan-ink)'], ['Social', 19, 'var(--cyan)'], ['Directo', 10, '#7fb4e6'], ['Referral', 6, '#c3d9f0']].map(s => `<div style="display:flex;align-items:center;gap:11px"><div style="width:78px;font-size:14px;font-weight:600">${s[0]}</div><div style="flex:1;height:12px;border-radius:7px;background:var(--panel2);overflow:hidden"><i data-w="${s[1] * 2.4}" style="display:block;height:100%;background:${s[2]}"></i></div><div class="num" style="width:38px;text-align:right;font-weight:700;font-size:14px">${s[1]}%</div></div>`).join('')}</div></div>
  </div>`), (node) => {
  const panels = [...node.querySelectorAll('.panel')], kpis = [...node.querySelectorAll('.kpi')];
  const rl = node.querySelector('#web-l .rl'); let L = 0;
  return (lt, a) => { if (rl && !L) L = dash(rl); kpis.forEach((k, i) => inUp(k, eo(S(lt, .3 + i * .08, .75 + i * .08)), 18)); panels.forEach((p, i) => inUp(p, eo(S(lt, .7 + i * .12, 1.2 + i * .12)), 22));
    const g = eo(S(lt, .5, 2.2)); grow(node, g); if (rl) rl.style.strokeDashoffset = (1 - g) * L; runCursor(navCursor('web', 520, 330), lt, a); };
});

/* 5 · Trade Marketing */
scene('trade', 17.8, 21.8, shell('trade', `
  <div class="phead"><h2>Trade Marketing</h2><div class="ps">Surtido y Floor Share por góndola</div></div>
  <div class="kpirow" style="margin-bottom:20px">
    ${kpi('Cobertura', 87, '%', 0, '▲ 2 pts', 'up')}${kpi('Floor Share', 34, '%', 0, '▲ 3 pts', 'up')}${kpi('Surtido (SKUs)', 128, '', 0, '', '')}${kpi('Tiendas relevadas', 342, '', 0, '', '')}
  </div>
  <div class="grid" style="grid-template-columns:1fr 1fr;flex:1">
    <div class="panel"><div class="ph"><h3>Floor Share por categoría</h3><div class="sub">Novara vs góndola</div></div>
      ${hbar('Lavado', 42, '42%', 'var(--navy)')}${hbar('Refrigeración', 31, '31%', 'var(--cyan-ink)')}${hbar('Cocción', 26, '26%', 'var(--cyan)')}
      <div style="margin-top:14px;padding:14px 16px;border-radius:12px;background:var(--g-s);display:flex;align-items:center;gap:12px;font-size:15px;font-weight:600;color:#15803d"><span style="font-size:18px">▲</span>+3 pts vs. el trimestre anterior</div></div>
    <div class="panel"><div class="ph"><h3>Cobertura por cliente</h3></div>
      <table class="sc"><thead><tr><th class="l">Cliente</th><th>Tiendas</th><th>Cobertura</th><th>Surtido</th></tr></thead><tbody>
      ${[['Cadena Norte', '128', '94%', '96%'], ['Retail Sur', '96', '89%', '91%'], ['MayorCenter', '74', '82%', '85%'], ['Distrib. Este', '44', '78%', '80%']].map(r => `<tr><td class="l"><span class="kn">${r[0]}</span></td><td class="num">${r[1]}</td><td class="num">${r[2]}</td><td class="num">${r[3]}</td></tr>`).join('')}
      </tbody></table></div>
  </div>`), (node) => {
  const panels = [...node.querySelectorAll('.panel')], kpis = [...node.querySelectorAll('.kpi')];
  return (lt, a) => { kpis.forEach((k, i) => inUp(k, eo(S(lt, .3 + i * .08, .75 + i * .08)), 18)); panels.forEach((p, i) => inUp(p, eo(S(lt, .7 + i * .12, 1.2 + i * .12)), 22));
    grow(node, eo(S(lt, .5, 2.2))); runCursor(navCursor('trade', 470, 320), lt, a); };
});

/* 6 · Copiloto IA */
scene('ia', 21.8, 26.2, shell('ia', `
  <div class="phead"><h2>Copiloto IA</h2><div class="ps">Preguntá a tus datos · insights automáticos</div></div>
  <div class="grid" style="grid-template-columns:1.15fr .85fr;flex:1">
    <div class="panel" style="display:flex;flex-direction:column">
      <div class="ph"><h3>Preguntá a tus datos</h3></div>
      <div class="q" style="align-self:flex-end;max-width:78%;background:var(--navy);color:#fff;padding:15px 18px;border-radius:16px 16px 4px 16px;font-size:16px;font-weight:500">¿Qué movió la aguja en Refrigeración este mes?</div>
      <div class="ans" style="margin-top:16px;max-width:88%;background:var(--panel2);border:1px solid var(--line);padding:16px 18px;border-radius:16px 16px 16px 4px;font-size:15.5px;line-height:1.5">
        <div style="display:flex;align-items:center;gap:8px;font-family:var(--disp);font-weight:700;color:var(--cyan-ink);margin-bottom:8px"><span style="width:20px;height:20px">${I.spark}</span>Copiloto</div>
        La <b>pauta en YouTube</b> explica el <b>+6%</b> de alcance. El VTR subió a 30,6% y arrastró la Intención de Compra (+2,1 pts) en la categoría.
        <svg viewBox="0 0 380 70" style="width:100%;height:70px;margin-top:10px"><polyline class="rl2" points="6,58 66,50 126,52 186,38 246,40 306,24 374,16" fill="none" stroke="var(--real)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
    </div>
    <div class="panel"><div class="ph"><h3>Insights automáticos</h3></div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:4px">
        ${[['#dcfce7', '#16a34a', '↑', 'El <b>VTR</b> es el KPI de mayor correlación con Top of Mind.'], ['#fef3c7', '#d97706', '!', '<b>Frecuencia</b> por debajo de la meta en Lavado.'], ['#e6f4fe', '#0a7fce', '◆', 'Social Media es el mayor driver de <b>Intención de Compra</b>.']].map(x => `<div class="ins" style="display:flex;gap:12px;align-items:flex-start;padding:14px 15px;border:1px solid var(--line);border-radius:13px">
          <span style="width:34px;height:34px;border-radius:9px;flex:none;display:grid;place-items:center;font-weight:800;background:${x[0]};color:${x[1]}">${x[2]}</span>
          <span style="font-size:14.5px;line-height:1.4">${x[3]}</span></div>`).join('')}</div></div>
  </div>`), (node) => {
  const q = node.querySelector('.q'), ans = node.querySelector('.ans'), inss = [...node.querySelectorAll('.ins')];
  const rl = node.querySelector('.rl2'); let L = 0;
  return (lt, a) => { if (rl && !L) L = dash(rl); inUp(q, eo(S(lt, .3, .8)), 16); inUp(ans, eo(S(lt, 1.0, 1.6)), 16); inss.forEach((c, i) => { const p = eo(S(lt, .9 + i * .2, 1.4 + i * .2)); c.style.opacity = p; c.style.transform = `translateX(${(1 - p) * 26}px)`; });
    if (rl) rl.style.strokeDashoffset = (1 - eo(S(lt, 1.6, 2.6))) * L; runCursor([{ t: 0, x: 150, y: NAV_Y('ia') + 120 }, { t: .18, x: 135, y: NAV_Y('ia') }, { t: .28, x: 135, y: NAV_Y('ia'), click: 1 }, { t: 1.2, x: 760, y: 560 }], lt, a); };
});

/* 7 · Cierre */
scene('outro', 26.2, 30.0, `<div class="cover">
  <div class="logo"><div class="bip">BIP<span class="tri"></span></div><div class="tag">Business<br>Impact<br>Platform</div></div>
  <h1 id="o1" style="font-size:64px">Todo tu marketing,<br><span class="hl">conectado al resultado.</span></h1>
  <div id="o2" style="margin-top:44px;background:#9db9de55;border:1px solid #ffffff22;color:#fff;font-family:var(--disp);font-weight:700;font-size:24px;padding:20px 44px;border-radius:14px">Agendá una demo →</div>
</div>`, (node) => {
  const parts = [node.querySelector('.logo'), node.querySelector('#o1'), node.querySelector('#o2')];
  return (lt) => parts.forEach((p, i) => inUp(p, eo(S(lt, .1 + i * .2, .8 + i * .2)), 26));
});

/* ---------- motor seek ---------- */
window.__DURATION = DUR;
window.__seek = function (t) {
  cursorUsed = false;
  for (const s of SCENES) {
    const ai = s.start <= 0 ? 1 : eo(S(t, s.start - LEAD, s.start + .04));
    const ao = s.end >= DUR ? 1 : 1 - eo(S(t, s.end - LEAD, s.end + .04));
    const a = Math.min(ai, ao);
    if (a <= .002) { s.node.style.display = 'none'; continue; }
    s.node.style.display = 'block'; s.node.style.opacity = a;
    s.node.style.transform = `translateY(${(1 - ai) * 16}px) scale(${lerp(.996, 1, ai)})`;
    s.draw(Math.max(0, (t - s.start) / SPEED), a);
  }
  if (!cursorUsed) { cursorEl.style.opacity = 0; ringEl.style.opacity = 0; }
};
window.__seek(0);
window.__ready = true;
