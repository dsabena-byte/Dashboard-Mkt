import { DashTabs, DashTabBar } from "@/components/diagnostico/dash-tabs";
import { HowToRead } from "@/components/knowledge/how-to-read";
import { SubirReporte } from "@/components/mkt-canal/subir-reporte";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function MktCanalPage() {
  return (
    <DashTabs dash="mkt-canal" className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Mkt Canal</h2>
        <p className="text-sm text-muted-foreground">Acciones de marketing con el canal (retailers): inversión, ejecución y resultados.</p>
      </header>
      <HowToRead slug="mkt-canal" />
      <DashTabBar />
      <SubirReporte />
      <div className="overflow-hidden rounded-xl border bg-card">
        <iframe src="/mkt-canal/index.html" className="block h-[600px] w-full border-0" scrolling="no" title="Mkt Canal Dashboard" />
      </div>
    </DashTabs>
  );
}
