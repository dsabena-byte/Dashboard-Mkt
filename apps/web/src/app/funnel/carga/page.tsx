import { CargaPresupuesto } from "@/components/inversion/carga-presupuesto";
import { DashTabBar } from "@/components/diagnostico/dash-tabs";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Carga del presupuesto de Marketing desde el tablero (reemplaza al Excel de SharePoint). Los datos se
// piden por API desde el cliente (/api/presupuesto): permisos y escrituras viven ahí.
export default function CargaPresupuestoPage() {
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Inversión de Marketing</h2>
        <p className="text-sm text-muted-foreground">
          Cargá el gasto real, los presupuestos y los tipos de cambio. Todo se guarda en pesos; los dólares salen del tipo de cambio de cada mes.
        </p>
      </header>
      <DashTabBar items={[{ key: "tablero", label: "Tablero", href: "/funnel" }, { key: "diagnostico", label: "Diagnóstico e Inteligencia", href: "/funnel?vista=diagnostico" }]} after={[{ key: "carga", label: "Cargar datos", href: "/funnel/carga" }]} active="carga" />
      <CargaPresupuesto />
    </div>
  );
}
