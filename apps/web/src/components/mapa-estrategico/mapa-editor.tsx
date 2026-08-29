"use client";

// Calibración del Mapa Estratégico (Ciclo 1 — hipótesis).
// Layout mitad/mitad: izquierda objetivos + planes + conexiones; derecha el mapa.
// Modelo: Plan → KPI → sub-indicador (hoja) → Objetivo. Estado en localStorage.

import { useEffect, useMemo, useState } from "react";
import {
  OBJETIVOS_SEED,
  PLANES_SEED,
  MAPA_STORAGE_KEY,
  leavesOf,
  type Objetivo,
  type Plan,
  type SubIndicador,
} from "@/lib/mapa-estrategico-config";

const PALETTE = ["#7a5cf0", "#159a5b", "#d08a1e", "#2f7fe0", "#d94a6a", "#0e9aa7"];

function normPeso(objs: Objetivo[]): number[] {
  const t = objs.reduce((a, o) => a + o.peso, 0) || 1;
  return objs.map((o) => Math.round((o.peso / t) * 100));
}
function shortPlan(n: string): string {
  return n.replace("Mkt de ", "Inf. ").replace("Pauta en ", "").replace(" (CB · Floor · Canal)", "");
}
function shortObj(n: string): string {
  return /inv/i.test(n) ? "Inv / Fact" : n.length > 15 ? n.slice(0, 14) + "…" : n;
}
function shortLeaf(n: string): string {
  if (/top of mind/i.test(n)) return "TOM";
  if (/share of mind/i.test(n)) return "SOM";
  if (/intenci/i.test(n)) return "Intención";
  if (/poder/i.test(n)) return "Poder";
  if (/inv/i.test(n)) return "Inv/Fact";
  if (/factur/i.test(n)) return "Factur.";
  return n.length > 12 ? n.slice(0, 11) + "…" : n;
}
function clip(n: string, mx: number): string {
  return n.length > mx ? n.slice(0, mx - 1) + "…" : n;
}

type Focus = { kind: "kpi"; ki: number } | { kind: "obj"; oid: string } | null;

// ---- SVG del mapa ----------------------------------------------------------

function computeMapSvg(objs: Objetivo[], planes: Plan[], focus: Focus): { inner: string; viewH: number; viewW: number } {
  const leaves = leavesOf(objs);
  const leafIds = new Set(leaves.map((l) => l.id));
  const colorOf = (oid: string) => objs.find((o) => o.id === oid)?.color ?? "#888";
  const np = normPeso(objs);
  const pesoByObj: Record<string, number> = {}; objs.forEach((o, j) => (pesoByObj[o.id] = np[j]!));
  const compById: Record<string, number> = {}; const compSum: Record<string, number> = {};
  objs.forEach((o) => (o.subs ?? []).forEach((sx) => { compById[sx.id] = sx.peso; compSum[o.id] = (compSum[o.id] ?? 0) + sx.peso; }));

  type KpiN = { name: string; links: { id: string; w: number }[]; tot: number; y: number; h: number };
  const K: KpiN[] = [];
  planes.forEach((p) => p.kpis.forEach((kk) => {
    const links: { id: string; w: number }[] = [];
    let tot = 0;
    for (const id in kk.vinculos) { const w = kk.vinculos[id] || 0; if (w && leafIds.has(id)) { links.push({ id, w }); tot += w; } }
    K.push({ name: kk.nombre, links, tot, y: 0, h: 0 });
  }));

  const leafFlow: Record<string, number> = {};
  leaves.forEach((l) => (leafFlow[l.id] = 0));
  K.forEach((k) => k.links.forEach((l) => (leafFlow[l.id] = (leafFlow[l.id] ?? 0) + l.w)));

  const totalFlow = K.reduce((a, k) => a + k.tot, 0) || 1;
  // Escala reducida → recuadros y ribbons más chicos, conexiones más legibles.
  const top = 24, unit = Math.min(2.2, 330 / totalFlow);
  const viewW = 590;
  const xBr = 90, xKpiL = 96, xKpiR = 216, xLeafL = 280, xLeafR = 418, xSalL = 458, xSalR = 566;

  // layout KPI (por plan)
  let y = top, gk = 0;
  const brk: [number, number][] = [];
  planes.forEach((p) => { const b0 = y; p.kpis.forEach((_k, ki) => { const k = K[gk]!; k.y = y; k.h = Math.max(k.tot * unit, 12); y += k.h; if (ki < p.kpis.length - 1) y += 4; gk++; }); brk.push([b0, y]); y += 10; });
  const kpiBot = y - 10;

  // layout terminales (sub-indicadores + objetivos planos), agrupados por objetivo
  const Ls = leaves.map((l) => ({ ...l, flow: leafFlow[l.id]!, y: 0, h: 0 }));
  let nat = 0, prev: string | null = null;
  Ls.forEach((l) => { if (prev !== null) nat += l.objId !== prev ? 20 : 6; nat += Math.max(l.flow * unit, 15); prev = l.objId; });
  let yy = top + ((kpiBot - top) - nat) / 2; prev = null;
  Ls.forEach((l) => { if (prev !== null) yy += l.objId !== prev ? 20 : 6; l.y = yy; l.h = Math.max(l.flow * unit, 15); yy += l.h; prev = l.objId; });
  const Lpos: Record<string, { y: number; h: number }> = {}; Ls.forEach((l) => (Lpos[l.id] = { y: l.y, h: l.h }));

  // nodos-objetivo con sub-indicadores (ej. Salud de Marca), "por detrás"
  const G = objs.filter((o) => o.subs && o.subs.length).map((o) => {
    const subs = Ls.filter((l) => l.objId === o.id);
    const flow = subs.reduce((a, l) => a + l.flow, 0);
    const h = Math.max(flow * unit, 44);
    const c0 = Math.min(...subs.map((k) => k.y)), c1 = Math.max(...subs.map((k) => k.y + k.h));
    return { o, subs, h, y: (c0 + c1) / 2 - h / 2 };
  });

  interface Meta { objId: string; ki?: number }
  function opFor(base: number, m: Meta): number {
    if (!focus) return base;
    const hl = focus.kind === "obj" ? m.objId === focus.oid : m.ki === focus.ki;
    return hl ? 0.62 : 0.05;
  }
  function band(x0: number, y0: number, x1: number, y1: number, w: number, c: string, base: number, m: Meta): string {
    const mx = (x0 + x1) / 2, op = opFor(base, m);
    return `<path pointer-events="none" fill="${c}" fill-opacity="${op}" d="M${x0} ${y0} C${mx} ${y0} ${mx} ${y1} ${x1} ${y1} L${x1} ${y1 + w} C${mx} ${y1 + w} ${mx} ${y0 + w} ${x0} ${y0 + w} Z"/>`;
  }

  let s = "";
  const kOff = K.map((k) => k.y);
  const lIn: Record<string, number> = {}; leaves.forEach((l) => (lIn[l.id] = Lpos[l.id]!.y));
  // KPI → terminal (grosor = contribución del KPI)
  K.forEach((k, ki) => {
    const links = k.links.slice().sort((a, b) => Lpos[a.id]!.y - Lpos[b.id]!.y);
    links.forEach((l) => {
      const oid = leaves.find((x) => x.id === l.id)!.objId;
      s += band(xKpiR, kOff[ki]!, xLeafL, lIn[l.id]!, l.w * unit, colorOf(oid), 0.3, { objId: oid, ki });
      lIn[l.id]! += l.w * unit; kOff[ki]! += l.w * unit;
    });
  });
  // sub-indicador → objetivo (grosor = composición, ej. 25% c/u)
  G.forEach((g) => {
    let salIn = g.y;
    const cs = compSum[g.o.id] || 1;
    g.subs.slice().sort((a, b) => a.y - b.y).forEach((sub) => {
      const rw = ((compById[sub.id] ?? 0) / cs) * g.h;
      const sy = sub.y + sub.h / 2 - rw / 2;
      s += band(xLeafR, sy, xSalL, salIn, rw, g.o.color, 0.4, { objId: g.o.id });
      salIn += rw;
    });
  });

  const dimNode = (objId: string, ki?: number): number => {
    if (!focus) return 1;
    if (focus.kind === "obj") return objId === focus.oid ? 1 : 0.3;
    return ki != null && ki === focus.ki ? 1 : 0.3;
  };

  s += `<text x="${xKpiL - 6}" y="14" text-anchor="end" class="me-colhead">Planes</text><text x="${xKpiL}" y="14" class="me-colhead">KPIs</text><text x="${xLeafL}" y="14" class="me-colhead">Indicadores</text>`;
  planes.forEach((p, pi) => { const b = brk[pi]!, cy = (b[0] + b[1]) / 2; s += `<rect class="me-bracket" x="${xBr}" y="${b[0]}" width="3" height="${b[1] - b[0]}" rx="1.5"/><text class="me-plabel" x="${xBr - 4}" y="${cy + 3.3}" text-anchor="end">${clip(shortPlan(p.nombre), 14)}</text>`; });

  K.forEach((k, ki) => {
    let domC = "hsl(var(--muted-foreground))", mx = 0, objOfKpi = "";
    k.links.forEach((l) => { const o = leaves.find((x) => x.id === l.id)!.objId; if (l.w > mx) { mx = l.w; domC = colorOf(o); objOfKpi = o; } });
    s += `<g data-kpi="${ki}" opacity="${dimNode(objOfKpi, ki)}" style="cursor:pointer"><rect class="me-kpibox" x="${xKpiL}" y="${k.y}" width="${xKpiR - xKpiL}" height="${k.h}" rx="${Math.min(4, k.h / 2)}"/><rect x="${xKpiL}" y="${k.y}" width="2.5" height="${k.h}" rx="1.2" fill="${domC}"/>${k.h >= 10 ? `<text class="me-kpi-nm" x="${xKpiL + 7}" y="${k.y + k.h / 2 + 3}">${clip(k.name, 17)}</text>` : ""}</g>`;
  });
  // terminales
  Ls.forEach((l) => {
    const c = l.color, flat = l.id === l.objId, comp = compById[l.id];
    const badge = flat ? `peso ${pesoByObj[l.objId]}%` : `${comp ?? ""}%`;
    s += `<g data-obj="${l.objId}" opacity="${dimNode(l.objId)}" style="cursor:pointer"><rect x="${xLeafL}" y="${l.y}" width="${xLeafR - xLeafL}" height="${l.h}" rx="6" fill="${c}${flat ? "22" : "18"}" stroke="${c}" stroke-opacity=".6"/><rect x="${xLeafL}" y="${l.y}" width="3" height="${l.h}" rx="1.5" fill="${c}"/>` +
      `<text class="me-ind-nm" x="${xLeafL + 8}" y="${l.y + l.h / 2 + (l.h >= 24 ? -1 : 3)}">${clip(flat ? shortObj(l.nombre) : l.nombre, 18)}</text>${l.h >= 24 ? `<text class="me-ind-badge" x="${xLeafL + 8}" y="${l.y + l.h / 2 + 9}">${badge}</text>` : ""}</g>`;
  });
  // nodos-objetivo (Salud de Marca) por detrás
  G.forEach((g) => {
    const c = g.o.color, cy = g.y + g.h / 2;
    s += `<g data-obj="${g.o.id}" opacity="${dimNode(g.o.id)}" style="cursor:pointer"><rect x="${xSalL}" y="${g.y}" width="${xSalR - xSalL}" height="${g.h}" rx="9" fill="${c}22" stroke="${c}" stroke-opacity=".65"/><rect x="${xSalL}" y="${g.y}" width="3.5" height="${g.h}" rx="2" fill="${c}"/>` +
      `<text class="me-oname" x="${xSalL + 10}" y="${cy - 2}">${shortObj(g.o.nombre)}</text><text x="${xSalL + 10}" y="${cy + 11}" class="me-badge" style="fill:${c}">peso ${pesoByObj[g.o.id]}%</text></g>`;
  });

  const viewH = Math.max(kpiBot, ...Ls.map((l) => l.y + l.h), ...G.map((g) => g.y + g.h)) + 12;
  return { inner: s, viewH, viewW };
}

// ---- componente ------------------------------------------------------------

export function MapaEditor() {
  const [objs, setObjs] = useState<Objetivo[]>(OBJETIVOS_SEED);
  const [planes, setPlanes] = useState<Plan[]>(PLANES_SEED);
  const [hydrated, setHydrated] = useState(false);
  const [focus, setFocus] = useState<Focus>(null);
  const [nextO, setNextO] = useState(4);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MAPA_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { objs?: Objetivo[]; planes?: Plan[] };
        if (parsed.objs && parsed.planes) { setObjs(parsed.objs); setPlanes(parsed.planes); setNextO(parsed.objs.length + 1); }
      }
    } catch { /* seed */ }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(MAPA_STORAGE_KEY, JSON.stringify({ objs, planes })); } catch { /* ignore */ }
  }, [objs, planes, hydrated]);

  const np = useMemo(() => normPeso(objs), [objs]);
  const leaves = useMemo(() => leavesOf(objs), [objs]);
  const groups = useMemo(() => {
    const g: { objId: string; nombre: string; color: string; count: number }[] = [];
    leaves.forEach((l) => {
      const last = g[g.length - 1];
      if (last && last.objId === l.objId) last.count++;
      else g.push({ objId: l.objId, nombre: l.objNombre, color: l.color, count: 1 });
    });
    return g;
  }, [leaves]);
  const svg = useMemo(() => computeMapSvg(objs, planes, focus), [objs, planes, focus]);

  const readout = useMemo(() => {
    const kcount = objs.map(() => 0);
    const leafObj: Record<string, string> = {}; leaves.forEach((l) => (leafObj[l.id] = l.objId));
    let nLinks = 0;
    planes.forEach((p) => p.kpis.forEach((kk) => {
      for (const id in kk.vinculos) {
        if (!kk.vinculos[id] || leafObj[id] === undefined) continue;
        nLinks++;
        const oi = objs.findIndex((o) => o.id === leafObj[id]);
        if (oi >= 0) kcount[oi]!++;
      }
    }));
    return { nLinks, kcount, maxK: Math.max(1, ...kcount) };
  }, [objs, planes, leaves]);

  const patchObjs = (fn: (d: Objetivo[]) => void) => setObjs((prev) => { const d = structuredClone(prev); fn(d); return d; });
  const patchPlanes = (fn: (d: Plan[]) => void) => setPlanes((prev) => { const d = structuredClone(prev); fn(d); return d; });

  function setPeso(i: number, v: number) { patchObjs((d) => { d[i]!.peso = v; }); }
  function setObjName(i: number, v: string) { patchObjs((d) => { d[i]!.nombre = v; }); }
  function addObj() { patchObjs((d) => d.push({ id: `o${nextO}`, nombre: "Nuevo objetivo", color: PALETTE[d.length % PALETTE.length]!, peso: 20 })); setNextO((n) => n + 1); }
  function removeObj(i: number) {
    const rem = leavesOf([objs[i]!]).map((l) => l.id);
    patchObjs((d) => { d.splice(i, 1); });
    patchPlanes((d) => d.forEach((p) => p.kpis.forEach((k) => rem.forEach((id) => { delete k.vinculos[id]; }))));
  }
  function setLink(pi: number, ki: number, leafId: string, v: number) {
    patchPlanes((d) => { const lnk = d[pi]!.kpis[ki]!.vinculos; if (v) lnk[leafId] = v; else delete lnk[leafId]; });
  }
  function setKpiName(pi: number, ki: number, v: string) { patchPlanes((d) => { d[pi]!.kpis[ki]!.nombre = v; }); }
  function setPlanName(pi: number, v: string) { patchPlanes((d) => { d[pi]!.nombre = v; }); }
  function addKpi(pi: number) { patchPlanes((d) => d[pi]!.kpis.push({ nombre: "Nuevo indicador", vinculos: {} })); }
  function removeKpi(pi: number, ki: number) { patchPlanes((d) => d[pi]!.kpis.splice(ki, 1)); }
  function removePlan(pi: number) { patchPlanes((d) => d.splice(pi, 1)); }
  function addPlan() { patchPlanes((d) => d.push({ nombre: "Nuevo plan", kpis: [{ nombre: "Nuevo indicador", vinculos: {} }] })); }

  function onHover(e: React.MouseEvent<HTMLDivElement>) {
    let el: Element | null = e.target as Element;
    while (el && el !== e.currentTarget) {
      const k = el.getAttribute?.("data-kpi"); if (k != null) { setFocus({ kind: "kpi", ki: +k }); return; }
      const o = el.getAttribute?.("data-obj"); if (o != null) { setFocus({ kind: "obj", oid: o }); return; }
      el = el.parentElement;
    }
    setFocus(null);
  }

  const cols = `minmax(0,1.25fr) repeat(${leaves.length}, minmax(52px,1fr))`;

  return (
    <div className="mapa-cal">
      <style>{`
        .mapa-cal input[type=range]{-webkit-appearance:none;appearance:none;height:5px;border-radius:3px;background:hsl(var(--border));cursor:pointer}
        .mapa-cal input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:var(--c,hsl(var(--primary)));border:2px solid hsl(var(--card));box-shadow:0 1px 3px #0003}
        .mapa-cal input[type=range]::-moz-range-thumb{width:12px;height:12px;border:2px solid hsl(var(--card));border-radius:50%;background:var(--c,hsl(var(--primary)))}
        .mapa-cal .me-colhead{font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;fill:hsl(var(--muted-foreground));font-family:ui-monospace,monospace;pointer-events:none}
        .mapa-cal .me-plabel{font-weight:600;font-size:9.5px;fill:hsl(var(--foreground));pointer-events:none}
        .mapa-cal .me-kpi-nm{font-size:9px;fill:hsl(var(--muted-foreground));pointer-events:none}
        .mapa-cal .me-ind-nm{font-weight:600;font-size:9.5px;fill:hsl(var(--foreground));pointer-events:none}
        .mapa-cal .me-ind-badge{font-family:ui-monospace,monospace;font-size:7.5px;fill:hsl(var(--muted-foreground));pointer-events:none}
        .mapa-cal .me-oname{font-weight:700;font-size:11px;fill:hsl(var(--foreground));pointer-events:none}
        .mapa-cal .me-bracket{fill:hsl(var(--muted-foreground));opacity:.35;pointer-events:none}
        .mapa-cal .me-kpibox{fill:hsl(var(--muted));stroke:hsl(var(--border))}
        .mapa-cal .me-badge{font-family:ui-monospace,monospace;font-size:8.5px;font-weight:500;pointer-events:none}
        .mapa-cal svg g[data-kpi],.mapa-cal svg g[data-obj]{transition:opacity .12s}
      `}</style>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ---- izquierda: calibración ---- */}
        <div className="flex flex-col gap-5">
          {/* Objetivos */}
          <section>
            <div className="mb-2.5 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-secondary font-mono text-xs font-semibold">1</span>
              <h3 className="text-sm font-semibold tracking-tight">Objetivos estratégicos</h3>
              <button onClick={addObj} className="ml-auto text-xs font-semibold text-primary hover:underline">+ Agregar</button>
            </div>
            <div className="space-y-2">
              {objs.map((o, i) => (
                <div key={o.id} className="rounded-xl border bg-card px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="h-3 w-3 shrink-0 rounded" style={{ background: o.color }} />
                    <input value={o.nombre} onChange={(e) => setObjName(i, e.target.value)} className="w-full min-w-0 bg-transparent text-sm font-semibold outline-none focus:border-b focus:border-primary" />
                    <div className="flex flex-[0_0_130px] items-center gap-2">
                      <input type="range" min={0} max={100} value={o.peso} onChange={(e) => setPeso(i, +e.target.value)} style={{ ["--c" as string]: o.color, flex: 1 }} />
                      <span className="w-8 text-right font-mono text-xs font-semibold tabular-nums">{np[i]}%</span>
                    </div>
                    {objs.length > 1 && <button onClick={() => removeObj(i)} title="Quitar" className="text-muted-foreground hover:text-destructive">✕</button>}
                  </div>
                  {o.subs && o.subs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2">
                      {o.subs.map((s) => <SubChip key={s.id} s={s} color={o.color} />)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground"><b className="text-foreground">Peso estratégico</b> = importancia relativa (suma 100%). Los chips son los <b className="text-foreground">componentes</b> del objetivo.</p>
          </section>

          {/* Matriz de conexiones */}
          <section>
            <div className="mb-2.5 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-secondary font-mono text-xs font-semibold">2</span>
              <h3 className="text-sm font-semibold tracking-tight">Conexiones · KPI → sub-indicador</h3>
            </div>
            <div className="overflow-x-auto rounded-xl border bg-card">
              <div style={{ minWidth: 120 + leaves.length * 54 }}>
                {/* header: grupo objetivo */}
                <div className="grid bg-secondary/40" style={{ gridTemplateColumns: cols }}>
                  <div />
                  {groups.map((g) => (
                    <div key={g.objId} className="border-l px-1 py-1 text-center font-mono text-[9px] font-semibold uppercase tracking-wide" style={{ gridColumn: `span ${g.count}`, color: g.color }}>{shortObj(g.nombre)}</div>
                  ))}
                </div>
                {/* header: hojas */}
                <div className="grid border-b bg-secondary/40" style={{ gridTemplateColumns: cols }}>
                  <div className="px-2 py-1 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Indicador</div>
                  {leaves.map((l) => (
                    <div key={l.id} className="border-l px-1 py-1 text-center font-mono text-[9px]" style={{ color: l.color }}>{shortLeaf(l.nombre)}</div>
                  ))}
                </div>
                {/* filas por plan */}
                {planes.map((p, pi) => (
                  <div key={pi}>
                    <div className="flex items-center gap-2 border-b border-t bg-secondary/40 px-2 py-1">
                      <input value={p.nombre} onChange={(e) => setPlanName(pi, e.target.value)} className="min-w-0 flex-1 bg-transparent text-[11px] font-bold text-muted-foreground outline-none focus:text-foreground" />
                      <button onClick={() => addKpi(pi)} className="whitespace-nowrap text-[10px] font-semibold text-primary hover:underline">+ KPI</button>
                      {planes.length > 1 && <button onClick={() => removePlan(pi)} title="Quitar plan" className="text-[11px] text-muted-foreground hover:text-destructive">✕</button>}
                    </div>
                    {p.kpis.map((k, ki) => (
                      <div key={ki} className="group grid items-center border-b last:border-b-0" style={{ gridTemplateColumns: cols }}>
                        <div className="flex items-center gap-1 py-1 pl-2 pr-1">
                          <input value={k.nombre} onChange={(e) => setKpiName(pi, ki, e.target.value)} className="min-w-0 flex-1 bg-transparent text-[11.5px] outline-none focus:text-foreground" />
                          {p.kpis.length > 1 && <button onClick={() => removeKpi(pi, ki)} title="Quitar" className="text-[11px] text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100">✕</button>}
                        </div>
                        {leaves.map((l) => {
                          const h = k.vinculos[l.id] || 0;
                          return (
                            <div key={l.id} className="flex min-h-[40px] flex-col justify-center gap-0.5 border-l px-1.5 py-1">
                              <span className="text-center font-mono text-[10px] font-semibold" style={{ color: h ? l.color : "hsl(var(--muted-foreground))" }}>{h ? h + "%" : "·"}</span>
                              <input type="range" min={0} max={100} value={h} onChange={(e) => setLink(pi, ki, l.id, +e.target.value)} style={{ ["--c" as string]: l.color, width: "100%", height: 3 }} />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ))}
                <div className="p-2"><button onClick={addPlan} className="w-full rounded-lg border border-dashed py-1.5 text-[11px] font-semibold text-primary hover:border-primary">+ Agregar plan</button></div>
              </div>
            </div>
          </section>
        </div>

        {/* ---- derecha: mapa ---- */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className="text-sm font-semibold tracking-tight">Mapa de conexiones</h3>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">hover para aislar</span>
            </div>
            <div onMouseMove={onHover} onMouseLeave={() => setFocus(null)}>
              <svg viewBox={`0 0 ${svg.viewW} ${svg.viewH}`} role="img" aria-label="Mapa Plan → KPI → sub-indicador → objetivo" className="block h-auto w-full" dangerouslySetInnerHTML={{ __html: svg.inner }} />
            </div>
          </div>
          <div className="mt-3.5 rounded-xl border bg-card px-4 py-3.5">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Vínculos por objetivo</span>
              <span className="font-mono text-xs text-muted-foreground">{readout.nLinks} vínculos</span>
            </div>
            <div className="mt-2.5 space-y-2.5">
              {objs.map((o, i) => (
                <div key={o.id} className="grid grid-cols-[130px_1fr_auto] items-center gap-2.5 text-xs">
                  <span className="flex items-center gap-2 text-foreground"><span className="h-2.5 w-2.5 rounded" style={{ background: o.color }} />{shortObj(o.nombre)}</span>
                  <span className="h-1.5 overflow-hidden rounded bg-muted"><i className="block h-full rounded" style={{ width: `${Math.round((readout.kcount[i]! / readout.maxK) * 100)}%`, background: o.color }} /></span>
                  <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground"><b style={{ color: o.color }}>{readout.kcount[i]}</b></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubChip({ s, color }: { s: SubIndicador; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px]" style={{ borderColor: `${color}66` }}>
      <span className="font-medium">{s.nombre}</span>
      <span className="font-mono text-[9.5px] text-muted-foreground">{s.peso}%</span>
    </span>
  );
}
