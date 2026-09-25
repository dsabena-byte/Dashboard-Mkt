/* =========================================================================
   Video "Primeros pasos en BIP" — el primer momento de verdad del cliente.
   Mismo motor que marketing/video-demo (animación determinística: todo el estado
   sale de window.__seek(t)). Acá los tiempos están escritos en SEGUNDOS REALES.
   Para quien ya creó su cuenta: sign in → marca → modelo de impacto → accesos → conexión
   Meta/Google (réplica de las pantallas reales) → tableros. Espejo de lib/access-requirements.ts.
   ========================================================================= */
const DUR = 108.0;
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

/* =========================================================================
   1 · Intro (0 – 4.5)
   ========================================================================= */
scene('s1', 0, 4, `
  <div class="dark" style="position:absolute;inset:0"></div>
  <div class="hero-glow"></div>
  <div class="logo on-dark intro-logo"><div class="bip">BIP<span class="tri"></span></div><div class="tag">Business<br>Impact<br>Platform</div></div>
  <div class="hero-copy">
    <div class="eyebrow">Ya creaste tu cuenta</div>
    <h1>Tus primeros minutos<br><span class="grad">en BIP. Bien simple.</span></h1>
    <p>Qué tener a mano, cómo conectar y qué sigue.</p>
  </div>`,
  (node) => {
    const logo = node.querySelector('.logo');
    const parts = [node.querySelector('.eyebrow'), node.querySelector('h1'), node.querySelector('.hero-copy p')];
    return (lt) => {
      inUp(logo, eo(S(lt, .05, .7)), 20);
      parts.forEach((p, i) => inUp(p, eo(S(lt, .35 + i * .25, 1.2 + i * .25)), 30));
    };
  });

/* =========================================================================
   2 · Entrá a BIP (4 – 10)
   ========================================================================= */
scene('s2', 4, 10, `
  ${lead('Paso 1', 'Entrá a BIP', 'Con el email y la contraseña con los que creaste tu cuenta, o con Google.')}
  <div class="pp-card" style="height:560px">
    <h3>Ingresá a BIP</h3>
    <div class="sub">Business Impact Platform</div>
    <div class="gbtn" style="${A(120)}"><b style="color:#4285f4">G</b> Continuar con Google</div>
    <div style="${A(206, 'text-align:center;font-size:18px;color:var(--muted);font-weight:600')}">o con tu email</div>
    <div class="fin" id="f1" style="${A(250)}"><span id="t1"></span><i class="caret" id="c1"></i></div>
    <div class="fin" id="f2" style="${A(336)}"><span id="t2" style="letter-spacing:.2em"></span><i class="caret" id="c2"></i></div>
    <div class="pbtn" style="${A(440, 'margin:0')}" id="cta">Ingresar</div>
  </div>`,
  (node) => {
    const card = node.querySelector('.pp-card');
    const t1 = node.querySelector('#t1'), t2 = node.querySelector('#t2'), c1 = node.querySelector('#c1'), c2 = node.querySelector('#c2');
    const f1 = node.querySelector('#f1'), f2 = node.querySelector('#f2'), cta = node.querySelector('#cta');
    const K = [{ t: .5, x: 1500, y: 760 }, { t: 1.0, x: 1100, y: CY + 283, click: 1 }, { t: 2.3, x: 1100, y: CY + 283 }, { t: 2.6, x: 1100, y: CY + 369, click: 1 }, { t: 3.6, x: 1100, y: CY + 369 }, { t: 4.1, x: 1254, y: CY + 475, click: 1 }, { t: 6, x: 1254, y: CY + 475 }];
    return (lt, a) => {
      leadIn(node, lt); inUp(card, eo(S(lt, .1, .7)), 30);
      t1.textContent = typed('laura@aurora.com.ar', S(lt, 1.05, 2.2)) || 'Email';
      t1.style.color = S(lt, 1.05, 2.2) > 0 ? 'var(--ink)' : '#94a3b8';
      t2.textContent = typed('••••••••', S(lt, 2.7, 3.5)) || '';
      f1.classList.toggle('act', lt > 1 && lt < 2.6); f2.classList.toggle('act', lt > 2.6 && lt < 4.1);
      c1.style.opacity = lt > 1 && lt < 2.6 ? 1 : 0; c2.style.opacity = lt > 2.6 && lt < 4.1 ? 1 : 0;
      cta.style.filter = lt > 4.05 && lt < 4.3 ? 'brightness(1.2)' : 'none';
      runCursor(K, lt, a);
    };
  });

/* =========================================================================
   3 · Contanos de tu marca (10 – 17) — réplica de /empezar paso 2
   ========================================================================= */
const SECTORES = ['Electrodomésticos', 'Indumentaria y moda', 'Alimentos y bebidas', 'Belleza y cuidado personal', 'Retail / comercio', 'Tecnología y electrónica', 'Automotriz', 'Salud y farma', 'Servicios financieros', 'Turismo y hotelería', 'Educación', 'Hogar y construcción', 'Entretenimiento y medios', 'Bienes de consumo (CPG)', 'Otro'];
scene('s3', 10, 17, `
  ${lead('Paso 2', 'Contanos de<br>tu marca', 'El nombre de la marca que vas a medir y su sector. Con esto armamos tu espacio, y lo podés cambiar cuando quieras.')}
  <div class="pp-card" style="height:660px">
    <h3>Contanos de tu marca</h3>
    <div class="sub">Con esto armamos tu espacio. Lo podés cambiar cuando quieras.</div>
    <div class="fl" style="${A(120, 'margin:0')}">Nombre de la marca</div>
    <div class="fin" id="b1" style="${A(150)}"><span id="bt"></span><i class="caret" id="bc"></i></div>
    <div class="fl" style="${A(232, 'margin:0')}">Sector</div>
    <div style="${A(264, 'display:flex;flex-wrap:wrap;gap:10px')}">${SECTORES.map(x => `<span class="chip" style="border:1.5px solid var(--line);border-radius:999px;padding:9px 16px;font-size:18px;font-weight:600;color:#334155;background:#fff">${x}</span>`).join('')}</div>
    <div class="pbtn" style="${A(560, 'margin:0')}" id="bcta">Continuar</div>
  </div>`,
  (node) => {
    const card = node.querySelector('.pp-card'), bt = node.querySelector('#bt'), bc = node.querySelector('#bc'), b1 = node.querySelector('#b1');
    const chips = [...node.querySelectorAll('.chip')], pick = chips[3], cta = node.querySelector('#bcta');
    let px = 0, py = 0;
    return (lt, a) => {
      leadIn(node, lt); inUp(card, eo(S(lt, .1, .7)), 30);
      if (!px) { const r = pick.getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect(); px = r.left - st.left + r.width / 2; py = r.top - st.top + r.height / 2; }
      bt.textContent = typed('Aurora Cosmética', S(lt, 1.1, 2.4));
      b1.classList.toggle('act', lt > 1 && lt < 3.2); bc.style.opacity = lt > 1 && lt < 3.2 ? 1 : 0;
      const on = lt > 3.6;
      pick.style.background = on ? 'var(--pri-soft)' : '#fff'; pick.style.borderColor = on ? 'var(--pri)' : 'var(--line)'; pick.style.color = on ? 'var(--pri)' : '#334155';
      cta.style.filter = lt > 5.0 && lt < 5.25 ? 'brightness(1.2)' : 'none';
      runCursor([{ t: .5, x: 1500, y: 800 }, { t: 1.0, x: 1100, y: CY + 183, click: 1 }, { t: 2.8, x: 1100, y: CY + 183 }, { t: 3.6, x: px, y: py, click: 1 }, { t: 4.3, x: px, y: py }, { t: 5.0, x: 1254, y: CY + 595, click: 1 }, { t: 7, x: 1254, y: CY + 595 }], lt, a);
    };
  });

/* =========================================================================
   4 · Tu modelo de impacto (17 – 24) — réplica de /empezar paso 3
   ========================================================================= */
const OPTS = [
  ['Redes Sociales', 'Qué contenido construye tu marca y cuál no.', 'Conectás: Facebook + Instagram'],
  ['Publicidad', 'Cuánto rinde cada peso que invertís.', 'Conectás: Meta Ads y Google Ads'],
  ['Web / Ecommerce', 'Cómo la atención se convierte en ventas.', 'Conectás: Google Analytics'],
];
scene('s4', 17, 24, `
  ${lead('Paso 3', 'Elegí qué<br>querés medir', 'Marcás los planes con los que trabajás hoy. BIP te pide conectar solo lo necesario para eso.')}
  <div class="pp-card" style="height:620px">
    <h3>Construyamos tu modelo de impacto</h3>
    <div class="sub">Marcá los planes con los que trabajás hoy.</div>
    ${OPTS.map((o, i) => `<div class="opt" style="${A(120 + i * 150, 'margin:0')}"><div class="box">${CK}</div><div><b>${o[0]}</b><span>${o[1]}</span><em>${o[2]}</em></div></div>`).join('')}
  </div>`,
  (node) => {
    const card = node.querySelector('.pp-card'), opts = [...node.querySelectorAll('.opt')];
    const bx = CX + 38 + 24 + 17, by = i => CY + 120 + i * 150 + 40;
    const K = [{ t: .8, x: 1500, y: 800 }, { t: 1.5, x: bx, y: by(0), click: 1 }, { t: 2.3, x: bx, y: by(0) }, { t: 2.9, x: bx, y: by(1), click: 1 }, { t: 3.7, x: bx, y: by(1) }, { t: 4.3, x: bx, y: by(2), click: 1 }, { t: 6, x: bx + 200, y: by(2) + 60 }];
    return (lt, a) => {
      leadIn(node, lt); inUp(card, eo(S(lt, .15, .8)), 30);
      opts.forEach((o, i) => inUp(o, eo(S(lt, .4 + i * .2, 1 + i * .2)), 16));
      opts[0].classList.toggle('on', lt > 1.5); opts[1].classList.toggle('on', lt > 2.9); opts[2].classList.toggle('on', lt > 4.3);
      runCursor(K, lt, a);
    };
  });

/* =========================================================================
   5 · Antes de conectar: qué necesitás (24 – 35) — mismo texto que lib/access-requirements.ts (BIP)
   ========================================================================= */
const REQS = [
  ['Facebook e Instagram', 'Tu usuario de Facebook tiene que tener acceso a la Página de la marca que querés medir, en el Business Manager, como mínimo con permiso para ver estadísticas (tarea “Analizar”). Si sos Administrador de esa Página, ya lo tenés. El Instagram de esa marca tiene que ser una cuenta profesional, vinculada a esa Página.'],
  ['Meta Ads', 'El mismo usuario de Facebook, con acceso a la cuenta publicitaria de esa marca: como mínimo rol “Analista”. Si sos Anunciante o Administrador, ya lo tenés.'],
  ['Google Analytics', 'Tu usuario de Google, con acceso a la propiedad GA4 del sitio de esa marca: como mínimo rol “Lector”.'],
  ['Google Ads', 'El mismo usuario de Google, con acceso a la cuenta de Google Ads de esa marca: como mínimo “Solo lectura”.'],
];
scene('s5', 24, 35, `
  ${lead('Paso 4 · Antes de conectar', 'Revisá tus<br>accesos', 'La persona que conecte entra con su propio usuario de Facebook y de Google. Estos son los accesos que tiene que tener.')}
  <div class="pp-card" style="top:110px">
    <h3>Antes de conectar: qué necesitás</h3>
    ${REQS.map(r => `<div class="req"><div class="ck">${CK}</div><div><b>${r[0]}</b><span>${r[1]}</span></div></div>`).join('')}
    <div class="note">Si te falta alguno, pedíselo a quien administra la cuenta: BIP te da el mensaje listo para copiar.</div>
  </div>`,
  (node) => {
    const card = node.querySelector('.pp-card'), reqs = [...node.querySelectorAll('.req')], note = node.querySelector('.note');
    return (lt) => {
      leadIn(node, lt);
      inUp(card, eo(S(lt, .2, .9)), 30);
      reqs.forEach((r, i) => { inUp(r, eo(S(lt, .6 + i * 1.6, 1.2 + i * 1.6)), 16); r.classList.toggle('on', lt > 1.6 + i * 1.6); });
      inUp(note, eo(S(lt, 7.4, 8.0)), 14);
    };
  });

/* ---------------------------- ventanas (réplicas de las pantallas reales) ---------------------------- */
const FBI = '<svg viewBox="0 0 24 24" width="42" height="42"><rect width="24" height="24" rx="3" fill="#1877f2"/><path d="M16.5 24v-9h3l.5-3.5h-3.5V9.3c0-1 .3-1.7 1.8-1.7h1.9V4.5c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.6-4.5 4.6v2.5h-3V15h3v9z" fill="#fff"/></svg>';
const GI = (sz = 44) => `<span style="font-size:${sz}px;font-weight:700;font-family:Arial,sans-serif;background:conic-gradient(from -45deg,#ea4335 0 25%,#4285f4 0 50%,#34a853 0 75%,#fbbc05 0);-webkit-background-clip:text;background-clip:text;color:transparent;line-height:1">G</span>`;
const ng = (icon, title, text, btn, ok) => `<div class="ng"><div class="x">×</div><div class="ic">${icon}${ok ? `<span class="ok">${CK}</span>` : ''}</div><h6>${title}</h6><p>${text}</p><div class="cb">${btn}</div><div class="ft">Secured by <b style="color:#111827">nango</b></div></div>`;
const winFB = (prog, inner, next) => `<div class="win"><div class="tb"><span style="color:#1877f2;font-weight:700">f</span> Inicio de sesión con Facebook para empresas - Google Chrome<div class="dots">—&nbsp;☐&nbsp;✕</div></div><div class="ub">facebook.com/v22.0/dialog/oauth?response_type=code&amp;client_id=…</div><div class="fbh"><span class="inf">∞</span><span style="color:#65676b;font-size:20px">⇄</span><span class="bipb">BIP▸</span><span class="av"></span></div><div class="fbp"><i style="width:${prog}%"></i></div><div class="fbc">${inner}</div>${next ? `<div class="fbfoot"><div class="lg">Política de privacidad y Condiciones del servicio de BIP Connector</div><div class="fbb g">Atrás</div><div class="fbb b go">${next}</div></div>` : ''}</div>`;
const fbChoose = (what) => `<h5>Elige los ${what} a los que quieres que acceda BIP Connector</h5><div class="s">Más tarde podrás revisar lo que BIP Connector podrá hacer con los ${what} que selecciones.</div><div class="rad"><i class="on"></i><div><b>Activar todos los ${what} actuales y futuros</b><span>Se dará acceso a BIP Connector a tus ${what} actuales y a ${what} que crees en el futuro.</span></div></div><div class="rad"><i></i><div><b>Activar solo los ${what} actuales</b><span>Se dará acceso a BIP Connector solo a los ${what} que selecciones.</span></div></div>`;
const PERMS = [['Acceder a las estadísticas de tu página y app', ''], ['Acceder a tus anuncios de Facebook y estadísticas relacionadas', ''], ['Administrar tu negocio', 'Se activaron todos los activos (Negocios) actuales y futuros'], ['Acceder al perfil y las publicaciones desde la cuenta de Instagram seleccionada', 'Se activaron todos los activos (Cuentas de Instagram) actuales y futuros'], ['Administrar los comentarios de la cuenta de Instagram seleccionada', 'Se activaron todos los activos (Cuentas de Instagram) actuales y futuros'], ['Acceder a las estadísticas de la cuenta de Instagram', 'Se activaron todos los activos (Cuentas de Instagram) actuales y futuros'], ['Leer el contenido publicado en la página', 'Se activaron todos los activos (Páginas) actuales y futuros']];
const winG = (inner, btns) => `<div class="win gw"><div class="tb">${GI(18)} Inicia sesión: Cuentas de Google - Google Chrome<div class="dots">—&nbsp;☐&nbsp;✕</div></div><div class="ub">accounts.google.com/v3/signin/…</div><div class="gh">${GI(20)} Iniciar sesión con Google</div><div class="gc">${inner}</div>${btns || ''}</div>`;

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
   6 · Conectá tu Facebook (35 – 40)
   ========================================================================= */
flowScene('s6', 35, 40, lead('Paso 5', 'Conectá tus<br>fuentes', 'Un paso a la vez: primero Facebook y después Google. Si tenés una sola cuenta, BIP la elige sola.'), [
  { t0: 0, t1: 5, at: 2.8, click: '.go', html: connectCard(0, 'Conectá tu Facebook', 'Entrá con el usuario de Facebook con el que manejás la Página y los anuncios de la marca que querés medir. BIP solo lee tus datos para mostrártelos en tus tableros.', primary('Continuar con Facebook')) },
], FULL);

/* =========================================================================
   7 · Ventanas de Meta (40 – 61)
   ========================================================================= */
flowScene('s7', 40, 61, lead('Paso 5 · Facebook', 'La ventana oficial<br>de Facebook', 'Es la pantalla de Meta. Elegís el negocio, la Página y el Instagram de la marca, revisás y guardás. Son un par de clics.'), [
  { t0: 0, t1: 2.8, at: 2.0, click: '.cb', cap: 'Tocá “Conectar”: se abre la ventana de Facebook', html: ng(FBI, 'Vincular cuenta de Facebook', 'Te conectaremos a Facebook. Se abrirá una ventana emergente, asegúrate de que tu navegador no bloquee las ventanas emergentes', 'Conectar') },
  { t0: 2.8, t1: 5.4, at: 4.7, click: '.b', cap: 'Entrás con tu usuario de Facebook', html: winFB(8, `<h5>¿Continuar como Laura Gómez?</h5><div class="s">BIP Connector recibirá acceso a la información que elijas.</div><div class="fbbtns"><div class="fbb g">Editar configuración</div><div class="fbb b">Continuar</div></div><div class="s" style="margin-top:24px">¿No eres Laura Gómez? <span style="color:#1877f2">Iniciar sesión en otra cuenta</span></div>`) },
  { t0: 5.4, t1: 8.0, at: 7.3, click: '.go', cap: 'Elegís el negocio de la marca', html: winFB(30, fbChoose('Negocios'), 'Continuar') },
  { t0: 8.0, t1: 10.6, at: 9.9, click: '.go', cap: 'La Página de Facebook', html: winFB(50, fbChoose('Páginas'), 'Continuar') },
  { t0: 10.6, t1: 13.2, at: 12.5, click: '.go', cap: 'Y su cuenta de Instagram', html: winFB(70, fbChoose('Cuentas de Instagram'), 'Continuar') },
  { t0: 13.2, t1: 17.0, at: 16.3, click: '.go', cap: 'Revisás y tocás “Guardar”', html: winFB(90, `<h5>Revisa la solicitud de acceso de BIP Connector</h5>${PERMS.map(q => `<div class="perm"><b>${q[0]}</b>${q[1] ? `<span>${q[1]}</span>` : ''}</div>`).join('')}`, 'Guardar') },
  { t0: 17.0, t1: 19.0, at: 18.4, click: '.go', cap: 'Listo: conectado', html: winFB(100, `<h5>Laura Gómez se conectó a BIP Connector</h5><div class="s">Para administrar esta conexión, <span style="color:#1877f2">ir a las integraciones comerciales</span></div>`, 'De acuerdo').replace('<div class="fbb g">Atrás</div>', '') },
  { t0: 19.0, t1: 21, at: 20.3, click: '.cb', cap: 'Tocá “Finalizar”', html: ng(FBI, '¡Éxito!', 'Has configurado exitosamente tu integración con Facebook.', 'Finalizar', true) },
]);

/* =========================================================================
   8 · Elegí qué medimos en Meta (61 – 68)
   ========================================================================= */
flowScene('s8', 61, 68, lead('Paso 5 · Facebook', 'Elegí qué<br>medimos', 'La Página de la marca (su Instagram viene con ella) y la cuenta de anuncios. Si hay una sola, BIP la elige sola.'), [
  { t0: 0, t1: 3.5, at: 2.6, click: '.go', html: connectCard(1, '¿Qué Facebook e Instagram medimos?', 'Elegí la Página de Facebook de tu marca. El Instagram vinculado a esa Página se suma con ella: con una sola elección quedan los dos.', pick('Aurora Cosmética', 'Usar esta')) },
  { t0: 3.5, t1: 7, at: 6.0, click: '.go', html: connectCard(2, '¿Qué cuenta de anuncios analizamos?', 'Elegí la cuenta con la que hacés los anuncios de tu marca.', pick('Aurora · Ads', 'Usar esta')) },
], FULL);

/* =========================================================================
   9 · Google (68 – 82)
   ========================================================================= */
flowScene('s9', 68, 82, lead('Paso 6 · Google', 'Y después,<br>Google', 'La ventana oficial de Google: elegís tu cuenta y confirmás. Con una sola conexión quedan Google Analytics y Google Ads.'), [
  { t0: 0, t1: 3, at: 2.2, click: '.go', html: connectCard(3, 'Conectá tu cuenta de Google', 'Entrá con la cuenta de Google con la que ves las estadísticas de tu sitio (Google Analytics) y tus anuncios de Google. BIP solo lee tus datos para mostrártelos en tus tableros.', primary('Conectar con Google')) },
  { t0: 3, t1: 5.6, at: 4.9, click: '.cb', html: `<div style="position:absolute;left:860px;top:96px;width:700px;height:860px">${ng(GI(), 'Vincular cuenta de Google', 'Te conectaremos a Google. Se abrirá una ventana emergente, asegúrate de que tu navegador no bloquee las ventanas emergentes', 'Conectar')}</div>` },
  { t0: 5.6, t1: 8.4, at: 7.6, click: '.acc', html: `<div style="position:absolute;left:860px;top:96px;width:700px;height:860px">${winG(`<div style="font-family:var(--disp);font-weight:800;color:var(--ink);font-size:22px">BIP<span style="color:var(--cyan)">▸</span></div><h5 style="margin-top:20px">Selecciona una cuenta</h5><div style="margin-top:12px;font-size:18px;color:#0b57d0">Ir a BIP</div><div style="margin-top:26px"><div class="acc"><i>L</i><div><b>Laura Gómez</b><span>laura@aurora.com.ar</span></div></div><div class="acc"><i style="background:#94a3b8">+</i><div><b>Usar otra cuenta</b></div></div></div><div style="margin-top:28px;font-size:15px;color:#444746;line-height:1.5">Antes de usar esta aplicación, puedes leer la <span style="color:#0b57d0">Política de Privacidad</span> y los <span style="color:#0b57d0">Términos del Servicio</span> de BIP.</div>`)}</div>` },
  { t0: 8.4, t1: 11.6, at: 10.9, click: '.gc2', html: `<div style="position:absolute;left:860px;top:96px;width:700px;height:860px">${winG(`<h5>BIP quiere acceder a tu cuenta de Google</h5><div style="margin-top:18px;display:flex;gap:10px;align-items:center;font-size:17px"><span style="width:28px;height:28px;border-radius:50%;background:#6d28d9;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px">L</span>laura@aurora.com.ar</div><div style="margin-top:34px;font-size:24px;color:#1f1f1f">Confirma que confías en BIP</div><div style="margin-top:14px;font-size:16px;color:#444746;line-height:1.6">Revisa la <span style="color:#0b57d0">Política de Privacidad</span> y los <span style="color:#0b57d0">Términos del Servicio</span> de BIP para saber cómo tratará y protegerá BIP tus datos.<br><br>Para hacer cambios en cualquier momento, ve a tu <span style="color:#0b57d0">cuenta de Google</span>.</div>`, `<div class="gbtns"><div>Cancelar</div><div class="gc2">Continuar</div></div>`)}</div>` },
  { t0: 11.6, t1: 14, at: 13.1, click: '.cb', html: `<div style="position:absolute;left:860px;top:96px;width:700px;height:860px">${ng(GI(), '¡Éxito!', 'Has configurado exitosamente tu integración con Google.', 'Finalizar', true)}</div>` },
], FULL);

/* =========================================================================
   10 · Elegí tu sitio y tu cuenta de Google Ads (82 – 89)
   ========================================================================= */
flowScene('s10', 82, 89, lead('Paso 6 · Google', 'Elegí tu sitio<br>y tu cuenta', 'La propiedad de Google Analytics de tu sitio y la cuenta de Google Ads de la marca.'), [
  { t0: 0, t1: 3.5, at: 2.6, click: '.go', html: connectCard(4, '¿Qué sitio medimos?', 'Elegí la propiedad de Google Analytics de tu sitio. Si ves varias, es la de tu marca (no la de pruebas).', pick('Aurora · GA4', 'Usar este')) },
  { t0: 3.5, t1: 7, at: 6.0, click: '.go', html: connectCard(5, '¿Qué cuenta de Google Ads analizamos?', 'Elegí la cuenta con la que hacés los anuncios de tu marca en Google.', pick('Aurora', 'Usar esta')) },
], FULL);

/* =========================================================================
   11 · Listo, tus datos están conectados (89 – 95)
   ========================================================================= */
const HECHOS = [['Facebook', 'Aurora Cosmética'], ['Instagram', '@auroracosmetica'], ['Meta Ads', 'Aurora · Ads'], ['Google Analytics', 'Aurora · GA4'], ['Google Ads', 'Aurora']];
flowScene('s11', 89, 95, lead('Listo', 'Tus datos,<br>conectados', 'Revisás que sean las cuentas correctas y vas directo a tus tableros.'), [
  { t0: 0, t1: 6, at: 4.2, click: '.go', html: `<div class="pp-card" style="top:40px;height:1000px">
    <h3>Listo, tus datos están conectados</h3><div class="sub">Revisá que sean las cuentas correctas:</div>
    ${HECHOS.map(h => `<div class="req on" style="padding:11px 18px;margin-top:9px"><div class="ck" style="width:32px;height:32px;flex-basis:32px">${CK}</div><div><b style="font-size:20px">${h[0]}</b><span style="font-size:17px">${h[1]}</span></div></div>`).join('')}
    <div class="fl" style="margin-top:18px">Tus tableros</div>
    ${[['Redes Sociales', 'Métricas en minutos · el sentimiento de los comentarios, en unas horas.'], ['Publicidad', 'Inversión y campañas en minutos · las imágenes de las piezas, en unas horas.'], ['Web / Ecommerce', 'Tráfico, conversión y ventas en minutos.']].map(t => `<div class="req" style="padding:11px 18px;margin-top:9px;align-items:center"><div style="flex:1"><b style="font-size:20px">${t[0]}</b><span style="font-size:16px">${t[1]}</span></div><div style="border:2px solid var(--pri);color:var(--pri);border-radius:10px;padding:8px 16px;font-size:17px;font-weight:700">Ver tablero</div></div>`).join('')}
    ${primary('Ver mis tableros →')}
  </div>` },
], FULL);

const KP = [['Alcance', 184300, ''], ['Interacciones', 9420, ''], ['Inversión', 1.82, 'M'], ['Clicks', 3150, '']];
const BARS = [38, 52, 47, 61, 58, 74, 69, 83];
scene('s12', 95, 103, `
  ${lead('Listo', 'Tus tableros,<br>en minutos', 'Las métricas aparecen enseguida y después se actualizan solas. Ya podés empezar a explorar.')}
  <div class="pp-card" style="height:640px">
    <h3>Tus tableros · Aurora</h3>
    <div class="sub">Últimos 30 días</div>
    <div class="pill-il">Datos ilustrativos</div>
    <div class="kg">${KP.map(k => `<div class="kc"><div class="l">${k[0]}</div><div class="v">0</div><div class="d">▲ vs mes anterior</div></div>`).join('')}</div>
    <div class="chart">${BARS.map((b, i) => `<div class="bar" style="height:0"><b>S${i + 1}</b></div>`).join('')}</div>
    <div class="pend"><span class="spin"></span> Sentimiento de comentarios: procesando (unas horas)</div>
  </div>`,
  (node) => {
    const card = node.querySelector('.pp-card'), vs = [...node.querySelectorAll('.kc .v')], ds = [...node.querySelectorAll('.kc .d')], bars = [...node.querySelectorAll('.bar')], pend = node.querySelector('.pend');
    return (lt) => {
      leadIn(node, lt); inUp(card, eo(S(lt, .15, .8)), 30);
      KP.forEach((k, i) => {
        const p = eo(S(lt, 1 + i * .25, 2.6 + i * .25));
        vs[i].textContent = k[2] === 'M' ? `$${nf(k[1] * p, 2)}M` : nf(Math.round(k[1] * p));
        ds[i].style.opacity = S(lt, 2.6 + i * .25, 3 + i * .25);
      });
      bars.forEach((b, i) => { b.style.height = (BARS[i] * 1.7 * eo(S(lt, 1.4 + i * .12, 2.4 + i * .12))) + 'px'; });
      inUp(pend, eo(S(lt, 3.6, 4.2)), 12);
    };
  });

/* =========================================================================
   10 · Cierre (64 – 68)
   ========================================================================= */
scene('s13', 103, 108, `
  <div class="out-wrap"></div>
  <div class="out-copy">
    <h1>Listo. <span class="grad" style="background-image:linear-gradient(92deg,#0a4da0,#12a6f4)">Así de simple.</span></h1><p style="margin-top:26px;font-size:34px;color:var(--muted);font-weight:500;text-align:center">Ya podés empezar a usar BIP para mejorar tus resultados.</p>
    <div class="cta">bip-go.com</div>
  </div>
  <div class="out-foot"><div class="logo"><div class="bip">BIP<span class="tri"></span></div><div class="tag">Business<br>Impact<br>Platform</div></div></div>`,
  (node) => {
    const h = node.querySelector('h1'), c = node.querySelector('.cta'), f = node.querySelector('.out-foot');
    return (lt) => { inUp(h, eo(S(lt, .1, .9)), 30); inUp(c, eo(S(lt, .6, 1.3)), 20); inUp(f, eo(S(lt, 1, 1.6)), 14); };
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
