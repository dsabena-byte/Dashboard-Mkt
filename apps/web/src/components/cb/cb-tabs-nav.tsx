"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "sugerencias", label: "Sugerencias de tiendas" },
] as const;

export function CbTabsNav() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const active = sp.get("tab") ?? "overview";

  function urlFor(tabId: string): string {
    const params = new URLSearchParams(sp.toString());
    if (tabId === "overview") params.delete("tab");
    else params.set("tab", tabId);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <nav className="flex gap-1 border-b">
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <Link
            key={t.id}
            href={urlFor(t.id) as never}
            className={`relative px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {isActive && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
