/* =========================================================================
   Video "Definí tus objetivos en BIP" — Mapa Estratégico: plantilla → pesos de objetivos →
   KPIs que explican cada objetivo → metas mensuales → seguimiento. Réplica de
   components/mapa/mapa-editor.tsx + mapa-plantilla.tsx + components/web/meta-panel.tsx (BIP).
   ========================================================================= */
const DUR = 78.0;
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

/* 1 · Intro (0 – 4) */
scene('s1', 0, 4, `
  <div class="dark" style="position:absolute;inset:0"></div>
  <div class="hero-glow"></div>
  <div class="logo on-dark intro-logo"><div class="bip">BIP<span class="tri"></span></div><div class="tag">Business<br>Impact<br>Platform</div></div>
  <div class="hero-copy">
    <div class="eyebrow">Tu Mapa Estratégico</div>
    <h1>Definí tus objetivos<br><span class="grad">en BIP. Bien simple.</span></h1>
    <p>Qué querés lograr, cómo lo medís y cuánto pesa cada cosa.</p>
  </div>`,
  (node) => {
    const logo = node.querySelector('.logo');
    const parts = [node.querySelector('.eyebrow'), node.querySelector('h1'), node.querySelector('.hero-copy p')];
    return (lt) => { inUp(logo, eo(S(lt, .05, .7)), 20); parts.forEach((p, i) => inUp(p, eo(S(lt, .35 + i * .25, 1.2 + i * .25)), 30)); };
  });

/* 2 · Plantilla sugerida (4 – 12) */
flowScene('s2', 4, 12, lead('Paso 1', 'Empezá con<br>una plantilla', 'BIP te sugiere objetivos para tu sector, con sus KPIs y pesos. Con un clic tenés tu mapa armado.'), [
  { t0: 0, t1: 8, at: 5.6, click: '.go', html: card(150, 0, `
    <div style="font-size:15px;letter-spacing:.08em;color:var(--pri);font-weight:700">PLANTILLA SUGERIDA · BELLEZA Y CUIDADO PERSONAL</div>
    <h3 style="margin-top:8px">Marca de consumo masivo</h3>
    ${OBJ.map(o => `<div style="margin-top:14px;border:1.5px solid var(--line);border-radius:14px;padding:16px 20px;display:flex;gap:14px;align-items:flex-start"><span style="width:16px;height:16px;border-radius:4px;background:${o[1]};margin-top:5px"></span><div style="flex:1"><b style="font-size:21px">${o[0]}</b><div style="font-size:17px;color:var(--muted);margin-top:4px">Se mide con: ${o[3]}</div></div><span style="font-size:17px;color:var(--muted)">${o[2]}% del total</span></div>`).join('')}
    <div style="display:flex;gap:22px;align-items:center;margin-top:22px"><div class="go" style="height:60px;padding:0 28px;border-radius:12px;background:var(--pri);color:#fff;display:flex;align-items:center;font-size:21px;font-weight:700">Usar esta plantilla</div><span style="font-size:19px;color:#334155;font-weight:600">Prefiero armarlo de cero</span></div>
    <div style="margin-top:14px;font-size:16px;color:var(--muted)">Después la ajustás: nombres, pesos y KPIs.</div>`) },
], FULL);

/* 3 · Pesos de objetivos (12 – 23) */
scene('s3', 12, 23, `
  ${lead('Paso 2', 'Cuánto pesa<br>cada objetivo', 'Movés la barra según lo que más importa este año. Siempre suma 100%.')}
  ${card(200, 0, `${H(1, 'Objetivos estratégicos', 'El peso refleja la importancia relativa; siempre suma 100%.')}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:22px">${OBJ.map((o, i) => `<div style="border:1.5px solid var(--line);border-radius:14px;padding:18px"><div style="display:flex;gap:10px;align-items:center"><span style="width:16px;height:16px;border-radius:4px;background:${o[1]}"></span><div class="fin" style="flex:1;height:48px;font-size:19px;padding:0 12px">${o[0]}</div></div><div style="display:flex;gap:14px;align-items:center;margin-top:18px">${slider('w' + i, o[1], o[2])}<b class="pv" style="width:56px;text-align:right;font-size:22px;font-variant-numeric:tabular-nums">${o[2]}%</b></div></div>`).join('')}</div>
    <div style="margin-top:18px;font-size:19px;color:var(--pri);font-weight:600">+ Agregar objetivo</div>`)}`,
  (node) => {
    const c = node.querySelector('.pp-card'), sls = [...node.querySelectorAll('.sl')], pvs = [...node.querySelectorAll('.pv')];
    let kx = 0, ky = 0, x0 = 0, w = 0;
    return (lt, a) => {
      leadIn(node, lt); inUp(c, eo(S(lt, .1, .7)), 30);
      if (!w) { const r = sls[0].getBoundingClientRect(), st = stage.getBoundingClientRect(); x0 = r.left - st.left; w = r.width; ky = r.top - st.top + r.height / 2; }
      // arrastra Notoriedad 50 → 40; el último (Conversión) balancea 20 → 30
      const p = eio(S(lt, 3.2, 5.6));
      const v0 = Math.round(lerp(50, 40, p)), v2 = 100 - 30 - v0;
      const vals = [v0, 30, v2];
      vals.forEach((v, i) => { setSl(sls[i], v); pvs[i].textContent = v + '%'; });
      kx = x0 + w * v0 / 100;
      runCursor([{ t: 1.2, x: 1500, y: 800 }, { t: 2.6, x: x0 + w * .5, y: ky, click: 1 }, { t: 3.2, x: x0 + w * .5, y: ky }, { t: 5.6, x: kx, y: ky }, { t: 11, x: kx + 60, y: ky + 80 }], lt, a);
    };
  });

/* 4 · KPIs que explican cada objetivo (23 – 40) */
const OW = [['Notoriedad', '#7c3aed'], ['Consideración', '#2563eb'], ['Conversión', '#16a34a']];
const KPIS = [
  ['Plan de Medios', [['Alcance único', [40, 0, 0]], ['Impresiones', [30, 0, 0]], ['Clicks', [0, 40, 0]], ['VTR (≥50%)', [0, 0, 0]]]],
  ['Redes Sociales', [['Alcance orgánico', [30, 0, 0]], ['Engagement rate', [0, 30, 0]]]],
  ['Web / Ecommerce', [['Tráfico web', [0, 0, 40]], ['Tasa de conversión', [0, 0, 60]]]],
];
scene('s4', 23, 40, `
  ${lead('Paso 3', 'Qué KPIs<br>explican cada objetivo', 'Cada objetivo se mide con los KPIs de tus tableros. Repartís el peso de cada KPI hasta llegar a 100%.')}
  ${card(90, 0, `${H(2, 'Qué KPIs explican cada objetivo', 'Por objetivo, la suma llega a 100%.')}
    <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:17px">
      <tr><th style="text-align:left;padding:6px 8px;font-size:14px;color:var(--muted)">KPI</th>${OW.map((o, j) => `<th style="padding:6px 8px;width:220px"><div style="display:flex;gap:6px;align-items:center;justify-content:center;font-size:16px"><span style="width:11px;height:11px;border-radius:3px;background:${o[1]}"></span>${o[0]}</div><div class="hd" data-j="${j}" style="font-size:13px;color:var(--faint);font-weight:600">100% · libre 0%</div></th>`).join('')}</tr>
      ${KPIS.map(([pl, ks]) => `<tr><td colspan="4" style="padding:12px 8px 4px;border-top:1px solid var(--line)"><b style="color:var(--pri);font-size:17px">${pl}</b></td></tr>${ks.map(([k, vs]) => `<tr class="kr" data-k="${k}"><td style="padding:7px 8px">${k}</td>${vs.map((v, j) => `<td style="padding:7px 8px"><div style="display:flex;gap:8px;align-items:center">${slider('', OW[j][1], v)}<span class="kv" style="width:34px;text-align:right;font-size:15px;font-variant-numeric:tabular-nums;color:${v ? 'var(--ink)' : 'var(--faint)'}">${v}</span></div></td>`).join('')}</tr>`).join('')}`).join('')}
    </table>`)}`,
  (node) => {
    const c = node.querySelector('.pp-card'), rows = [...node.querySelectorAll('.kr')], hds = [...node.querySelectorAll('.hd')];
    const vtr = rows.find(r => r.dataset.k === 'VTR (≥50%)'), clicks = rows.find(r => r.dataset.k === 'Clicks');
    const cell = (r, j) => ({ sl: r.querySelectorAll('.sl')[j], kv: r.querySelectorAll('.kv')[j] });
    let pos = null;
    return (lt, a) => {
      leadIn(node, lt); inUp(c, eo(S(lt, .1, .7)), 30);
      // VTR suma 30% a Consideración y Clicks baja de 40 a 40 (el libre pasa de 30% a 0%)
      const p = eio(S(lt, 4.5, 7.5));
      const v = Math.round(lerp(0, 30, p));
      const cv = cell(vtr, 1); setSl(cv.sl, v); cv.kv.textContent = v; cv.kv.style.color = v ? 'var(--ink)' : 'var(--faint)';
      const sums = [100, 70 + v, 100];
      hds.forEach((h, j) => { h.textContent = `${sums[j]}% · libre ${100 - sums[j]}%`; h.style.color = sums[j] < 100 ? '#b45309' : 'var(--faint)'; });
      vtr.style.background = lt > 3 && lt < 9 ? 'var(--pri-soft)' : 'transparent';
      if (!pos) { const r = cv.sl.getBoundingClientRect(), st = stage.getBoundingClientRect(); pos = { x: r.left - st.left, w: r.width, y: r.top - st.top + r.height / 2 }; }
      runCursor([{ t: 2, x: 1500, y: 900 }, { t: 4, x: pos.x, y: pos.y, click: 1 }, { t: 4.5, x: pos.x, y: pos.y }, { t: 7.5, x: pos.x + pos.w * .3, y: pos.y }, { t: 16, x: pos.x + pos.w * .3 + 60, y: pos.y + 90 }], lt, a);
      void clicks;
    };
  });

/* 5 · Composición + guardar (40 – 48) */
const COMP = [['Notoriedad', '#7c3aed', [['Alcance único', 40], ['Impresiones', 30], ['Alcance orgánico', 30]]], ['Consideración', '#2563eb', [['Clicks', 40], ['VTR (≥50%)', 30], ['Engagement rate', 30]]], ['Conversión', '#16a34a', [['Tasa de conversión', 60], ['Tráfico web', 40]]]];
flowScene('s5', 40, 48, lead('Listo tu mapa', 'Así se compone<br>cada objetivo', 'De un vistazo, qué KPI empuja cada resultado. Guardás y queda aplicado en todos tus tableros.'), [
  { t0: 0, t1: 6, at: 5.4, click: '.go', html: card(170, 0, `${H(3, 'Composición de cada objetivo')}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:18px">${COMP.map(o => `<div style="border:1.5px solid var(--line);border-radius:14px;padding:16px"><div style="display:flex;gap:8px;align-items:center"><span style="width:14px;height:14px;border-radius:4px;background:${o[1]}"></span><b style="font-size:19px">${o[0]}</b><span style="margin-left:auto;font-size:14px;color:var(--faint)">100%</span></div><div style="display:flex;height:12px;border-radius:999px;overflow:hidden;margin:12px 0">${o[2].map((k, i) => `<i style="width:${k[1]}%;background:${o[1]};opacity:${1 - i * .2}"></i>`).join('')}</div>${o[2].map(k => `<div style="display:flex;justify-content:space-between;font-size:16px;margin-top:4px"><span>${k[0]}</span><span style="color:var(--muted)">${k[1]}%</span></div>`).join('')}</div>`).join('')}</div>
    <div style="display:flex;gap:16px;align-items:center;margin-top:22px"><div class="go" style="height:58px;padding:0 26px;border-radius:12px;background:var(--pri);color:#fff;display:flex;align-items:center;font-size:21px;font-weight:700">Guardar mapa</div><span class="okm" style="font-size:19px;color:#15803D;font-weight:600;opacity:0">✓ Guardado</span></div>`) },
  { t0: 6, t1: 8, html: (card(170, 0, `${H(3, 'Composición de cada objetivo')}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:18px">${COMP.map(o => `<div style="border:1.5px solid var(--line);border-radius:14px;padding:16px"><div style="display:flex;gap:8px;align-items:center"><span style="width:14px;height:14px;border-radius:4px;background:${o[1]}"></span><b style="font-size:19px">${o[0]}</b><span style="margin-left:auto;font-size:14px;color:var(--faint)">100%</span></div><div style="display:flex;height:12px;border-radius:999px;overflow:hidden;margin:12px 0">${o[2].map((k, i) => `<i style="width:${k[1]}%;background:${o[1]};opacity:${1 - i * .2}"></i>`).join('')}</div>${o[2].map(k => `<div style="display:flex;justify-content:space-between;font-size:16px;margin-top:4px"><span>${k[0]}</span><span style="color:var(--muted)">${k[1]}%</span></div>`).join('')}</div>`).join('')}</div>
    <div style="display:flex;gap:16px;align-items:center;margin-top:22px"><div class="go" style="height:58px;padding:0 26px;border-radius:12px;background:var(--pri);color:#fff;display:flex;align-items:center;font-size:21px;font-weight:700">Guardar mapa</div><span class="okm" style="font-size:19px;color:#15803D;font-weight:600;opacity:0">✓ Guardado</span></div>`)).replace('opacity:0">✓ Guardado', 'opacity:1">✓ Guardado') },
], FULL);

/* 6 · Metas mensuales (48 – 62) */
const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const METAS = [['Alcance único', '1.200.000'], ['Clicks', '18.000'], ['VTR (≥50%)', '32%']];
scene('s6', 48, 62, `
  ${lead('Paso 4', 'Cargá tus<br>metas', 'En cada tablero, la meta mensual de cada KPI. Podés copiar el mismo valor o cargar mes a mes.')}
  ${card(130, 0, `<div style="display:flex;align-items:center"><div><h3 style="font-size:24px">Configuración de objetivos — Plan de Medios</h3><div class="sub" style="font-size:16px">Cargá la meta mensual de cada KPI. El semáforo compara el real de Sep vs la meta.</div></div><div class="gsv" style="margin-left:auto;height:50px;padding:0 22px;border-radius:11px;background:var(--pri);color:#fff;display:flex;align-items:center;font-size:18px;font-weight:700">Guardar</div></div>
    ${METAS.map((m, i) => `<div style="margin-top:14px;border:1.5px solid var(--line);border-radius:14px;padding:14px 18px"><div style="display:flex;align-items:center;gap:14px"><b style="flex:1;font-size:19px">${m[0]}</b><span style="font-size:15px;color:var(--muted)">Meta Sep</span><div class="fin mi" data-i="${i}" style="width:180px;height:46px;font-size:18px;justify-content:flex-end;padding:0 12px"><span class="mt"></span></div></div>${i === 0 ? `<div class="grid12" style="display:grid;grid-template-columns:repeat(12,1fr);gap:6px;margin-top:12px">${MES.map((mm, k) => `<div style="text-align:center"><div style="font-size:12px;color:var(--muted)">${mm}</div><div class="gm" style="height:36px;border:1.5px solid ${k === 8 ? 'var(--cyan)' : 'var(--line)'};border-radius:8px;font-size:13px;display:flex;align-items:center;justify-content:center;color:var(--ink)"></div></div>`).join('')}</div>` : ''}</div>`).join('')}`)}`,
  (node) => {
    const c = node.querySelector('.pp-card'), mts = [...node.querySelectorAll('.mt')], fins = [...node.querySelectorAll('.mi')], gms = [...node.querySelectorAll('.gm')], sv = node.querySelector('.gsv');
    const G = ['0,9M', '0,9M', '1,0M', '1,0M', '1,1M', '1,1M', '1,1M', '1,2M', '1,2M', '1,3M', '1,5M', '1,4M'];
    return (lt, a) => {
      leadIn(node, lt); inUp(c, eo(S(lt, .1, .7)), 30);
      METAS.forEach((m, i) => { const s = 1.8 + i * 2.2; mts[i].textContent = typed(m[1], S(lt, s, s + 1.2)); fins[i].classList.toggle('act', lt > s - .2 && lt < s + 1.6); });
      gms.forEach((g, k) => { g.textContent = lt > 8.6 + k * .12 ? G[k] : ''; });
      sv.style.filter = lt > 11.4 && lt < 11.7 ? 'brightness(1.2)' : 'none';
      const fy = (i) => { const r = fins[i].getBoundingClientRect(), st = stage.getBoundingClientRect(); return { x: r.left - st.left + r.width / 2, y: r.top - st.top + r.height / 2 }; };
      const f0 = fy(0), f1 = fy(1), f2 = fy(2), svr = sv.getBoundingClientRect(), st = stage.getBoundingClientRect();
      runCursor([{ t: .8, x: 1500, y: 900 }, { t: 1.6, x: f0.x, y: f0.y, click: 1 }, { t: 3.8, x: f1.x, y: f1.y, click: 1 }, { t: 6, x: f2.x, y: f2.y, click: 1 }, { t: 10.6, x: f2.x, y: f2.y }, { t: 11.4, x: svr.left - st.left + svr.width / 2, y: svr.top - st.top + svr.height / 2, click: 1 }, { t: 14, x: svr.left - st.left + svr.width / 2, y: svr.top - st.top + svr.height / 2 }], lt, a);
    };
  });

/* 7 · Seguimiento (62 – 72) */
const SEG = [['Notoriedad', '#7c3aed', 94, '#16a34a'], ['Consideración', '#2563eb', 81, '#f59e0b'], ['Conversión', '#16a34a', 67, '#dc2626']];
const SK = [['Alcance único', '1,13M', '1,20M', 94, '#16a34a'], ['Clicks', '14.600', '18.000', 81, '#f59e0b'], ['VTR (≥50%)', '29%', '32%', 91, '#16a34a'], ['Tasa de conversión', '1,3%', '2,0%', 65, '#dc2626']];
scene('s7', 62, 72, `
  ${lead('Y listo', 'Ves tu avance<br>contra lo que querés', 'Si cumplís las metas de tus KPIs, cumplís tus objetivos. El semáforo te dice dónde actuar.')}
  ${card(130, 0, `<h3>Seguimiento de objetivos · Septiembre</h3><div class="pill-il">Datos ilustrativos</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:20px">${SEG.map(o => `<div class="sg" style="border:1.5px solid var(--line);border-radius:14px;padding:18px"><div style="display:flex;gap:8px;align-items:center"><span style="width:14px;height:14px;border-radius:4px;background:${o[1]}"></span><b style="font-size:19px">${o[0]}</b><span style="margin-left:auto;width:14px;height:14px;border-radius:50%;background:${o[3]}"></span></div><div class="sv" style="font-size:44px;font-weight:700;font-family:var(--disp);margin-top:8px">0%</div><div style="height:10px;border-radius:999px;background:#e2e8f0;overflow:hidden"><i class="sb" style="display:block;height:100%;width:0;background:#1e40af"></i></div><div style="font-size:14px;color:var(--muted);margin-top:6px">cumplimiento</div></div>`).join('')}</div>
    <table style="width:100%;border-collapse:collapse;margin-top:18px;font-size:17px"><tr style="color:var(--muted);font-size:14px"><th style="text-align:left;padding:6px">KPI</th><th style="text-align:right;padding:6px">Real</th><th style="text-align:right;padding:6px">Meta</th><th style="text-align:right;padding:6px">Cumpl.</th></tr>${SK.map(k => `<tr class="skr" style="border-top:1px solid var(--line-2)"><td style="padding:9px 6px">${k[0]}</td><td style="text-align:right">${k[1]}</td><td style="text-align:right;color:var(--muted)">${k[2]}</td><td style="text-align:right"><span style="display:inline-flex;gap:8px;align-items:center;font-weight:700">${k[3]}%<i style="width:12px;height:12px;border-radius:50%;background:${k[4]}"></i></span></td></tr>`).join('')}</table>`)}`,
  (node) => {
    const c = node.querySelector('.pp-card'), svs = [...node.querySelectorAll('.sv')], sbs = [...node.querySelectorAll('.sb')], sks = [...node.querySelectorAll('.skr')];
    return (lt) => {
      leadIn(node, lt); inUp(c, eo(S(lt, .1, .7)), 30);
      SEG.forEach((o, i) => { const p = eo(S(lt, 1 + i * .3, 2.8 + i * .3)); svs[i].textContent = Math.round(o[2] * p) + '%'; sbs[i].style.width = o[2] * p + '%'; });
      sks.forEach((r, i) => inUp(r, eo(S(lt, 3.2 + i * .3, 3.8 + i * .3)), 10));
    };
  });

/* 8 · Cierre (72 – 78) */
scene('s8', 72, 78, `
  <div class="out-wrap"></div>
  <div class="out-copy">
    <h1>Listo. <span class="grad" style="background-image:linear-gradient(92deg,#0a4da0,#12a6f4)">Tu estrategia, medida.</span></h1><p style="margin-top:26px;font-size:34px;color:var(--muted);font-weight:500;text-align:center">Cada número de tus tableros ahora se lee<br>contra lo que querés lograr.</p>
  </div>
  <div class="out-foot"><div class="logo"><div class="bip">BIP<span class="tri"></span></div><div class="tag">Business<br>Impact<br>Platform</div></div></div>`,
  (node) => {
    const h = node.querySelector('h1'), pp = node.querySelector('.out-copy p'), f = node.querySelector('.out-foot');
    return (lt) => { inUp(h, eo(S(lt, .1, .9)), 30); inUp(pp, eo(S(lt, .4, 1.1)), 20); inUp(f, eo(S(lt, 1.2, 1.8)), 14); };
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
