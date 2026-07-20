// Badge de última actualización de datos. Server-safe (sin estado).
export function LastUpdated({
  date,
  prefix = "Datos actualizados al",
  className = "",
}: {
  date: string | null;
  prefix?: string;
  className?: string;
}) {
  if (!date) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-[11px] text-muted-foreground ${className}`}>
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
        Sin fecha de actualización
      </div>
    );
  }
  const d = new Date(date);
  const fmt = d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className={`inline-flex items-center gap-1.5 text-[11px] text-muted-foreground ${className}`}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {prefix} <span className="font-medium text-foreground/80">{fmt}</span>
    </div>
  );
}
