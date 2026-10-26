"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Target, Store, Layers, TrendingUp, AlertTriangle } from "lucide-react";
import type { CruceTrade, Segmento, Cuadrante } from "@/lib/trade-cruce";

// Cruce CB × Floor Share (port de la vista /trade de la app cuadros-basicos). Datos precalculados en cada carga.
const CB_OBJETIVO = 80;

const CUAD: Record<Cuadrante, { label: string; desc: string; badge: string; dot: string }> = {
  surtido:   { label: "Falta surtido",       desc: "CB bajo · FS bajo → reponer SKUs sube el share", badge: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  ejecucion: { label: "Ejecución góndola",   desc: "CB alto · FS bajo → tiene los SKUs, mal exhibidos", badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  sostener:  { label: "Sostener",            desc: "CB alto · FS alto → mantener", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  fragil:    { label: "Frágil",              desc: "CB bajo · FS alto → share sin surtido, riesgo", badge: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  sinFS:     { label: "Sin Floor Share",     desc: "Sin datos de góndola en la tienda", badge: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-400" },
};

const fsColor = (share: number | null, target: number | null) =>
  share == null || target == null ? "text-slate-400" : share >= target ? "text-emerald-600" : "text-rose-600";
const cbColor = (p: number) => (p >= CB_OBJETIVO ? "text-emerald-600" : p >= 70 ? "text-amber-600" : "text-rose-600");

// Prioridad de oportunidad: primero las que más suben el share al cerrar CB.
function ordenarOportunidad(segs: Segmento[]): Segmento[] {
  return [...segs].sort((a, b) => {
    const ua = a.upliftPp ?? -1, ub = b.upliftPp ?? -1;
    if (ub !== ua) return ub - ua;
    return (a.pctCB - CB_OBJETIVO) - (b.pctCB - CB_OBJETIVO);
  });
}

function SkusFaltantes({ seg }: { seg: Segmento }) {
  if (seg.skusFaltantes.length === 0)
    return <div className="text-[11px] text-emerald-600 px-2 py-1.5">✓ Sin SKUs de CB faltantes.</div>;
  const orden = [...seg.skusFaltantes].sort((a, b) => a.tienda.localeCompare(b.tienda) || a.categoria.localeCompare(b.categoria));
  return (
    <div className="mt-1 rounded border border-slate-200 bg-slate-50 max-h-56 overflow-auto">
      <div className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 px-2 py-1 border-b border-slate-200">
        {seg.skusFaltantes.length} SKUs de CB a reponer
      </div>
      <table className="w-full text-[11px]">
        <tbody>
          {orden.map((s, i) => (
            <tr key={`${s.sku}-${s.tienda}-${i}`} className="border-t border-slate-100 first:border-t-0">
              <td className="px-2 py-1 font-mono text-slate-800 whitespace-nowrap">{s.sku}</td>
              <td className="px-2 py-1 text-slate-600 truncate max-w-[200px]" title={s.tienda}>{s.tienda}</td>
              <td className="px-2 py-1 text-slate-500 whitespace-nowrap">{s.categoria}</td>
              <td className="px-2 py-1 whitespace-nowrap">
                <span className={`px-1 rounded text-[10px] font-medium ${s.tipo === "Infaltable" ? "bg-violet-100 text-violet-700" : "bg-pink-100 text-pink-700"}`}>
                  {s.tipo === "Infaltable" ? "INF" : "EST"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Fila de una tienda dentro del drill de un segmento.
function FilaTienda({ t }: { t: Segmento }) {
  const [open, setOpen] = useState(false);
  const c = CUAD[t.cuadrante];
  return (
    <div className="border-t border-slate-100">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 text-[11px] py-1 px-1 hover:bg-white/60 text-left">
        {open ? <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" /> : <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />}
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
        <span className="flex-1 truncate text-slate-700" title={t.nombre}>{t.nombre}</span>
        <span className={`w-12 text-right tabular-nums font-semibold ${cbColor(t.pctCB)}`}>CB {t.pctCB}%</span>
        <span className={`w-16 text-right tabular-nums font-semibold ${fsColor(t.fsShare, t.fsTarget)}`}>
          {t.fsShare == null ? "FS —" : `FS ${t.fsShare}%`}
        </span>
        <span className="w-24 text-right tabular-nums text-slate-500">
          {t.upliftPp != null && t.upliftPp > 0 ? `+${t.upliftPp} pp` : t.skusFaltantes.length ? `${t.skusFaltantes.length} faltan` : "—"}
        </span>
      </button>
      {open && <div className="pl-6 pr-1 pb-1"><SkusFaltantes seg={t} /></div>}
    </div>
  );
}

export function CruceTradeView({ analisis }: { analisis: CruceTrade }) {
  const { global, matriz, cadenas, promotores, supervisores, tiendas: tiendasSeg, categorias, cobertura } = analisis;
  const [grupo, setGrupo] = useState<"cadena" | "promotor" | "supervisor">("cadena");
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setAbiertos((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const segs = grupo === "cadena" ? cadenas : grupo === "promotor" ? promotores : supervisores;
  const orden = useMemo(() => ordenarOportunidad(segs), [segs]);

  const tiendasDe = (seg: Segmento): Segmento[] => {
    const key = seg.nombre;
    const match = tiendasSeg.filter((t) =>
      grupo === "cadena" ? t.cadena === key : grupo === "promotor" ? t.promotor === key : t.supervisor === key,
    );
    return ordenarOportunidad(match);
  };

  const fsGlobalOk = global.fsShare != null && global.fsTarget != null && global.fsShare >= global.fsTarget;
  const cbGlobalOk = global.pctCB >= CB_OBJETIVO;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Foto combinada */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`rounded-lg p-5 text-white ${cbGlobalOk ? "bg-emerald-700" : "bg-[#0a1849]"}`}>
          <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80 flex items-center gap-1.5"><Target className="w-4 h-4" /> Cumplimiento CB Trade</div>
          <div className="mt-1 text-4xl font-bold">{global.pctCB}%</div>
          <div className="mt-2 text-sm opacity-90">{global.realCB.toLocaleString("es-AR")} / {global.targetCB.toLocaleString("es-AR")} presencias · objetivo {CB_OBJETIVO}%</div>
        </div>
        <div className={`rounded-lg p-5 text-white ${fsGlobalOk ? "bg-emerald-700" : "bg-[#7a1030]"}`}>
          <div className="text-[11px] font-semibold uppercase tracking-wide opacity-80 flex items-center gap-1.5"><Layers className="w-4 h-4" /> Floor Share Drean</div>
          <div className="mt-1 text-4xl font-bold">{global.fsShare == null ? "—" : `${global.fsShare}%`}</div>
          <div className="mt-2 text-sm opacity-90">
            {global.fsTarget != null && <>objetivo pond. {global.fsTarget}% · </>}
            {global.dreanUnits.toLocaleString("es-AR")} / {global.totalUnits.toLocaleString("es-AR")} u. en piso
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5"><Store className="w-4 h-4" /> Cobertura</div>
          <div className="mt-2 text-sm text-slate-700 space-y-1">
            <div><span className="font-bold text-lg text-slate-900">{global.tiendas}</span> tiendas en total</div>
            <div className="text-slate-500 text-xs">{cobertura.tiendasAmbas} con CB <em>y</em> Floor Share · {cobertura.tiendasCB} con CB · {cobertura.tiendasFS} con FS</div>
          </div>
        </div>
      </div>

      {/* Matriz compra vs ejecución */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-1">🧭 Matriz: ¿problema de compra o de ejecución?</h3>
        <p className="text-xs text-slate-500 mb-3">Cada tienda cae en un cuadrante según su CB (¿tiene los SKUs?) y su Floor Share (¿ocupa góndola?). El mismo % bajo significa cosas distintas según dónde caiga.</p>
        <div className="grid grid-cols-2 gap-2 max-w-2xl">
          {(["ejecucion", "sostener", "surtido", "fragil"] as Cuadrante[]).map((q) => (
            <div key={q} className={`rounded-lg border p-3 ${CUAD[q].badge}`}>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${CUAD[q].dot}`} />
                <span className="font-bold text-sm">{CUAD[q].label}</span>
                <span className="ml-auto text-lg font-bold tabular-nums">{matriz[q]}</span>
              </div>
              <div className="text-[11px] opacity-80 mt-0.5">{CUAD[q].desc}</div>
            </div>
          ))}
        </div>
        {matriz.sinFS > 0 && <p className="text-[11px] text-slate-400 mt-1">{matriz.sinFS} tiendas sin datos de Floor Share (no clasificadas).</p>}
      </div>

      {/* Categorías */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-3">📦 Por categoría — Floor Share vs objetivo</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {categorias.map((c) => {
            const ok = c.fsShare != null && c.fsTarget != null && c.fsShare >= c.fsTarget;
            return (
              <div key={c.categoria} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-xs font-bold text-slate-700 capitalize">{c.categoria}</div>
                <div className="mt-1 flex items-end gap-2">
                  <span className={`text-2xl font-bold ${ok ? "text-emerald-600" : "text-rose-600"}`}>{c.fsShare == null ? "—" : `${c.fsShare}%`}</span>
                  {c.fsTarget != null && <span className="text-xs text-slate-400 mb-1">obj {c.fsTarget}%</span>}
                </div>
                <div className="mt-1 h-2 rounded bg-slate-100 overflow-hidden relative">
                  <div className={`h-2 rounded ${ok ? "bg-emerald-400" : "bg-rose-400"}`} style={{ width: `${Math.min(100, c.fsShare ?? 0)}%` }} />
                  {c.fsTarget != null && <div className="absolute top-0 h-2 w-0.5 bg-slate-700" style={{ left: `${Math.min(100, c.fsTarget)}%` }} />}
                </div>
                <div className="mt-1.5 text-[11px] text-slate-500">CB {c.pctCB}% · {c.dreanUnits.toLocaleString("es-AR")}/{c.totalUnits.toLocaleString("es-AR")} u.</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Oportunidades cruzadas */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-blue-600" /> Oportunidades — cerrar CB para subir Floor Share</h3>
          <div className="flex gap-1 text-xs">
            {(["cadena", "promotor", "supervisor"] as const).map((g) => (
              <button key={g} onClick={() => setGrupo(g)} className={`px-2 py-1 rounded capitalize ${grupo === g ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{g}</button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-3">Ordenado por <strong>uplift proyectado</strong> (cuánto subiría el share al reponer los SKUs de CB faltantes). Tocá para ver tiendas y SKUs. El uplift es una estimación calibrada con las unidades por SKU de cada segmento.</p>

        <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
          {orden.map((s) => {
            const k = `${grupo}:${s.nombre}`;
            const open = abiertos.has(k);
            const c = CUAD[s.cuadrante];
            return (
              <div key={s.nombre}>
                <button onClick={() => toggle(k)} className="w-full flex items-center gap-2 text-xs py-2 px-2 hover:bg-slate-50 text-left">
                  {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                  <span className="flex-1 min-w-0">
                    <span className="font-medium text-slate-800 truncate block" title={s.nombre}>{s.nombre}</span>
                    <span className="text-[10px] text-slate-400">{s.tiendas} {s.tiendas === 1 ? "tienda" : "tiendas"}</span>
                  </span>
                  <span className={`hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${c.badge}`}><span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{c.label}</span>
                  <span className={`w-14 text-right tabular-nums font-semibold ${cbColor(s.pctCB)}`}>CB {s.pctCB}%</span>
                  <span className={`w-16 text-right tabular-nums font-semibold ${fsColor(s.fsShare, s.fsTarget)}`}>{s.fsShare == null ? "FS —" : `FS ${s.fsShare}%`}</span>
                  <span className="w-28 text-right tabular-nums">
                    {s.upliftPp != null && s.upliftPp > 0 ? (
                      <span className="text-emerald-700 font-semibold">+{s.upliftPp} pp → {s.fsShareProyectado}%</span>
                    ) : (
                      <span className="text-slate-400">{s.skusFaltantes.length} faltan</span>
                    )}
                  </span>
                </button>
                {open && (
                  <div className="px-2 pb-2 bg-slate-50/50">
                    <div className="text-[10px] uppercase tracking-wide text-slate-400 px-1 py-1">Tiendas del segmento</div>
                    <div className="rounded border border-slate-200 bg-white">
                      {tiendasDe(s).map((t) => <FilaTienda key={t.numero || t.nombre} t={t} />)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {orden.length === 0 && (
            <div className="p-4 text-sm text-slate-500 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> No hay segmentos para mostrar.</div>
          )}
        </div>
      </div>
    </div>
  );
}
