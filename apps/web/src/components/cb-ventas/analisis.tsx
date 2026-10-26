"use client";

import { useState } from "react";
import { BarChart3, Building2, Users, Trophy, ChevronRight, ChevronDown } from "lucide-react";

const OBJETIVO = 80;

export type SkuFaltante = { sku: string; cliente: string; categoria: string; tipo: string };
export type CatPct = { categoria: string; pctCB: number; pctInf: number; pctEst: number };
export type SegHijo = { nombre: string; pctCB: number; pctInf: number; pctEst: number; faltan: number; porCat: CatPct[] };

export type SegAnalisis = {
  nombre: string;
  pctCB: number;
  pctInf: number;
  pctEst: number;
  totalCB: number;
  cumplidosCB: number;
  faltan80: number;
  extra?: string;
  skusFaltantes?: SkuFaltante[]; // drill de modelos (Categoría) y detalle (Vendedor/Cliente)
  hijos?: SegHijo[];             // drill de clientes/vendedores (Tipología/Gerencia)
};

export type AnalisisData = {
  global: { pctCB: number; totalCB: number; cumplidosCB: number; brechaPp: number; faltan80: number };
  evolucion: { puntos: { mes: string; pctCB: number }[]; ultimo: number | null; primero: number | null; primerMes: string | null; deltaMes: number | null; deltaDesdeInicio: number | null };
  dims: {
    categoria: SegAnalisis[];
    tipologia: SegAnalisis[];
    gerencia: SegAnalisis[];
    vendedor: SegAnalisis[];
    cliente: SegAnalisis[];
  };
};

function pctColor(pct: number): string {
  if (pct >= OBJETIVO) return "text-emerald-600";
  if (pct >= 70) return "text-amber-600";
  return "text-rose-600";
}
function debajo(segs: SegAnalisis[]): SegAnalisis[] {
  return segs.filter((s) => s.pctCB < OBJETIVO && s.faltan80 > 0).sort((a, b) => b.faltan80 - a.faltan80);
}
const TipoBadge = ({ tipo }: { tipo: string }) => (
  <span className={`px-1 rounded text-[10px] font-medium ${tipo === "INFALTABLE" ? "bg-violet-100 text-violet-700" : "bg-pink-100 text-pink-700"}`}>
    {tipo === "INFALTABLE" ? "INF" : "EST"}
  </span>
);

// Detalle de SKUs pendientes. Orden: Cliente/Cadena → Categoría → INF/EST.
// `hideCliente` (tabla Cliente): no repite el nombre del cliente.
function SkusDetalle({ skus, hideCliente }: { skus?: SkuFaltante[]; hideCliente?: boolean }) {
  if (!skus || skus.length === 0) return <div className="text-[11px] text-slate-400 px-2 py-1.5">Sin SKUs pendientes.</div>;
  const rank = (t: string) => (t === "INFALTABLE" ? 0 : 1);
  const orden = [...skus].sort(
    (a, b) => a.cliente.localeCompare(b.cliente) || a.categoria.localeCompare(b.categoria) || rank(a.tipo) - rank(b.tipo),
  );
  return (
    <div className="mt-1 mb-1 rounded border border-slate-200 bg-slate-50 max-h-56 overflow-auto">
      <div className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 px-2 py-1 border-b border-slate-200">{skus.length} SKUs pendientes</div>
      <table className="w-full text-[11px]">
        <tbody>
          {orden.map((s, i) => (
            <tr key={`${s.sku}-${s.cliente}-${i}`} className="border-t border-slate-100 first:border-t-0">
              {!hideCliente && <td className="px-2 py-1 text-slate-600 truncate max-w-[180px]" title={s.cliente}>{s.cliente}</td>}
              <td className="px-2 py-1 text-slate-500 whitespace-nowrap">{s.categoria}</td>
              <td className="px-2 py-1 whitespace-nowrap"><TipoBadge tipo={s.tipo} /></td>
              <td className="px-2 py-1 font-mono text-slate-800 whitespace-nowrap">{s.sku}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Drill de MODELOS (Categoría): modelos deduplicados, separados INF / EST.
function ModelosDrill({ skus }: { skus?: SkuFaltante[] }) {
  const map = new Map<string, { tipo: string; count: number }>();
  for (const s of skus ?? []) {
    const e = map.get(s.sku);
    if (e) e.count += 1;
    else map.set(s.sku, { tipo: s.tipo, count: 1 });
  }
  const all = [...map.entries()].map(([sku, v]) => ({ sku, tipo: v.tipo, count: v.count }));
  const inf = all.filter((m) => m.tipo === "INFALTABLE").sort((a, b) => b.count - a.count);
  const est = all.filter((m) => m.tipo === "ESTRATEGICO").sort((a, b) => b.count - a.count);
  if (inf.length === 0 && est.length === 0) return <div className="text-[11px] text-emerald-600 px-2 py-1.5">✓ Sin modelos pendientes.</div>;

  const Grupo = ({ titulo, cls, items }: { titulo: string; cls: string; items: { sku: string; count: number }[] }) => (
    <div className="flex-1 min-w-0">
      <div className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${cls}`}>{titulo} ({items.length})</div>
      {items.length === 0 ? <div className="text-[11px] text-slate-400">—</div> : (
        <div className="space-y-0.5">
          {items.slice(0, 10).map((m) => (
            <div key={m.sku} className="flex items-center gap-2 text-[11px]">
              <span className="font-mono text-slate-800 truncate">{m.sku}</span>
              <span className="ml-auto text-slate-400 whitespace-nowrap">en {m.count} {m.count === 1 ? "cliente" : "clientes"}</span>
            </div>
          ))}
          {items.length > 10 && <div className="text-[10px] text-slate-400">+{items.length - 10} más</div>}
        </div>
      )}
    </div>
  );

  return (
    <div className="mt-1 mb-1 rounded border border-slate-200 bg-slate-50 p-2">
      <div className="text-[10px] text-slate-400 mb-1.5">Modelos que más suben el indicador si se recuperan:</div>
      <div className="flex gap-4">
        <Grupo titulo="Infaltables" cls="text-violet-700" items={inf} />
        <Grupo titulo="Estratégicos" cls="text-pink-700" items={est} />
      </div>
    </div>
  );
}

// ── Drill de HIJOS (Tipología → clientes, Gerencia → vendedores).
// Debajo de cada nombre, el % de cumplimiento por categoría de producto,
// desglosado en CB · Infaltables · Estratégico.
function HijosDrill({ hijos, label }: { hijos?: SegHijo[]; label: string }) {
  if (!hijos || hijos.length === 0) return <div className="text-[11px] text-emerald-600 px-2 py-1.5">✓ Sin {label} por debajo del objetivo.</div>;
  return (
    <div className="mt-1 mb-1 rounded border border-slate-200 bg-slate-50 p-2 space-y-1.5">
      <div className="text-[10px] text-slate-400">Principales {label} que suben el indicador — % cumplimiento por categoría:</div>
      {hijos.map((h) => (
        <div key={h.nombre} className="rounded border border-slate-200 bg-white px-2 py-1.5">
          <div className="flex items-center gap-2 text-[11px] mb-1">
            <span className="font-medium text-slate-800 truncate flex-1" title={h.nombre}>{h.nombre}</span>
          </div>
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-wide text-slate-400">
            <span className="flex-1" />
            <span className="w-9 text-right">CB</span>
            <span className="w-9 text-right">Inf</span>
            <span className="w-9 text-right">Est</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] py-0.5 font-semibold border-b border-slate-200">
            <span className="flex-1 text-slate-700">General</span>
            <span className={`w-9 text-right tabular-nums ${pctColor(h.pctCB)}`}>{h.pctCB}%</span>
            <span className={`w-9 text-right tabular-nums ${pctColor(h.pctInf)}`}>{h.pctInf}%</span>
            <span className={`w-9 text-right tabular-nums ${pctColor(h.pctEst)}`}>{h.pctEst}%</span>
          </div>
          {h.porCat.map((pc) => (
            <div key={pc.categoria} className="flex items-center gap-1 text-[10px] py-0.5 border-t border-slate-50">
              <span className="flex-1 text-slate-500 truncate">{pc.categoria}</span>
              <span className={`w-9 text-right tabular-nums ${pctColor(pc.pctCB)}`}>{pc.pctCB}%</span>
              <span className={`w-9 text-right tabular-nums ${pctColor(pc.pctInf)}`}>{pc.pctInf}%</span>
              <span className={`w-9 text-right tabular-nums ${pctColor(pc.pctEst)}`}>{pc.pctEst}%</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Card de dimensión: TODAS las filas (peor primero), clickeables.
function DimCard({ titulo, icon, segs, prefix, abiertos, toggle, drill }: {
  titulo: string; icon: React.ReactNode; segs: SegAnalisis[]; prefix: string;
  abiertos: Set<string>; toggle: (k: string) => void; drill: (s: SegAnalisis) => React.ReactNode;
}) {
  const orden = [...segs].sort((a, b) => a.pctCB - b.pctCB);
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<h4 className="text-sm font-bold text-slate-900">{titulo}</h4></div>
      <div className="flex items-center gap-2 text-[9px] uppercase tracking-wide text-slate-400 px-1 pb-0.5">
        <span className="w-3 shrink-0" /><span className="flex-1" />
        <span className="w-9 text-right">CB</span><span className="w-9 text-right">Inf</span><span className="w-9 text-right">Est</span>
      </div>
      <div className="space-y-0.5">
        {orden.map((s) => {
          const k = `${prefix}:${s.nombre}`;
          const open = abiertos.has(k);
          return (
            <div key={s.nombre}>
              <button onClick={() => toggle(k)} className="w-full flex items-center gap-2 text-xs py-1 px-1 rounded hover:bg-slate-50 text-left">
                {open ? <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />}
                <span className="flex-1 truncate text-slate-700" title={s.nombre}>{s.nombre}</span>
                <span className={`w-9 text-right tabular-nums font-semibold ${pctColor(s.pctCB)}`}>{s.pctCB}%</span>
                <span className={`w-9 text-right tabular-nums ${pctColor(s.pctInf)}`}>{s.pctInf}%</span>
                <span className={`w-9 text-right tabular-nums ${pctColor(s.pctEst)}`}>{s.pctEst}%</span>
              </button>
              {open && drill(s)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tabla Vendedor / Cliente: peores + quick wins, con detalle de SKUs.
function TablaAnalisis({ titulo, icon, segs, prefix, abiertos, toggle, soloUnCliente }: {
  titulo: string; icon: React.ReactNode; segs: SegAnalisis[]; prefix: string;
  abiertos: Set<string>; toggle: (k: string) => void; soloUnCliente?: boolean;
}) {
  const bajo = debajo(segs);
  const quickWins = bajo.filter((s) => s.pctCB >= 70).slice(0, 6);
  const focos = bajo.slice(0, 10);
  const enObj = segs.filter((s) => s.pctCB >= OBJETIVO).length;

  const Fila = ({ s, kprefix }: { s: SegAnalisis; kprefix: string }) => {
    const k = `${prefix}:${kprefix}:${s.nombre}`;
    const open = abiertos.has(k);
    return (
      <>
        <button onClick={() => toggle(k)} className="w-full flex items-center gap-2 text-xs py-1 px-1 rounded hover:bg-slate-50 text-left border-t border-slate-100">
          {open ? <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />}
          <span className="flex-1 truncate" title={s.nombre}>{s.nombre}{s.extra ? <span className="text-slate-400"> · {s.extra}</span> : null}</span>
          <span className={`w-9 text-right tabular-nums font-semibold ${pctColor(s.pctCB)}`}>{s.pctCB}%</span>
          <span className={`w-9 text-right tabular-nums ${pctColor(s.pctInf)}`}>{s.pctInf}%</span>
          <span className={`w-9 text-right tabular-nums ${pctColor(s.pctEst)}`}>{s.pctEst}%</span>
        </button>
        {open && <SkusDetalle skus={s.skusFaltantes} hideCliente={soloUnCliente} />}
      </>
    );
  };
  const Header = () => (
    <div className="flex items-center gap-2 text-[9px] uppercase tracking-wide text-slate-400 px-1 pb-0.5">
      <span className="w-3 shrink-0" />
      <span className="flex-1" />
      <span className="w-9 text-right">CB</span>
      <span className="w-9 text-right">Inf</span>
      <span className="w-9 text-right">Est</span>
    </div>
  );

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3">{icon}<h4 className="text-sm font-bold text-slate-900">{titulo}</h4></div>
      <p className="text-xs text-slate-600 mb-3">{enObj} de {segs.length} en objetivo · <strong className="text-rose-700">{bajo.length}</strong> por debajo del 80%. Columnas: % CB · Infaltables · Estratégico. Tocá una fila para el detalle.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-600 mb-1.5">🎯 Mayor impacto</div>
          {focos.length === 0 ? <p className="text-xs text-emerald-600 py-1">Todos en objetivo 🎉</p> : <><Header />{focos.map((s) => <Fila key={s.nombre} s={s} kprefix="foco" />)}</>}
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 mb-1.5">⚡ Quick wins (a un paso del 80%)</div>
          {quickWins.length === 0 ? <p className="text-xs text-slate-500 py-1">No hay segmentos entre 70% y 80%.</p> : <><Header />{quickWins.map((s) => <Fila key={s.nombre} s={s} kprefix="qw" />)}</>}
        </div>
      </div>
    </div>
  );
}

export function AnalisisCB({ analisis }: { analisis: AnalisisData }) {
  const { dims } = analisis;
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setAbiertos((prev) => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-1">📊 Dónde está la brecha</h3>
        <p className="text-xs text-slate-500 mb-3">
          Tocá una fila: en <strong>Categoría</strong> los modelos a recuperar (Infaltables / Estratégicos),
          en <strong>Tipología</strong> los clientes que más ayudan, en <strong>Gerencia</strong> los vendedores que más ayudan.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <DimCard titulo="Por Categoría" icon={<BarChart3 className="w-4 h-4 text-blue-600" />} segs={dims.categoria} prefix="cat" abiertos={abiertos} toggle={toggle} drill={(s) => <ModelosDrill skus={s.skusFaltantes} />} />
          <DimCard titulo="Por Tipología" icon={<BarChart3 className="w-4 h-4 text-violet-600" />} segs={dims.tipologia} prefix="tip" abiertos={abiertos} toggle={toggle} drill={(s) => <HijosDrill hijos={s.hijos} label="clientes" />} />
          <DimCard titulo="Por Gerencia" icon={<Building2 className="w-4 h-4 text-blue-600" />} segs={dims.gerencia} prefix="ger" abiertos={abiertos} toggle={toggle} drill={(s) => <HijosDrill hijos={s.hijos} label="vendedores" />} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-3">👥 Análisis por Vendedor y por Cliente</h3>
        <div className="space-y-4">
          <TablaAnalisis titulo="Por Vendedor" icon={<Trophy className="w-4 h-4 text-amber-500" />} segs={dims.vendedor} prefix="vend" abiertos={abiertos} toggle={toggle} />
          <TablaAnalisis titulo="Por Cliente / Cadena" icon={<Users className="w-4 h-4 text-blue-600" />} segs={dims.cliente} prefix="cli" abiertos={abiertos} toggle={toggle} soloUnCliente />
        </div>
      </div>
    </div>
  );
}
