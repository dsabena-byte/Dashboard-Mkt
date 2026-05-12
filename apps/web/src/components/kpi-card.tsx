import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  delta?: { value: number; label?: string } | null;
  hint?: string;
}

export function KpiCard({ title, value, delta, hint }: KpiCardProps) {
  const deltaPositive = delta && delta.value >= 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {delta && (
          <div
            className={cn(
              "mt-1 text-xs font-medium",
              deltaPositive ? "text-emerald-600" : "text-red-600",
            )}
          >
            {deltaPositive ? "▲" : "▼"} {Math.abs(delta.value).toFixed(1)}%
            {delta.label ? ` ${delta.label}` : ""}
          </div>
        )}
        {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
