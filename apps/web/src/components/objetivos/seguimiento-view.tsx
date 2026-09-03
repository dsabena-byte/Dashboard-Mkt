"use client";

// Vista de Seguimiento con selector General / Lavado / Refrigeración / Cocción.
// Las 4 vistas vienen precomputadas del server (un solo cálculo pesado) → el cambio
// es instantáneo, sin recargar. Cada vista = cards de objetivos + scorecard de KPIs.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ObjetivosHero } from "./objetivos-hero";
import { KpiScorecard } from "./kpi-scorecard";
import { readNavDelta } from "@/lib/nav-timing";
import type { SeguimientoCompleto } from "@/lib/objetivos-por-categoria";

export function SeguimientoView({ data }: { data: SeguimientoCompleto }) {
  const [key, setKey] = useState(data.vistas[0]?.key ?? "general");
  // Tiempo real vivido: clic en el menú → esta vista montada (incluye cold start,
  // queries, render RSC, red e hidratación). null si se entró sin pasar por el menú.
  const [realMs, setRealMs] = useState<number | null>(null);
  useEffect(() => { setRealMs(readNavDelta("/overview")); }, []);
  if (!data.disponible || data.vistas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
        Todavía no hay un <b className="text-foreground">Mapa Estratégico</b> guardado. Andá al{" "}
        <Link href="/mapa-estrategico" className="font-medium text-primary hover:underline">Mapa Estratégico</Link>, conectá los KPIs a los objetivos y <b className="text-foreground">Guardá</b>.
      </div>
    );
  }
  const sel = data.vistas.find((v) => v.key === key) ?? data.vistas[0]!;
  const esGeneral = sel.key === "general";

  return (
    <div className="space-y-5">
      {/* Selector General / categorías */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Vista</span>
        <div className="flex rounded-lg border p-0.5 text-sm font-medium">
          {data.vistas.map((v) => (
            <button
              key={v.key}
              onClick={() => setKey(v.key)}
              className={`rounded-md px-3.5 py-1.5 transition-colors ${
                sel.key === v.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">a {data.refMes}</span>
        <span className="ml-auto flex flex-col items-end gap-0.5 font-mono text-[10px] leading-tight">
          {realMs != null && (
            <span className="font-semibold text-foreground" title="Tiempo real vivido: desde el clic en el menú hasta que aparece la página (incluye cold start de Vercel, queries, render y red)">
              ⏱ real {(realMs / 1000).toFixed(1)}s <span className="font-normal text-muted-foreground/70">clic → pantalla</span>
            </span>
          )}
          {data.debug && (
            <span className="text-muted-foreground/70" title="Solo el cómputo de datos en el servidor (no incluye cold start ni red)">
              server {data.debug.totalMs}ms (kpis {data.debug.kpisMs} · resto {data.debug.restMs})
            </span>
          )}
          {data.debug?.breakdown && (
            <span className="text-muted-foreground/60" title="Tiempo de cada grupo de queries (corren en paralelo → el total ≈ la más lenta)">
              {Object.entries(data.debug.breakdown)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([k, v]) => `${k} ${v}ms`)
                .join(" · ")}
            </span>
          )}
        </span>
      </div>

      <div>
        <div className="mb-2.5 text-sm font-bold tracking-tight">
          Objetivos Estratégicos
          {!esGeneral && <span className="text-[11px] font-normal text-muted-foreground"> · {sel.label}</span>}
        </div>
        <ObjetivosHero data={sel.seg} />
      </div>
      <div>
        <div className="mb-2.5 text-sm font-bold tracking-tight">
          KPIs por plan
          <span className="text-[11px] font-normal text-muted-foreground"> · {esGeneral ? "indicadores que alimentan los objetivos" : `cumplimiento en ${sel.label}`}</span>
        </div>
        <KpiScorecard kpis={sel.kpis} />
      </div>
    </div>
  );
}
