"use client";
import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { FloorShareWeeklyChart } from "@/components/floor-share/floor-share-charts";
import type { WeeklyBrandPoint } from "@/lib/floor-share-queries";

const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const mesLabel = (ym: number) => `${MES[(ym % 100) - 1] ?? ""} ${String(Math.floor(ym / 100)).slice(2)}`;

// Evolución Drean vs top marcas con toggle Semanal / Mensual y descarga como imagen (PNG).
export function FsEvolucion({ semanal, mensual, marcas }: { semanal: WeeklyBrandPoint[]; mensual: WeeklyBrandPoint[]; marcas: string[] }) {
  const [modo, setModo] = useState<"sem" | "mes">("sem");
  const ref = useRef<HTMLDivElement>(null);
  const data = modo === "mes" && mensual.length ? mensual : semanal;
  const bajar = async () => {
    if (!ref.current) return;
    const { toPng } = await import("html-to-image");
    const url = await toPng(ref.current, { backgroundColor: "#ffffff", pixelRatio: 2, filter: (n) => !(n instanceof HTMLElement && n.dataset.noimg === "1") });
    const a = document.createElement("a");
    a.href = url; a.download = `floor-share-evolucion-${modo === "mes" ? "mensual" : "semanal"}.png`; a.click();
  };
  const btn = (activo: boolean) => `rounded-md border px-2 py-0.5 text-[11px] font-semibold ${activo ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`;
  return (
    <div ref={ref} className="bg-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">📈 Evolución {modo === "mes" ? "mensual" : "semanal"} — Drean vs Top marcas</h3>
        <div className="flex items-center gap-1" data-noimg="1">
          <button type="button" className={btn(modo === "sem")} onClick={() => setModo("sem")}>Semanal</button>
          <button type="button" className={btn(modo === "mes")} onClick={() => setModo("mes")} disabled={!mensual.length}>Mensual</button>
          <button type="button" className="ml-1 rounded-md border p-1 text-muted-foreground hover:text-foreground" onClick={bajar} title="Descargar el gráfico como imagen (PNG)" aria-label="Descargar el gráfico como imagen"><Download className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <FloorShareWeeklyChart data={data} marcas={marcas} label={modo === "mes" ? mesLabel : undefined} />
    </div>
  );
}
