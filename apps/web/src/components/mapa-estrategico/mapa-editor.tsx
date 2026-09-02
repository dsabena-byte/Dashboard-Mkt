"use client";

// Editor del Mapa Estratégico (modelo aplanado, inbound, persistido en DB).
// Plan → KPI → Objetivo. Cada KPI aporta un % a un objetivo; la suma por objetivo
// se capa en 100%. La config se guarda en la tabla `mapa_estrategico`.

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  MAPA_CONFIG_SEED,
  pesoAsignado,
  type Objetivo,
  type Plan,
} from "@/lib/mapa-estrategico-config";
import { CATALOGO_PLANES } from "@/lib/mapa-catalogo";
import { MetaPanel } from "@/components/metas/meta-panel";

const PALETTE = ["#7a5cf0", "#159a5b", "#d08a1e", "#2f7fe0", "#d94a6a", "#0e9aa7"];
const CATEGORIAS_CORE = ["Lavado", "Refrigeración", "Cocción"];
const DRAFT_KEY = "mapa-estrategico-draft-v1"; // cache local (red de seguridad hasta guardar en DB)

function shortObj(n: string): string {
  return n.length > 18 ? n.slice(0, 17) + "…" : n;
}
function clip(n: string, mx: number): string {
  return n.length > mx ? n.slice(0, mx - 1) + "…" : n;
}
// Los pesos estratégicos son % DIRECTOS que suman 100. Normaliza una lista a 100
// (por si viene de data vieja/cruda), absorbiendo el redondeo en el último.
function to100(list: Objetivo[]): Objetivo[] {
  if (!list.length) return list;
  const t = list.reduce((a, o) => a + (o.peso || 0), 0) || 1;
  const scaled = list.map((o) => ({ ...o, peso: Math.round(((o.peso || 0) / t) * 100) }));
  scaled[scaled.length - 1]!.peso += 100 - scaled.reduce((a, o) => a + o.peso, 0);
  return scaled;
}

export function MapaEditor() {
  const [objs, setObjs] = useState<Objetivo[]>(MAPA_CONFIG_SEED.objetivos);
  const [planes, setPlanes] = useState<Plan[]>(MAPA_CONFIG_SEED.planes);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nextO, setNextO] = useState(1);

  // Carga: DB (fuente de verdad) → si la DB está vacía (migración sin correr),
  // preferimos el DRAFT local (config sin guardar) antes que el seed, para no perder
  // lo que el usuario cargó. Solo la config real de la DB pisa al draft.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/mapa-estrategico", { cache: "no-store" });
        if (!alive) return;
        const data = res.ok ? ((await res.json()) as { objetivos: Objetivo[]; planes: Plan[]; source?: string }) : null;
        if (data && data.source === "db" && Array.isArray(data.objetivos) && data.objetivos.length) {
          setObjs(to100(data.objetivos));
          setPlanes(data.planes ?? []);
          setNextO(data.objetivos.length + 1);
        } else {
          // DB vacía → intentar draft local
          const raw = localStorage.getItem(DRAFT_KEY);
          const draft = raw ? (JSON.parse(raw) as { objetivos?: Objetivo[]; planes?: Plan[] }) : null;
          if (draft?.objetivos?.length) {
            setObjs(to100(draft.objetivos));
            setPlanes(draft.planes ?? []);
            setNextO(draft.objetivos.length + 1);
            setDirty(true); // hay cambios sin guardar en la DB
          }
        }
      } catch { /* seed */ } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Draft local: cada cambio se cachea en localStorage (red de seguridad hasta que
  // Guardar persista en la DB). Sobrevive recargas aunque la migración no esté corrida.
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ objetivos: objs, planes })); } catch { /* ignore */ }
  }, [objs, planes, loaded]);

  const catKpiNames = useMemo(() => new Set(CATALOGO_PLANES.flatMap((c) => c.kpis)), []);

  const patchObjs = (fn: (d: Objetivo[]) => void) => { setObjs((prev) => { const d = structuredClone(prev); fn(d); return d; }); setDirty(true); };
  const patchPlanes = (fn: (d: Plan[]) => void) => { setPlanes((prev) => { const d = structuredClone(prev); fn(d); return d; }); setDirty(true); };

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/mapa-estrategico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objetivos: objs, planes }),
      });
      if (res.ok) { setDirty(false); setSavedAt(Date.now()); }
      else {
        const txt = await res.text();
        setSaveError(/relation .* does not exist|PGRST205|could not find the table/i.test(txt)
          ? "No se pudo guardar: falta correr la migración 0100 (tabla mapa_estrategico). Tu config quedó guardada en este navegador; corré la migración y volvé a Guardar."
          : `No se pudo guardar: ${txt.slice(0, 140)}`);
      }
    } catch (e) {
      setSaveError(`No se pudo guardar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  // --- objetivos ---
  // El peso es % directo (suma 100). Al mover uno, SOLO el de más abajo se ajusta
  // para cerrar en 100 (si movés el último, se ajusta el de arriba). El resto queda fijo.
  function setPeso(i: number, v: number) {
    patchObjs((d) => {
      const n = d.length;
      if (n === 1) { d[0]!.peso = 100; return; }
      const bal = i === n - 1 ? n - 2 : n - 1;
      let fixed = 0;
      d.forEach((o, j) => { if (j !== i && j !== bal) fixed += o.peso; });
      const vv = Math.max(0, Math.min(v, 100 - fixed));
      d[i]!.peso = vv;
      d[bal]!.peso = 100 - fixed - vv;
    });
  }
  function setObjName(i: number, v: string) { patchObjs((d) => { d[i]!.nombre = v; }); }
  function addObj() { patchObjs((d) => d.push({ id: `o${nextO}`, nombre: "Nuevo objetivo", color: PALETTE[d.length % PALETTE.length]!, peso: 0 })); setNextO((n) => n + 1); }
  function removeObj(i: number) {
    const oid = objs[i]!.id;
    patchObjs((d) => {
      d.splice(i, 1);
      const norm = to100(d);
      d.forEach((o, j) => { o.peso = norm[j]!.peso; });
    });
    patchPlanes((d) => d.forEach((p) => p.kpis.forEach((k) => { delete k.vinculos[oid]; })));
  }

  // --- vínculos inbound (clamp ≤100 por objetivo) ---
  function setLink(pi: number, ki: number, objId: string, v: number) {
    patchPlanes((d) => {
      // suma de este objetivo en TODOS los KPIs, excluyendo el que estoy tocando
      let others = 0;
      d.forEach((p, p2) => p.kpis.forEach((k, k2) => { if (!(p2 === pi && k2 === ki)) others += k.vinculos[objId] ?? 0; }));
      const val = Math.max(0, Math.min(v, 100 - others));
      const lnk = d[pi]!.kpis[ki]!.vinculos;
      if (val > 0) lnk[objId] = val; else delete lnk[objId];
    });
  }

  // --- planes / kpis ---
  function removeKpi(pi: number, ki: number) { patchPlanes((d) => d[pi]!.kpis.splice(ki, 1)); }
  function removePlan(pi: number) { patchPlanes((d) => d.splice(pi, 1)); }
  function setPlanName(pi: number, v: string) { patchPlanes((d) => { d[pi]!.nombre = v; }); }
  function setKpiName(pi: number, ki: number, v: string) { patchPlanes((d) => { d[pi]!.kpis[ki]!.nombre = v; }); }
  function addPlan() { patchPlanes((d) => d.push({ nombre: "Nuevo plan", kpis: [] })); }
  function addKpi(pi: number) { patchPlanes((d) => d[pi]!.kpis.push({ nombre: "Nuevo indicador", vinculos: {} })); }
  function addPlanFromCat(nombre: string) { patchPlanes((d) => d.push({ nombre, kpis: [] })); }
  function addKpiFromCat(pi: number, nombre: string) { patchPlanes((d) => d[pi]!.kpis.push({ nombre, vinculos: {} })); }

  const presentPlanes = new Set(planes.map((p) => p.nombre));
  function kpisDisponibles(p: Plan): string[] {
    const cat = CATALOGO_PLANES.find((c) => c.nombre === p.nombre);
    let kpis: string[];
    if (cat) kpis = cat.kpis;
    else {
      const subs = CATALOGO_PLANES.filter((c) => c.grupo === p.nombre);
      if (!subs.length) return [];
      kpis = Array.from(new Set(subs.flatMap((c) => c.kpis)));
    }
    return kpis.filter((kn) => !p.kpis.some((k) => k.nombre === kn));
  }

  // Ranking de importancia estratégica: Σ (peso vínculo/100 × peso estratégico objetivo).
  const ranking = useMemo(() => {
    const objPeso: Record<string, number> = {}; objs.forEach((o) => (objPeso[o.id] = o.peso / 100));
    const items: { plan: string; kpi: string; imp: number; fuente: boolean }[] = [];
    planes.forEach((p) => p.kpis.forEach((k) => {
      let imp = 0;
      for (const id in k.vinculos) imp += ((k.vinculos[id] || 0) / 100) * (objPeso[id] ?? 0);
      items.push({ plan: p.nombre, kpi: k.nombre, imp, fuente: catKpiNames.has(k.nombre) });
    }));
    items.sort((a, b) => b.imp - a.imp);
    return { items, max: items.length ? (items[0]!.imp || 1) : 1 };
  }, [objs, planes, catKpiNames]);

  // Los objetivos de marca (TOM/SOM/Intención/Poder) se miden por categoría core.
  // Habilitamos el desglose por categoría en el MetaPanel; para un objetivo total
  // (ej. Facturación) se usa la pestaña "General".
  const objMetaKpis = useMemo(() => objs.map((o) => ({ nombre: o.nombre, categorias: CATEGORIAS_CORE })), [objs]);

  const cols = `minmax(0,1.3fr) repeat(${objs.length}, minmax(64px,1fr))`;

  return (
    <div className="mapa-cal space-y-5">
      <style>{`
        .mapa-cal input[type=range]{-webkit-appearance:none;appearance:none;height:5px;border-radius:3px;background:hsl(var(--border));cursor:pointer}
        .mapa-cal input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:var(--c,hsl(var(--primary)));border:2px solid hsl(var(--card));box-shadow:0 1px 3px #0003}
        .mapa-cal input[type=range]::-moz-range-thumb{width:12px;height:12px;border:2px solid hsl(var(--card));border-radius:50%;background:var(--c,hsl(var(--primary)))}
      `}</style>

      {/* Barra de guardado */}
      <div className="rounded-xl border bg-card px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground">
            {loaded ? "Config cargada." : "Cargando…"} La fuente de verdad es la DB — <b className="text-foreground">Guardá</b> para que el tablero de Seguimiento la lea. {dirty && <span className="text-amber-600">Cambios sin guardar.</span>}
          </span>
          <div className="flex items-center gap-2">
            {savedAt && !dirty && <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600"><Check className="h-3.5 w-3.5" />Guardado</span>}
            <button type="button" onClick={save} disabled={!dirty || saving} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Guardar
            </button>
          </div>
        </div>
        {saveError && <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">{saveError}</p>}
      </div>

      {/* 1. Objetivos */}
      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-secondary font-mono text-xs font-semibold">1</span>
          <h3 className="text-sm font-semibold tracking-tight">Objetivos estratégicos</h3>
          <button onClick={addObj} className="ml-auto text-xs font-semibold text-primary hover:underline">+ Agregar</button>
        </div>
        <div className="space-y-2">
          {objs.map((o, i) => (
            <div key={o.id} className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5">
              <span className="h-3 w-3 shrink-0 rounded" style={{ background: o.color }} />
              <input value={o.nombre} onChange={(e) => setObjName(i, e.target.value)} className="w-full min-w-0 bg-transparent text-sm font-semibold outline-none focus:border-b focus:border-primary" />
              <span className="hidden shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground sm:inline">peso estratégico</span>
              <div className="flex flex-[0_0_130px] items-center gap-2">
                <input type="range" min={0} max={100} value={o.peso} onChange={(e) => setPeso(i, +e.target.value)} style={{ ["--c" as string]: o.color, flex: 1 }} />
                <span className="w-8 text-right font-mono text-xs font-semibold tabular-nums">{o.peso}%</span>
              </div>
              {objs.length > 1 && <button onClick={() => removeObj(i)} title="Quitar objetivo" className="text-muted-foreground hover:text-destructive">✕</button>}
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground"><b className="text-foreground">Peso estratégico</b> = importancia relativa de cada objetivo (suma 100%). Los KPIs se conectan directo a los objetivos (modelo aplanado).</p>
      </section>

      {/* 2. Matriz de vínculos inbound */}
      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-secondary font-mono text-xs font-semibold">2</span>
          <h3 className="text-sm font-semibold tracking-tight">Aporte de cada KPI al objetivo</h3>
          <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">por objetivo suma ≤ 100%</span>
        </div>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <div style={{ minWidth: 140 + objs.length * 66 }}>
            {/* header objetivos + asignado/libre */}
            <div className="grid border-b bg-secondary/40" style={{ gridTemplateColumns: cols }}>
              <div className="px-2 py-1.5 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">Indicador</div>
              {objs.map((o) => {
                const asg = pesoAsignado(planes, o.id);
                const libre = 100 - asg;
                return (
                  <div key={o.id} className="border-l px-1 py-1 text-center">
                    <div className="truncate font-mono text-[9px] font-semibold uppercase" style={{ color: o.color }} title={o.nombre}>{shortObj(o.nombre)}</div>
                    <div className="mt-0.5 font-mono text-[9px]" style={{ color: libre < 0 ? "#dc2626" : "hsl(var(--muted-foreground))" }}>
                      {asg}% · libre {libre}%
                    </div>
                  </div>
                );
              })}
            </div>
            {/* filas por plan */}
            {planes.map((p, pi) => {
              const kpisCat = kpisDisponibles(p);
              return (
                <div key={pi}>
                  <div className="flex items-center gap-2 border-b border-t bg-secondary/40 px-2 py-1">
                    <input value={p.nombre} onChange={(e) => setPlanName(pi, e.target.value)} className="min-w-0 flex-1 bg-transparent text-[11px] font-bold text-muted-foreground outline-none focus:text-foreground" />
                    <button onClick={() => addKpi(pi)} className="whitespace-nowrap text-[10px] font-semibold text-primary hover:underline">+ KPI</button>
                    {kpisCat.length > 0 && (
                      <select value="" onChange={(e) => { if (e.target.value) addKpiFromCat(pi, e.target.value); }} title="Agregar KPI del catálogo (con fuente)" className="max-w-[130px] rounded border bg-background px-1 py-0.5 text-[10px] text-muted-foreground outline-none">
                        <option value="">del catálogo…</option>
                        {kpisCat.map((kn) => <option key={kn} value={kn}>{kn}</option>)}
                      </select>
                    )}
                    <button onClick={() => removePlan(pi)} title="Quitar plan" className="text-[11px] text-muted-foreground hover:text-destructive">✕</button>
                  </div>
                  {p.kpis.map((k, ki) => (
                    <div key={ki} className="group grid items-center border-b last:border-b-0" style={{ gridTemplateColumns: cols }}>
                      <div className="flex items-center gap-1 py-1 pl-2 pr-1">
                        <input value={k.nombre} onChange={(e) => setKpiName(pi, ki, e.target.value)} className="min-w-0 flex-1 bg-transparent text-[11.5px] outline-none focus:text-foreground" />
                        {!catKpiNames.has(k.nombre) && <span title="Sin fuente — pendiente de instrumentar" className="shrink-0 text-[8px]">⏳</span>}
                        <button onClick={() => removeKpi(pi, ki)} title="Quitar" className="shrink-0 text-[11px] text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100">✕</button>
                      </div>
                      {objs.map((o) => {
                        const h = k.vinculos[o.id] || 0;
                        return (
                          <div key={o.id} className="flex min-h-[40px] flex-col justify-center gap-0.5 border-l px-1.5 py-1">
                            <span className="text-center font-mono text-[10px] font-semibold" style={{ color: h ? o.color : "hsl(var(--muted-foreground))" }}>{h ? h + "%" : "·"}</span>
                            <input type="range" min={0} max={100} value={h} onChange={(e) => setLink(pi, ki, o.id, +e.target.value)} style={{ ["--c" as string]: o.color, width: "100%", height: 3 }} />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="flex items-center gap-2 p-2">
              <button onClick={addPlan} className="whitespace-nowrap rounded-lg border border-dashed px-3 py-1.5 text-[11px] font-semibold text-primary hover:border-primary">+ Nuevo plan</button>
              <select value="" onChange={(e) => { if (e.target.value) addPlanFromCat(e.target.value); }} className="flex-1 rounded-lg border border-dashed bg-background py-1.5 text-[11px] font-semibold text-muted-foreground outline-none">
                <option value="">+ del catálogo (con fuente)…</option>
                {(() => {
                  const opt = (x: (typeof CATALOGO_PLANES)[number]) => {
                    const has = presentPlanes.has(x.nombre) || (!!x.grupo && presentPlanes.has(x.grupo));
                    return <option key={x.nombre} value={x.nombre} disabled={has}>{x.nombre}{has ? " (ya agregado)" : ""}</option>;
                  };
                  const nodes: React.ReactNode[] = [];
                  let i = 0;
                  while (i < CATALOGO_PLANES.length) {
                    const c = CATALOGO_PLANES[i]!;
                    if (!c.grupo) { nodes.push(opt(c)); i++; continue; }
                    const g = c.grupo; const arr: typeof CATALOGO_PLANES = [];
                    while (i < CATALOGO_PLANES.length && CATALOGO_PLANES[i]!.grupo === g) { arr.push(CATALOGO_PLANES[i]!); i++; }
                    nodes.push(<optgroup key={g} label={g}>{arr.map(opt)}</optgroup>);
                  }
                  return nodes;
                })()}
              </select>
            </div>
          </div>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">El <b className="text-foreground">aporte</b> = qué fracción del objetivo explica ese KPI. Por objetivo <b className="text-foreground">no puede pasar de 100%</b> (el slider se frena en lo que queda libre). Un KPI puede aportar a varios objetivos.</p>
      </section>

      {/* 3. Composición por objetivo */}
      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-secondary font-mono text-xs font-semibold">3</span>
          <h3 className="text-sm font-semibold tracking-tight">Composición de cada objetivo</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {objs.map((o) => {
            const parts = planes.flatMap((p) => p.kpis.filter((k) => (k.vinculos[o.id] ?? 0) > 0).map((k) => ({ nombre: k.nombre, w: k.vinculos[o.id]! })));
            parts.sort((a, b) => b.w - a.w);
            const asg = parts.reduce((a, b) => a + b.w, 0);
            const libre = Math.max(0, 100 - asg);
            return (
              <div key={o.id} className="rounded-xl border bg-card p-3.5">
                <div className="flex items-baseline justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold"><span className="h-2.5 w-2.5 rounded" style={{ background: o.color }} />{o.nombre}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">peso {o.peso}%</span>
                </div>
                <div className="mt-2.5 flex h-3 w-full overflow-hidden rounded bg-muted">
                  {parts.map((pt, j) => (
                    <span key={j} title={`${pt.nombre}: ${pt.w}%`} style={{ width: `${pt.w}%`, background: o.color, opacity: 0.5 + 0.5 * (1 - j / Math.max(1, parts.length)) }} />
                  ))}
                </div>
                <div className="mt-2 space-y-1">
                  {parts.length === 0 && <p className="text-[11px] text-muted-foreground">Sin KPIs conectados.</p>}
                  {parts.map((pt) => (
                    <div key={pt.nombre} className="flex items-center justify-between text-[11px]">
                      <span className="truncate text-muted-foreground" title={pt.nombre}>{clip(pt.nombre, 26)}</span>
                      <span className="font-mono font-semibold tabular-nums" style={{ color: o.color }}>{pt.w}%</span>
                    </div>
                  ))}
                  {libre > 0 && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground/70">Libre (sin asignar)</span>
                      <span className="font-mono tabular-nums text-muted-foreground/70">{libre}%</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Prioridad de instrumentación */}
      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-secondary font-mono text-xs font-semibold">4</span>
          <h3 className="text-sm font-semibold tracking-tight">Prioridad de instrumentación</h3>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">importancia estratégica</span>
        </div>
        <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border bg-card px-4 py-3.5">
          {ranking.items.map((it, i) => (
            <div key={i} className="grid grid-cols-[16px_minmax(0,150px)_1fr_auto] items-center gap-2 text-xs">
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{i + 1}</span>
              <span className="truncate" title={`${it.kpi} · ${it.plan}`}>{it.kpi} <span className="text-[10px] text-muted-foreground">· {it.plan}</span></span>
              <span className="h-1.5 overflow-hidden rounded bg-muted"><i className="block h-full rounded" style={{ width: `${Math.round((it.imp / ranking.max) * 100)}%`, background: it.fuente ? "hsl(142 60% 45%)" : "hsl(38 78% 52%)" }} /></span>
              <span className="whitespace-nowrap font-mono text-[9.5px]" style={{ color: it.fuente ? "hsl(142 55% 40%)" : "hsl(38 78% 45%)" }}>{it.fuente ? "✓ con fuente" : "⏳ pendiente"}</span>
            </div>
          ))}
          {ranking.items.length === 0 && <p className="text-[11px] text-muted-foreground">Conectá KPIs a los objetivos para ver la prioridad.</p>}
        </div>
      </section>

      {/* 5. Metas de negocio mensuales de los objetivos */}
      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-secondary font-mono text-xs font-semibold">5</span>
          <h3 className="text-sm font-semibold tracking-tight">Metas de negocio de los objetivos</h3>
        </div>
        <MetaPanel
          plan="Objetivos Estratégicos"
          titulo="Configuración de metas de los Objetivos Estratégicos"
          subtitulo="Cargá la meta de negocio MENSUAL de cada objetivo (su propio target, aparte del rollup de KPIs). Guardá arriba los cambios de objetivos antes para que la lista quede firme."
          kpis={objMetaKpis}
        />
      </section>
    </div>
  );
}
