"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Props {
  data: Array<{ key: string; label: string; positivo: number; negativo: number; neutro: number }>;
}

export function SocialSentimentChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">Sin datos.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 6, right: 12, left: 60, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <YAxis type="category" dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} width={80} />
        <Tooltip
          formatter={(v: number) => `${v.toFixed(0)}%`}
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }}
        />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Bar dataKey="positivo" name="Positivo" stackId="s" fill="#16a34a" />
        <Bar dataKey="negativo" name="Negativo" stackId="s" fill="#dc2626" />
        <Bar dataKey="neutro" name="Neutro" stackId="s" fill="#64748b" />
      </BarChart>
    </ResponsiveContainer>
  );
}
