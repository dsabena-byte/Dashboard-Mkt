"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface FbMonthlyDatum {
  mes: string;
  alcance: number;
  engagement: number;
  page_views: number;
}

const formatTick = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
      ? `${(v / 1_000).toFixed(0)}k`
      : String(v);

const formatTooltip = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(2)}M`
    : v >= 1_000
      ? `${(v / 1_000).toFixed(1)}K`
      : String(Math.round(v));

export function FbMonthlyChart({ data }: { data: FbMonthlyDatum[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
        Sin datos mensuales.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 48, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis
          yAxisId="left"
          stroke="#dc2626"
          fontSize={11}
          tickFormatter={formatTick}
          label={{ value: "Engagement", angle: -90, position: "insideLeft", fontSize: 10, fill: "#dc2626" }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#3b82f6"
          fontSize={11}
          tickFormatter={formatTick}
          label={{ value: "Alcance", angle: 90, position: "insideRight", fontSize: 10, fill: "#3b82f6" }}
        />
        <Tooltip
          formatter={(v: number, name: string) => [formatTooltip(v), name]}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="right" dataKey="alcance" fill="#3b82f6" name="Alcance (personas)" />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="engagement"
          stroke="#dc2626"
          strokeWidth={2.5}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
          name="Engagement"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
