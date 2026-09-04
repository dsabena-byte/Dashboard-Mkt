import { getSeguimientoCompleto } from "@/lib/objetivos-por-categoria";
import { SeguimientoView } from "@/components/objetivos/seguimiento-view";

// Seguimiento Objetivos = Estado de KPIs (Mapa Estratégico → cumplimiento por
// categoría). El viejo tab "OKR Mkt" se removió: Obj.1 (presupuesto) vive en
// Inversión de Marketing, y Floor Share/CB/Salud de Marca en sus dashboards.

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch { return fallback; }
}

export default async function OverviewPage() {
  const curYear = new Date().getUTCFullYear();
  const seg = await safe(getSeguimientoCompleto(curYear), { disponible: false, refMes: "", vistas: [] });
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Seguimiento Objetivos</h2>
        <p className="text-sm text-muted-foreground">
          Cumplimiento de Objetivos y KPIs vs sus metas mensuales — General o por categoría (selector), desvío del mes y acumulado del año.
        </p>
      </header>
      <SeguimientoView data={seg} />
    </div>
  );
}
