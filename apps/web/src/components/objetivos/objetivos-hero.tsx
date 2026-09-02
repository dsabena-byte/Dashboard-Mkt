"use client";

// Hero-cards del Seguimiento: Salud de Marca (destacada) + los objetivos del Mapa.
// Cada objetivo muestra su cumplimiento por ROLLUP de KPIs (Σ aporte × min(cumpl,100)),
// la meta de negocio (General = Σ cat × peso) y los KPIs que lo alimentan.
// Presentacional (client-safe): lo usan el tab "Estado" (server) y el selector por
// categoría (client). Sin dependencias server-only.

import { Fragment } from "react";
import Link from "next/link";
import { cumplimientoPct, semaforoDe, SEMAFORO_COLOR, type Semaforo } from "@/lib/metas";
import { generalPonderado } from "@/lib/categorias";
import type { SeguimientoObjetivos, ObjetivoRollup, ObjAporte, CatDesglose } from "@/lib/objetivos-rollup";

const UMBRAL = { umbralVerde: 100, umbralAmarillo: 90 };
const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(0)}%`);
const semOf = (v: number | null): Semaforo => semaforoDe(v, UMBRAL);

function Barra({ v }: { v: number | null }) {
  const sem = semOf(v);
  const color = SEMAFORO_COLOR[sem];
  const w = v == null ? 0 : Math.max(0, Math.min(v, 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

// Desglose por categoría: resultado (derivado del cumplimiento de KPIs) vs meta por Lav/Refri/Cocc + General.
function PorCategoria({ items }: { items: CatDesglose[] }) {
  if (!items.length || items.every((i) => i.resultado == null && i.meta == null)) return null;
  const genRes = generalPonderado(Object.fromEntries(items.map((i) => [i.categoria, i.resultado])));
  const genMeta = generalPonderado(Object.fromEntries(items.map((i) => [i.categoria, i.meta])));
  const rows: (CatDesglose & { gen?: boolean })[] = [...items, { categoria: "General", resultado: genRes, meta: genMeta, gen: true }];
  return (
    <details className="mt-2.5 border-t pt-2">
      <summary className="cursor-pointer select-none text-[9px] font-semibold uppercase tracking-wide text-primary [&::-webkit-details-marker]:hidden">
        Por categoría · resultado (derivado de KPIs) vs meta
      </summary>
      <div className="mt-1.5 grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-2.5 gap-y-1 text-[11px]">
        <span className="text-[8px] uppercase tracking-wide text-muted-foreground/60" />
        <span className="text-right text-[8px] uppercase tracking-wide text-muted-foreground/60">Result.</span>
        <span className="text-right text-[8px] uppercase tracking-wide text-muted-foreground/60">Meta</span>
        <span className="text-right text-[8px] uppercase tracking-wide text-muted-foreground/60">Desv.</span>
        {rows.map((r) => {
          const cumpl = cumplimientoPct(r.resultado, r.meta, "up");
          const s = semaforoDe(cumpl, UMBRAL);
          const color = SEMAFORO_COLOR[s];
          const desvio = r.resultado != null && r.meta != null && r.meta !== 0 ? ((r.resultado - r.meta) / r.meta) * 100 : null;
          return (
            <Fragment key={r.categoria}>
              <span className={`truncate ${r.gen ? "mt-0.5 border-t pt-0.5 font-semibold text-foreground" : "text-muted-foreground"}`}>{r.categoria}</span>
              <span className={`text-right font-semibold tabular-nums ${r.gen ? "mt-0.5 border-t pt-0.5" : ""}`} style={{ color }}>{r.resultado == null ? "—" : r.resultado.toFixed(1)}</span>
              <span className={`text-right tabular-nums text-muted-foreground/70 ${r.gen ? "mt-0.5 border-t pt-0.5" : ""}`}>{r.meta == null ? "—" : r.meta.toFixed(1)}</span>
              <span className={`text-right ${r.gen ? "mt-0.5 border-t pt-0.5" : ""}`}>
                {desvio == null ? <span className="text-muted-foreground/50">—</span> : <span className="text-[10px] font-semibold" style={{ color }}>{desvio >= 0 ? "▲" : "▼"}{Math.abs(desvio).toFixed(0)}%</span>}
              </span>
            </Fragment>
          );
        })}
      </div>
    </details>
  );
}

function AporteRow({ a }: { a: ObjAporte }) {
  const s = semOf(a.cumpl);
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="flex items-center gap-1.5 truncate text-muted-foreground" title={a.kpi}>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SEMAFORO_COLOR[s] }} />
        {a.kpi}
      </span>
      <span className="flex shrink-0 items-center gap-2 tabular-nums">
        <span className="text-muted-foreground/60">{a.peso}%</span>
        <span className="font-semibold" style={{ color: SEMAFORO_COLOR[s] }}>{pct(a.cumpl)}</span>
      </span>
    </div>
  );
}

const TOP_APORTES = 3;
function ObjetivoCard({ o }: { o: ObjetivoRollup }) {
  const sem = semOf(o.cumplMes);
  const color = SEMAFORO_COLOR[sem];
  const aportes = o.aportes.filter((a) => a.peso > 0);
  const primeros = aportes.slice(0, TOP_APORTES);
  const resto = aportes.slice(TOP_APORTES);
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="h-2.5 w-2.5 rounded" style={{ background: o.color }} />{o.nombre}
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">peso estratégico {o.pesoEstrategico}%</div>
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums" style={{ color }}>{pct(o.cumplMes)}</span>
        <span className="text-[11px] text-muted-foreground">cumplimiento</span>
      </div>
      <div className="text-[10px] text-muted-foreground/70">= Σ (peso × cumpl KPI, capado 100%)</div>
      <div className="mt-2"><Barra v={o.cumplMes} /></div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>YTD <span className="font-semibold tabular-nums text-foreground">{pct(o.cumplYtd)}</span></span>
        <span title="Target de negocio = Σ meta por categoría × peso (mix nov-25)">Meta neg. <span className="font-semibold tabular-nums text-foreground">{o.metaNegMes == null ? "—" : o.metaNegMes.toFixed(1)}</span></span>
      </div>
      {o.cobertura < 99.5 && (
        <div className="mt-1 text-[10px] text-amber-600">Cobertura {o.cobertura.toFixed(0)}% (KPIs con dato)</div>
      )}
      <PorCategoria items={o.porCategoria} />
      <div className="mt-2.5 border-t pt-2">
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70">Aporte de KPIs · peso × cumpl</div>
        <div className="space-y-1">
          {primeros.map((a) => <AporteRow key={a.kpi} a={a} />)}
          {resto.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer list-none text-[10px] font-medium text-primary marker:content-none hover:underline">
                <span className="group-open:hidden">+ Ver {resto.length} más</span>
                <span className="hidden group-open:inline">Ver menos</span>
              </summary>
              <div className="mt-1 space-y-1">
                {resto.map((a) => <AporteRow key={a.kpi} a={a} />)}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

export function ObjetivosHero({ data }: { data: SeguimientoObjetivos }) {
  if (!data.disponible) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
        Todavía no hay un <b className="text-foreground">Mapa Estratégico</b> guardado. Andá al{" "}
        <Link href="/mapa-estrategico" className="font-medium text-primary hover:underline">Mapa Estratégico</Link>, conectá los KPIs a los objetivos y <b className="text-foreground">Guardá</b> para ver acá el cumplimiento de los objetivos.
      </div>
    );
  }
  const sm = data.saludMarca;
  const smSem = semOf(sm.cumplMes);
  const smColor = SEMAFORO_COLOR[smSem];
  return (
    <div className="space-y-3">
      {/* Salud de Marca — destacada */}
      <div className="rounded-2xl border-2 bg-card p-5 shadow-sm" style={{ borderColor: smColor }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-lg text-white" style={{ background: smColor }}>★</span>
              Salud de Marca
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">Σ peso estratégico × cumplimiento de cada objetivo · a {data.refMes}</div>
          </div>
          <div className="flex items-baseline gap-3">
            <div className="text-right">
              <div className="text-4xl font-bold tabular-nums" style={{ color: smColor }}>{pct(sm.cumplMes)}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">cumplimiento</div>
            </div>
            <div className="text-right text-[11px] text-muted-foreground">
              <div>YTD <span className="font-semibold tabular-nums text-foreground">{pct(sm.cumplYtd)}</span></div>
              <div>Meta neg. <span className="font-semibold tabular-nums text-foreground">{sm.metaNegMes == null ? "—" : sm.metaNegMes.toFixed(1)}</span></div>
            </div>
          </div>
        </div>
        <div className="mt-3"><Barra v={sm.cumplMes} /></div>
        <div className="max-w-md"><PorCategoria items={sm.porCategoria} /></div>
      </div>

      {/* Objetivos que la componen */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.objetivos.map((o) => <ObjetivoCard key={o.id} o={o} />)}
      </div>
    </div>
  );
}
