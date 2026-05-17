"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const CT_COLORS: Record<string, string> = {
  IMAGE: "#dc2626",
  VIDEO: "#f97316",
  SIDECAR: "#0ea5e9",
  REEL: "#7c3aed",
};

interface Props {
  data: Array<{ red: string; content_type: string; count: number }>;
}

export function SocialContentMixChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">Sin datos.</div>;
  }
  const reds = [...new Set(data.map((d) => d.red))];
  const cts = [...new Set(data.map((d) => d.content_type))];
  const flat = reds.map((r) => {
    const row: Record<string, string | number> = { red: r };
    for (const ct of cts) {
      row[ct] = data.find((d) => d.red === r && d.content_type === ct)?.count ?? 0;
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={flat} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="red" stroke="hsl(var(--muted-foreground))" fontSize={10} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
        <Tooltip
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }}
        />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {cts.map((ct) => (
          <Bar key={ct} dataKey={ct} stackId="a" fill={CT_COLORS[ct] ?? "#94a3b8"} radius={[0, 0, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
