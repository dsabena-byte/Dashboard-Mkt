"use client";

// Box de Inversión del tab Impacto Campaña con dos vistas alternables:
//  - "meta": Inversión real vs meta mensual (barras real azul + meta gris pizarra).
//  - "onoff": Evolución de inversión ejecutada por tipo de medio (ON/OFF), SOLO
//    meses ya cerrados (hasta el último mes ejecutado).
// El botón vive arriba a la derecha del box.

import { useState } from "react";
import { MetaEvolChart, type MetaEvolDatum } from "@/components/pauta/meta-evol-chart";
import { MonthlyInvestmentChart } from "@/components/pauta/pauta-charts";

export interface InversionOnOffDatum {
  mes: string;
  digital: number | null;
  tvCable: number | null;
  dooh: number | null;
  ooh: number | null;
  total?: number | null;
  isPlanned?: boolean;
  mes_pct?: number | null;
  pct_marker?: number;
}

export function InversionToggleChart({
  metaData,
  onOffData,
}: {
  metaData: MetaEvolDatum[];
  onOffData: InversionOnOffDatum[];
}) {
  const [view, setView] = useState<"meta" | "onoff">("meta");
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {view === "meta" ? "Inversión — real vs meta" : "Inversión ejecutada por medio (ON / OFF)"}
        </h4>
        <button
          type="button"
          onClick={() => setView((v) => (v === "meta" ? "onoff" : "meta"))}
          className="shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          {view === "meta" ? "Ver Evolución ON/OFF" : "Ver real vs meta"}
        </button>
      </div>
      {view === "meta" ? (
        <MetaEvolChart data={metaData} mode="bar" unidad="$" color="#1e40af" realName="Inversión" metaName="Meta inversión" />
      ) : (
        <MonthlyInvestmentChart data={onOffData} />
      )}
    </div>
  );
}
