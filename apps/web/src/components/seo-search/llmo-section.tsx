"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LlmoRow } from "@/lib/competitive-queries";

// LLMO / GEO — visibilidad de marca en respuestas de LLM. Mide cuánto aparece
// cada marca cuando el consumidor le pregunta a una IA por la categoría.

const CATS = [
  { key: "lavarropas", label: "Lavarropas" },
  { key: "heladeras", label: "Heladeras" },
  { key: "cocinas", label: "Cocinas" },
];
const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 };

export function LlmoSection({ rows }: { rows: LlmoRow[] }) {
  const [cat, setCat] = useState("lavarropas");

  const { bars, mes, prompts } = useMemo(() => {
    const catRows = rows.filter((r) => r.categoria === cat);
    if (catRows.length === 0) return { bars: [] as Array<{ marca: string; share: number; menciones: number; rank: number | null }>, mes: null as string | null, prompts: 0 };
    const lastMes = catRows.reduce((m, r) => (r.mes > m ? r.mes : m), catRows[0]!.mes);
    const last = catRows.filter((r) => r.mes === lastMes);
    const bars = last
      .map((r) => ({ marca: r.marca, share: r.share_pct, menciones: r.menciones, rank: r.rank_prom }))
      .sort((a, b) => b.share - a.share);
    return { bars, mes: lastMes, prompts: last[0]?.prompts ?? 0 };
  }, [rows, cat]);

  if (rows.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="text-lg font-bold">Visibilidad en IA · LLMO</h2>
          <p className="mt-1 max-w-3xl text-[11px] text-muted-foreground">
            <strong>Qué mide:</strong> cuánto aparece cada marca cuando un consumidor le pregunta a una IA (ChatGPT / Gemini) por la categoría — el nuevo lugar donde se investiga antes de comprar. Es el <strong>Share of Search del canal de IA generativa</strong> (LLMO / GEO). <strong>Cómo se calcula:</strong> se corren varios prompts (&quot;¿qué {"{"}categoría{"}"} conviene en Argentina?&quot;) varias veces; se cuenta cuántas veces se nombra cada marca y su <strong>share de menciones</strong>. <em>Con búsqueda web en vivo (gpt-4o-search-preview): refleja lo que la IA responde hoy leyendo la web, no su memoria de entrenamiento.</em>
          </p>
        </div>
        <div className="ml-auto flex gap-1">
          {CATS.map((c) => (
            <button key={c.key} onClick={() => setCat(c.key)} className={`rounded-full border px-3 py-1 text-xs font-medium ${cat === c.key ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Share de menciones en IA — {CATS.find((c) => c.key === cat)?.label}</h3>
          {mes && <span className="text-[10px] text-muted-foreground">{mes.slice(0, 7)} · {prompts} respuestas evaluadas</span>}
        </div>
        {bars.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Sin datos para esta categoría todavía. Corré el sync de LLMO.</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, bars.length * 28)}>
            <BarChart data={bars} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
              <XAxis type="number" fontSize={11} stroke="hsl(var(--muted-foreground))" unit="%" />
              <YAxis type="category" dataKey="marca" width={90} fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number, _n, p) => [`${v.toFixed(1)}% · ${(p?.payload?.menciones ?? 0)} menciones${p?.payload?.rank ? ` · orden prom. ${p.payload.rank}` : ""}`, "Share IA"]}
              />
              <Bar dataKey="share" radius={[0, 4, 4, 0]}>
                {bars.map((d) => (
                  <Cell key={d.marca} fill={d.marca === "Drean" ? "#2b4dff" : "#94a3b8"} />
                ))}
                <LabelList dataKey="share" position="right" fontSize={10} formatter={(v: number) => `${v.toFixed(1)}%`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
