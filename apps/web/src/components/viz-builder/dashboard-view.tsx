import Link from "next/link";
import type { DashboardV2, Dataset } from "@/lib/viz";
import { DashboardRuntime } from "./runtime";

// Vista de un tablero de planilla (server): encabezado + runtime interactivo (cliente) con
// filtros, filtros cruzados, modo reporte (PDF) y descarga de datos (Excel).
export function DashboardView({ title, sub, config, datasets, editSlug }: {
  title: string; sub?: string; config: DashboardV2; datasets: Record<string, Dataset>; editSlug?: string;
}) {
  const names = [...new Set([config.datasetId, ...config.widgets.map((w) => w.datasetId)].filter(Boolean) as string[])].map((id) => datasets[id]?.name).filter(Boolean);
  return (
    <div className="bip-viz space-y-3">
      <div>
        <p className="text-xs text-slate-500"><Link href="/tableros" className="hover:underline">Mis tableros</Link> /</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="sub" style={{ marginBottom: 6 }}>{sub}{names.length ? <span style={{ color: "var(--faint)" }}> · Fuente: {names.join(", ")}</span> : null}</p>
      </div>
      <DashboardRuntime
        config={config}
        datasets={datasets}
        mode="view"
        headerExtra={editSlug ? <Link href={`/tableros/${editSlug}/editar`} className="vz-pill" style={{ color: "var(--navy)", fontWeight: 600 }}>Editar tablero</Link> : undefined}
      />
    </div>
  );
}
