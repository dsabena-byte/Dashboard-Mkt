import Link from "next/link";

interface Tab {
  key: string;
  label: string;
  badge?: number | string;
}

interface RedesTabsProps {
  current: string;
  tabs: Tab[];
  preserveParams: Record<string, string | string[] | undefined>;
}

// Tabs navegables vía searchParams (no requiere client component).
// Preserva el resto de los searchParams (date range, filtros, etc.) al cambiar de tab.
export function RedesTabs({ current, tabs, preserveParams }: RedesTabsProps) {
  function buildHref(tabKey: string): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(preserveParams)) {
      if (k === "tab") continue;
      if (v == null) continue;
      if (Array.isArray(v)) {
        for (const item of v) params.append(k, item);
      } else {
        params.set(k, v);
      }
    }
    if (tabKey !== "analitica") params.set("tab", tabKey);
    const qs = params.toString();
    return qs ? `?${qs}` : "?";
  }

  return (
    <div className="border-b">
      <nav className="flex gap-1 overflow-x-auto" aria-label="Tabs">
        {tabs.map((t) => {
          const active = current === t.key;
          return (
            <Link
              key={t.key}
              href={buildHref(t.key) as never}
              scroll={false}
              className={
                "relative whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
                (active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
              {t.badge != null && (
                <span className={
                  "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold " +
                  (active ? "bg-foreground text-background" : "bg-muted text-foreground")
                }>
                  {t.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
