"use client";

// Gráfico de evolución mensual real vs meta para los KPIs de Pauta Mkt.
// Replica el sistema visual de Instagram: real en color del KPI, meta en gris
// pizarra, etiquetas numéricas sobre la serie real, eje del color del KPI y
// ancho fijo (56px) para que los meses queden alineados entre gráficos apilados.
// mode "bar" = volumen (Inversión, Alcance, Impresiones, Clicks);
// mode "line" = ratios (Frecuencia, VTR ≥50%).

import { Bar, CartesianGrid, ComposedChart, LabelList, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "@/components/chart-tooltip";

export interface MetaEvolDatum {
  mes: string;
  real: number | null;
  meta: number | null;
}

export type MetaEvolUnidad = "%" | "x" | "$" | "";

function makeFmt(unidad: MetaEvolUnidad) {
  const fmtNum = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}k` : String(Math.round(v));
  const fmtNumFull = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : String(Math.round(v));
  const axis =
    unidad === "%" ? (v: number) => `${v.toFixed(0)}%` :
    unidad === "x" ? (v: number) => v.toFixed(1) :
    unidad === "$" ? (v: number) => `$${fmtNum(v)}` :
    fmtNum;
  const label =
    unidad === "%" ? (v: number) => `${v.toFixed(1)}%` :
    unidad === "x" ? (v: number) => v.toFixed(1) :
    unidad === "$" ? (v: number) => `$${fmtNum(v)}` :
    fmtNum;
  const tip =
    unidad === "%" ? (v: number) => `${v.toFixed(2)}%` :
    unidad === "x" ? (v: number) => v.toFixed(2) :
    unidad === "$" ? (v: number) => `$${fmtNumFull(v)}` :
    fmtNumFull;
  return { axis, label, tip };
}

export function MetaEvolChart({
  data,
  mode,
  unidad = "",
  color = "#1e40af",
  realName,
  metaName = "Meta",
}: {
  data: MetaEvolDatum[];
  mode: "bar" | "line";
  unidad?: MetaEvolUnidad;
  color?: string;
  realName: string;
  metaName?: string;
}) {
  if (data.length === 0) return <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">Sin datos.</div>;
  const hasMeta = data.some((d) => d.meta != null);
  const { axis, label, tip } = makeFmt(unidad);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 22, right: 12, left: 8, bottom: 8 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
        <YAxis width={56} stroke={color} fontSize={11} tickLine={false} tickFormatter={axis} />
        <Tooltip content={<ChartTooltip format={(v) => tip(v)} />} cursor={mode === "bar" ? { fill: "rgba(100,116,139,.06)" } : { stroke: "hsl(var(--border))" }} />
        <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>} />

        {mode === "bar" ? (
          <>
            {hasMeta && <Bar dataKey="meta" name={metaName} fill="#cbd5e1" stroke="#64748b" strokeWidth={1.25} radius={[3, 3, 0, 0]} />}
            <Bar dataKey="real" name={realName} fill={color} radius={[3, 3, 0, 0]}>
              <LabelList dataKey="real" position="top" fontSize={9} fill="#1e293b" formatter={(v: number) => (v ? label(v) : "")} />
            </Bar>
          </>
        ) : (
          <>
            {hasMeta && (
              <Line type="monotone" dataKey="meta" name={metaName} stroke="#94a3b8" strokeWidth={1.75} strokeDasharray="5 4" dot={{ r: 2.5, fill: "#94a3b8" }} connectNulls />
            )}
            <Line type="monotone" dataKey="real" name={realName} stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color, stroke: "#fff", strokeWidth: 1 }} activeDot={{ r: 5 }} connectNulls>
              <LabelList dataKey="real" position="top" offset={10} fontSize={9} fontWeight={600} fill={color} formatter={(v: number) => (v != null ? label(v) : "")} />
            </Line>
          </>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
