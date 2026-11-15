/* =========================================================================
   Demo 30s — Dashboard de Marketing
   Animación determinística: todo el estado se deriva de window.__seek(t).
   No hay CSS animations ni transitions (el render por frame las rompería).
   ========================================================================= */

/* El timeline se escribe en la escala original del storyboard (30 s) y se estira
   con SPEED. Escalar en un solo lugar mantiene el ritmo relativo de cada escena:
   los sub-tiempos internos (tipeo, cursor, gráficos) siguen en escala original y
   el motor les entrega el tiempo local ya dividido. Para cambiar la duración
   total alcanza con tocar DUR. */
const BASE = 30.0;           // escala en la que están escritos los sub-tiempos
const DUR = 50.0;            // duración final del video, en segundos
const SPEED = DUR / BASE;    // 1 = ritmo original, >1 = más pausado
const LEAD = 0.24 * SPEED;   // solape de cross-fade entre escenas

/* ---------------------------- utilidades ---------------------------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const S  = (t, a, b) => clamp((t - a) / (b - a), 0, 1);      // progreso 0..1
const eo = p => 1 - Math.pow(1 - p, 3);                       // ease-out cúbico
const ei = p => p * p * p;                                    // ease-in
const eio = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const lerp = (a, b, p) => a + (b - a) * p;
const nf = (n, d = 0) => n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
const typed = (str, p) => str.slice(0, Math.round(clamp(p, 0, 1) * str.length));

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function mk(html) {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild;
}
/* opacidad + desplazamiento vertical de entrada, en un solo helper */
function inUp(node, p, dist = 26) {
  node.style.opacity = p;
  node.style.transform = `translateY(${(1 - p) * dist}px)`;
}

/* ---------------------------- iconos ---------------------------- */
const ICON = {
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6l2.6 6.1 6.6.55-5 4.35 1.5 6.45L12 16.7l-5.7 3.35 1.5-6.45-5-4.35 6.6-.55z"/></svg>',
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5.6 8h12.8l-1 11.4a1.6 1.6 0 0 1-1.6 1.45H8.2a1.6 1.6 0 0 1-1.6-1.45z"/><path d="M8.7 8V6.6a3.3 3.3 0 0 1 6.6 0V8"/></svg>',
  bars: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="12" width="4.4" height="9" rx="1.4"/><rect x="9.8" y="7" width="4.4" height="14" rx="1.4"/><rect x="16.6" y="3" width="4.4" height="18" rx="1.4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  plus: '<svg style="width:26px;height:26px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
};

/* ---------------------------- motor de escenas ---------------------------- */
const stage = document.getElementById('stage');
const SCENES = [];
function scene(id, start, end, html, init) {
  const node = mk(`<div class="scene" id="${id}">${html}</div>`);
  stage.appendChild(node);
  // start/end vienen en escala original y se estiran; init/draw trabajan en escala original
  const o = { id, start: start * SPEED, end: end * SPEED, node, dur: (end - start) * SPEED };
  o.draw = init(node, o) || (() => {});
  SCENES.push(o);
  return o;
}

/* ---------------------------- cursor ---------------------------- */
const cursorEl = mk(`<div id="cursor"><svg viewBox="0 0 24 24" width="34" height="34">
  <path d="M5 2.4l13.2 8.1-5.9.9 3.3 6.6-2.6 1.3-3.3-6.6-4.7 3.7z" fill="#fff" stroke="#0F172A" stroke-width="1.5" stroke-linejoin="round"/></svg></div>`);
const ringEl = mk('<div id="ring"></div>');
stage.appendChild(ringEl);
stage.appendChild(cursorEl);
let cursorUsed = false;

/* kfs: [{t, x, y, click?}] — mueve el cursor por keyframes y dibuja el click */
function runCursor(kfs, lt, alpha = 1) {
  cursorUsed = true;
  let x = kfs[0].x, y = kfs[0].y;
  if (lt >= kfs[kfs.length - 1].t) { x = kfs[kfs.length - 1].x; y = kfs[kfs.length - 1].y; }
  else for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i], b = kfs[i + 1];
    if (lt >= a.t && lt < b.t) { const p = eio(S(lt, a.t, b.t)); x = lerp(a.x, b.x, p); y = lerp(a.y, b.y, p); break; }
  }
  let press = 0, ringP = -1, rx = 0, ry = 0;
  for (const k of kfs) {
    if (!k.click) continue;
    if (lt >= k.t - .07 && lt <= k.t + .12) press = 1;
    const p = S(lt, k.t, k.t + .34);
    if (p > 0 && p < 1) { ringP = p; rx = k.x; ry = k.y; }
  }
  cursorEl.style.opacity = alpha;
  cursorEl.style.transform = `translate(${x}px,${y}px) scale(${press ? .84 : 1})`;
  if (ringP >= 0) {
    ringEl.style.opacity = (1 - ringP) * .8 * alpha;
    ringEl.style.transform = `translate(${rx - 39}px,${ry - 39}px) scale(${lerp(.32, 1.15, eo(ringP))})`;
  } else ringEl.style.opacity = 0;
}

/* =========================================================================
   ESCENA 1 · Intro  (0.0 – 2.4)
   ========================================================================= */
scene('s1', 0, 2.4, `
  <div class="dark" style="position:absolute;inset:0"></div>
  <div class="hero-glow"></div>
  <svg id="ribbons" style="position:absolute;right:-60px;top:0;width:1250px;height:1080px" viewBox="0 0 1250 1080" fill="none">
    <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a4da0"/><stop offset=".55" stop-color="#12a6f4"/><stop offset="1" stop-color="#6fd3ff"/>
    </linearGradient></defs>
    <path class="rb" d="M-40 760 C 300 700, 380 300, 700 250 S 1150 300, 1290 150" stroke="url(#rg)" stroke-width="3.2" opacity=".95"/>
    <path class="rb" d="M-40 830 C 320 780, 420 380, 760 330 S 1180 380, 1290 240" stroke="url(#rg)" stroke-width="2.2" opacity=".62"/>
    <path class="rb" d="M-40 900 C 340 860, 470 470, 820 420 S 1200 470, 1290 340" stroke="url(#rg)" stroke-width="1.6" opacity=".38"/>
  </svg>
  <div class="logo on-dark intro-logo" id="s1logo">
    <div class="bip">BIP<span class="tri"></span></div>
    <div class="tag">Business<br>Impact<br>Platform</div>
  </div>
  <div class="hero-copy">
    <div class="eyebrow">Marketing Intelligence</div>
    <h1>De tu estrategia<br><span class="grad">a mejores resultados.</span></h1>
    <p>Simple. Conectado. Inteligente.</p>
  </div>`,
  (node) => {
    const ribs = [...node.querySelectorAll('.rb')];
    ribs.forEach(r => { const L = r.getTotalLength(); r.style.strokeDasharray = L; r.dataset.len = L; });
    const copy = node.querySelector('.hero-copy');
    const logo = node.querySelector('#s1logo');
    const parts = [node.querySelector('.eyebrow'), node.querySelector('h1'), node.querySelector('.hero-copy p')];
    return (lt, alpha) => {
      ribs.forEach((r, i) => {
        const p = eo(S(lt, .05 + i * .12, 1.5 + i * .12));
        r.style.strokeDashoffset = (1 - p) * r.dataset.len;
      });
      inUp(logo, eo(S(lt, .05, .62)), 20);
      parts.forEach((p, i) => inUp(p, eo(S(lt, .34 + i * .17, 1.1 + i * .17)), 30));
      copy.style.transform = `translateY(${lerp(10, 0, eo(S(lt, .2, 1.6)))}px)`;
    };
  });

/* =========================================================================
   ESCENA 2 · Objetivos sugeridos por BIP  (2.4 – 9.4)
   BIP analiza los últimos 24 meses y propone los objetivos; se marcan con un clic
   y la ponderación sugerida se completa sola (suma 100%).
   ========================================================================= */
ICON.ratio = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M5 12h14"/><circle cx="12" cy="6.2" r="1.9" fill="currentColor" stroke="none"/><circle cx="12" cy="17.8" r="1.9" fill="currentColor" stroke="none"/></svg>';
ICON.lead = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.6 20.2c1.2-3.6 4-5.3 7.4-5.3s6.2 1.7 7.4 5.3"/></svg>';
/* serie mensual ilustrativa (estacionalidad + tendencia), determinística */
const SEAS = [.86, .82, .95, .97, 1.02, 1.0, 1.04, 1.03, .98, 1.06, 1.12, 1.25];
const serie = (n, g, k = 0) => Array.from({ length: n }, (_, i) => SEAS[(i + k) % 12] * Math.pow(1 + g, i / 12) * (1 + .03 * Math.sin(i * 1.7 + k)));
function spark(vals, w = 150, h = 42, col = '#0a4da0') {
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - 4 - ((v - mn) / (mx - mn || 1)) * (h - 8)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" style="width:${w}px;height:${h}px;flex:0 0 auto"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
const OBJ = [
  { nm: 'Facturación ($)', ic: ICON.bars, cls: 't-pri', bar: '#0a4da0', peso: 35, med: 'Se mide directo', s: serie(24, .32, 0) },
  { nm: 'Facturación (unid.)', ic: ICON.bag, cls: 't-grn', bar: '#0a7fce', peso: 25, med: 'Se mide directo', s: serie(24, .04, 2) },
  { nm: 'Inversión Mkt ÷ Facturación', ic: ICON.ratio, cls: 't-amb', bar: '#D97706', peso: 20, med: 'Se calcula', s: serie(24, -.05, 5) },
  { nm: 'Costo del lead', ic: ICON.lead, cls: 't-pri', bar: '#12a6f4', peso: 20, med: 'Se calcula', s: serie(24, .18, 8) }
];
const OY = i => 345 + 106 * i;                  // centro y de cada fila
scene('s2', 2.4, 9.4, `
  <div class="lead">
    <div class="step">Paso 1</div>
    <h2>Elegí tus objetivos estratégicos</h2>
    <p>BIP analiza tus últimos 24 meses y te sugiere qué objetivos medir y cuánto pesa cada uno.</p>
  </div>
  <div class="card" id="s2c" style="left:748px;top:212px;width:1040px;padding-bottom:30px">
    <div class="card-h"><h3>Objetivos sugeridos</h3><div class="sub" id="s2sub">0 de 4 elegidos</div></div>
    ${OBJ.map((o, i) => `
    <div class="obj-row" data-i="${i}" style="height:92px;padding:0 22px">
      <div class="ck"></div>
      <div class="tile ${o.cls}">${o.ic}</div>
      <div style="flex:1;min-width:0"><div class="nm" style="font-size:24px">${o.nm}</div>
        <div class="medp"><span class="sug">Sugerido por BIP</span>${o.med}</div></div>
      ${spark(o.s)}
      <div class="peso" style="width:250px"><div class="track"><i style="background:${o.bar}"></i></div><div class="pct">—</div></div>
    </div>`).join('')}
    <div class="foot-bar" id="s2f" style="margin-top:14px"><span style="color:#16A34A;display:flex">${ICON.check}</span> 4 objetivos · ponderación 100% · la ajustás cuando quieras</div>
  </div>`,
  (node) => {
    const card = node.querySelector('#s2c'), sub = node.querySelector('#s2sub'), foot = node.querySelector('#s2f');
    const rows = [...node.querySelectorAll('.obj-row')];
    const CK = [1.05, 1.55, 2.05, 2.55];
    const kfs = [{ t: 0, x: 1180, y: 900 }];
    CK.forEach((t, i) => kfs.push({ t: t - .28, x: 819, y: OY(i) }, { t, x: 819, y: OY(i), click: 1 }));
    kfs.push({ t: 3.4, x: 1500, y: 860 });
    return (lt, alpha) => {
      inUp(card, eo(S(lt, 0, .45)), 30);
      let n = 0;
      rows.forEach((r, i) => {
        inUp(r, eo(S(lt, .2 + i * .12, .55 + i * .12)), 14);
        const on = lt >= CK[i];
        if (on) n++;
        r.classList.toggle('on', on);
        const pp = eo(S(lt, 3.0 + i * .22, 3.5 + i * .22));
        r.querySelector('.track i').style.width = (OBJ[i].peso * pp * 2) + '%';
        r.querySelector('.pct').textContent = pp > 0 ? Math.round(OBJ[i].peso * pp) + '%' : '—';
      });
      sub.textContent = lt >= 4.3 ? 'Ponderación 100%' : `${n} de 4 elegidos`;
      inUp(foot, eo(S(lt, 4.4, 4.8)), 14);
      runCursor(kfs, lt, alpha);
    };
  });

/* =========================================================================
   ESCENA 3 · KPIs sugeridos: correlación + hipótesis + aporte  (9.4 – 14.0)
   ========================================================================= */
const KS = [
  { nm: 'Tráfico web', r: .78, ap: 35, h: 'Más visitas a la tienda, más oportunidades de venta.', s: serie(24, .2, 1) },
  { nm: 'Tasa de conversión', r: .64, ap: 30, h: 'Convertir mejor rinde más que sumar tráfico.', s: serie(24, .08, 4) },
  { nm: 'Inversión en medios', r: .52, ap: 20, h: 'La pauta lleva gente nueva a la tienda.', s: serie(24, .28, 6) },
  { nm: 'Alcance único', r: .41, ap: 15, h: 'Más personas que conocen la marca, más demanda.', s: serie(24, .12, 9) }
];
const KY = i => 212 + 92 + 118 * i + 52;
scene('s3', 9.4, 14.0, `
  <div class="lead">
    <div class="step">Paso 2</div>
    <h2>BIP conecta cada objetivo con sus KPIs</h2>
    <p>Con la correlación de tus datos, la hipótesis de por qué y cuánto aporta cada uno.</p>
  </div>
  <div class="card" id="s3c" style="left:748px;top:212px;width:1040px;padding-bottom:30px">
    <div class="card-h"><h3 style="display:flex;align-items:center;gap:14px"><span class="tile t-pri" style="width:42px;height:42px;border-radius:12px">${ICON.bars}</span>Facturación ($)</h3><div class="sub">KPIs sugeridos</div></div>
    ${KS.map((k, i) => `
    <div class="kr" data-k="${i}">
      <div style="flex:1;min-width:0"><div class="kn">${k.nm}<span class="corr">Correlación <b data-r="${i}">0,00</b></span></div>
        <div class="hy">Hipótesis: ${k.h}</div></div>
      ${spark(k.s, 130, 40, '#12a6f4')}
      <div class="peso" style="width:220px"><div class="lb">Aporte</div><div class="track"><i style="background:#0a4da0"></i></div><div class="pct">0%</div></div>
    </div>`).join('')}
    <div style="display:flex;align-items:center;gap:18px;margin:16px 34px 0">
      <div class="tbox" id="s3t" style="width:auto;padding:0 20px">Aporte total 0%</div>
      <div class="btn btn-p" id="s3b" style="margin-left:auto">Usar esta sugerencia</div>
    </div>
  </div>`,
  (node) => {
    const card = node.querySelector('#s3c'), tot = node.querySelector('#s3t'), btn = node.querySelector('#s3b');
    const rows = [...node.querySelectorAll('.kr')];
    const kfs = [{ t: 0, x: 980, y: 900 }, { t: 2.9, x: 1500, y: 860 }, { t: 3.55, x: 1660, y: 812 }, { t: 3.7, x: 1660, y: 812, click: 1 }];
    return (lt, alpha) => {
      inUp(card, eo(S(lt, 0, .42)), 30);
      let sum = 0;
      rows.forEach((r, i) => {
        inUp(r, eo(S(lt, .25 + i * .2, .65 + i * .2)), 14);
        const pc = eo(S(lt, .45 + i * .2, 1.1 + i * .2));
        r.querySelector('[data-r]').textContent = nf(KS[i].r * pc, 2);
        const pa = eo(S(lt, 1.6 + i * .18, 2.1 + i * .18));
        r.querySelector('.track i').style.width = (KS[i].ap * pa * 2.6) + '%';
        r.querySelector('.pct').textContent = Math.round(KS[i].ap * pa) + '%';
        sum += Math.round(KS[i].ap * pa);
      });
      tot.textContent = 'Aporte total ' + sum + '%';
      tot.className = 'tbox' + (sum === 100 ? ' ok' : '');
      tot.style.width = 'auto'; tot.style.padding = '0 20px';
      const ok = lt >= 3.7;
      btn.innerHTML = ok ? `<span style="display:inline-flex;vertical-align:-4px;width:24px;height:24px">${ICON.check}</span> KPIs conectados` : 'Usar esta sugerencia';
      btn.style.background = ok ? '#16A34A' : '';
      runCursor(kfs, lt, alpha);
    };
  });

/* =========================================================================
   ESCENA 4 · Metas proyectadas: historia 24 meses → proyección → meta  (14.0 – 19.2)
   ========================================================================= */
const HIST = serie(24, .30, 0).map(v => v * 100);                  // últimos 24 meses
const PROY = SEAS.map((s, i) => HIST[12 + i] * 1.24);              // proyección: mismo mes × inflación
const META = PROY.map(v => v * 1.065);                              // meta: +6,5% real
const MESES6 = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
scene('s4', 14.0, 19.2, `
  <div class="top-b" style="top:104px"><div class="step">Paso 3</div><h2>Metas proyectadas, mes a mes</h2></div>
  <div class="card" id="s4a" style="left:132px;top:216px;width:1000px;height:700px">
    <div class="card-h"><div><h3>Facturación ($)</h3><div class="sub" style="margin-top:6px">Últimos 24 meses y próximos 12</div></div></div>
    <svg id="s4svg" viewBox="0 0 930 470" style="width:930px;height:470px;margin:0 35px"></svg>
    <div class="legend" style="margin-top:8px"><span><i style="background:#0a4da0"></i>Real</span><span><i style="background:#12a6f4;height:4px;border-radius:2px"></i>Proyección</span><span><i style="background:#CBD5E1"></i>Meta</span></div>
  </div>
  <div class="card" id="s4b" style="left:1188px;top:216px;width:600px;height:700px">
    <div class="card-h"><h3>¿Cuánto querés crecer?</h3></div>
    <div style="margin:0 34px"><div class="input" id="s4in" style="height:70px"><span id="s4txt"></span><span class="caret" id="s4car"></span></div>
      <div class="mhint" style="margin:16px 0 0;display:block;line-height:1.5" id="s4h">Inflación proyectada <b>24%</b> (INDEC + REM del BCRA) · crecimiento real <b style="color:#15803D">+6,5%</b></div></div>
    <div id="s4g" style="margin-top:14px">
      ${MESES6.map((m, i) => `<div class="mrow" style="height:58px"><div class="mo">${m}</div><div class="mval" data-m="${i}" style="height:44px"></div></div>`).join('')}
    </div>
    <div class="mhint" id="s4k" style="margin:16px 34px 0">Las metas de los KPIs se calculan solas, según su aporte.</div>
  </div>`,
  (node) => {
    const A = node.querySelector('#s4a'), B = node.querySelector('#s4b'), svg = node.querySelector('#s4svg');
    const txt = node.querySelector('#s4txt'), car = node.querySelector('#s4car');
    const vals = [...node.querySelectorAll('[data-m]')];
    const W = 930, H = 430, n = 36, bw = W / n, mx = Math.max(...META) * 1.08;
    const Y = v => H - (v / mx) * (H - 20);
    [0, .5, 1].forEach(f => svg.insertAdjacentHTML('beforeend', `<line x1="0" y1="${Y(mx * f * .9)}" x2="${W}" y2="${Y(mx * f * .9)}" stroke="#EEF1F7" stroke-width="2"/>`));
    svg.insertAdjacentHTML('beforeend', `<line x1="${24 * bw}" y1="10" x2="${24 * bw}" y2="${H}" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="6 6"/>
      <text x="${12 * bw}" y="${H + 30}" font-size="17" fill="#94A3B8" text-anchor="middle" font-weight="600">Últimos 24 meses</text>
      <text x="${30 * bw}" y="${H + 30}" font-size="17" fill="#94A3B8" text-anchor="middle" font-weight="600">Próximos 12</text>`);
    HIST.forEach((v, i) => svg.insertAdjacentHTML('beforeend', `<rect data-h="${i}" x="${i * bw + 3}" width="${bw - 6}" rx="3" fill="#0a4da0"/>`));
    META.forEach((v, i) => svg.insertAdjacentHTML('beforeend', `<rect data-t="${i}" x="${(24 + i) * bw + 3}" width="${bw - 6}" rx="3" fill="#CBD5E1"/>`));
    svg.insertAdjacentHTML('beforeend', `<path id="s4p" fill="none" stroke="#12a6f4" stroke-width="4" stroke-dasharray="10 8" stroke-linecap="round"/>`);
    const hb = [...svg.querySelectorAll('[data-h]')], tb = [...svg.querySelectorAll('[data-t]')], pp = svg.querySelector('#s4p');
    const kfs = [{ t: 0, x: 1100, y: 960 }, { t: 1.7, x: 1420, y: 360 }, { t: 1.8, x: 1420, y: 360, click: 1 }, { t: 3.4, x: 1560, y: 900 }];
    return (lt, alpha) => {
      inUp(A, eo(S(lt, 0, .4)), 26); inUp(B, eo(S(lt, .12, .52)), 26);
      hb.forEach((r, i) => { const p = eo(S(lt, .2 + i * .035, .5 + i * .035)), h = (H - Y(HIST[i])) * p; r.setAttribute('y', H - h); r.setAttribute('height', h); });
      const pl = S(lt, 1.15, 1.75), k = Math.max(1, Math.round(pl * 12));
      pp.setAttribute('d', pl > 0 ? PROY.slice(0, k).map((v, i) => (i ? 'L' : 'M') + ((24 + i + .5) * bw) + ' ' + Y(v)).join('') : '');
      txt.textContent = lt >= 1.85 ? typed('+32%', S(lt, 1.9, 2.3)) : '';
      car.style.opacity = lt > 1.8 && lt < 2.9 ? (Math.floor(lt * 2.2 / SPEED) % 2 ? 0 : 1) : 0;
      node.querySelector('#s4h').style.opacity = eo(S(lt, 2.4, 2.75));
      tb.forEach((r, i) => { const p = eo(S(lt, 2.6 + i * .06, 2.95 + i * .06)), h = (H - Y(META[i])) * p; r.setAttribute('y', H - h); r.setAttribute('height', h); });
      vals.forEach((v, i) => { const p = eo(S(lt, 2.8 + i * .1, 3.05 + i * .1)); v.style.opacity = p; v.textContent = p > .2 ? '$ ' + nf(META[i] * 3.1, 0) + ' M' : ''; });
      node.querySelector('#s4k').style.opacity = eo(S(lt, 3.6, 3.9));
      runCursor(kfs, lt, alpha);
    };
  });

/* =========================================================================
   ESCENA 5 · Mapa activo  (19.2 – 20.3)
   ========================================================================= */
scene('s5', 19.2, 20.3, `
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
    <div class="ok-circle" id="s5r"><span id="s5k" style="color:#0a4da0;display:flex">
      <svg viewBox="0 0 24 24" width="74" height="74" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path id="s5p" d="M20 6L9 17l-5-5"/></svg></span></div>
    <h2 id="s5t" style="margin-top:44px;font-size:64px;font-weight:700;letter-spacing:-.024em">Tu Mapa Estratégico está activo</h2>
    <p id="s5s" style="margin-top:20px;font-size:28px;color:#64748B;font-weight:500">4 objetivos · sus KPIs conectados · metas mes a mes</p>
  </div>`,
  (node) => {
    const ring = node.querySelector('#s5r'), path = node.querySelector('#s5p');
    const L = 26; path.style.strokeDasharray = L;
    return (lt, alpha) => {
      const p = eo(S(lt, .05, .45));
      ring.style.transform = `scale(${lerp(.72, 1, p)})`; ring.style.opacity = p;
      path.style.strokeDashoffset = (1 - eo(S(lt, .30, .68))) * L;
      inUp(node.querySelector('#s5t'), eo(S(lt, .34, .70)), 22);
      inUp(node.querySelector('#s5s'), eo(S(lt, .46, .82)), 18);
    };
  });
/* =========================================================================
   ESCENA 6 · Seguimiento mensual: real vs meta y GAPs  (20.3 – 25.1)
   Convención de color del proyecto: real = azul, meta = gris pizarra,
   verde/amarillo/rojo SOLO como semáforo.
   ========================================================================= */
const M9 = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep'];
const TOM_META = [380, 388, 402, 410, 421, 432, 445, 458, 470];
const TOM_REAL = [372, 376, 391, 396, 409, 418, 428, 436, 442];
const ALC_META = [2.10, 2.20, 2.40, 2.50, 2.60, 2.70, 2.80, 2.85, 2.90];
const ALC_REAL = [1.92, 2.08, 2.22, 2.35, 2.41, 2.52, 2.55, 2.48, 2.60];
const RES = [
  { nm: 'Facturación ($)', ic: ICON.bars, cls: 't-pri', a: '$ 3.512M', b: '$ 3.670M', g: '-4,3%' },
  { nm: 'Facturación (unid.)', ic: ICON.bag, cls: 't-grn', a: '48.200', b: '50.100', g: '-3,8%' },
  { nm: 'Inversión ÷ Fact.', ic: ICON.ratio, cls: 't-amb', a: '4,1%', b: '4,0%', g: '+0,1 pp' },
  { nm: 'Costo del lead', ic: ICON.lead, cls: 't-pri', a: '$ 18.400', b: '$ 17.200', g: '+7,0%' }
];
scene('s6', 20.3, 25.1, `
  <div class="top-b"><h2>Seguimiento mensual</h2><div class="mpill" id="s6m">Ene 2026</div></div>
  <div class="card" id="s6a" style="left:132px;top:196px;width:800px;height:474px">
    <div class="card-h" style="padding-bottom:6px"><h3 style="display:flex;align-items:center;gap:14px"><span class="tile t-pri" style="width:40px;height:40px;border-radius:12px">${ICON.bars}</span>Facturación ($) <span style="font-size:20px;color:#94A3B8;font-weight:500">($ millones)</span></h3></div>
    <div class="kpi-head"><div class="kh"><div class="kl">Meta</div><div class="kv" id="s6am">380</div></div>
      <div class="kh"><div class="kl">Actual</div><div class="kv" id="s6ar" style="color:#0a4da0">372</div></div>
      <div class="gap" id="s6ag">-6,0%</div></div>
    <svg id="s6svg" viewBox="0 0 730 250" style="width:730px;height:250px;margin:6px 35px 0">
      <g id="s6grid"></g>
      <path id="s6meta" fill="none" stroke="#94A3B8" stroke-width="3" stroke-dasharray="8 7" stroke-linecap="round"/>
      <path id="s6real" fill="none" stroke="#0a4da0" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle id="s6dot" r="8" fill="#0a4da0" stroke="#fff" stroke-width="3.5" opacity="0"/>
      <g id="s6lab"></g>
    </svg>
    <div class="legend" style="margin-top:4px"><span><i style="background:#0a4da0"></i>Real</span><span><i style="background:#94A3B8"></i>Meta</span></div>
  </div>
  <div class="card" id="s6b" style="left:988px;top:196px;width:800px;height:474px">
    <div class="card-h" style="padding-bottom:6px"><h3 style="display:flex;align-items:center;gap:14px"><span style="width:14px;height:14px;border-radius:5px;background:#0a4da0;display:inline-block"></span>Tráfico web <span style="font-size:20px;color:#94A3B8;font-weight:500">(visitas)</span></h3></div>
    <div class="kpi-head"><div class="kh"><div class="kl">Meta</div><div class="kv" id="s6bm">2,1M</div></div>
      <div class="kh"><div class="kl">Actual</div><div class="kv" id="s6br" style="color:#0a4da0">1,9M</div></div>
      <div class="gap" id="s6bg">-10%</div></div>
    <svg id="s6svg2" viewBox="0 0 730 250" style="width:730px;height:250px;margin:6px 35px 0">
      <g id="s6grid2"></g><g id="s6bars"></g><g id="s6lab2"></g>
    </svg>
    <div class="legend" style="margin-top:4px"><span><i style="background:#0a4da0"></i>Real</span><span><i style="background:#CBD5E1"></i>Meta</span></div>
  </div>
  ${RES.map((r, i) => `<div class="sum-card" data-s="${i}" style="left:${132 + i * 418}px;top:700px;width:398px">
      <div class="nm"><span class="tile ${r.cls}" style="width:36px;height:36px;border-radius:11px">${r.ic}</span>${r.nm}<span class="gpill">${r.g}</span></div>
      <div class="vals"><span class="a">${r.a}</span><span class="b">/ ${r.b}</span></div></div>`).join('')}
  <div class="card" id="s6e" style="left:180px;top:892px;width:1560px;padding:26px 32px">
    <div style="display:flex;align-items:center;gap:24px">
      <div style="font-size:23px;font-weight:650;width:230px">Estado general</div>
      <div class="track" style="height:14px;flex:1"><i id="s6ef" style="background:linear-gradient(90deg,#16A34A,#4ADE80)"></i></div>
      <div style="font-size:34px;font-weight:750;width:110px;text-align:right" id="s6ep">0%</div>
      <div style="font-size:20px;color:#64748B;font-weight:600;width:230px;text-align:right">En línea con el plan</div>
    </div>
  </div>`,
  (node) => {
    const XS = i => 40 + i * 83.75;
    const YL = v => 230 - (v - 360) / 125 * 196;
    const YB = v => 230 - (v / 3.2) * 196;
    // grillas
    const g1 = node.querySelector('#s6grid'), g2 = node.querySelector('#s6grid2');
    [360, 400, 440, 480].forEach(v => g1.insertAdjacentHTML('beforeend', `<line x1="34" y1="${YL(v)}" x2="710" y2="${YL(v)}" stroke="#EEF1F7" stroke-width="2"/><text x="6" y="${YL(v) + 6}" font-size="15" fill="#94A3B8" font-weight="600">${v}</text>`));
    [0, 1, 2, 3].forEach(v => g2.insertAdjacentHTML('beforeend', `<line x1="34" y1="${YB(v)}" x2="710" y2="${YB(v)}" stroke="#EEF1F7" stroke-width="2"/><text x="6" y="${YB(v) + 6}" font-size="15" fill="#94A3B8" font-weight="600">${v}M</text>`));
    const lab = node.querySelector('#s6lab'), lab2 = node.querySelector('#s6lab2');
    M9.forEach((m, i) => {
      lab.insertAdjacentHTML('beforeend', `<text x="${XS(i)}" y="248" font-size="15" fill="#94A3B8" text-anchor="middle" font-weight="600">${m}</text>`);
      lab2.insertAdjacentHTML('beforeend', `<text x="${XS(i)}" y="248" font-size="15" fill="#94A3B8" text-anchor="middle" font-weight="600">${m}</text>`);
    });
    const bars = node.querySelector('#s6bars');
    M9.forEach((m, i) => bars.insertAdjacentHTML('beforeend',
      `<rect data-m="${i}" x="${XS(i) - 30}" width="26" rx="6" fill="#CBD5E1"/><rect data-r="${i}" x="${XS(i) + 4}" width="26" rx="6" fill="#0a4da0"/>`));
    const bm = [...node.querySelectorAll('[data-m]')], br = [...node.querySelectorAll('[data-r]')];
    const pMeta = node.querySelector('#s6meta'), pReal = node.querySelector('#s6real'), dot = node.querySelector('#s6dot');
    const cards = [...node.querySelectorAll('.sum-card')];
    const A = node.querySelector('#s6a'), B = node.querySelector('#s6b'), E = node.querySelector('#s6e');
    const path = (arr, n) => {
      let d = '', last = Math.min(n, 8.999);
      for (let i = 0; i <= Math.floor(last); i++) d += (i ? 'L' : 'M') + XS(i) + ' ' + YL(arr[i]);
      const f = last - Math.floor(last);
      if (f > 0 && Math.floor(last) < 8) {
        const i = Math.floor(last);
        d += 'L' + lerp(XS(i), XS(i + 1), f) + ' ' + lerp(YL(arr[i]), YL(arr[i + 1]), f);
      }
      return d;
    };
    return (lt, alpha) => {
      inUp(A, eo(S(lt, 0, .40)), 24); inUp(B, eo(S(lt, .10, .50)), 24);
      const vis = clamp(lerp(0, 8, eo(S(lt, .30, 2.45))), 0, 8);
      const mi = Math.min(8, Math.floor(vis + .12));
      node.querySelector('#s6m').textContent = M9[mi] + ' 2026';
      pMeta.setAttribute('d', path(TOM_META, vis));
      pReal.setAttribute('d', path(TOM_REAL, vis));
      const fi = Math.floor(Math.min(vis, 7.999)), ff = vis - fi;
      dot.setAttribute('cx', lerp(XS(fi), XS(fi + 1), ff));
      dot.setAttribute('cy', lerp(YL(TOM_REAL[fi]), YL(TOM_REAL[fi + 1]), ff));
      dot.setAttribute('opacity', eo(S(lt, .35, .6)));
      node.querySelector('#s6am').textContent = nf(lerp(TOM_META[fi], TOM_META[fi + 1], ff));
      node.querySelector('#s6ar').textContent = nf(lerp(TOM_REAL[fi], TOM_REAL[fi + 1], ff));
      node.querySelector('#s6bm').textContent = nf(lerp(ALC_META[fi], ALC_META[fi + 1], ff), 1) + 'M';
      node.querySelector('#s6br').textContent = nf(lerp(ALC_REAL[fi], ALC_REAL[fi + 1], ff), 1) + 'M';
      bm.forEach((r, i) => {
        const p = eo(clamp(vis - i + .55, 0, 1)), h = (230 - YB(ALC_META[i])) * p;
        r.setAttribute('y', 230 - h); r.setAttribute('height', Math.max(0, h));
      });
      br.forEach((r, i) => {
        const p = eo(clamp(vis - i + .35, 0, 1)), h = (230 - YB(ALC_REAL[i])) * p;
        r.setAttribute('y', 230 - h); r.setAttribute('height', Math.max(0, h));
      });
      const gp = eo(S(lt, 2.45, 2.75));
      [node.querySelector('#s6ag'), node.querySelector('#s6bg')].forEach(g => {
        g.style.opacity = gp; g.style.transform = `scale(${lerp(.86, 1, gp)})`;
      });
      cards.forEach((c, i) => inUp(c, eo(S(lt, 2.70 + i * .13, 3.05 + i * .13)), 20));
      inUp(E, eo(S(lt, 3.12, 3.45)), 18);
      const ep = eo(S(lt, 3.30, 4.10));
      node.querySelector('#s6ef').style.width = (67 * ep) + '%';
      node.querySelector('#s6ep').textContent = Math.round(67 * ep) + '%';
    };
  });

/* =========================================================================
   ESCENA 7 · Insights  (25.1 – 26.9)
   ========================================================================= */
const INS = [
  { i: '↑', bg: '#DCFCE7', c: '#16A34A', t: 'El <b>tráfico web</b> es el KPI que más explica tu facturación.' },
  { i: '!', bg: '#FEF3C7', c: '#D97706', t: 'El <b>costo del lead</b> viene <b>7% arriba</b> de su meta.' },
  { i: '◆', bg: '#eaf1fb', c: '#0a4da0', t: '<b>Inversión ÷ Facturación</b> en 4,1%: casi en meta, con margen para invertir.' }
];
scene('s7', 25.1, 26.9, `
  <div class="lead" style="top:330px">
    <div class="step">Paso 4</div>
    <h2>Aprendé y descubrí insights</h2>
    <p>La plataforma identifica patrones y oportunidades en tus datos.</p>
  </div>
  <div style="position:absolute;left:748px;top:300px;width:1040px">
    ${INS.map(x => `<div class="ins"><div class="ic" style="background:${x.bg};color:${x.c}">${x.i}</div><p>${x.t}</p></div>`).join('')}
  </div>`,
  (node) => {
    const cards = [...node.querySelectorAll('.ins')];
    const lead = node.querySelector('.lead');
    return (lt, alpha) => {
      inUp(lead, eo(S(lt, 0, .38)), 22);
      cards.forEach((c, i) => {
        const p = eo(S(lt, .18 + i * .22, .62 + i * .22));
        c.style.opacity = p;
        c.style.transform = `translateX(${(1 - p) * 34}px)`;
      });
    };
  });

/* =========================================================================
   ESCENA 8 · Optimizar inversión + recalibrar el ciclo anual  (26.9 – 28.9)
   ========================================================================= */
const MEDIOS = [
  { nm: 'Meta Ads', from: 38, to: 46, d: '+8' },
  { nm: 'YouTube', from: 22, to: 29, d: '+7' },
  { nm: 'Display', from: 25, to: 10, d: '-15' }
];
scene('s8', 26.9, 28.9, `
  <div class="top-b"><div class="step">Paso 5</div><h2>Optimizá y recalibrá el modelo</h2></div>
  <div class="card" id="s8a" style="left:132px;top:216px;width:800px;padding-bottom:30px">
    <div class="card-h"><h3>Reasignación de inversión</h3><div class="sub">próximo ciclo</div></div>
    ${MEDIOS.map((m, i) => `<div class="opt-row"><div class="nm">${m.nm}</div>
      <div class="track" style="height:14px"><i data-b="${i}" style="background:${m.d[0] === '+' ? '#0a4da0' : '#CBD5E1'}"></i></div>
      <div class="pct" data-p="${i}">0%</div>
      <div class="delta ${m.d[0] === '+' ? 'd-up' : 'd-dn'}" data-d="${i}">${m.d} pts</div></div>`).join('')}
  </div>
  <div class="card" id="s8b" style="left:988px;top:216px;width:800px;height:560px">
    <div class="card-h"><h3>Recalibrá con la evidencia</h3><div class="sub">cierre de ciclo</div></div>
    <div style="position:relative;width:800px;height:376px">
      <svg viewBox="0 0 380 380" style="position:absolute;left:210px;top:0;width:380px;height:380px">
        <circle cx="190" cy="190" r="118" fill="none" stroke="#EEF1F7" stroke-width="15"/>
        <circle id="s8arc" cx="190" cy="190" r="118" fill="none" stroke="#0a4da0" stroke-width="15"
                stroke-linecap="round" transform="rotate(-90 190 190)"/>
      </svg>
      <div class="cyc-mid" style="left:400px;top:190px"><b>4 ciclos</b><span>al año</span></div>
      <div class="ring-lbl" id="c0" style="left:325px;top:22px">Planificar</div>
      <div class="ring-lbl" id="c1" style="left:497px;top:178px">Medir</div>
      <div class="ring-lbl" id="c2" style="left:325px;top:334px">Optimizar</div>
      <div class="ring-lbl" id="c3" style="left:153px;top:178px">Aprender</div>
    </div>
    <div id="s8ok" style="margin:0 34px;padding:20px 24px;border-radius:14px;background:#F6F7FD;
         display:flex;align-items:center;gap:14px;font-size:22px;font-weight:600;color:#334155">
      <span style="color:#16A34A;display:flex">${ICON.check}</span> Conexiones KPI → objetivo actualizadas
    </div>
  </div>`,
  (node) => {
    const A = node.querySelector('#s8a'), B = node.querySelector('#s8b');
    const bars = [...node.querySelectorAll('[data-b]')], pcts = [...node.querySelectorAll('[data-p]')], ds = [...node.querySelectorAll('[data-d]')];
    const arc = node.querySelector('#s8arc');
    const L = 2 * Math.PI * 118; arc.style.strokeDasharray = L;
    const labs = [0, 1, 2, 3].map(i => node.querySelector('#c' + i));
    return (lt, alpha) => {
      inUp(A, eo(S(lt, 0, .36)), 24); inUp(B, eo(S(lt, .08, .44)), 24);
      MEDIOS.forEach((m, i) => {
        const p0 = eo(S(lt, .20 + i * .07, .55 + i * .07));       // valor inicial
        const p1 = eo(S(lt, .70 + i * .10, 1.25 + i * .10));      // reasignación
        const v = lerp(m.from * p0, m.to, p1);
        bars[i].style.width = v + '%';
        pcts[i].textContent = Math.round(v) + '%';
        const dp = eo(S(lt, .95 + i * .10, 1.25 + i * .10));
        ds[i].style.opacity = dp; ds[i].style.transform = `scale(${lerp(.8, 1, dp)})`;
      });
      arc.style.strokeDashoffset = (1 - eo(S(lt, .45, 1.55))) * L;
      labs.forEach((l, i) => { const p = eo(S(lt, .55 + i * .16, .90 + i * .16)); l.style.opacity = p; });
      inUp(node.querySelector('#s8ok'), eo(S(lt, 1.45, 1.80)), 16);
    };
  });

/* =========================================================================
   ESCENA 9 · Cierre  (28.9 – 30.0)
   ========================================================================= */
scene('s9', 28.9, 30.0, `
  <div class="out-wrap"></div>
  <div class="out-copy">
    <h1 id="s9a">Learn what matters.</h1>
    <h1 id="s9b" style="background:linear-gradient(92deg,#0a4da0,#12a6f4 65%,#5bc8fb);-webkit-background-clip:text;background-clip:text;color:transparent">Drive results.</h1>
    <div class="cta" id="s9c">Comenzar ahora →</div>
  </div>
  <div class="out-foot" id="s9f">
    <div class="logo">
      <div class="bip">BIP<span class="tri"></span></div>
      <div class="tag">Business<br>Impact<br>Platform</div>
    </div>
  </div>`,
  (node) => {
    const a = node.querySelector('#s9a'), b = node.querySelector('#s9b'), c = node.querySelector('#s9c'), f = node.querySelector('#s9f');
    return (lt, alpha) => {
      inUp(a, eo(S(lt, .04, .48)), 30);
      inUp(b, eo(S(lt, .16, .60)), 30);
      const p = eo(S(lt, .38, .82));
      c.style.opacity = p; c.style.transform = `translateY(${(1 - p) * 22}px) scale(${lerp(.94, 1, p)})`;
      f.style.opacity = eo(S(lt, .55, .95)) * .9;
    };
  });

/* =========================================================================
   MOTOR — window.__seek(t) deja el DOM en el estado exacto del segundo t
   ========================================================================= */
window.__DURATION = DUR;
window.__seek = function (t) {
  cursorUsed = false;
  for (const s of SCENES) {
    const ai = s.start <= 0 ? 1 : eo(S(t, s.start - LEAD, s.start + .04));
    const ao = s.end >= DUR ? 1 : 1 - eo(S(t, s.end - LEAD, s.end + .04));
    const a = Math.min(ai, ao);
    if (a <= .002) { s.node.style.display = 'none'; continue; }
    s.node.style.display = 'block';
    s.node.style.opacity = a;
    s.node.style.transform = `translateY(${(1 - ai) * 20 - (1 - ao) * 12}px) scale(${lerp(.995, 1, ai)})`;
    s.draw(Math.max(0, (t - s.start) / SPEED), a);
  }
  if (!cursorUsed) { cursorEl.style.opacity = 0; ringEl.style.opacity = 0; }
};
window.__seek(0);
window.__ready = true;
