"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface DateRangePickerProps {
  initialFrom: string;
  initialTo: string;
}

const PRESETS: Array<{ label: string; days: number | null; mode?: "thisMonth" | "lastMonth" }> = [
  { label: "Últimos 7 días", days: 7 },
  { label: "Últimos 14 días", days: 14 },
  { label: "Últimos 30 días", days: 30 },
  { label: "Últimos 90 días", days: 90 },
  { label: "Mes actual", days: null, mode: "thisMonth" },
  { label: "Mes anterior", days: null, mode: "lastMonth" },
];

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rangeForPreset(preset: typeof PRESETS[number]): { from: string; to: string } {
  const now = new Date();
  if (preset.mode === "thisMonth") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { from: toISO(from), to: toISO(now) };
  }
  if (preset.mode === "lastMonth") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    return { from: toISO(from), to: toISO(to) };
  }
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - (preset.days! - 1));
  return { from: toISO(from), to: toISO(to) };
}

export function DateRangePicker({ initialFrom, initialTo }: DateRangePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  const apply = (newFrom: string, newTo: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", newFrom);
    params.set("to", newTo);
    startTransition(() => {
      const url = `${pathname}?${params.toString()}`;
      (router.replace as unknown as (href: string, opts?: { scroll?: boolean }) => void)(url, {
        scroll: false,
      });
      setOpen(false);
    });
  };

  const fmtDisplay = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`);
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC",
    }).format(d);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm hover:bg-secondary/40"
      >
        <span className="text-muted-foreground">📅</span>
        <span>{fmtDisplay(initialFrom)} – {fmtDisplay(initialTo)}</span>
        <svg
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        {pending && <span className="text-xs text-muted-foreground">…</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-md border border-input bg-card p-3 shadow-lg">
          <div className="space-y-1">
            {PRESETS.map((p) => {
              const r = rangeForPreset(p);
              const isActive = r.from === initialFrom && r.to === initialTo;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => apply(r.from, r.to)}
                  className={`block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary ${
                    isActive ? "bg-secondary font-medium" : ""
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 border-t pt-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Personalizado
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs"
              />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs"
              />
            </div>
            <button
              type="button"
              onClick={() => apply(from, to)}
              disabled={!from || !to || from > to}
              className="mt-2 w-full rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
