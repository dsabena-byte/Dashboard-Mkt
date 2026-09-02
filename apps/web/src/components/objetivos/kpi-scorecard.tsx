// Scorecard ejecutivo: estado de cumplimiento de cada KPI vs su meta — desvío del
// mes de referencia + acumulado YTD + mini evolución (línea real vs meta).
// Server component: sin interactividad, todo se deriva de las series server-side.

import { cumplimientoPct, semaforoDe, SEMAFORO_COLOR, type Semaforo } from "@/lib/metas";
import type { KpiSeguimiento, KpiUnit } from "@/lib/objetivos-kpis";

const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const PLAN_ORDER = ["Pauta Mkt", "Web / Ecommerce", "Instagram", "Cuadros Básicos", "Floor Share"];

const SEM_BG: Record<Semaforo, string> = {
  verde: "rgba(22,163,74,.12)",
  amarillo: "rgba(217,119,6,.14)",
  rojo: "rgba(220,38,38,.12)",
  "sin-meta": "rgba(100,116,139,.12)",
};

function fmt(v: number | null, u: KpiUnit): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (u === "%") return `${v.toFixed(2)}%`;
  if (u === "s") return `${Math.round(v)}s`;
  if (u === "x") return `${v.toFixed(1)}×`;
  const a = Math.abs(v);
  const s = a >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : a >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(Math.round(v));
  return u === "$" ? `$${s}` : s;
}

const sum = (xs: (number | null)[]) => xs.reduce((a: number, x) => a + (x ?? 0), 0);
const avg = (xs: (number | null)[]) => {
  const d = xs.filter((x): x is number => x != null);
  return d.length ? d.reduce((a, b) => a + b, 0) / d.length : null;
};

function lastIdx(realM: (number | null)[]): number {
  for (let i = 11; i >= 0; i--) if (realM[i] != null) return i;
  return -1;
}

// Mini gráfico de líneas real vs meta (simplificado, sin ejes).
function Spark({ realM, metaM }: { realM: (number | null)[]; metaM: (number | null)[] }) {
  const W = 150, H = 44, pad = 5;
  const all = [...realM, ...metaM].filter((v): v is number => v != null);
  if (all.length === 0) return <span className="text-[10px] text-muted-foreground">—</span>;
  const mn = Math.min(...all), mx = Math.max(...all), rng = (mx - mn) || 1;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / 11;
  const y = (v: number) => H - pad - ((v - mn) / rng) * (H - 2 * pad);
  const path = (arr: (number | null)[]) => {
    let d = "", pen = false;
    arr.forEach((v, i) => {
      if (v == null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Evolución real vs meta" className="block">
      <path d={path(metaM)} fill="none" stroke="#94a3b8" strokeWidth={1.3} strokeDasharray="3 3" />
      <path d={path(realM)} fill="none" stroke="#1e40af" strokeWidth={1.9} strokeLinejoin="round" />
      {realM.map((v, i) => (v == null ? null : <circle key={i} cx={x(i).toFixed(1)} cy={y(v).toFixed(1)} r={1.9} fill="#1e40af" />))}
    </svg>
  );
}

function Chip({ actual, meta, direccion, umbralVerde, umbralAmarillo }: {
  actual: number | null; meta: number | null; direccion: "up" | "down"; umbralVerde: number; umbralAmarillo: number;
}) {
  const cumpl = cumplimientoPct(actual, meta, direccion);
  const sem = semaforoDe(cumpl, { umbralVerde, umbralAmarillo });
  const color = SEMAFORO_COLOR[sem];
  const desvio = actual != null && meta != null && meta !== 0 ? ((actual - meta) / meta) * 100 : null;
  return (
    <span className="inline-flex min-w-[62px] items-center justify-end gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums"
      style={{ color, background: SEM_BG[sem] }}>
      {desvio == null ? "s/d" : <>{desvio >= 0 ? "▲" : "▼"} {Math.abs(desvio).toFixed(0)}%</>}
    </span>
  );
}

function Group({ plan, kpis }: { plan: string; kpis: KpiSeguimiento[] }) {
  const counts = kpis.reduce(
    (o, k) => {
      const ri = lastIdx(k.realM);
      const sem = semaforoDe(ri >= 0 ? cumplimientoPct(k.realM[ri]!, k.metaM[ri] ?? null, k.direccion) : null, k);
      o[sem] = (o[sem] ?? 0) + 1;
      return o;
    },
    {} as Record<Semaforo, number>,
  );
  return (
    <div className="mt-5 first:mt-0">
      <div className="mb-2 flex items-baseline gap-2 px-0.5">
        <h3 className="text-sm font-bold tracking-tight">{plan}</h3>
        <span className="text-[11px] text-muted-foreground">
          <span className="mr-1 inline-block h-[7px] w-[7px] rounded-full align-middle" style={{ background: SEMAFORO_COLOR.verde }} />{counts.verde ?? 0}
          <span className="ml-2.5 mr-1 inline-block h-[7px] w-[7px] rounded-full align-middle" style={{ background: SEMAFORO_COLOR.amarillo }} />{counts.amarillo ?? 0}
          <span className="ml-2.5 mr-1 inline-block h-[7px] w-[7px] rounded-full align-middle" style={{ background: SEMAFORO_COLOR.rojo }} />{counts.rojo ?? 0}
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full min-w-[860px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 text-left font-semibold" rowSpan={2}>KPI</th>
              <th className="px-3 py-2.5 text-left font-semibold" rowSpan={2}>Mes</th>
              <th className="border-l px-3 py-1.5 text-center font-semibold" colSpan={3}>Desvío del mes</th>
              <th className="border-l px-3 py-1.5 text-center font-semibold" colSpan={3}>Acumulado YTD</th>
              <th className="border-l px-3 py-2.5 text-center font-semibold" rowSpan={2}>Evolución (real vs meta)</th>
            </tr>
            <tr className="text-[9px] uppercase tracking-wide text-muted-foreground/70">
              <th className="border-l px-3 py-1.5 text-right font-normal">Real</th>
              <th className="px-3 py-1.5 text-right font-normal">Meta</th>
              <th className="px-3 py-1.5 text-right font-normal">Desv.</th>
              <th className="border-l px-3 py-1.5 text-right font-normal">Real</th>
              <th className="px-3 py-1.5 text-right font-normal">Meta</th>
              <th className="px-3 py-1.5 text-right font-normal">Desv.</th>
            </tr>
          </thead>
          <tbody>
            {kpis.map((k) => {
              const ri = lastIdx(k.realM);
              const realMes = ri >= 0 ? k.realM[ri]! : null;
              const metaMes = ri >= 0 ? (k.metaM[ri] ?? null) : null;
              const upto = ri >= 0 ? ri : 11;
              const realYtd = k.tipo === "sum" ? sum(k.realM.slice(0, upto + 1)) : avg(k.realM.slice(0, upto + 1));
              const metaYtd = k.tipo === "sum" ? sum(k.metaM.slice(0, upto + 1)) : avg(k.metaM.slice(0, upto + 1));
              return (
                <tr key={k.kpi} className="border-t">
                  <td className="px-3 py-2.5 text-left">
                    <span className="font-semibold">{k.kpi}</span>
                    <span className="block text-[11px] font-normal text-muted-foreground/80">{k.medida}</span>
                  </td>
                  <td className="px-3 py-2.5 text-left tabular-nums text-muted-foreground">{ri >= 0 ? MES[ri] : "—"}</td>
                  <td className="border-l px-3 py-2.5 text-right font-semibold tabular-nums">{fmt(realMes, k.unit)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmt(metaMes, k.unit)}</td>
                  <td className="px-3 py-2.5 text-right"><Chip actual={realMes} meta={metaMes} direccion={k.direccion} umbralVerde={k.umbralVerde} umbralAmarillo={k.umbralAmarillo} /></td>
                  <td className="border-l px-3 py-2.5 text-right font-semibold tabular-nums">{fmt(realYtd, k.unit)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmt(metaYtd, k.unit)}</td>
                  <td className="px-3 py-2.5 text-right"><Chip actual={realYtd} meta={metaYtd} direccion={k.direccion} umbralVerde={k.umbralVerde} umbralAmarillo={k.umbralAmarillo} /></td>
                  <td className="border-l px-3 py-2"><div className="flex justify-center"><Spark realM={k.realM} metaM={k.metaM} /></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function KpiScorecard({ kpis }: { kpis: KpiSeguimiento[] }) {
  const planes = PLAN_ORDER.filter((p) => kpis.some((k) => k.plan === p));
  return (
    <div>
      {planes.map((plan) => (
        <Group key={plan} plan={plan} kpis={kpis.filter((k) => k.plan === plan)} />
      ))}
      <div className="mt-5 flex flex-wrap items-center gap-4 text-[11.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0 w-4 border-t-2" style={{ borderColor: "#1e40af" }} /> Real</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0 w-4 border-t-2 border-dashed" style={{ borderColor: "#94a3b8" }} /> Meta</span>
        <span className="h-3.5 w-px bg-border" />
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: SEMAFORO_COLOR.verde }} /> En meta (≥100%)</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: SEMAFORO_COLOR.amarillo }} /> En riesgo (90–99%)</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: SEMAFORO_COLOR.rojo }} /> Fuera de meta (&lt;90%)</span>
      </div>
    </div>
  );
}
