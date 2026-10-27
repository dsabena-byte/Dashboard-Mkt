"use client";

import { useState } from "react";

// Tabla de desempeño de la app vieja de Trade (Floor Share y Cuadro Básico): encabezado azul, % + Δ vs objetivo por
// columna, semáforo (verde hasta −2 pp del objetivo, amarillo hasta −6, rojo debajo) y fila de total. Server-safe.

export type AggCol = { label: string; obj: number };
export type AggFila = { key: string; nombre: string; vals: (number | null)[] };

function celda(v: number, obj: number): string {
  const d = v - obj;
  if (d >= -2) return "bg-[#c6f6d5] text-[#064e3b]";
  if (d >= -6) return "bg-[#fef3c7] text-[#78350f]";
  return "bg-[#fecaca] text-[#7f1d1d]";
}

function Celdas({ vals, cols, total = false }: { vals: (number | null)[]; cols: AggCol[]; total?: boolean }) {
  const borde = total ? "border-[#1e3a8a]" : "border-slate-200";
  return (
    <>
      {cols.map((c, i) => {
        const v = vals[i];
        if (v == null) return [
          <td key={`${i}p`} className={`border ${borde} ${total ? "" : "bg-slate-100"} px-2 py-1.5 text-center text-slate-400`}>—</td>,
          <td key={`${i}d`} className={`border ${borde} px-2 py-1.5`} />,
        ];
        const d = Math.round(v - c.obj);
        return [
          <td key={`${i}p`} className={`border ${borde} px-2 py-1.5 text-center font-bold tabular-nums ${total ? "" : celda(v, c.obj)}`}>{v.toFixed(0)}%</td>,
          <td key={`${i}d`} className={`whitespace-nowrap border ${borde} px-2 py-1.5 text-center tabular-nums ${total ? "text-white/85" : ""}`}>
            {d > 0 ? "+" : ""}{d} pp <span className={d >= 0 ? "font-bold text-green-600" : "font-bold text-red-600"}>{d >= 0 ? "↑" : "↓"}</span>
          </td>,
        ];
      })}
    </>
  );
}

// Sin barra de desplazamiento interna (pedido del user: "muchas barras"): la página scrollea; las tablas largas
// muestran las primeras LIMITE filas + "Ver todas".
const LIMITE = 25;

export function AggTable({ titulo, columna, totalLabel, subtitulo, cols, filas, total }: {
  titulo: string; columna: string; totalLabel: string; subtitulo: string;
  cols: AggCol[]; filas: AggFila[]; total: (number | null)[];
}) {
  const [todas, setTodas] = useState(false);
  if (filas.length === 0) return null;
  const visibles = todas || filas.length <= LIMITE + 5 ? filas : filas.slice(0, LIMITE);
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">{titulo}</h3>
        <span className="text-[11px] text-muted-foreground">{subtitulo}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-[11px] font-bold text-slate-800">{columna}</th>
              {cols.map((c) => (
                <th key={c.label} colSpan={2} className="border border-[#1e3a8a] bg-[#1e3a8a] px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-white">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.key}>
                <td className="min-w-[140px] border border-slate-200 px-2 py-1.5 text-slate-800">{f.nombre}</td>
                <Celdas vals={f.vals} cols={cols} />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#1e3a8a] font-extrabold text-white">
              <td className="whitespace-nowrap border border-[#1e3a8a] px-2 py-1.5">{totalLabel}</td>
              <Celdas vals={total} cols={cols} total />
            </tr>
          </tfoot>
        </table>
      </div>
      {visibles.length < filas.length || todas ? (
        filas.length > LIMITE + 5 && (
          <button onClick={() => setTodas(!todas)} className="mt-2 text-xs font-semibold text-blue-700 hover:underline">
            {todas ? "Ver menos" : `Ver todas (${filas.length})`}
          </button>
        )
      ) : null}
    </section>
  );
}
