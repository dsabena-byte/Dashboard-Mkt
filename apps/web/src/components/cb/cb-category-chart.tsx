"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Row {
  division: string;
  cb_pct: number;
  infalt_pct: number;
  estrat_pct: number;
}

export function CbCategoryChart({ data }: { data: Row[] }) {
  if (data.length === 0) {
    return <div className="py-12 text-center text-xs text-muted-foreground">Sin datos para graficar.</div>;
  }
  const chartData = data.map((d) => ({
    division: d.division,
    "% CB": Number(d.cb_pct.toFixed(0)),
    "% Infaltables": Number(d.infalt_pct.toFixed(0)),
    "% Estratégico": Number(d.estrat_pct.toFixed(0)),
  }));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 24, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="division" fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
          formatter={(v: number) => `${v}%`}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="% CB" fill="#2b4dff" radius={[4, 4, 0, 0]}>
          <LabelList dataKey="% CB" position="top" fontSize={11} fontWeight={700} formatter={(v: number) => `${v}%`} />
        </Bar>
        <Bar dataKey="% Infaltables" fill="#a78bfa" radius={[4, 4, 0, 0]}>
          <LabelList dataKey="% Infaltables" position="top" fontSize={11} fontWeight={700} formatter={(v: number) => `${v}%`} />
        </Bar>
        <Bar dataKey="% Estratégico" fill="#ec4899" radius={[4, 4, 0, 0]}>
          <LabelList dataKey="% Estratégico" position="top" fontSize={11} fontWeight={700} formatter={(v: number) => `${v}%`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
