"use client";

// "Detalle por Tienda" de la app vieja: todas las tiendas, ordenable por columna (default: peor % CB primero).
import { useMemo, useState } from "react";
import type { CbByTienda } from "@/lib/cb-queries";

type Key = "cliente" | "tienda" | "cb_lavado" | "cb_refri" | "cb_coccion" | "cb_total";
const COLS: Array<{ k: Key; label: string; cls: string }> = [
  { k: "cliente", label: "Cliente", cls: "bg-muted/40 text-left text-muted-foreground" },
  { k: "tienda", label: "Tienda", cls: "bg-muted/40 text-left text-muted-foreground" },
  { k: "cb_lavado", label: "% CB Lavado", cls: "bg-blue-100 text-center text-blue-800" },
  { k: "cb_refri", label: "% CB Refri", cls: "bg-cyan-100 text-center text-cyan-800" },
  { k: "cb_coccion", label: "% CB Cocción", cls: "bg-pink-100 text-center text-pink-800" },
];

// Semáforo de la app vieja para esta tabla: ≥100% verde, ≥60% ámbar, debajo rojo.
function pctCls(p: number | null): string {
  if (p == null) return "bg-slate-100 text-slate-400";
  if (p >= 100) return "bg-emerald-100 text-emerald-800";
  if (p >= 60) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-700";
}

export function CbDetalleTienda({ rows }: { rows: CbByTienda[] }) {
  const [sort, setSort] = useState<{ k: Key; asc: boolean }>({ k: "cb_total", asc: true });
  const data = useMemo(() => [...rows].sort((a, b) => {
    const va = a[sort.k], vb = b[sort.k];
    const d = typeof va === "string" || typeof vb === "string"
      ? String(va ?? "").localeCompare(String(vb ?? ""), "es") : (va ?? 0) - (vb ?? 0);
    return sort.asc ? d : -d;
  }), [rows, sort]);
  const click = (k: Key) => setSort((s) => (s.k === k ? { k, asc: !s.asc } : { k, asc: false }));
  return (
    <div className="max-h-[520px] overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="text-[11px] font-semibold uppercase tracking-wide">
            {COLS.map((c) => (
              <th key={c.k} onClick={() => click(c.k)} className={`cursor-pointer select-none border-b px-3 py-2 ${c.cls}`}>
                {c.label}{sort.k === c.k ? (sort.asc ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={`${r.cliente}-${r.tienda}-${i}`} className="border-b last:border-0">
              <td className="px-3 py-1.5 text-muted-foreground">{r.cliente}</td>
              <td className="px-3 py-1.5">{r.tienda}</td>
              {(["cb_lavado", "cb_refri", "cb_coccion"] as const).map((k) => (
                <td key={k} className="px-2 py-1 text-center">
                  <span className={`inline-block min-w-[44px] rounded px-1.5 py-0.5 font-semibold tabular-nums ${pctCls(r[k])}`}>
                    {r[k] != null ? `${Math.round(r[k]!)}%` : "—"}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
