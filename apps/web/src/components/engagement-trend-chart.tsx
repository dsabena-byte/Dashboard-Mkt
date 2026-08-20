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
import type { EngagementTrendRow } from "@/lib/social-queries";
import { formatFechaCorta } from "@/lib/dates";
import { brandLabel } from "@/lib/demo/anonymize";

interface Props {
  data: EngagementTrendRow[];
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

export function EngagementTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Sin datos sociales en el rango. Configurá el workflow para que empiece a poblar.
      </div>
    );
  }

  // Serie por cuenta: real = handle (color/agrupación) ; label = texto visible
  // (anonimizado en demo). El pivot se keyea por el label visible para que la
  // Legend/Tooltip muestren la etiqueta anonimizada.
  const cuentasSet = new Set<string>();
  for (const row of data) cuentasSet.add(row.cuenta);
  const cuentaSeries = [...cuentasSet].map((real) => ({ real, label: labelFor(real) }));

  // Pivot: { fechaLabel, [label]: engagement }
  const fechas = new Map<
    string,
    { fechaLabel: string; [k: string]: number | string | null }
  >();
  for (const row of data) {
    const fechaLabel = formatFechaCorta(row.fecha);
    const existing = fechas.get(row.fecha) ?? { fechaLabel };
    existing[labelFor(row.cuenta)] = row.engagement;
    fechas.set(row.fecha, existing);
  }
  const series = [...fechas.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={series} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="fechaLabel" stroke="hsl(var(--muted-foreground))" fontSize={12} />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickFormatter={(v: number) => v.toFixed(0)}
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
          <Line
            key={s.label}
            type="monotone"
            dataKey={s.label}
            stroke={colorFor(s.real)}
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
