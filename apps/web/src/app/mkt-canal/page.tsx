import { DashTabs, DashTabBar } from "@/components/diagnostico/dash-tabs";
import { HowToRead } from "@/components/knowledge/how-to-read";
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
      <div className="h-[calc(100vh-15rem)] min-h-[600px] overflow-hidden rounded-xl border bg-card">
        <iframe src="/mkt-canal/index.html" className="h-full w-full border-0" title="Mkt Canal Dashboard" />
      </div>
    </DashTabs>
  );
}
