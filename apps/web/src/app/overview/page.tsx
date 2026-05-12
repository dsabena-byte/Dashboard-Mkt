import { KpiCard } from "@/components/kpi-card";

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
        <p className="text-sm text-muted-foreground">
          Vista general de performance. Conectá Supabase para ver datos reales.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Inversión total" value="—" hint="Sin datos: corré las migraciones y seed" />
        <KpiCard title="Impresiones"     value="—" />
        <KpiCard title="Sesiones web"    value="—" />
        <KpiCard title="Conversiones"    value="—" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Funnel diario</h3>
          <div className="mt-6 flex h-40 items-center justify-center text-sm text-muted-foreground">
            Placeholder — gráfico de funnel
          </div>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Cumplimiento vs planning</h3>
          <div className="mt-6 flex h-40 items-center justify-center text-sm text-muted-foreground">
            Placeholder — gráfico de cumplimiento
          </div>
        </div>
      </section>
    </div>
  );
}
