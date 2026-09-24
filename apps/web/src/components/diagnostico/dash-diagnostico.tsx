"use client";
// ============================================================================
// Sección "Diagnóstico e inteligencia" de un tablero (portado de BIP, sep-2026).
// Colapsable y CERRADA por defecto: no pide nada hasta que se abre (cero costo en el render).
// Al abrir: (1) "Señales detectadas" = motor de reglas determinístico (/api/insights/signals);
// (2) Diagnóstico IA: muestra la última versión guardada (GET /api/insights) y genera una nueva
// con "Generar diagnóstico IA" (POST). La IA corre solo en la API, nunca en el render.
// Sistema visual sobrio de Drean: dato #1e40af, tinta #0f172a, pizarra #64748b; rojo/ámbar solo
// para estado (prioridad), nunca decorativo.
// ============================================================================
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2, RefreshCw, Sparkles } from "lucide-react";
import type { Signal } from "@/lib/signals/types";
import type { Insights, InsItem, ReportMeta } from "@/lib/insights/types";

const DATA = "#1e40af";
const INK = "#0f172a";
const SLATE = "#64748b";

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
            {s.acciones.length > 0 && (isOpen
              ? <ul className="mt-1.5 list-disc pl-4 text-[12.5px] leading-relaxed" style={{ color: INK }}>{s.acciones.map((a, i) => <li key={i}>{a}</li>)}</ul>
              : <button type="button" onClick={() => setOpen(s.key)} className="mt-1 text-xs font-semibold" style={{ color: DATA }}>Qué hacer ({s.acciones.length}) ›</button>)}
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

function Section({ n, titulo, desc, children }: { n?: string; titulo: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-white p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold" style={{ color: INK }}>{n && <span className="text-slate-400">{n} · </span>}{titulo}</div>
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

function InsightsView({ data }: { data: Insights }) {
  const pos = data.hallazgos.filter((h) => h.tipo === "positivo");
  const neg = data.hallazgos.filter((h) => h.tipo === "negativo");
  return (
    <div className="grid gap-3">
      {data.diagnostico && (
        <section className="rounded-lg border bg-white p-4" style={{ borderLeft: `3px solid ${DATA}` }}>
          <div className="mb-1.5 text-sm font-semibold" style={{ color: INK }}>Diagnóstico</div>
          <p className="text-[13.5px] leading-relaxed" style={{ color: INK }}>{data.diagnostico}</p>
        </section>
      )}
      {data.evolucion.length > 0 && <Section n="01" titulo="Evolución" desc="La trayectoria de cada indicador en el tiempo."><ItemRows items={data.evolucion} /></Section>}
      {data.metas.length > 0 && <Section n="02" titulo="Metas" desc="Real vs meta: la brecha es la unidad de gestión."><ItemRows items={data.metas} /></Section>}
      {data.correlaciones.length > 0 && (
        <Section n="03" titulo="Correlaciones" desc="Cómo un indicador explica a otro y a los objetivos.">
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
        <Section n="04" titulo="Qué funcionó y qué no" desc="Para replicar lo que rinde y no repetir lo que no.">
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
      {data.oportunidades.length > 0 && (
        <Section n="05" titulo="Oportunidades" desc="Palancas de eficiencia cuantificadas con los números del tablero.">
          <div className="grid gap-3">
            {data.oportunidades.map((o, i) => (
              <div key={i} className={i ? "border-t pt-3" : ""}>
                <div className="flex flex-wrap items-center gap-2"><PrioChip p={o.prioridad} /><span className="text-[13px] font-semibold" style={{ color: INK }}>{o.palanca}</span></div>
                {o.impacto && <div className="mt-0.5 text-[12.5px] font-semibold" style={{ color: DATA }}>{o.impacto}</div>}
                {o.calculo && <div className="text-[12px] leading-relaxed text-slate-500">{o.calculo}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}
      {data.planAccion.length > 0 && (
        <Section n="06" titulo="Plan de acción" desc="Instrucciones concretas, con el KPI/objetivo que mueven.">
          <div className="grid gap-3">
            {data.planAccion.map((a, i) => (
              <div key={i} className={i ? "border-t pt-3" : ""}>
                <div className="flex flex-wrap items-center gap-2"><PrioChip p={a.prioridad} /><span className="text-[13px] font-semibold" style={{ color: INK }}>{a.accion}</span></div>
                {a.porque && <div className="mt-0.5 text-[12.5px] leading-relaxed text-slate-600"><span className="font-semibold" style={{ color: INK }}>Por qué:</span> {a.porque}</div>}
                {a.impactoEsperado && <div className="text-[12.5px] leading-relaxed text-slate-600"><span className="font-semibold" style={{ color: INK }}>Impacto esperado:</span> {a.impactoEsperado}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

export function DashDiagnostico({ dash, titulo = "Diagnóstico e inteligencia" }: { dash: string; titulo?: string }) {
  const [open, setOpen] = useState(false);
  const [signals, setSignals] = useState<Signal[] | null>(null);
  const [sigErr, setSigErr] = useState(false);
  const [data, setData] = useState<Insights | null>(null);
  const [meta, setMeta] = useState<{ id: number | null; createdAt: string | null; model?: string | null } | null>(null);
  const [versiones, setVersiones] = useState<ReportMeta[]>([]);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

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

  // Carga perezosa: recién al abrir la sección.
  useEffect(() => {
    if (!open || loaded) return;
    setLoaded(true);
    fetch(`/api/insights/signals?dash=${q}`).then((r) => r.json()).then((j) => setSignals(Array.isArray(j?.signals) ? j.signals : [])).catch(() => { setSignals([]); setSigErr(true); });
    loadSaved();
    loadList();
  }, [open, loaded, q, loadSaved, loadList]);

  const generate = async () => {
    setGenerating(true); setErr(null); setWarn(null);
    try {
      const r = await fetch("/api/insights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dash }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "No se pudo generar el diagnóstico.");
      setData(j.insights as Insights); setMeta({ id: j.id ?? null, createdAt: j.createdAt ?? null, model: j.model });
      if (j.warning) setWarn(j.warning);
      loadList();
    } catch (e) { setErr((e as Error).message); }
    finally { setGenerating(false); }
  };

  const n = (t: Signal["tipo"]) => (signals ?? []).filter((s) => s.tipo === t).length;
  const latestId = versiones[0]?.id ?? null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-2 text-left">
        <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition ${open ? "" : "-rotate-90"}`} />
        <div className="flex-1">
          <h3 className="text-sm font-semibold tracking-tight">{titulo}</h3>
          <p className="text-[11px] text-muted-foreground">Señales automáticas sobre los datos del tablero + diagnóstico IA (evolución, metas, correlaciones, oportunidades y plan de acción).</p>
        </div>
      </button>

      {open && (
        <div className="mt-4 grid gap-4">
          <Section titulo="Señales detectadas" desc={signals ? `Reglas determinísticas sobre los datos actuales — ${n("alerta")} alertas · ${n("oportunidad")} oportunidades · ${n("info")} de contexto. Se recalculan en cada apertura.` : undefined}>
            {signals == null ? (
              <div className="flex items-center gap-2 py-4 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Calculando señales…</div>
            ) : signals.length ? <SignalList signals={signals} /> : (
              <div className="py-2 text-xs text-slate-500">{sigErr ? "No se pudieron calcular las señales." : "Sin señales relevantes con los datos actuales."}</div>
            )}
          </Section>

          <div className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: INK }}><Sparkles className="h-4 w-4" style={{ color: DATA }} />Diagnóstico IA</div>
              {versiones.length > 1 ? (
                <select value={meta?.id ?? ""} onChange={(e) => loadSaved(Number(e.target.value))} className="rounded-md border bg-white px-2 py-1 text-xs font-medium" style={{ color: INK }}>
                  {versiones.map((v) => <option key={v.id} value={v.id}>{fFecha(v.createdAt)}{v.id === latestId ? " (actual)" : ""}</option>)}
                </select>
              ) : meta?.createdAt ? <span className="text-xs text-slate-500">Versión del {fFecha(meta.createdAt)}</span> : null}
              {meta?.id != null && latestId != null && meta.id !== latestId && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700">versión histórica</span>}
              <button type="button" onClick={generate} disabled={generating} className="ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" style={{ background: DATA }}>
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : data ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                {generating ? "Analizando…" : data ? "Regenerar diagnóstico IA" : "Generar diagnóstico IA"}
              </button>
            </div>
            {warn && <div className="text-[11px] text-amber-700">{warn}</div>}
            {err && <div className="text-xs text-red-700">{err}</div>}
            {generating ? (
              <div className="flex items-center gap-2 rounded-lg border bg-white p-4 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Analizando la evolución de los KPIs, el cumplimiento de metas y las correlaciones… (puede tardar unos segundos)</div>
            ) : loadingDiag ? (
              <div className="flex items-center gap-2 py-3 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Cargando el último diagnóstico…</div>
            ) : data ? <InsightsView data={data} /> : (
              <div className="rounded-lg border border-dashed bg-white p-4 text-xs text-slate-500">Todavía no hay un diagnóstico guardado para este tablero. Generalo con el botón (usa los datos del tablero, las metas del Seguimiento y las señales detectadas).</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
