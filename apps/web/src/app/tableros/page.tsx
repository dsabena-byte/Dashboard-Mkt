import { listDashboards, listDatasets } from "@/lib/tableros-server";
import { getKantarConfig, KANTAR_CONST } from "@/lib/kantar-sheet";
import { TablerosAdmin } from "@/components/viz-builder/tableros-admin";
import { DatasetsPanel } from "@/components/viz-builder/datasets-panel";
import { KantarSetup } from "@/components/viz-builder/kantar-setup";
import { TablerosNotice } from "@/components/viz-builder/missing-tables";

// "Mis tableros": tableros armados sobre planillas (motor de BIP). Lista + "Nuevo tablero",
// planillas (subir Excel/CSV o Google Sheets) y la config opcional de Kantar por planilla.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function TablerosPage({ searchParams }: { searchParams?: { dataset?: string; nuevo?: string } }) {
  let body: React.ReactNode;
  try {
    const [dashes, datasets, kantar] = await Promise.all([listDashboards(), listDatasets(), getKantarConfig().catch(() => null)]);
    body = (
      <>
        <TablerosAdmin custom={dashes} datasets={datasets} canEdit presetDataset={searchParams?.dataset ?? null} openNew={searchParams?.nuevo === "1" || !!searchParams?.dataset} />
        <div style={{ maxWidth: 920, display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
          <DatasetsPanel datasets={datasets} />
          <KantarSetup config={kantar?.config ?? null} updatedAt={kantar?.updatedAt ?? null} datasets={datasets} base={KANTAR_CONST} />
        </div>
      </>
    );
  } catch (e) {
    body = <TablerosNotice error={e} />;
  }
  return (
    <div className="bip-viz space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Mis tableros</h1>
        <p className="sub" style={{ margin: "4px 0 0" }}>Tableros propios armados sobre planillas (Excel, CSV o Google Sheets): automático, con IA o gráfico por gráfico. Los dashboards nativos no cambian.</p>
      </div>
      {body}
    </div>
  );
}
