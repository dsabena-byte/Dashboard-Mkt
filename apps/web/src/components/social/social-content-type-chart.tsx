"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#dc2626", "#f97316", "#0ea5e9", "#7c3aed", "#059669"];

interface Props {
  data: Array<{ content_type: string; count: number }>;
}

export function SocialContentTypeChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">Sin datos.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="content_type" cx="40%" cy="50%" outerRadius={70} innerRadius={40}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }}
        />
        <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 10 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
