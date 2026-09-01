"use client";

// Tooltip legible para recharts: punto de color por serie + texto en color de
// foreground (las series grises/meta se leen bien, no en gris clarito).
interface Entry {
  name?: string;
  value?: number | string | null;
  color?: string;
}

interface Props {
  active?: boolean;
  label?: string | number;
  payload?: Entry[];
  format?: (v: number, name: string) => string;
}

export function ChartTooltip({ active, label, payload, format }: Props) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        borderRadius: 8,
        padding: "7px 10px",
        fontSize: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,.08)",
      }}
    >
      {label != null && <div style={{ fontWeight: 700, marginBottom: 5, color: "hsl(var(--foreground))" }}>{label}</div>}
      {payload.map((e, i) => {
        const v = typeof e.value === "number" ? e.value : null;
        const shown = v == null ? "—" : format ? format(v, e.name ?? "") : String(v);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, color: "hsl(var(--foreground))", lineHeight: 1.6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: e.color ?? "#94a3b8", flex: "0 0 auto" }} />
            <span style={{ opacity: 0.75 }}>{e.name}:</span>
            <span style={{ fontWeight: 600, marginLeft: "auto", paddingLeft: 8 }}>{shown}</span>
          </div>
        );
      })}
    </div>
  );
}
