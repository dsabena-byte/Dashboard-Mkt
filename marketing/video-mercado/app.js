/* =========================================================================
   Video "Armá Tu mercado en BIP" — competencia, sus redes y sitios, categorías y retailers.
   Réplica de components/mercado/tu-mercado.tsx + components/competitive-prompt.tsx (BIP).
   Marca ficticia "Aurora Cosmética"; competidores y tiendas inventados. Datos ilustrativos.
   ========================================================================= */
const DUR = 45.5;
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
/* =========================================================================
   Tu mercado — helpers propios
   ========================================================================= */
const FULL = 'left:0;top:0;width:1920px;height:1080px';
const card = (top, h, inner) => `<div class="pp-card" style="top:${top}px;${h ? `height:${h}px;` : ''}">${inner}</div>`;
const ab = (el) => { const r = el.getBoundingClientRect(), st = stage.getBoundingClientRect(); return { x: r.left - st.left + r.width / 2, y: r.top - st.top + r.height / 2 }; };
const stepH = (n, t, sub) => `<div style="display:flex;align-items:center;gap:12px"><span style="width:34px;height:34px;border-radius:50%;background:var(--pri);color:#fff;font-weight:800;font-size:18px;display:flex;align-items:center;justify-content:center;font-family:var(--disp)">${n}</span><h3 style="font-size:27px">${t}</h3></div>${sub ? `<div class="sub" style="margin:6px 0 0 46px;font-size:18px">${sub}</div>` : ''}`;
const TOP = `<div style="font-size:17px;color:var(--muted);font-weight:600">Tu mercado</div>`;
const chip = (cls, label, extra = '') => `<div class="ch ${cls}" style="display:inline-flex;align-items:center;gap:9px;height:48px;padding:0 18px;border-radius:999px;border:1.5px solid var(--line);background:#fff;font-size:19px;font-weight:600;color:#334155;margin:0 10px 10px 0">${extra}${label}</div>`;
function chipOn(el, on) { el.style.borderColor = on ? 'var(--pri)' : 'var(--line)'; el.style.background = on ? 'var(--pri-soft)' : '#fff'; el.style.color = on ? 'var(--pri)' : '#334155'; }
const fav = (c) => `<span style="width:22px;height:22px;border-radius:6px;background:${c};display:inline-block"></span>`;
const fld = (lbl, val, cls = '', w = 0) => `<div style="${w ? `width:${w}px` : 'flex:1'}"><div style="font-size:14px;color:var(--muted);font-weight:600;margin-bottom:5px">${lbl}</div><div class="fin ${cls}" style="height:46px;font-size:18px;padding:0 13px">${val}</div></div>`;

/* 1 · Intro (0 – 2.5) */
scene('s1', 0, 2.5, `
  <div class="dark" style="position:absolute;inset:0"></div>
  <div class="hero-glow"></div>
  <div class="logo on-dark intro-logo"><div class="bip">BIP<span class="tri"></span></div><div class="tag">Business<br>Impact<br>Platform</div></div>
  <div class="hero-copy">
    <div class="eyebrow">Tu mercado</div>
    <h1>Tu marca vs<br><span class="grad">tu competencia.</span></h1>
    <p>Competidores, sus redes y sitios, y dónde se vende. En 1 minuto.</p>
  </div>`,
  (node) => {
    const logo = node.querySelector('.logo');
    const parts = [node.querySelector('.eyebrow'), node.querySelector('h1'), node.querySelector('.hero-copy p')];
    return (lt) => { inUp(logo, eo(S(lt, 0, .4)), 20); parts.forEach((p, i) => inUp(p, eo(S(lt, .15 + i * .15, .7 + i * .15)), 30)); };
  });

/* 2 · Abrí Tu mercado (2.5 – 7.5) */
const redes = () => card(170, 0, `<div style="font-size:17px;color:var(--muted);font-weight:600">Redes Sociales</div><h3 style="margin-top:6px">Competencia</h3>
  <div style="margin-top:22px;border:2px solid var(--pri);background:var(--pri-soft);border-radius:18px;padding:24px 26px;display:flex;align-items:center;gap:22px">
    <div style="flex:1"><b style="font-size:24px;font-family:var(--disp)">Compará tu marca con tu competencia</b><div style="font-size:18px;color:var(--muted);margin-top:8px;line-height:1.45">Te sugerimos tus competidores y sus cuentas: tildás los que querés seguir y te mostramos cómo rinden sus redes al lado de las tuyas. Toma 1 minuto.</div></div>
    <div class="go" style="height:60px;padding:0 26px;border-radius:12px;background:var(--pri);color:#fff;display:flex;align-items:center;font-size:21px;font-weight:700;white-space:nowrap">Armar Tu mercado</div>
  </div>
  <div style="display:flex;gap:16px;margin-top:22px;opacity:.45">${[0, 1, 2].map(() => `<div style="flex:1;height:170px;border:1.5px dashed #c3d3e8;border-radius:16px"></div>`).join('')}</div>`);
const buscando = () => card(170, 0, `${TOP}<h3 style="margin-top:6px">Armando tu mercado…</h3>
  ${['Leyendo tu Instagram y tu sitio', 'Buscando cómo te busca la gente en Google', 'Encontrando quién compite por tus búsquedas'].map((x, i) => `<div style="display:flex;align-items:center;gap:14px;margin-top:20px;font-size:21px;font-weight:600;color:#334155"><span class="spin"></span>${x}</div>`).join('')}`);
flowScene('s2', 2.5, 7.5, lead('Paso 1', 'Abrí<br>Tu mercado', 'Desde Redes, Web o SEO. BIP busca todo por vos: vos solo tildás.'), [
  { t0: 0, t1: 3.4, at: 2.5, click: '.go', html: redes() },
  { t0: 3.4, t1: 5, html: buscando() },
], FULL);

/* 3 · Tu marca + ¿Qué vendés? (7.5 – 14) */
const CATS = [['protector solar', '90 mil'], ['cremas faciales', '40 mil'], ['maquillaje', '150 mil'], ['sérum facial', '22 mil']];
scene('s3', 7.5, 14, `
  ${lead('Paso 2', 'Tu marca y<br>qué vendés', 'Tu marca ya viene completa. Elegís cómo te busca la gente en Google.')}
  ${card(130, 0, `${TOP}
    <div style="margin-top:12px">${stepH(1, 'Tu marca', 'Lo completamos con tu Instagram y tu sitio. Corregí lo que haga falta.')}</div>
    <div style="display:flex;gap:14px;margin-top:16px">${fld('Marca', 'Aurora Cosmética', '', 250)}${fld('Sitio web', 'aurora.com.ar')}${fld('Instagram', '@auroracosmetica')}</div>
    <div style="margin-top:30px">${stepH(2, '¿Qué vendés?', 'Tu plan analiza hasta 2 categorías.')}</div>
    <div style="margin-top:16px">${CATS.map((c, i) => chip('cat', `${c[0]} <span style="font-weight:500;color:var(--muted);font-size:16px">· ${c[1]} búsquedas/mes</span>`)).join('')}</div>`)}`,
  (node) => {
    const c = node.querySelector('.pp-card'), cats = [...node.querySelectorAll('.cat')];
    const T = [2.4, 3.8];
    return (lt, a) => {
      leadIn(node, lt); inUp(c, eo(S(lt, 0, .4)), 30);
      cats.forEach((el, i) => { inUp(el, eo(S(lt, .8 + i * .15, 1.2 + i * .15)), 10); chipOn(el, i < 2 && lt > T[i]); });
      const p0 = ab(cats[0]), p1 = ab(cats[1]);
      runCursor([{ t: .5, x: 1500, y: 950 }, { t: T[0], x: p0.x, y: p0.y, click: 1 }, { t: T[1], x: p1.x, y: p1.y, click: 1 }, { t: 7, x: p1.x + 40, y: p1.y + 60 }], lt, a);
    };
  });

/* 4 · Tus competidores (14 – 25) */
const COMP = [
  ['Lumé Skin', 'lumeskin.com.ar', '@lumeskin', '312 mil', '#f472b6', 'Compite en “protector solar” y “sérum facial”'],
  ['Velia', 'velia.com.ar', '@velia.ar', '188 mil', '#a78bfa', 'Compite en “cremas faciales”'],
  ['Kora Beauty', 'korabeauty.com', '@korabeauty', '95 mil', '#fb923c', 'Compite en “protector solar”'],
  ['Naia', 'naia.com.ar', '@naiacosmetica', '41 mil', '#34d399', 'Compite en “cremas faciales”'],
];
const compRow = (c, i) => `<div class="cr" style="border:1.5px solid var(--line);border-radius:16px;padding:14px 18px;margin-top:12px;background:#fff">
  <div style="display:flex;align-items:center;gap:14px"><span class="cb" style="width:30px;height:30px;border-radius:8px;border:2px solid #c3d3e8;display:flex;align-items:center;justify-content:center;color:#fff;flex:0 0 30px">${ICON.check.replace('<svg ', '<svg width="18" height="18" ')}</span>
    ${fav(c[4])}<b style="font-size:21px;font-family:var(--disp)">${c[0]}</b><span style="font-size:16px;color:var(--muted);font-weight:500">${c[5]}</span>
    <span class="pv" style="margin-left:auto;font-size:16px;color:#334155;font-weight:500;opacity:0"><b>${c[2]}</b> ✓ · <span style="color:var(--pri);font-weight:700">${c[3]}</span> seguidores</span></div>
  <div class="cf" style="display:flex;gap:12px;margin-top:10px;margin-left:44px">
    ${fld('Web', c[1])}${fld(`Instagram${i === 2 ? ' <span class="ac" style="color:#a16207;margin-left:6px">a confirmar</span>' : ''}`, i === 2 ? '<span class="ig2">@kora.beauty.ok</span>' : c[2], i === 2 ? 'g2' : '')}${fld('Facebook', '<span style="color:#94a3b8">opcional</span>')}${fld('TikTok', '<span style="color:#94a3b8">opcional</span>')}</div></div>`;
scene('s4', 14, 25, `
  ${lead('Paso 3', 'Tu<br>competencia', 'Los encontramos compitiendo por tus búsquedas. Tildás a quién seguir y revisás sus redes y su web.')}
  ${card(90, 0, `${TOP}<div style="margin-top:10px">${stepH(3, 'Tus competidores', 'Los encontramos en Google compitiendo por tus búsquedas.')}</div>
    ${COMP.map(compRow).join('')}
    <div style="margin-top:14px;font-size:19px;color:var(--pri);font-weight:700">+ Agregar otro</div>`)}`,
  (node) => {
    const c = node.querySelector('.pp-card'), rows = [...node.querySelectorAll('.cr')], ig2 = node.querySelector('.ig2'), g2 = node.querySelector('.g2'), ac = node.querySelector('.ac');
    const TK = [1.6, 2.6, 3.6];            // tilda los 3 primeros
    return (lt, a) => {
      leadIn(node, lt); inUp(c, eo(S(lt, 0, .4)), 30);
      rows.forEach((r, i) => {
        inUp(r, eo(S(lt, .3 + i * .15, .7 + i * .15)), 12);
        const on = i < 3 && lt > TK[i], cb = r.querySelector('.cb');
        cb.style.background = on ? 'var(--pri)' : '#fff'; cb.style.borderColor = on ? 'var(--pri)' : '#c3d3e8';
        r.style.borderColor = on ? 'var(--pri)' : 'var(--line)';
        r.querySelector('.pv').style.opacity = i < 3 ? eo(S(lt, TK[i] + .3, TK[i] + .8)) : 0;
      });
      // corrige el Instagram "a confirmar" de Kora Beauty
      const fix = S(lt, 5.6, 6.6), done = lt > 6.6;
      ig2.textContent = lt < 5.3 ? '@kora.beauty.ok' : lt < 5.6 ? '' : typed('@korabeauty', fix);
      g2.classList.toggle('act', lt > 5.1 && lt < 7);
      g2.style.borderColor = done || lt > 5.1 ? '' : '#fde68a'; ac.style.opacity = lt > 5.3 ? 0 : 1;
      const p = rows.map(r => ab(r.querySelector('.cb'))), pg = ab(g2);
      runCursor([{ t: .6, x: 1500, y: 980 }, { t: TK[0], x: p[0].x, y: p[0].y, click: 1 }, { t: TK[1], x: p[1].x, y: p[1].y, click: 1 }, { t: TK[2], x: p[2].x, y: p[2].y, click: 1 }, { t: 5.1, x: pg.x, y: pg.y, click: 1 }, { t: 7.5, x: pg.x + 60, y: pg.y + 90 }], lt, a);
    };
  });

/* 5 · Dónde se vende (25 – 31) */
const RET = [['Mercado Shop', '#facc15'], ['FarmaPlus', '#ef4444'], ['Belleza Store', '#8b5cf6'], ['Tienda Nube Beauty', '#0ea5e9']];
scene('s5', 25, 31, `
  ${lead('Paso 4', 'Dónde<br>se vende', 'Tiendas y marketplaces que aparecen en tus búsquedas. Opcional, suma a tu posición en Google.')}
  ${card(170, 0, `${TOP}<div style="margin-top:10px">${stepH(4, 'Dónde se vende (opcional)', 'Tiendas y marketplaces que aparecen en tus búsquedas. Hasta 5.')}</div>
    <div style="margin-top:18px" class="rets">${RET.map(r => chip('rt', r[0], fav(r[1]))).join('')}<span class="nw" style="display:none">${chip('rt on', 'Perfumerías Lía', fav('#14b8a6'))}</span></div>
    <div style="display:flex;gap:12px;margin-top:10px;align-items:flex-end">${fld('Nombre', '<span class="rn"></span>', 'f1', 240)}${fld('Sitio', '<span class="rw"></span>', 'f2', 280)}<div class="ad" style="height:46px;padding:0 20px;border-radius:11px;border:2px solid var(--pri);color:var(--pri);display:flex;align-items:center;font-size:18px;font-weight:700">Agregar</div></div>`)}`,
  (node) => {
    const c = node.querySelector('.pp-card'), rts = [...node.querySelectorAll('.rets > .rt')], nw = node.querySelector('.nw'), rn = node.querySelector('.rn'), rw = node.querySelector('.rw'), f1 = node.querySelector('.f1'), f2 = node.querySelector('.f2'), ad = node.querySelector('.ad');
    const TK = [1.4, 2.2];
    return (lt, a) => {
      leadIn(node, lt); inUp(c, eo(S(lt, 0, .4)), 30);
      rts.forEach((el, i) => { inUp(el, eo(S(lt, .5 + i * .12, .9 + i * .12)), 10); chipOn(el, i < 2 && lt > TK[i]); });
      rn.textContent = typed('Perfumerías Lía', S(lt, 3.0, 3.7)); rw.textContent = typed('perfumeriaslia.com', S(lt, 3.9, 4.6));
      f1.classList.toggle('act', lt > 2.8 && lt < 3.8); f2.classList.toggle('act', lt > 3.8 && lt < 4.8);
      const added = lt > 5.0; nw.style.display = added ? 'inline' : 'none'; if (added) chipOn(nw.firstElementChild, true);
      if (added) { rn.textContent = ''; rw.textContent = ''; }
      ad.style.filter = lt > 4.95 && lt < 5.2 ? 'brightness(1.2)' : 'none';
      const p = rts.map(ab), q1 = ab(f1), qa = ab(ad);
      runCursor([{ t: .5, x: 1500, y: 950 }, { t: TK[0], x: p[0].x, y: p[0].y, click: 1 }, { t: TK[1], x: p[1].x, y: p[1].y, click: 1 }, { t: 2.8, x: q1.x, y: q1.y, click: 1 }, { t: 4.6, x: q1.x + 30, y: q1.y + 30 }, { t: 5.0, x: qa.x, y: qa.y, click: 1 }, { t: 6, x: qa.x, y: qa.y }], lt, a);
    };
  });

/* 6 · Guardar y armar el análisis (31 – 36.5) */
const guardar = () => card(170, 0, `${TOP}<h3 style="margin-top:6px">Todo listo para guardar</h3>
  ${[['Tu marca', 'Aurora Cosmética · aurora.com.ar · @auroracosmetica'], ['Categorías', 'protector solar, cremas faciales'], ['Competidores', 'Lumé Skin, Velia, Kora Beauty'], ['Retailers', 'Mercado Shop, FarmaPlus, Perfumerías Lía']].map(r => `<div style="display:grid;grid-template-columns:190px 1fr;gap:12px;font-size:20px;padding:13px 0;border-bottom:1px solid #eef3f9"><span style="color:var(--muted);font-weight:600">${r[0]}</span><span style="font-weight:500">${r[1]}</span></div>`).join('')}
  <div style="display:flex;align-items:center;gap:18px;margin-top:26px"><div class="go" style="height:62px;padding:0 30px;border-radius:13px;background:var(--pri);color:#fff;display:flex;align-items:center;font-size:22px;font-weight:700;box-shadow:0 10px 24px rgba(10,77,160,.28)">Guardar y armar mi análisis</div><span style="font-size:18px;color:var(--muted)">3 competidores · 2 categorías · 3 retailers</span></div>`);
const PROG = [['Redes de tu competencia', '≈ 10 min'], ['Tráfico web comparado', '≈ 10 min'], ['Búsquedas en Google', '≈ 15 min']];
const listo = () => card(170, 0, `<div style="border:1.5px solid #86efac;background:#f0fdf4;border-radius:18px;padding:24px 26px"><b style="font-size:26px;font-family:var(--disp);color:#166534">Listo. Estamos armando tu análisis de mercado</b>
  ${PROG.map(p => `<div style="display:flex;align-items:center;gap:14px;margin-top:18px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 18px"><span class="spin"></span><b style="font-size:21px">${p[0]}</b><span style="margin-left:auto;font-size:18px;color:var(--muted)">${p[1]}</span></div>`).join('')}
  <div style="margin-top:18px;font-size:19px;color:var(--muted)">Podés seguir usando BIP. Después se actualiza solo: redes y web todos los días, búsquedas cada semana.</div></div>`);
flowScene('s6', 31, 36.5, lead('Paso 5', 'Guardás<br>y listo', 'BIP arma tu análisis en unos minutos y después lo mantiene al día solo.'), [
  { t0: 0, t1: 2.6, at: 1.9, click: '.go', html: guardar() },
  { t0: 2.6, t1: 5.5, html: listo() },
], FULL);

/* 7 · El resultado (36.5 – 41.8) */
const SOS = [['Aurora Cosmética', 27, '#1e40af'], ['Lumé Skin', 34, '#94a3b8'], ['Velia', 21, '#94a3b8'], ['Kora Beauty', 18, '#94a3b8']];
const ENG = [['Aurora Cosmética', 3.4, '#1e40af'], ['Lumé Skin', 2.1, '#94a3b8'], ['Velia', 2.8, '#94a3b8'], ['Kora Beauty', 1.6, '#94a3b8']];
const barBlock = (t, rows, max, fmt) => `<div style="flex:1;border:1.5px solid var(--line);border-radius:16px;padding:18px 20px"><b style="font-size:20px">${t}</b>${rows.map(r => `<div style="margin-top:14px"><div style="display:flex;justify-content:space-between;font-size:17px;font-weight:${r[2] === '#1e40af' ? 700 : 500}"><span>${r[0]}</span><span>${fmt(r[1])}</span></div><div style="height:12px;border-radius:999px;background:#eef2f8;margin-top:6px;overflow:hidden"><i class="rb" data-v="${r[1] / max * 100}" style="display:block;height:100%;width:0;background:${r[2]};border-radius:999px"></i></div></div>`).join('')}</div>`;
scene('s7', 36.5, 41.8, `
  ${lead('Y se suma solo', 'Tu marca,<br>al lado de la competencia', 'En Redes, Web y SEO ves cómo te va contra cada competidor.')}
  ${card(170, 0, `<h3>Tu mercado · Septiembre</h3><div class="pill-il">Datos ilustrativos</div>
    <div style="display:flex;gap:18px;margin-top:20px">${barBlock('Share of search', SOS, 40, v => v + '%')}${barBlock('Engagement rate en Instagram', ENG, 4, v => nf(v, 1) + '%')}</div>`)}`,
  (node) => {
    const c = node.querySelector('.pp-card'), rbs = [...node.querySelectorAll('.rb')];
    return (lt) => { leadIn(node, lt); inUp(c, eo(S(lt, 0, .4)), 30); rbs.forEach((b, i) => { b.style.width = b.dataset.v * eo(S(lt, .5 + (i % 4) * .12, 1.5 + (i % 4) * .12)) + '%'; }); };
  });

/* 8 · Cierre (41.8 – 45.5) */
scene('s8', 41.8, 45.5, `
  <div class="out-wrap"></div>
  <div class="out-copy">
    <h1>Listo. <span class="grad" style="background-image:linear-gradient(92deg,#0a4da0,#12a6f4)">Ya sabés contra quién jugás.</span></h1><p style="margin-top:26px;font-size:34px;color:var(--muted);font-weight:500;text-align:center">Tu marca al lado de tu competencia,<br>siempre al día.</p>
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
