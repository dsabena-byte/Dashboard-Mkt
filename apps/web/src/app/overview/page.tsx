import { KpiCard } from "@/components/kpi-card";
import { DateRangeInfo } from "@/components/date-range-info";
import { FunnelChart } from "@/components/funnel-chart";
import {
  getFunnelDaily,
  getKpiTotals,
  getKpiTotalsPreviousPeriod,
} from "@/lib/queries";
import { parseDateRange } from "@/lib/dates";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function delta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export default async function OverviewPage({ searchParams }: PageProps) {
  const range = parseDateRange(searchParams);

  const [totals, prev, funnel] = await Promise.all([
    getKpiTotals(range),
    getKpiTotalsPreviousPeriod(range),
    getFunnelDaily(range),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
          <p className="text-sm text-muted-foreground">
            Vista general de performance del período.
          </p>
        </div>
        <DateRangeInfo range={range} />
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Inversión"
          value={formatCurrency(totals.inversion)}
          delta={{ value: delta(totals.inversion, prev.inversion), label: "vs período previo" }}
        />
        <KpiCard
          title="Impresiones"
          value={formatNumber(totals.impresiones)}
          delta={{ value: delta(totals.impresiones, prev.impresiones), label: "vs período previo" }}
        />
        <KpiCard
          title="Sesiones web"
          value={formatNumber(totals.sesiones)}
          delta={{ value: delta(totals.sesiones, prev.sesiones), label: "vs período previo" }}
        />
        <KpiCard
          title="Conversiones"
          value={formatNumber(totals.conversiones)}
          delta={{ value: delta(totals.conversiones, prev.conversiones), label: "vs período previo" }}
        />
      </section>

      <section className="rounded-lg border bg-card p-6">
        <header className="mb-4">
          <h3 className="text-sm font-medium text-muted-foreground">Funnel diario</h3>
          <p className="text-xs text-muted-foreground">
            Impresiones (eje izq) vs clicks, sesiones y conversiones (eje der).
          </p>
        </header>
        <FunnelChart data={funnel} />
      </section>
    </div>
  );
}
