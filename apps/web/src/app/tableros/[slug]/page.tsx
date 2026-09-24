import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardConfig, getDatasetsFor } from "@/lib/tableros-server";
import { DashboardView } from "@/components/viz-builder/dashboard-view";
import { TablerosNotice } from "@/components/viz-builder/missing-tables";

// Vista de un tablero de planilla (config-driven, motor v2). Sin planilla o sin gráficos → al editor.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function TableroPage({ params }: { params: { slug: string } }) {
  let cfg;
  try { cfg = await getDashboardConfig(params.slug); } catch (e) { return <div className="bip-viz"><TablerosNotice error={e} /></div>; }
  if (!cfg) notFound();
  const datasets = await getDatasetsFor(cfg);
  const primary = cfg.datasetId ? datasets[cfg.datasetId] : null;
  if (!primary || cfg.widgets.length === 0) {
    return (
      <div className="bip-viz space-y-3">
        <p className="text-xs text-slate-500"><Link href="/tableros" className="hover:underline">Mis tableros</Link> /</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{cfg.title || "Tablero"}</h1>
        <div className="card">
          <p className="hint" style={{ margin: 0 }}>
            {cfg.datasetId && !primary ? "La planilla de este tablero ya no está disponible. " : "Este tablero todavía no tiene gráficos. "}
            <Link href={`/tableros/${params.slug}/editar`} style={{ color: "var(--navy)", fontWeight: 600 }}>Armarlo</Link>
          </p>
        </div>
      </div>
    );
  }
  return (
    <DashboardView
      title={cfg.title || "Tablero"}
      sub={cfg.description || "Tablero alimentado por planillas."}
      config={cfg}
      datasets={datasets}
      editSlug={params.slug}
    />
  );
}
