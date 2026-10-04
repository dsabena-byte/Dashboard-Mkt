"use client";
// ============================================================================
// "Qué hacer ahora" — tarjeta de recomendación ÚNICA (portado de BIP, sep-2026; lib/recomendacion).
// La producen las señales determinísticas y el Diagnóstico IA con el mismo formato:
//   qué hacer · por qué (con números) · impacto estimado · prioridad = impacto × confianza ÷ esfuerzo.
// Sistema visual sobrio de Drean: card blanca, dato en azul #1e40af, tinta #0f172a; rojo/ámbar SOLO
// como estado (prioridad). Sin detalle plegado ("Cómo hacerlo" se sacó 4-oct-2026, pedido del user):
// los pasos los explica "Guiame paso a paso" (copiloto), que es más específico.
// ============================================================================
import { useState } from "react";
import { fmtImpacto, explicarPrioridad, CONFIANZA_AYUDA, ESFUERZO_AYUDA, type Recomendacion, type NivelPrioridad, type NivelConfianza } from "@/lib/recomendacion";
import { GuiameButton } from "@/components/copiloto/guiame-button";
import { ESTADO_BOTON, ESTADO_LABEL, ESTADOS_ACCION, type EstadoAccion } from "@/lib/recomendacion-seguimiento";

const DATA = "#1e40af";
const INK = "#0f172a";
const PRIO: Record<NivelPrioridad, { cls: string; label: string }> = {
  critica: { cls: "bg-red-50 text-red-700", label: "Crítica" },
  alta: { cls: "bg-amber-50 text-amber-700", label: "Alta" },
  media: { cls: "bg-blue-50 text-blue-800", label: "Media" },
  baja: { cls: "bg-slate-100 text-slate-500", label: "Baja" },
};
const TIPO: Record<Recomendacion["tipo"], { label: string; color: string }> = {
  alerta: { label: "Alerta", color: "#b91c1c" },
  oportunidad: { label: "Oportunidad", color: DATA },
  mejora: { label: "Mejora", color: "#64748b" },
};
const CONF_LABEL: Record<NivelConfianza, string> = { alta: "Confianza alta", media: "Confianza media", baja: "Confianza baja" };

/** Botones "La voy a hacer" · "Hecha" · "Descartar" (el activo queda marcado). */
export function EstadoBotones({ estado, onEstado, ocupado }: { estado: EstadoAccion | null | undefined; onEstado: (e: EstadoAccion) => void; ocupado?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Seguimiento de la acción">
      {ESTADOS_ACCION.map((e) => {
        const activo = estado === e;
        return (
          <button key={e} type="button" disabled={ocupado} onClick={() => onEstado(e)} aria-pressed={activo}
            className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition disabled:opacity-50 ${activo ? "border-transparent text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            style={activo ? { background: e === "descartada" ? "#64748b" : DATA } : undefined}>
            {activo && e !== "descartada" ? "✓ " : ""}{ESTADO_BOTON[e]}
          </button>
        );
      })}
    </div>
  );
}

export function RecomendacionCard({ rec, rank, estado, onEstado, ocupado }: { rec: Recomendacion; rank?: number; /** Estado en "Mis acciones" (null = sin marcar). */ estado?: EstadoAccion | null; onEstado?: (e: EstadoAccion) => void; ocupado?: boolean }) {
  const p = PRIO[rec.prioridad.nivel];
  const t = TIPO[rec.tipo];
  const imp = fmtImpacto(rec.impacto);
  const cuant = !!rec.impacto && rec.impacto.bajo != null;
  const guia = { tipo: rec.tipo === "alerta" ? "alerta" : rec.tipo === "oportunidad" ? "oportunidad" : "recomendación", titulo: rec.titulo, dash: rec.dash, dato: rec.porque, impacto: imp || null, queHacer: rec.pasos };
  return (
    <article className="flex flex-col gap-1.5 rounded-lg border bg-white px-3.5 py-3" style={{ borderLeft: `3px solid ${t.color}` }}>
      <div className="flex flex-wrap items-center gap-2">
        {rank != null && <span className="text-[11px] font-bold tabular-nums text-slate-400">{rank}</span>}
        <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: t.color }}>{t.label}</span>
        <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${p.cls}`} title={explicarPrioridad(rec)}>Prioridad {p.label.toLowerCase()}</span>
        {rec.cruce && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">cruce con mercado</span>}
        {estado && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">{ESTADO_LABEL[estado]}</span>}
        {imp && <span className="ml-auto max-w-full truncate text-[12.5px] font-bold tabular-nums" style={{ color: cuant ? DATA : "#64748b" }} title={rec.impacto?.texto}>{imp}</span>}
      </div>
      <div className="text-[13.5px] font-semibold leading-snug" style={{ color: INK }}>{rec.titulo}</div>
      {rec.porque && <div className="text-[12.5px] leading-relaxed text-slate-600"><span className="font-semibold" style={{ color: INK }}>Por qué:</span> {rec.porque}</div>}
      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-slate-500">
        <span title={`${CONFIANZA_AYUDA[rec.confianza.nivel]} ${rec.confianza.motivo}`} className="cursor-help underline decoration-dotted decoration-slate-300 underline-offset-2">{CONF_LABEL[rec.confianza.nivel]}</span>
        <span className="text-slate-300">·</span>
        <span title={ESFUERZO_AYUDA[rec.esfuerzo.nivel]} className="cursor-help underline decoration-dotted decoration-slate-300 underline-offset-2">Esfuerzo {rec.esfuerzo.label.toLowerCase()}</span>
        {rec.kpi && <><span className="text-slate-300">·</span><span>Mueve <b style={{ color: INK }}>{rec.kpi.nombre}</b></span></>}
        <span className="ml-auto flex flex-wrap items-center gap-2">
        <GuiameButton item={guia} />
        </span>
      </div>
      {onEstado && <EstadoBotones estado={estado} onEstado={onEstado} ocupado={ocupado} />}
    </article>
  );
}

/** Lista ordenada por prioridad (las primeras `initial`, con "ver todas"). */
export function RecomendacionesLista({ recs, initial = 5, cargando = false, estados, onEstado, ocupado }: { recs: Recomendacion[]; initial?: number; cargando?: boolean; /** id → estado en "Mis acciones". */ estados?: Map<string, EstadoAccion>; onEstado?: (rec: Recomendacion, e: EstadoAccion) => void; ocupado?: string | null }) {
  const [all, setAll] = useState(false);
  const shown = all ? recs : recs.slice(0, initial);
  if (!recs.length && !cargando) return <div className="py-2 text-xs text-slate-500">Sin acciones sugeridas con los datos actuales.</div>;
  return (
    <div className="grid gap-2">
      {shown.map((r, i) => <RecomendacionCard key={r.id} rec={r} rank={i + 1} estado={estados?.get(r.id) ?? null} onEstado={onEstado ? (e) => onEstado(r, e) : undefined} ocupado={ocupado === r.id} />)}
      {cargando && <div className="text-xs text-slate-400">Sumando las recomendaciones del Diagnóstico IA…</div>}
      {recs.length > initial && (
        <button type="button" onClick={() => setAll((x) => !x)} className="justify-self-start rounded-md border px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          {all ? "Mostrar menos" : `Ver las ${recs.length} recomendaciones`}
        </button>
      )}
    </div>
  );
}
