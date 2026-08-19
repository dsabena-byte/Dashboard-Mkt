"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PilarBreakdownRow } from "@/lib/social-queries";
import { brandLabel } from "@/lib/demo/anonymize";

interface Props {
  data: PilarBreakdownRow[];
}

const BRAND_COLORS: Record<string, string> = {
  dreanargentina: "#e31e24",
  "philco.arg": "#f97316",
  gafaargentina: "#0ea5e9",
};

// handle interno → nombre de marca real (para que brandLabel resuelva la
// etiqueta demo consistente). Sin demo brandLabel devuelve el nombre igual.
const BRAND_NAMES: Record<string, string> = {
  dreanargentina: "Drean",
  "philco.arg": "Philco",
  gafaargentina: "Gafa",
};

function colorFor(cuenta: string): string {
  return BRAND_COLORS[cuenta] ?? "#7c3aed";
}

// Etiqueta visible de la cuenta (anonimizada en modo demo). El color y la
// agrupación siguen usando el handle real; solo el texto pasa por brandLabel.
function labelFor(cuenta: string): string {
  return brandLabel(BRAND_NAMES[cuenta] ?? cuenta);
}

export function PilarChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Sin datos de pilares.
      </div>
    );
  }

  // Serie por cuenta: real = handle (color/agrupación) ; label = texto visible
  // (anonimizado en demo). El pivot se keyea por el label visible para que la
  // Legend/Tooltip muestren la etiqueta anonimizada.
  const cuentasSet = new Set<string>();
  for (const r of data) cuentasSet.add(r.cuenta);
  const cuentaSeries = [...cuentasSet].map((real) => ({ real, label: labelFor(real) }));

  // Pivot: { pilar, [label]: posts }
  const pivot = new Map<string, Record<string, number | string>>();
  for (const r of data) {
    const label = labelFor(r.cuenta);
    const existing = pivot.get(r.pilar) ?? { pilar: r.pilar };
    existing[label] = ((existing[label] as number) ?? 0) + r.posts;
    pivot.set(r.pilar, existing);
  }
  const series = [...pivot.values()];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={series}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 24, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
        <YAxis
          type="category"
          dataKey="pilar"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          width={100}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {cuentaSeries.map((s) => (
          <Bar key={s.label} dataKey={s.label} fill={colorFor(s.real)} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
