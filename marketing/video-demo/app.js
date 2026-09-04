/* =========================================================================
   Demo 30s — Dashboard de Marketing
   Animación determinística: todo el estado se deriva de window.__seek(t).
   No hay CSS animations ni transitions (el render por frame las rompería).
   ========================================================================= */

const DUR = 30.0;            // duración total en segundos
const LEAD = 0.24;           // solape de cross-fade entre escenas

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
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
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
  const o = { id, start, end, node, dur: end - start };
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
      <stop offset="0" stop-color="#8B7BFF"/><stop offset=".55" stop-color="#5EC8FF"/><stop offset="1" stop-color="#7DF2DE"/>
    </linearGradient></defs>
    <path class="rb" d="M-40 760 C 300 700, 380 300, 700 250 S 1150 300, 1290 150" stroke="url(#rg)" stroke-width="3.2" opacity=".95"/>
    <path class="rb" d="M-40 830 C 320 780, 420 380, 760 330 S 1180 380, 1290 240" stroke="url(#rg)" stroke-width="2.2" opacity=".62"/>
    <path class="rb" d="M-40 900 C 340 860, 470 470, 820 420 S 1200 470, 1290 340" stroke="url(#rg)" stroke-width="1.6" opacity=".38"/>
  </svg>
  <div class="hero-copy">
    <div class="eyebrow">Marketing Intelligence</div>
    <h1>De tu estrategia<br><span class="grad">a mejores resultados.</span></h1>
    <p>Simple. Conectado. Inteligente.</p>
  </div>`,
  (node) => {
    const ribs = [...node.querySelectorAll('.rb')];
    ribs.forEach(r => { const L = r.getTotalLength(); r.style.strokeDasharray = L; r.dataset.len = L; });
    const copy = node.querySelector('.hero-copy');
    const parts = [node.querySelector('.eyebrow'), node.querySelector('h1'), node.querySelector('.hero-copy p')];
    return (lt, alpha) => {
      ribs.forEach((r, i) => {
        const p = eo(S(lt, .05 + i * .12, 1.5 + i * .12));
        r.style.strokeDashoffset = (1 - p) * r.dataset.len;
      });
      parts.forEach((p, i) => inUp(p, eo(S(lt, .28 + i * .17, 1.05 + i * .17)), 30));
      copy.style.transform = `translateY(${lerp(10, 0, eo(S(lt, .2, 1.6)))}px)`;
    };
  });

/* =========================================================================
   ESCENA 2 · Objetivos estratégicos + pesos  (2.4 – 9.4)
   Cursor real: abre el modal, escribe el nombre, guarda. x3. Luego pesos.
   ========================================================================= */
const OBJ = [
  { nm: 'Top of Mind', ic: ICON.star, cls: 't-pri', bar: '#6C5CE7', peso: 40 },
  { nm: 'Intención de Compra', ic: ICON.bag, cls: 't-grn', bar: '#16A34A', peso: 30 },
  { nm: 'Facturación', ic: ICON.bars, cls: 't-amb', bar: '#D97706', peso: 30 }
];
scene('s2', 2.4, 9.4, `
  <div class="lead">
    <div class="step">Paso 1</div>
    <h2>Definí tus objetivos estratégicos</h2>
    <p>Empezá por lo que querés lograr y cuánto pesa cada objetivo.</p>
  </div>
  <div class="card" id="s2c" style="left:748px;top:212px;width:1040px;padding-bottom:34px">
    <div class="card-h"><h3>Objetivos estratégicos</h3><div class="sub" id="s2sub">0 de 3</div></div>
    <div id="s2list">
      ${OBJ.map((o, i) => `
      <div class="obj-row" data-i="${i}">
        <div class="tile ${o.cls}">${o.ic}</div>
        <div class="nm">${o.nm}</div>
        <div class="peso"><div class="lb">Peso estratégico</div>
          <div class="track"><i style="background:${o.bar}"></i></div>
          <div class="pct">0%</div></div>
      </div>`).join('')}
    </div>
    <div class="addbtn" id="s2add">${ICON.plus} Agregar objetivo</div>
  </div>
  <div class="modal" id="s2m" style="left:920px;top:392px;width:700px">
    <h4>Nuevo objetivo</h4>
    <div class="field"><div class="tile t-pri" id="s2mt">${ICON.star}</div>
      <div class="input"><span id="s2txt"></span><span class="caret" id="s2car"></span></div></div>
    <div class="mbtns"><div class="btn btn-g">Cancelar</div><div class="btn btn-p">Guardar</div></div>
  </div>`,
  (node) => {
    const card = node.querySelector('#s2c'), modal = node.querySelector('#s2m');
    const rows = [...node.querySelectorAll('.obj-row')];
    const txt = node.querySelector('#s2txt'), car = node.querySelector('#s2car'), mt = node.querySelector('#s2mt');
    const sub = node.querySelector('#s2sub'), add = node.querySelector('#s2add');
    // sub-tiempos por objetivo
    const B = i => .55 + i * 1.45;
    const TD = [.55, .78, .55];                        // duración de tipeo
    const beat = i => { const b = B(i); const te = b + .34 + TD[i]; return { open: b + .10, mIn: b + .12, t0: b + .34, t1: b + .34 + TD[i], save: te + .20, row: te + .30 }; };
    const kfs = [{ t: 0, x: 1180, y: 880 }];
    OBJ.forEach((o, i) => {
      const b = beat(i);
      kfs.push({ t: b.open - .30, x: 1180, y: 880 }, { t: b.open, x: 1180, y: 880, click: 1 },
               { t: b.t1 + .06, x: 1420, y: 620 }, { t: b.save, x: 1466, y: 626, click: 1 });
    });
    // arrastre de pesos
    kfs.push({ t: 4.62, x: 1466, y: 626 }, { t: 4.98, x: 1500, y: 396 },
             { t: 5.52, x: 1622, y: 396 }, { t: 5.86, x: 1500, y: 508 },
             { t: 6.16, x: 1592, y: 508 }, { t: 6.42, x: 1500, y: 620 }, { t: 6.72, x: 1592, y: 620 });
    return (lt, alpha) => {
      inUp(card, eo(S(lt, 0, .45)), 30);
      let done = 0;
      OBJ.forEach((o, i) => {
        const b = beat(i);
        const a = eo(S(lt, b.row, b.row + .30));
        rows[i].style.opacity = a;
        rows[i].style.transform = `translateY(${(1 - a) * 14}px) scale(${lerp(.985, 1, a)})`;
        rows[i].style.height = a > 0 ? '' : '0px';
        rows[i].style.margin = a > 0 ? '' : '0 34px';
        rows[i].style.padding = a > 0 ? '' : '0 22px';
        rows[i].style.border = a > 0 ? '' : 'none';
        if (lt >= b.row) done++;
        // pesos
        const ps = [{ a: 5.02, b: 5.54 }, { a: 5.80, b: 6.18 }, { a: 6.30, b: 6.72 }][i];
        const pp = eo(S(lt, ps.a, ps.b));
        rows[i].querySelector('.track i').style.width = (o.peso * pp) + '%';
        rows[i].querySelector('.pct').textContent = Math.round(o.peso * pp) + '%';
        rows[i].querySelector('.peso').style.opacity = eo(S(lt, 4.68, 4.98));
      });
      sub.textContent = lt >= 6.72 ? '100% asignado' : `${done} de 3`;
      add.style.opacity = lerp(1, .35, S(lt, 4.5, 4.8));
      // modal
      let mv = 0, cur = -1;
      OBJ.forEach((o, i) => { const b = beat(i); if (lt >= b.mIn - .02 && lt < b.save + .20) { cur = i; mv = Math.min(eo(S(lt, b.mIn, b.mIn + .18)), 1 - eo(S(lt, b.save, b.save + .18))); } });
      modal.style.opacity = mv;
      modal.style.display = mv > .002 ? 'block' : 'none';
      modal.style.transform = `translateY(${(1 - mv) * 16}px) scale(${lerp(.965, 1, mv)})`;
      if (cur >= 0) {
        const b = beat(cur);
        mt.className = 'tile ' + OBJ[cur].cls; mt.innerHTML = OBJ[cur].ic;
        txt.textContent = typed(OBJ[cur].nm, S(lt, b.t0, b.t1));
        car.style.opacity = (lt > b.t1 + .05) ? (Math.floor(lt * 2.2) % 2 ? 0 : 1) : 1;
      }
      runCursor(kfs, lt, alpha);
    };
  });

/* =========================================================================
   ESCENA 3 · Conectá los KPIs con los objetivos  (9.4 – 14.0)
   Matriz KPI × objetivo: se tipean los primeros aportes y el resto se completa.
   Regla del modelo: la suma de aportes por objetivo cierra en 100%.
   ========================================================================= */
const KPIS = ['Alcance único', 'Frecuencia', 'Impresiones', 'VTR (≥50%)', 'Clicks'];
const MX = [[30, 20, 10], [15, 10, 10], [25, 25, 20], [20, 25, 25], [10, 20, 35]];
const CX = [1238, 1458, 1678];                 // centro x de cada columna
const CY = r => 433 + 74 * r;                  // centro y de cada fila
scene('s3', 9.4, 14.0, `
  <div class="lead">
    <div class="step">Paso 2</div>
    <h2>Conectá tus KPIs con tus objetivos</h2>
    <p>Definí cuánto aporta cada KPI a cada objetivo.</p>
  </div>
  <div class="card" id="s3c" style="left:748px;top:212px;width:1040px">
    <div class="card-h"><h3>Aporte de cada KPI</h3><div class="sub">% sobre el objetivo</div></div>
    <table class="mx">
      <colgroup><col style="width:380px"><col style="width:220px"><col style="width:220px"><col style="width:220px"></colgroup>
      <tr><th class="mx-lbl" style="font-size:18px;color:#94A3B8;letter-spacing:.1em;text-transform:uppercase">KPIs</th>
        ${OBJ.map(o => `<th class="mx-hd"><div class="hchip"><div class="tile ${o.cls}" style="width:44px;height:44px;border-radius:13px">${o.ic}</div><span>${o.nm}</span></div></th>`).join('')}
      </tr>
      ${KPIS.map((k, r) => `<tr><td class="mx-lbl">${k}</td>
        ${MX[r].map((v, c) => `<td class="cell"><div class="cbox" data-r="${r}" data-c="${c}"></div></td>`).join('')}</tr>`).join('')}
      <tr><td class="mx-lbl" style="font-size:18px;color:#94A3B8;letter-spacing:.06em">Total</td>
        ${OBJ.map((o, c) => `<td class="tot"><div class="tbox" data-t="${c}">0%</div></td>`).join('')}</tr>
    </table>
    <div class="foot-bar" id="s3f"><span style="color:#16A34A;display:flex">${ICON.check}</span> 5 KPIs conectados a 3 objetivos · cada objetivo suma 100%</div>
  </div>`,
  (node) => {
    const card = node.querySelector('#s3c'), foot = node.querySelector('#s3f');
    const cells = {}; node.querySelectorAll('.cbox').forEach(b => cells[b.dataset.r + ',' + b.dataset.c] = b);
    const tots = [...node.querySelectorAll('.tbox')];
    // orden de autocompletado (col-major) después de las dos celdas tipeadas
    const auto = [];
    for (let c = 0; c < 3; c++) for (let r = 0; r < 5; r++) if (!(c === 0 && r < 2)) auto.push([r, c]);
    const T = [{ r: 0, c: 0, click: .55, t0: .62, t1: .88 }, { r: 1, c: 0, click: 1.04, t0: 1.10, t1: 1.32 }];
    const kfs = [{ t: 0, x: 980, y: 900 },
      { t: .48, x: CX[0], y: CY(0) }, { t: .55, x: CX[0], y: CY(0), click: 1 },
      { t: .98, x: CX[0], y: CY(1) }, { t: 1.04, x: CX[0], y: CY(1), click: 1 },
      { t: 1.62, x: CX[0], y: CY(4) }, { t: 2.02, x: CX[1], y: CY(1) },
      { t: 2.44, x: CX[2], y: CY(3) }, { t: 2.86, x: CX[1], y: 806 }];
    return (lt, alpha) => {
      inUp(card, eo(S(lt, 0, .42)), 30);
      const shown = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
      T.forEach(t => {
        const b = cells[t.r + ',' + t.c];
        const p = S(lt, t.t0, t.t1);
        b.textContent = lt >= t.click ? typed(String(MX[t.r][t.c]), p) + (p < 1 && lt > t.click ? '|' : '') : '';
        b.className = 'cbox' + (lt >= t.click - .04 && lt < t.t1 + .34 ? ' act' : '');
        if (p >= 1) shown[t.r][t.c] = 1;
      });
      auto.forEach(([r, c], k) => {
        const t0 = 1.48 + k * .095;
        const p = eo(S(lt, t0, t0 + .16));
        const b = cells[r + ',' + c];
        b.textContent = p > .25 ? String(MX[r][c]) : '';
        b.style.opacity = lerp(.55, 1, p);
        b.style.transform = `scale(${lerp(.9, 1, p)})`;
        if (p >= 1) shown[r][c] = 1;
      });
      tots.forEach((tb, c) => {
        let sum = 0; for (let r = 0; r < 5; r++) if (shown[r][c]) sum += MX[r][c];
        const ok = sum === 100;
        tb.textContent = sum + '%';
        tb.className = 'tbox' + (ok ? ' ok' : '');
        tb.style.transform = `scale(${ok ? lerp(1.06, 1, eo(S(lt, 2.7 + c * .16, 2.98 + c * .16))) : 1})`;
      });
      inUp(foot, eo(S(lt, 3.05, 3.4)), 16);
      runCursor(kfs, lt, alpha);
    };
  });

/* =========================================================================
   ESCENA 4 · Metas mensuales con unidades reales  (14.0 – 19.2)
   ========================================================================= */
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
const METAS_TOM = [28.0, 28.4, 28.8, 29.2, 29.6, 30.0];
const METAS_ALC = [2100000, 2200000, 2400000, 2500000, 2600000, 2700000];
scene('s4', 14.0, 19.2, `
  <div class="top-b" style="top:104px"><div class="step">Paso 3</div><h2>Definí las metas mensuales</h2></div>
  <div class="card" id="s4a" style="left:200px;top:216px;width:720px;padding-bottom:6px">
    <div class="card-h"><div><h3>Top of Mind</h3><div class="sub" style="margin-top:6px">Meta del objetivo</div></div><div class="unit">%</div></div>
    ${MESES.map((m, i) => `<div class="mrow"><div class="mo">${m}</div><div class="mval" data-a="${i}"></div></div>`).join('')}
    <div class="mhint" id="s4h1">Unidad: porcentaje de menciones espontáneas</div>
  </div>
  <div class="card" id="s4b" style="left:1000px;top:216px;width:720px;padding-bottom:6px">
    <div class="card-h"><div><h3>Alcance único</h3><div class="sub" style="margin-top:6px">Meta del KPI</div></div><div class="unit">personas</div></div>
    ${MESES.map((m, i) => `<div class="mrow"><div class="mo">${m}</div><div class="mval" data-b="${i}"></div></div>`).join('')}
    <div class="mhint" id="s4h2">Unidad: personas alcanzadas en el mes</div>
  </div>
  <div class="card" id="s4c" style="left:660px;top:880px;width:600px;padding:26px 30px;display:flex;align-items:center;gap:18px">
    <div class="tile t-amb">${ICON.bars}</div>
    <div style="flex:1"><div style="font-size:19px;color:#64748B;font-weight:600">Facturación · meta Jun</div>
    <div style="font-size:31px;font-weight:700;letter-spacing:-.01em">$ 120.000.000</div></div>
    <div class="unit">ARS</div>
  </div>`,
  (node) => {
    const A = node.querySelector('#s4a'), B = node.querySelector('#s4b'), C = node.querySelector('#s4c');
    const va = [...node.querySelectorAll('[data-a]')], vb = [...node.querySelectorAll('[data-b]')];
    const YA = i => 337 + 66 * i;
    const kfs = [{ t: 0, x: 700, y: 940 },
      { t: .55, x: 800, y: YA(2) }, { t: .62, x: 800, y: YA(2), click: 1 },
      { t: 1.32, x: 812, y: YA(4) },
      { t: 2.16, x: 1600, y: YA(2) }, { t: 2.25, x: 1600, y: YA(2), click: 1 },
      { t: 3.30, x: 1612, y: YA(4) }, { t: 3.95, x: 1470, y: 1010 }];
    return (lt, alpha) => {
      inUp(A, eo(S(lt, 0, .40)), 26); inUp(B, eo(S(lt, .12, .52)), 26);
      // panel A — se tipea Mar, el resto se completa
      va.forEach((v, i) => {
        if (i === 2) {
          const p = S(lt, .68, 1.10), act = lt >= .58 && lt < 1.46;
          v.className = 'mval' + (act ? ' act' : '');
          v.textContent = lt >= .62 ? typed('28,8', p) + (p < 1 ? '|' : '') : '';
        } else {
          const k = i > 2 ? i - 1 : i, t0 = 1.24 + k * .11, p = eo(S(lt, t0, t0 + .18));
          v.className = 'mval'; v.style.opacity = p;
          v.textContent = p > .2 ? nf(METAS_TOM[i], 1) : '';
        }
      });
      // panel B — se tipea el número crudo y al confirmar se formatea
      vb.forEach((v, i) => {
        if (i === 2) {
          const p = S(lt, 2.30, 2.94), act = lt >= 2.20 && lt < 3.20;
          v.className = 'mval' + (act ? ' act' : '');
          if (lt < 2.25) v.textContent = '';
          else if (lt < 3.02) v.textContent = typed('2400000', p) + (p < 1 ? '|' : '');
          else v.textContent = nf(2400000);
        } else {
          const k = i > 2 ? i - 1 : i, t0 = 3.14 + k * .11, p = eo(S(lt, t0, t0 + .18));
          v.className = 'mval'; v.style.opacity = p;
          v.textContent = p > .2 ? nf(METAS_ALC[i]) : '';
        }
      });
      node.querySelector('#s4h1').style.opacity = eo(S(lt, 1.9, 2.2)) * .95;
      node.querySelector('#s4h2').style.opacity = eo(S(lt, 3.7, 4.0)) * .95;
      const cp = eo(S(lt, 4.05, 4.42));
      C.style.opacity = cp; C.style.transform = `translateY(${(1 - cp) * 22}px)`;
      runCursor(kfs, lt, alpha);
    };
  });

/* =========================================================================
   ESCENA 5 · Modelo listo  (19.2 – 20.3)
   ========================================================================= */
scene('s5', 19.2, 20.3, `
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
    <div class="ok-circle" id="s5r"><span id="s5k" style="color:#6C5CE7;display:flex">
      <svg viewBox="0 0 24 24" width="74" height="74" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path id="s5p" d="M20 6L9 17l-5-5"/></svg></span></div>
    <h2 id="s5t" style="margin-top:44px;font-size:64px;font-weight:700;letter-spacing:-.024em">Tu modelo está listo</h2>
    <p id="s5s" style="margin-top:20px;font-size:28px;color:#64748B;font-weight:500">3 objetivos · 5 KPIs · 12 meses de metas</p>
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
const TOM_META = [28.0, 28.4, 28.8, 29.2, 29.6, 30.0, 30.4, 30.9, 31.4];
const TOM_REAL = [27.4, 27.7, 28.1, 28.0, 28.6, 28.9, 29.1, 29.4, 29.6];
const ALC_META = [2.10, 2.20, 2.40, 2.50, 2.60, 2.70, 2.80, 2.85, 2.90];
const ALC_REAL = [1.92, 2.08, 2.22, 2.35, 2.41, 2.52, 2.55, 2.48, 2.60];
const RES = [
  { nm: 'Top of Mind', ic: ICON.star, cls: 't-pri', a: '29,6', b: '31,4', g: '-5,8%' },
  { nm: 'Intención de Compra', ic: ICON.bag, cls: 't-grn', a: '15,2', b: '18,0', g: '-15,6%' },
  { nm: 'Facturación', ic: ICON.bars, cls: 't-amb', a: '$98M', b: '$120M', g: '-18,3%' }
];
scene('s6', 20.3, 25.1, `
  <div class="top-b"><h2>Seguimiento mensual</h2><div class="mpill" id="s6m">Ene 2026</div></div>
  <div class="card" id="s6a" style="left:132px;top:196px;width:800px;height:474px">
    <div class="card-h" style="padding-bottom:6px"><h3 style="display:flex;align-items:center;gap:14px"><span class="tile t-pri" style="width:40px;height:40px;border-radius:12px">${ICON.star}</span>Top of Mind</h3></div>
    <div class="kpi-head"><div class="kh"><div class="kl">Meta</div><div class="kv" id="s6am">28,0</div></div>
      <div class="kh"><div class="kl">Actual</div><div class="kv" id="s6ar" style="color:#1E40AF">27,4</div></div>
      <div class="gap" id="s6ag">-5,8%</div></div>
    <svg id="s6svg" viewBox="0 0 730 250" style="width:730px;height:250px;margin:6px 35px 0">
      <g id="s6grid"></g>
      <path id="s6meta" fill="none" stroke="#94A3B8" stroke-width="3" stroke-dasharray="8 7" stroke-linecap="round"/>
      <path id="s6real" fill="none" stroke="#1E40AF" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle id="s6dot" r="8" fill="#1E40AF" stroke="#fff" stroke-width="3.5" opacity="0"/>
      <g id="s6lab"></g>
    </svg>
    <div class="legend" style="margin-top:4px"><span><i style="background:#1E40AF"></i>Real</span><span><i style="background:#94A3B8"></i>Meta</span></div>
  </div>
  <div class="card" id="s6b" style="left:988px;top:196px;width:800px;height:474px">
    <div class="card-h" style="padding-bottom:6px"><h3 style="display:flex;align-items:center;gap:14px"><span style="width:14px;height:14px;border-radius:5px;background:#1E40AF;display:inline-block"></span>Alcance único <span style="font-size:20px;color:#94A3B8;font-weight:500">(personas)</span></h3></div>
    <div class="kpi-head"><div class="kh"><div class="kl">Meta</div><div class="kv" id="s6bm">2,1M</div></div>
      <div class="kh"><div class="kl">Actual</div><div class="kv" id="s6br" style="color:#1E40AF">1,9M</div></div>
      <div class="gap" id="s6bg">-10%</div></div>
    <svg id="s6svg2" viewBox="0 0 730 250" style="width:730px;height:250px;margin:6px 35px 0">
      <g id="s6grid2"></g><g id="s6bars"></g><g id="s6lab2"></g>
    </svg>
    <div class="legend" style="margin-top:4px"><span><i style="background:#1E40AF"></i>Real</span><span><i style="background:#CBD5E1"></i>Meta</span></div>
  </div>
  ${RES.map((r, i) => `<div class="sum-card" data-s="${i}" style="left:${180 + i * 530}px;top:700px;width:500px">
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
    const YL = v => 230 - (v - 26) / 6.5 * 196;
    const YB = v => 230 - (v / 3.2) * 196;
    // grillas
    const g1 = node.querySelector('#s6grid'), g2 = node.querySelector('#s6grid2');
    [26, 28, 30, 32].forEach(v => g1.insertAdjacentHTML('beforeend', `<line x1="34" y1="${YL(v)}" x2="710" y2="${YL(v)}" stroke="#EEF1F7" stroke-width="2"/><text x="6" y="${YL(v) + 6}" font-size="15" fill="#94A3B8" font-weight="600">${v}</text>`));
    [0, 1, 2, 3].forEach(v => g2.insertAdjacentHTML('beforeend', `<line x1="34" y1="${YB(v)}" x2="710" y2="${YB(v)}" stroke="#EEF1F7" stroke-width="2"/><text x="6" y="${YB(v) + 6}" font-size="15" fill="#94A3B8" font-weight="600">${v}M</text>`));
    const lab = node.querySelector('#s6lab'), lab2 = node.querySelector('#s6lab2');
    M9.forEach((m, i) => {
      lab.insertAdjacentHTML('beforeend', `<text x="${XS(i)}" y="248" font-size="15" fill="#94A3B8" text-anchor="middle" font-weight="600">${m}</text>`);
      lab2.insertAdjacentHTML('beforeend', `<text x="${XS(i)}" y="248" font-size="15" fill="#94A3B8" text-anchor="middle" font-weight="600">${m}</text>`);
    });
    const bars = node.querySelector('#s6bars');
    M9.forEach((m, i) => bars.insertAdjacentHTML('beforeend',
      `<rect data-m="${i}" x="${XS(i) - 30}" width="26" rx="6" fill="#CBD5E1"/><rect data-r="${i}" x="${XS(i) + 4}" width="26" rx="6" fill="#1E40AF"/>`));
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
      node.querySelector('#s6am').textContent = nf(lerp(TOM_META[fi], TOM_META[fi + 1], ff), 1);
      node.querySelector('#s6ar').textContent = nf(lerp(TOM_REAL[fi], TOM_REAL[fi + 1], ff), 1);
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
  { i: '↑', bg: '#DCFCE7', c: '#16A34A', t: 'El <b>VTR</b> es el KPI de mayor correlación con Top of Mind.' },
  { i: '!', bg: '#FEF3C7', c: '#D97706', t: 'Top of Mind viene <b>5,8% debajo</b> de su meta anual.' },
  { i: '◆', bg: '#EDE9FF', c: '#6C5CE7', t: 'Social Media es el mayor driver de <b>Intención de Compra</b>.' }
];
scene('s7', 25.1, 26.9, `
  <div class="lead" style="top:330px">
    <div class="step">Paso 5</div>
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
  <div class="top-b"><div class="step">Paso 6</div><h2>Optimizá y recalibrá el modelo</h2></div>
  <div class="card" id="s8a" style="left:132px;top:216px;width:800px;padding-bottom:30px">
    <div class="card-h"><h3>Reasignación de inversión</h3><div class="sub">próximo ciclo</div></div>
    ${MEDIOS.map((m, i) => `<div class="opt-row"><div class="nm">${m.nm}</div>
      <div class="track" style="height:14px"><i data-b="${i}" style="background:${m.d[0] === '+' ? '#1E40AF' : '#CBD5E1'}"></i></div>
      <div class="pct" data-p="${i}">0%</div>
      <div class="delta ${m.d[0] === '+' ? 'd-up' : 'd-dn'}" data-d="${i}">${m.d} pts</div></div>`).join('')}
  </div>
  <div class="card" id="s8b" style="left:988px;top:216px;width:800px;height:560px">
    <div class="card-h"><h3>Recalibrá con la evidencia</h3><div class="sub">cierre de ciclo</div></div>
    <div style="position:relative;width:800px;height:376px">
      <svg viewBox="0 0 380 380" style="position:absolute;left:210px;top:0;width:380px;height:380px">
        <circle cx="190" cy="190" r="118" fill="none" stroke="#EEF1F7" stroke-width="15"/>
        <circle id="s8arc" cx="190" cy="190" r="118" fill="none" stroke="#6C5CE7" stroke-width="15"
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
    <h1 id="s9b" style="background:linear-gradient(92deg,#6C5CE7,#3B82F6 70%,#0EA5E9);-webkit-background-clip:text;background-clip:text;color:transparent">Drive results.</h1>
    <div class="cta" id="s9c">Comenzar ahora →</div>
  </div>
  <div class="out-foot" id="s9f">Dashboard de Marketing</div>`,
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
    s.draw(Math.max(0, t - s.start), a);
  }
  if (!cursorUsed) { cursorEl.style.opacity = 0; ringEl.style.opacity = 0; }
};
window.__seek(0);
window.__ready = true;
