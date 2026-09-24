"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { AlertItem } from "@/lib/alerts-shared";

// "Qué te avisaríamos hoy": pide /api/alertas/preview al montar (el cómputo de todas las señales corre
// en la API, no en el render de la página).
const PRIO: Record<string, { bg: string; fg: string; t: string }> = {
  alta: { bg: "#fee2e2", fg: "#b91c1c", t: "Alta" },
  media: { bg: "#fef3c7", fg: "#92400e", t: "Media" },
  baja: { bg: "#f1f5f9", fg: "#475569", t: "Info" },
};
const FUENTE: Record<AlertItem["fuente"], string> = { senal: "Señal", objetivo: "KPI vs meta", competencia: "Competencia" };

export function AlertasPreview() {
  const [items, setItems] = useState<AlertItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/alertas/preview", { cache: "no-store" })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Error"); return d.items as AlertItem[]; })
      .then((x) => { if (alive) setItems(x); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : "Error"); });
    return () => { alive = false; };
  }, []);
  const relevantes = (items ?? []).filter((x) => x.prioridad !== "baja");

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Qué te avisaríamos hoy</h3>
        {items && <span className="text-[11px] text-muted-foreground">{relevantes.length} {relevantes.length === 1 ? "alerta" : "alertas"} de prioridad media o alta</span>}
      </div>
      {err ? <p className="mt-2 text-xs" style={{ color: "#dc2626" }}>No se pudieron calcular las alertas: {err}</p>
        : !items ? <p className="mt-2 text-xs text-muted-foreground">Revisando señales, KPIs contra meta y la pauta de la competencia…</p>
        : relevantes.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">Nada fuera de lo normal. Con metas cargadas en el Mapa Estratégico las alertas son más precisas.</p>
        : (
          <div className="mt-3 flex flex-col gap-2">
            {relevantes.slice(0, 12).map((x) => {
              const p = PRIO[x.prioridad]!;
              return (
                <Link key={x.key} href={{ pathname: x.href }} className="block rounded-lg border px-3 py-2.5 hover:bg-muted/50">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: p.bg, color: p.fg }}>{p.t}</span>
                    <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{FUENTE[x.fuente]}</span>
                    <span className="text-sm font-semibold">{x.titulo}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{x.descripcion.slice(0, 240)}</div>
                </Link>
              );
            })}
          </div>
        )}
    </div>
  );
}
