import { formatFechaCorta } from "@/lib/dates";
import type { DateRange } from "@/lib/dates";

export function DateRangeInfo({ range }: { range: DateRange }) {
  return (
    <span className="text-xs text-muted-foreground">
      {formatFechaCorta(range.from)} – {formatFechaCorta(range.to)}
    </span>
  );
}
