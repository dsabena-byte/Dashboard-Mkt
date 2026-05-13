import { cn } from "@/lib/utils";

interface SentimentBarProps {
  positivo: number | null;
  negativo: number | null;
  neutro: number | null;
  className?: string;
}

export function SentimentBar({ positivo, negativo, neutro, className }: SentimentBarProps) {
  if (positivo === null && negativo === null && neutro === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const total = (positivo ?? 0) + (negativo ?? 0) + (neutro ?? 0);
  if (total === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  const p = ((positivo ?? 0) / total) * 100;
  const n = ((negativo ?? 0) / total) * 100;
  const u = ((neutro ?? 0) / total) * 100;

  return (
    <div className={cn("flex w-full overflow-hidden rounded-md", className)} style={{ height: 10 }}>
      <div
        className="bg-emerald-500"
        style={{ width: `${p}%` }}
        title={`Positivo ${p.toFixed(0)}%`}
      />
      <div
        className="bg-slate-300"
        style={{ width: `${u}%` }}
        title={`Neutro ${u.toFixed(0)}%`}
      />
      <div
        className="bg-red-500"
        style={{ width: `${n}%` }}
        title={`Negativo ${n.toFixed(0)}%`}
      />
    </div>
  );
}
