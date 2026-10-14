/* =========================================================================
   BIP · Del ruido al impacto — ≈51 s, 4:5 (1080×1350), sin locución. Guion: GUION.md
   Animación determinística: todo el estado sale de window.__seek(t).
   window.__AUDIO lista los eventos de sonido para que render.mjs arme la pista.
   Datos ilustrativos: ninguna cifra es de un cliente real.
   ========================================================================= */
const DUR = 65.1;
const T = { n2: 3.2, n3: 5.4, tri: 2.6, touch: 7.05, bip: 7.6, light: 8.0 };
const P = { // [inicio, fin] de cada parte
  concept: [8.4, 13.6], pil: [13.6, 20.0], med: [20.0, 24.4], lrn: [24.4, 29.0],
  ia: [29.0, 35.4], cmp: [35.4, 40.0], al: [40.0, 44.0], end: 44.0, bip2: 48.5,
};

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const S = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const eo = p => 1 - Math.pow(1 - p, 3);
const eio = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const lerp = (a, b, p) => a + (b - a) * p;
const $ = id => document.getElementById(id);
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647, (seed - 1) / 2147483646); }
function show(id, a, dy = 24) { const e = $(id); e.style.opacity = a; e.style.transform = `translateY(${(1 - a) * dy}px)`; }
// opacidad de una parte: entra en fi s y sale en los últimos fo s
const win = (t, [a, b], fi = .35, fo = .3) => Math.min(eo(S(t, a, a + fi)), 1 - S(t, b - fo, b));
const AUDIO = [];

/* ---------- parte 1: piezas de reportes que se contradicen ---------- */
const SRC = [['Meta Ads', '#1877f2'], ['GA4', '#e8710a'], ['Google Ads', '#34a853'], ['Agencia de medios', '#7c3aed'],
  ['Redes · Instagram', '#d6249f'], ['Planilla de ventas', '#16a34a'], ['Search Console', '#4285f4'], ['Estudio de marca', '#0ea5e9']];
const KPI = [['Alcance', '2,4M', '+18%', 1], ['Ventas', '$ 41,2M', '−12%', 0], ['CTR', '0,9%', '−0,3 pp', 0], ['ROAS', '3,2x', '+0,4', 1],
  ['Engagement', '1,8%', '−7%', 0], ['Tráfico web', '318K', '+24%', 1], ['Sesiones', '96K', '−9%', 0], ['Conversión', '2,1%', '+0,2 pp', 1],
  ['CPM', '$ 1.240', '+31%', 0], ['Seguidores', '129K', '+2%', 1], ['Rebote', '58%', '+6 pp', 0], ['Leads', '1.204', '−15%', 0]];
const FILES = [['Reporte_agencia_Q3.pdf', 'PDF', '#dc2626'], ['Pauta_Q2.pdf', 'PDF', '#dc2626'], ['Meta Ads.xlsx', 'XLS', '#16a34a'],
  ['GA4 export.csv', 'CSV', '#475569'], ['Kantar_marca.pptx', 'PPT', '#ea580c'], ['Presupuesto.xlsx', 'XLS', '#16a34a'], ['Redes_sept.xlsx', 'XLS', '#16a34a']];
const TOASTS = ['Nuevo reporte de la agencia', 'El alcance subió 18%', 'Las ventas bajaron 12%', 'Alerta: CPM +31%', 'Reunión: revisión de KPIs',
  '3 dashboards actualizados', 'El CTR cayó', 'Nuevo export de GA4', '¿Lo vemos en la reunión?', 'Reporte semanal listo'];
const N = 46, pieces = [];
(function buildNoise() {
  const r = rng(20261014), host = $('noise');
  for (let i = 0; i < N; i++) {
    const kind = i % 5 === 1 ? 'file' : i % 5 === 3 ? 'toast' : 'card';
    const el = document.createElement('div');
    if (kind === 'card') {
      const k = KPI[(i * 7) % KPI.length], s = SRC[(i * 3) % SRC.length], up = k[3];
      el.className = 'card';
      el.innerHTML = `<div class="src"><i style="background:${s[1]}"></i>${s[0]}</div><div class="big">${k[1]}</div><div class="lbl">${k[0]}</div><div class="chg" style="color:${up ? 'var(--up)' : 'var(--dn)'}">${up ? '▲' : '▼'} ${k[2]}</div>`;
    } else if (kind === 'file') {
      const f = FILES[i % FILES.length]; el.className = 'file'; el.innerHTML = `<b style="background:${f[2]}">${f[1]}</b>${f[0]}`;
    } else {
      const tx = TOASTS[i % TOASTS.length]; el.className = 'toast';
      el.innerHTML = `<i style="background:${/bajaron|cayó|Alerta/.test(tx) ? 'var(--dn)' : 'var(--cyan)'}"></i>${tx}`;
    }
    const t = 0.6 + 6.3 * Math.sqrt(i / (N - 1)); // cada vez más rápido
    el.style.left = 40 + r() * 760 + 'px'; el.style.top = 360 + r() * 880 + 'px';
    host.appendChild(el);
    pieces.push({ el, t, rot: (r() - .5) * 9 });
    AUDIO.push({ t, type: 'ping', f: [660, 880, 988, 1175, 1397, 784][i % 6], v: 0.35 + 0.35 * (i / N) });
  }
  AUDIO.push({ t: 0.6, type: 'hum_start' }, { t: T.bip, type: 'bip' }, { t: T.light, type: 'pad_start' });
})();

/* ---------- parte 2: iniciativas sueltas → sistema conectado al impacto ---------- */
const CHIPS = ['Pauta', 'Redes', 'Web', 'SEO', 'Trade', 'Contenido', 'Promos', 'Influencers', 'Mailing', 'Eventos', 'Precios', 'Marca'];
const IMP = { x: 540, y: 670 }; // borde inferior de «Impacto en el negocio»
const chips = [];
(function buildConcept() {
  const r = rng(7), host = $('concept');
  let paths = '';
  CHIPS.forEach((c, i) => {
    const el = document.createElement('div'); el.className = 'chip'; el.textContent = c; host.appendChild(el);
    const col = i % 4, row = Math.floor(i / 4);
    const to = { x: 101 + col * 226, y: 800 + row * 130 };
    const from = { x: 60 + r() * 760, y: 470 + r() * 760, rot: (r() - .5) * 50 };
    chips.push({ el, from, to });
    const cx = to.x + 100;
    paths += `<path d="M${IMP.x} ${IMP.y} C ${IMP.x} ${IMP.y + 70}, ${cx} ${to.y - 70}, ${cx} ${to.y}"/>`;
    AUDIO.push({ t: 11.0 + i * .08, type: 'tick', f: 988 + i * 40 });
  });
  $('clinks').innerHTML = paths;
})();
const PILS = [['01', 'Orden', 'Tu estrategia, de punta a punta.<br>Cada métrica y acción, conectada al objetivo.'],
  ['02', 'Control', 'Todo tu ecosistema en un solo lugar.<br>Visibilidad total para recalibrar a tiempo.'],
  ['03', 'Eficiencia', 'Optimizá con evidencia, no con intuición.<br>Hacés más, con más asertividad.'],
  ['04', 'Expertise', 'Expertise world class de tu lado.<br>Las mejores prácticas, dentro de la plataforma.'],
  ['05', 'Impacto', 'Medí el impacto económico de cada decisión.<br>Sabé dónde te conviene invertir.']];
const PIL_T = PILS.map((_, i) => 13.6 + i * 2.2); // uno por vez, 2,2 s cada uno
$('pils').innerHTML = PILS.map((p, i) => `<div class="pil" id="pil${i}"><b>${p[0]}</b><span>${p[1]}</span><em>${p[2]}</em></div>`).join('');
PIL_T.forEach(t => AUDIO.push({ t: t + .05, type: 'tick', f: 1175, keep: true }));

/* ---------- parte 3 ---------- */
const SEGS = [['TOM', '31,5', '31,4'], ['SOM', '58,7', '58,6'], ['Intención de Compra', '34,2', '34,1'], ['Poder de Marca', '15,6', '15,5']];
$('segBody').innerHTML = SEGS.map(s => `<div class="sg"><div class="sgh"><span>${s[0]}</span><em></em></div>
  <div class="sgv"><b>${s[1]}</b> / ${s[2]}</div><div class="sgbar"><i></i></div><div class="sgp">0%</div></div>`).join('');
AUDIO.push({ t: 22.5, type: 'chime' });
[25.2, 25.9, 26.6].forEach(t => AUDIO.push({ t, type: 'tick', f: 1046 }));
const ANSWER = [['El ', 0], ['VTR de YouTube', 1], [' empujó la ', 0], ['Intención de Compra +2,1 pts', 1], ['.', 0]];
const ANS_LEN = ANSWER.reduce((a, s) => a + s[0].length, 0);
function answerHtml(n) {
  let out = '', left = n;
  for (const [s, b] of ANSWER) { if (left <= 0) break; const part = s.slice(0, left); left -= s.length; out += b ? `<b>${part}</b>` : part; }
  return out + (n < ANS_LEN ? '<i class="caret"></i>' : '');
}
const STEP_T = [32.6, 33.1, 33.6], PRESS = 34.4;
STEP_T.forEach(t => AUDIO.push({ t, type: 'tick', f: 1318 }));
AUDIO.push({ t: PRESS, type: 'click' });
[36.6, 37.4, 38.2].forEach(t => AUDIO.push({ t, type: 'tick', f: 880 }));
const AL_T = [40.7, 41.4, 42.1];
AL_T.forEach(t => AUDIO.push({ t, type: 'tick', f: 1568 }));
AUDIO.push({ t: P.end + .4, type: 'chime' }, { t: P.bip2, type: 'bip' }, { t: P.bip2, type: 'final' });

/* REMAP: las capas se armaron en una línea de tiempo vieja; acá se reubican sin reescribir cada tiempo.
   [inicio viejo, fin viejo, desplazamiento] → orden nuevo: Medición, Aprendizaje, IA, Alertas, Competencia, cierre. */
const REMAP = [[20, 35.4, 13.6], [40, 43.84, 9.0], [35.4, 40, 17.6], [44, 51.5, 13.6]];
const oldToNew = o => { const m = REMAP.find(([a, b]) => o >= a && o < b); return m ? o + m[2] : o; };
function newToOld(n) {
  for (const [a, b, d] of REMAP) if (n >= a + d && n < b + d) return n - d;
  return n >= 51.5 + 13.6 ? 51.5 : 0; // fuera de las capas: tiempo neutro (nada de la parte 3 visible)
}
for (const e of AUDIO) if (e.t >= 20 && !e.keep) e.t = oldToNew(e.t);
[25.0, 25.8, 26.6, 27.4].forEach(t => AUDIO.push({ t, type: 'tick', f: 880 }));
[30.2, 30.8, 31.4, 32.0].forEach(t => AUDIO.push({ t, type: 'tick', f: 1318 }));

function seek(t) {
  /* ===== parte 1: ruido ===== */
  const noiseOn = t < T.bip;
  const shake = noiseOn ? Math.pow(S(t, 5.0, T.bip), 2) : 0;
  const r = rng(Math.floor(t * 30) + 7);
  $('noise').style.transform = shake ? `translate(${(r() - .5) * 14 * shake}px,${(r() - .5) * 14 * shake}px)` : 'none';
  for (const p of pieces) {
    const a = noiseOn ? eo(S(t, p.t, p.t + .16)) : 0;
    p.el.style.opacity = a; p.el.style.transform = `rotate(${p.rot}deg) scale(${lerp(.86, 1, a)})`;
  }
  $('scrim').style.opacity = noiseOn ? 1 : 0;
  $('n1').style.opacity = t < T.n2 ? 1 : 0;           // también es la portada (primer cuadro)
  $('n2').style.opacity = t >= T.n2 && t < T.n3 ? 1 : 0;
  $('n3').style.opacity = t >= T.n3 && noiseOn ? 1 : 0;
  $('logoSmall').style.opacity = 1 - S(t, .5, .8);

  const triIn = eo(S(t, T.tri, T.tri + .35)), triOut = S(t, T.bip + .25, T.bip + .7);
  const press = t >= T.touch + .4 && t < T.bip ? .9 : 1;
  $('tri').style.opacity = t >= T.tri && triOut < 1 ? triIn * (1 - triOut) : 0;
  $('tri').style.transform = `scale(${(.6 + .4 * triIn) * press * (1 - .4 * triOut)})`;
  $('halo').style.opacity = noiseOn && t >= T.tri ? triIn : 0;
  const ph = ((t - T.tri) % 1.1) / 1.1, pu = $('pulse').firstElementChild;
  pu.style.opacity = noiseOn && t >= T.tri + .35 ? (1 - ph) * .7 : 0; pu.style.transform = `scale(${1 + ph * .9})`;
  const tc = $('touch');
  if (t >= T.touch && t < T.bip + .2) {
    const m = eio(S(t, T.touch, T.touch + .4));
    tc.style.opacity = t < T.bip ? eo(S(t, T.touch, T.touch + .15)) : 1 - S(t, T.bip, T.bip + .2);
    tc.style.transform = `translate(${lerp(860, 480, m)}px,${lerp(1300, 616, m)}px) scale(${press < 1 ? .82 : 1})`;
  } else tc.style.opacity = 0;
  const rp = S(t, T.bip, T.bip + .55), ri = $('ring').firstElementChild, R = lerp(70, 1900, eo(rp));
  ri.style.width = ri.style.height = 2 * R + 'px'; ri.style.left = ri.style.top = -R + 'px';
  ri.style.opacity = t >= T.bip && rp < 1 ? 1 - rp : 0; ri.style.borderWidth = lerp(14, 2, rp) + 'px';
  $('onoma').style.opacity = t >= T.bip ? S(t, T.bip, T.bip + .08) * (1 - S(t, T.bip + .45, T.bip + .75)) : 0;
  $('bgLight').style.opacity = eio(S(t, T.light, T.light + .6));

  /* ===== parte 2: concepto ===== */
  const ac = win(t, P.concept);
  show('hConcept', Math.min(ac, 1 - S(t, 10.6, 10.85))); show('hConcept2', Math.min(eo(S(t, 10.85, 11.15)), 1 - S(t, P.concept[1] - .3, P.concept[1]))); $('concept').style.opacity = ac;
  const org = eio(S(t, 9.6, 11.0));
  chips.forEach((c, i) => {
    const x = lerp(c.from.x, c.to.x, org), y = lerp(c.from.y, c.to.y, org), rot = lerp(c.from.rot, 0, org);
    c.el.style.opacity = eo(S(t, 8.5 + i * .03, 8.8 + i * .03));
    c.el.style.transform = `translate(${x}px,${y}px) rotate(${rot}deg)`;
    c.el.classList.toggle('on', t >= 11.0 + i * .08 + .3);
  });
  $('clinks').querySelectorAll('path').forEach((p, i) => {
    const L = p.__L || (p.__L = p.getTotalLength()); p.style.strokeDasharray = L;
    p.style.strokeDashoffset = L * (1 - eio(S(t, 11.0 + i * .08, 11.4 + i * .08)));
  });
  const im = eo(S(t, 10.8, 11.2));
  $('impact').style.opacity = im; $('impact').style.transform = `scale(${lerp(.9, 1, im)})`;
  $('impact').style.boxShadow = t >= 12 ? `0 0 ${40 * eo(S(t, 12, 12.4))}px rgba(18,166,244,.6)` : 'none';

  const ap = win(t, [13.6, 24.6]);
  show('ePil', ap, 10); $('dots').style.opacity = ap;
  PILS.forEach((_, i) => show('pil' + i, win(t, [PIL_T[i], PIL_T[i] + 2.2], .3, .25), 30));
  $('dots').querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', t >= PIL_T[i]));

  /* la plataforma */
  const apl = win(t, [24.6, 29.6]);
  show('ePlat', apl, 10); show('hPlat', apl); $('ilus2').style.opacity = apl;
  [25.0, 25.8, 26.6, 27.4].forEach((s, i) => {
    const e = $('s' + i), a = eo(S(t, s, s + .45)), out = 1 - S(t, 29.3, 29.6);
    const later = [25.0, 25.8, 26.6, 27.4].filter(x => x > s && t >= x).length; // pantallas que ya se le pusieron encima
    e.style.opacity = a * out; e.style.zIndex = 5 + i;
    e.style.top = (470 + i * 120) + 'px';
    e.style.transform = `translateY(${(1 - a) * 160}px) scale(${1 - later * .03})`;
    e.style.filter = `brightness(${1 - later * .06})`;
  });

  /* las 4 capas de valor */
  const ak4 = win(t, [29.6, 33.6]);
  show('hCapas', ak4);
  [30.2, 30.8, 31.4, 32.0].forEach((s, i) => show('k' + i, Math.min(eo(S(t, s, s + .3)), 1 - S(t, 33.3, 33.6)), 16));

  t = newToOld(t); // las capas y el cierre usan su línea de tiempo original, reubicada (ver REMAP)

  /* ===== parte 3: capas ===== */
  const lightUI = t >= P.med[0] && t < P.al[0];
  $('ilus').style.opacity = lightUI ? Math.min(S(t, P.med[0], P.med[0] + .3), 1 - S(t, P.al[0] - .3, P.al[0])) : 0;

  const am = win(t, P.med);
  show('eMed', am, 10); show('hMed', am); show('pMed', am, 40);
  const fill = eio(S(t, 20.6, 22.4));
  $('segBody').querySelectorAll('.sg').forEach(g => {
    g.querySelector('.sgbar i').style.width = (fill * 100).toFixed(1) + '%';
    g.querySelector('.sgp').textContent = Math.round(fill * 101) + '%';
    g.querySelector('em').style.background = fill < .9 ? 'var(--mid)' : 'var(--up)';
    g.classList.toggle('met', fill >= 1);
  });

  const al = win(t, P.lrn);
  show('eLrn', al, 10); show('hLrn', al); show('pLrn', al, 40);
  [25.0, 25.7, 26.4].forEach((s, i) => show('l' + i, eo(S(t, s, s + .3)), 12));
  show('lBadge', eo(S(t, 27.1, 27.4)), 10);

  const ai = win(t, P.ia);
  show('eIa', ai, 10); show('hIa', Math.min(ai, 1 - S(t, 32.0, 32.25))); show('pIa', ai, 40);
  show('hIa2', Math.min(eo(S(t, 32.25, 32.55)), 1 - S(t, P.ia[1] - .3, P.ia[1])));
  show('ubub', eo(S(t, 29.4, 29.7)), 12); show('abox', eo(S(t, 29.9, 30.2)), 12);
  $('ans').innerHTML = answerHtml(Math.round(ANS_LEN * S(t, 30.1, 31.9)));
  show('gchip', eo(S(t, 32.3, 32.55)), 10);
  STEP_T.forEach((s, i) => { show('st' + i, eo(S(t, s - .25, s)), 10); $('st' + i).classList.toggle('done', t >= s + .25); });
  show('btns', eo(S(t, 33.9, 34.1)), 10);
  $('btnDo').classList.toggle('ok', t >= PRESS + .1);
  $('btnDo').textContent = t >= PRESS + .1 ? '✓ En Mis acciones' : 'La voy a hacer';
  const t2 = $('touch2'), btn = $('btnDo');
  if (t >= 33.95 && t < PRESS + .45) {
    const bx = btn.offsetLeft + $('btns').offsetLeft + $('pIa').offsetLeft + btn.offsetWidth / 2 - 60;
    const by = btn.offsetTop + $('btns').offsetTop + $('pIa').offsetTop + btn.offsetHeight / 2 - 60;
    const m = eio(S(t, 33.95, PRESS - .05));
    t2.style.opacity = t < PRESS + .2 ? eo(S(t, 33.95, 34.1)) : 1 - S(t, PRESS + .2, PRESS + .45);
    t2.style.transform = `translate(${lerp(900, bx, m)}px,${lerp(1330, by, m)}px) scale(${t >= PRESS - .05 && t < PRESS + .12 ? .82 : 1})`;
  } else t2.style.opacity = 0;

  const ak = win(t, P.cmp);
  show('eCmp', ak, 10); show('hCmp', ak); show('pCmp', ak, 40);
  show('c0', eo(S(t, 36.4, 36.7)), 12); show('c1', eo(S(t, 37.2, 37.5)), 12); show('cTodo', eo(S(t, 38.0, 38.3)), 12);

  const aa = win(t, P.al);
  show('eAl', aa, 10); show('hAl', aa);
  AL_T.forEach((s, i) => { const e = $('a' + i), a = Math.min(eo(S(t, s, s + .3)), 1 - S(t, P.al[1] - .3, P.al[1]));
    e.style.opacity = a; e.style.transform = `translateX(${(1 - a) * 80}px)`; });

  /* ===== cierre ===== */
  $('navy').style.opacity = eio(S(t, P.end - .15, P.end + .35));
  const lines = Math.min(1, 1 - S(t, 47.7, 48.1));
  [44.4, 45.6, 46.6].forEach((s, i) => show('cl' + i, eo(S(t, s, s + .4)) * lines, 20));
  const w = $('word'), lg = $('logoBig');
  const wIn = eo(S(t, 48.1, 48.35)), morph = eio(S(t, P.bip2, P.bip2 + .45));
  w.style.opacity = t >= 48.1 ? wIn * (1 - S(t, P.bip2, P.bip2 + .2)) : 0;
  w.style.transform = `translate(-50%,-50%) scale(${lerp(.9, 1, wIn) * lerp(1, 1.6, morph)})`;
  lg.style.opacity = eo(S(t, P.bip2 + .12, P.bip2 + .45));
  lg.style.transform = `translate(-50%,-50%) scale(${lerp(.7, 1, morph)})`;
  const er = $('endRing').firstElementChild, rp2 = S(t, P.bip2, P.bip2 + .6), R2 = lerp(60, 900, eo(rp2));
  er.style.width = er.style.height = 2 * R2 + 'px'; er.style.left = er.style.top = -R2 + 'px';
  er.style.opacity = t >= P.bip2 && rp2 < 1 ? (1 - rp2) * .8 : 0;
  show('cta', eo(S(t, 49.3, 49.6)), 14); show('link', eo(S(t, 49.7, 49.95)), 10); show('roque', eo(S(t, 49.9, 50.15)), 10);
}

window.__DURATION = DUR;
window.__AUDIO = AUDIO;
window.__seek = seek;
seek(0);
document.fonts.ready.then(() => { window.__ready = true; });
