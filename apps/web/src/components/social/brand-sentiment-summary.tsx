"use client";

import { useEffect, useState } from "react";

const BRAND_COLORS: Record<string, string> = {
  dreanargentina: "#dc2626",
  philco_argentina: "#3b82f6",
  gaborealargentina: "#22c55e",
  electrolux_ar: "#f97316",
  whirlpoolargentina: "#8b5cf6",
  "philco.arg": "#3b82f6",
  gafaargentina: "#22c55e",
  electroluxar: "#f97316",
  whirlpoolarg: "#8b5cf6",
};

const BRAND_LABELS: Record<string, string> = {
  dreanargentina: "Drean",
  philco_argentina: "Philco",
  "philco.arg": "Philco",
  gaborealargentina: "Gafa",
  gafaargentina: "Gafa",
  electrolux_ar: "Electrolux",
  electroluxar: "Electrolux",
  whirlpoolargentina: "Whirlpool",
  whirlpoolarg: "Whirlpool",
};

interface SummaryData {
  marca: string;
  resumen: string;
  posts: number;
}

export function BrandSentimentSummary({
  marcas,
  from,
  to,
}: {
  marcas: string[];
  from: string;
  to: string;
}) {
  const [summaries, setSummaries] = useState<SummaryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSummaries([]);

    async function loadAll() {
      const results: SummaryData[] = [];
      for (const marca of marcas) {
        try {
          const res = await fetch(
            `/api/summarize-sentiment?marca=${encodeURIComponent(marca)}&from=${from}&to=${to}`,
          );
          const data = await res.json();
          if (data.ok && data.resumen) {
            results.push({ marca, resumen: data.resumen, posts: data.posts });
          }
        } catch {
          // skip failed
        }
      }
      if (!cancelled) {
        setSummaries(results);
        setLoading(false);
      }
    }

    loadAll();
    return () => { cancelled = true; };
  }, [marcas, from, to]);

  const [expandedMarca, setExpandedMarca] = useState<string | null>(null);

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Análisis cualitativo del sentimiento
      </h3>
      {loading ? (
        <div className="py-4 text-center text-xs text-muted-foreground animate-pulse">
          Generando análisis...
        </div>
      ) : summaries.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground">
          Sin análisis disponible. Ejecutá el backfill primero.
        </div>
      ) : (
        <div className="space-y-2">
          {summaries.map((s) => (
            <div
              key={s.marca}
              className="rounded bg-muted/40 px-3 py-2 cursor-pointer"
              onClick={() => setExpandedMarca(expandedMarca === s.marca ? null : s.marca)}
              title="Click para expandir/colapsar"
            >
              <div className="flex items-baseline gap-2">
                <span
                  className="text-xs font-semibold"
                  style={{ color: BRAND_COLORS[s.marca] ?? "#64748b" }}
                >
                  {BRAND_LABELS[s.marca] ?? s.marca}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  ({s.posts} posts)
                </span>
              </div>
              <p className={`mt-1 text-[11px] leading-snug text-foreground/80 ${expandedMarca === s.marca ? "" : "line-clamp-2"}`}>
                {s.resumen}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
