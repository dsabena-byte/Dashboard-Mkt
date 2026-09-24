import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardConfig, getDatasetsFor, listDatasets } from "@/lib/tableros-server";
import { VizBuilder } from "@/components/viz-builder/builder";
import { TablerosNotice } from "@/components/viz-builder/missing-tables";

// Builder del tablero (motor v2 de BIP): 1 planilla → 2 armar (Tablero automático / Armalo con IA /
// + Gráfico) → 3 guardar. Lienzo con drag & drop y editor por gráfico.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function EditarTablero({ params }: { params: { slug: string } }) {
  let cfg, list;
  try {
    [cfg, list] = await Promise.all([getDashboardConfig(params.slug), listDatasets()]);
  } catch (e) {
    return <div className="bip-viz"><TablerosNotice error={e} /></div>;
  }
  if (!cfg) notFound();
  const datasets = await getDatasetsFor(cfg);
  return (
    <div className="bip-viz space-y-3">
      <div>
        <p className="text-xs text-slate-500"><Link href="/tableros" className="hover:underline">Mis tableros</Link> /</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Editar tablero</h1>
        <p className="sub" style={{ margin: "4px 0 0" }}>
          <Link href={`/tableros/${params.slug}`} style={{ color: "var(--navy)" }}>← Volver al tablero</Link> · Hacé clic o arrastrá campos a los estantes de cada gráfico. Arrastrá las tarjetas para reordenarlas.
        </p>
      </div>
      <VizBuilder slug={params.slug} initial={cfg} datasetsList={list} initialDatasets={datasets} />
    </div>
  );
}
