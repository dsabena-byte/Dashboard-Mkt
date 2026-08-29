"use client";

// Pantalla de calibración del Mapa Estratégico (Ciclo 1 — hipótesis).
// Modelo de contribución Plan → KPI → Objetivo. Estado en memoria + localStorage
// (todavía sin persistencia en Supabase — es la calibración manual de arranque).

import { useEffect, useMemo, useState } from "react";
import {
  OBJETIVOS_SEED,
  PLANES_SEED,
  MAPA_STORAGE_KEY,
  type Objetivo,
  type Plan,
} from "@/lib/mapa-estrategico-config";

const PALETTE = ["#7a5cf0", "#159a5b", "#d08a1e", "#2f7fe0", "#d94a6a", "#0e9aa7"];

type Mode = "h" | "m";

// ---- helpers puros ---------------------------------------------------------

function normPeso(objs: Objetivo[]): number[] {
  const t = objs.reduce((a, o) => a + o.peso, 0) || 1;
  return objs.map((o) => Math.round((o.peso / t) * 100));
}

function rnd(a: number, b: number): number {
  const x = Math.sin((a + 1) * 127.13 + (b + 1) * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

type Measured = { sd: true } | { sd?: false; m: number; c: "a" | "m" | "b"; r: string; n: number };

// Ciclo 2 (demo): deriva un "medido" + confianza a partir de la hipótesis.
function measured(g: number, oi: number, h: number): Measured {
  const f = 0.6 + 0.55 * rnd(g, oi);
  const m = Math.max(0, Math.min(100, Math.round(h * f)));
  const t = rnd(g + 5, oi + 9);
  const c: "a" | "m" | "b" = t > 0.62 ? "a" : t > 0.3 ? "m" : "b";
  const r = (0.35 + 0.55 * rnd(g + 2, oi + 4)).toFixed(2);
  const n = 16 + Math.round(rnd(g + 7, oi + 1) * 22);
  if (c === "b" && t < 0.14) return { sd: true };
  return { m, c, r, n };
}

const CONF_COL: Record<string, string> = { a: "hsl(142 72% 40%)", m: "hsl(38 78% 52%)", b: "hsl(215 16% 60%)" };

function shortHead(n: string): string {
  if (/inv/i.test(n)) return "Inv / Fact";
  if (/factur/i.test(n)) return "Facturación";
  if (/salud de marca/i.test(n)) return "Salud Marca";
  return n.length > 15 ? n.slice(0, 14) + "…" : n;
}
function shortPlan(n: string): string {
  return n
    .replace("Plan de ", "")
    .replace("Mkt de ", "Inf. ")
    .replace("Pauta en ", "")
    .replace(" (CB · Floor · Canal)", "");
}
function shortObj(n: string): string {
  if (/inv/i.test(n)) return "Inv Mkt / Fact";
  return n.length > 18 ? n.slice(0, 17) + "…" : n;
}
function clip(n: string): string {
  return n.length > 24 ? n.slice(0, 22) + "…" : n;
}

// ---- generación del SVG del mapa ------------------------------------------

function computeMapSvg(objs: Objetivo[], planes: Plan[], mode: Mode): { inner: string; viewH: number } {
  const top = 34, intra = 5, inter = 15, xKpiL = 150, xKpiR = 330, xObjL = 520, xObjR = 628, xBr = 140;

  function activeW(g: number, oid: string, h: number): number {
    if (mode === "h") return h;
    const oi = objs.findIndex((o) => o.id === oid);
    const mm = measured(g, oi, h);
    return "sd" in mm && mm.sd ? 0 : (mm as { m: number }).m;
  }

  type KNode = { name: string; ws: Record<string, number>; tot: number; y: number; h: number };
  const K: KNode[] = [];
  let g = 0;
  planes.forEach((p) => {
    p.kpis.forEach((kk) => {
      const ws: Record<string, number> = {};
      let tot = 0;
      objs.forEach((o) => {
        const w = activeW(g, o.id, kk.vinculos[o.id] || 0);
        if (w) { ws[o.id] = w; tot += w; }
      });
      K.push({ name: kk.nombre, ws, tot, y: 0, h: 0 });
      g++;
    });
  });

  const objTot = objs.map((o) => K.reduce((a, k) => a + (k.ws[o.id] || 0), 0));
  const GR = objTot.reduce((a, b) => a + b, 0) || 1;
  const totW = K.reduce((a, k) => a + k.tot, 0) || 1;
  const unit = Math.min(3.4, 430 / totW);

  let y = top, gk = 0;
  const brk: [number, number][] = [];
  planes.forEach((p) => {
    const b0 = y;
    p.kpis.forEach((_kk, ki) => {
      const k = K[gk]!;
      k.y = y;
      // Altura mínima legible por KPI: aunque su contribución sea baja, la caja
      // y su etiqueta tienen que verse (los ribbons siguen siendo proporcionales).
      k.h = Math.max(k.tot * unit, 15);
      y += k.h;
      if (ki < p.kpis.length - 1) y += intra;
      gk++;
    });
    brk.push([b0, y]);
    y += inter;
  });
  const contentBot = y - inter, totalH = contentBot - top;
  const objC = objTot.reduce((a, b) => a + b, 0) * unit;
  const oGap = objs.length > 1 ? (totalH - objC) / (objs.length - 1) : 0;
  const oy: number[] = [];
  let yy = top;
  objs.forEach((_o, j) => { oy.push(yy); yy += Math.max(objTot[j]! * unit, 6) + oGap; });

  const kOff = K.map((k) => k.y);
  const objOff = oy.slice();
  function band(x0: number, y0: number, x1: number, y1: number, w: number, c: string): string {
    const mx = (x0 + x1) / 2;
    return `<path fill="${c}" fill-opacity=".45" d="M${x0} ${y0} C${mx} ${y0} ${mx} ${y1} ${x1} ${y1} L${x1} ${y1 + w} C${mx} ${y1 + w} ${mx} ${y0 + w} ${x0} ${y0 + w} Z"/>`;
  }
  let ribs = "";
  K.forEach((k, ki) => {
    objs.forEach((o, j) => {
      const w = k.ws[o.id] || 0;
      if (!w) return;
      ribs += band(xKpiR, kOff[ki]!, xObjL, objOff[j]!, w * unit, o.color);
      kOff[ki]! += w * unit;
      objOff[j]! += w * unit;
    });
  });

  let s = `<text x="132" y="22" text-anchor="end" class="me-colhead">Planes</text><text x="${xKpiL}" y="22" class="me-colhead">KPIs</text><text x="${xObjL}" y="22" class="me-colhead">Objetivos</text>${ribs}`;
  planes.forEach((p, pi) => {
    const b = brk[pi]!, cy = (b[0] + b[1]) / 2;
    s += `<rect class="me-bracket" x="${xBr}" y="${b[0]}" width="3.5" height="${b[1] - b[0]}" rx="1.5"/><text class="me-plabel" x="132" y="${cy + 4}" text-anchor="end">${shortPlan(p.nombre)}</text>`;
  });
  K.forEach((k) => {
    let dom: Objetivo | null = null, mxv = 0;
    objs.forEach((o) => { const v = k.ws[o.id] || 0; if (v > mxv) { mxv = v; dom = o; } });
    const domColor = dom ? (dom as Objetivo).color : "";
    s += `<rect class="me-kpibox" x="${xKpiL}" y="${k.y}" width="${xKpiR - xKpiL}" height="${k.h}" rx="${Math.min(6, k.h / 2)}"/>${dom ? `<rect x="${xKpiL}" y="${k.y}" width="3" height="${k.h}" rx="1.5" fill="${domColor}"/>` : ""}${k.h >= 13 ? `<text class="me-kpi-nm" x="${xKpiL + 11}" y="${k.y + k.h / 2 + 3.5}">${clip(k.name)}</text>` : ""}`;
  });
  const np = normPeso(objs);
  objs.forEach((o, j) => {
    const h = Math.max(objTot[j]! * unit, 6), cy = oy[j]! + h / 2;
    const share = Math.round((objTot[j]! / GR) * 100), peso = np[j]!;
    const alert = peso - share >= 12;
    const stroke = alert ? "hsl(38 78% 52%)" : o.color, badgeC = alert ? "hsl(38 78% 52%)" : o.color;
    s += `<rect x="${xObjL}" y="${oy[j]}" width="${xObjR - xObjL}" height="${h}" rx="8" fill="${o.color}22" stroke="${stroke}" stroke-opacity="${alert ? ".9" : ".5"}"${alert ? ' stroke-width="1.5"' : ""}/>` +
      `<rect x="${xObjL}" y="${oy[j]}" width="3.5" height="${h}" rx="2" fill="${o.color}"/>` +
      `<text class="me-oname" x="${xObjL + 11}" y="${cy + 4}">${shortObj(o.nombre)}</text>` +
      `<text x="${xObjR - 7}" y="${oy[j]! + 14}" text-anchor="end" class="me-badge" style="fill:${badgeC}">${alert ? "⚠ " : ""}peso ${peso}%</text>`;
  });
  return { inner: s, viewH: Math.max(400, contentBot + 16) };
}

// ---- componente ------------------------------------------------------------

export function MapaEditor() {
  const [objs, setObjs] = useState<Objetivo[]>(OBJETIVOS_SEED);
  const [planes, setPlanes] = useState<Plan[]>(PLANES_SEED);
  const [mode, setMode] = useState<Mode>("h");
  const [hydrated, setHydrated] = useState(false);
  const [nextO, setNextO] = useState(4);

  // Hidratar desde localStorage.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(MAPA_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { objs?: Objetivo[]; planes?: Plan[] };
        if (parsed.objs && parsed.planes) {
          setObjs(parsed.objs);
          setPlanes(parsed.planes);
          setNextO(parsed.objs.length + 1);
        }
      }
    } catch {
      /* localStorage no disponible — se usa el seed */
    }
    setHydrated(true);
  }, []);

  // Autosave.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(MAPA_STORAGE_KEY, JSON.stringify({ objs, planes }));
    } catch {
      /* ignore */
    }
  }, [objs, planes, hydrated]);

  const np = useMemo(() => normPeso(objs), [objs]);
  const gForCell = useMemo(() => {
    const m: Record<string, number> = {};
    let g = 0;
    planes.forEach((p, pi) => p.kpis.forEach((_k, ki) => { m[`${pi}-${ki}`] = g++; }));
    return m;
  }, [planes]);

  const svg = useMemo(() => computeMapSvg(objs, planes, mode), [objs, planes, mode]);

  function activeW(g: number, oid: string, h: number): number {
    if (mode === "h") return h;
    const oi = objs.findIndex((o) => o.id === oid);
    const mm = measured(g, oi, h);
    return "sd" in mm && mm.sd ? 0 : (mm as { m: number }).m;
  }

  // readout: KPIs conectados por objetivo
  const readout = useMemo(() => {
    let nLinks = 0, nK = 0;
    const kcount = objs.map(() => 0);
    planes.forEach((p, pi) => p.kpis.forEach((kk, ki) => {
      nK++;
      const g = gForCell[`${pi}-${ki}`]!;
      objs.forEach((o, oi) => { if (activeW(g, o.id, kk.vinculos[o.id] || 0)) { nLinks++; kcount[oi]!++; } });
    }));
    const maxK = Math.max(1, ...kcount);
    return { nLinks, nK, kcount, maxK };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objs, planes, mode, gForCell]);

  // ---- mutadores ----
  const patchObjs = (fn: (d: Objetivo[]) => void) => setObjs((prev) => { const d = structuredClone(prev); fn(d); return d; });
  const patchPlanes = (fn: (d: Plan[]) => void) => setPlanes((prev) => { const d = structuredClone(prev); fn(d); return d; });

  function setPeso(i: number, v: number) { patchObjs((d) => { d[i]!.peso = v; }); }
  function setObjName(i: number, v: string) { patchObjs((d) => { d[i]!.nombre = v; }); }
  function removeObj(i: number) {
    const rid = objs[i]!.id;
    patchObjs((d) => { d.splice(i, 1); });
    patchPlanes((d) => d.forEach((p) => p.kpis.forEach((k) => { delete k.vinculos[rid]; })));
  }
  function addObj() {
    patchObjs((d) => d.push({ id: `o${nextO}`, nombre: "Nuevo objetivo", color: PALETTE[d.length % PALETTE.length]!, peso: 20 }));
    setNextO((n) => n + 1);
  }
  function setLink(pi: number, ki: number, oid: string, v: number) {
    patchPlanes((d) => { const lnk = d[pi]!.kpis[ki]!.vinculos; if (v) lnk[oid] = v; else delete lnk[oid]; });
  }
  function setKpiName(pi: number, ki: number, v: string) { patchPlanes((d) => { d[pi]!.kpis[ki]!.nombre = v; }); }
  function setPlanName(pi: number, v: string) { patchPlanes((d) => { d[pi]!.nombre = v; }); }
  function addKpi(pi: number) { patchPlanes((d) => d[pi]!.kpis.push({ nombre: "Nuevo indicador", vinculos: {} })); }
  function removeKpi(pi: number, ki: number) { patchPlanes((d) => d[pi]!.kpis.splice(ki, 1)); }
  function removePlan(pi: number) { patchPlanes((d) => d.splice(pi, 1)); }
  function addPlan() { patchPlanes((d) => d.push({ nombre: "Nuevo plan", kpis: [{ nombre: "Nuevo indicador", vinculos: {} }] })); }

  return (
    <div className="mapa-cal">
      <style>{`
        .mapa-cal input[type=range]{-webkit-appearance:none;appearance:none;height:5px;border-radius:3px;background:hsl(var(--border));cursor:pointer}
        .mapa-cal input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--c,hsl(var(--primary)));border:2px solid hsl(var(--card));box-shadow:0 1px 3px #0003}
        .mapa-cal input[type=range]::-moz-range-thumb{width:14px;height:14px;border:2px solid hsl(var(--card));border-radius:50%;background:var(--c,hsl(var(--primary)))}
        .mapa-cal .me-colhead{font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;fill:hsl(var(--muted-foreground));font-family:ui-monospace,monospace}
        .mapa-cal .me-plabel{font-weight:600;font-size:11px;fill:hsl(var(--foreground))}
        .mapa-cal .me-kpi-nm{font-size:11px;fill:hsl(var(--muted-foreground))}
        .mapa-cal .me-oname{font-weight:700;font-size:13px;fill:hsl(var(--foreground))}
        .mapa-cal .me-bracket{fill:hsl(var(--muted-foreground));opacity:.35}
        .mapa-cal .me-kpibox{fill:hsl(var(--muted));stroke:hsl(var(--border))}
        .mapa-cal .me-badge{font-family:ui-monospace,monospace;font-size:9.5px;font-weight:500}
      `}</style>

      <div className="flex flex-col gap-6">
        {/* ---- calibración (debajo del mapa) ---- */}
        <div className="order-2 flex flex-col gap-6">
          {/* Objetivos */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-secondary font-mono text-xs font-semibold">1</span>
              <h3 className="text-sm font-semibold tracking-tight">Objetivos estratégicos</h3>
              <button onClick={addObj} className="ml-auto text-xs font-semibold text-primary hover:underline">+ Agregar objetivo</button>
            </div>
            <div className="space-y-2">
              {objs.map((o, i) => (
                <div key={o.id} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
                  <span className="h-3 w-3 shrink-0 rounded" style={{ background: o.color }} />
                  <input
                    value={o.nombre}
                    onChange={(e) => setObjName(i, e.target.value)}
                    className="w-full bg-transparent text-sm font-semibold outline-none focus:border-b focus:border-primary"
                  />
                  <div className="flex flex-[0_0_158px] items-center gap-2">
                    <input type="range" min={0} max={100} value={o.peso} onChange={(e) => setPeso(i, +e.target.value)} style={{ ["--c" as string]: o.color, flex: 1 }} />
                    <span className="w-9 text-right font-mono text-xs font-semibold tabular-nums">{np[i]}%</span>
                  </div>
                  {objs.length > 1 && (
                    <button onClick={() => removeObj(i)} title="Quitar" className="text-muted-foreground hover:text-destructive">✕</button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">
              <b className="text-foreground">Peso estratégico</b> = cuánto pesa cada objetivo en tu estrategia (importancia relativa). No valen lo mismo; el reparto suma 100%.
            </p>
          </section>

          {/* Matriz */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-secondary font-mono text-xs font-semibold">2</span>
              <h3 className="text-sm font-semibold tracking-tight">Contribución de cada KPI al objetivo</h3>
            </div>
            <div className="mb-2.5 inline-flex gap-0.5 rounded-lg border bg-secondary/50 p-0.5">
              {(["h", "m"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: m === "h" ? "hsl(38 78% 52%)" : "hsl(142 72% 40%)" }} />
                  {m === "h" ? "Hipótesis · Ciclo 1" : "Medido · con datos"}
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border bg-card">
              {/* header */}
              <div className="grid border-b bg-secondary/40" style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${objs.length}, minmax(88px,1fr))` }}>
                <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Objetivo Estratégico</div>
                {objs.map((o) => (
                  <div key={o.id} className="border-l px-1.5 py-2 text-center font-mono text-[10px]" style={{ color: o.color }}>{shortHead(o.nombre)}</div>
                ))}
              </div>
              {/* filas por plan */}
              {planes.map((p, pi) => (
                <div key={pi}>
                  <div className="flex items-center gap-2 border-b border-t bg-secondary/40 px-3 py-1.5">
                    <input value={p.nombre} onChange={(e) => setPlanName(pi, e.target.value)} className="min-w-0 flex-1 bg-transparent text-[11.5px] font-bold text-muted-foreground outline-none focus:text-foreground" />
                    <button onClick={() => addKpi(pi)} className="whitespace-nowrap text-[11px] font-semibold text-primary hover:underline">+ KPI</button>
                    {planes.length > 1 && <button onClick={() => removePlan(pi)} title="Quitar plan" className="text-muted-foreground hover:text-destructive">✕</button>}
                  </div>
                  {p.kpis.map((k, ki) => {
                    const g = gForCell[`${pi}-${ki}`]!;
                    return (
                      <div key={ki} className="group grid items-center border-b last:border-b-0" style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${objs.length}, minmax(88px,1fr))` }}>
                        <div className="flex items-center gap-1.5 py-1.5 pl-3 pr-2">
                          <input value={k.nombre} onChange={(e) => setKpiName(pi, ki, e.target.value)} className="min-w-0 flex-1 bg-transparent text-xs text-muted-foreground outline-none focus:text-foreground" />
                          {p.kpis.length > 1 && <button onClick={() => removeKpi(pi, ki)} title="Quitar KPI" className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100">✕</button>}
                        </div>
                        {objs.map((o, oi) => {
                          const h = k.vinculos[o.id] || 0;
                          if (mode === "h") {
                            return (
                              <div key={o.id} className="flex min-h-[44px] flex-col justify-center gap-1 border-l px-2 py-1.5">
                                <span className="text-center font-mono text-xs font-semibold" style={{ color: h ? o.color : "hsl(var(--muted-foreground))" }}>{h ? h + "%" : "–"}</span>
                                <input type="range" min={0} max={100} value={h} onChange={(e) => setLink(pi, ki, o.id, +e.target.value)} style={{ ["--c" as string]: o.color, width: "100%", height: 4 }} />
                              </div>
                            );
                          }
                          // modo medido
                          if (!h) return <div key={o.id} className="flex min-h-[44px] items-center justify-center border-l font-mono text-[11px] text-muted-foreground">—</div>;
                          const mm = measured(g, oi, h);
                          if ("sd" in mm && mm.sd) return <div key={o.id} className="flex min-h-[44px] items-center justify-center border-l font-mono text-[11px] text-muted-foreground" title="Datos insuficientes">s/d</div>;
                          const mv = mm as { m: number; c: string; r: string };
                          const d = mv.m - h;
                          return (
                            <div key={o.id} className="flex min-h-[44px] items-center justify-center gap-1.5 border-l">
                              <span className="font-mono text-[13px] font-semibold" style={{ color: o.color }}>{mv.m}%</span>
                              <span className="inline-flex items-center gap-1 font-mono text-[9.5px] text-muted-foreground"><span className="h-[7px] w-[7px] rounded-full" style={{ background: CONF_COL[mv.c] }} />r={mv.r}</span>
                              <span className="font-mono text-[9.5px]" style={{ color: d >= 0 ? "hsl(142 72% 40%)" : "hsl(350 70% 55%)" }}>{d > 0 ? "▲" : d < 0 ? "▼" : "–"}{Math.abs(d)}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="border-t p-2.5">
                <button onClick={addPlan} className="w-full rounded-lg border border-dashed py-2 text-xs font-semibold text-primary hover:border-primary">+ Agregar plan</button>
              </div>
            </div>
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">
              {mode === "h"
                ? <>Estimá el <b className="text-foreground">% de contribución</b> de cada KPI (0 = no aporta). Podés renombrar, agregar o quitar planes y KPIs.</>
                : <>Coeficiente <b className="text-foreground">calculado con los datos</b> (correlación/regresión); el punto es la confianza. La flecha compara contra tu hipótesis. <b className="text-foreground">Demo del Ciclo 2</b> — todavía no hay datos reales.</>}
            </p>
          </section>
        </div>

        {/* ---- mapa en vivo (arriba, a lo ancho, protagonista) ---- */}
        <div className="order-1">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="mb-1.5 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold tracking-tight">Mapa de conexiones</h3>
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">peso = {mode === "h" ? "hipótesis" : "medido"}</span>
            </div>
            <svg viewBox={`0 0 640 ${svg.viewH}`} role="img" aria-label="Mapa de contribución Plan a KPI a Objetivo" className="mx-auto block h-auto w-full max-w-[940px]" dangerouslySetInnerHTML={{ __html: svg.inner }} />
          </div>

          <div className="mx-auto mt-3.5 w-full max-w-[940px] rounded-xl border bg-card px-4 py-3.5">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">KPIs conectados a cada objetivo</span>
              <span className="font-mono text-xs text-muted-foreground">{readout.nLinks} vínculos · {readout.nK} KPIs</span>
            </div>
            <div className="mt-2.5 space-y-2.5">
              {objs.map((o, i) => (
                <div key={o.id} className="grid grid-cols-[145px_1fr_auto] items-center gap-2.5 text-xs">
                  <span className="flex items-center gap-2 text-foreground"><span className="h-2.5 w-2.5 rounded" style={{ background: o.color }} />{o.nombre}</span>
                  <span className="h-1.5 overflow-hidden rounded bg-muted"><i className="block h-full rounded" style={{ width: `${Math.round((readout.kcount[i]! / readout.maxK) * 100)}%`, background: o.color }} /></span>
                  <span className="whitespace-nowrap font-mono text-[11.5px] text-muted-foreground"><b style={{ color: o.color }}>{readout.kcount[i]}</b> KPIs</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
