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

type Focus = { kind: "kpi"; ki: number } | { kind: "obj"; oid: string } | { kind: "leaf"; id: string } | null;

// ---- SVG del mapa ----------------------------------------------------------

function computeMapSvg(objs: Objetivo[], planes: Plan[], focus: Focus): { inner: string; viewH: number; viewW: number } {
  const leaves = leavesOf(objs);
  const subLeaves = leaves.filter((l) => l.id !== l.objId); // sub-objetivos
  const subIds = new Set(subLeaves.map((l) => l.id));
  const subObj: Record<string, string> = {}; subLeaves.forEach((l) => (subObj[l.id] = l.objId));
  const objIds = new Set(objs.map((o) => o.id));
  const colorOf = (oid: string) => objs.find((o) => o.id === oid)?.color ?? "#888";
  const np = normPeso(objs);
  const pesoByObj: Record<string, number> = {}; objs.forEach((o, j) => (pesoByObj[o.id] = np[j]!));
  const compById: Record<string, number> = {}; const compSum: Record<string, number> = {};
  objs.forEach((o) => (o.subs ?? []).forEach((sx) => { compById[sx.id] = sx.peso; compSum[o.id] = (compSum[o.id] ?? 0) + sx.peso; }));

  type KpiN = { name: string; leafLinks: { id: string; w: number }[]; directLinks: { id: string; w: number }[]; tot: number; y: number; h: number; leafSet: Set<string>; objSet: Set<string> };
  const K: KpiN[] = [];
  planes.forEach((p) => p.kpis.forEach((kk) => {
    const leafLinks: { id: string; w: number }[] = [];
    const directLinks: { id: string; w: number }[] = [];
    let tot = 0;
    for (const id in kk.vinculos) { const w = kk.vinculos[id] || 0; if (!w) continue; if (subIds.has(id)) { leafLinks.push({ id, w }); tot += w; } else if (objIds.has(id)) { directLinks.push({ id, w }); tot += w; } }
    const leafSet = new Set(leafLinks.map((l) => l.id));
    const objSet = new Set<string>(); leafLinks.forEach((l) => objSet.add(subObj[l.id]!)); directLinks.forEach((l) => objSet.add(l.id));
    K.push({ name: kk.nombre, leafLinks, directLinks, tot, y: 0, h: 0, leafSet, objSet });
  }));

  const leafFlow: Record<string, number> = {}; subLeaves.forEach((l) => (leafFlow[l.id] = 0));
  K.forEach((k) => k.leafLinks.forEach((l) => (leafFlow[l.id] = (leafFlow[l.id] ?? 0) + l.w)));
  const objFlow: Record<string, number> = {};
  objs.forEach((o) => {
    if (o.subs && o.subs.length) objFlow[o.id] = o.subs.reduce((a, sx) => a + (leafFlow[sx.id] ?? 0), 0);
    else { let f = 0; K.forEach((k) => k.directLinks.forEach((d) => { if (d.id === o.id) f += d.w; })); objFlow[o.id] = f; }
  });

  const totalFlow = K.reduce((a, k) => a + k.tot, 0) || 1;
  const top = 30, unit = Math.min(2.4, 360 / totalFlow);
  const viewW = 900;
  // Recuadro de objetivos angosto (etiqueta afuera) → todo el espacio extra va al
  // tramo KPIs → sub-objetivos, que es el que más conexiones y variables tiene.
  const xBr = 96, xKpiL = 104, xKpiR = 244, xSubL = 448, xSubR = 592, xObjL = 720, xObjR = 764;

  // layout KPI (por plan)
  let y = top, gk = 0;
  const brk: [number, number][] = [];
  planes.forEach((p) => { const b0 = y; p.kpis.forEach((_k, ki) => { const k = K[gk]!; k.y = y; k.h = Math.max(k.tot * unit, 15); y += k.h; if (ki < p.kpis.length - 1) y += 5; gk++; }); brk.push([b0, y]); y += 12; });
  const kpiBot = y - 12;

  // sub-objetivos: columna, agrupados por objetivo, centrados
  const Ls = subLeaves.map((l) => ({ ...l, flow: leafFlow[l.id]!, y: 0, h: 0 }));
  { let nat = 0, prev: string | null = null;
    Ls.forEach((l) => { if (prev !== null) nat += l.objId !== prev ? 24 : 8; nat += Math.max(l.flow * unit, 22); prev = l.objId; });
    let yy = top + ((kpiBot - top) - nat) / 2; prev = null;
    Ls.forEach((l) => { if (prev !== null) yy += l.objId !== prev ? 24 : 8; l.y = yy; l.h = Math.max(l.flow * unit, 22); yy += l.h; prev = l.objId; }); }
  const Lpos: Record<string, { y: number; h: number }> = {}; Ls.forEach((l) => (Lpos[l.id] = { y: l.y, h: l.h }));

  // objetivos: columna centrada. Su altura = suma de las cajas de sus sub-objetivos
  // (así el ribbon de composición nunca supera la caja del sub-objetivo).
  const subHSum: Record<string, number> = {};
  objs.forEach((o) => { if (o.subs && o.subs.length) subHSum[o.id] = Ls.filter((l) => l.objId === o.id).reduce((a, l) => a + l.h, 0); });
  const objH = (o: Objetivo) => (o.subs && o.subs.length ? Math.max(subHSum[o.id] ?? 0, 34) : Math.max(objFlow[o.id]! * unit, 34));
  const Os = objs.map((o) => ({ id: o.id, nombre: o.nombre, color: o.color, h: objH(o), y: 0 }));
  { let nat = 0; Os.forEach((o, i) => { if (i > 0) nat += 30; nat += o.h; });
    let yy = top + ((kpiBot - top) - nat) / 2;
    Os.forEach((o, i) => { if (i > 0) yy += 30; o.y = yy; yy += o.h; }); }
  const Opos: Record<string, { y: number; h: number }> = {}; Os.forEach((o) => (Opos[o.id] = { y: o.y, h: o.h }));

  // conjuntos para resaltado
  const kf = focus && focus.kind === "kpi" ? K[focus.ki] : null;
  const kiLeafSet = kf?.leafSet ?? null, kiObjSet = kf?.objSet ?? null;
  const leafFocusObj = focus && focus.kind === "leaf" ? subObj[focus.id] : null;
  const kpisWithLeaf = focus && focus.kind === "leaf" ? new Set(K.map((k, i) => (k.leafSet.has(focus.id) ? i : -1)).filter((i) => i >= 0)) : null;
  const kpisWithObj = focus && focus.kind === "obj" ? new Set(K.map((k, i) => (k.objSet.has(focus.oid) ? i : -1)).filter((i) => i >= 0)) : null;

  interface Meta { objId: string; ki?: number; leafId?: string }
  function band(x0: number, y0: number, x1: number, y1: number, w: number, c: string, base: number, m: Meta): string {
    const mx = (x0 + x1) / 2;
    let op = base;
    if (focus) {
      let hl: boolean;
      if (focus.kind === "obj") hl = m.objId === focus.oid;
      else if (focus.kind === "leaf") hl = m.leafId === focus.id;
      else if (m.ki != null) hl = m.ki === focus.ki;
      else if (m.leafId != null) hl = !!kiLeafSet?.has(m.leafId);
      else hl = false;
      op = hl ? 0.62 : 0.05;
    }
    return `<path pointer-events="none" fill="${c}" fill-opacity="${op}" d="M${x0} ${y0} C${mx} ${y0} ${mx} ${y1} ${x1} ${y1} L${x1} ${y1 + w} C${mx} ${y1 + w} ${mx} ${y0 + w} ${x0} ${y0 + w} Z"/>`;
  }
  const dimKpi = (ki: number): number => { if (!focus) return 1; if (focus.kind === "kpi") return ki === focus.ki ? 1 : 0.28; if (focus.kind === "leaf") return kpisWithLeaf?.has(ki) ? 1 : 0.28; return kpisWithObj?.has(ki) ? 1 : 0.28; };
  const dimSub = (leafId: string, objId: string): number => { if (!focus) return 1; if (focus.kind === "kpi") return kiLeafSet?.has(leafId) ? 1 : 0.28; if (focus.kind === "leaf") return leafId === focus.id ? 1 : 0.28; return objId === focus.oid ? 1 : 0.28; };
  const dimObj = (objId: string): number => { if (!focus) return 1; if (focus.kind === "kpi") return kiObjSet?.has(objId) ? 1 : 0.28; if (focus.kind === "leaf") return objId === leafFocusObj ? 1 : 0.28; return objId === focus.oid ? 1 : 0.28; };

  let s = "";
  const kOff = K.map((k) => k.y);
  const lIn: Record<string, number> = {}; subLeaves.forEach((l) => (lIn[l.id] = Lpos[l.id]!.y));
  const objIn: Record<string, number> = {}; objs.forEach((o) => (objIn[o.id] = Opos[o.id]!.y));
  // KPI → sub-objetivo / KPI → objetivo directo (grosor = contribución)
  K.forEach((k, ki) => {
    const links = [...k.leafLinks.map((l) => ({ ...l, leaf: true })), ...k.directLinks.map((l) => ({ ...l, leaf: false }))]
      .sort((a, b) => (a.leaf ? Lpos[a.id]!.y : Opos[a.id]!.y) - (b.leaf ? Lpos[b.id]!.y : Opos[b.id]!.y));
    links.forEach((l) => {
      if (l.leaf) { const oid = subObj[l.id]!; s += band(xKpiR, kOff[ki]!, xSubL, lIn[l.id]!, l.w * unit, colorOf(oid), 0.3, { objId: oid, ki, leafId: l.id }); lIn[l.id]! += l.w * unit; }
      else { s += band(xKpiR, kOff[ki]!, xObjL, objIn[l.id]!, l.w * unit, colorOf(l.id), 0.34, { objId: l.id, ki }); objIn[l.id]! += l.w * unit; }
      kOff[ki]! += l.w * unit;
    });
  });
  // sub-objetivo → objetivo (grosor = el de la caja del sub-objetivo, nunca lo supera)
  objs.forEach((o) => {
    if (!o.subs || !o.subs.length) return;
    Ls.filter((l) => l.objId === o.id).forEach((sub) => {
      s += band(xSubR, sub.y, xObjL, objIn[o.id]!, sub.h, o.color, 0.42, { objId: o.id, leafId: sub.id });
      objIn[o.id]! += sub.h;
    });
  });

  // headers (grandes, mayúscula, centrados sobre cada columna)
  const hy = 17;
  s += `<text x="54" y="${hy}" text-anchor="middle" class="me-colhead-big">PLANES</text>` +
    `<text x="${(xKpiL + xKpiR) / 2}" y="${hy}" text-anchor="middle" class="me-colhead-big">KPIs</text>` +
    `<text x="${(xSubL + xSubR) / 2}" y="${hy}" text-anchor="middle" class="me-colhead-big">SUB-OBJETIVOS</text>` +
    `<text x="${(xObjL + viewW) / 2}" y="${hy}" text-anchor="middle" class="me-colhead-big">OBJETIVOS</text>`;
  planes.forEach((p, pi) => { const b = brk[pi]!, cy = (b[0] + b[1]) / 2; s += `<rect class="me-bracket" x="${xBr}" y="${b[0]}" width="3" height="${b[1] - b[0]}" rx="1.5"/><text class="me-plabel" x="${xBr - 4}" y="${cy + 3.3}" text-anchor="end">${clip(shortPlan(p.nombre), 15)}</text>`; });

  K.forEach((k, ki) => {
    let domC = "hsl(var(--muted-foreground))", mx = 0;
    k.leafLinks.forEach((l) => { if (l.w > mx) { mx = l.w; domC = colorOf(subObj[l.id]!); } });
    k.directLinks.forEach((l) => { if (l.w > mx) { mx = l.w; domC = colorOf(l.id); } });
    s += `<g data-kpi="${ki}" opacity="${dimKpi(ki)}" style="cursor:pointer"><rect class="me-kpibox" x="${xKpiL}" y="${k.y}" width="${xKpiR - xKpiL}" height="${k.h}" rx="${Math.min(5, k.h / 2)}"/><rect x="${xKpiL}" y="${k.y}" width="2.5" height="${k.h}" rx="1.2" fill="${domC}"/>${k.h >= 11 ? `<text class="me-kpi-nm" x="${xKpiL + 8}" y="${k.y + k.h / 2 + 3.2}">${clip(k.name, 19)}</text>` : ""}</g>`;
  });
  // sub-objetivos (ancho ≤ objetivo)
  Ls.forEach((l) => {
    const c = l.color, comp = compById[l.id];
    s += `<g data-leaf="${l.id}" opacity="${dimSub(l.id, l.objId)}" style="cursor:pointer"><rect x="${xSubL}" y="${l.y}" width="${xSubR - xSubL}" height="${l.h}" rx="6" fill="${c}18" stroke="${c}" stroke-opacity=".6"/><rect x="${xSubL}" y="${l.y}" width="3" height="${l.h}" rx="1.5" fill="${c}"/>` +
      `<text class="me-ind-nm" x="${xSubL + 9}" y="${l.y + l.h / 2 + (l.h >= 26 ? -1 : 3.2)}">${clip(l.nombre, 17)}</text>${l.h >= 26 ? `<text class="me-ind-badge" x="${xSubL + 9}" y="${l.y + l.h / 2 + 10}">${comp ?? ""}%</text>` : ""}</g>`;
  });
  // objetivos estratégicos (recuadro angosto, etiqueta a la derecha)
  Os.forEach((o) => {
    const c = o.color, cy = o.y + o.h / 2;
    s += `<g data-obj="${o.id}" opacity="${dimObj(o.id)}" style="cursor:pointer"><rect x="${xObjL}" y="${o.y}" width="${xObjR - xObjL}" height="${o.h}" rx="6" fill="${c}26" stroke="${c}" stroke-opacity=".7"/>` +
      `<text class="me-oname" x="${xObjR + 9}" y="${cy - 2}">${clip(shortObj(o.nombre), 22)}</text><text x="${xObjR + 9}" y="${cy + 12}" class="me-badge" style="fill:${c}">peso ${pesoByObj[o.id]}%</text></g>`;
  });

  const viewH = Math.max(kpiBot, ...Ls.map((l) => l.y + l.h), ...Os.map((o) => o.y + o.h)) + 14;
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
  // --- sub-objetivos (configurables) ---
  const uid = () => `s-${Math.random().toString(36).slice(2, 8)}`;
  function addSub(oi: number) { patchObjs((d) => { const o = d[oi]!; if (!o.subs) o.subs = []; o.subs.push({ id: uid(), nombre: "Nuevo sub-objetivo", peso: 25 }); }); }
  function setSubName(oi: number, si: number, v: string) { patchObjs((d) => { d[oi]!.subs![si]!.nombre = v; }); }
  function setSubPeso(oi: number, si: number, v: number) { patchObjs((d) => { d[oi]!.subs![si]!.peso = v; }); }
  function removeSub(oi: number, si: number) {
    const rid = objs[oi]!.subs?.[si]?.id;
    patchObjs((d) => { d[oi]!.subs!.splice(si, 1); if (d[oi]!.subs!.length === 0) delete d[oi]!.subs; });
    if (rid) patchPlanes((d) => d.forEach((p) => p.kpis.forEach((k) => { delete k.vinculos[rid]; })));
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
      const lf = el.getAttribute?.("data-leaf"); if (lf != null) { setFocus({ kind: "leaf", id: lf }); return; }
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
        .mapa-cal .me-colhead-big{font-size:11.5px;font-weight:700;letter-spacing:.11em;fill:hsl(var(--muted-foreground));font-family:ui-monospace,monospace;pointer-events:none}
        .mapa-cal .me-plabel{font-weight:600;font-size:10px;fill:hsl(var(--foreground));pointer-events:none}
        .mapa-cal .me-kpi-nm{font-size:10px;fill:hsl(var(--muted-foreground));pointer-events:none}
        .mapa-cal .me-ind-nm{font-weight:600;font-size:10.5px;fill:hsl(var(--foreground));pointer-events:none}
        .mapa-cal .me-ind-badge{font-family:ui-monospace,monospace;font-size:8px;fill:hsl(var(--muted-foreground));pointer-events:none}
        .mapa-cal .me-oname{font-weight:700;font-size:12px;fill:hsl(var(--foreground));pointer-events:none}
        .mapa-cal .me-bracket{fill:hsl(var(--muted-foreground));opacity:.35;pointer-events:none}
        .mapa-cal .me-kpibox{fill:hsl(var(--muted));stroke:hsl(var(--border))}
        .mapa-cal .me-badge{font-family:ui-monospace,monospace;font-size:8.5px;font-weight:500;pointer-events:none}
        .mapa-cal svg g[data-kpi],.mapa-cal svg g[data-obj]{transition:opacity .12s}
      `}</style>

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
                    {objs.length > 1 && <button onClick={() => removeObj(i)} title="Quitar objetivo" className="text-muted-foreground hover:text-destructive">✕</button>}
                  </div>
                  <div className="mt-2 border-t pt-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
                        Sub-objetivos{o.subs && o.subs.length > 0 ? ` · aporte suma ${o.subs.reduce((a, s) => a + s.peso, 0)}%` : ""}
                      </span>
                      <button onClick={() => addSub(i)} className="text-[10.5px] font-semibold text-primary hover:underline">+ sub-objetivo</button>
                    </div>
                    {(!o.subs || o.subs.length === 0) ? (
                      <p className="text-[10.5px] text-muted-foreground">Sin sub-objetivos: los KPIs se conectan directo a este objetivo.</p>
                    ) : (
                      <div className="space-y-1">
                        {o.subs.map((s, si) => (
                          <div key={s.id} className="flex items-center gap-2">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: o.color }} />
                            <input value={s.nombre} onChange={(e) => setSubName(i, si, e.target.value)} className="min-w-0 flex-1 bg-transparent text-[11.5px] outline-none focus:text-foreground" />
                            <input type="range" min={0} max={100} value={s.peso} onChange={(e) => setSubPeso(i, si, +e.target.value)} style={{ ["--c" as string]: o.color, flex: "0 0 90px" }} />
                            <span className="w-8 text-right font-mono text-[10.5px] font-semibold tabular-nums" style={{ color: o.color }}>{s.peso}%</span>
                            <button onClick={() => removeSub(i, si)} title="Quitar sub-objetivo" className="text-[11px] text-muted-foreground hover:text-destructive">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground"><b className="text-foreground">Peso estratégico</b> = importancia relativa de cada objetivo (suma 100%). Los <b className="text-foreground">sub-objetivos</b> definen su composición y su <b className="text-foreground">% de aporte</b>; los KPIs se conectan a ellos.</p>
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

          {/* ---- mapa (debajo de la sección 2, ancho fijo para no deformarse) ---- */}
          <div className="mx-auto w-full" style={{ maxWidth: svg.viewW + 40 }}>
            <div className="mb-2.5 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-secondary font-mono text-xs font-semibold">3</span>
              <h3 className="text-sm font-semibold tracking-tight">Mapa de conexiones</h3>
              <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted-foreground">hover para aislar</span>
            </div>
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div onMouseMove={onHover} onMouseLeave={() => setFocus(null)}>
                <svg viewBox={`0 0 ${svg.viewW} ${svg.viewH}`} role="img" aria-label="Mapa Plan → KPI → sub-indicador → objetivo" style={{ width: svg.viewW, maxWidth: "100%" }} className="mx-auto block h-auto" dangerouslySetInnerHTML={{ __html: svg.inner }} />
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
