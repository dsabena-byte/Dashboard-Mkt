"use client";

// Pantalla de calibración del Mapa Estratégico (Ciclo 1 — hipótesis).
// Modelo jerárquico: Plan → KPI → sub-indicador (hoja) → [intermedio] → Objetivo.
// Estado en memoria + localStorage (calibración manual de arranque; sin Supabase).

import { useEffect, useMemo, useState } from "react";
import {
  OBJETIVOS_SEED,
  PLANES_SEED,
  MAPA_STORAGE_KEY,
  leavesOf,
  type Objetivo,
  type Plan,
  type SubIndicador,
  type Leaf,
} from "@/lib/mapa-estrategico-config";

// ---- helpers puros ---------------------------------------------------------

function normPeso(objs: Objetivo[]): number[] {
  const t = objs.reduce((a, o) => a + o.peso, 0) || 1;
  return objs.map((o) => Math.round((o.peso / t) * 100));
}

function shortPlan(n: string): string {
  return n.replace("Plan de ", "").replace("Mkt de ", "Inf. ").replace("Pauta en ", "").replace(" (CB · Floor · Canal)", "");
}
function shortObj(n: string): string {
  return /inv/i.test(n) ? "Inv Mkt / Fact" : n.length > 16 ? n.slice(0, 15) + "…" : n;
}
function clip(n: string, mx: number): string {
  return n.length > mx ? n.slice(0, mx - 1) + "…" : n;
}

interface Intermedio { id: string; nombre: string; peso: number; objId: string; color: string }

function intermediosOf(objs: Objetivo[]): Intermedio[] {
  const out: Intermedio[] = [];
  for (const o of objs) for (const s of o.subs ?? []) {
    if (s.subs && s.subs.length) out.push({ id: s.id, nombre: s.nombre, peso: s.peso, objId: o.id, color: o.color });
  }
  return out;
}

// ---- SVG del mapa (árbol) --------------------------------------------------

function computeMapSvg(objs: Objetivo[], planes: Plan[]): { inner: string; viewH: number } {
  const leaves = leavesOf(objs);
  const subLeaves = leaves.filter((l) => l.id !== l.objId); // hojas reales (excluye objetivos planos)
  const subLeafIds = new Set(subLeaves.map((l) => l.id));
  const objIds = new Set(objs.map((o) => o.id));
  const intermedios = intermediosOf(objs);
  const colorOf = (oid: string) => objs.find((o) => o.id === oid)?.color ?? "#888";

  // KPIs planos con sus links clasificados
  type KpiN = { name: string; leafLinks: { id: string; w: number }[]; directLinks: { id: string; w: number }[]; tot: number; y: number; h: number };
  const K: KpiN[] = [];
  planes.forEach((p) => p.kpis.forEach((kk) => {
    const leafLinks: { id: string; w: number }[] = [];
    const directLinks: { id: string; w: number }[] = [];
    let tot = 0;
    for (const id in kk.vinculos) {
      const w = kk.vinculos[id] || 0;
      if (!w) continue;
      if (subLeafIds.has(id)) { leafLinks.push({ id, w }); tot += w; }
      else if (objIds.has(id)) { directLinks.push({ id, w }); tot += w; }
    }
    K.push({ name: kk.nombre, leafLinks, directLinks, tot, y: 0, h: 0 });
  }));

  // flujos
  const leafFlow: Record<string, number> = {};
  subLeaves.forEach((l) => (leafFlow[l.id] = 0));
  K.forEach((k) => k.leafLinks.forEach((l) => (leafFlow[l.id] = (leafFlow[l.id] ?? 0) + l.w)));
  const intFlow: Record<string, number> = {};
  intermedios.forEach((it) => (intFlow[it.id] = subLeaves.filter((l) => l.intermedioId === it.id).reduce((a, l) => a + leafFlow[l.id]!, 0)));
  const objFlow: Record<string, number> = {};
  objs.forEach((o) => {
    let f = 0;
    K.forEach((k) => k.directLinks.forEach((d) => { if (d.id === o.id) f += d.w; }));
    subLeaves.forEach((l) => { if (l.objId === o.id && !l.intermedioId) f += leafFlow[l.id]!; });
    intermedios.forEach((it) => { if (it.objId === o.id) f += intFlow[it.id]!; });
    objFlow[o.id] = f;
  });

  const totalFlow = K.reduce((a, k) => a + k.tot, 0) || 1;
  const top = 28, unit = Math.min(3.2, 500 / totalFlow);
  const xBr = 108, xKpiL = 114, xKpiR = 250, xLeafL = 300, xLeafR = 396, xIntL = 436, xIntR = 462, xObjL = 552, xObjR = 632;

  // layout KPI (por plan)
  let y = top, gk = 0;
  const brk: [number, number][] = [];
  planes.forEach((p) => {
    const b0 = y;
    p.kpis.forEach((_k, ki) => { const k = K[gk]!; k.y = y; k.h = Math.max(k.tot * unit, 14); y += k.h; if (ki < p.kpis.length - 1) y += 4; gk++; });
    brk.push([b0, y]); y += 12;
  });
  const kpiBot = y - 12;

  // layout centrado genérico
  function layoutCol<T extends { flow: number; grp: string; y?: number; h?: number }>(list: T[], gapIn: number, gapGrp: number, minH: number) {
    let nat = 0, prev: string | null = null;
    list.forEach((n) => { if (prev !== null) nat += n.grp !== prev ? gapGrp : gapIn; nat += Math.max(n.flow * unit, minH); prev = n.grp; });
    let yy = top + ((kpiBot - top) - nat) / 2; prev = null;
    list.forEach((n) => { if (prev !== null) yy += n.grp !== prev ? gapGrp : gapIn; n.y = yy; n.h = Math.max(n.flow * unit, minH); yy += n.h; prev = n.grp; });
  }

  const Ls = subLeaves.map((l) => ({ ...l, flow: leafFlow[l.id]!, grp: l.objId, y: 0, h: 0 }));
  layoutCol(Ls, 5, 16, 14);
  const Lpos: Record<string, { y: number; h: number }> = {};
  Ls.forEach((l) => (Lpos[l.id] = { y: l.y, h: l.h }));

  const Os = objs.map((o) => ({ id: o.id, nombre: o.nombre, color: o.color, flow: objFlow[o.id]!, grp: o.id, y: 0, h: 0 }));
  layoutCol(Os, 0, 24, 30);
  const Opos: Record<string, { y: number; h: number }> = {};
  Os.forEach((o) => (Opos[o.id] = { y: o.y, h: o.h }));

  // intermedios: abarcan sus hojas
  const Ipos: Record<string, { y: number; h: number }> = {};
  intermedios.forEach((it) => {
    const kids = Ls.filter((l) => l.intermedioId === it.id);
    if (!kids.length) return;
    const y0 = Math.min(...kids.map((k) => k.y)), y1 = Math.max(...kids.map((k) => k.y + k.h));
    Ipos[it.id] = { y: y0, h: y1 - y0 };
  });

  function band(x0: number, y0: number, x1: number, y1: number, w: number, c: string, op: number): string {
    const mx = (x0 + x1) / 2;
    return `<path fill="${c}" fill-opacity="${op}" d="M${x0} ${y0} C${mx} ${y0} ${mx} ${y1} ${x1} ${y1} L${x1} ${y1 + w} C${mx} ${y1 + w} ${mx} ${y0 + w} ${x0} ${y0 + w} Z"/>`;
  }

  let s = "";
  const kOff = K.map((k) => k.y);
  const lIn: Record<string, number> = {}; subLeaves.forEach((l) => (lIn[l.id] = Lpos[l.id]!.y));
  const objIn: Record<string, number> = {}; objs.forEach((o) => (objIn[o.id] = Opos[o.id]!.y));

  // stage 1: KPI → hoja  y  KPI → objetivo (directo), ordenado por y del destino
  K.forEach((k, ki) => {
    const dy = (id: string, isLeaf: boolean) => (isLeaf ? Lpos[id]!.y : Opos[id]!.y);
    const links = [
      ...k.leafLinks.map((l) => ({ ...l, leaf: true })),
      ...k.directLinks.map((l) => ({ ...l, leaf: false })),
    ].sort((a, b) => dy(a.id, a.leaf) - dy(b.id, b.leaf));
    links.forEach((l) => {
      const c = l.leaf ? colorOf(subLeaves.find((x) => x.id === l.id)!.objId) : colorOf(l.id);
      if (l.leaf) { s += band(xKpiR, kOff[ki]!, xLeafL, lIn[l.id]!, l.w * unit, c, 0.3); lIn[l.id]! += l.w * unit; }
      else { s += band(xKpiR, kOff[ki]!, xObjL, objIn[l.id]!, l.w * unit, c, 0.4); objIn[l.id]! += l.w * unit; }
      kOff[ki]! += l.w * unit;
    });
  });
  // stage 2: hojas de intermedio → intermedio (rectas)  y  hojas directas → objetivo
  //  primero las hojas directas (arriba), luego los intermedios (abajo), por objetivo
  subLeaves.forEach((l) => {
    if (l.intermedioId) { const p = Lpos[l.id]!; s += band(xLeafR, p.y, xIntL, p.y, p.h, colorOf(l.objId), 0.34); }
  });
  subLeaves.filter((l) => !l.intermedioId).forEach((l) => {
    const c = colorOf(l.objId); s += band(xLeafR, Lpos[l.id]!.y, xObjL, objIn[l.objId]!, leafFlow[l.id]! * unit, c, 0.42); objIn[l.objId]! += leafFlow[l.id]! * unit;
  });
  // stage 3: intermedio → objetivo
  intermedios.forEach((it) => {
    const p = Ipos[it.id]; if (!p) return; const c = colorOf(it.objId);
    s += band(xIntR, p.y, xObjL, objIn[it.objId]!, intFlow[it.id]! * unit, c, 0.42); objIn[it.objId]! += intFlow[it.id]! * unit;
  });

  // headers
  s += `<text x="100" y="18" text-anchor="end" class="me-colhead">Planes</text><text x="${xKpiL}" y="18" class="me-colhead">KPIs</text><text x="${xLeafL}" y="18" class="me-colhead">Sub-indicadores</text><text x="${xObjL}" y="18" class="me-colhead">Objetivos</text>`;
  planes.forEach((p, pi) => { const b = brk[pi]!, cy = (b[0] + b[1]) / 2; s += `<rect class="me-bracket" x="${xBr}" y="${b[0]}" width="3" height="${b[1] - b[0]}" rx="1.5"/><text class="me-plabel" x="100" y="${cy + 3.5}" text-anchor="end">${clip(shortPlan(p.nombre), 16)}</text>`; });
  // KPI boxes
  K.forEach((k) => {
    let domC = "hsl(var(--muted-foreground))", mx = 0;
    k.leafLinks.forEach((l) => { if (l.w > mx) { mx = l.w; domC = colorOf(subLeaves.find((x) => x.id === l.id)!.objId); } });
    k.directLinks.forEach((l) => { if (l.w > mx) { mx = l.w; domC = colorOf(l.id); } });
    s += `<rect class="me-kpibox" x="${xKpiL}" y="${k.y}" width="${xKpiR - xKpiL}" height="${k.h}" rx="${Math.min(5, k.h / 2)}"/><rect x="${xKpiL}" y="${k.y}" width="2.5" height="${k.h}" rx="1.2" fill="${domC}"/>${k.h >= 11 ? `<text class="me-kpi-nm" x="${xKpiL + 8}" y="${k.y + k.h / 2 + 3.2}">${clip(k.name, 19)}</text>` : ""}`;
  });
  // hojas
  Ls.forEach((l) => {
    const c = l.color, comp = objs.flatMap((o) => o.subs ?? []).flatMap((sx) => [sx, ...(sx.subs ?? [])]).find((sx) => sx.id === l.id)?.peso;
    s += `<rect x="${xLeafL}" y="${l.y}" width="${xLeafR - xLeafL}" height="${l.h}" rx="6" fill="${c}1c" stroke="${c}" stroke-opacity=".5"/><rect x="${xLeafL}" y="${l.y}" width="2.5" height="${l.h}" rx="1.2" fill="${c}"/>` +
      `<text class="me-ind-nm" x="${xLeafL + 8}" y="${l.y + l.h / 2 + (comp ? -1 : 3.2)}">${clip(l.nombre, 15)}</text>${comp ? `<text class="me-ind-badge" x="${xLeafL + 8}" y="${l.y + l.h / 2 + 9}">compone ${comp}%</text>` : ""}`;
  });
  // intermedios
  intermedios.forEach((it) => {
    const p = Ipos[it.id]; if (!p) return; const c = it.color;
    s += `<rect x="${xIntL}" y="${p.y}" width="${xIntR - xIntL}" height="${p.h}" rx="6" fill="${c}26" stroke="${c}" stroke-opacity=".7"/>` +
      `<text transform="translate(${xIntL + (xIntR - xIntL) / 2 + 4},${p.y + p.h / 2}) rotate(-90)" text-anchor="middle" class="me-int-nm" style="fill:${c}">${clip(it.nombre.replace("Poder de Marca", "Poder"), 12)} · ${it.peso}%</text>`;
  });
  // objetivos
  const np = normPeso(objs);
  Os.forEach((o, j) => {
    const c = o.color;
    s += `<rect x="${xObjL}" y="${o.y}" width="${xObjR - xObjL}" height="${o.h}" rx="8" fill="${c}22" stroke="${c}" stroke-opacity=".6"/><rect x="${xObjL}" y="${o.y}" width="3.5" height="${o.h}" rx="2" fill="${c}"/>` +
      `<text class="me-oname" x="${xObjL + 10}" y="${o.y + o.h / 2 + 1}">${shortObj(o.nombre)}</text>` +
      `<text x="${xObjL + 10}" y="${o.y + o.h / 2 + 13}" class="me-badge" style="fill:${c}">peso ${np[j]}%</text>`;
  });

  const viewH = Math.max(kpiBot, Os[Os.length - 1]!.y + Os[Os.length - 1]!.h) + 14;
  return { inner: s, viewH };
}

// ---- componente ------------------------------------------------------------

export function MapaEditor() {
  const [objs, setObjs] = useState<Objetivo[]>(OBJETIVOS_SEED);
  const [planes, setPlanes] = useState<Plan[]>(PLANES_SEED);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(MAPA_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { objs?: Objetivo[]; planes?: Plan[] };
        if (parsed.objs && parsed.planes) { setObjs(parsed.objs); setPlanes(parsed.planes); }
      }
    } catch { /* sin localStorage → seed */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(MAPA_STORAGE_KEY, JSON.stringify({ objs, planes })); } catch { /* ignore */ }
  }, [objs, planes, hydrated]);

  const np = useMemo(() => normPeso(objs), [objs]);
  const leaves = useMemo(() => leavesOf(objs), [objs]);
  const leafInfo = useMemo(() => {
    const m: Record<string, Leaf> = {};
    leaves.forEach((l) => (m[l.id] = l));
    return m;
  }, [leaves]);
  const intermedioNombre = useMemo(() => {
    const m: Record<string, string> = {};
    objs.forEach((o) => (o.subs ?? []).forEach((s) => { if (s.subs?.length) m[s.id] = s.nombre; }));
    return m;
  }, [objs]);
  const svg = useMemo(() => computeMapSvg(objs, planes), [objs, planes]);

  // readout: vínculos KPI→hoja agregados por objetivo
  const readout = useMemo(() => {
    let nLinks = 0, nK = 0;
    const kcount = objs.map(() => 0);
    planes.forEach((p) => p.kpis.forEach((kk) => {
      nK++;
      for (const id in kk.vinculos) {
        if (!kk.vinculos[id]) continue;
        const info = leafInfo[id];
        if (!info) continue;
        nLinks++;
        const oi = objs.findIndex((o) => o.id === info.objId);
        if (oi >= 0) kcount[oi]!++;
      }
    }));
    const maxK = Math.max(1, ...kcount);
    return { nLinks, nK, kcount, maxK };
  }, [objs, planes, leafInfo]);

  // ---- mutadores ----
  const patchObjs = (fn: (d: Objetivo[]) => void) => setObjs((prev) => { const d = structuredClone(prev); fn(d); return d; });
  const patchPlanes = (fn: (d: Plan[]) => void) => setPlanes((prev) => { const d = structuredClone(prev); fn(d); return d; });

  function setPeso(i: number, v: number) { patchObjs((d) => { d[i]!.peso = v; }); }
  function setObjName(i: number, v: string) { patchObjs((d) => { d[i]!.nombre = v; }); }
  function setLink(pi: number, ki: number, leafId: string, v: number) {
    patchPlanes((d) => { const lnk = d[pi]!.kpis[ki]!.vinculos; if (v) lnk[leafId] = v; else delete lnk[leafId]; });
  }
  function addLink(pi: number, ki: number, leafId: string) { patchPlanes((d) => { d[pi]!.kpis[ki]!.vinculos[leafId] = 50; }); }
  function setKpiName(pi: number, ki: number, v: string) { patchPlanes((d) => { d[pi]!.kpis[ki]!.nombre = v; }); }
  function setPlanName(pi: number, v: string) { patchPlanes((d) => { d[pi]!.nombre = v; }); }
  function addKpi(pi: number) { patchPlanes((d) => d[pi]!.kpis.push({ nombre: "Nuevo indicador", vinculos: {} })); }
  function removeKpi(pi: number, ki: number) { patchPlanes((d) => d[pi]!.kpis.splice(ki, 1)); }
  function removePlan(pi: number) { patchPlanes((d) => d.splice(pi, 1)); }
  function addPlan() { patchPlanes((d) => d.push({ nombre: "Nuevo plan", kpis: [{ nombre: "Nuevo indicador", vinculos: {} }] })); }

  function leafLabel(id: string): string {
    const info = leafInfo[id];
    if (!info) return id;
    if (info.id === info.objId) return info.nombre; // objetivo plano
    return info.intermedioId ? `${info.nombre} · ${intermedioNombre[info.intermedioId] ?? ""}`.replace(/ · $/, "") : info.nombre;
  }

  // opciones del selector agrupadas por objetivo
  const leafGroups = useMemo(() => objs.map((o) => ({
    obj: o,
    hojas: leaves.filter((l) => l.objId === o.id),
  })), [objs, leaves]);

  return (
    <div className="mapa-cal">
      <style>{`
        .mapa-cal input[type=range]{-webkit-appearance:none;appearance:none;height:5px;border-radius:3px;background:hsl(var(--border));cursor:pointer}
        .mapa-cal input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:var(--c,hsl(var(--primary)));border:2px solid hsl(var(--card));box-shadow:0 1px 3px #0003}
        .mapa-cal input[type=range]::-moz-range-thumb{width:13px;height:13px;border:2px solid hsl(var(--card));border-radius:50%;background:var(--c,hsl(var(--primary)))}
        .mapa-cal .me-colhead{font-size:9px;letter-spacing:.06em;text-transform:uppercase;fill:hsl(var(--muted-foreground));font-family:ui-monospace,monospace}
        .mapa-cal .me-plabel{font-weight:600;font-size:10px;fill:hsl(var(--foreground))}
        .mapa-cal .me-kpi-nm{font-size:9.5px;fill:hsl(var(--muted-foreground))}
        .mapa-cal .me-ind-nm{font-weight:600;font-size:10px;fill:hsl(var(--foreground))}
        .mapa-cal .me-ind-badge{font-family:ui-monospace,monospace;font-size:8px;fill:hsl(var(--muted-foreground))}
        .mapa-cal .me-int-nm{font-family:ui-sans-serif,system-ui;font-weight:700;font-size:10px}
        .mapa-cal .me-oname{font-weight:700;font-size:12px;fill:hsl(var(--foreground))}
        .mapa-cal .me-bracket{fill:hsl(var(--muted-foreground));opacity:.35}
        .mapa-cal .me-kpibox{fill:hsl(var(--muted));stroke:hsl(var(--border))}
        .mapa-cal .me-badge{font-family:ui-monospace,monospace;font-size:9px;font-weight:500}
      `}</style>

      <div className="flex flex-col gap-6">
          {/* Objetivos + composición */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-secondary font-mono text-xs font-semibold">1</span>
              <h3 className="text-sm font-semibold tracking-tight">Objetivos y su composición</h3>
            </div>
            <div className="space-y-2">
              {objs.map((o, i) => (
                <div key={o.id} className="rounded-xl border bg-card px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 shrink-0 rounded" style={{ background: o.color }} />
                    <input value={o.nombre} onChange={(e) => setObjName(i, e.target.value)} className="w-full bg-transparent text-sm font-semibold outline-none focus:border-b focus:border-primary" />
                    <div className="flex flex-[0_0_150px] items-center gap-2">
                      <input type="range" min={0} max={100} value={o.peso} onChange={(e) => setPeso(i, +e.target.value)} style={{ ["--c" as string]: o.color, flex: 1 }} />
                      <span className="w-9 text-right font-mono text-xs font-semibold tabular-nums">{np[i]}%</span>
                    </div>
                  </div>
                  {o.subs && o.subs.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2">
                      {o.subs.map((s) => <SubChip key={s.id} s={s} color={o.color} />)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">
              <b className="text-foreground">Peso estratégico</b> = importancia relativa de cada objetivo (suma 100%). Los chips son los <b className="text-foreground">componentes</b> con su peso de composición; los KPIs se conectan a ellos.
            </p>
          </section>

          {/* Conexiones por KPI */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-secondary font-mono text-xs font-semibold">2</span>
              <h3 className="text-sm font-semibold tracking-tight">Conexiones de cada KPI</h3>
            </div>
            <div className="space-y-3">
              {planes.map((p, pi) => (
                <div key={pi} className="overflow-hidden rounded-xl border bg-card">
                  <div className="flex items-center gap-2 border-b bg-secondary/40 px-3 py-1.5">
                    <input value={p.nombre} onChange={(e) => setPlanName(pi, e.target.value)} className="min-w-0 flex-1 bg-transparent text-[11.5px] font-bold text-muted-foreground outline-none focus:text-foreground" />
                    <button onClick={() => addKpi(pi)} className="whitespace-nowrap text-[11px] font-semibold text-primary hover:underline">+ KPI</button>
                    {planes.length > 1 && <button onClick={() => removePlan(pi)} title="Quitar plan" className="text-muted-foreground hover:text-destructive">✕</button>}
                  </div>
                  {p.kpis.map((k, ki) => {
                    const conectados = Object.keys(k.vinculos).filter((id) => k.vinculos[id] && leafInfo[id]);
                    const disponibles = leafGroups.map((g) => ({ ...g, hojas: g.hojas.filter((l) => !k.vinculos[l.id]) })).filter((g) => g.hojas.length);
                    return (
                      <div key={ki} className="group border-b px-3 py-2.5 last:border-b-0">
                        <div className="flex items-center gap-1.5">
                          <input value={k.nombre} onChange={(e) => setKpiName(pi, ki, e.target.value)} className="min-w-0 flex-1 bg-transparent text-[13px] font-medium outline-none focus:text-foreground" />
                          {p.kpis.length > 1 && <button onClick={() => removeKpi(pi, ki)} title="Quitar KPI" className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100">✕</button>}
                        </div>
                        <div className="mt-1.5 space-y-1.5">
                          {conectados.length === 0 && <p className="text-[11px] text-muted-foreground">Sin conexiones — sumá un sub-indicador abajo.</p>}
                          {conectados.map((id) => {
                            const info = leafInfo[id]!;
                            return (
                              <div key={id} className="flex items-center gap-2">
                                <span className="flex min-w-0 flex-[0_0_150px] items-center gap-1.5">
                                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: info.color }} />
                                  <span className="truncate text-[11.5px]" title={leafLabel(id)}>{leafLabel(id)}</span>
                                </span>
                                <input type="range" min={0} max={100} value={k.vinculos[id]} onChange={(e) => setLink(pi, ki, id, +e.target.value)} style={{ ["--c" as string]: info.color, flex: 1 }} />
                                <span className="w-9 text-right font-mono text-[11px] font-semibold tabular-nums" style={{ color: info.color }}>{k.vinculos[id]}%</span>
                                <button onClick={() => setLink(pi, ki, id, 0)} title="Quitar" className="text-muted-foreground hover:text-destructive">✕</button>
                              </div>
                            );
                          })}
                        </div>
                        {disponibles.length > 0 && (
                          <select
                            value=""
                            onChange={(e) => { if (e.target.value) addLink(pi, ki, e.target.value); }}
                            className="mt-2 w-full rounded-md border bg-background px-2 py-1 text-[11.5px] text-muted-foreground outline-none"
                          >
                            <option value="">+ conectar sub-indicador…</option>
                            {disponibles.map((g) => (
                              <optgroup key={g.obj.id} label={g.obj.nombre}>
                                {g.hojas.map((l) => <option key={l.id} value={l.id}>{leafLabel(l.id)}</option>)}
                              </optgroup>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              <button onClick={addPlan} className="w-full rounded-lg border border-dashed py-2 text-xs font-semibold text-primary hover:border-primary">+ Agregar plan</button>
            </div>
          </section>

          {/* ---- mapa en vivo (a lo ancho, debajo) ---- */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="mb-1.5 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold tracking-tight">Mapa en vivo</h3>
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">Plan → KPI → sub-indicador → objetivo</span>
            </div>
            <svg viewBox={`0 0 640 ${svg.viewH}`} role="img" aria-label="Mapa de contribución jerárquico" className="mx-auto block h-auto w-full max-w-[960px]" dangerouslySetInnerHTML={{ __html: svg.inner }} />
          </div>

          <div className="mx-auto mt-3.5 w-full max-w-[960px] rounded-xl border bg-card px-4 py-3.5">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">Vínculos por objetivo</span>
              <span className="font-mono text-xs text-muted-foreground">{readout.nLinks} vínculos · {readout.nK} KPIs</span>
            </div>
            <div className="mt-2.5 space-y-2.5">
              {objs.map((o, i) => (
                <div key={o.id} className="grid grid-cols-[145px_1fr_auto] items-center gap-2.5 text-xs">
                  <span className="flex items-center gap-2 text-foreground"><span className="h-2.5 w-2.5 rounded" style={{ background: o.color }} />{o.nombre}</span>
                  <span className="h-1.5 overflow-hidden rounded bg-muted"><i className="block h-full rounded" style={{ width: `${Math.round((readout.kcount[i]! / readout.maxK) * 100)}%`, background: o.color }} /></span>
                  <span className="whitespace-nowrap font-mono text-[11.5px] text-muted-foreground"><b style={{ color: o.color }}>{readout.kcount[i]}</b> vínc.</span>
                </div>
              ))}
            </div>
          </div>
      </div>
    </div>
  );
}

function SubChip({ s, color }: { s: SubIndicador; color: string }) {
  return (
    <>
      <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px]" style={{ borderColor: `${color}66` }}>
        <span className="font-medium">{s.nombre}</span>
        <span className="font-mono text-[9.5px] text-muted-foreground">{s.peso}%</span>
      </span>
      {s.subs?.map((ss) => (
        <span key={ss.id} className="inline-flex items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 text-[10px] text-muted-foreground" style={{ borderColor: `${color}44` }}>
          <span>↳ {ss.nombre}</span>
          <span className="font-mono text-[9px]">{ss.peso}%</span>
        </span>
      ))}
    </>
  );
}
