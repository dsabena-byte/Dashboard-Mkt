import type { ComplianceRow } from "@/lib/queries";
import { CHANNEL_LABEL, METRIC_LABEL, type ChannelType, type MetricType } from "@dashboard/shared";
import { cn, formatCurrency, formatNumber, formatPct } from "@/lib/utils";

interface ComplianceTableProps {
  rows: ComplianceRow[];
}

function badge(pct: number | null) {
  if (pct === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  let tone: string;
  if (pct >= 95 && pct <= 110) tone = "bg-emerald-100 text-emerald-700";
  else if (pct >= 80) tone = "bg-amber-100 text-amber-700";
  else tone = "bg-red-100 text-red-700";
  return (
    <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", tone)}>
      {formatPct(pct, 1)}
    </span>
  );
}

export function ComplianceTable({ rows }: ComplianceTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center text-sm text-muted-foreground">
        Sin planning cargado para el rango seleccionado.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40">
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2">Fecha</th>
            <th className="px-4 py-2">Canal</th>
            <th className="px-4 py-2">Campaña</th>
            <th className="px-4 py-2">Métrica</th>
            <th className="px-4 py-2 text-right">Plan</th>
            <th className="px-4 py-2 text-right">Real</th>
            <th className="px-4 py-2 text-right">% KPI</th>
            <th className="px-4 py-2 text-right">% Inversión</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.planning_id} className="border-b last:border-0">
              <td className="px-4 py-2 text-muted-foreground">{row.fecha}</td>
              <td className="px-4 py-2">{CHANNEL_LABEL[row.canal as ChannelType] ?? row.canal}</td>
              <td className="px-4 py-2 font-medium">{row.campania}</td>
              <td className="px-4 py-2">
                {METRIC_LABEL[row.metric_type as MetricType] ?? row.metric_type}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatNumber(Number(row.kpi_target))}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatNumber(Number(row.kpi_actual))}
              </td>
              <td className="px-4 py-2 text-right">{badge(row.cumplimiento_kpi_pct)}</td>
              <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                {row.cumplimiento_inversion_pct === null ? (
                  "—"
                ) : (
                  <span>
                    {formatPct(row.cumplimiento_inversion_pct, 0)} ·{" "}
                    {formatCurrency(Number(row.inversion_real))}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
