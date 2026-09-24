// Bloque "Cómo funciona" (explicación de una herramienta: qué es, de dónde salen los datos, cómo usarla
// y límites). <details> nativo, sin "use client" → sirve en server y client components.
import type { ReactNode } from "react";

export interface ComoFuncionaItem { titulo: string; texto: ReactNode }

export function ComoFunciona({ titulo = "Cómo funciona", items, defaultOpen = false }: { titulo?: string; items: ComoFuncionaItem[]; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-lg border bg-card px-4 py-3 text-sm">
      <summary className="cursor-pointer select-none list-none font-semibold text-[#0f172a] [&::-webkit-details-marker]:hidden">
        <span className="mr-1.5 inline-block text-[#1e40af] transition group-open:rotate-90">›</span>
        {titulo}
      </summary>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {items.map((it) => (
          <div key={it.titulo}>
            <div className="text-[12px] font-semibold uppercase tracking-wide text-[#1e40af]">{it.titulo}</div>
            <div className="mt-0.5 leading-relaxed text-muted-foreground">{it.texto}</div>
          </div>
        ))}
      </div>
    </details>
  );
}
