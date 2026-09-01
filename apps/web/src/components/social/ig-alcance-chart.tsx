"use client";

import { Bar, CartesianGrid, ComposedChart, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/chart-tooltip";

export interface IgAlcanceDatum {
  mes: string;
  alcance: number | null;
  metaAlcance: number | null;
}

const fmtK = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(Math.round(v)));
const fmtKfull = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : String(Math.round(v)));

export function IgAlcanceChart({ data }: { data: IgAlcanceDatum[] }) {
  if (data.length === 0) return <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">Sin datos.</div>;
  const hasMeta = data.some((d) => d.metaAlcance != null);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
        <YAxis yAxisId="alc" width={56} stroke="#1e40af" fontSize={11} tickLine={false} tickFormatter={fmtK} label={{ value: "Alcance", angle: -90, position: "insideLeft", fontSize: 10, fill: "#1e40af" }} />
        {/* Eje derecho fantasma: reserva el mismo ancho que el gráfico de engagement para que los meses queden alineados verticalmente entre ambos. */}
        <YAxis yAxisId="ghost" orientation="right" width={56} tick={false} axisLine={false} />
        <Tooltip content={<ChartTooltip format={(v) => fmtKfull(v)} />} cursor={{ fill: "rgba(100,116,139,.06)" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>} />
        {hasMeta && <Bar yAxisId="alc" dataKey="metaAlcance" name="Meta alcance" fill="#cbd5e1" stroke="#64748b" strokeWidth={1.25} radius={[3, 3, 0, 0]} />}
        <Bar yAxisId="alc" dataKey="alcance" name="Alcance (real)" fill="#1e40af" radius={[3, 3, 0, 0]}>
          <LabelList dataKey="alcance" position="top" fontSize={9} fill="#1e293b" formatter={(v: number) => (v ? fmtK(v) : "")} />
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
