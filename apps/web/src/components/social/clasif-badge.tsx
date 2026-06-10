// Badge de clasificación de contenido orgánico (categoría + pilar) para las
// tarjetas de posts de IG/FB. Permite validar visualmente la clasificación LLM.
// Colores alineados con la paleta de categorías de pauta.
const CAT_COLOR: Record<string, string> = {
  Brand: "#3b82f6",
  Lavado: "#a78bfa",
  Refrigeración: "#22c55e",
  Cocción: "#f97316",
  Promoción: "#facc15",
};

export function ClasifBadge({
  categoria,
  pilar,
}: {
  categoria: string | null;
  pilar: string | null;
}) {
  if (!categoria && !pilar) return null;
  return (
    <div className="mb-1 flex flex-wrap items-center gap-1">
      {categoria && (
        <span
          className="inline-block rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-white"
          style={{ backgroundColor: CAT_COLOR[categoria] ?? "#64748b" }}
        >
          {categoria}
        </span>
      )}
      {pilar && (
        <span className="inline-block rounded-full border bg-background px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-foreground/70">
          {pilar}
        </span>
      )}
    </div>
  );
}
