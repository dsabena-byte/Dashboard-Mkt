/* =========================================================================
   BIP · «¿Qué movió la aguja?» — 30 s, 4:5 (1080×1350), sin locución.
   Animación determinística: todo el estado sale de window.__seek(t).
   window.__AUDIO lista los eventos de sonido para que render.mjs arme la pista.
   Datos ilustrativos: ninguna cifra es de un cliente real.
   ========================================================================= */
const DUR = 10.0;          // avance: 0–10 s (portada, ruido, momento BIP)
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
})();

function seek(t) {
  /* portada: la pregunta sola (es la miniatura del chat) */
  const cover = t < T.cover;
  const qBack = S(t, T.q, T.q + .45);
  const q = $('q');
  if (cover) { q.style.opacity = 1; q.style.transform = 'none'; q.style.color = '#fff'; }
  else if (t >= T.q) {
    const up = eio(S(t, T.light, T.light + 1));
    q.style.opacity = eo(qBack); q.style.color = up > .5 ? 'var(--ink)' : '#fff';
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
}

window.__DURATION = DUR;
window.__AUDIO = AUDIO;
window.__seek = seek;
seek(0);
document.fonts.ready.then(() => { window.__ready = true; });
