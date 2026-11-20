// Mapa Estratégico visual (nov-2026, pedido del user para mostrar al directorio; mismo diseño que el de BIP):
// raíz → objetivos (ponderación + meta por categoría) → KPIs que lo mueven (ponderación + meta del año). Solo lectura.
import type { MapaConfig } from "@/lib/mapa-server";
import { metricaPorNombre } from "@/lib/metricas";
import { CAT_GENERAL } from "@/lib/metas";
import { generalPonderado } from "@/lib/categorias";

const CATS = ["Lavado", "Refrigeración", "Cocción"] as const;
const CAT_CORTO: Record<string, string> = { Refrigeración: "Refri" };
type Metas = Map<string, (number | null)[]>;
// Plan del Mapa → plan donde se guardan sus metas (mismo cruce que objetivos-kpis.ts).
const PLAN_META: Record<string, string> = { Instagram: "Redes Sociales" };

// Metas mensuales de un KPI; Floor Share solo tiene metas por categoría → general = Σ cat × peso (como el Seguimiento).
function metasKpi(metas: Metas, plan: string, kpi: string): (number | null)[] | undefined {
  const p = PLAN_META[plan] ?? plan;
  const gen = metas.get(`${p}|${kpi}|${CAT_GENERAL}`);
  if (gen?.some((v) => v != null) || plan !== "Floor Share") return gen;
  return Array.from({ length: 12 }, (_, i) =>
    generalPonderado(Object.fromEntries(CATS.map((c) => [c, metas.get(`${p}|${kpi}|${c}`)?.[i]]))));
}

// Volumen = total del año; tasa = meta de diciembre (último mes con meta).
function anual(v: (number | null)[] | undefined, tasa: boolean): number | null {
  const xs = (v ?? []).filter((x): x is number => x != null);
  if (!xs.length) return null;
  return tasa ? (xs[xs.length - 1] as number) : xs.reduce((a, b) => a + b, 0);
}

function fmt(v: number | null, u: string): string {
  if (v == null) return "—";
  const n = (x: number, d = 0) => x.toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d });
  if (u === "$") return Math.abs(v) >= 1e6 ? `$ ${n(v / 1e6, 1)} M` : `$ ${n(v)}`;
  if (u === "%") return `${n(v, Math.abs(v) < 1 ? 2 : 1)}%`;
  if (u === "x") return `${n(v, 1)}x`;
  if (u === "s") return `${n(v)} s`;
  return Math.abs(v) >= 1e6 ? `${n(v / 1e6, 1)} M` : n(v);
}

export function MapaVisual({ config, metas, anio }: { config: MapaConfig; metas: Metas; anio: number }) {
  const totalPeso = config.objetivos.reduce((a, o) => a + (Number(o.peso) || 0), 0) || 1;
  const kpis = config.planes.flatMap((p) => p.kpis.map((k) => ({ ...k, plan: p.nombre })));
  // Meta de cada objetivo a diciembre por categoría; general = Σ cat × peso; Salud de Marca = Σ objetivo × peso (= Seguimiento).
  const metaDic = (obj: string, c: string) => metas.get(`Objetivos Estratégicos|${obj}|${c}`)?.[11] ?? null;
  const metaObjGen = (obj: string) => generalPonderado(Object.fromEntries(CATS.map((c) => [c, metaDic(obj, c)])));
  const pares = config.objetivos.map((o) => ({ w: Number(o.peso) || 0, v: metaObjGen(o.nombre) })).filter((x) => x.v != null && x.w > 0);
  const wSalud = pares.reduce((a, x) => a + x.w, 0);
  const metaSalud = wSalud > 0 ? pares.reduce((a, x) => a + x.w * (x.v as number), 0) / wSalud : null;
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mx-auto w-fit rounded-xl bg-blue-900 px-7 py-3 text-center text-white">
        <div className="text-[11px] uppercase tracking-[0.08em] opacity-75">Mapa estratégico</div>
        <div className="text-[22px] font-semibold tracking-tight">Plan de Marketing {anio}</div>
        <div className="mt-1.5 border-t border-white/20 pt-1.5 text-[13px]">
          <span className="opacity-75">Meta {anio} · Salud de Marca Drean</span>{" "}
          <b className="text-lg font-semibold">{fmt(metaSalud, "%")}</b>
        </div>
      </div>
      <div className="mx-auto h-[18px] w-0.5 bg-slate-300" />
      <div className="mx-[12.5%] hidden h-0.5 bg-slate-300 xl:block" />
      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        {config.objetivos.map((o) => {
          const col = o.color || "#1e40af";
          const lista = kpis
            .map((k) => ({ ...k, w: Number(k.vinculos[o.id]) || 0 }))
            .filter((k) => k.w > 0)
            .sort((a, b) => b.w - a.w);
          return (
            <div key={o.id} className="grid min-w-0 content-start">
              <div className="mx-auto h-[18px] w-0.5 bg-slate-300" />
              <div className="min-w-0 rounded-[14px] border p-4 shadow-sm" style={{ borderColor: `${col}33`, borderTopWidth: 3, borderTopColor: col, background: `${col}0d` }}>
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-[10px] uppercase tracking-[0.03em]" style={{ color: col }}>Objetivo estratégico</span>
                  <span className="shrink-0 whitespace-nowrap rounded-full border bg-white px-1.5 py-0.5 text-[11px] font-semibold" style={{ color: col, borderColor: `${col}40` }}>
                    Peso {Math.round((100 * (Number(o.peso) || 0)) / totalPeso)}%
                  </span>
                </div>
                <div className="mb-2 mt-1.5 text-[17px] font-semibold text-slate-900">{o.nombre}</div>
                <div className="text-[11.5px] text-slate-500">Meta a diciembre {anio}</div>
                <div className="mt-1 grid grid-cols-3 gap-1 [&>div]:min-w-0">
                  {CATS.map((c) => (
                    <div key={c}>
                      <div className="text-[11px] font-semibold text-slate-700">{CAT_CORTO[c] ?? c}</div>
                      <div className="text-lg font-semibold tracking-tight 2xl:text-xl" style={{ color: col }}>
                        {fmt(metaDic(o.nombre, c), "%")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mx-auto h-3.5 w-px opacity-35" style={{ background: col }} />
              <div className="mb-1.5 text-center text-[11px] uppercase tracking-[0.06em] text-muted-foreground">KPIs que lo mueven</div>
              <div className="grid min-w-0 gap-1.5">
                {lista.map((k) => {
                  const m = metricaPorNombre(k.nombre);
                  const tasa = m?.tipo === "rate";
                  const meta = anual(metasKpi(metas, k.plan, k.nombre), tasa);
                  return (
                    <div key={`${k.plan}|${k.nombre}`} className="grid min-w-0 gap-1 rounded-lg border bg-white px-3 py-2" style={{ borderLeft: `3px solid ${col}` }}>
                      <div className="flex min-w-0 items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold" title={k.nombre}>{k.nombre}</span>
                        <span className="whitespace-nowrap text-xs" style={{ color: col }}>Peso <b className="font-semibold">{k.w}%</b></span>
                      </div>
                      <div className="h-1 rounded-sm" style={{ background: `${col}1a` }}>
                        <div className="h-full rounded-sm opacity-75" style={{ width: `${Math.min(100, k.w)}%`, background: col }} />
                      </div>
                      <div className="flex min-w-0 items-baseline justify-between gap-2">
                        <span className="truncate text-[11px] text-muted-foreground" title={`${k.plan} · meta ${tasa ? "a diciembre" : "total del año"} ${anio}`}>{k.plan} · {tasa ? "dic" : "total"} {anio}</span>
                        <span className="whitespace-nowrap text-[15px] font-semibold tracking-tight">{fmt(meta, m?.unidad ?? "")}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
