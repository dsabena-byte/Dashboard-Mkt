"use client";

// Gráficos del Plan de Medios anual (/performance/plan). Sistema visual del tablero: plan en rampa de
// azules, offline / meta en gris pizarra, verde/amarillo/rojo nunca decorativo.
import { Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Legend, Line, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { ChartTooltip } from "@/components/chart-tooltip";

const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const RAMPA = ["#1e3a8a", "#1e40af", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#cbd5e1"];
const GRIS = "#64748b";
const fmtM = (v: number) => `$${(v / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
const fmtN = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M` : Math.round(v).toLocaleString("es-AR"));
const fmtAxis = (v: number) => (Math.abs(v) >= 1e6 ? `${Math.round(v / 1e6)}M` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v));
const legend = { wrapperStyle: { fontSize: 11 }, formatter: (v: string) => <span style={{ color: "hsl(var(--foreground))" }}>{v}</span> };

/** Barras apiladas por mes. `pct` = cada mes suma 100%. */
export function ApiladoMensual({ series, pct, colores, moneda = true, alto = 260 }: {
  series: [string, number[]][]; pct?: boolean; colores?: string[]; moneda?: boolean; alto?: number;
}) {
  const data = MES.map((mes, i) => {
    const tot = series.reduce((s, [, a]) => s + (a[i] ?? 0), 0);
    return Object.fromEntries([["mes", mes], ...series.map(([n, a]) => [n, pct ? (tot > 0 ? ((a[i] ?? 0) / tot) * 100 : 0) : (a[i] ?? 0)])]);
  });
  const fmt = (v: number) => (pct ? `${v.toFixed(1)}%` : moneda ? fmtM(v) : fmtN(v));
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="mes" fontSize={11} tickLine={false} stroke="hsl(var(--muted-foreground))" />
        <YAxis width={56} fontSize={11} tickLine={false} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => (pct ? `${Math.round(v)}%` : fmtAxis(v))} domain={pct ? [0, 100] : undefined} />
        <Tooltip content={<ChartTooltip format={(v) => fmt(v)} />} cursor={{ fill: "rgba(100,116,139,.06)" }} />
        <Legend {...legend} />
        {series.map(([n], k) => <Bar key={n} dataKey={n} stackId="a" fill={(colores ?? RAMPA)[k % (colores ?? RAMPA).length]} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Ranking horizontal: % del plan por medio. */
export function RankingMedios({ items }: { items: [string, number][] }) {
  const tot = items.reduce((s, [, v]) => s + v, 0);
  const data = [...items].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([medio, v]) => ({ medio, pct: tot > 0 ? (v / tot) * 100 : 0, v }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 24 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" fontSize={11} tickLine={false} tickFormatter={(v: number) => `${v}%`} stroke="hsl(var(--muted-foreground))" />
        <YAxis type="category" dataKey="medio" width={140} fontSize={11} tickLine={false} stroke="hsl(var(--muted-foreground))" />
        <Tooltip content={<ChartTooltip format={(v) => `${v.toFixed(1)}%`} />} cursor={{ fill: "rgba(100,116,139,.06)" }} />
        <Bar dataKey="pct" name="% del plan" fill="#1e40af" radius={[0, 3, 3, 0]} label={{ position: "right", fontSize: 10, fill: "#1e293b", formatter: (v: number) => `${v.toFixed(1)}%` }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Impresiones y alcance (barras) + frecuencia (línea, eje derecho). */
export function ImpactosMensual({ total }: { total: { impr: number; alc: number }[] }) {
  const data = MES.map((mes, i) => ({ mes, Impresiones: total[i]?.impr ?? 0, Alcance: total[i]?.alc ?? 0, Frecuencia: total[i]?.alc ? +(total[i]!.impr / total[i]!.alc).toFixed(2) : null }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="mes" fontSize={11} tickLine={false} stroke="hsl(var(--muted-foreground))" />
        <YAxis yAxisId="v" width={56} fontSize={11} tickLine={false} stroke="hsl(var(--muted-foreground))" tickFormatter={fmtAxis} />
        <YAxis yAxisId="f" orientation="right" width={36} fontSize={11} tickLine={false} stroke="#0f172a" />
        <Tooltip content={<ChartTooltip format={(v, n) => (n === "Frecuencia" ? v.toFixed(2) : fmtN(v))} />} cursor={{ fill: "rgba(100,116,139,.06)" }} />
        <Legend {...legend} />
        <Bar yAxisId="v" dataKey="Impresiones" fill="#1e40af" radius={[3, 3, 0, 0]} />
        <Bar yAxisId="v" dataKey="Alcance" fill="#93c5fd" radius={[3, 3, 0, 0]} />
        <Line yAxisId="f" type="monotone" dataKey="Frecuencia" stroke="#0f172a" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Burbujas por medio: inversión anual (x) vs CPM (y), tamaño = impresiones. */
export function CpmMedios({ items }: { items: { medio: string; inv: number; cpm: number; impr: number }[] }) {
  const data = items.filter((x) => x.inv > 0 && x.cpm > 0);
  const maxInv = Math.max(0, ...data.map((x) => x.inv));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ top: 12, right: 24, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis type="number" dataKey="inv" name="Inversión" fontSize={11} tickLine={false} tickFormatter={fmtAxis} stroke="hsl(var(--muted-foreground))" />
        <YAxis type="number" dataKey="cpm" name="CPM" width={56} fontSize={11} tickLine={false} tickFormatter={(v: number) => `$${fmtAxis(v)}`} stroke="hsl(var(--muted-foreground))" />
        <ZAxis type="number" dataKey="impr" range={[60, 900]} name="Impresiones" />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            const p = active ? (payload?.[0]?.payload as (typeof data)[number] | undefined) : undefined;
            if (!p) return null;
            return (
              <div className="rounded-md border bg-card px-2.5 py-1.5 text-xs shadow">
                <div className="font-semibold">{p.medio}</div>
                <div>Inversión {fmtM(p.inv)} · CPM ${Math.round(p.cpm).toLocaleString("es-AR")} · {fmtN(p.impr)} impresiones</div>
              </div>
            );
          }}
        />
        <Scatter data={data} fill="#1e40af" fillOpacity={0.65} stroke="#1e3a8a">
          {/* Solo se rotulan los medios grandes (los chicos se pisan); el resto se lee en el tooltip y en la tabla. */}
          <LabelList dataKey="medio" content={(p: { x?: number | string; y?: number | string; value?: string | number; index?: number }) => {
            const d = data[p.index ?? -1];
            if (!d || d.inv < maxInv * 0.15) return null;
            return <text x={Number(p.x)} y={Number(p.y) - 6} fontSize={10} fill="#1e293b" textAnchor="middle">{String(p.value)}</text>;
          }} />
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/** Fondo de celda para el mapa de calor (azul, intensidad por valor). */
export const calor = (v: number, max: number) => (v > 0 && max > 0 ? { background: `rgba(30,64,175,${(0.08 + 0.55 * (v / max)).toFixed(3)})`, color: v / max > 0.6 ? "#fff" : undefined } : undefined);

export const BGT_COLORES = ["#1e40af", GRIS];
