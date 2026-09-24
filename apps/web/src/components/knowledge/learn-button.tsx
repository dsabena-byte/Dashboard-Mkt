"use client";
import { kpiKnowFor, KPI_KNOW } from "@/lib/knowledge";

// Disparador de la capa de conocimiento del Proceso Estratégico (portado de BIP). Dos variantes:
//  · "icon" (default): ícono chico y sutil (🎓) en la esquina de cada card.
//  · "chip": pastilla con el nombre del KPI (listas de métricas, p. ej. en /guia/[id]).
// Al tocarlo abre el panel lateral (KnowledgePanel, montado una vez en el layout) vía el
// evento `bip:learn`. Se resuelve por `k` (clave de KPI_KNOW) o por `title` (alias exacto).
// Si no hay contenido para ese KPI, no renderiza nada.
export function LearnButton({
  title,
  k,
  corner = false,
  variant = "icon",
}: {
  title?: string;
  k?: string;
  corner?: boolean;
  variant?: "icon" | "chip";
}) {
  const resolved = k && KPI_KNOW[k] ? { key: k } : kpiKnowFor(title ?? k);
  if (!resolved) return null;
  const open = () => window.dispatchEvent(new CustomEvent("bip:learn", { detail: { key: resolved.key } }));

  if (variant === "chip") {
    return (
      <button
        type="button"
        onClick={open}
        title="Ver la guía de esta métrica"
        className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium text-slate-700 transition-colors hover:border-[#1e40af] hover:text-[#1e40af]"
      >
        {KPI_KNOW[resolved.key]!.name}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      title="Aprendé a leer esta métrica (Proceso Estratégico)"
      aria-label="Aprendé a leer esta métrica"
      className={`${corner ? "absolute right-2 top-2 " : ""}inline-grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border bg-card p-0 text-[11px] leading-none text-slate-500 shadow-sm transition-colors hover:border-[#1e40af] hover:text-[#1e40af]`}
    >
      🎓
    </button>
  );
}
