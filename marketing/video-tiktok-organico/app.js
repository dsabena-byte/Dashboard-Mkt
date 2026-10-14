/* =========================================================================
   Video prototipo "BIP × TikTok Accounts API" — para el Accounts API Access Application Form (pregunta 8).
   Muestra el flujo planeado: conectar TikTok (OAuth, solo lectura) → perfil + insights de cuenta →
   videos + insights → sentimiento de comentarios → desconectar. Cada escena nombra el scope que usa.
   Marca ficticia "Aurora Cosmetics"; datos ilustrativos. En inglés (lo revisa TikTok).
   ========================================================================= */
const DUR = 52;
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
const lead = (step, h2, p, scope) => `<div class="lead" style="top:230px"><div class="step">${step}</div><h2>${h2}</h2><p>${p}</p>${scope ? `<div class="scope">${scope}</div>` : ''}</div>`;
function leadIn(node, lt) {
  const l = node.querySelector('.lead');
  [...l.children].forEach((c, i) => inUp(c, eo(S(lt, .1 + i * .18, .8 + i * .18)), 26));
}
const ab = (el) => { const r = el.getBoundingClientRect(), st = stage.getBoundingClientRect(); return { x: r.left - st.left + r.width / 2, y: r.top - st.top + r.height / 2 }; };
const card = (top, inner) => `<div class="pp-card" style="top:${top}px">${inner}</div>`;
const url = (path) => `<div style="display:flex;align-items:center;gap:10px;font-size:15px;color:var(--muted);font-weight:600;margin:-10px 0 14px"><span style="width:10px;height:10px;border-radius:50%;background:#16a34a"></span>bip-go.com${path}</div>`;
const TT = `<span class="ttl">TikTok</span>`;
const kc = (l, v, d) => `<div class="kc"><div class="l">${l}</div><div class="v">${v}</div>${d ? `<div class="d">${d}</div>` : ''}</div>`;
const CSS = `<style>
  .scope{margin-top:26px;display:inline-block;font-family:ui-monospace,Menlo,monospace;font-size:18px;font-weight:600;color:#334155;background:#fff;border:1.5px solid var(--line);border-radius:12px;padding:12px 16px;line-height:1.6}
  .ttl{font-family:var(--disp);font-weight:800;color:#111;letter-spacing:-.02em}
  .src{display:flex;align-items:center;gap:18px;padding:18px 20px;border:1px solid var(--line);border-radius:16px;margin-top:14px;background:#fff}
  .src .lg{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:20px;font-family:var(--disp)}
  .src b{font-size:22px;font-family:var(--disp)} .src span{display:block;font-size:17px;color:var(--muted);font-weight:500;margin-top:2px}
  .src .st{margin-left:auto;font-size:17px;font-weight:700;padding:8px 14px;border-radius:999px}
  .src .ok{background:var(--green-s);color:#15803d;display:inline-block;margin-top:0} .src .cn{background:var(--pri);color:#fff;padding:12px 22px!important;border-radius:11px!important;font-size:19px!important}
  .tt{position:absolute;left:820px;top:90px;width:620px;height:880px;background:#fff;border-radius:18px;box-shadow:0 40px 90px rgba(16,32,46,.28);border:1px solid #d6dbe3;overflow:hidden}
  .tt .bar{height:42px;background:#eef1f5;display:flex;align-items:center;padding:0 16px;font-size:15px;color:#4b5563;gap:8px}
  .tt .bd{padding:34px 44px}
  .tt h5{font-size:27px;font-weight:700;color:#161823;line-height:1.3;margin-top:22px;font-family:var(--font)}
  .tt .who{display:flex;align-items:center;gap:14px;margin-top:22px;padding:14px 16px;border-radius:12px;background:#f6f7f9;font-size:18px;font-weight:600}
  .tt .who i{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#f9a8d4,#c084fc)}
  .tt .pm{display:flex;gap:14px;align-items:flex-start;padding:13px 0;border-bottom:1px solid #eceef1}
  .tt .pm u{text-decoration:none;width:24px;height:24px;border-radius:6px;background:#161823;color:#fff;flex:0 0 24px;display:flex;align-items:center;justify-content:center;margin-top:2px}
  .tt .pm u svg{width:15px;height:15px}
  .tt .pm b{font-size:18px;font-weight:600;color:#161823;display:block} .tt .pm span{font-size:15px;color:#6b7280;display:block;margin-top:2px}
  .tt .bt{position:absolute;left:44px;right:44px;bottom:34px;display:flex;gap:14px}
  .tt .bt div{flex:1;height:56px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:700}
  .tt .no{background:#f1f1f2;color:#161823} .tt .yes{background:#fe2c55;color:#fff}
  .vg{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:18px}
  .vd{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff}
  .vd .th{height:250px;position:relative}
  .vd .th em{position:absolute;left:10px;bottom:10px;font-style:normal;color:#fff;font-weight:700;font-size:17px;text-shadow:0 1px 4px rgba(0,0,0,.5)}
  .vd .mt{padding:12px 14px;font-size:14px;color:#334155;line-height:1.7}
  .vd .mt b{font-weight:700}
  .sb{display:flex;height:14px;border-radius:999px;overflow:hidden;margin-top:8px}
  .cm{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid #eef3f9;font-size:18px}
  .cm i{width:12px;height:12px;border-radius:50%;flex:0 0 12px;margin-top:7px}
</style>`;
stage.insertAdjacentHTML('beforeend', CSS);

/* 1 · Intro (0 – 3.5) */
scene('s1', 0, 3.5, `
  <div class="dark" style="position:absolute;inset:0"></div>
  <div class="hero-glow"></div>
  <div class="logo on-dark intro-logo"><div class="bip">BIP<span class="tri"></span></div><div class="tag">Business<br>Impact<br>Platform</div></div>
  <div class="hero-copy">
    <div class="eyebrow">Prototype · TikTok Accounts API</div>
    <h1>Your TikTok results,<br><span class="grad">next to every channel.</span></h1>
    <p>Planned read-only integration. Illustrative data (fictional brand).</p>
  </div>`,
  (node) => {
    const logo = node.querySelector('.logo');
    const parts = [node.querySelector('.eyebrow'), node.querySelector('h1'), node.querySelector('.hero-copy p')];
    return (lt) => { inUp(logo, eo(S(lt, 0, .4)), 20); parts.forEach((p, i) => inUp(p, eo(S(lt, .15 + i * .15, .7 + i * .15)), 30)); };
  });

/* 2 · Conectar TikTok (3.5 – 10) */
scene('s2', 3.5, 10, `
  ${lead('Step 1', 'The brand connects<br>its TikTok account', 'From Data sources in BIP. Each brand connects only its own account, via TikTok OAuth.')}
  ${card(170, `${url('/conexiones')}<h3>Data sources</h3><div class="sub">Connect your accounts. BIP only reads your metrics.</div>
    <div class="src"><span class="lg" style="background:#1877f2">f</span><div><b>Meta</b><span>Facebook & Instagram</span></div><span class="st ok">Connected</span></div>
    <div class="src"><span class="lg" style="background:#4285f4">G</span><div><b>Google</b><span>Analytics, Ads, Search Console</span></div><span class="st ok">Connected</span></div>
    <div class="src"><span class="lg" style="background:#161823">♪</span><div><b>TikTok</b><span>Organic: profile, videos, comments (read-only)</span></div><span class="st cn go">Connect TikTok</span></div>`)}`,
  (node) => {
    const c = node.querySelector('.pp-card'), go = node.querySelector('.go');
    return (lt, a) => {
      leadIn(node, lt); inUp(c, eo(S(lt, 0, .4)), 30);
      const q = ab(go);
      runCursor([{ t: .6, x: 1500, y: 960 }, { t: 4.6, x: q.x, y: q.y, click: 1 }, { t: 6.5, x: q.x, y: q.y }], lt, a);
      go.style.filter = lt > 4.55 && lt < 4.8 ? 'brightness(1.2)' : 'none';
    };
  });

/* 3 · Pantalla de autorización de TikTok (10 – 19) */
const PERMS = [
  ['Read your profile info', 'Name, username, avatar, account type', 'user.info.basic · user.info.username · user.info.profile · user.account.type'],
  ['Read your account stats', 'Followers, likes, number of videos', 'user.info.stats'],
  ['Read your account insights', 'Daily views, profile views, follower growth', 'user.insights'],
  ['Read your videos and their insights', 'Views, reach, likes, comments, shares, watch time', 'video.list · video.insights'],
  ['Read comments on your videos', 'To show sentiment. No replies, hiding or deleting', 'comment.list'],
];
scene('s3', 10, 19, `
  ${lead('Step 2', 'TikTok asks<br>for consent', 'The brand reviews the read-only permissions and authorizes. It can revoke access at any time.')}
  <div class="tt"><div class="bar">TikTok authorization screen (illustration)</div><div class="bd">
    <div style="font-size:24px">${TT}</div>
    <h5>BIP wants to access your TikTok account</h5>
    <div class="who"><i></i>@auroracosmetics · Business account</div>
    <div style="margin-top:14px">${PERMS.map(p => `<div class="pm"><u>${ICON.check}</u><div><b>${p[0]}</b><span>${p[1]}</span></div></div>`).join('')}</div>
  </div><div class="bt"><div class="no">Cancel</div><div class="yes">Authorize</div></div></div>`,
  (node) => {
    const w = node.querySelector('.tt'), pm = [...node.querySelectorAll('.pm')], yes = node.querySelector('.yes');
    return (lt, a) => {
      leadIn(node, lt); inUp(w, eo(S(lt, 0, .45)), 30);
      pm.forEach((el, i) => inUp(el, eo(S(lt, .7 + i * .35, 1.2 + i * .35)), 10));
      const q = ab(yes);
      runCursor([{ t: 1, x: 1700, y: 700 }, { t: 3.4, x: 1150, y: 560 }, { t: 7.4, x: q.x, y: q.y, click: 1 }, { t: 9, x: q.x, y: q.y }], lt, a);
      yes.style.filter = lt > 7.35 && lt < 7.6 ? 'brightness(1.15)' : 'none';
    };
  });

/* 4 · Conectado + perfil e insights de cuenta (19 – 29) */
const VIEWS = [42, 55, 48, 63, 71, 66, 84, 92];
const MESES = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
scene('s4', 19, 29, `
  ${lead('Step 3', 'Profile and<br>account insights', 'Followers, likes and daily account metrics, shown as monthly trends against the brand’s goals.', 'user.info.* · user.account.type<br>user.insights')}
  ${card(110, `${url('/redes?red=tiktok')}<div class="note" style="margin-top:0">✓ TikTok connected: @auroracosmetics (read-only)</div>
    <div style="display:flex;align-items:center;gap:18px;margin-top:20px"><span style="width:66px;height:66px;border-radius:50%;background:linear-gradient(135deg,#f9a8d4,#c084fc)"></span>
      <div><b style="font-size:26px;font-family:var(--disp)">Aurora Cosmetics</b><div style="font-size:18px;color:var(--muted)">@auroracosmetics · Business account</div></div></div>
    <div class="kg">${kc('Followers', '48.2K', '+3.1% vs Aug')}${kc('Total likes', '612K', '+5.4% vs Aug')}${kc('Videos', '214', '+12 in Sep')}${kc('Profile views (Sep)', '9,840', '+8.0% vs Aug')}</div>
    <div style="margin-top:22px;font-size:20px;font-weight:700">Video views per month (thousands)</div>
    <div class="chart" style="height:230px">${VIEWS.map((v, i) => `<div class="bar" data-h="${v}"><b>${MESES[i]}</b></div>`).join('')}</div>`)}`,
  (node) => {
    const c = node.querySelector('.pp-card'), bars = [...node.querySelectorAll('.chart .bar')], kcs = [...node.querySelectorAll('.kc')];
    return (lt) => {
      leadIn(node, lt); inUp(c, eo(S(lt, 0, .4)), 30);
      kcs.forEach((k, i) => inUp(k, eo(S(lt, .8 + i * .15, 1.3 + i * .15)), 12));
      bars.forEach((b, i) => { b.style.height = b.dataset.h * 1.8 * eo(S(lt, 1.6 + i * .1, 2.6 + i * .1)) + 'px'; });
    };
  });

/* 5 · Videos + insights (29 – 38) */
const VIDS = [
  ['#fbcfe8', '#f472b6', 'SPF routine in 30s', '128K', '9.4K', '412', '1.1K', '14s'],
  ['#ddd6fe', '#8b5cf6', 'New serum unboxing', '86K', '6.1K', '233', '640', '11s'],
  ['#fed7aa', '#fb923c', 'Behind the lab', '41K', '2.2K', '98', '180', '9s'],
  ['#bbf7d0', '#34d399', 'Customer Q&A', '23K', '1.4K', '161', '75', '7s'],
];
scene('s5', 29, 38, `
  ${lead('Step 4', 'Videos and<br>their performance', 'The brand’s own videos with their metrics, to see which content to repeat and which to stop.', 'video.list · video.insights')}
  ${card(150, `${url('/redes?red=tiktok')}<h3>Your TikTok videos · September</h3><div class="sub">Sorted by views</div>
    <div class="vg">${VIDS.map(v => `<div class="vd"><div class="th" style="background:linear-gradient(160deg,${v[0]},${v[1]})"><em>▶ ${v[3]}</em></div>
      <div class="mt"><b style="font-size:16px">${v[2]}</b><br>Views <b>${v[3]}</b> · Likes <b>${v[4]}</b><br>Comments <b>${v[5]}</b> · Shares <b>${v[6]}</b><br>Avg. watch time <b>${v[7]}</b></div></div>`).join('')}</div>`)}`,
  (node) => {
    const c = node.querySelector('.pp-card'), vds = [...node.querySelectorAll('.vd')];
    return (lt, a) => {
      leadIn(node, lt); inUp(c, eo(S(lt, 0, .4)), 30);
      vds.forEach((v, i) => inUp(v, eo(S(lt, .6 + i * .25, 1.2 + i * .25)), 16));
      const q = ab(vds[0]);
      runCursor([{ t: 1.5, x: 1600, y: 980 }, { t: 3.6, x: q.x, y: q.y + 60 }, { t: 6, x: q.x + 250, y: q.y + 60 }, { t: 8, x: q.x + 250, y: q.y + 60 }], lt, a);
    };
  });

/* 6 · Sentimiento de comentarios (38 – 46) */
const SENT = [['SPF routine in 30s', 72, 21, 7], ['New serum unboxing', 64, 28, 8], ['Behind the lab', 58, 35, 7], ['Customer Q&A', 41, 33, 26]];
scene('s6', 38, 46, `
  ${lead('Step 5', 'What people say<br>about each video', 'Comments on the brand’s own videos are read to show sentiment. BIP never replies, hides or deletes comments.', 'comment.list (read-only)')}
  ${card(150, `${url('/redes?red=tiktok')}<h3>Comment sentiment per video</h3><div class="sub">Positive · Neutral · Negative</div>
    ${SENT.map(s => `<div class="se" style="margin-top:18px"><div style="display:flex;justify-content:space-between;font-size:19px;font-weight:600"><span>${s[0]}</span><span style="color:#15803d">${s[1]}% positive</span></div>
      <div class="sb"><i style="background:#16a34a;width:0" data-w="${s[1]}"></i><i style="background:#cbd5e1;width:0" data-w="${s[2]}"></i><i style="background:#dc2626;width:0" data-w="${s[3]}"></i></div></div>`).join('')}
    <div style="margin-top:24px;padding:16px 18px;border-radius:14px;background:#f2f7fc;font-size:19px;line-height:1.5;color:#334155"><b>Customer Q&A:</b> most negative comments ask about delivery times → answer that in the next video.</div>`)}`,
  (node) => {
    const c = node.querySelector('.pp-card'), ses = [...node.querySelectorAll('.se')];
    return (lt) => {
      leadIn(node, lt); inUp(c, eo(S(lt, 0, .4)), 30);
      ses.forEach((s, i) => { inUp(s, eo(S(lt, .6 + i * .2, 1.1 + i * .2)), 10); [...s.querySelectorAll('i')].forEach(b => { b.style.width = b.dataset.w * eo(S(lt, 1 + i * .2, 2 + i * .2)) + '%'; }); });
    };
  });

/* 7 · Solo lectura + desconectar (46 – 50) */
scene('s7', 46, 50, `
  ${lead('Always', 'Read-only.<br>Revocable anytime.', 'BIP never posts, edits or deletes content. Disconnecting removes access immediately; it can also be revoked from the TikTok app.')}
  ${card(250, `${url('/conexiones')}<h3>Data sources</h3>
    <div class="src"><span class="lg" style="background:#161823">♪</span><div><b>TikTok · @auroracosmetics</b><span>Read-only access: profile, insights, videos, comments</span></div><span class="st ok">Connected</span></div>
    <div style="display:flex;justify-content:flex-end;margin-top:18px"><span class="dc" style="font-size:19px;font-weight:700;color:#dc2626;border:2px solid #fecaca;border-radius:11px;padding:12px 22px">Disconnect TikTok</span></div>`)}`,
  (node) => {
    const c = node.querySelector('.pp-card'), dc = node.querySelector('.dc');
    return (lt, a) => {
      leadIn(node, lt); inUp(c, eo(S(lt, 0, .4)), 30);
      const q = ab(dc);
      runCursor([{ t: .5, x: 1500, y: 980 }, { t: 2.2, x: q.x, y: q.y }, { t: 4, x: q.x, y: q.y }], lt, a);
    };
  });

/* 8 · Cierre (50 – 52) */
scene('s8', 50, 52, `
  <div class="out-wrap"></div>
  <div class="out-copy">
    <h1>Read-only <span class="grad" style="background-image:linear-gradient(92deg,#0a4da0,#12a6f4)">TikTok insights</span></h1><p style="margin-top:26px;font-size:32px;color:var(--muted);font-weight:500;text-align:center">bip-go.com · by Roque Research Solutions (roque-in.com)<br>Prototype of the planned integration · illustrative data</p>
  </div>
  <div class="out-foot"><div class="logo"><div class="bip">BIP<span class="tri"></span></div><div class="tag">Business<br>Impact<br>Platform</div></div></div>`,
  (node) => {
    const h = node.querySelector('h1'), pp = node.querySelector('.out-copy p'), f = node.querySelector('.out-foot');
    return (lt) => { inUp(h, eo(S(lt, .1, .6)), 30); inUp(pp, eo(S(lt, .3, .8)), 20); inUp(f, eo(S(lt, .5, 1)), 14); };
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
