"use client";
// ============================================================================
// "Mis acciones" — arriba del tab Diagnóstico e Inteligencia. Lista las tarjetas de "Qué hacer ahora"
// que alguien marcó ("La voy a hacer", "Hecha", "Descartada"), AUNQUE la señal o el Diagnóstico IA ya
// no las produzcan (se muestran con la foto guardada y la etiqueta "ya no aparece en los datos").
// Datos: /api/recomendaciones/seguimiento (tabla recomendacion_seguimiento, migración 0122).
// Sistema visual sobrio: dato #1e40af, tinta #0f172a; sin colores decorativos.
// ============================================================================
import { useState } from "react";
import { ESTADO_LABEL, type EstadoAccion, type MiAccion } from "@/lib/recomendacion-seguimiento";
import { fechaCorta } from "@/lib/insights/guard";
import { EstadoBotones } from "./recomendacion-card";
import { GuiameButton } from "@/components/copiloto/guiame-button";

const INK = "#0f172a";
const CHIP: Record<EstadoAccion, string> = {
  planificada: "bg-blue-50 text-blue-800",
  hecha: "bg-slate-800 text-white",
  descartada: "bg-slate-100 text-slate-500",
};

function Fila({ a, onEstado, ocupado }: { a: MiAccion; onEstado: (a: MiAccion, e: EstadoAccion) => void; ocupado: boolean }) {
  const [open, setOpen] = useState(false);
  const porque = a.actual?.porque ?? a.snapshot?.porque ?? "";
  const pasos = a.actual?.pasos ?? a.snapshot?.pasos ?? [];
  return (
    <div className={`rounded-lg border bg-white px-3 py-2.5 ${a.estado === "descartada" ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${CHIP[a.estado]}`}>{ESTADO_LABEL[a.estado]}</span>
        {!a.vigente && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700" title="La regla o el Diagnóstico IA ya no generan esta recomendación con los datos de hoy. Se muestra como estaba cuando la marcaste.">ya no aparece en los datos</span>}
        <span className="ml-auto text-[11px] text-slate-400">{a.autor ? `${a.autor} · ` : ""}{fechaCorta(a.updatedAt)}</span>
      </div>
      <div className={`mt-1 text-[13px] font-semibold leading-snug ${a.estado === "hecha" ? "line-through decoration-slate-300" : ""}`} style={{ color: INK }}>{a.titulo}</div>
      {porque && <div className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-slate-600">{porque}</div>}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <EstadoBotones estado={a.estado} onEstado={(e) => onEstado(a, e)} ocupado={ocupado} />
        {pasos.length > 0 && <button type="button" onClick={() => setOpen((x) => !x)} className="text-xs font-semibold" style={{ color: "#1e40af" }}>{open ? "Ocultar pasos" : `Pasos (${pasos.length}) ›`}</button>}
        {a.estado === "planificada" && <span className="ml-auto"><GuiameButton item={{ tipo: "recomendación", titulo: a.titulo, dash: a.dash, dato: porque, queHacer: pasos }} /></span>}
      </div>
      {open && pasos.length > 0 && <ol className="mt-1.5 list-decimal pl-5 text-[12.5px] leading-relaxed" style={{ color: INK }}>{pasos.map((p, i) => <li key={i}>{p}</li>)}</ol>}
    </div>
  );
}

export function MisAcciones({ items, disponible, aviso, error, onEstado, ocupado }: {
  items: MiAccion[] | null; disponible: boolean; aviso?: string | null; error?: string | null;
  onEstado: (a: MiAccion, e: EstadoAccion) => void; ocupado: string | null;
}) {
  const [verDescartadas, setVerDescartadas] = useState(false);
  const activas = (items ?? []).filter((a) => a.estado !== "descartada");
  const descartadas = (items ?? []).filter((a) => a.estado === "descartada");
  const pend = activas.filter((a) => a.estado === "planificada").length;
  return (
    <section className="rounded-lg border bg-white p-4">
      <div className="mb-2">
        <div className="text-sm font-semibold" style={{ color: INK }}>Mis acciones</div>
        <div className="mt-0.5 text-xs text-slate-500">
          Lo que el equipo marcó en «Qué hacer ahora»: <b>La voy a hacer</b>, <b>Hecha</b> o <b>Descartar</b>. Queda guardado aunque la recomendación ya no aparezca en los datos.
          {items && items.length > 0 ? ` ${pend} pendiente${pend === 1 ? "" : "s"} · ${activas.length - pend} hecha${activas.length - pend === 1 ? "" : "s"}.` : ""}
        </div>
      </div>
      {!disponible ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{aviso || "Para guardar tus acciones falta correr la migración 0122_recomendacion_seguimiento.sql en el SQL Editor de Supabase."} Mientras tanto, las recomendaciones se ven igual.</div>
      ) : items == null ? (
        <div className="py-2 text-xs text-slate-400">Cargando tus acciones…</div>
      ) : !items.length ? (
        <div className="py-1 text-xs text-slate-500">Todavía no marcaste ninguna. Tocá «La voy a hacer» en una recomendación de abajo para seguirla acá.</div>
      ) : (
        <div className="grid gap-2">
          {activas.map((a) => <Fila key={a.id} a={a} onEstado={onEstado} ocupado={ocupado === a.id} />)}
          {descartadas.length > 0 && (
            <button type="button" onClick={() => setVerDescartadas((x) => !x)} className="justify-self-start text-xs font-semibold text-slate-500 hover:underline">
              {verDescartadas ? "Ocultar descartadas" : `Ver ${descartadas.length} descartada${descartadas.length === 1 ? "" : "s"}`}
            </button>
          )}
          {verDescartadas && descartadas.map((a) => <Fila key={a.id} a={a} onEstado={onEstado} ocupado={ocupado === a.id} />)}
        </div>
      )}
      {error && <div className="mt-2 text-xs text-red-700">{error}</div>}
    </section>
  );
}
