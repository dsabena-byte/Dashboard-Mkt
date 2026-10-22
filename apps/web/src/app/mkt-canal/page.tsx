import { DashTabs, DashTabBar } from "@/components/diagnostico/dash-tabs";
import { HowToRead } from "@/components/knowledge/how-to-read";
import { SubirReporte } from "@/components/mkt-canal/subir-reporte";
import { PlanCanal } from "@/components/mkt-canal/plan-canal";
import { anioPlan } from "@/components/pauta/plan-otros-dash";
import { getPlanAnual } from "@/lib/plan-medios-anual-server";
import { usuarioPresupuesto } from "@/lib/presupuesto-server";
import { sbAdmin } from "@/lib/supabase-admin";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Clientes que ya figuran en Mkt Canal (+ Frávega) para arrancar el plan si todavía no se cargó ninguno.
async function clientesBase(): Promise<string[]> {
  try {
    const r = await sbAdmin("mkt_canal_acciones?select=cliente&limit=5000", { method: "GET" });
    const rows = r.ok ? ((await r.json()) as { cliente: string | null }[]) : [];
    return [...new Set([...rows.map((x) => x.cliente ?? "").filter(Boolean), "Frávega"])].sort((a, b) => a.localeCompare(b, "es"));
  } catch { return ["Frávega"]; }
}

export default async function MktCanalPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const anio = anioPlan();
  const planTab = { key: "plan", label: `Plan anual ${anio}`, href: "/mkt-canal?tab=plan" };
  if (searchParams?.tab === "plan") {
    const [plan, usuario, clientes] = await Promise.all([getPlanAnual(anio), usuarioPresupuesto().catch(() => null), clientesBase()]);
    const canal = plan.config.canal.clientes.length ? plan.config.canal : { ...plan.config.canal, clientes: clientes.map((nombre) => ({ nombre, valores: Array(12).fill(0) })) };
    return (
      <DashTabs dash="mkt-canal" className="space-y-4">
        <header>
          <h2 className="text-2xl font-semibold tracking-tight">Mkt Canal</h2>
          <p className="text-sm text-muted-foreground">Plan de publicidad por cliente y eventos del año que viene.</p>
        </header>
        <HowToRead slug="mkt-canal" />
        <DashTabBar items={[{ key: "tablero", label: "Tablero", href: "/mkt-canal" }]} after={[planTab]} active="plan" />
        <PlanCanal anio={anio} inicial={canal} editor={!!usuario?.editor} email={usuario?.email ?? null} />
      </DashTabs>
    );
  }
  return (
    <DashTabs dash="mkt-canal" className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Mkt Canal</h2>
        <p className="text-sm text-muted-foreground">Acciones de marketing con el canal (retailers): inversión, ejecución y resultados.</p>
      </header>
      <HowToRead slug="mkt-canal" />
      <DashTabBar after={[planTab]} />
      <SubirReporte />
      <div className="overflow-hidden rounded-xl border bg-card">
        <iframe src="/mkt-canal/index.html" className="block h-[600px] w-full border-0" scrolling="no" title="Mkt Canal Dashboard" />
      </div>
    </DashTabs>
  );
}
