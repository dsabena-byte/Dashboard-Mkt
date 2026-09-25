/* =========================================================================
   Video "Definí tus objetivos en BIP" — Mapa Estratégico: plantilla → pesos de objetivos →
   KPIs que explican cada objetivo → metas mensuales → seguimiento. Réplica de
   components/mapa/mapa-editor.tsx + mapa-plantilla.tsx + components/web/meta-panel.tsx (BIP).
   ========================================================================= */
const DUR = 35.5;
const BASE = DUR;
const SPEED = DUR / BASE;    // 1: los tiempos de este archivo son segundos reales
const LEAD = 0.34;           // solape del cross-fade entre escenas
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


/* ---------------------------- helpers de este video ---------------------------- */
const CK = ICON.check;
const lead = (step, h2, p) => `<div class="lead" style="top:250px"><div class="step">${step}</div><h2>${h2}</h2><p>${p}</p></div>`;
const A = (top, extra = '') => `position:absolute;left:38px;right:38px;top:${top}px;${extra}`;
const CX = 720, CY = 150;                        // origen de la tarjeta (.pp-card)
function leadIn(node, lt) {
  const l = node.querySelector('.lead');
  [...l.children].forEach((c, i) => inUp(c, eo(S(lt, .1 + i * .18, .8 + i * .18)), 26));
}

/* Escena "flujo": una secuencia de pantallas con cursor que toca el botón de cada una. */
function flowScene(id, start, end, leadH, screens, wrap = '') {
  const html = `${leadH}<div class="popwrap" style="${wrap}">${screens.map(sc => `<div class="scr">${sc.html}</div>`).join('')}${wrap ? '' : '<div class="cap"><span></span></div>'}</div>`;
  return scene(id, start, end, html, (node) => {
    const scrs = [...node.querySelectorAll('.scr')], capw = node.querySelector('.cap'), cap = capw && capw.querySelector('span');
    const pos = [];
    const at = (el) => { const r = el.getBoundingClientRect(), st = stage.getBoundingClientRect(); return { x: r.left - st.left + r.width / 2, y: r.top - st.top + r.height / 2 }; };
    return (lt, a) => {
      leadIn(node, lt);
      let cur = screens.findIndex(sc => lt >= sc.t0 && lt < sc.t1);
      if (cur < 0) cur = lt < screens[0].t0 ? 0 : screens.length - 1;
      scrs.forEach((el, k) => { el.style.display = k === cur ? 'block' : 'none'; });
      const sc = screens[cur];
      const p = cur === 0 ? eo(S(lt, .15, .6)) : eo(S(lt, sc.t0, sc.t0 + .3));
      scrs[cur].style.opacity = p; scrs[cur].style.transform = `translateY(${(1 - p) * 14}px)`;
      if (cap) { cap.textContent = sc.cap || ''; capw.style.opacity = sc.cap ? eo(S(lt, sc.t0 + .2, sc.t0 + .6)) : 0; }
      if (sc.click) {
        const btn = scrs[cur].querySelector(sc.click);
        if (!pos[cur] && lt > sc.t0 + .45) pos[cur] = at(btn);
        const q = pos[cur], prev = pos[cur - 1] || (q ? { x: q.x + 180, y: q.y + 150 } : null);
        if (q) runCursor([{ t: sc.t0 + .45, x: prev.x, y: prev.y }, { t: sc.at, x: q.x, y: q.y, click: 1 }, { t: sc.t1, x: q.x, y: q.y }], lt, a);
        btn.style.filter = lt > sc.at - .04 && lt < sc.at + .22 ? 'brightness(1.15)' : 'none';
      }
    };
  });
}

/* Tarjeta de /empezar paso 4 (réplica): lista de pasos + contenido del paso actual */
const PASOS = ['Conectar Facebook', 'Elegir tu Facebook e Instagram', 'Elegir cuenta de Meta Ads', 'Conectar Google', 'Elegir tu sitio (GA4)', 'Elegir cuenta de Google Ads'];
const connectCard = (cur, h, p, body) => `<div class="pp-card" style="height:640px">
  <div style="position:absolute;left:38px;top:44px;width:330px">${PASOS.map((x, k) => `<div class="seq ${k < cur ? 'done' : k === cur ? 'cur' : ''}" style="font-size:20px;padding:13px 2px"><i>${k < cur ? CK : k + 1}</i>${x}</div>`).join('')}</div>
  <div style="position:absolute;left:410px;right:38px;top:44px;border-left:1px solid var(--line);padding-left:36px">
    <div style="font-size:18px;color:var(--muted);font-weight:600">Redes Sociales · Publicidad · Web / Ecommerce</div>
    <h3 style="margin-top:18px;font-size:34px">${h}</h3>
    <p style="margin-top:14px;font-size:21px;line-height:1.5;color:#334155">${p}</p>
    ${body}
    <div style="margin-top:22px;font-size:19px;color:var(--pri);font-weight:600">▸ ¿No tenés acceso? Te decimos cómo pedirlo</div>
    <div style="margin-top:14px;font-size:19px;color:var(--muted);font-weight:600">Lo hago después</div>
  </div></div>`;
const pick = (val, btn) => `<div style="display:flex;gap:14px;margin-top:24px"><div class="sel">${val}<span style="margin-left:auto">▾</span></div><div class="go" style="height:58px;padding:0 26px;border-radius:12px;background:var(--pri);color:#fff;display:flex;align-items:center;font-size:21px;font-weight:700">${btn}</div></div>`;
const primary = (label) => `<div class="go" style="margin-top:26px;display:inline-flex;height:66px;padding:0 34px;border-radius:13px;background:var(--pri);color:#fff;align-items:center;font-size:23px;font-weight:700;box-shadow:0 10px 24px rgba(10,77,160,.28)">${label}</div>`;
const FULL = 'left:0;top:0;width:1920px;height:1080px';
/* =========================================================================
   Objetivos — helpers propios
   ========================================================================= */
const OBJ = [['Notoriedad', '#7c3aed', 50, 'Alcance único · Impresiones · Alcance orgánico'], ['Consideración', '#2563eb', 30, 'Clicks · VTR (≥50%) · Engagement rate'], ['Conversión', '#16a34a', 20, 'Tráfico web · Tasa de conversión · Ingresos']];
const slider = (id, color, v) => `<div class="sl" id="${id}" style="position:relative;height:10px;border-radius:999px;background:#e2e8f0;flex:1"><i style="position:absolute;left:0;top:0;bottom:0;width:${v}%;border-radius:999px;background:${color}"></i><b style="position:absolute;top:50%;left:${v}%;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;background:#fff;border:3px solid ${color};box-shadow:0 2px 6px rgba(0,0,0,.15)"></b></div>`;
function setSl(el, v) { el.querySelector('i').style.width = v + '%'; el.querySelector('b').style.left = v + '%'; }
const card = (top, h, inner) => `<div class="pp-card" style="top:${top}px;${h ? `height:${h}px;` : ''}">${inner}</div>`;
const H = (n, t, sub) => `<div style="font-size:17px;color:var(--muted);font-weight:600">Mapa Estratégico</div><h3 style="margin-top:8px">${n} · ${t}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}`;

/* 1 · Intro (0 – 2.5) */
scene('s1', 0, 2.5, `
  <div class="dark" style="position:absolute;inset:0"></div>
  <div class="hero-glow"></div>
  <div class="logo on-dark intro-logo"><div class="bip">BIP<span class="tri"></span></div><div class="tag">Business<br>Impact<br>Platform</div></div>
  <div class="hero-copy">
    <div class="eyebrow">Tu Mapa Estratégico</div>
    <h1>Armá tu Mapa Estratégico<br><span class="grad">en BIP. Bien simple.</span></h1>
    <p>Tus objetivos, los KPIs que los explican y cuánto pesa cada uno.</p>
  </div>`,
  (node) => {
    const logo = node.querySelector('.logo');
    const parts = [node.querySelector('.eyebrow'), node.querySelector('h1'), node.querySelector('.hero-copy p')];
    return (lt) => { inUp(logo, eo(S(lt, 0, .4)), 20); parts.forEach((p, i) => inUp(p, eo(S(lt, .15 + i * .15, .7 + i * .15)), 30)); };
  });

/* 2 · Plantilla (2.5 – 6.5) */
flowScene('s2', 2.5, 6.5, lead('Paso 1', 'Empezá con<br>una plantilla', 'BIP te sugiere objetivos, KPIs y pesos para tu sector. Un clic y tenés tu mapa.'), [
  { t0: 0, t1: 4, at: 2.4, click: '.go', html: card(150, 0, `
    <div style="font-size:15px;letter-spacing:.08em;color:var(--pri);font-weight:700">PLANTILLA SUGERIDA · BELLEZA Y CUIDADO PERSONAL</div>
    <h3 style="margin-top:8px">Marca de consumo masivo</h3>
    ${OBJ.map(o => `<div style="margin-top:14px;border:1.5px solid var(--line);border-radius:14px;padding:16px 20px;display:flex;gap:14px;align-items:flex-start"><span style="width:16px;height:16px;border-radius:4px;background:${o[1]};margin-top:5px"></span><div style="flex:1"><b style="font-size:21px">${o[0]}</b><div style="font-size:17px;color:var(--muted);margin-top:4px">Se mide con: ${o[3]}</div></div><span style="font-size:17px;color:var(--muted)">${o[2]}% del total</span></div>`).join('')}
    <div style="display:flex;gap:22px;align-items:center;margin-top:22px"><div class="go" style="height:60px;padding:0 28px;border-radius:12px;background:var(--pri);color:#fff;display:flex;align-items:center;font-size:21px;font-weight:700">Usar esta plantilla</div><span style="font-size:19px;color:#334155;font-weight:600">Prefiero armarlo de cero</span></div>`) },
], FULL);

/* 3 · Pesos + agregar objetivo (6.5 – 15) */
const OB4 = [...OBJ.map(o => [o[0], o[1]]), ['Preferencia de marca', '#ea580c']];
scene('s3', 6.5, 15, `
  ${lead('Paso 2', 'Tus objetivos<br>y su peso', 'Movés la barra según lo que más importa. ¿Te falta uno? “+ Agregar objetivo”, le ponés nombre y peso. Siempre suma 100%.')}
  ${card(190, 0, `${H(1, 'Objetivos estratégicos', 'El peso refleja la importancia relativa; siempre suma 100%.')}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:20px">${OB4.map((o, i) => `<div class="oc" style="border:1.5px solid var(--line);border-radius:14px;padding:14px"><div style="display:flex;gap:8px;align-items:center"><span style="width:14px;height:14px;border-radius:4px;background:${o[1]}"></span><div class="fin on${i}" style="flex:1;height:44px;font-size:16px;padding:0 10px;white-space:nowrap;overflow:hidden">${i < 3 ? o[0] : ''}</div></div><div style="display:flex;gap:10px;align-items:center;margin-top:14px">${slider('w' + i, o[1], 0)}<b class="pv" style="width:46px;text-align:right;font-size:19px;font-variant-numeric:tabular-nums">0%</b></div></div>`).join('')}</div>
    <div class="addo" style="margin-top:16px;display:inline-block;font-size:19px;color:var(--pri);font-weight:700;padding:8px 4px">+ Agregar objetivo</div>`)}`,
  (node) => {
    const c = node.querySelector('.pp-card'), sls = [...node.querySelectorAll('.sl')], pvs = [...node.querySelectorAll('.pv')], ocs = [...node.querySelectorAll('.oc')], add = node.querySelector('.addo'), nm = node.querySelector('.on3');
    let P = null;
    const at = (el) => { const r = el.getBoundingClientRect(), st = stage.getBoundingClientRect(); return { x: r.left - st.left, y: r.top - st.top, w: r.width, h: r.height }; };
    return (lt, a) => {
      leadIn(node, lt); inUp(c, eo(S(lt, 0, .4)), 30);
      // 1) arrastra Notoriedad 50→40 (Conversión balancea 20→30)
      const p1 = eio(S(lt, 1.0, 2.0));
      // 2) + Agregar objetivo → aparece "Preferencia de marca", se escribe el nombre y se lleva a 20 (Notoriedad 40→30… reparto final 30/30/20/20)
      const show = lt > 3.1;
      ocs[3].style.opacity = show ? eo(S(lt, 3.1, 3.4)) : 0;
      nm.textContent = typed('Preferencia de marca', S(lt, 3.6, 4.8));
      nm.classList.toggle('act', lt > 3.5 && lt < 5);
      const p2 = eio(S(lt, 5.4, 6.6));
      let v = [Math.round(lerp(50, 40, p1)), 30, 0, 0]; v[2] = 100 - v[0] - v[1];
      if (show) { const n = Math.round(lerp(0, 20, p2)); v = [40 - Math.round(n / 2), 30, 30 - (n - Math.round(n / 2)), n]; }
      v.forEach((x, i) => { setSl(sls[i], x); pvs[i].textContent = x + '%'; });
      if (!P) P = { s0: at(sls[0]), add: at(add), nm: at(nm), s3: at(sls[3]) };
      const k0 = P.s0.x + P.s0.w * .5, ky = P.s0.y + P.s0.h / 2;
      runCursor([{ t: .3, x: 1500, y: 850 }, { t: .9, x: k0, y: ky, click: 1 }, { t: 2.0, x: P.s0.x + P.s0.w * .4, y: ky },
        { t: 2.8, x: P.add.x + P.add.w / 2, y: P.add.y + P.add.h / 2, click: 1 }, { t: 3.4, x: P.nm.x + P.nm.w / 2, y: P.nm.y + P.nm.h / 2, click: 1 },
        { t: 5.2, x: P.s3.x, y: P.s3.y + P.s3.h / 2, click: 1 }, { t: 6.6, x: P.s3.x + P.s3.w * .2, y: P.s3.y + P.s3.h / 2 }, { t: 8.5, x: P.s3.x + P.s3.w * .2 + 40, y: P.s3.y + 90 }], lt, a);
    };
  });

/* 4 · Agregar plan + KPIs y vincularlos (15 – 27) */
const OW4 = [['Notoriedad', '#7c3aed'], ['Consideración', '#2563eb'], ['Conversión', '#16a34a'], ['Preferencia', '#ea580c']];
const K4 = [
  ['Plan de Medios', [['Alcance único', [40, 0, 0, 0]], ['Impresiones', [30, 0, 0, 0]], ['Clicks', [0, 40, 0, 0]], ['VTR (≥50%)', [0, 30, 0, 0]]]],
  ['Redes Sociales', [['Alcance orgánico', [30, 0, 0, 0]], ['Engagement rate', [0, 30, 0, 0]]]],
  ['Web / Ecommerce', [['Tráfico web', [0, 0, 40, 0]], ['Tasa de conversión', [0, 0, 60, 0]]]],
];
const PLANS = ['Mercado y competencia'];
const KNEW = ['Share of Search', 'Share of engagement', 'Visibilidad en IA', 'Índice de posición SEO'];
const cellsRow = (vs) => vs.map((v, j) => `<td style="padding:5px 6px"><div style="display:flex;gap:6px;align-items:center">${slider('', OW4[j][1], v)}<span class="kv" style="width:28px;text-align:right;font-size:14px;font-variant-numeric:tabular-nums;color:${v ? 'var(--ink)' : 'var(--faint)'}">${v}</span></div></td>`).join('');
scene('s4', 15, 27, `
  ${lead('Paso 3', 'Qué KPIs<br>explican cada objetivo', 'Primero sumás el plan (el tablero donde está el dato) y después elegís sus KPIs. Le das a cada uno su peso en el objetivo.')}
  ${card(60, 0, `${H(2, 'Qué KPIs explican cada objetivo', 'Por objetivo, la suma llega a 100%.')}
    <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:15.5px">
      <tr><th style="text-align:left;padding:4px 6px;font-size:13px;color:var(--muted)">KPI</th>${OW4.map((o, j) => `<th style="padding:4px 6px;width:170px"><div style="display:flex;gap:5px;align-items:center;justify-content:center;font-size:14px"><span style="width:10px;height:10px;border-radius:3px;background:${o[1]}"></span>${o[0]}</div><div class="hd" style="font-size:12px;color:var(--faint);font-weight:600">${j < 3 ? '100% · libre 0%' : '0% · libre 100%'}</div></th>`).join('')}</tr>
      ${K4.map(([pl, ks]) => `<tr><td colspan="5" style="padding:8px 6px 2px;border-top:1px solid var(--line)"><b style="color:var(--pri);font-size:15px">${pl}</b></td></tr>${ks.map(([k, vs]) => `<tr><td style="padding:5px 6px">${k}</td>${cellsRow(vs)}</tr>`).join('')}`).join('')}
      <tr class="np" style="opacity:0"><td colspan="5" style="padding:8px 6px 2px;border-top:1px solid var(--line)"><div style="display:flex;align-items:center;gap:10px"><b style="color:var(--pri);font-size:15px">Mercado y competencia</b><div class="selk" style="margin-left:auto;height:36px;border:1.5px solid var(--line);border-radius:9px;padding:0 12px;display:flex;align-items:center;font-size:14px;color:var(--ink);background:#fff">+ Agregar KPI… ▾</div></div></td></tr>
      <tr class="nk" style="opacity:0"><td style="padding:5px 6px">Share of Search</td>${cellsRow([0, 0, 0, 0])}</tr>
    </table>
    <div style="display:flex;gap:10px;align-items:center;margin-top:12px"><div class="selp" style="height:40px;border:1.5px solid var(--line);border-radius:9px;padding:0 14px;display:flex;align-items:center;font-size:15px;color:var(--ink);background:#fff;min-width:300px">+ Agregar plan / dashboard… ▾</div><div class="addp" style="height:40px;padding:0 18px;border-radius:9px;border:1.5px solid var(--pri);color:var(--pri);display:flex;align-items:center;font-size:15px;font-weight:700">Agregar</div></div>
    <div class="ddp" style="position:absolute;display:none;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 30px rgba(15,23,42,.15);padding:6px;font-size:15px;z-index:3">${PLANS.map(x => `<div class="opp" style="padding:8px 12px;border-radius:7px">${x}</div>`).join('')}</div>
    <div class="ddk" style="position:absolute;display:none;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 12px 30px rgba(15,23,42,.15);padding:6px;font-size:14px;z-index:3">${KNEW.map((x, i) => `<div class="opk" style="padding:7px 12px;border-radius:7px">${x}</div>`).join('')}</div>`)}`,
  (node) => {
    const c = node.querySelector('.pp-card'), np = node.querySelector('.np'), nk = node.querySelector('.nk'), selp = node.querySelector('.selp'), addp = node.querySelector('.addp'), selk = node.querySelector('.selk'), ddp = node.querySelector('.ddp'), ddk = node.querySelector('.ddk'), hds = [...node.querySelectorAll('.hd')];
    const nkSl = nk.querySelectorAll('.sl')[3], nkV = nk.querySelectorAll('.kv')[3], opp = node.querySelector('.opp'), opk = node.querySelector('.opk');
    const rel = (el) => { const r = el.getBoundingClientRect(), cr = c.getBoundingClientRect(); return { x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height }; };
    const abs = (el) => { const r = el.getBoundingClientRect(), st = stage.getBoundingClientRect(); return { x: r.left - st.left + r.width / 2, y: r.top - st.top + r.height / 2 }; };
    let P = null;
    return (lt, a) => {
      leadIn(node, lt); inUp(c, eo(S(lt, 0, .4)), 30);
      // dropdown de planes
      const dp = lt > 1.2 && lt < 2.4;
      if (dp) { const r = rel(selp); ddp.style.display = 'block'; ddp.style.left = r.x + 'px'; ddp.style.top = (r.y + r.h + 4) + 'px'; ddp.style.width = r.w + 'px'; } else ddp.style.display = 'none';
      opp.style.background = lt > 1.8 ? 'var(--pri-soft)' : 'transparent';
      selp.textContent = lt > 2.2 && lt < 3 ? 'Mercado y competencia ▾' : '+ Agregar plan / dashboard… ▾';
      inUp(np, eo(S(lt, 3, 3.3)), 8);
      // dropdown de KPIs
      const dk = lt > 4.2 && lt < 5.4;
      if (dk) { const r = rel(selk); ddk.style.display = 'block'; ddk.style.left = (r.x + r.w - 260) + 'px'; ddk.style.top = (r.y + r.h + 4) + 'px'; ddk.style.width = '260px'; } else ddk.style.display = 'none';
      opk.style.background = lt > 4.8 ? 'var(--pri-soft)' : 'transparent';
      inUp(nk, eo(S(lt, 5.5, 5.8)), 8);
      const v = Math.round(lerp(0, 100, eio(S(lt, 6.8, 8.2))));
      setSl(nkSl, v); nkV.textContent = v; nkV.style.color = v ? 'var(--ink)' : 'var(--faint)';
      hds[3].textContent = `${v}% · libre ${100 - v}%`; hds[3].style.color = v < 100 ? '#b45309' : 'var(--faint)';
      nk.style.background = lt > 5.5 && lt < 9.5 ? 'var(--pri-soft)' : 'transparent';
      if (!P) P = { sp: abs(selp), ad: abs(addp), op: null };
      const op = dp ? abs(opp) : P.op || P.sp; if (dp) P.op = op;
      const sk = abs(selk), ok = dk ? abs(opk) : sk, sl = nkSl.getBoundingClientRect(), st = stage.getBoundingClientRect();
      const slx = sl.left - st.left, sly = sl.top - st.top + sl.height / 2;
      runCursor([{ t: .3, x: 1500, y: 950 }, { t: 1.1, x: P.sp.x, y: P.sp.y, click: 1 }, { t: 1.8, x: op.x, y: op.y, click: 1 }, { t: 2.6, x: P.ad.x, y: P.ad.y, click: 1 },
        { t: 4.0, x: sk.x, y: sk.y, click: 1 }, { t: 4.8, x: ok.x, y: ok.y, click: 1 }, { t: 6.6, x: slx, y: sly, click: 1 }, { t: 8.2, x: slx + sl.width, y: sly }, { t: 12, x: slx + sl.width - 30, y: sly + 70 }], lt, a);
    };
  });

/* 5 · Composición + guardar (27 – 31.5) */
const COMP4 = [['Notoriedad', '#7c3aed', [['Alcance único', 40], ['Impresiones', 30], ['Alcance orgánico', 30]]], ['Consideración', '#2563eb', [['Clicks', 40], ['VTR (≥50%)', 30], ['Engagement rate', 30]]], ['Conversión', '#16a34a', [['Tasa de conversión', 60], ['Tráfico web', 40]]], ['Preferencia de marca', '#ea580c', [['Share of Search', 100]]]];
const compHtml = (ok) => card(170, 0, `${H(3, 'Composición de cada objetivo')}
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:16px">${COMP4.map(o => `<div style="border:1.5px solid var(--line);border-radius:14px;padding:14px"><div style="display:flex;gap:8px;align-items:center"><span style="width:13px;height:13px;border-radius:4px;background:${o[1]}"></span><b style="font-size:16px;white-space:nowrap">${o[0]}</b></div><div style="display:flex;height:11px;border-radius:999px;overflow:hidden;margin:10px 0">${o[2].map((k, i) => `<i style="width:${k[1]}%;background:${o[1]};opacity:${1 - i * .2}"></i>`).join('')}</div>${o[2].map(k => `<div style="display:flex;justify-content:space-between;font-size:14px;margin-top:3px"><span>${k[0]}</span><span style="color:var(--muted)">${k[1]}%</span></div>`).join('')}</div>`).join('')}</div>
    <div style="display:flex;gap:16px;align-items:center;margin-top:20px"><div class="go" style="height:56px;padding:0 24px;border-radius:12px;background:var(--pri);color:#fff;display:flex;align-items:center;font-size:20px;font-weight:700">Guardar mapa</div><span style="font-size:19px;color:#15803D;font-weight:600;opacity:${ok ? 1 : 0}">✓ Guardado</span></div>`);
flowScene('s5', 27, 31.5, lead('Listo tu mapa', 'Así se compone<br>cada objetivo', 'Guardás y queda aplicado en todos tus tableros.'), [
  { t0: 0, t1: 3, at: 2.4, click: '.go', html: compHtml(false) },
  { t0: 3, t1: 4.5, html: compHtml(true) },
], FULL);

/* 6 · Cierre (31.5 – 35.5) */
scene('s8', 31.5, 35.5, `
  <div class="out-wrap"></div>
  <div class="out-copy">
    <h1>Listo. <span class="grad" style="background-image:linear-gradient(92deg,#0a4da0,#12a6f4)">Tu mapa, armado.</span></h1><p style="margin-top:26px;font-size:34px;color:var(--muted);font-weight:500;text-align:center">Ya sabés qué KPI empuja cada objetivo.<br>El próximo paso: cargar tus metas.</p>
  </div>
  <div class="out-foot"><div class="logo"><div class="bip">BIP<span class="tri"></span></div><div class="tag">Business<br>Impact<br>Platform</div></div></div>`,
  (node) => {
    const h = node.querySelector('h1'), pp = node.querySelector('.out-copy p'), f = node.querySelector('.out-foot');
    return (lt) => { inUp(h, eo(S(lt, .1, .7)), 30); inUp(pp, eo(S(lt, .3, .9)), 20); inUp(f, eo(S(lt, .6, 1.2)), 14); };
  });

/* ==========================================================================
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
