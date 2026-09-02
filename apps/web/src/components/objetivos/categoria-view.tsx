"use client";

// Selector de categoría (Lavado / Refrigeración / Cocción) que muestra la misma
// interfaz que "Estado de KPIs" (cards de objetivos + scorecard de KPIs) recalculada
// para la categoría elegida. Las 3 vienen precomputadas del server → cambio instantáneo.

import { useState } from "react";
import Link from "next/link";
import { ObjetivosHero } from "./objetivos-hero";
import { KpiScorecard } from "./kpi-scorecard";
import type { SeguimientoPorCategoria } from "@/lib/objetivos-por-categoria";

export function CategoriaView({ data }: { data: SeguimientoPorCategoria }) {
  const [cat, setCat] = useState(data.categorias[0]?.categoria ?? "");
  if (!data.disponible || data.categorias.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
        Todavía no hay un <b className="text-foreground">Mapa Estratégico</b> guardado. Andá al{" "}
        <Link href="/mapa-estrategico" className="font-medium text-primary hover:underline">Mapa Estratégico</Link>, conectá los KPIs a los objetivos y <b className="text-foreground">Guardá</b>.
      </div>
    );
  }
  const sel = data.categorias.find((c) => c.categoria === cat) ?? data.categorias[0]!;

  return (
    <div className="space-y-5">
      {/* Selector de categoría */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Categoría</span>
        <div className="flex rounded-lg border p-0.5 text-sm font-medium">
          {data.categorias.map((c) => (
            <button
              key={c.categoria}
              onClick={() => setCat(c.categoria)}
              className={`rounded-md px-3.5 py-1.5 transition-colors ${
                sel.categoria === c.categoria ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.categoria}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">a {data.refMes}</span>
      </div>

      <div>
        <div className="mb-2.5 text-sm font-bold tracking-tight">Objetivos Estratégicos <span className="text-[11px] font-normal text-muted-foreground">· {sel.categoria}</span></div>
        <ObjetivosHero data={sel.seg} />
      </div>
      <div>
        <div className="mb-2.5 text-sm font-bold tracking-tight">KPIs por plan <span className="text-[11px] font-normal text-muted-foreground">· cumplimiento en {sel.categoria}</span></div>
        <KpiScorecard kpis={sel.kpis} />
      </div>
    </div>
  );
}
