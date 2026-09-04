"use client";

// Badge que muestra el tiempo real vivido: clic en el menú → esta página montada
// (incluye cold start de Vercel, queries, render RSC, red e hidratación). Solo
// aparece si se entró desde el menú (markNav). Diagnóstico de lentitud percibida.

import { useEffect, useState } from "react";
import { readNavDelta } from "@/lib/nav-timing";

export function NavTimer({ path }: { path: string }) {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => { setMs(readNavDelta(path)); }, [path]);
  if (ms == null) return null;
  return (
    <span
      className="inline-flex items-center rounded-full border bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
      title="Tiempo real desde que tocaste el menú hasta que apareció la página (cold start + queries + red + render)"
    >
      ⏱ {(ms / 1000).toFixed(1)}s clic → pantalla
    </span>
  );
}
