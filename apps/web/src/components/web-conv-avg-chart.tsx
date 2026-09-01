"use client";

import { Bar, CartesianGrid, ComposedChart, LabelList, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/chart-tooltip";

export interface WebConvAvgDatum {
  mes: string;
  convPct: number | null; // conversion rate real (%)
  convMeta: number | null;
  avgReal: number | null; // avg session real (segundos)
  avgMeta: number | null;
}

export function WebConvAvgChart({ data }: { data: WebConvAvgDatum[] }) {
  if (data.length === 0) return <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">Sin datos.</div>;
  const hasConvMeta = data.some((d) => d.convMeta != null);
  const hasAvgMeta = data.some((d) => d.avgMeta != null);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 24, right: 12, left: 8, bottom: 8 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
        {/* Izquierda: Conversion % (líneas) */}
        <YAxis
          yAxisId="left"
          width={56}
          stroke="#0f172a"
          fontSize={11}
          tickLine={false}
          tickFormatter={(v: number) => `${v.toFixed(1)}%`}
          label={{ value: "Conversion %", angle: -90, position: "insideLeft", fontSize: 10, fill: "#0f172a" }}
        />
        {/* Derecha: Avg session en segundos (barras) */}
        <YAxis
          yAxisId="right"
          width={56}
          orientation="right"
          stroke="#1e40af"
          fontSize={11}
          tickLine={false}
          tickFormatter={(v: number) => `${Math.round(v)}s`}
          label={{ value: "Avg session (s)", angle: 90, position: "insideRight", fontSize: 10, fill: "#1e40af" }}
        />
        <Tooltip
          content={<ChartTooltip format={(v, name) => (name.includes("%") ? `${v.toFixed(2)}%` : `${Math.round(v)}s`)} />}
          cursor={{ fill: "rgba(100,116,139,.06)" }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>} />
        {/* Avg session: barra meta (gris) + real (azul, con etiqueta) */}
        {hasAvgMeta && <Bar yAxisId="right" dataKey="avgMeta" name="Meta avg session" fill="#cbd5e1" stroke="#64748b" strokeWidth={1.25} radius={[3, 3, 0, 0]} />}
        <Bar yAxisId="right" dataKey="avgReal" name="Avg session (real)" fill="#1e40af" radius={[3, 3, 0, 0]}>
          <LabelList dataKey="avgReal" position="top" fontSize={9} fill="#1e293b" formatter={(v: number) => (v ? `${Math.round(v)}s` : "")} />
        </Bar>
        {/* Conversion %: línea meta (gris punteada) + real (tinta, con etiqueta) */}
        {hasConvMeta && (
          <Line yAxisId="left" type="monotone" dataKey="convMeta" name="Meta conv. %" stroke="#94a3b8" strokeWidth={1.75} strokeDasharray="5 4" dot={{ r: 2.5, fill: "#94a3b8" }} connectNulls />
        )}
        <Line yAxisId="left" type="monotone" dataKey="convPct" name="Conversion %" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3, fill: "#0f172a", stroke: "#fff", strokeWidth: 1 }} activeDot={{ r: 5 }} connectNulls>
          <LabelList dataKey="convPct" position="top" offset={10} fontSize={9} fontWeight={600} fill="#0f172a" formatter={(v: number) => (v != null ? `${v.toFixed(2)}%` : "")} />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
