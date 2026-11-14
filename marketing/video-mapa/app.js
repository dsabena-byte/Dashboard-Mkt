/* =========================================================================
   Video "Tu Mapa Estratégico en BIP" (14-nov-2026) — el proceso nuevo, todo conectado:
   1 Objetivos (ponderación 100%) → 2 Conexión con KPIs → 3 Ponderación de KPIs → 4 Metas de los objetivos
   (¿cuánto querés crecer?) → 5 Metas de los KPIs (crecen según su aporte) → 6 Mapa estratégico + Activar →
   Seguimiento. Réplica de components/plan/asistente.tsx y components/objetivos/mapa-seguimiento.tsx (BIP).
   Números ilustrativos. Determinístico: window.__seek(t).
   ========================================================================= */
const DUR = 52;
const LEAD = 0.34;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const S = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const eo = (p) => 1 - Math.pow(1 - p, 3);
const eio = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const lerp = (a, b, p) => a + (b - a) * p;
const nf = (n, d = 0) => n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
const typed = (str, p) => str.slice(0, Math.round(clamp(p, 0, 1) * str.length));
function mk(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
function inUp(node, p, dist = 22) { node.style.opacity = p; node.style.transform = `translateY(${(1 - p) * dist}px)`; }
const $ = (n, s) => n.querySelector(s), $$ = (n, s) => [...n.querySelectorAll(s)];
const CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
const PAL = [['#1d4ed8', '#f3f7ff'], ['#0e7490', '#f0f9fb'], ['#15803d', '#f2faf4']];

/* ---------------- motor de escenas + cursor ---------------- */
const stage = document.getElementById('stage');
const SCENES = [];
function scene(id, start, end, html, init) {
  const node = mk(`<div class="scene" id="${id}">${html}</div>`);
  stage.appendChild(node);
  const o = { id, start, end, node };
  o.draw = init(node, o) || (() => {});
  SCENES.push(o);
}
const cursorEl = mk(`<div id="cursor"><svg viewBox="0 0 24 24" width="34" height="34"><path d="M5 2.4l13.2 8.1-5.9.9 3.3 6.6-2.6 1.3-3.3-6.6-4.7 3.7z" fill="#fff" stroke="#0F172A" stroke-width="1.5" stroke-linejoin="round"/></svg></div>`);
const ringEl = mk('<div id="ring"></div>');
stage.appendChild(ringEl); stage.appendChild(cursorEl);
let cursorUsed = false;
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
    if (lt >= k.t - 0.07 && lt <= k.t + 0.12) press = 1;
    const p = S(lt, k.t, k.t + 0.34);
    if (p > 0 && p < 1) { ringP = p; rx = k.x; ry = k.y; }
  }
  cursorEl.style.opacity = alpha;
  cursorEl.style.transform = `translate(${x}px,${y}px) scale(${press ? 0.84 : 1})`;
  if (ringP >= 0) { ringEl.style.opacity = (1 - ringP) * 0.8 * alpha; ringEl.style.transform = `translate(${rx - 39}px,${ry - 39}px) scale(${lerp(0.32, 1.15, eo(ringP))})`; }
  else ringEl.style.opacity = 0;
}
const at = (el) => { const r = el.getBoundingClientRect(), st = stage.getBoundingClientRect(); return { x: r.left - st.left + r.width / 2, y: r.top - st.top + r.height / 2 }; };

/* ---------------- marco del asistente ---------------- */
const PASOS = ['Objetivos estratégicos', 'Conexión con KPIs', 'Ponderación de KPIs', 'Metas de los objetivos', 'Metas de los KPIs', 'Mapa estratégico'];
const QUE = [
  'marcá los objetivos que querés conseguir y poné cuánto pesa cada uno; entre todos suman 100%.',
  'mirá la historia y la proyección de cada objetivo, y revisá los KPIs que lo mueven.',
  'poné cuánto aporta cada KPI a su objetivo; en cada objetivo suman 100%.',
  'poné cuánto querés crecer en el 2027 en unidades, facturación e inversión.',
  'revisá las metas mes a mes de cada KPI: crecen según su aporte al objetivo.',
  'revisá tu Mapa completo y tocá «Activar este plan».',
];
function frame(step, body, cap) {
  const chips = PASOS.map((p, i) => `<div class="chip ${i < step ? 'ok' : i === step ? 'on' : ''}">${i < step ? '✓ ' : ''}${i + 1} · ${p}</div>`).join('');
  return `<div class="app"><div class="h1">Mapa Estratégico</div><div class="chips">${chips}</div>
    <div class="que"><b>Qué hacer acá:</b> ${QUE[step]}</div><div class="body" style="margin-top:22px">${body}</div></div>
    <div class="cap"><span>${cap}</span></div>`;
}
function frameIn(node, lt) {
  inUp($(node, '.app'), eo(S(lt, 0, 0.5)), 16);
  inUp($(node, '.cap'), eo(S(lt, 0.35, 0.85)), 14);
}

/* ================= 0 · Intro (0 – 3.6) ================= */
scene('s0', 0, 3.6, `<div class="center">
  <div class="logo" style="margin-bottom:40px"><div class="bip">BIP</div><div class="tag">Business<br>Impact<br>Platform</div></div>
  <div style="font-size:76px;font-weight:600;letter-spacing:-.03em">Tu Mapa Estratégico</div>
  <div style="font-size:34px;color:var(--muted);margin-top:18px">Objetivos, KPIs y metas. <b style="color:#1d4ed8;font-weight:600">Todo conectado.</b></div></div>`,
  (node) => { const k = [...$(node, '.center').children]; return (lt) => k.forEach((c, i) => inUp(c, eo(S(lt, 0.1 + i * 0.25, 0.8 + i * 0.25)), 26)); });

/* ================= 1 · Objetivos (3.6 – 10.6) ================= */
const OBJ = [['Facturación ($)', 'Lo que vendés en pesos.', '50'], ['Facturación (unidades)', 'Cuántos productos vendés.', '20'], ['Inversión Mkt ÷ Facturación ($)', 'Cuánto invertís por cada peso que vendés.', '30']];
scene('s1', 3.6, 10.6, frame(0, `<div style="display:grid;gap:12px;max-width:1150px">
    ${OBJ.map((o, i) => `<div class="box row o${i}" style="justify-content:space-between"><div class="row"><div class="ck">${CHECK}</div><div><div style="font-size:22px;font-weight:600">${o[0]}</div><div class="mut" style="font-size:16px;margin-top:3px">${o[1]}</div></div></div><div class="row"><span class="mut" style="font-size:16px">Ponderación</span><div class="inp" style="width:110px"><span class="v"></span>&nbsp;%</div></div></div>`).join('')}
    <div class="row" style="justify-content:space-between;margin-top:6px"><span class="tot" style="font-size:22px">Total: <b>0%</b></span><div class="btn sig">Siguiente →</div></div></div>`,
  'Elegí tus objetivos y cuánto pesa cada uno'),
  (node) => {
    const rows = $$(node, '.box'), tot = $(node, '.tot'); let P = null;
    return (lt, a) => {
      frameIn(node, lt);
      if (!P) P = rows.map((r) => ({ ck: at($(r, '.ck')), inp: at($(r, '.inp')) }));
      let sum = 0;
      rows.forEach((r, i) => {
        inUp(r, eo(S(lt, 0.4 + i * 0.15, 0.9 + i * 0.15)), 14);
        const tc = 1.3 + i * 1.5, on = lt > tc;
        $(r, '.ck').classList.toggle('on', on);
        const v = typed(OBJ[i][2], S(lt, tc + 0.45, tc + 0.9));
        $(r, '.v').textContent = v; sum += Number(v || 0);
      });
      tot.innerHTML = `Total: <b style="color:${sum === 100 ? '#15803d' : '#b91c1c'}">${sum}%</b>${sum === 100 ? ' ✓' : ''}`;
      const k = []; rows.forEach((_, i) => { const tc = 1.3 + i * 1.5; k.push({ t: tc - 0.5, ...P[i].ck }, { t: tc, ...P[i].ck, click: 1 }, { t: tc + 0.45, ...P[i].inp, click: 1 }); });
      runCursor([{ t: 0.6, x: 1500, y: 800 }, ...k, { t: 6, x: P[2].inp.x, y: P[2].inp.y }], lt, a);
    };
  });

/* ================= 2 · Conexión con KPIs (10.6 – 16.8) ================= */
const HIST = [310, 280, 340, 300, 330, 360, 350, 390, 420, 400, 460, 700, 340, 320, 380, 350, 370, 410, 400, 440, 470, 450, 510, 780];
const PROY = [540, 900, 420, 400, 470, 430, 460, 510, 500, 550, 590, 560, 640, 980];
function lineChart(w, h) {
  const all = [...HIST, ...PROY], max = Math.max(...all) * 1.1, n = all.length, X = (i) => 50 + (i / (n - 1)) * (w - 70), Y = (v) => h - 30 - (v / max) * (h - 50);
  const ph = HIST.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const pp = PROY.map((v, i) => `${i ? 'L' : 'M'}${X(i + HIST.length - 1 + (i ? 0 : 0)).toFixed(1)},${Y(i ? v : HIST[HIST.length - 1]).toFixed(1)}`).join(' ');
  const grid = [0.25, 0.5, 0.75, 1].map((f) => `<line x1="50" x2="${w - 20}" y1="${Y(max * f / 1.1)}" y2="${Y(max * f / 1.1)}" stroke="#eef2f7"/>`).join('');
  const lab = ['Nov 24', 'Nov 25', 'Dic 27'].map((t, i) => `<text x="${X([0, 12, n - 1][i])}" y="${h - 6}" font-size="14" fill="#94a3b8" text-anchor="middle">${t}</text>`).join('');
  return `<svg width="${w}" height="${h}">${grid}<path class="ph" d="${ph}" fill="none" stroke="#1d4ed8" stroke-width="3"/><path class="pp" d="${pp}" fill="none" stroke="#1d4ed8" stroke-width="3" stroke-dasharray="8 7" opacity=".55"/>${lab}
    <text x="${X(HIST.length) + 6}" y="26" font-size="15" fill="#64748b">Proyección →</text><line x1="${X(HIST.length - 1)}" x2="${X(HIST.length - 1)}" y1="20" y2="${h - 30}" stroke="#cbd5e1" stroke-dasharray="4 4"/></svg>`;
}
const spark = (s) => { const mx = Math.max(...s), mn = Math.min(...s); return `<svg width="120" height="34"><path d="${s.map((v, i) => `${i ? 'L' : 'M'}${(i / (s.length - 1)) * 116 + 2},${32 - ((v - mn) / (mx - mn || 1)) * 28}`).join(' ')}" fill="none" stroke="#1d4ed8" stroke-width="2"/></svg>`; };
const KPIS2 = [['Tráfico web', '+18%', '0,72', 'Más visitas → más ventas', [3, 4, 3, 5, 6, 5, 7, 8]], ['Tasa de conversión', '+6%', '0,55', 'Más visitas que compran', [5, 5, 6, 5, 6, 6, 7, 7]], ['Valor medio de compra', '+31%', '0,48', 'Cada compra vale más', [2, 3, 3, 4, 4, 5, 6, 7]], ['Clicks', '+22%', '0,41', 'Más clicks a la web', [4, 3, 5, 6, 5, 7, 6, 8]]];
scene('s2', 10.6, 16.8, frame(1, `<div style="display:grid;grid-template-columns:1fr 1.15fr;gap:24px">
    <div class="box"><div style="font-size:22px;font-weight:600">Facturación ($)</div><div class="mut" style="font-size:16px;margin:4px 0 8px">Últimos 24 meses y proyección</div>${lineChart(720, 330)}</div>
    <div class="box" style="padding:10px 18px"><div class="row mut" style="font-size:14px;padding:8px 0;border-bottom:1px solid var(--line)"><span style="width:34px"></span><span style="width:230px">KPI</span><span style="width:130px">Últimos 24 meses</span><span style="width:90px">Variación</span><span style="width:90px">Relación</span><span>Hipótesis</span></div>
    ${KPIS2.map((k) => `<div class="row kr" style="padding:14px 0;border-bottom:1px solid var(--line);font-size:18px"><div class="ck on" style="width:24px;height:24px">${CHECK}</div><b style="width:230px;font-weight:600">${k[0]}</b><span style="width:130px">${spark(k[4])}</span><span style="width:90px;color:#15803d;font-weight:600">${k[1]}</span><span style="width:90px">r ${k[2]}</span><span class="mut" style="font-size:16px">${k[3]}</span></div>`).join('')}</div></div>`,
  'BIP te muestra con qué KPIs se mueve cada objetivo'),
  (node) => {
    const ph = $(node, '.ph'), pp = $(node, '.pp'), L1 = ph.getTotalLength(), L2 = pp.getTotalLength(), rows = $$(node, '.kr');
    ph.style.strokeDasharray = L1;
    return (lt) => {
      frameIn(node, lt);
      ph.style.strokeDashoffset = L1 * (1 - eo(S(lt, 0.4, 2.2)));
      pp.style.opacity = 0.55 * eo(S(lt, 2.1, 2.8));
      rows.forEach((r, i) => inUp(r, eo(S(lt, 1 + i * 0.35, 1.5 + i * 0.35)), 12));
    };
  });

/* ================= 3 · Ponderación de KPIs (16.8 – 22.4) ================= */
const AP = [['Tráfico web', 35], ['Tasa de conversión', 30], ['Valor medio de compra', 20], ['Clicks', 15]];
const SHADES = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa'];
scene('s3', 16.8, 22.4, frame(2, `<div class="box" style="max-width:1300px"><div style="font-size:24px;font-weight:600">Facturación ($) <span class="mut" style="font-size:17px;font-weight:400">· ponderación del objetivo 50%</span></div>
    <div style="display:grid;gap:14px;margin-top:16px">${AP.map((k) => `<div class="row ar"><b style="width:280px;font-size:20px;font-weight:600">${k[0]}</b><div class="inp" style="width:100px"><span class="v"></span>&nbsp;%</div><div class="bar" style="flex:1;height:12px"><i class="bi" style="width:0"></i></div></div>`).join('')}</div>
    <div class="row" style="margin-top:16px;border-top:1px solid var(--line);padding-top:14px"><b style="width:280px;font-size:20px;font-weight:600">Total</b><div class="inp tt" style="width:100px;border-color:transparent"></div><span class="st" style="font-size:19px"></span></div></div>`,
  'Cuánto aporta cada KPI: entre todos, 100%'),
  (node) => {
    const rows = $$(node, '.ar'), st = $(node, '.st'), tt = $(node, '.tt'); let P = null;
    return (lt, a) => {
      frameIn(node, lt);
      if (!P) P = rows.map((r) => at($(r, '.inp')));
      let sum = 0;
      rows.forEach((r, i) => {
        const t0 = 0.8 + i * 0.95, v = Math.round(AP[i][1] * eo(S(lt, t0, t0 + 0.5)));
        $(r, '.v').textContent = v ? String(v) : ''; $(r, '.bi').style.width = v + '%'; sum += v;
      });
      const col = sum === 100 ? '#15803d' : '#b91c1c';
      tt.innerHTML = `<span style="color:${col}">${sum}&nbsp;%</span>`;
      st.innerHTML = `<span style="color:${col}">${sum === 100 ? '✓ Suma 100%' : `Faltan ${100 - sum} puntos para llegar a 100%`}</span>`;
      const k = []; rows.forEach((_, i) => k.push({ t: 0.8 + i * 0.95, ...P[i], click: 1 }));
      runCursor([{ t: 0.3, x: 1500, y: 860 }, ...k, { t: 5, ...P[3] }], lt, a);
    };
  });

/* ================= 4 · Metas de los objetivos (22.4 – 30.6) ================= */
const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const F26 = [300, 290, 350, 330, 360, 380, 370, 410, 420, 430, 520, 820], INF = [1.7, 1.6, 1.7, 1.7, 1.7, 1.7, 1.7, 1.7, 1.7, 1.7, 1.7, 1.8];
const card4 = (id, t, base, unit, extra) => `<div class="box c4" data-id="${id}" style="display:grid;gap:8px"><b style="font-size:20px;font-weight:600">${t}</b><div class="row"><div class="inp" style="width:110px"><span class="v"></span></div><span style="font-size:20px">%</span></div>
  <div style="font-size:17px">Año 2026: ${base}<br>Año 2027: <b class="fin" style="font-size:22px;font-weight:600"></b></div><div class="mut" style="font-size:15px">${extra}</div></div>`;
scene('s4', 22.4, 30.6, frame(3, `<div style="font-size:26px;font-weight:600">¿Cuánto querés crecer en el 2027?</div><div class="mut" style="font-size:17px;margin:4px 0 14px">Todo el 2027 contra todo el 2026. Crecer lo mismo que la inflación = 0% real.</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">${card4('u', 'Unidades', '23.600', '', 'BIP sugiere +2%.')}${card4('f', 'Facturación', '$ 4.240 M', '$', 'Inflación 2027 +22% · BIP sugiere +22%.')}${card4('i', 'Inversión en medios', '$ 19,3 M', '$', 'Inflación 2027 +22%.')}
    <div class="box" style="border-style:dashed;display:grid;gap:6px;align-content:start"><b style="font-size:20px;font-weight:600">Inversión ÷ Facturación</b><div class="big rt" style="font-size:40px"></div><span class="mut" style="font-size:15px">Año 2026: 0,46%</span></div></div>
    <div class="row" style="margin-top:16px;gap:6px">${MES.map((m, i) => `<div style="flex:1;text-align:center;border:1px solid var(--line);border-radius:8px;padding:5px 0;font-size:14px"><div class="mut">${m} 27</div>${nf(INF[i], 1)}%</div>`).join('')}</div>
    <div class="row" style="margin-top:16px;align-items:flex-end;gap:10px;height:150px">${MES.map((m, i) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><div style="display:flex;align-items:flex-end;gap:3px;height:120px"><i style="width:16px;height:${F26[i] / 8.2}px;background:#1d4ed8;border-radius:3px 3px 0 0"></i><i class="mb" data-v="${F26[i]}" style="width:16px;height:0;background:#cbd5e1;border-radius:3px 3px 0 0"></i></div><span class="mut" style="font-size:13px">${m}</span></div>`).join('')}</div>`,
  'Decí cuánto querés crecer: BIP arma las metas de cada mes'),
  (node) => {
    const cs = Object.fromEntries($$(node, '.c4').map((c) => [c.dataset.id, c])), rt = $(node, '.rt'), mbs = $$(node, '.mb'); let P = null;
    const T = { u: ['2', 0.9, 23600, 0], f: ['25', 2.1, 4240, 1], i: ['60', 3.3, 19.3, 1] };
    return (lt, a) => {
      frameIn(node, lt);
      if (!P) P = Object.fromEntries(Object.keys(T).map((k) => [k, at($(cs[k], '.inp'))]));
      const g = {};
      for (const [k, [v, t0, base]] of Object.entries(T)) {
        const s = typed(v, S(lt, t0 + 0.25, t0 + 0.6)); $(cs[k], '.v').textContent = s; g[k] = Number(s || 0);
        const fin = base * (1 + g[k] / 100);
        $(cs[k], '.fin').textContent = k === 'u' ? nf(Math.round(fin)) : k === 'f' ? `$ ${nf(Math.round(fin))} M` : `$ ${nf(fin, 1)} M`;
      }
      rt.textContent = nf((19.3 * (1 + g.i / 100)) / (4240 * (1 + g.f / 100)) * 100, 2) + '%';
      mbs.forEach((b) => { b.style.height = (Number(b.dataset.v) * (1 + g.f / 100)) / 8.2 * eo(S(lt, 2.5, 3.4)) + 'px'; });
      runCursor([{ t: 0.4, x: 1500, y: 900 }, { t: T.u[1], ...P.u, click: 1 }, { t: T.f[1], ...P.f, click: 1 }, { t: T.i[1], ...P.i, click: 1 }, { t: 7, ...P.i }], lt, a);
    };
  });

/* ================= 5 · Metas de los KPIs (30.6 – 35.6) ================= */
const KM = [['Tráfico web', '', 30000, 0.35], ['Tasa de conversión', '%', 4.2, 0.30], ['Valor medio de compra', '$', 280000, 0.20], ['Clicks', '', 14000, 0.15]];
const KMES = [0.8, 0.85, 1, 0.95, 1, 1.05, 1, 1.1, 1.1, 1.15, 1.35, 1.9];
const fmtK = (v, u) => (u === '%' ? nf(v, 2) + '%' : u === '$' ? '$ ' + nf(Math.round(v)) : nf(Math.round(v)));
scene('s5', 30.6, 35.6, frame(4, `<div style="font-size:24px;font-weight:600">Metas mensuales de los KPIs</div><div class="mut" style="font-size:17px;margin:4px 0 12px">Cada KPI parte del mismo mes del año anterior y se lleva su parte del crecimiento según su aporte.</div>
    <table style="width:100%;border-collapse:collapse;font-size:17px;table-layout:fixed"><tr class="mut" style="font-size:14px"><td style="width:250px;padding:6px">KPI</td>${MES.map((m) => `<td style="text-align:center">${m} 27</td>`).join('')}</tr>
    ${KM.map((k, r) => `<tr style="border-top:1px solid var(--line)"><td style="padding:12px 6px"><b style="font-weight:600">${k[0]}</b><div class="mut" style="font-size:13px">Ponderación ${Math.round(k[3] * 100)}%</div></td>${MES.map((_, i) => `<td style="padding:4px 2px"><div class="inp kc" data-r="${r}" data-i="${i}" style="min-width:0;height:40px;font-size:15px;font-weight:500;padding:0 6px"></div></td>`).join('')}</tr>`).join('')}</table>`,
  'Las metas de los KPIs salen solas, conectadas al objetivo'),
  (node) => {
    const cells = $$(node, '.kc');
    return (lt) => {
      frameIn(node, lt);
      const g = eo(S(lt, 1.2, 2.6));
      cells.forEach((c) => {
        const k = KM[+c.dataset.r], m = KMES[+c.dataset.i], base = k[2] * (k[1] === '' ? m : 1), up = Math.pow(1.25 / 1.22, k[3]) * (k[1] === '$' ? 1.22 : 1);
        const v = base * lerp(1, up, g);
        c.textContent = lt > 0.6 + +c.dataset.r * 0.15 ? fmtK(v, k[1]) : '';
        c.style.background = g > 0 && g < 1 ? '#f5f6fd' : '#fff';
      });
    };
  });

/* ================= 6 · Mapa estratégico + Activar (35.6 – 43) ================= */
const MAPA = [
  ['Facturación ($)', '50%', '$ 5.300 M', 'total del año', [['Tráfico web', 35, '372.000', 'total del año'], ['Tasa de conversión', 30, '4,30%', 'promedio mensual'], ['Valor medio de compra', 20, '$ 354.000', 'total del año'], ['Clicks', 15, '203.000', 'total del año']]],
  ['Facturación (unidades)', '20%', '24.100', 'total del año', [['Tráfico web', 40, '372.000', 'total del año'], ['Tasa de conversión', 40, '4,30%', 'promedio mensual'], ['Share of Search', 20, '18,5%', 'promedio mensual']]],
  ['Inversión Mkt ÷ Facturación ($)', '30%', '0,58%', 'del año', [['Inversión', 40, '$ 30,9 M', 'total del año'], ['Alcance único', 30, '2.780.000', 'total del año'], ['VTR (≥50%)', 30, '5,3%', 'promedio mensual']]],
];
function mapaHtml(seg) {
  return `<div style="text-align:center"><div style="display:inline-block;background:#1e293b;color:#fff;border-radius:12px;padding:10px 30px"><div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.75">${seg ? 'Cumplimiento global' : 'Mapa estratégico'}</div><div style="font-size:26px;font-weight:600">${seg ? '<span class="gl">96%</span>' : 'Tu plan 2027'}</div></div>
   <div style="width:2px;height:14px;background:#cbd5e1;margin:0 auto"></div><div style="height:2px;background:#cbd5e1;margin:0 16.6%"></div></div>
   <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">${MAPA.map((o, i) => { const [c, t] = PAL[i]; const cum = [104, 93, 88][i]; return `<div class="col" style="display:grid;align-content:start"><div style="width:2px;height:12px;background:#cbd5e1;margin:0 auto"></div>
     <div class="oc" style="background:${t};border:1px solid ${c}33;border-top:3px solid ${c};border-radius:14px;padding:12px 16px">
      <div class="row" style="justify-content:space-between"><span style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${c}">Objetivo estratégico</span><span style="background:#fff;color:${seg ? (cum >= 100 ? '#15803d' : cum >= 90 ? '#b45309' : '#b91c1c') : c};border:1px solid ${c}40;border-radius:999px;padding:2px 10px;font-size:14px;font-weight:600">${seg ? cum + '%' : 'Ponderación ' + o[1]}</span></div>
      <div style="font-size:20px;font-weight:600;margin:4px 0 4px">${o[0]}</div><div class="mut" style="font-size:14px">Meta 2027 · ${o[3]}</div><div style="font-size:34px;font-weight:600;letter-spacing:-.03em;color:${c}">${o[2]}</div></div>
     <div style="width:1px;height:10px;background:${c};opacity:.35;margin:0 auto"></div>
     <div style="display:grid;gap:7px">${o[4].map((k, j) => `<div class="kk" style="background:#fff;border:1px solid var(--line);border-left:3px solid ${c};border-radius:10px;padding:8px 12px"><div class="row" style="justify-content:space-between"><b style="font-size:16px;font-weight:600">${k[0]}</b><span style="color:${seg ? ([[102, 97, 108, 85], [99, 92, 79], [91, 84, 95]][i][j] >= 100 ? '#15803d' : [[102, 97, 108, 85], [99, 92, 79], [91, 84, 95]][i][j] >= 90 ? '#b45309' : '#b91c1c') : c};font-size:14px">${seg ? '<b style="font-size:17px;font-weight:600">' + [[102, 97, 108, 85], [99, 92, 79], [91, 84, 95]][i][j] + '%</b>' : 'Ponderación <b style="font-weight:600">' + k[1] + '%</b>'}</span></div>
       <div style="height:4px;background:${t};border-radius:2px;margin:5px 0"><i style="display:block;height:100%;width:${k[1]}%;background:${c};opacity:.75;border-radius:2px"></i></div>
       <div class="row" style="justify-content:space-between"><span class="mut" style="font-size:12.5px">${seg ? 'Ponderación ' + k[1] + '% · cumplimiento del año' : 'meta 2027, ' + k[3]}</span>${seg ? '' : `<b style="font-size:18px;font-weight:600">${k[2]}</b>`}</div></div>`).join('')}</div></div>`; }).join('')}</div>`;
}
scene('s6', 35.6, 43, frame(5, `<div class="mp" style="transform:scale(.92);transform-origin:top center;margin-top:-8px">${mapaHtml(false)}</div>
    <div class="row" style="position:absolute;right:44px;bottom:28px;gap:16px"><span class="okm" style="font-size:22px;color:#15803d;font-weight:600;opacity:0">✓ Plan activado</span><div class="btn act">Activar este plan</div></div>`,
  'Tu Mapa completo: revisalo y activalo'),
  (node) => {
    const cols = $$(node, '.col'), act = $(node, '.act'), ok = $(node, '.okm'); let P = null;
    return (lt, a) => {
      frameIn(node, lt);
      cols.forEach((c, i) => { inUp($(c, '.oc'), eo(S(lt, 0.5 + i * 0.3, 1.1 + i * 0.3)), 18); $$(c, '.kk').forEach((k, j) => inUp(k, eo(S(lt, 1.4 + i * 0.3 + j * 0.15, 1.9 + i * 0.3 + j * 0.15)), 12)); });
      if (!P) P = at(act);
      act.style.filter = lt > 5.2 && lt < 5.45 ? 'brightness(1.2)' : 'none';
      ok.style.opacity = eo(S(lt, 5.4, 5.9));
      runCursor([{ t: 3.8, x: 1200, y: 640 }, { t: 5.2, ...P, click: 1 }, { t: 7.4, ...P }], lt, a);
    };
  });

/* ================= 7 · Seguimiento (43 – 48) ================= */
const SEGO = [['Facturación ($)', 50, 104, [['Tráfico web', 35, 102], ['Tasa de conversión', 30, 97], ['Valor medio de compra', 20, 108], ['Clicks', 15, 85]]], ['Facturación (unidades)', 20, 93, [['Tráfico web', 40, 102], ['Tasa de conversión', 40, 97], ['Share of Search', 20, 79]]], ['Inversión Mkt ÷ Facturación ($)', 30, 91, [['Inversión', 40, 92], ['Alcance único', 30, 84], ['VTR (≥50%)', 30, 98]]]];
const semC = (c) => (c >= 100 ? '#15803d' : c >= 90 ? '#b45309' : '#b91c1c');
scene('s7', 43, 48, `<div class="app"><div class="h1">Seguimiento de Objetivos</div><div class="sub">Cada objetivo con sus KPIs: real contra meta, mes a mes.</div>
   <div class="box" style="margin-top:18px;display:flex;align-items:center;gap:30px"><div><div class="mut" style="font-size:15px;text-transform:uppercase;letter-spacing:.06em">Cumplimiento global · acumulado del año</div><div class="big gl" style="font-size:56px;color:#b45309"></div></div><div class="bar" style="flex:1;height:14px"><i class="glb" style="width:0;background:#b45309"></i></div></div>
   <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:16px">${SEGO.map((o) => `<div class="box oc" style="display:grid;gap:8px;align-content:start"><div class="row" style="justify-content:space-between"><b style="font-size:20px;font-weight:600">${o[0]}</b><span class="mut" style="font-size:14px">peso ${o[1]}%</span></div>
     <div class="row" style="align-items:baseline;gap:8px"><span class="big cv" data-v="${o[2]}" style="color:${semC(o[2])}"></span><span class="mut" style="font-size:15px">cumpl. acum. del año</span></div>
     <div class="bar" style="height:10px"><i class="cb" data-v="${o[2]}" style="width:0;background:${semC(o[2])}"></i></div>
     <div class="mut" style="font-size:13px;text-transform:uppercase;letter-spacing:.05em;margin-top:6px">Aporte de KPIs · ponderación × cumplimiento</div>
     ${o[3].map((k) => `<div class="row kk" style="justify-content:space-between;font-size:16px"><span><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${semC(k[2])};margin-right:8px"></i>${k[0]}</span><span class="mut">${k[1]}% · <b style="color:${semC(k[2])};font-weight:600">${k[2]}%</b></span></div>`).join('')}</div>`).join('')}</div></div>
   <div class="cap"><span>Y en el Seguimiento ves cómo vas, objetivo por objetivo</span></div>`,
  (node) => {
    const gl = $(node, '.gl'), glb = $(node, '.glb'), ocs = $$(node, '.oc');
    return (lt) => {
      inUp($(node, '.app'), eo(S(lt, 0, 0.5)), 16); inUp($(node, '.cap'), eo(S(lt, 0.35, 0.85)), 14);
      const p = eo(S(lt, 0.4, 1.6)); gl.textContent = Math.round(97 * p) + '%'; glb.style.width = 97 * p + '%';
      ocs.forEach((c, i) => {
        inUp(c, eo(S(lt, 0.5 + i * 0.25, 1.1 + i * 0.25)), 18);
        const q = eo(S(lt, 0.9 + i * 0.25, 2 + i * 0.25)), v = +$(c, '.cv').dataset.v;
        $(c, '.cv').textContent = Math.round(v * q) + '%'; $(c, '.cb').style.width = Math.min(100, v) * q + '%';
        $$(c, '.kk').forEach((k, j) => inUp(k, eo(S(lt, 1.4 + i * 0.25 + j * 0.12, 1.9 + i * 0.25 + j * 0.12)), 10));
      });
    };
  });

/* ================= 8 · Cierre (48 – 52) ================= */
scene('s8', 48, DUR, `<div class="center">
  <div style="font-size:72px;font-weight:600;letter-spacing:-.03em">Objetivos, KPIs y metas.</div>
  <div style="font-size:72px;font-weight:600;letter-spacing:-.03em;color:#1d4ed8">Todo conectado.</div>
  <div style="font-size:30px;color:var(--muted);margin-top:22px">Si cada KPI llega a su meta, tu objetivo llega al suyo.</div>
  <div class="logo" style="margin-top:56px"><div class="bip">BIP</div><div class="tag">Business<br>Impact<br>Platform</div></div></div>`,
  (node) => { const k = [...$(node, '.center').children]; return (lt) => k.forEach((c, i) => inUp(c, eo(S(lt, 0.1 + i * 0.25, 0.8 + i * 0.25)), 26)); });

/* ================= motor ================= */
window.__DURATION = DUR;
window.__seek = function (t) {
  cursorUsed = false;
  for (const s of SCENES) {
    const ai = s.start <= 0 ? 1 : eo(S(t, s.start - LEAD, s.start + 0.04));
    const ao = s.end >= DUR ? 1 : 1 - eo(S(t, s.end - LEAD, s.end + 0.04));
    const a = Math.min(ai, ao);
    if (a <= 0.002) { s.node.style.display = 'none'; continue; }
    s.node.style.display = 'block'; s.node.style.opacity = a;
    s.draw(Math.max(0, t - s.start), a);
  }
  if (!cursorUsed) { cursorEl.style.opacity = 0; ringEl.style.opacity = 0; }
};
window.__seek(0);
window.__ready = true;
