"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

interface TrendDatum {
  mes: string;                                  // YYYY-MM
  values: Record<string, number | null>;
}

interface Props {
  data: TrendDatum[];
  brands: string[];
  brandLabels: Record<string, string>;
  brandColors: Record<string, string>;
}

export function SocialTrendChart({ data, brands, brandLabels, brandColors }: Props) {
  if (data.length === 0) {
    return <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">Sin datos.</div>;
  }
  const flat = data.map((d) => {
    const row: Record<string, string | number | null> = { mes: d.mes };
    for (const b of brands) row[b] = d.values[b] ?? null;
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={flat} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={10} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `${v.toFixed(2)}%`} />
        <Tooltip
          formatter={(v: number) => `${v.toFixed(2)}%`}
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }}
        />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {brands.map((b) => (
          <Line
            key={b}
            type="monotone"
            dataKey={b}
            stroke={brandColors[b] ?? "#94a3b8"}
            strokeWidth={2}
            dot={{ r: 3 }}
            name={brandLabels[b] ?? b}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
