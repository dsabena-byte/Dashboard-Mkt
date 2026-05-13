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
import type { EngagementTrendRow } from "@/lib/social-queries";
import { formatFechaCorta } from "@/lib/dates";

interface Props {
  data: EngagementTrendRow[];
}

const BRAND_COLORS: Record<string, string> = {
  dreanargentina: "#e31e24",
  "philco.arg": "#f97316",
  gafaargentina: "#0ea5e9",
};

function colorFor(cuenta: string): string {
  return BRAND_COLORS[cuenta] ?? "#7c3aed";
}

export function EngagementTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Sin datos sociales en el rango. Configurá el workflow para que empiece a poblar.
      </div>
    );
  }

  // Pivot: { fechaLabel, [cuenta]: engagement }
  const fechas = new Map<
    string,
    { fechaLabel: string; [k: string]: number | string | null }
  >();
  const cuentas = new Set<string>();
  for (const row of data) {
    cuentas.add(row.cuenta);
    const fechaLabel = formatFechaCorta(row.fecha);
    const existing = fechas.get(row.fecha) ?? { fechaLabel };
    existing[row.cuenta] = row.engagement;
    fechas.set(row.fecha, existing);
  }
  const series = [...fechas.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={series} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="fechaLabel" stroke="hsl(var(--muted-foreground))" fontSize={12} />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickFormatter={(v: number) => v.toFixed(0)}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {[...cuentas].map((cuenta) => (
          <Line
            key={cuenta}
            type="monotone"
            dataKey={cuenta}
            stroke={colorFor(cuenta)}
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
