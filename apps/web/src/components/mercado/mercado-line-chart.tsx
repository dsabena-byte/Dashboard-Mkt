"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface MercadoSeriesPoint {
  mes: string;
  High: number | null;
  Mid: number | null;
  Low: number | null;
}

const SEG_COLORS: Record<string, string> = {
  High: "#2b4dff",
  Mid: "#22c55e",
  Low: "#f59e0b",
};

export function MercadoLineChart({
  data,
  suffix = "",
}: {
  data: MercadoSeriesPoint[];
  suffix?: string;
}) {
  if (data.length === 0) {
    return <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">Sin datos.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v}${suffix}`} width={44} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number, name: string) => [`${v}${suffix}`, name]}
        />
        {(["High", "Mid", "Low"] as const).map((seg) => (
          <Line
            key={seg}
            type="monotone"
            dataKey={seg}
            stroke={SEG_COLORS[seg]}
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
