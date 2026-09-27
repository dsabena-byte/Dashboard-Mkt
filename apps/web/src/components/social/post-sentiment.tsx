"use client";

import { useState } from "react";
import { resumenSegmentos, sentimentPcts, type PostSentiment } from "@/lib/post-sentiment";

// Sentimiento de los comentarios de UN post, debajo de la tarjeta: barra fina apilada
// (positivo / neutro / negativo — verde/gris/rojo como semáforo) + resumen del análisis en 2 líneas;
// click para expandir (resumen completo + base de comentarios). Va dentro de un <a> → el click
// no navega. Sin análisis → no muestra nada (o un aviso sutil si el post tiene comentarios).

const TONO: Record<"pos" | "neu" | "neg", { label: string; cls: string }> = {
  pos: { label: "Pos", cls: "text-emerald-700" },
  neu: { label: "Neu", cls: "text-slate-500" },
  neg: { label: "Neg", cls: "text-rose-700" },
};

export function PostSentimentBlock({ sentiment, comentarios }: { sentiment: PostSentiment | null | undefined; comentarios?: number | null }) {
  const [open, setOpen] = useState(false);
  const pcts = sentiment ? sentimentPcts(sentiment) : null;
  const resumen = sentiment?.resumen ?? null;
  const nCom = sentiment?.comentarios ?? comentarios ?? null;

  if (!pcts && !resumen) {
    if ((nCom ?? 0) > 0 && sentiment) {
      return <p className="mt-auto pt-1.5 text-[9px] italic text-muted-foreground/70">Sin análisis de comentarios</p>;
    }
    return null;
  }

  const toggle = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((v) => !v);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={toggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggle(e); }}
      className="mt-auto cursor-pointer border-t border-dashed pt-1.5"
      title={open ? "Ocultar detalle" : "Ver análisis de comentarios"}
    >
      {pcts && (
        <>
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="bg-emerald-500" style={{ width: `${pcts.pos}%` }} />
            <div className="bg-slate-300" style={{ width: `${pcts.neu}%` }} />
            <div className="bg-rose-500" style={{ width: `${pcts.neg}%` }} />
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-1.5 text-[9px] tabular-nums">
            <span className={TONO.pos.cls}>Pos {Math.round(pcts.pos)}%</span>
            <span className="text-muted-foreground/60">·</span>
            <span className={TONO.neu.cls}>Neu {Math.round(pcts.neu)}%</span>
            <span className="text-muted-foreground/60">·</span>
            <span className={TONO.neg.cls}>Neg {Math.round(pcts.neg)}%</span>
          </div>
        </>
      )}
      {resumen && (
        <div className={`mt-0.5 text-[9px] leading-snug text-muted-foreground ${open ? "" : "line-clamp-2"}`}>
          {resumenSegmentos(resumen).map((s, i) => (
            <span key={i} className={open ? "block" : undefined}>
              {s.tono && <strong className={`font-semibold ${TONO[s.tono].cls}`}>{TONO[s.tono].label}: </strong>}
              {s.texto}{!open && " "}
            </span>
          ))}
        </div>
      )}
      {open && (
        <p className="mt-0.5 text-[8px] text-muted-foreground/70">
          {(nCom ?? 0) > 0 ? `Sobre ${nCom} comentario${nCom === 1 ? "" : "s"}` : "Análisis de comentarios"}
          {!pcts && " · sin % por tono"}
        </p>
      )}
    </div>
  );
}
