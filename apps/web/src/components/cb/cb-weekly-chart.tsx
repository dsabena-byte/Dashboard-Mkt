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

interface Point {
  semana: number;
  cb_pct: number | null;
  infalt_pct: number | null;
  estrat_pct: number | null;
}

export function CbWeeklyChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <div className="py-12 text-center text-xs text-muted-foreground">Sin datos para graficar.</div>;
  }
  const chartData = data.map((d) => ({
    label: `Sem ${d.semana}`,
    "% CB": d.cb_pct,
    "% Infaltables": d.infalt_pct,
    "% Estratégico": d.estrat_pct,
  }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 12, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
          formatter={(v) => (typeof v === "number" ? `${v.toFixed(1)}%` : "—")}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="% CB" stroke="#2b4dff" strokeWidth={2.5} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="% Infaltables" stroke="#a78bfa" strokeWidth={2.5} dot={{ r: 4 }} />
        <Line type="monotone" dataKey="% Estratégico" stroke="#ec4899" strokeWidth={2.5} dot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
