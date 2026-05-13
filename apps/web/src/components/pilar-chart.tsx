"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PilarBreakdownRow } from "@/lib/social-queries";

interface Props {
  data: PilarBreakdownRow[];
}

const BRAND_COLORS: Record<string, string> = {
  dreanargentina: "#e31e24",
  "philco.arg": "#f97316",
  gafaargentina: "#0ea5e9",
};

function colorFor(cuenta: string): string {
  return BRAND_COLORS[cuenta] ?? "#7c3aed";
}

export function PilarChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Sin datos de pilares.
      </div>
    );
  }

  // Pivot: { pilar, [cuenta]: posts }
  const pivot = new Map<string, Record<string, number | string>>();
  const cuentas = new Set<string>();
  for (const r of data) {
    cuentas.add(r.cuenta);
    const existing = pivot.get(r.pilar) ?? { pilar: r.pilar };
    existing[r.cuenta] = ((existing[r.cuenta] as number) ?? 0) + r.posts;
    pivot.set(r.pilar, existing);
  }
  const series = [...pivot.values()];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={series}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 24, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
        <YAxis
          type="category"
          dataKey="pilar"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          width={100}
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
          <Bar key={cuenta} dataKey={cuenta} fill={colorFor(cuenta)} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
