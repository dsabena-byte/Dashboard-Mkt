/* =========================================================================
   BIP · «¿Qué movió la aguja?» — 30 s, 4:5 (1080×1350), sin locución.
   Animación determinística: todo el estado sale de window.__seek(t).
   window.__AUDIO lista los eventos de sonido para que render.mjs arme la pista.
   Datos ilustrativos: ninguna cifra es de un cliente real.
   ========================================================================= */
const DUR = 30.0;
const T = { cover: 1.0, h2: 3.6, tri: 3.0, touch: 6.55, bip: 7.12, q: 7.35, light: 9.0 };

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const S = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const eo = p => 1 - Math.pow(1 - p, 3);
const eio = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const lerp = (a, b, p) => a + (b - a) * p;
const $ = id => document.getElementById(id);
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647, (seed - 1) / 2147483646); }

/* ---------- el ruido: piezas de reportes que se contradicen ---------- */
const SRC = [
  ['Meta Ads', '#1877f2'], ['GA4', '#e8710a'], ['Google Ads', '#34a853'], ['Agencia de medios', '#7c3aed'],
  ['Redes · Instagram', '#d6249f'], ['Planilla de ventas', '#16a34a'], ['Search Console', '#4285f4'], ['Estudio de marca', '#0ea5e9'],
];
const KPI = [
  ['Alcance', '2,4M', '+18%', 1], ['Ventas', '$ 41,2M', '−12%', 0], ['CTR', '0,9%', '−0,3 pp', 0], ['ROAS', '3,2x', '+0,4', 1],
  ['Engagement', '1,8%', '−7%', 0], ['Tráfico web', '318K', '+24%', 1], ['Sesiones', '96K', '−9%', 0], ['Conversión', '2,1%', '+0,2 pp', 1],
  ['CPM', '$ 1.240', '+31%', 0], ['Seguidores', '129K', '+2%', 1], ['Rebote', '58%', '+6 pp', 0], ['Leads', '1.204', '−15%', 0],
];
const FILES = [['Reporte_agencia_Q3.pdf', 'PDF', '#dc2626'], ['Pauta_Q2.pdf', 'PDF', '#dc2626'], ['Meta Ads.xlsx', 'XLS', '#16a34a'],
  ['GA4 export.csv', 'CSV', '#475569'], ['Kantar_marca.pptx', 'PPT', '#ea580c'], ['Presupuesto.xlsx', 'XLS', '#16a34a'], ['Redes_sept.xlsx', 'XLS', '#16a34a']];
const TOASTS = ['Nuevo reporte de la agencia', 'El alcance subió 18%', 'Las ventas bajaron 12%', 'Alerta: CPM +31%', 'Reunión: revisión de KPIs',
  '3 dashboards actualizados', 'El CTR cayó', 'Nuevo export de GA4', '¿Lo vemos en la reunión?', 'Reporte semanal listo'];

const N = 46, pieces = [], AUDIO = [];
const SCENE_AUDIO = [];
(function build() {
  const r = rng(20261014), host = $('noise');
  for (let i = 0; i < N; i++) {
    const kind = i % 5 === 1 ? 'file' : i % 5 === 3 ? 'toast' : 'card';
    let el;
    if (kind === 'card') {
      const k = KPI[(i * 7) % KPI.length], s = SRC[(i * 3) % SRC.length], up = k[3];
      el = document.createElement('div'); el.className = 'card';
      el.innerHTML = `<div class="src"><i style="background:${s[1]}"></i>${s[0]}</div><div class="big">${k[1]}</div><div class="lbl">${k[0]}</div><div class="chg" style="color:${up ? 'var(--up)' : 'var(--dn)'}">${up ? '▲' : '▼'} ${k[2]}</div>`;
    } else if (kind === 'file') {
      const f = FILES[i % FILES.length]; el = document.createElement('div'); el.className = 'file';
      el.innerHTML = `<b style="background:${f[2]}">${f[1]}</b>${f[0]}`;
    } else {
      const tx = TOASTS[i % TOASTS.length]; el = document.createElement('div'); el.className = 'toast';
      el.innerHTML = `<i style="background:${/bajaron|cayó|Alerta/.test(tx) ? 'var(--dn)' : 'var(--cyan)'}"></i>${tx}`;
    }
    // aparecen cada vez más rápido (t_i ∝ √i) entre 1,15 s y 6,9 s
    const t = T.cover + 0.15 + 5.75 * Math.sqrt(i / (N - 1));
    const x = 40 + r() * 760, y = 330 + r() * 900, rot = (r() - .5) * 9;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    host.appendChild(el);
    pieces.push({ el, t, rot, x, y });
    AUDIO.push({ t, type: 'ping', f: [660, 880, 988, 1175, 1397, 784][i % 6], v: 0.35 + 0.35 * (i / N) });
  }
  AUDIO.push({ t: T.cover, type: 'hum_start' });
  AUDIO.push({ t: T.bip, type: 'bip' });
  AUDIO.push({ t: T.light, type: 'pad_start' });
  AUDIO.push(...SCENE_AUDIO);
})();

function seek(t) {
  /* portada: la pregunta sola (es la miniatura del chat) */
  const cover = t < T.cover;
  const qBack = S(t, T.q, T.q + .45);
  const q = $('q');
  if (cover) { q.style.opacity = 1; q.style.transform = 'none'; q.style.color = '#fff'; }
  else if (t >= T.q) {
    const up = eio(S(t, T.light, T.light + 1));
    q.style.opacity = eo(qBack) * (1 - S(t, 9.9, 10.25)); q.style.color = up > .5 ? 'var(--ink)' : '#fff';
    q.style.transform = `translateY(${lerp(12 * (1 - eo(qBack)), -380, up)}px) scale(${lerp(1, .78, up)})`;
    q.style.transformOrigin = 'left top';
  } else q.style.opacity = 0;
  $('logoSmall').style.opacity = cover ? 1 : 0;

  /* ruido */
  const noiseOn = t >= T.cover && t < T.bip;
  const shake = noiseOn ? Math.pow(S(t, 4.5, T.bip), 2) : 0;
  const r = rng(Math.floor(t * 30) + 7);
  $('noise').style.transform = shake ? `translate(${(r() - .5) * 14 * shake}px,${(r() - .5) * 14 * shake}px)` : 'none';
  for (const p of pieces) {
    const a = noiseOn ? eo(S(t, p.t, p.t + .16)) : 0;
    p.el.style.opacity = a;
    p.el.style.transform = `rotate(${p.rot}deg) scale(${lerp(.86, 1, a)})`;
  }
  $('scrim').style.opacity = noiseOn ? 1 : 0;
  $('h1').style.opacity = noiseOn && t < T.h2 ? eo(S(t, T.cover + .05, T.cover + .3)) : 0;
  $('h2').style.opacity = noiseOn && t >= T.h2 ? 1 : 0;

  /* el botón BIP: el triángulo del logo late en medio del caos */
  const triIn = eo(S(t, T.tri, T.tri + .35));
  const triOut = S(t, T.bip + .25, T.bip + .7);
  const press = t >= T.touch + .4 && t < T.bip ? .9 : 1;
  const triOn = t >= T.tri && triOut < 1;
  $('tri').style.opacity = triOn ? triIn * (1 - triOut) : 0;
  $('tri').style.transform = `scale(${(.6 + .4 * triIn) * press * (1 - .4 * triOut)})`;
  $('halo').style.opacity = noiseOn && t >= T.tri ? triIn : 0;
  const ph = ((t - T.tri) % 1.1) / 1.1;
  const pu = $('pulse').firstElementChild;
  pu.style.opacity = noiseOn && t >= T.tri + .35 ? (1 - ph) * .7 : 0;
  pu.style.transform = `scale(${1 + ph * .9})`;

  /* el toque */
  const tc = $('touch');
  if (t >= T.touch && t < T.bip + .2) {
    const m = eio(S(t, T.touch, T.touch + .4));
    const x = lerp(860, 480, m), y = lerp(1300, 1016, m);
    tc.style.opacity = t < T.bip ? eo(S(t, T.touch, T.touch + .15)) : 1 - S(t, T.bip, T.bip + .2);
    tc.style.transform = `translate(${x}px,${y}px) scale(${press < 1 ? .82 : 1})`;
  } else tc.style.opacity = 0;

  /* bip: un anillo cyan barre la pantalla y el ruido desaparece en el mismo cuadro */
  const rp = S(t, T.bip, T.bip + .55);
  const ri = $('ring').firstElementChild;
  const R = lerp(70, 1900, eo(rp));
  ri.style.width = ri.style.height = 2 * R + 'px'; ri.style.left = ri.style.top = -R + 'px';
  ri.style.opacity = t >= T.bip && rp < 1 ? 1 - rp : 0;
  ri.style.borderWidth = lerp(14, 2, rp) + 'px';
  const on = S(t, T.bip, T.bip + .08), off = S(t, T.bip + .45, T.bip + .75);
  $('onoma').style.opacity = t >= T.bip ? on * (1 - off) : 0;
  $('onoma').style.transform = `translateY(${-10 * on}px)`;

  /* claridad: el fondo se aclara para lo que sigue */
  $('bgLight').style.opacity = eio(S(t, T.light, T.light + 1));
  $('fade').style.opacity = 0;
  scenes(t);
}

/* =========================================================================
   10–30 s: la claridad. Mapa → Copiloto → Guiame paso a paso → Seguimiento → placa.
   ========================================================================= */
const SC = { mapa: [10.0, 14.6], cop: [14.6, 19.2], guia: [19.2, 23.2], seg: [23.2, 26.0], end: 26.0, bip2: 26.75 };

/* --- Mapa Estratégico --- */
const KPIS = [['Alcance único', '15%'], ['Frecuencia', '15%'], ['Impresiones', '14%'], ['VTR (≥50%)', '14%'], ['Tráfico web', '16%'], ['Floor Share', '10%']];
const OBJS = [['TOM', '#0a4da0'], ['SOM', '#16a34a'], ['Intención de Compra', '#d97706'], ['Poder de Marca', '#12a6f4']];
const LINKS = [[0, 0], [1, 0], [2, 1], [3, 2], [4, 2], [4, 1], [5, 3], [3, 3]];
const KY = i => 140 + i * 118, OY = i => 170 + i * 168;
(function buildMapa() {
  const m = $('mapaBody');
  m.innerHTML = KPIS.map((k, i) => `<div class="kpi" style="top:${KY(i)}px"><span>${k[0]}</span><b>${k[1]}</b></div>`).join('') +
    OBJS.map((o, i) => `<div class="obj" style="top:${OY(i)}px;border-left-color:${o[1]}"><span>${o[0]}</span><b>25%</b></div>`).join('') +
    `<svg class="links" viewBox="0 0 912 860">${LINKS.map(([k, o]) => {
      const y1 = KY(k) + 34, y2 = OY(o) + 44;
      return `<path d="M392 ${y1} C 520 ${y1}, 500 ${y2}, 548 ${y2}" stroke="${OBJS[o][1]}" />`;
    }).join('')}</svg>`;
  LINKS.forEach((_, i) => AUDIO.push({ t: SC.mapa[0] + .9 + i * .38, type: 'tick', f: 1046 + i * 60 }));
})();

/* --- Copiloto --- */
const ANSWER = [['La ', 0], ['pauta en YouTube', 1], [' subió el ', 0], ['VTR a 30,6%', 1], [', que empujó la ', 0], ['Intención de Compra +2,1 pts', 1], [' y arrastró la ', 0], ['facturación de Refrigeración +9%', 1], ['.', 0]];
const ANS_LEN = ANSWER.reduce((a, s) => a + s[0].length, 0);
function answerHtml(n) {
  let out = '', left = n;
  for (const [s, b] of ANSWER) { if (left <= 0) break; const part = s.slice(0, left); left -= s.length; out += b ? `<b>${part}</b>` : part; }
  return out + (n < ANS_LEN ? '<i class="caret"></i>' : '');
}

/* --- Guiame paso a paso --- */
const STEPS = ['Pedile a la agencia pasar $2M de Display a YouTube.', 'Usá los 2 videos con mejor VTR.', 'En 7 días, mirá el VTR en Plan de Medios.'];
const STEP_T = [20.0, 20.6, 21.2], PRESS = 22.05;
STEP_T.forEach(t => AUDIO.push({ t, type: 'tick', f: 1318 }));
AUDIO.push({ t: PRESS, type: 'click' });

/* --- Seguimiento --- */
const SEGS = [['TOM', '31,5', '31,4'], ['SOM', '58,7', '58,6'], ['Intención de Compra', '34,2', '34,1'], ['Poder de Marca', '15,6', '15,5']];
(function buildSeg() {
  $('segBody').innerHTML = SEGS.map(s => `<div class="sg"><div class="sgh"><span>${s[0]}</span><em></em></div>
    <div class="sgv"><b>${s[1]}</b> / ${s[2]}</div><div class="sgbar"><i></i></div><div class="sgp">0%</div></div>`).join('');
  AUDIO.push({ t: SC.seg[0] + 1.6, type: 'chime' });
})();
AUDIO.push({ t: SC.bip2, type: 'bip' }, { t: SC.bip2, type: 'final' });

function sceneAlpha(t, [a, b], fi = .35, fo = .3) { return Math.min(eo(S(t, a, a + fi)), 1 - S(t, b - fo, b)); }
function show(id, a, dy = 26) { const e = $(id); e.style.opacity = a; e.style.transform = `translateY(${(1 - a) * dy}px)`; }

function scenes(t) {
  const lightUI = t >= SC.mapa[0] - .2 && t < SC.end + .3;
  $('ilus').style.opacity = lightUI ? Math.min(S(t, 10.2, 10.5), 1 - S(t, SC.end - .1, SC.end + .2)) : 0;

  /* Mapa */
  const am = sceneAlpha(t, SC.mapa);
  show('hMapa', t < SC.mapa[1] ? eo(S(t, 10.0, 10.4)) * (1 - S(t, SC.mapa[1] - .3, SC.mapa[1])) : 0);
  show('mapa', am, 40);
  const paths = $('mapaBody').querySelectorAll('path');
  paths.forEach((p, i) => {
    const L = p.__L || (p.__L = p.getTotalLength()); p.style.strokeDasharray = L;
    const d = eio(S(t, SC.mapa[0] + .9 + i * .38, SC.mapa[0] + 1.35 + i * .38)); p.style.strokeDashoffset = L * (1 - d);
  });
  $('mapaBody').querySelectorAll('.kpi').forEach((k, i) => {
    const first = LINKS.findIndex(l => l[0] === i);
    k.classList.toggle('on', t >= SC.mapa[0] + 1.1 + first * .38);
  });
  $('mapaBody').querySelectorAll('.obj').forEach((o, i) => {
    const last = LINKS.map((l, j) => l[1] === i ? j : -1).filter(j => j >= 0).pop();
    o.classList.toggle('on', t >= SC.mapa[0] + 1.35 + last * .38);
  });

  /* Copiloto */
  const ac = sceneAlpha(t, SC.cop);
  show('hCop', ac); show('cop', ac, 40);
  show('ubub', eo(S(t, 15.1, 15.4)), 14);
  show('abox', eo(S(t, 15.7, 15.95)), 14);
  $('ans').innerHTML = answerHtml(Math.round(ANS_LEN * S(t, 15.9, 18.3)));

  /* Guía */
  const ag = sceneAlpha(t, SC.guia);
  show('hGuia', ag); show('guia', ag, 40);
  $('guia').querySelectorAll('.st').forEach((s, i) => {
    show(s.id, eo(S(t, STEP_T[i] - .25, STEP_T[i])), 12);
    s.classList.toggle('done', t >= STEP_T[i] + .25);
  });
  const btn = $('btnDo');
  show('btns', eo(S(t, 21.5, 21.75)), 10);
  btn.classList.toggle('ok', t >= PRESS + .1);
  btn.innerHTML = t >= PRESS + .1 ? '✓ En Mis acciones' : 'La voy a hacer';
  const t2 = $('touch2');
  if (t >= 21.6 && t < PRESS + .45) {
    const m = eio(S(t, 21.6, PRESS - .05));
    t2.style.opacity = t < PRESS + .2 ? eo(S(t, 21.6, 21.75)) : 1 - S(t, PRESS + .2, PRESS + .45);
    t2.style.transform = `translate(${lerp(900, 250, m)}px,${lerp(1330, 1018, m)}px) scale(${t >= PRESS - .05 && t < PRESS + .12 ? .82 : 1})`;
  } else t2.style.opacity = 0;

  /* Seguimiento */
  const as = sceneAlpha(t, SC.seg, .35, .25);
  show('hSeg', as); show('seg', as, 40); show('sign', eo(S(t, 24.4, 24.7)) * (1 - S(t, SC.seg[1] - .25, SC.seg[1])), 10);
  const fill = eio(S(t, 23.6, 24.8));
  $('segBody').querySelectorAll('.sg').forEach(g => {
    g.querySelector('.sgbar i').style.width = (fill * 100).toFixed(1) + '%';
    g.querySelector('.sgp').textContent = Math.round(fill * 101) + '%';
    g.querySelector('em').style.background = fill < .9 ? 'var(--mid)' : 'var(--up)';
    g.classList.toggle('met', fill >= 1);
  });

  /* Placa final: «bip» se vuelve el logo */
  $('navy').style.opacity = eio(S(t, SC.end - .15, SC.end + .35));
  const w = $('word'), lg = $('logoBig');
  const wIn = eo(S(t, 26.25, 26.5)), morph = eio(S(t, SC.bip2, SC.bip2 + .45));
  w.style.opacity = t >= 26.25 ? wIn * (1 - S(t, SC.bip2, SC.bip2 + .2)) : 0;
  w.style.transform = `translate(-50%,-50%) scale(${lerp(.9, 1, wIn) * lerp(1, 1.6, morph)})`;
  lg.style.opacity = eo(S(t, SC.bip2 + .12, SC.bip2 + .45));
  lg.style.transform = `translate(-50%,-50%) scale(${lerp(.7, 1, morph)})`;
  const er = $('endRing').firstElementChild, rp = S(t, SC.bip2, SC.bip2 + .6), R = lerp(60, 900, eo(rp));
  er.style.width = er.style.height = 2 * R + 'px'; er.style.left = er.style.top = -R + 'px';
  er.style.opacity = t >= SC.bip2 && rp < 1 ? (1 - rp) * .8 : 0;
  show('tag', eo(S(t, 27.4, 27.75)), 18);
  show('cta', eo(S(t, 27.95, 28.25)), 14);
  show('link', eo(S(t, 28.35, 28.6)), 10);
  show('roque', eo(S(t, 28.55, 28.8)), 10);
}

window.__DURATION = DUR;
window.__AUDIO = AUDIO;
window.__seek = seek;
seek(0);
document.fonts.ready.then(() => { window.__ready = true; });
