/* =========================================================================
   Video "Sumá tus planillas en BIP" — Google Sheets, Excel en OneDrive/SharePoint o archivo.
   Mismo motor que marketing/video-demo (animación determinística: todo el estado
   sale de window.__seek(t)). Acá los tiempos están escritos en SEGUNDOS REALES.
   Réplica del paso "¿Dónde está tu planilla?" de BIP (components/sheet-adder.tsx +
   tablero-setup.tsx) y de las ventanas reales de Google Picker, Nango y Microsoft.
   ========================================================================= */
const DUR = 80.0;
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
   Planillas — helpers propios
   ========================================================================= */
const XLI = '<svg viewBox="0 0 24 24" width="44" height="44"><rect x="7" y="2" width="15" height="20" rx="2" fill="#21a366"/><rect x="7" y="2" width="15" height="7" fill="#33c481"/><rect x="7" y="15" width="15" height="7" fill="#107c41"/><rect x="2" y="6" width="11" height="12" rx="1.6" fill="#185c37"/><path d="M4.6 9l1.9 3-1.9 3h1.5l1.2-2.1 1.2 2.1h1.5l-1.9-3 1.9-3H8.5L7.3 11.1 6.1 9z" fill="#fff"/></svg>';
const MSI = '<span style="display:inline-grid;grid-template-columns:11px 11px;gap:2px;vertical-align:middle"><i style="width:11px;height:11px;background:#f25022"></i><i style="width:11px;height:11px;background:#7fba00"></i><i style="width:11px;height:11px;background:#00a4ef"></i><i style="width:11px;height:11px;background:#ffb900"></i></span>';
const OPTS3 = [
  ['Google Sheets', 'Una planilla guardada en tu Google Drive.', 'Se actualiza sola cuando la cambiás.'],
  ['Excel en OneDrive o SharePoint', 'Un Excel guardado en la nube de Microsoft.', 'Se actualiza solo cuando lo cambiás.'],
  ['Archivo de tu computadora', 'Un Excel o CSV que tenés en tu compu.', 'Para actualizarlo, subís la versión nueva.'],
];
const optBox = (o, on) => `<div class="o3${on ? ' on' : ''}" style="flex:1;border:${on ? '2.5px solid var(--pri)' : '1.5px solid var(--line)'};background:${on ? 'var(--pri-soft)' : '#fff'};border-radius:16px;padding:18px 20px;min-height:170px"><b style="display:block;font-size:21px;color:var(--ink)">${o[0]}</b><span style="display:block;margin-top:8px;font-size:17px;line-height:1.45;color:#334155">${o[1]}</span><span style="display:block;margin-top:8px;font-size:16px;line-height:1.45;color:var(--muted)">${o[2]}</span></div>`;
const stepsList = (xs) => `<ol style="margin:22px 0 0;padding-left:28px;font-size:20px;line-height:1.7;color:#16202e">${xs.map(x => `<li>${x}</li>`).join('')}</ol>`;
const sheetCard = (sel, body = '') => `<div class="pp-card" style="top:120px">
  <div style="font-size:17px;color:var(--muted);font-weight:600">Resultados Comerciales · Paso 1 de 2</div>
  <h3 style="margin-top:10px">¿Dónde tenés tu información comercial?</h3>
  <div class="sub">Elegís dónde está, la leemos y armamos el tablero solos.</div>
  <div class="fl" style="margin-top:26px">¿Dónde está tu planilla?</div>
  <div style="display:flex;gap:14px">${OPTS3.map((o, i) => optBox(o, i === sel)).join('')}</div>
  ${body}</div>`;
const btnP = (label, ghost) => `<div class="go" style="margin-top:22px;display:inline-flex;height:62px;padding:0 30px;border-radius:13px;${ghost ? 'border:2px solid var(--pri);color:var(--pri);background:#fff' : 'background:var(--pri);color:#fff;box-shadow:0 10px 24px rgba(10,77,160,.28)'};align-items:center;font-size:22px;font-weight:700">${label}</div>`;
const okLine = (t) => `<div style="margin-top:20px;font-size:20px;font-weight:600;color:#15803D">✓ ${t}</div>`;
const winMS = (title, url, inner, btns) => `<div class="win"><div class="tb">${MSI} ${title} - Google Chrome<div class="dots">—&nbsp;☐&nbsp;✕</div></div><div class="ub">${url}</div><div style="padding:34px 44px;font-family:'Segoe UI',Inter,sans-serif">${inner}</div>${btns || ''}</div>`;
const msLogo = `<div style="display:flex;gap:10px;align-items:center;font-size:22px;color:#5e5e5e;font-weight:600">${MSI} Microsoft</div>`;
const msAcc = (n, m, cls = '') => `<div class="${cls}" style="display:flex;gap:16px;align-items:center;padding:16px 12px;border-bottom:1px solid #e5e7eb"><span style="width:44px;height:44px;border-radius:50%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:20px;color:#374151">👤</span><div><b style="display:block;font-size:18px;font-weight:600;color:#1b1b1b">${n}</b><span style="font-size:15px;color:#444">${m}</span><span style="display:block;font-size:14px;color:#666">Conectado</span></div></div>`;
const FILES = [['Ventas 2026', 'Sep 24, 2026'], ['Presupuesto Marketing 2026', 'Sep 20, 2026'], ['Share de mercado', 'Sep 12, 2026'], ['Plan de medios offline', 'Aug 30, 2026'], ['Relevamiento góndola', 'Aug 19, 2026']];
const picker = `<div style="position:absolute;left:60px;top:40px;width:1000px;height:760px;background:#fff;border-radius:6px;box-shadow:0 40px 90px rgba(16,32,46,.3);border:1px solid #d1d5db;font-family:Arial,sans-serif">
  <div style="padding:26px 30px 0;font-size:26px;color:#202124">Select a file<span style="float:right;color:#5f6368">×</span></div>
  <div style="margin:22px 30px 0;border-bottom:1px solid #e5e7eb"><span style="display:inline-block;padding:0 6px 12px;border-bottom:3px solid #1a73e8;font-size:17px;font-weight:700;color:#202124">Spreadsheets</span></div>
  <div style="display:flex;padding:16px 30px;border-bottom:1px solid #e5e7eb;font-size:15px;color:#5f6368"><span style="flex:1">Name</span><span style="width:160px">Owner</span><span style="width:170px">Last modified ↓</span></div>
  ${FILES.map((f, i) => `<div class="${i === 0 ? 'row0' : ''}" style="display:flex;align-items:center;padding:16px 30px;border-bottom:1px solid #eef0f2;font-size:17px;color:#202124;${i === 0 ? 'background:#e8f0fe;color:#1967d2' : ''}"><span style="flex:1;display:flex;gap:14px;align-items:center"><i style="width:20px;height:24px;background:#0f9d58;border-radius:3px;display:inline-block"></i>${f[0]}</span><span style="width:160px">me</span><span style="width:170px">${f[1]}</span></div>`).join('')}
  <div style="position:absolute;left:30px;bottom:24px;display:flex;gap:12px"><span class="go" style="background:#4d90fe;color:#fff;border-radius:3px;padding:12px 26px;font-size:16px;font-weight:700">Select</span><span style="border:1px solid #d1d5db;border-radius:3px;padding:12px 26px;font-size:16px;color:#444">Cancel</span></div>
</div>`;
const AT = 'position:absolute;left:860px;top:96px;width:700px;height:860px';

/* =========================================================================
   1 · Intro (0 – 4)
   ========================================================================= */
scene('s1', 0, 4, `
  <div class="dark" style="position:absolute;inset:0"></div>
  <div class="hero-glow"></div>
  <div class="logo on-dark intro-logo"><div class="bip">BIP<span class="tri"></span></div><div class="tag">Business<br>Impact<br>Platform</div></div>
  <div class="hero-copy">
    <div class="eyebrow">Tus planillas</div>
    <h1>Sumá tus planillas<br><span class="grad">a BIP. Bien simple.</span></h1>
    <p>Ventas, share, presupuesto, medios offline… lo que tengas en Excel o Google Sheets.</p>
  </div>`,
  (node) => {
    const logo = node.querySelector('.logo');
    const parts = [node.querySelector('.eyebrow'), node.querySelector('h1'), node.querySelector('.hero-copy p')];
    return (lt) => { inUp(logo, eo(S(lt, .05, .7)), 20); parts.forEach((p, i) => inUp(p, eo(S(lt, .35 + i * .25, 1.2 + i * .25)), 30)); };
  });

/* =========================================================================
   2 · Tres caminos (4 – 11)
   ========================================================================= */
scene('s2', 4, 11, `
  ${lead('Paso 1', 'Elegí dónde<br>está tu planilla', 'Tres caminos, según dónde la guardás. En la nube se actualiza sola; si es un archivo, subís la versión nueva.')}
  ${sheetCard(-1)}`,
  (node) => {
    const card = node.querySelector('.pp-card'), os = [...node.querySelectorAll('.o3')];
    return (lt) => {
      leadIn(node, lt); inUp(card, eo(S(lt, .1, .7)), 30);
      os.forEach((o, i) => {
        inUp(o, eo(S(lt, .5 + i * .2, 1.1 + i * .2)), 14);
        const on = lt > 2 + i * 1.5 && lt < 3.4 + i * 1.5;
        o.style.borderColor = on ? 'var(--pri)' : 'var(--line)'; o.style.background = on ? 'var(--pri-soft)' : '#fff';
        o.style.boxShadow = on ? '0 0 0 5px rgba(10,77,160,.12)' : 'none';
      });
    };
  });

/* =========================================================================
   3 · Google Sheets (11 – 25)
   ========================================================================= */
flowScene('s3', 11, 25, lead('Google Sheets', 'Desde tu<br>Google Drive', 'Tocás “Elegir de mi Drive”, marcás la planilla y listo. Cada vez que la cambies, tu tablero se actualiza solo.'), [
  { t0: 0, t1: 4.2, at: 3.3, click: '.go', html: sheetCard(0, stepsList(['Tocá <b>Elegir de mi Drive</b>: se abre tu Google Drive.', 'Buscá la planilla, marcala y tocá <b>Select</b>.', 'La leemos y pasás a revisar las columnas.']) + btnP('Elegir de mi Drive', true)) },
  { t0: 4.2, t1: 9.5, at: 8.3, click: '.go', html: `<div style="position:absolute;left:700px;top:120px;width:1120px;height:820px">${picker}</div>` },
  { t0: 9.5, t1: 14, html: sheetCard(0, okLine('Listo: Ventas 2026 (1.248 filas). Pasás a revisar las columnas…')) },
], 'left:0;top:0;width:1920px;height:1080px');

/* =========================================================================
   4 · Excel en OneDrive / SharePoint (25 – 45)
   ========================================================================= */
flowScene('s4', 25, 45, lead('Excel en la nube', 'Desde OneDrive<br>o SharePoint', 'Conectás tu cuenta de Microsoft una sola vez, pegás el link del Excel y listo. También se actualiza solo.'), [
  { t0: 0, t1: 3.6, at: 2.8, click: '.go', html: sheetCard(1, stepsList(['Conectá tu cuenta de Microsoft (una sola vez).', 'En tu Excel tocá <b>Compartir → Copiar vínculo</b>.', 'Pegá el link y tocá <b>Sumar Excel</b>.']) + btnP('Conectar Microsoft')) },
  { t0: 3.6, t1: 6.2, at: 5.4, click: '.cb', html: `<div style="${AT}">${ng(XLI, 'Vincular cuenta de Microsoft Excel', 'Te conectaremos a Microsoft Excel. Se abrirá una ventana emergente, asegúrate de que tu navegador no bloquee las ventanas emergentes', 'Conectar')}</div>` },
  { t0: 6.2, t1: 9.0, at: 8.2, click: '.acc0', html: `<div style="${AT}">${winMS('Iniciar sesión en la cuenta', 'login.microsoftonline.com/common/oauth2/v2.0/authorize?…', `${msLogo}<div style="margin-top:26px;font-size:34px;font-weight:600;color:#1b1b1b">Selección de la cuenta</div><div style="margin-top:22px">${msAcc('Laura Gómez', 'laura@aurora.com.ar', 'acc0')}${msAcc('Laura Gómez', 'laura.gomez@outlook.com')}</div><div style="display:flex;gap:16px;align-items:center;padding:18px 12px;font-size:18px;color:#1b1b1b"><span style="width:44px;height:44px;border-radius:50%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:26px">+</span>Usar otra cuenta</div>`)}</div>` },
  { t0: 9.0, t1: 12.6, at: 11.8, click: '.go', html: `<div style="${AT}">${winMS('¿Permites el acceso a tu información?', 'account.live.com/Consent/Update?…', `${msLogo}<div style="margin-top:14px;font-size:17px;color:#1b1b1b">laura@aurora.com.ar</div><div style="margin-top:14px;font-size:28px;font-weight:600;color:#1b1b1b;line-height:1.25">¿Permitir que esta aplicación acceda a su información?</div><div style="margin-top:20px;font-size:18px;font-weight:700;color:#1b1b1b">BIP Connector necesita tu permiso para:</div>${[['Abrir archivos de OneDrive', 'BIP Connector podrá abrir archivos de OneDrive, incluidos los archivos que se hayan compartido contigo.'], ['Mantener el acceso a los datos a los que se ha concedido acceso a BIP Connector', 'Permite que BIP Connector vea y actualice los datos a los que se le ha concedido acceso.'], ['Leer tu perfil', 'BIP Connector podrá leer tu perfil.']].map(q => `<div style="display:flex;gap:14px;margin-top:16px">${MSI}<div><b style="display:block;font-size:17px;color:#1b1b1b">${q[0]}</b><span style="font-size:15px;color:#444;line-height:1.4">${q[1]}</span></div></div>`).join('')}`, `<div style="position:absolute;right:44px;bottom:34px;display:flex;gap:12px"><span style="background:#ccc;padding:12px 30px;font-size:16px;color:#1b1b1b">Denegar</span><span class="go" style="background:#0067b8;padding:12px 30px;font-size:16px;color:#fff">Aceptar</span></div>`)}</div>` },
  { t0: 12.6, t1: 15.0, at: 14.2, click: '.cb', html: `<div style="${AT}">${ng(XLI, '¡Éxito!', 'Has configurado exitosamente tu integración con Microsoft Excel.', 'Finalizar', true)}</div>` },
  { t0: 15.0, t1: 20, at: 17.8, click: '.go', html: sheetCard(1, `<div style="margin-top:20px;font-size:19px;color:#15803D;font-weight:600">✓ Cuenta de Microsoft conectada</div><div class="fin act" style="margin-top:14px;font-size:19px">https://aurora-my.sharepoint.com/:x:/g/Ventas-2026.xlsx</div>` + btnP('Sumar Excel')) },
], 'left:0;top:0;width:1920px;height:1080px');

/* =========================================================================
   5 · Archivo de tu computadora (45 – 53)
   ========================================================================= */
flowScene('s5', 45, 53, lead('Archivo', 'Desde tu<br>computadora', 'Un Excel o CSV. Lo elegís y listo. Para actualizarlo, subís la versión nueva.'), [
  { t0: 0, t1: 4.2, at: 3.2, click: '.go', html: sheetCard(2, stepsList(['Tocá <b>Elegir archivo</b> y buscalo en tu compu (Excel o CSV).', 'Lo leemos y pasás a revisar las columnas.']) + btnP('Elegir archivo')) },
  { t0: 4.2, t1: 8, html: sheetCard(2, `<div style="margin-top:22px;display:inline-flex;gap:14px;align-items:center;border:1.5px solid var(--line);border-radius:12px;padding:12px 18px">${XLI}<b style="font-size:20px">Ventas 2026.xlsx</b></div>` + okLine('Listo: Ventas 2026.xlsx (1.248 filas). Pasás a revisar las columnas…')) },
], 'left:0;top:0;width:1920px;height:1080px');

/* =========================================================================
   6 · Revisás las columnas (53 – 61)
   ========================================================================= */
const COLS = ['Mes', 'Canal', 'Categoría', 'Ventas $', 'Unidades', 'Share %'];
const ROWS = [['Ene 2026', 'Retail', 'Lavado', '48.200.000', '1.320', '18,4'], ['Ene 2026', 'Online', 'Lavado', '12.900.000', '355', '18,4'], ['Feb 2026', 'Retail', 'Refrigeración', '39.750.000', '810', '12,1'], ['Feb 2026', 'Online', 'Cocción', '8.420.000', '290', '9,8']];
flowScene('s6', 53, 61, lead('Paso 2', 'Revisás y<br>armamos el tablero', 'BIP reconoce solo las columnas: fechas, categorías y números. Tocás “Armar el tablero” y listo.'), [
  { t0: 0, t1: 8, at: 5.6, click: '.go', html: `<div class="pp-card" style="top:150px">
    <div style="font-size:17px;color:var(--muted);font-weight:600">Resultados Comerciales · Paso 2 de 2</div>
    <h3 style="margin-top:10px">Encontramos estas columnas en “Ventas 2026”</h3>
    <div style="margin-top:22px;border:1px solid var(--line);border-radius:14px;overflow:hidden"><table style="width:100%;border-collapse:collapse;font-size:18px">
      <tr>${COLS.map((c, i) => `<th style="text-align:left;padding:14px 16px;background:#f5f8fc;border-bottom:1px solid var(--line);font-weight:700"><span style="font-size:13px;padding:3px 7px;border-radius:6px;margin-right:8px;${i < 3 ? 'background:#eef2ff;color:#4338ca">Abc' : 'background:#ecfdf5;color:#047857">123'}</span>${c}</th>`).join('')}</tr>
      ${ROWS.map(r => `<tr>${r.map(v => `<td style="padding:12px 16px;border-bottom:1px solid #eef2f7;font-variant-numeric:tabular-nums">${v}</td>`).join('')}</tr>`).join('')}
    </table></div>
    <div style="margin-top:18px;font-size:18px;color:var(--muted)">Reconocimos la estructura de <b style="color:var(--ink)">Resultados Comerciales</b>: armamos KPIs, evolución y aperturas. Después lo podés personalizar.</div>
    ${btnP('Armar el tablero')}
  </div>` },
], 'left:0;top:0;width:1920px;height:1080px');

/* =========================================================================
   7 · Tu tablero (61 – 72)
   ========================================================================= */
const KP = [['Ventas', 109.27, 'M'], ['Unidades', 2775, ''], ['Share', 15.2, '%'], ['Índice de precio', 104, '']];
const BARS = [52, 47, 61, 58, 74, 69, 83, 79];
const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago'];
scene('s7', 61, 72, `
  ${lead('Listo', 'Tu tablero,<br>armado solo', 'Y si tu planilla está en Google Sheets o en OneDrive, se actualiza sola cada vez que la cambiás.')}
  <div class="pp-card" style="height:640px">
    <h3>Resultados Comerciales · Aurora</h3>
    <div class="sub">Desde tu planilla “Ventas 2026” · se actualiza sola</div>
    <div class="pill-il">Datos ilustrativos</div>
    <div class="kg">${KP.map(k => `<div class="kc"><div class="l">${k[0]}</div><div class="v">0</div><div class="d">▲ vs mes anterior</div></div>`).join('')}</div>
    <div class="chart">${BARS.map((b, i) => `<div class="bar" style="height:0"><b>${MES[i]}</b></div>`).join('')}</div>
  </div>`,
  (node) => {
    const card = node.querySelector('.pp-card'), vs = [...node.querySelectorAll('.kc .v')], ds = [...node.querySelectorAll('.kc .d')], bars = [...node.querySelectorAll('.bar')];
    return (lt) => {
      leadIn(node, lt); inUp(card, eo(S(lt, .15, .8)), 30);
      KP.forEach((k, i) => {
        const p = eo(S(lt, 1 + i * .25, 2.6 + i * .25));
        vs[i].textContent = k[2] === 'M' ? `$${nf(k[1] * p, 1)}M` : k[2] === '%' ? `${nf(k[1] * p, 1)}%` : nf(Math.round(k[1] * p));
        ds[i].style.opacity = S(lt, 2.6 + i * .25, 3 + i * .25);
      });
      bars.forEach((b, i) => { b.style.height = (BARS[i] * 1.7 * eo(S(lt, 1.4 + i * .12, 2.4 + i * .12))) + 'px'; });
    };
  });

/* =========================================================================
   8 · Cierre (72 – 80)
   ========================================================================= */
scene('s8', 72, 80, `
  <div class="out-wrap"></div>
  <div class="out-copy">
    <h1>Listo. <span class="grad" style="background-image:linear-gradient(92deg,#0a4da0,#12a6f4)">Tus datos, juntos.</span></h1><p style="margin-top:26px;font-size:34px;color:var(--muted);font-weight:500;text-align:center">Ahora podés cruzar tus resultados con tu marketing<br>y decidir mejor.</p>
    <div class="cta">bip-go.com</div>
  </div>
  <div class="out-foot"><div class="logo"><div class="bip">BIP<span class="tri"></span></div><div class="tag">Business<br>Impact<br>Platform</div></div></div>`,
  (node) => {
    const h = node.querySelector('h1'), pp = node.querySelector('.out-copy p'), c = node.querySelector('.cta'), f = node.querySelector('.out-foot');
    return (lt) => { inUp(h, eo(S(lt, .1, .9)), 30); inUp(pp, eo(S(lt, .4, 1.1)), 20); inUp(c, eo(S(lt, .8, 1.5)), 20); inUp(f, eo(S(lt, 1.2, 1.8)), 14); };
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
