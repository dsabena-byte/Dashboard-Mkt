"use client";
// ============================================================================
// Sección "Diagnóstico e inteligencia" de un tablero (portado de BIP, sep-2026).
// Se muestra como tab "Diagnóstico e inteligencia" arriba del tablero (DashTabs, prop `embedded`); se monta
// recién al abrir el tab → no pide nada antes (cero costo en el render). Sin `embedded` = colapsable cerrado.
// Al abrir: (1) "Señales detectadas" = motor de reglas determinístico (/api/insights/signals);
// (2) Diagnóstico IA: muestra la última versión guardada (GET /api/insights) y genera una nueva
// con "Generar diagnóstico IA" (POST). La IA corre solo en la API, nunca en el render.
// Sistema visual sobrio de Drean: dato #1e40af, tinta #0f172a, pizarra #64748b; rojo/ámbar solo
// para estado (prioridad), nunca decorativo.
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, RefreshCw, Sparkles } from "lucide-react";
import type { Signal } from "@/lib/signals/types";
import type { Insights, InsItem, ReportMeta } from "@/lib/insights/types";
import { recomendacionesDeSenales, recomendacionesDeDiagnostico, unirRecomendaciones, fmtImpacto, type Recomendacion } from "@/lib/recomendacion";
import { aplicarCambio, estadoPorId, misAcciones, snapshotDe, type AccionSeguida, type EstadoAccion, type MiAccion } from "@/lib/recomendacion-seguimiento";
import { debeReusarDiagnostico, fechaCorta, haceTexto, GUARD_HORAS } from "@/lib/insights/guard";
import { RecomendacionesLista } from "./recomendacion-card";
import { MisAcciones } from "./mis-acciones";
import { AnotacionesPanel } from "@/components/anotaciones/anotaciones-panel";
import { LearnButton } from "@/components/knowledge/learn-button";
import { GuiameButton } from "@/components/copiloto/guiame-button";

const DATA = "#1e40af";
const INK = "#0f172a";
const SLATE = "#64748b";

/** Tope de espera de las señales en el navegador (el servidor corta cada fuente a los 12 s). */
const SIGNALS_TIMEOUT_MS = 30_000;

const TIPO_LBL: Record<Signal["tipo"], string> = { alerta: "Alerta", oportunidad: "Oportunidad", info: "Contexto" };
const TIPO_COLOR: Record<Signal["tipo"], string> = { alerta: "#b91c1c", oportunidad: DATA, info: SLATE };
const fImpacto = (i: NonNullable<Signal["impacto"]>) => `${i.valor > 0 ? "+" : ""}${i.valor.toLocaleString("es-AR", { maximumFractionDigits: i.unidad === "pts" || i.unidad === "pp" ? 1 : 0 })} ${i.unidad}`;
const fFecha = (s?: string | null) => (s ? new Date(s).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

function PrioChip({ p }: { p: "alta" | "media" | "baja" }) {
  const cls = p === "alta" ? "bg-red-50 text-red-700" : p === "media" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500";
  return <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{p}</span>;
}

function SignalList({ signals, initial = 6 }: { signals: Signal[]; initial?: number }) {
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const shown = all ? signals : signals.slice(0, initial);
  return (
    <div className="grid gap-2">
      {shown.map((s) => {
        const isOpen = open === s.key;
        return (
          <div key={s.key} className="rounded-lg border bg-white px-3 py-2.5" style={{ borderLeft: `3px solid ${TIPO_COLOR[s.tipo]}` }}>
            <button type="button" onClick={() => setOpen(isOpen ? null : s.key)} className="block w-full text-left">
              <div className="mb-0.5 flex flex-wrap items-center gap-2">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: TIPO_COLOR[s.tipo] }}>{TIPO_LBL[s.tipo]}</span>
                <PrioChip p={s.prioridad} />
                {s.cruce && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">cruce</span>}
                {s.impacto && <span className="ml-auto text-[11.5px] font-semibold tabular-nums" style={{ color: DATA }} title={s.impacto.metrica}>{fImpacto(s.impacto)}</span>}
              </div>
              <div className="text-[13px] font-semibold leading-snug" style={{ color: INK }}>{s.titulo}</div>
            </button>
            <div className="mt-0.5 text-[12.5px] leading-relaxed text-slate-600">{s.descripcion}</div>
            {s.impacto && isOpen && <div className="mt-1 text-xs text-slate-600"><span className="font-semibold" style={{ color: INK }}>Impacto estimado:</span> {s.impacto.metrica} — {fImpacto(s.impacto)}</div>}
            {s.acciones.length > 0 && <div className="mt-1.5"><GuiameButton item={{ tipo: s.tipo === "alerta" ? "alerta" : s.tipo === "oportunidad" ? "oportunidad" : "señal", titulo: s.titulo, dash: s.dash, dato: s.descripcion, impacto: s.impacto ? `${s.impacto.metrica}: ${fImpacto(s.impacto)}` : null, queHacer: s.acciones }} /></div>}
          </div>
        );
      })}
      {signals.length > initial && (
        <button type="button" onClick={() => setAll((x) => !x)} className="justify-self-start rounded-md border px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          {all ? "Mostrar menos" : `Ver las ${signals.length} señales`}
        </button>
      )}
    </div>
  );
}

function Section({ n, titulo, desc, learn, children }: { n?: string; titulo: string; desc?: string; learn?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-white p-4">
      <div className="mb-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: INK }}><span>{n && <span className="text-slate-400">{n} · </span>}{titulo}</span>{learn && <LearnButton k={learn} />}</div>
        {desc && <div className="mt-0.5 text-xs text-slate-500">{desc}</div>}
      </div>
      {children}
    </section>
  );
}

function ItemRows({ items }: { items: InsItem[] }) {
  return (
    <div className="grid gap-3">
      {items.map((it, i) => (
        <div key={i} className={i ? "border-t pt-3" : ""}>
          <div className="mb-0.5 text-[13px] font-semibold" style={{ color: INK }}>{it.titulo}</div>
          {it.evidencia && <div className="text-[12.5px] leading-relaxed text-slate-600">{it.evidencia}</div>}
          {it.lectura && <div className="mt-0.5 text-[12.5px] leading-relaxed" style={{ color: INK }}>{it.lectura}</div>}
        </div>
      ))}
    </div>
  );
}

// Análisis completo del Diagnóstico IA (plegado): evidencia, SIN acciones — las acciones del plan, oportunidades y
// hallazgos a corregir ya están en el «Plan de mejoras» (lib/recomendacion), una sola vez.
function AnalisisIA({ data }: { data: Insights }) {
  const pos = data.hallazgos.filter((h) => h.tipo === "positivo");
  const neg = data.hallazgos.filter((h) => h.tipo === "negativo");
  return (
    <div className="grid gap-3">
      {data.evolucion.length > 0 && <Section titulo="Evolución" desc="La trayectoria de cada indicador en el tiempo."><ItemRows items={data.evolucion} /></Section>}
      {data.metas.length > 0 && <Section titulo="Metas" desc="Real vs meta: la brecha es la unidad de gestión."><ItemRows items={data.metas} /></Section>}
      {data.correlaciones.length > 0 && (
        <Section titulo="Correlaciones" desc="Cómo un indicador explica a otro y a los objetivos.">
          <div className="grid gap-3">
            {data.correlaciones.map((c, i) => (
              <div key={i} className={i ? "border-t pt-3" : ""}>
                <div className="mb-0.5 text-[13px] font-semibold" style={{ color: INK }}>{c.indicadores}</div>
                <div className="text-[12.5px] leading-relaxed text-slate-600">{c.hallazgo}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
      {(pos.length > 0 || neg.length > 0) && (
        <Section titulo="Qué funcionó y qué no" desc="Para replicar lo que rinde y no repetir lo que no.">
          <div className="grid gap-4 md:grid-cols-2">
            {[{ items: pos, label: "Funcionó", cls: "text-emerald-700", dot: "bg-emerald-600" }, { items: neg, label: "A corregir", cls: "text-amber-700", dot: "bg-amber-600" }].map((col) => col.items.length > 0 && (
              <div key={col.label}>
                <div className="mb-2 flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${col.dot}`} /><span className={`text-[11px] font-semibold uppercase tracking-wide ${col.cls}`}>{col.label}</span></div>
                <div className="grid gap-2.5">
                  {col.items.map((h, i) => (
                    <div key={i}>
                      <div className="text-[13px] font-semibold" style={{ color: INK }}>{h.titulo}</div>
                      {h.evidencia && <div className="text-[12.5px] leading-relaxed text-slate-600">{h.evidencia}</div>}
                      {h.porque && <div className="text-[12.5px] leading-relaxed text-slate-600"><span className="font-semibold" style={{ color: INK }}>Causa:</span> {h.porque}</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

export function DashDiagnostico({ dash, titulo = "Diagnóstico e inteligencia", embedded = false }: { dash: string; titulo?: string; /** Dentro del tab "Diagnóstico e inteligencia" (DashTabs): abierto y sin colapsar. */ embedded?: boolean }) {
  const [open, setOpen] = useState(embedded);
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [sigErr, setSigErr] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const sigAbort = useRef<AbortController | null>(null);
  const [data, setData] = useState<Insights | null>(null);
  const [meta, setMeta] = useState<{ id: number | null; createdAt: string | null; model?: string | null } | null>(null);
  const [versiones, setVersiones] = useState<ReportMeta[]>([]);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Guarda del Diagnóstico IA: confirmación en la página si ya hay uno de hace menos de GUARD_HORAS.
  const [confirmGen, setConfirmGen] = useState<{ edadMs: number | null } | null>(null);
  // "Mis acciones" (migración 0122): null = cargando.
  const [seg, setSeg] = useState<{ disponible: boolean; aviso: string | null; items: AccionSeguida[] | null }>({ disponible: true, aviso: null, items: null });
  const [segErr, setSegErr] = useState<string | null>(null);
  const [segOcupado, setSegOcupado] = useState<string | null>(null);

  const q = encodeURIComponent(dash);
  const loadList = useCallback(async () => {
    try { const r = await fetch(`/api/insights?dash=${q}&list=1`); const j = await r.json(); if (r.ok && Array.isArray(j.versiones)) setVersiones(j.versiones); } catch { /* sin historial */ }
  }, [q]);
  const loadSaved = useCallback(async (version?: number) => {
    setLoadingDiag(true); setErr(null);
    try {
      const r = await fetch(`/api/insights?dash=${q}${version ? `&version=${version}` : ""}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "No se pudo cargar el diagnóstico.");
      if (j.saved) { setData(j.insights as Insights); setMeta({ id: j.id, createdAt: j.createdAt, model: j.model }); }
    } catch (e) { setErr((e as Error).message); }
    finally { setLoadingDiag(false); }
  }, [q]);

  // Señales con tope de espera: si el servidor no responde en SIGNALS_TIMEOUT_MS se corta el pedido y se
  // muestra un aviso con "Reintentar" (nunca queda el spinner girando). El servidor ya omite por su cuenta
  // las fuentes lentas (`skipped`) y guarda 15 min el resultado, así que el reintento suele ser inmediato.
  const loadSignals = useCallback((fresh = false) => {
    sigAbort.current?.abort();
    const ac = new AbortController();
    sigAbort.current = ac;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ac.abort(); }, SIGNALS_TIMEOUT_MS);
    setSignals(null); setSigErr(null); setSkipped([]);
    fetch(`/api/insights/signals?dash=${q}${fresh ? "&fresh=1" : ""}`, { signal: ac.signal })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok || !j) throw new Error("http");
        setSignals(Array.isArray(j.signals) ? j.signals : []);
        setSkipped(Array.isArray(j.skipped) ? j.skipped : []);
        if (j.error) setSigErr(String(j.error));
      })
      .catch(() => {
        if (sigAbort.current !== ac) return; // un reintento posterior ya tomó el control
        setSignals([]);
        setSigErr(timedOut
          ? "Las señales están tardando más de lo normal (los datos de origen responden lento). Probá de nuevo en un momento."
          : "No se pudieron calcular las señales.");
      })
      .finally(() => clearTimeout(timer));
  }, [q]);
  useEffect(() => () => sigAbort.current?.abort(), []);

  const loadSeguimiento = useCallback(async () => {
    try {
      const r = await fetch(`/api/recomendaciones/seguimiento?dash=${q}`);
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) { setSeg({ disponible: true, aviso: null, items: [] }); setSegErr(j?.error ? String(j.error) : null); return; }
      setSeg({ disponible: j.disponible !== false, aviso: j.aviso ?? null, items: Array.isArray(j.items) ? j.items : [] });
    } catch { setSeg({ disponible: true, aviso: null, items: [] }); }
  }, [q]);

  // Carga perezosa: recién al abrir la sección.
  useEffect(() => {
    if (!open || loaded) return;
    setLoaded(true);
    loadSignals();
    loadSaved();
    loadList();
    loadSeguimiento();
  }, [open, loaded, loadSignals, loadSaved, loadList, loadSeguimiento]);

  const generate = async (force: boolean) => {
    setConfirmGen(null);
    setGenerating(true); setErr(null); setWarn(null);
    try {
      const r = await fetch("/api/insights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dash, force }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "No se pudo generar el diagnóstico.");
      setData(j.insights as Insights); setMeta({ id: j.id ?? null, createdAt: j.createdAt ?? null, model: j.model });
      // El servidor devolvió el guardado (hay uno reciente): se pregunta antes de gastar otra corrida.
      if (j.reused) setConfirmGen({ edadMs: typeof j.edadMs === "number" ? j.edadMs : null });
      if (j.warning) setWarn(j.warning);
      loadList();
    } catch (e) { setErr((e as Error).message); }
    finally { setGenerating(false); }
  };
  // Botón: si la última versión tiene menos de GUARD_HORAS, primero pregunta en la página.
  const onGenerar = () => {
    const ultimo = versiones[0]?.createdAt ?? meta?.createdAt ?? null;
    const g = debeReusarDiagnostico(ultimo, new Date(), false);
    if (g.reusar && data) { setConfirmGen({ edadMs: g.edadMs }); return; }
    void generate(false);
  };

  // Marcar una tarjeta: UI optimista + POST; sin la tabla (0122) se revierte y se muestra el aviso.
  const marcar = async (base: { id: string; titulo: string; snapshot: AccionSeguida["snapshot"] }, estado: EstadoAccion) => {
    const prev = seg.items ?? [];
    const cambio: AccionSeguida = { id: base.id, dash, estado, titulo: base.titulo, snapshot: base.snapshot, autor: null, updatedAt: new Date().toISOString() };
    setSegErr(null); setSegOcupado(base.id);
    setSeg((s) => ({ ...s, items: aplicarCambio(s.items ?? [], { ...cambio, autor: (s.items ?? []).find((a) => a.id === base.id)?.autor ?? null }) }));
    try {
      const r = await fetch("/api/recomendaciones/seguimiento", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: base.id, dash, estado, titulo: base.titulo, snapshot: base.snapshot }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setSeg((s) => ({ ...s, items: prev, ...(r.status === 503 ? { disponible: false, aviso: j?.error ?? null } : {}) }));
        if (r.status !== 503) setSegErr(j?.error || "No se pudo guardar la acción.");
        return;
      }
      if (j?.item) setSeg((s) => ({ ...s, items: aplicarCambio(s.items ?? [], j.item as AccionSeguida) }));
    } catch {
      setSeg((s) => ({ ...s, items: prev }));
      setSegErr("No se pudo guardar la acción (sin conexión).");
    } finally { setSegOcupado(null); }
  };
  const marcarRec = (rec: Recomendacion, estado: EstadoAccion) =>
    marcar({ id: rec.id, titulo: rec.titulo, snapshot: snapshotDe({ ...rec, impactoTexto: fmtImpacto(rec.impacto) || null }) }, estado);
  const marcarMia = (a: MiAccion, estado: EstadoAccion) =>
    marcar({ id: a.id, titulo: a.titulo, snapshot: a.actual ? snapshotDe({ ...a.actual, impactoTexto: fmtImpacto(a.actual.impacto) || null }) : a.snapshot }, estado);

  // Señales de contexto (sin acción): van al análisis plegado; las alertas/oportunidades ya están en el plan.
  const contexto = useMemo(() => (signals ?? []).filter((s) => s.tipo === "info"), [signals]);
  // "Qué hacer ahora": señales accionables + plan/oportunidades/hallazgos del Diagnóstico IA, con un
  // único formato y ordenadas por prioridad = impacto × confianza ÷ esfuerzo (lib/recomendacion).
  const recs = useMemo(() => {
    try { return unirRecomendaciones(recomendacionesDeSenales(signals ?? []), recomendacionesDeDiagnostico(data, dash)); }
    catch { return []; }
  }, [signals, data, dash]);
  const latestId = versiones[0]?.id ?? null;
  const estados = useMemo(() => estadoPorId(seg.items ?? []), [seg.items]);
  const mias = useMemo(() => (seg.items ? misAcciones(seg.items, recs) : null), [seg.items, recs]);
  // En "Qué hacer ahora" no se repiten las descartadas (siguen en "Mis acciones" para reactivarlas).
  const recsVisibles = useMemo(() => recs.filter((r) => estados.get(r.id) !== "descartada"), [recs, estados]);

  return (
    <div className="rounded-lg border bg-card p-4">
      <button type="button" onClick={() => !embedded && setOpen((o) => !o)} className={`flex w-full items-start gap-2 text-left ${embedded ? "cursor-default" : ""}`}>
        {!embedded && <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition ${open ? "" : "-rotate-90"}`} />}
        <div className="flex-1">
          <h3 className="text-sm font-semibold tracking-tight">{titulo}</h3>
          <p className="text-[11px] text-muted-foreground">Diagnóstico, un único plan de mejoras y el seguimiento de lo que el equipo decidió hacer.</p>
        </div>
      </button>

      {open && (
        <div className="mt-4 grid gap-4">
          {/* UN solo recorrido (5-oct-2026, pedido del user: "me pierdo"): Diagnóstico → Plan de mejoras → Mis acciones →
              análisis completo plegado → anotaciones. Cada acción aparece UNA vez (señales + IA unificadas en el plan). */}
          <section className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: INK }}><Sparkles className="h-4 w-4" style={{ color: DATA }} />Diagnóstico</div>
              {meta?.createdAt && <span className="text-xs text-slate-500">IA · generado el {fechaCorta(meta.createdAt)}</span>}
              {versiones.length > 1 && (
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  <span className="sr-only sm:not-sr-only">Historial:</span>
                  <select value={meta?.id ?? ""} onChange={(e) => loadSaved(Number(e.target.value))} className="rounded-md border bg-white px-2 py-1 text-xs font-medium" style={{ color: INK }} aria-label="Versiones anteriores del diagnóstico">
                    {versiones.map((v) => <option key={v.id} value={v.id}>{fFecha(v.createdAt)}{v.id === latestId ? " (la más nueva)" : ""}</option>)}
                  </select>
                </label>
              )}
              {meta?.id != null && latestId != null && meta.id !== latestId && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700">versión anterior</span>}
              <button type="button" onClick={onGenerar} disabled={generating} className="ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" style={{ background: DATA }}>
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : data ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                {generating ? "Analizando…" : data ? "Generar otro diagnóstico" : "Generar diagnóstico"}
              </button>
            </div>
            {confirmGen && (
              <div role="alertdialog" aria-label="Confirmar nuevo diagnóstico" className="flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs" style={{ color: INK }}>
                <span>Ya tenés un diagnóstico de hace {haceTexto(confirmGen.edadMs)} (se guardan y se reusan durante {GUARD_HORAS} horas). ¿Generar otro?</span>
                <span className="ml-auto flex gap-2">
                  <button type="button" onClick={() => void generate(true)} className="rounded-md px-2.5 py-1 font-semibold text-white" style={{ background: DATA }}>Sí, generar otro</button>
                  <button type="button" onClick={() => setConfirmGen(null)} className="rounded-md border bg-white px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-50">No, quedarme con este</button>
                </span>
              </div>
            )}
            {warn && <div className="text-[11px] text-amber-700">{warn}</div>}
            {err && <div className="text-xs text-red-700">{err}</div>}
            {generating ? (
              <div className="flex items-center gap-2 rounded-lg border bg-white p-4 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Analizando la evolución de los KPIs, el cumplimiento de metas y las correlaciones… (puede tardar unos segundos)</div>
            ) : loadingDiag ? (
              <div className="flex items-center gap-2 py-3 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Cargando el último diagnóstico…</div>
            ) : data?.diagnostico ? (
              <p className="rounded-lg border bg-white p-4 text-[13.5px] leading-relaxed" style={{ color: INK, borderLeft: `3px solid ${DATA}` }}>{data.diagnostico}</p>
            ) : (
              <div className="rounded-lg border border-dashed bg-white p-4 text-xs text-slate-500">Todavía no hay un diagnóstico para este tablero. Generalo con el botón: lee los datos y las metas de este tablero y suma sus acciones al plan de abajo.</div>
            )}
          </section>

          <Section titulo="Plan de mejoras" learn="que_hacer" desc="Todo lo que conviene hacer en este tablero, en una sola lista y de lo más urgente a lo menos (según cuánto mueve el resultado, qué tan seguro es el dato y cuánto trabajo lleva). Junta las alertas automáticas y lo que propone el diagnóstico, sin repetir. Tocá «Guiame paso a paso» para que el copiloto te explique cómo hacerlo, y marcá «La voy a hacer», «Hecha» o «Descartar» para seguirlo en «Mis acciones».">
            {signals == null && !recs.length ? (
              <div className="flex items-center gap-2 py-4 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Armando el plan…</div>
            ) : (
              <>
                <RecomendacionesLista recs={recsVisibles} cargando={loadingDiag} estados={estados} onEstado={marcarRec} ocupado={segOcupado} />
                {signals == null && <div className="mt-2 flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />Sumando las alertas automáticas…</div>}
              </>
            )}
            {sigErr && (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span>{sigErr}</span>
                <button type="button" onClick={() => loadSignals(true)} className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-0.5 font-semibold text-amber-800 hover:bg-amber-100"><RefreshCw className="h-3 w-3" />Reintentar</button>
              </div>
            )}
            {skipped.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span>No respondieron a tiempo y se omitieron sus alertas: {skipped.join(", ")}.</span>
                <button type="button" onClick={() => loadSignals(true)} className="font-semibold" style={{ color: DATA }}>Reintentar</button>
              </div>
            )}
          </Section>

          <MisAcciones items={mias} disponible={seg.disponible} aviso={seg.aviso} error={segErr} onEstado={marcarMia} ocupado={segOcupado} />

          {(data || contexto.length > 0) && (
            <details className="group rounded-lg border bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden" style={{ color: INK }}>
                <ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground transition group-open:rotate-0" />
                Ver el análisis completo
                <span className="text-[11px] font-normal text-slate-500">evolución, metas, correlaciones, qué funcionó y contexto — sin acciones (están en el plan)</span>
              </summary>
              <div className="grid gap-3 border-t p-4">
                {data && <AnalisisIA data={data} />}
                {contexto.length > 0 && <Section titulo="Contexto" desc="Datos para leer el tablero; no piden una acción."><SignalList signals={contexto} /></Section>}
              </div>
            </details>
          )}

          <AnotacionesPanel tablero={dash} />
        </div>
      )}
    </div>
  );
}
