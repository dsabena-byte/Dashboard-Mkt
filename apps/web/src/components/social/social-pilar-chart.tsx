"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const PILAR_COLORS = ["#dc2626", "#f97316", "#0ea5e9", "#7c3aed", "#059669", "#eab308"];

interface Props {
  data: Array<{ pilar: string; engagement_promedio: number; posts: number }>;
}

export function SocialPilarChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">Sin datos.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 6, right: 12, left: 60, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} tickFormatter={(v) => `${v.toFixed(2)}%`} />
        <YAxis type="category" dataKey="pilar" stroke="hsl(var(--muted-foreground))" fontSize={11} width={80} />
        <Tooltip
          formatter={(v: number, _name, item) => [`${v.toFixed(2)}% · ${item.payload.posts} posts`, "Engagement"]}
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }}
        />
        <Bar dataKey="engagement_promedio" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PILAR_COLORS[i % PILAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
