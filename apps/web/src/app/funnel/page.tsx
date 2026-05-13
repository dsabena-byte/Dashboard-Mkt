import { FunnelChart } from "@/components/funnel-chart";
import { DateRangeInfo } from "@/components/date-range-info";
import { getFunnelDaily } from "@/lib/queries";
import { parseDateRange } from "@/lib/dates";
import { formatNumber, formatPct } from "@/lib/utils";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function FunnelPage({ searchParams }: PageProps) {
  const range = parseDateRange(searchParams);
  const data = await getFunnelDaily(range);

  const totals = data.reduce(
    (acc, row) => ({
      impresiones: acc.impresiones + row.impresiones,
      clicks: acc.clicks + row.clicks,
      sesiones: acc.sesiones + row.sesiones,
      conversiones: acc.conversiones + row.conversiones,
    }),
    { impresiones: 0, clicks: 0, sesiones: 0, conversiones: 0 },
  );

  const ctr = totals.impresiones > 0 ? (totals.clicks / totals.impresiones) * 100 : 0;
  const clickToSession = totals.clicks > 0 ? (totals.sesiones / totals.clicks) * 100 : 0;
  const cvr = totals.sesiones > 0 ? (totals.conversiones / totals.sesiones) * 100 : 0;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Funnel</h2>
          <p className="text-sm text-muted-foreground">
            Impresiones → clicks → sesiones → conversiones, joineado por UTM y fecha.
          </p>
        </div>
        <DateRangeInfo range={range} />
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <FunnelStep label="Impresiones" value={formatNumber(totals.impresiones)} ratio={null} />
        <FunnelStep
          label="Clicks"
          value={formatNumber(totals.clicks)}
          ratio={`CTR ${formatPct(ctr, 2)}`}
        />
        <FunnelStep
          label="Sesiones"
          value={formatNumber(totals.sesiones)}
          ratio={`Click→Sesión ${formatPct(clickToSession, 1)}`}
        />
        <FunnelStep
          label="Conversiones"
          value={formatNumber(totals.conversiones)}
          ratio={`CVR ${formatPct(cvr, 2)}`}
        />
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-sm font-medium text-muted-foreground">Evolución diaria</h3>
        <FunnelChart data={data} />
      </section>
    </div>
  );
}

function FunnelStep({
  label,
  value,
  ratio,
}: {
  label: string;
  value: string;
  ratio: string | null;
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {ratio && <div className="mt-2 text-xs text-muted-foreground">{ratio}</div>}
    </div>
  );
}
