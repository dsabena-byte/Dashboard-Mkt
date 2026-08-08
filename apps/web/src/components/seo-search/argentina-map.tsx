"use client";

import { useState } from "react";
import { AR_PROVINCES, AR_VIEWBOX } from "@/lib/argentina-provinces";

// Clave canónica para matchear nombres (geojson vs data): minúsculas, sin tildes.
const canon = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

// Escala de color por interés 0-100 (azul: más claro = menos, más oscuro = más).
function colorFor(v: number | undefined): string {
  if (v == null) return "#e2e8f0"; // sin data
  const l = 92 - Math.min(100, v) * 0.5; // 92% → 42%
  return `hsl(221 83% ${l}%)`;
}

export function ArgentinaMap({ values }: { values: Record<string, number> }) {
  const [hover, setHover] = useState<{ name: string; v: number | undefined; x: number; y: number } | null>(null);
  const byKey: Record<string, number> = {};
  for (const [k, v] of Object.entries(values)) byKey[canon(k)] = v;

  return (
    <div className="relative">
      <svg viewBox={AR_VIEWBOX} className="mx-auto block h-[460px] w-auto" role="img" aria-label="Mapa de Argentina por provincia">
        {AR_PROVINCES.map((p) => {
          const v = byKey[canon(p.name)];
          return (
            <path
              key={p.name}
              d={p.path}
              fill={colorFor(v)}
              stroke="#fff"
              strokeWidth={0.7}
              className="cursor-pointer transition-opacity hover:opacity-80"
              onMouseMove={(e) => setHover({ name: p.name, v, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>
      {hover && (
        <div
          className="pointer-events-none fixed z-50 rounded-md border bg-card px-2 py-1 text-xs shadow-lg"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <div className="font-semibold">{hover.name}</div>
          <div className="text-muted-foreground">{hover.v != null ? `Interés ${hover.v}/100` : "sin data"}</div>
        </div>
      )}
      {/* Leyenda */}
      <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
        <span>menos</span>
        <div className="h-2 w-32 rounded" style={{ background: "linear-gradient(90deg, hsl(221 83% 92%), hsl(221 83% 42%))" }} />
        <span>más búsquedas</span>
      </div>
    </div>
  );
}
