"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { Route } from "next";
import type { Moneda } from "@/lib/moneda";
import { LearnButton } from "@/components/knowledge/learn-button";

// Selector "Pesos corrientes / Pesos constantes (de <mes>) / USD" para montos (portado de BIP,
// sep-2026). Persiste en la URL (?moneda=) → el server component convierte y el link se comparte
// tal cual. Default (sin param) = corrientes: lo que se ve hoy no cambia. Sin índices cargados
// (migración 0110 + cron sync-macro) las opciones quedan deshabilitadas con el motivo.
export function MonedaSelector({ actual, baseLabel, disponible, notas = [] }: {
  actual: Moneda;
  baseLabel?: string | null;
  disponible: { ipc: boolean; usd: boolean };
  notas?: (string | null | undefined)[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const sinIdx = "Todavía no hay índices cargados (migración 0110 + cron sync-macro)";
  const opts: { v: Moneda; label: string; title: string; ok: boolean }[] = [
    { v: "corrientes", label: "$ corrientes", title: "Montos tal como los informó cada fuente", ok: true },
    { v: "constantes", label: baseLabel ? `$ constantes (${baseLabel})` : "$ constantes", title: disponible.ipc ? "Montos ajustados por inflación (IPC INDEC) a pesos del último mes publicado" : sinIdx, ok: disponible.ipc },
    { v: "usd", label: "USD", title: disponible.usd ? "Montos en dólares al tipo de cambio oficial promedio de cada mes (BCRA)" : sinIdx, ok: disponible.usd },
  ];
  const go = (v: Moneda) => {
    const q = new URLSearchParams(sp.toString());
    if (v === "corrientes") q.delete("moneda"); else q.set("moneda", v);
    const s = q.toString();
    start(() => router.push((s ? `${pathname}?${s}` : pathname) as Route, { scroll: false }));
  };
  const avisos = notas.filter((n): n is string => !!n);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
      <LearnButton k="moneda_constante" />
      <div role="radiogroup" aria-label="Moneda de los montos" className={`inline-flex flex-wrap rounded-lg border p-0.5 text-xs font-medium ${pending ? "opacity-60" : ""}`}>
        {opts.map((o) => {
          const on = o.v === actual;
          return (
            <button key={o.v} type="button" role="radio" aria-checked={on} title={o.title} disabled={pending || (!o.ok && !on)}
              onClick={() => !on && go(o.v)}
              className={`rounded-md px-2.5 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {o.label}
            </button>
          );
        })}
      </div>
      </div>
      {avisos.map((a, i) => <p key={i} className="max-w-md text-right text-[10.5px] text-amber-700">{a}</p>)}
    </div>
  );
}
