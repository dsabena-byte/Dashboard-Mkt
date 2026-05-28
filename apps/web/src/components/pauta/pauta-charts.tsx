"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const fmtARS = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v / 1_000).toFixed(0)}K` : `$${Math.round(v)}`;
const fmtNum = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : String(Math.round(v));

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 6,
  fontSize: 12,
};

export function InvestmentDonut({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => fmtARS(v)} contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function HBarChart({
  data,
  color = "#2b4dff",
  money = false,
}: {
  data: Array<{ name: string; value: number }>;
  color?: string;
  money?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 42)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" tickFormatter={(v) => (money ? fmtARS(v) : fmtNum(v))} fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <YAxis type="category" dataKey="name" width={110} fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <Tooltip formatter={(v: number) => (money ? fmtARS(v) : fmtNum(v))} contentStyle={tooltipStyle} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FulfillmentBars({ data }: { data: Array<{ name: string; value: number }> }) {
  const colorFor = (v: number) => (v >= 150 ? "#10b981" : v >= 110 ? "#2b4dff" : v >= 95 ? "#c9a227" : "#f59e0b");
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 40 }}>
        <XAxis dataKey="name" fontSize={10} stroke="hsl(var(--muted-foreground))" angle={-25} textAnchor="end" interval={0} height={60} />
        <YAxis tickFormatter={(v) => `${v}%`} fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <Tooltip formatter={(v: number) => `${v.toFixed(0)}% del plan`} contentStyle={tooltipStyle} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={colorFor(d.value)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function EfficiencyBars({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 30, top: 4, bottom: 4 }}>
        <XAxis type="number" tickFormatter={(v) => `${v}%`} fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <YAxis type="category" dataKey="name" width={150} fontSize={10} stroke="hsl(var(--muted-foreground))" />
        <Tooltip formatter={(v: number) => `${v.toFixed(1)}% vs plan`} contentStyle={tooltipStyle} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
