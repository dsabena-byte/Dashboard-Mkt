"use client";
import { useState } from "react";
import { CbWeeklyChart } from "@/components/cb/cb-weekly-chart";

type Point = { semana: number; cb_pct: number | null; infalt_pct: number | null; estrat_pct: number | null };
const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const mesLabel = (ym: number) => `${MES[(ym % 100) - 1] ?? ""} ${String(Math.floor(ym / 100)).slice(2)}`;

// Evolución del CB de Trade con toggle Semanal / Mensual (mismo criterio que Floor Share: mes = el del lunes de la semana).
export function CbEvolucion({ semanal, mensual }: { semanal: Point[]; mensual: Point[] }) {
  const [modo, setModo] = useState<"sem" | "mes">("sem");
  const mes = modo === "mes" && mensual.length > 0;
  const btn = (activo: boolean) => `rounded-md border px-2 py-0.5 text-[11px] font-semibold ${activo ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`;
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">📈 Evolución {mes ? "mensual" : "semanal"}</h3>
        <div className="flex items-center gap-1">
          <button type="button" className={btn(!mes)} onClick={() => setModo("sem")}>Semanal</button>
          <button type="button" className={btn(mes)} onClick={() => setModo("mes")} disabled={!mensual.length}>Mensual</button>
        </div>
      </div>
      <CbWeeklyChart data={mes ? mensual : semanal} label={mes ? mesLabel : undefined} />
    </>
  );
}
