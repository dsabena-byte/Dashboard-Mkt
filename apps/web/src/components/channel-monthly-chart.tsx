"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/utils";

interface ChannelMonthlyDatum {
  mesLabel: string;
  [canal: string]: string | number | null;
}

interface ChannelMonthlyChartProps {
  data: ChannelMonthlyDatum[];
  canales: string[];
  colors: Record<string, string>;
}

export function ChannelMonthlyChart({ data, canales, colors }: ChannelMonthlyChartProps) {
  if (data.length === 0 || canales.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
        Sin datos para el rango.
      </div>
    );
  }

  const formatTick = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k`
      : String(v);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="mesLabel" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={formatTick} />
        <Tooltip
          formatter={(v: number) => formatNumber(v)}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {canales.map((canal) => (
          <Line
            key={canal}
            type="monotone"
            dataKey={canal}
            stroke={colors[canal] ?? "#64748b"}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
