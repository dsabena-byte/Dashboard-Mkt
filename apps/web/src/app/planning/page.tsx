import { ComplianceTable } from "@/components/compliance-table";
import { DateRangeInfo } from "@/components/date-range-info";
import { getPlanningCompliance } from "@/lib/queries";
import { parseDateRange } from "@/lib/dates";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function PlanningPage({ searchParams }: PageProps) {
  const range = parseDateRange(searchParams);
  const rows = await getPlanningCompliance(range);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Planning vs Real</h2>
          <p className="text-sm text-muted-foreground">
            Cumplimiento de inversión y KPIs contra el plan, por campaña y día.
          </p>
        </div>
        <DateRangeInfo range={range} />
      </header>

      <ComplianceTable rows={rows} />

      <div className="text-xs text-muted-foreground">
        Verde: 95-110% (en target) · Amarillo: 80-95% (atención) · Rojo: &lt;80% (desvío crítico)
      </div>
    </div>
  );
}
