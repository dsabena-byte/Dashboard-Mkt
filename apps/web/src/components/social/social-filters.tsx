"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

const NETS = [
  { value: "all", label: "Todas", emoji: "🌐" },
  { value: "INSTAGRAM", label: "Instagram", emoji: "📷" },
  { value: "FACEBOOK", label: "Facebook", emoji: "👥" },
  { value: "TIKTOK", label: "TikTok", emoji: "🎵" },
];

const PERIODS = [
  { value: "all", label: "Todo el período" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "1m", label: "Último mes" },
];

interface Props {
  currentBrand: string;
  currentNet: string;
  currentPeriodo: string;
  brands: Array<{ value: string; label: string }>;
}

export function SocialFilters({ currentBrand, currentNet, currentPeriodo, brands }: Props) {
  const BRANDS = [{ value: "all", label: "Todas" }, ...brands];
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams);
      if (value === "all" || !value) params.delete(key);
      else params.set(key, value);
      router.replace(`/redes?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Marca</span>
        <div className="flex gap-1.5">
          {BRANDS.map((b) => (
            <button
              key={b.value}
              onClick={() => setParam("marca", b.value)}
              className={cn(
                "rounded-md border px-2.5 py-1 transition-colors",
                currentBrand === b.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-input bg-transparent text-muted-foreground hover:border-muted-foreground hover:text-foreground",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Red</span>
        <div className="flex gap-1.5">
          {NETS.map((n) => (
            <button
              key={n.value}
              onClick={() => setParam("red", n.value)}
              className={cn(
                "rounded-md border px-2.5 py-1 transition-colors",
                currentNet === n.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-input bg-transparent text-muted-foreground hover:border-muted-foreground hover:text-foreground",
              )}
            >
              <span className="mr-1">{n.emoji}</span>
              {n.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Período</span>
        <select
          value={currentPeriodo}
          onChange={(e) => setParam("periodo", e.target.value)}
          className="rounded-md border border-input bg-transparent px-2.5 py-1 text-xs"
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
