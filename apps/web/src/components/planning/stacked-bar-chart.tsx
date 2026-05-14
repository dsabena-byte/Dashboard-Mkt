"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/utils";

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const nonZero = payload.filter((p) => typeof p.value === "number" && p.value > 0);
  if (nonZero.length === 0) return null;
  return (
    <div
      style={{
        backgroundColor: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        borderRadius: 6,
        fontSize: 12,
        padding: "6px 10px",
        color: "hsl(var(--foreground))",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {nonZero.map((p) => (
        <div key={String(p.dataKey)} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value as number)}
        </div>
      ))}
    </div>
  );
}

interface StackedDatum {
  category: string;
  [series: string]: string | number;
}

interface StackedBarChartProps {
  data: StackedDatum[];
  seriesKeys: string[];
  seriesColors: Record<string, string>;
  height?: number;
  layout?: "vertical" | "horizontal";
  hideLegend?: boolean;
}

export function StackedBarChart({
  data,
  seriesKeys,
  seriesColors,
  height = 240,
  layout = "horizontal",
  hideLegend = false,
}: StackedBarChartProps) {
  if (data.length === 0 || seriesKeys.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
        Sin datos
      </div>
    );
  }

  const formatTick = (v: number) =>
    v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${formatNumber(v)}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 8, right: 16, left: 8, bottom: 56 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        {layout === "horizontal" ? (
          <>
            <XAxis
              dataKey="category"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              interval={0}
              tick={{ fontSize: 11 }}
              angle={-25}
              textAnchor="end"
              height={60}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickFormatter={formatTick}
            />
          </>
        ) : (
          <>
            <XAxis
              type="number"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickFormatter={formatTick}
            />
            <YAxis
              type="category"
              dataKey="category"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              width={100}
            />
          </>
        )}
        <Tooltip content={<CustomTooltip />} />
        {!hideLegend && (
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 16 }}
            verticalAlign="bottom"
          />
        )}
        {seriesKeys.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="a"
            fill={seriesColors[key] ?? "#64748b"}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
