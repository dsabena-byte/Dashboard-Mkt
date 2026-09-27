"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MOTIVO_LABEL, type FeedbackRow, type ResumenFeedback, type Verificada } from "@/lib/chat/verified";
import { toolLabel } from "@/lib/chat/contexto";

// Calidad del copiloto (portado de la vista de staff de BIP): resumen de 👍/👎, peores respuestas (con
// "Corregir y verificar" / "Revisado"), útiles y respuestas verificadas activas. Acciones → /api/copiloto.
// Sistema sobrio: dato azul #1e40af; rojo/verde solo como estado (👎 sin revisar / 👍).

type Ver = Verificada & { verified_by: string | null; created_at: string };
const REAL = "#1e40af";
const fecha = (s: string) => new Date(s).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
const motivoTxt = (m: string | null) => (m && m in MOTIVO_LABEL ? MOTIVO_LABEL[m as keyof typeof MOTIVO_LABEL] : m === "sin_motivo" || !m ? "Sin motivo" : m);

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    const r = await fetch("/api/copiloto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok && j.ok !== false, error: j.error };
  } catch { return { ok: false, error: "Error de red" }; }
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: "#0f172a" }}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Item({ r, positiva }: { r: FeedbackRow; positiva?: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [respuesta, setRespuesta] = useState(r.respuesta);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function verificar() {
    setBusy(true);
    const x = await post({ action: "verificar", id: r.id, pregunta: r.pregunta, respuesta, tools: r.tools, pathname: r.pathname });
    setBusy(false); setMsg(x.ok ? "Verificada: el copiloto la usa como ejemplo." : x.error ?? "No se pudo guardar.");
    if (x.ok) { setAbierto(false); router.refresh(); }
  }
  async function revisado() {
    setBusy(true);
    const x = await post({ action: "revisado", id: r.id });
    setBusy(false); setMsg(x.ok ? "Marcada como revisada." : "No se pudo marcar.");
    if (x.ok) router.refresh();
  }
  const borde = positiva ? "#16a34a" : r.revisado ? "#cbd5e1" : "#dc2626";
  return (
    <div className="mb-2.5 rounded-lg border bg-white p-3.5" style={{ borderLeft: `3px solid ${borde}` }}>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>{fecha(r.created_at)} · {r.pathname ?? "—"}{r.user_email ? ` · ${r.user_email}` : ""}</span>
        <span>{positiva ? "👍" : `👎 ${motivoTxt(r.motivo)}`}{r.revisado ? " · revisada" : ""}</span>
      </div>
      <div className="mt-1.5 text-[13.5px]"><span className="font-semibold">Pregunta:</span> {r.pregunta}</div>
      {r.comentario && <div className="mt-1 text-[13px] text-amber-700"><span className="font-semibold">Qué estaba mal:</span> {r.comentario}</div>}
      <details className="mt-1.5">
        <summary className="cursor-pointer text-[12.5px] font-semibold" style={{ color: REAL }}>Ver respuesta y datos consultados</summary>
        <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border bg-slate-50 p-2.5 font-sans text-[12.5px]">{r.respuesta}</pre>
        <div className="text-[11.5px] text-muted-foreground">Datos consultados: {r.tools.length ? r.tools.map(toolLabel).join(" · ") : "ninguno"}</div>
      </details>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="rounded-md border px-3 py-1 text-[12.5px] font-medium hover:bg-slate-50" onClick={() => setAbierto((v) => !v)}>{positiva ? "Verificar" : "Corregir y verificar"}</button>
        {!positiva && !r.revisado && <button type="button" className="rounded-md border px-3 py-1 text-[12.5px] font-medium hover:bg-slate-50 disabled:opacity-50" disabled={busy} onClick={revisado}>Revisado</button>}
        {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
      </div>
      {abierto && (
        <div className="mt-2.5 flex flex-col gap-2">
          <label className="text-xs font-semibold">Respuesta aprobada (se usa como ejemplo de MÉTODO; los números los vuelve a consultar el copiloto)</label>
          <textarea value={respuesta} onChange={(e) => setRespuesta(e.target.value)} rows={8} className="rounded-md border p-2 text-[12.5px]" />
          <div><button type="button" className="rounded-md px-3.5 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50" style={{ background: REAL }} disabled={busy || !respuesta.trim()} onClick={verificar}>Guardar como verificada</button></div>
        </div>
      )}
    </div>
  );
}

function VerItem({ v }: { v: Ver }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="border-t py-2.5 text-[13px] first:border-t-0">
      <div className="flex justify-between gap-2">
        <span className="font-semibold">{v.pregunta}</span>
        <button type="button" className="rounded-md border px-2.5 py-0.5 text-xs hover:bg-slate-50 disabled:opacity-50" disabled={busy} onClick={async () => { setBusy(true); const x = await post({ action: "desactivar", id: v.id }); setBusy(false); if (x.ok) router.refresh(); }}>Quitar</button>
      </div>
      <div className="text-[11.5px] text-muted-foreground">{fecha(v.created_at)} · {v.verified_by ?? "—"} · {v.tools.map(toolLabel).join(" · ") || "sin datos"}</div>
    </div>
  );
}

export function CopilotoCalidad({ resumen, peores, positivas, verificadas, dias }: { resumen: ResumenFeedback; peores: FeedbackRow[]; positivas: FeedbackRow[]; verificadas: Ver[]; dias: number }) {
  const [tab, setTab] = useState<"peores" | "positivas" | "verificadas">("peores");
  const T = (k: typeof tab, label: string) => (
    <button type="button" onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3.5 py-2 text-[13.5px] font-semibold ${tab === k ? "border-amber-500 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{label}</button>
  );
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={`Calificaciones (${dias} días)`} value={resumen.total.toLocaleString("es-AR")} />
        <Kpi label="Útiles" value={resumen.pctPositivo == null ? "—" : `${resumen.pctPositivo.toLocaleString("es-AR")}%`} hint={`${resumen.positivos} 👍 · ${resumen.negativos} 👎`} />
        <Kpi label="Motivo más frecuente" value={resumen.porMotivo[0] ? motivoTxt(resumen.porMotivo[0].motivo) : "—"} hint={resumen.porMotivo[0] ? `${resumen.porMotivo[0].n} respuestas` : undefined} />
        <Kpi label="Verificadas activas" value={String(verificadas.length)} />
      </div>
      {resumen.porTool.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-sm font-semibold">Fuentes con más respuestas malas</div>
          <p className="mb-2 text-xs text-muted-foreground">Mínimo 3 calificaciones. Una fuente arriba = revisar su tool (descripción, datos que devuelve) o sumar una respuesta verificada.</p>
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-left text-muted-foreground"><th className="font-medium">Fuente</th><th className="text-right font-medium">Calificaciones</th><th className="text-right font-medium">👎</th><th className="text-right font-medium">% 👎</th></tr></thead>
            <tbody>{resumen.porTool.slice(0, 10).map((t) => <tr key={t.tool} className="border-t"><td className="py-1">{toolLabel(t.tool)}</td><td className="text-right tabular-nums">{t.n}</td><td className="text-right tabular-nums">{t.negativos}</td><td className="text-right tabular-nums">{t.pctNegativo.toLocaleString("es-AR")}%</td></tr>)}</tbody>
          </table>
        </div>
      )}
      <div className="flex gap-1 border-b">
        {T("peores", `Peores respuestas (${peores.length})`)}{T("positivas", `Útiles (${positivas.length})`)}{T("verificadas", `Verificadas (${verificadas.length})`)}
      </div>
      {tab === "peores" && (peores.length ? peores.map((r) => <Item key={r.id} r={r} />) : <p className="text-sm text-muted-foreground">Sin 👎 en los últimos {dias} días.</p>)}
      {tab === "positivas" && (positivas.length ? positivas.map((r) => <Item key={r.id} r={r} positiva />) : <p className="text-sm text-muted-foreground">Sin 👍 todavía.</p>)}
      {tab === "verificadas" && <div className="rounded-xl border bg-card p-4 shadow-sm">{verificadas.length ? verificadas.map((v) => <VerItem key={v.id} v={v} />) : <p className="text-sm text-muted-foreground">Todavía no hay respuestas verificadas.</p>}</div>}
    </div>
  );
}
