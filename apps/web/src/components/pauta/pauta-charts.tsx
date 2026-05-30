"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
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
  const total = data.reduce((s, d) => s + d.value, 0);
  const sorted = [...data].sort((a, b) => b.value - a.value);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-[220px] w-full sm:w-[50%]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={sorted} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="55%" outerRadius="95%" paddingAngle={2}>
              {sorted.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => [`${fmtARS(v)} · ${total ? ((v / total) * 100).toFixed(1) : 0}%`, ""]}
              contentStyle={tooltipStyle}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full space-y-1.5 sm:w-[50%]">
        {sorted.map((d) => (
          <div key={d.name} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {fmtARS(d.value)} · <span className="font-semibold text-foreground">{total ? ((d.value / total) * 100).toFixed(1) : 0}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonthlyInvestmentChart({
  data,
}: {
  data: Array<{ mes: string; digital: number | null; tvCable: number | null; dooh: number | null; ooh: number | null }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="mes" fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <YAxis tickFormatter={fmtARS} fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <Tooltip
          formatter={(v: number, n: string) => [fmtARS(v), n]}
          contentStyle={tooltipStyle}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="digital"  stackId="inv" name="Digital"  fill="#2b4dff" />
        <Bar dataKey="tvCable"  stackId="inv" name="TV Cable" fill="#e63946" />
        <Bar dataKey="dooh"     stackId="inv" name="DOOH"     fill="#ec4899" />
        <Bar dataKey="ooh"      stackId="inv" name="OOH"      fill="#f59e0b" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ReachImpressionsChart({
  data,
}: {
  data: Array<{ mes: string; alcance: number | null; impresiones: number | null }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 12, right: 24, left: 8, bottom: 4 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="mes" fontSize={11} stroke="hsl(var(--muted-foreground))" />
        <YAxis
          yAxisId="left"
          orientation="left"
          tickFormatter={fmtNum}
          fontSize={11}
          stroke="#2b4dff"
          label={{ value: "Alcance", angle: -90, position: "insideLeft", offset: 8, fontSize: 11, fill: "#2b4dff" }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickFormatter={fmtNum}
          fontSize={11}
          stroke="#e63946"
          label={{ value: "Impresiones", angle: 90, position: "insideRight", offset: 8, fontSize: 11, fill: "#e63946" }}
        />
        <Tooltip formatter={(v: number) => fmtNum(v)} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="left" dataKey="alcance" name="Alcance" fill="#2b4dff" radius={[4, 4, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="impresiones" name="Impresiones" stroke="#e63946" strokeWidth={2} dot={{ r: 4 }} />
      </ComposedChart>
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
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]}>
          <LabelList dataKey="value" position="right" fontSize={10} formatter={(v: number) => (money ? fmtARS(v) : fmtNum(v))} />
        </Bar>
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
          <LabelList dataKey="value" position="top" fontSize={10} formatter={(v: number) => `${v.toFixed(0)}%`} />
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
          <LabelList dataKey="value" position="right" fontSize={10} formatter={(v: number) => `${v.toFixed(0)}%`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
