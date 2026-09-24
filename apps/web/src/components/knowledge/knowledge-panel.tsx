"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { KPI_KNOW, type KpiKnow } from "@/lib/knowledge";
import { MODULO_TITULO } from "@/lib/guia/titulos";
import { FUNNEL_LABEL } from "@/lib/guia/types";

// Panel lateral de la guía por KPI (Proceso Estratégico) — se monta UNA vez en el layout. Escucha el
// evento `bip:learn` (que dispara cada LearnButton) y muestra fórmula, referencia, las 4 capas
// (cómo leer · mejor práctica · oportunidad · marco) y las palancas con link al módulo.
// Importa solo el índice liviano de títulos (no todo el contenido de la guía).
const LAYERS: { field: "comoLeer" | "mejorPractica" | "oportunidad" | "marco"; label: string }[] = [
  { field: "comoLeer", label: "Cómo leer" },
  { field: "mejorPractica", label: "Mejor práctica" },
  { field: "oportunidad", label: "Oportunidad" },
  { field: "marco", label: "Marco" },
];

const K11 = "text-[11px] font-semibold uppercase tracking-wider text-slate-400";

export function KnowledgePanel() {
  const [know, setKnow] = useState<KpiKnow | null>(null);
  const open = Boolean(know);

  useEffect(() => {
    const onLearn = (e: Event) => {
      const key = (e as CustomEvent<{ key: string }>).detail?.key;
      if (key && KPI_KNOW[key]) setKnow(KPI_KNOW[key]!);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setKnow(null);
    };
    window.addEventListener("bip:learn", onLearn as EventListener);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("bip:learn", onLearn as EventListener);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const close = () => setKnow(null);
  const palancas = (know?.palancas ?? []).filter((p) => p.accion);

  return (
    <>
      <div
        onClick={close}
        className={`fixed inset-0 z-[70] bg-slate-900/30 transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        aria-hidden={!open}
        className={`fixed inset-y-0 right-0 z-[71] flex w-full max-w-[430px] flex-col border-l bg-card shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "pointer-events-none translate-x-full"}`}
      >
        <div className="flex items-start gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <div className={K11}>
              🎓 Métrica · Proceso Estratégico{know?.funnel && know.funnel !== "transversal" ? ` · ${FUNNEL_LABEL[know.funnel]}` : ""}
            </div>
            <h3 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">{know?.name ?? ""}</h3>
          </div>
          <button onClick={close} aria-label="Cerrar" className="ml-auto px-1 text-2xl leading-none text-slate-400 hover:text-slate-700">
            ×
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {know && (know.formula || know.benchmark) && (
            <div className="grid gap-2 rounded-xl border bg-slate-50 px-4 py-3">
              {know.formula && (
                <div>
                  <div className={`${K11} mb-0.5`}>Fórmula</div>
                  <div className="text-[13px] leading-snug text-slate-900">{know.formula}</div>
                </div>
              )}
              {know.benchmark && (
                <div>
                  <div className={`${K11} mb-0.5`}>Referencia orientativa</div>
                  <div className="text-[13px] leading-snug text-slate-600">{know.benchmark}</div>
                </div>
              )}
            </div>
          )}
          {know &&
            LAYERS.map((l) => (
              <div key={l.field} className="rounded-xl border border-l-[3px] border-l-[#1e40af] bg-card px-4 py-3">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{l.label}</div>
                <p
                  className="m-0 text-[13px] leading-relaxed text-slate-600 [&_b]:font-semibold [&_b]:text-slate-900"
                  dangerouslySetInnerHTML={{ __html: know[l.field] }}
                />
              </div>
            ))}
          {palancas.length > 0 && (
            <div className="rounded-xl border px-4 py-3">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Palancas</div>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {palancas.map((p, i) => (
                  <li key={i} className="text-[13px] leading-snug text-slate-900">
                    {p.accion}
                    {p.modulo && MODULO_TITULO[p.modulo] && (
                      <Link href={`/guia/${p.modulo}`} onClick={close} className="mt-0.5 block text-xs font-semibold text-[#1e40af] hover:underline">
                        {MODULO_TITULO[p.modulo]} →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
