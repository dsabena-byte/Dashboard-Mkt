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
  const total = data.reduce((a, d) => a + d.count, 0);
  const dataWithPct = data.map((d) => ({
    ...d,
    pct: total > 0 ? (d.count / total) * 100 : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={dataWithPct}
          dataKey="count"
          nameKey="content_type"
          cx="40%"
          cy="50%"
          outerRadius={75}
          innerRadius={40}
          label={(props) => {
            const { cx, cy, midAngle, innerRadius, outerRadius, pct } = props as unknown as {
              cx: number;
              cy: number;
              midAngle: number;
              innerRadius: number;
              outerRadius: number;
              pct: number;
            };
            if (pct < 5) return null;
            const RAD = Math.PI / 180;
            const r = innerRadius + (outerRadius - innerRadius) * 0.55;
            const x = cx + r * Math.cos(-midAngle * RAD);
            const y = cy + r * Math.sin(-midAngle * RAD);
            return (
              <text x={x} y={y} fill="#fff" fontSize={11} fontWeight={600} textAnchor="middle" dominantBaseline="central">
                {pct.toFixed(0)}%
              </text>
            );
          }}
          labelLine={false}
        >
          {dataWithPct.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, _name, item) => {
            const pct = (item.payload as { pct: number }).pct;
            return [`${value} (${pct.toFixed(1)}%)`, item.payload.content_type];
          }}
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 11 }}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ fontSize: 10 }}
          formatter={(value, entry) => {
            const item = entry.payload as unknown as { pct: number };
            return `${value} · ${item.pct.toFixed(0)}%`;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
