/* =========================================================================
   Video "Primeros pasos en BIP" — el primer momento de verdad del cliente.
   Mismo motor que marketing/video-demo (animación determinística: todo el estado
   sale de window.__seek(t)). Acá los tiempos están escritos en SEGUNDOS REALES.
   Contenido alineado al producto: lib/access-requirements.ts (accesos por fuente),
   /empezar (marca → modelo de impacto → conectar → "Tus próximos pasos") y /ayuda.
   ========================================================================= */
const DUR = 63.0;
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
scene('s1', 0, 4.5, `
  <div class="dark" style="position:absolute;inset:0"></div>
  <div class="hero-glow"></div>
  <div class="logo on-dark intro-logo"><div class="bip">BIP<span class="tri"></span></div><div class="tag">Business<br>Impact<br>Platform</div></div>
  <div class="hero-copy">
    <div class="eyebrow">Primeros pasos</div>
    <h1>Tus primeros minutos<br><span class="grad">en BIP, bien hechos.</span></h1>
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
   2 · Antes de empezar: los accesos (4.5 – 14)
   ========================================================================= */
const REQS = [
  ['Meta · Facebook y Meta Ads', 'Acceso a tu Página (“Analizar”) y a tu cuenta publicitaria (“Analista”) en el Business Manager.'],
  ['Instagram', 'Cuenta profesional (Empresa o Creador) vinculada a tu Página de Facebook.'],
  ['Google Analytics (GA4)', 'Rol “Lector” en la propiedad de tu sitio.'],
  ['Google Ads', 'Acceso de “Solo lectura” a tu cuenta.'],
  ['TikTok Ads', 'Acceso a tu cuenta publicitaria en el Business Center.'],
  ['Planillas', 'Ventas, share, presupuesto o pauta offline: Excel, Google Sheets o SharePoint.'],
];
scene('s2', 4.5, 14, `
  ${lead('Paso 1 · Antes de empezar', 'Tené a mano<br>tus accesos', 'Es lo que hace que todo conecte a la primera. Todo es de solo lectura: BIP nunca publica, edita ni gasta en tus cuentas.')}
  <div class="pp-card" style="top:120px">
    <h3>Qué acceso necesitás en cada fuente</h3>
    ${REQS.map(r => `<div class="req"><div class="ck">${CK}</div><div><b>${r[0]}</b><span>${r[1]}</span></div></div>`).join('')}
    <div class="note">¿Te falta alguno? BIP te da el mensaje listo para pedírselo a quien administra la cuenta.</div>
  </div>`,
  (node) => {
    const card = node.querySelector('.pp-card'), reqs = [...node.querySelectorAll('.req')], note = node.querySelector('.note');
    return (lt) => {
      leadIn(node, lt);
      inUp(card, eo(S(lt, .2, .9)), 30);
      reqs.forEach((r, i) => { inUp(r, eo(S(lt, .6 + i * .55, 1.1 + i * .55)), 16); r.classList.toggle('on', lt > 1.3 + i * .55); });
      inUp(note, eo(S(lt, 4.4, 5.0)), 14);
    };
  });

/* =========================================================================
   3 · Creá tu cuenta (14 – 21)
   ========================================================================= */
scene('s3', 14, 21, `
  ${lead('Paso 2', 'Creá tu cuenta', 'Con tu email o con Google, en un minuto. Te llega un mail de bienvenida con los accesos que vas a necesitar.')}
  <div class="pp-card" style="height:660px">
    <h3>Creá tu cuenta</h3>
    <div class="sub">Datos de tu marca y tus fuentes, siempre tuyos.</div>
    <div class="gbtn" style="${A(130)}"><b style="color:#4285f4">G</b> Continuar con Google</div>
    <div style="${A(218, 'text-align:center;font-size:18px;color:var(--muted);font-weight:600')}">o con tu email</div>
    <div class="fl" style="${A(250, 'margin:0')}">Nombre</div>
    <div class="fin" id="f1" style="${A(282)}"><span id="t1"></span><i class="caret" id="c1"></i></div>
    <div class="fl" style="${A(368, 'margin:0')}">Email</div>
    <div class="fin" id="f2" style="${A(400)}"><span id="t2"></span><i class="caret" id="c2"></i></div>
    <div class="pbtn" style="${A(500, 'margin:0')}" id="cta">Crear cuenta</div>
    <div style="${A(590, 'font-size:18px;color:var(--muted);font-weight:500;text-align:center')}">Al crearla te llega el mail “Qué necesitás para conectar tus datos”.</div>
  </div>`,
  (node) => {
    const card = node.querySelector('.pp-card');
    const t1 = node.querySelector('#t1'), t2 = node.querySelector('#t2'), c1 = node.querySelector('#c1'), c2 = node.querySelector('#c2');
    const f1 = node.querySelector('#f1'), f2 = node.querySelector('#f2'), cta = node.querySelector('#cta');
    const K = [{ t: .6, x: 1500, y: 700 }, { t: 1.2, x: 1100, y: CY + 315, click: 1 }, { t: 2.7, x: 1100, y: CY + 315 }, { t: 3.1, x: 1100, y: CY + 433, click: 1 }, { t: 5.0, x: 1100, y: CY + 433 }, { t: 5.5, x: 1254, y: CY + 535, click: 1 }, { t: 7, x: 1254, y: CY + 535 }];
    return (lt, a) => {
      leadIn(node, lt); inUp(card, eo(S(lt, .15, .8)), 30);
      t1.textContent = typed('Laura Gómez', S(lt, 1.3, 2.5));
      t2.textContent = typed('laura@aurora.com.ar', S(lt, 3.2, 4.8));
      f1.classList.toggle('act', lt > 1.2 && lt < 3.1); f2.classList.toggle('act', lt > 3.1 && lt < 5.5);
      c1.style.opacity = lt > 1.2 && lt < 3.1 ? 1 : 0; c2.style.opacity = lt > 3.1 && lt < 5.5 ? 1 : 0;
      cta.style.filter = lt > 5.45 && lt < 5.7 ? 'brightness(1.2)' : 'none';
      runCursor(K, lt, a);
    };
  });

/* =========================================================================
   4 · Elegí qué querés ver (21 – 28)
   ========================================================================= */
const OPTS = [
  ['Redes Sociales', 'Alcance, engagement y sentimiento de tus comentarios.', 'Conectás: Facebook + Instagram'],
  ['Publicidad', 'Inversión, alcance, frecuencia y eficiencia por medio.', 'Conectás: Meta Ads, Google Ads o TikTok'],
  ['Web / Ecommerce', 'Tráfico, conversión y ventas de tu sitio.', 'Conectás: Google Analytics'],
];
scene('s4', 21, 28, `
  ${lead('Paso 3', 'Elegí qué<br>querés medir', 'Tu marca, tu sector y tu modelo de impacto. BIP te pide conectar solo lo que hace falta para eso.')}
  <div class="pp-card" style="height:620px">
    <h3>Construyamos tu modelo de impacto</h3>
    <div class="sub">Podés elegir más de uno.</div>
    ${OPTS.map((o, i) => `<div class="opt" style="${A(120 + i * 150, 'margin:0')}"><div class="box">${CK}</div><div><b>${o[0]}</b><span>${o[1]}</span><em>${o[2]}</em></div></div>`).join('')}
    <div class="pbtn" style="${A(578, 'margin:0;height:0;opacity:0')}"></div>
  </div>`,
  (node) => {
    const card = node.querySelector('.pp-card'), opts = [...node.querySelectorAll('.opt')];
    const bx = CX + 38 + 24 + 17, by = i => CY + 120 + i * 150 + 40;
    const K = [{ t: .8, x: 1500, y: 800 }, { t: 1.6, x: bx, y: by(0), click: 1 }, { t: 2.6, x: bx, y: by(0) }, { t: 3.2, x: bx, y: by(1), click: 1 }, { t: 5, x: bx + 200, y: by(1) + 60 }];
    return (lt, a) => {
      leadIn(node, lt); inUp(card, eo(S(lt, .15, .8)), 30);
      opts.forEach((o, i) => inUp(o, eo(S(lt, .4 + i * .2, 1 + i * .2)), 16));
      opts[0].classList.toggle('on', lt > 1.6); opts[1].classList.toggle('on', lt > 3.2);
      runCursor(K, lt, a);
    };
  });

/* =========================================================================
   5 · Conectá en una sola secuencia (28 – 38)
   ========================================================================= */
const SEQ = ['Conectar Facebook (una sola vez)', 'Elegir tu Página e Instagram', 'Elegir tu cuenta publicitaria', 'Conectar Google Ads'];
scene('s5', 28, 38, `
  ${lead('Paso 4', 'Conectá tus<br>fuentes', 'Facebook una sola vez. Si tenés una sola Página o cuenta, BIP la elige sola. Todo en unos 5 minutos.')}
  <div class="pp-card" style="height:620px">
    <h3>Conectá tus datos</h3>
    <div class="sub">Redes Sociales · Publicidad</div>
    <div style="${A(120, 'right:540px')}">${SEQ.map(s => `<div class="seq"><i>${CK}</i>${s}</div>`).join('')}</div>
    <div class="fb" style="top:120px">
      <div class="hd">Facebook Login for Business</div>
      <div class="it"><div class="cb">${CK}</div><div>Aurora Cosmética<small>Página de Facebook</small></div></div>
      <div class="it"><div class="cb">${CK}</div><div>@auroracosmetica<small>Instagram profesional vinculado</small></div></div>
      <div class="it"><div class="cb">${CK}</div><div>Aurora · Ads<small>Cuenta publicitaria</small></div></div>
      <div class="ok">Guardar</div>
    </div>
    <div class="note" style="${A(520, 'margin:0')}">Solo lectura. Podés desconectar y borrar tus datos cuando quieras.</div>
  </div>`,
  (node) => {
    const card = node.querySelector('.pp-card'), seq = [...node.querySelectorAll('.seq')], fb = node.querySelector('.fb'), note = node.querySelector('.note');
    const items = [...fb.querySelectorAll('.it')];
    const DONE = [2.6, 4.6, 6.0, 7.4];
    const okx = CX + 1068 - 38 - 235, oky = CY + 457;
    const K = [{ t: 1.2, x: 1400, y: 820 }, { t: 3.6, x: okx, y: oky - 40 }, { t: 4.3, x: okx, y: oky, click: 1 }, { t: 6, x: okx, y: oky }];
    return (lt, a) => {
      leadIn(node, lt); inUp(card, eo(S(lt, .15, .8)), 30);
      seq.forEach((s, i) => {
        const prev = i === 0 ? .6 : DONE[i - 1];
        s.classList.toggle('done', lt > DONE[i]); s.classList.toggle('cur', lt > prev && lt <= DONE[i]);
      });
      inUp(fb, eo(S(lt, 2.7, 3.2)) * (1 - eo(S(lt, 4.5, 4.9))), 20);
      items.forEach((it, i) => inUp(it, eo(S(lt, 3.0 + i * .2, 3.4 + i * .2)), 8));
      inUp(note, eo(S(lt, 7.8, 8.4)), 14);
      runCursor(K, lt, a * (1 - S(lt, 5, 5.4)));
    };
  });

/* =========================================================================
   6 · Tus tableros, en minutos (38 – 46)
   ========================================================================= */
const KP = [['Alcance', 184300, ''], ['Interacciones', 9420, ''], ['Inversión', 1.82, 'M'], ['Clicks', 3150, '']];
const BARS = [38, 52, 47, 61, 58, 74, 69, 83];
scene('s6', 38, 46, `
  ${lead('Paso 5', 'Tus tableros,<br>en minutos', 'Las métricas aparecen enseguida. El análisis de los comentarios y las imágenes de las piezas, en unas horas. Después se actualiza solo.')}
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
   7 · Tus próximos pasos (46 – 55)
   ========================================================================= */
const NX = [
  ['Definí tu mercado', 'Competidores y categorías. El análisis tarda unas horas: arrancalo primero.', 'Optimize y Accelerate'],
  ['Definí tus objetivos', 'Con una plantilla de tu sector, en 5 minutos.', ''],
  ['Cargá tus metas', 'Y cada mes ves con semáforo si vas bien o mal.', ''],
];
scene('s7', 46, 55, `
  ${lead('Paso 6', 'Lo que sigue', 'BIP te muestra tus próximos pasos. Así cada número de tus tableros se lee contra lo que querés lograr.')}
  <div class="pp-card" style="height:640px">
    <h3>Tus próximos pasos</h3>
    <div class="sub">Te los recordamos en la plataforma y por mail.</div>
    ${NX.map((x, i) => `<div class="nx"><div class="n">${i + 1}</div><div><b>${x[0]}</b><span>${x[1]}</span></div>${x[2] ? `<div class="tagp">${x[2]}</div>` : ''}</div>`).join('')}
    <div class="sem">
      <div><i style="background:var(--green)"></i>Alcance 104%</div>
      <div><i style="background:var(--amber)"></i>Engagement 91%</div>
      <div><i style="background:var(--red)"></i>Clicks 72%</div>
    </div>
  </div>`,
  (node) => {
    const card = node.querySelector('.pp-card'), nx = [...node.querySelectorAll('.nx')], nums = [...node.querySelectorAll('.nx .n')], sem = node.querySelector('.sem');
    const DONE = [2.4, 3.8, 5.2];
    return (lt) => {
      leadIn(node, lt); inUp(card, eo(S(lt, .15, .8)), 30);
      nx.forEach((x, i) => {
        inUp(x, eo(S(lt, .5 + i * .3, 1.1 + i * .3)), 16);
        const on = lt > DONE[i];
        x.classList.toggle('on', on); nums[i].innerHTML = on ? CK : String(i + 1);
      });
      inUp(sem, eo(S(lt, 5.8, 6.5)), 14);
    };
  });

/* =========================================================================
   8 · Siempre a mano: Ayuda (55 – 59)
   ========================================================================= */
scene('s8', 55, 59, `
  ${lead('Siempre a mano', 'Ayuda, cuando<br>la necesites', 'Tus primeros pasos, qué acceso pide cada fuente y cuándo se actualiza cada dato. Y un equipo que te acompaña.')}
  <div class="side">
    <div class="logo on-dark" style="transform:scale(.62);transform-origin:left top;margin-bottom:6px"><div class="bip">BIP<span class="tri"></span></div></div>
    ${['Seguimiento', 'Plan de Medios', 'Redes Sociales', 'Web', 'Fuentes de datos', 'Ayuda'].map(x => `<div class="si ${x === 'Ayuda' ? 'on' : ''}">${x}</div>`).join('')}
  </div>
  <div class="help">
    <h3 style="font-size:30px;font-weight:700">Ayuda</h3>
    ${[['Tus primeros pasos', '4 de 6 hechos'], ['Qué acceso necesitás en cada fuente', 'Meta, Google, TikTok y planillas'], ['Cuándo se actualiza cada dato', 'Publicidad 2 veces por día · Redes cada 12 h'], ['¿Necesitás una mano?', 'info@roque-in.com']].map(h => `<div class="req on"><div class="ck">${CK}</div><div><b>${h[0]}</b><span>${h[1]}</span></div></div>`).join('')}
  </div>`,
  (node) => {
    const side = node.querySelector('.side'), help = node.querySelector('.help'), rows = [...help.querySelectorAll('.req')];
    return (lt) => {
      leadIn(node, lt); inUp(side, eo(S(lt, .15, .7)), 24); inUp(help, eo(S(lt, .35, .9)), 24);
      rows.forEach((r, i) => inUp(r, eo(S(lt, .8 + i * .3, 1.3 + i * .3)), 12));
    };
  });

/* =========================================================================
   9 · Cierre (59 – 63)
   ========================================================================= */
scene('s9', 59, 63, `
  <div class="out-wrap"></div>
  <div class="out-copy">
    <h1>Listo: ya decidís<br><span class="grad" style="background-image:linear-gradient(92deg,#0a4da0,#12a6f4)">con tus datos.</span></h1>
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
