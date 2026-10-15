/* =========================================================================
   BIP · Del ruido al impacto — ≈51 s, 4:5 (1080×1350), sin locución. Guion: GUION.md
   Animación determinística: todo el estado sale de window.__seek(t).
   window.__AUDIO lista los eventos de sonido para que render.mjs arme la pista.
   Datos ilustrativos: ninguna cifra es de un cliente real.
   ========================================================================= */
const INTRO = 1.6; // apertura: BIP + sonido sobre navy, igual que el cierre
const E = 68.8;    // inicio del cierre (línea de tiempo principal)
const DUR = INTRO + E + 8.4;
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
const PIL_T = PILS.map((_, i) => 13.6 + i * 2.6); // uno por vez, 2,6 s cada uno, con su visual
const PV = [ // visual de cada punto
  ['Objetivo', 'KPI', 'Meta', 'Plan', 'Acción', 'Canal', 'Inversión', 'Resultado'].map((x, i) => `<div class="sq" id="q${i}">${x}</div>`).join(''),
  [['TOM', '31,5'], ['Alcance', '26,0M'], ['VTR', '30,6%'], ['Tráfico', '318K'], ['Share', '27%'], ['Inversión', '$81M']]
    .map(([l, v], i) => `<div class="tile" id="tl${i}" style="left:${(i % 3) * 306}px;top:${Math.floor(i / 3) * 160}px"><b>${v}</b><span>${l}</span><i></i></div>`).join(''),
  Array.from({ length: 8 }, (_, i) => `<div class="bar${i === 7 ? ' hi' : ''}" id="br${i}" style="left:${i * 96}px"></div>`).join('') + '<div class="up" id="upTag">+32%</div>',
  ['Best practices del mercado', 'Benchmarks por categoría', 'Una guía en cada KPI'].map((x, i) => `<div class="chk" id="ck${i}"><i>✓</i>${x}</div>`).join(''),
  '<div class="cnt"><span id="cntV">$ 0</span><small>Impacto económico estimado · dato ilustrativo</small></div>',
];
$('pils').innerHTML = PILS.map((p, i) => `<div class="pil" id="pil${i}"><b>${p[0]}</b><span>${p[1]}</span><em>${p[2]}</em><div class="pv">${PV[i]}</div></div>`).join('');
const SQ = Array.from({ length: 8 }, (_, i) => { const r = rng(31 + i * 7); r();
  return { fx: r() * 700, fy: r() * 250, fr: (r() - .5) * 40, tx: (i % 4) * 228, ty: 60 + Math.floor(i / 4) * 100 }; });
PIL_T.forEach(t => AUDIO.push({ t, type: 'whoosh', keep: true }, { t: t + .12, type: 'hit', keep: true }));
AUDIO.push({ t: 13.6 + 3 * 2.6 + 1.0, type: 'tick', f: 1318, keep: true }, { t: 13.6 + 3 * 2.6 + 1.4, type: 'tick', f: 1397, keep: true }, { t: 13.6 + 3 * 2.6 + 1.8, type: 'tick', f: 1568, keep: true });

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
const AL_T = [40.7, 41.4, 42.1];
AL_T.forEach(t => AUDIO.push({ t, type: 'tick', f: 1568 }));

/* REMAP: las capas se armaron en una línea de tiempo vieja; acá se reubican sin reescribir cada tiempo.
   [inicio viejo, fin viejo, desplazamiento] → orden nuevo: Medición, Aprendizaje, IA, Alertas, Competencia, cierre. */
const REMAP = [[20, 24.4, 16.8], [24.4, 29, 18.0], [29, 35.4, 19.2], [40, 43.84, 15.8]];
const oldToNew = o => { const m = REMAP.find(([a, b]) => o >= a && o < b); return m ? o + m[2] : o; };
function newToOld(n) {
  for (const [a, b, d] of REMAP) if (n >= a + d && n < b + d) return n - d;
  return 0; // fuera de las capas: tiempo neutro (nada de la parte 3 visible)
}
for (const e of AUDIO) if (e.t >= 20 && !e.keep) e.t = oldToNew(e.t);
const SCR_T = [27.0, 27.8, 28.6, 29.4], K4_T = [32.2, 32.8, 33.4, 34.0];
const CC = [[35.6, 36.8], [41.2, 42.4], [47.0, 48.2], [54.6, 55.8]]; // tarjetas con el número grande de cada capa
SCR_T.forEach(t => AUDIO.push({ t, type: 'whoosh' }));
K4_T.forEach(t => AUDIO.push({ t, type: 'tick', f: 1318 }));
AUDIO.push({ t: 30.6, type: 'riser', d: 1.0 });
CC.forEach(([s]) => AUDIO.push({ t: s - .05, type: 'whoosh' }, { t: s + .1, type: 'hit' }));
/* música: pulso desde que aparece BIP hasta el cierre, y el cierre con su propio golpe */
AUDIO.push({ t: 8.3, type: 'beat', end: E + 4.9, bpm: 104 });
AUDIO.push({ t: E - 1.0, type: 'riser', d: 1.0 });
[0, 1, 2].forEach(i => AUDIO.push({ t: E + .4 + i * 1.5, type: 'whoosh' }, { t: E + .5 + i * 1.5, type: 'hit' }, { t: E + .75 + i * 1.5, type: 'tick', f: 1568 }));
AUDIO.push({ t: E + 5.4, type: 'bip' }, { t: E + 5.4, type: 'final' });

/* ---------- competencia (datos ilustrativos, marcas ficticias) ---------- */
const CMP_W = [59.8, 68.8];
const CMP_P = [['cA', 60.2, 62.4], ['cB', 62.4, 64.4], ['cC', 64.4, 66.4], ['cD', 66.4, 68.8]];
const BARS = {
  barsA: [['Vanté', 100, '18 avisos', 'Intensidad 100'], ['Kova', 72, '11 avisos', ''], ['Tu marca', 58, '9 avisos', '', 1], ['Areté', 41, '5 avisos', '']],
  barsB: [['Vanté', 100, '3,4%', 'Reels de producto'], ['Tu marca', 62, '2,1%', 'Reels', 1], ['Kova', 35, '1,2%', 'Carruseles'], ['Areté', 18, '0,6%', 'Sorteos']],
  barsC: [['Vanté', 100, '34%', ''], ['Tu marca', 79, '27%', '', 1], ['Kova', 65, '22%', ''], ['Areté', 50, '17%', '']],
};
for (const [id, rows] of Object.entries(BARS))
  $(id).innerHTML = rows.map(([n, w, v, sub, me]) => `<div class="br${me ? ' me' : ''}"><span>${n}</span><div class="tr"><i data-w="${w}"></i></div><em>${v}</em>${sub ? `<small>${sub}</small>` : ''}</div>`).join('');
CMP_P.forEach(([, s]) => AUDIO.push({ t: s + .3, type: 'tick', f: 988 }));
[66.7, 67.2, 67.7].forEach(t => AUDIO.push({ t, type: 'tick', f: 1318 }));
CMP_P.forEach(([, s]) => AUDIO.push({ t: s, type: 'whoosh' }));

/* cierre: frases partidas en palabras + chispas de luz */
[['Marketing', 'conectado.'], ['Estrategia', 'en', 'acción.'], ['Impacto', 'en el', 'negocio.']].forEach((ws, i) => {
  $('cl' + i).innerHTML = ws.map((w, k) => `<span class="w${(i === 1 && k === 0) || (i !== 1 && k === ws.length - 1) ? ' c' : ''}">${w}</span>`).join('');
  $('cl' + i).style.color = '#fff'; });
const SPK = Array.from({ length: 16 }, (_, i) => { const r = rng(97 + i * 7919); r(); r(); r(); return { x: 80 + r() * 900, y: 650 + r() * 560, d: r() * 1.6 }; });
$('sparks').innerHTML = SPK.map((_, i) => `<div class="spark" id="sp${i}"></div>`).join('');

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

  const ap = win(t, [13.6, 26.6]);
  show('ePil', ap, 10); $('dots').style.opacity = ap;
  PILS.forEach((_, i) => {
    const a = win(t, [PIL_T[i], PIL_T[i] + 2.6], .3, .25), el = $('pil' + i);
    el.style.opacity = a; el.style.transform = `translateX(${(1 - eo(S(t, PIL_T[i], PIL_T[i] + .35))) * 120}px)`;
    el.querySelector('b').style.transform = `scale(${lerp(1.5, 1, eo(S(t, PIL_T[i], PIL_T[i] + .4)))})`;
    el.querySelector('b').style.transformOrigin = 'left bottom';
  });
  { const p = eio(S(t, PIL_T[0] + .5, PIL_T[0] + 1.5)); // orden: piezas sueltas que se alinean
    SQ.forEach((q, i) => { const e = $('q' + i); e.style.transform = `translate(${lerp(q.fx, q.tx, p)}px,${lerp(q.fy, q.ty, p)}px) rotate(${lerp(q.fr, 0, p)}deg)`; e.classList.toggle('on', p >= 1); }); }
  for (let i = 0; i < 6; i++) { const on = t >= PIL_T[1] + .5 + i * .22, e = $('tl' + i); // control: todo se enciende
    e.style.opacity = on ? 1 : .35; e.querySelector('i').style.background = on ? 'var(--up)' : '#cbd5e1'; }
  for (let i = 0; i < 8; i++) { const g = eio(S(t, PIL_T[2] + .4 + i * .08, PIL_T[2] + 1.0 + i * .08)); // eficiencia: barras que suben
    $('br' + i).style.height = (g * (80 + i * 26)).toFixed(0) + 'px'; }
  show('upTag', eo(S(t, PIL_T[2] + 1.3, PIL_T[2] + 1.6)), 20);
  for (let i = 0; i < 3; i++) $('ck' + i).classList.toggle('on', t >= PIL_T[3] + 1.0 + i * .4); // expertise
  { const c = eio(S(t, PIL_T[4] + .4, PIL_T[4] + 1.8)); $('cntV').textContent = '$ ' + (c * 12.4).toFixed(1).replace('.', ',') + 'M'; }
  $('dots').querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', t >= PIL_T[i]));

  /* la plataforma */
  const apl = win(t, [26.6, 31.6]);
  show('ePlat', apl, 10); show('hPlat', apl); $('ilus2').style.opacity = apl;
  SCR_T.forEach((s, i) => {
    const e = $('s' + i), a = eo(S(t, s, s + .45)), out = 1 - S(t, 31.3, 31.6);
    const later = SCR_T.filter(x => x > s && t >= x).length; // pantallas que ya se le pusieron encima
    e.style.opacity = a * out; e.style.zIndex = 5 + i;
    e.style.top = (470 + i * 120) + 'px';
    e.style.transform = `translateY(${(1 - a) * 160}px) scale(${1 - later * .03})`;
    e.style.filter = `brightness(${1 - later * .06})`;
  });

  /* las 4 capas de valor */
  const ak4 = win(t, [31.6, 35.6]);
  show('hCapas', ak4);
  K4_T.forEach((s, i) => show('k' + i, Math.min(eo(S(t, s, s + .3)), 1 - S(t, 35.3, 35.6)), 16));
  CC.forEach(([s, e], i) => { const c = $('cc' + i), a = win(t, [s, e], .2, .2);
    c.style.opacity = a; c.querySelector('b').style.transform = `scale(${lerp(1.6, 1, eo(S(t, s, s + .35)))})`;
    c.querySelector('span').style.transform = `translateY(${(1 - eo(S(t, s + .15, s + .5))) * 40}px)`; });

  /* cierre: frases de a una, grandes, que entran y se van */
  $('navy').style.opacity = eio(S(t, E - .15, E + .35));
  [0, 1, 2].forEach(i => { const s = E + .4 + i * 1.5, el = $('cl' + i), out = S(t, s + 1.15, s + 1.45);
    el.style.opacity = t >= s && out < 1 ? 1 : 0;
    el.style.transform = `scale(${lerp(1, 1.18, eio(out))})`; el.style.filter = `blur(${out * 10}px)`;
    el.querySelectorAll('.w').forEach((w, k) => { // cada palabra entra desde abajo, girando y desenfocada
      const p = eo(S(t, s + k * .09, s + .45 + k * .09));
      w.style.opacity = p * (1 - out); w.style.transform = `translateY(${(1 - p) * 90}px) rotate(${(1 - p) * 8}deg) scale(${lerp(.7, 1, p)})`;
      w.style.filter = `blur(${(1 - p) * 12}px)`; }); });
  { const k = [0, 1, 2].findIndex(i => t >= E + .4 + i * 1.5 && t < E + 1.9 + i * 1.5), s = E + .4 + k * 1.5;
    const bar = $('clBar'), g = $('clGlow');
    if (k >= 0) { const p = eio(S(t, s + .3, s + .9)), out = S(t, s + 1.15, s + 1.45);
      bar.style.width = (p * 520 * (1 - out)) + 'px'; bar.style.opacity = 1 - out;
      const pulse = eo(S(t, s, s + .5)); g.style.opacity = (1 - out) * (.4 + .6 * (1 - pulse)); g.style.transform = `scale(${lerp(.6, 1.1, pulse)})`;
    } else { bar.style.opacity = 0; g.style.opacity = 0; }
    SPK.forEach((sp, i) => { const e = $('sp' + i), life = ((t - E - sp.d) % 1.6) / 1.6, on = t >= E + .3 && t < E + 4.9;
      e.style.opacity = on ? Math.sin(Math.PI * life) * .9 : 0;
      e.style.transform = `translate(${sp.x + Math.sin(life * 6 + i) * 20}px,${sp.y - life * 260}px) scale(${.5 + life})`; }); }
  { const b2 = E + 5.4, w = $('word'), lg = $('logoBig');
    const wIn = eo(S(t, E + 5.0, E + 5.25)), morph = eio(S(t, b2, b2 + .45));
    w.style.opacity = t >= E + 5.0 ? wIn * (1 - S(t, b2, b2 + .2)) : 0;
    w.style.transform = `translate(-50%,-50%) scale(${lerp(.9, 1, wIn) * lerp(1, 1.6, morph)})`;
    lg.style.opacity = eo(S(t, b2 + .12, b2 + .45)); lg.style.transform = `translate(-50%,-50%) scale(${lerp(.7, 1, morph)})`;
    const er = $('endRing').firstElementChild, rp2 = S(t, b2, b2 + .6), R2 = lerp(60, 900, eo(rp2));
    er.style.width = er.style.height = 2 * R2 + 'px'; er.style.left = er.style.top = -R2 + 'px';
    er.style.opacity = t >= b2 && rp2 < 1 ? (1 - rp2) * .8 : 0;
    show('cta', eo(S(t, E + 6.2, E + 6.5)), 14); show('link', eo(S(t, E + 6.55, E + 6.8)), 10); show('roque', eo(S(t, E + 6.75, E + 7.0)), 10); }

  /* competencia (línea de tiempo nueva): pauta → redes → búsquedas → qué hacer */
  const ak = win(t, CMP_W);
  show('eCmp', ak, 10); show('hCmp', ak); $('ilus2').style.opacity = Math.max(apl, ak);
  CMP_P.forEach(([id, s, e]) => {
    show(id, win(t, [s, e], .3, .25), 30);
    const grow = eio(S(t, s + .3, s + 1.2));
    $(id).querySelectorAll('.tr i').forEach(b => { b.style.width = (+b.dataset.w * grow).toFixed(1) + '%'; });
  });
  [66.7, 67.2, 67.7].forEach((s, i) => show('d' + i, eo(S(t, s, s + .3)), 12));

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


  const aa = win(t, P.al);
  show('eAl', aa, 10); show('hAl', aa);
  AL_T.forEach((s, i) => { const e = $('a' + i), a = Math.min(eo(S(t, s, s + .3)), 1 - S(t, P.al[1] - .3, P.al[1]));
    e.style.opacity = a; e.style.transform = `translateX(${(1 - a) * 80}px)`; });

}

/* apertura: fondo navy como el cierre, BIP + sonido; después corta al ruido */
for (const e of AUDIO) e.t += INTRO;
AUDIO.push({ t: .35, type: 'bip' }, { t: INTRO - .15, type: 'whoosh' });
function seekAll(t) {
  seek(Math.max(0, t - INTRO));
  const out = S(t, INTRO - .18, INTRO), w = $('iWord'), lg = $('iLogo'), m = eio(S(t, .35, .8));
  $('intro').style.opacity = 1 - out;
  w.style.opacity = 1 - S(t, .35, .55);
  w.style.transform = `translate(-50%,-50%) scale(${lerp(1, 1.6, m)})`;
  lg.style.opacity = eo(S(t, .47, .8));
  lg.style.transform = `translate(-50%,-50%) scale(${lerp(.7, 1, m) * lerp(1, 1.25, out)})`;
  const ri = $('iRing').firstElementChild, rp = S(t, .35, .95), R = lerp(60, 1000, eo(rp));
  ri.style.width = ri.style.height = 2 * R + 'px'; ri.style.left = ri.style.top = -R + 'px';
  ri.style.opacity = t >= .35 && rp < 1 ? (1 - rp) * .8 : 0;
}
window.__DURATION = DUR;
window.__AUDIO = AUDIO;
window.__seek = seekAll;
seekAll(0);
document.fonts.ready.then(() => { window.__ready = true; });
