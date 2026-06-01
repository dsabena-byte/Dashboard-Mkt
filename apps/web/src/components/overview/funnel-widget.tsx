"use client";

import { useState } from "react";
import type { FunnelData, FunnelCategoria } from "@/lib/funnel-queries";

type Tab = "Total" | FunnelCategoria;

const TABS: Tab[] = ["Total", "Brand", "Lavado", "Refrigeración", "Cocinas", "Lavavajillas"];

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function fmtARS(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

interface StageMetric {
  label: string;
  value: string;
}

export function FunnelWidget({ data }: { data: Record<string, FunnelData> }) {
  const [tab, setTab] = useState<Tab>("Total");
  const f = data[tab] ?? data.Total!;

  const stages: Array<{
    key: string;
    title: string;
    subtitle: string;
    w: number;
    bg: string;
    fg: string;
    metrics: StageMetric[];
  }> = [
    {
      key: "awareness",
      title: "BRAND AWARENESS",
      subtitle: "Audiencia amplia, menos segmentada",
      w: 100,
      bg: "#1e88e5",
      fg: "white",
      metrics: [
        { label: "Inversión", value: fmtARS(f.awareness.inversion) },
        { label: "Alcance pauta", value: fmtNum(f.awareness.alcance) },
        { label: "Sesiones web (home)", value: fmtNum(f.awareness.ga4_sesiones) },
      ],
    },
    {
      key: "interes",
      title: "INTERÉS",
      subtitle: "Tráfico a páginas de categoría",
      w: 82,
      bg: "#22c55e",
      fg: "white",
      metrics: [
        { label: "Sesiones categoría", value: fmtNum(f.interes.ga4_sesiones) },
        { label: "Usuarios", value: fmtNum(f.interes.ga4_usuarios) },
      ],
    },
    {
      key: "consideracion",
      title: "CONSIDERACIÓN",
      subtitle: "Tráfico a producto / SKU + clicks pauta",
      w: 64,
      bg: "#f97316",
      fg: "white",
      metrics: [
        { label: "Inversión", value: fmtARS(f.consideracion.inversion) },
        { label: "Clicks pauta", value: fmtNum(f.consideracion.clics) },
        { label: "Sesiones PDP", value: fmtNum(f.consideracion.ga4_sesiones) },
      ],
    },
    {
      key: "compra",
      title: "COMPRA",
      subtitle: "Gestionado por el área de Ecommerce",
      w: 46,
      bg: "#cbd5e1",
      fg: "#475569",
      metrics: [{ label: "—", value: "—" }],
    },
  ];

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 transition-colors ${
              tab === t
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t === "Total" ? "Drean total" : t}
          </button>
        ))}
      </div>

      {/* Funnel */}
      <div className="flex flex-col items-center gap-2">
        {stages.map((s) => (
          <div
            key={s.key}
            className="rounded-xl px-5 py-3 shadow-sm transition-all"
            style={{
              width: `${s.w}%`,
              backgroundColor: s.bg,
              color: s.fg,
              opacity: s.key === "compra" ? 0.7 : 1,
            }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wide">{s.title}</div>
                <div className="mt-0.5 text-[10px] opacity-80">{s.subtitle}</div>
              </div>
              <div className="flex flex-wrap items-baseline justify-end gap-3 text-right">
                {s.metrics.map((m) => (
                  <div key={m.label} className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wide opacity-80">{m.label}</div>
                    <div className="text-base font-bold tabular-nums">{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="pt-1 text-[10px] text-muted-foreground">
        Pauta: <code>pauta_performance</code> · GA4: <code>vw_ga4_funnel</code> (home / categoría / producto)
        · Compra gestionada por Ecommerce.
      </p>
    </div>
  );
}
