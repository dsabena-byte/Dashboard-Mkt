// "Qué explica la brecha" (Shapley, lib/stats/shapley; portado de BIP, sep-2026): barras divergentes
// en puntos de cumplimiento. Sin hooks → sirve en server y client. Azul = suma, gris pizarra = resta;
// el semáforo NO se usa acá (no es un estado, es una atribución).
import type { ContribucionShapley, AporteShapley, AporteGrupo } from "@/lib/stats/shapley";
import type { ContribucionGlobal } from "@/lib/objetivos-pronostico";
import { LearnButton } from "@/components/knowledge/learn-button";

const UP = "#1e40af", DOWN = "#64748b";
const pts = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} pts`;

function Barras({ items, max }: { items: { nombre: string; sub?: string | null; puntos: number }[]; max: number }) {
  return (
    <div className="flex flex-col gap-1">
      {items.map((a) => {
        const w = max > 0 ? Math.min(100, (Math.abs(a.puntos) / max) * 100) : 0;
        return (
          <div key={`${a.sub ?? ""}|${a.nombre}`} className="grid items-center gap-2 text-[11px]" style={{ gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr) 58px" }}>
            <span className="truncate text-foreground" title={a.sub ? `${a.nombre} · ${a.sub}` : a.nombre}>
              {a.nombre}{a.sub && <span className="text-muted-foreground/70"> · {a.sub}</span>}
            </span>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="absolute h-full rounded-full" style={{ right: a.puntos < 0 ? 0 : undefined, left: a.puntos >= 0 ? 0 : undefined, width: `${w}%`, background: a.puntos < 0 ? DOWN : UP }} />
            </div>
            <span className="text-right font-semibold tabular-nums" style={{ color: a.puntos < 0 ? DOWN : UP }}>{pts(a.puntos)}</span>
          </div>
        );
      })}
    </div>
  );
}

const Titulo = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70">{children}</div>
);

/** En la tarjeta de un objetivo: brecha YTD por KPI + qué movió el último mes. */
export function ContribucionObjetivo({ c, v, refMes }: { c?: ContribucionShapley | null; v?: ContribucionShapley | null; refMes?: string }) {
  if (!c && !v) return null;
  const brecha = c && c.total < -0.05 ? c.aportes.filter((a) => Math.abs(a.puntos) >= 0.05) : [];
  const mov = v && Math.abs(v.total) >= 0.05 ? [...v.aportes].filter((a) => Math.abs(a.puntos) >= 0.05).sort((a, b) => Math.abs(b.puntos) - Math.abs(a.puntos)).slice(0, 4) : [];
  if (!brecha.length && !mov.length) return null;
  const max = Math.max(...brecha.map((a) => Math.abs(a.puntos)), ...mov.map((a) => Math.abs(a.puntos)), 0.1);
  return (
    <details className="mt-2.5 border-t pt-2">
      <summary className="cursor-pointer select-none text-[9px] font-semibold uppercase tracking-wide text-primary [&::-webkit-details-marker]:hidden">Qué explica el resultado</summary>
      <div className="mt-2 flex flex-col gap-2.5">
        {brecha.length > 0 && c && (
          <div>
            <Titulo>Brecha YTD vs 100% · {pts(c.total)}</Titulo>
            <Barras items={brecha.slice(0, 5).map((a) => ({ nombre: a.nombre, puntos: a.puntos }))} max={max} />
          </div>
        )}
        {mov.length > 0 && v && (
          <div>
            <Titulo>Cambio {refMes ? `de ${refMes} ` : ""}vs mes anterior · {pts(v.total)}</Titulo>
            <Barras items={mov.map((a) => ({ nombre: a.nombre, puntos: a.puntos }))} max={max} />
          </div>
        )}
        <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground/70"><LearnButton k="shapley" /><span>Reparto de Shapley: cada KPI se lleva su parte justa (los puntos suman exacto el total), incluso cuando un KPI entra o sale del cálculo por falta de dato.</span></div>
      </div>
    </details>
  );
}

/** En la Salud de Marca: brecha por objetivo, por plan y los KPIs que más restan. */
export function ContribucionGlobalView({ c }: { c?: ContribucionGlobal | null }) {
  if (!c || c.total > -0.05) return null;
  const grupos: AporteGrupo[] = c.porGrupo.filter((g) => Math.abs(g.puntos) >= 0.05);
  const kpis: AporteShapley[] = c.porKpi.filter((a) => a.puntos <= -0.05).slice(0, 5);
  const objs = (c.porObjetivo?.aportes ?? []).filter((a) => Math.abs(a.puntos) >= 0.05);
  const max = Math.max(...grupos.map((g) => Math.abs(g.puntos)), ...kpis.map((a) => Math.abs(a.puntos)), ...objs.map((a) => Math.abs(a.puntos)), 0.1);
  return (
    <details className="mt-2.5 border-t pt-2">
      <summary className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wide text-primary [&::-webkit-details-marker]:hidden">
        Qué KPI explica los {Math.abs(c.total).toFixed(1)} puntos que faltan
      </summary>
      <div className="mt-2 grid gap-4 md:grid-cols-3">
        {objs.length > 0 && <div><Titulo>Por objetivo</Titulo><Barras items={objs.map((a) => ({ nombre: a.nombre, puntos: a.puntos }))} max={max} /></div>}
        {grupos.length > 0 && <div><Titulo>Por plan</Titulo><Barras items={grupos.map((g) => ({ nombre: g.grupo, puntos: g.puntos }))} max={max} /></div>}
        {kpis.length > 0 && <div><Titulo>KPIs que más restan</Titulo><Barras items={kpis.map((a) => ({ nombre: a.nombre, sub: a.grupo, puntos: a.puntos }))} max={max} /></div>}
      </div>
      <div className="mt-2 flex items-start gap-1.5 text-[10px] text-muted-foreground/70"><LearnButton k="shapley" /><span>Valores de Shapley sobre el rollup del Mapa: cuánto del cumplimiento YTD que falta se debe a cada objetivo, plan y KPI (suman exacto la brecha total). Un KPI sobrecumplido no compensa a otro: el rollup topea cada KPI en 100%.</span></div>
    </details>
  );
}
