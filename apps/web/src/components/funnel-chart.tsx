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
import type { FunnelDailyRow } from "@/lib/queries";
import { formatFechaCorta } from "@/lib/dates";
import { formatNumber } from "@/lib/utils";

interface FunnelChartProps {
  data: FunnelDailyRow[];
}

const SERIES = [
  { key: "impresiones", label: "Impresiones", color: "#6366f1" },
  { key: "clicks",      label: "Clicks",      color: "#3b82f6" },
  { key: "sesiones",    label: "Sesiones",    color: "#10b981" },
  { key: "conversiones",label: "Conversiones",color: "#f59e0b" },
] as const;

export function FunnelChart({ data }: FunnelChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        Sin datos en el rango seleccionado.
      </div>
    );
  }

  const formatted = data.map((row) => ({
    ...row,
    fechaLabel: formatFechaCorta(row.fecha),
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={formatted} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="fechaLabel" stroke="hsl(var(--muted-foreground))" fontSize={12} />
        <YAxis
          yAxisId="left"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickFormatter={(v) => formatNumber(v)}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickFormatter={(v) => formatNumber(v)}
        />
        <Tooltip
          formatter={(value: number) => formatNumber(value)}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {SERIES.map((s) => (
          <Line
            key={s.key}
            yAxisId={s.key === "impresiones" ? "left" : "right"}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
