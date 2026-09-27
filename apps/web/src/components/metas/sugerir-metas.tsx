"use client";

// "Sugerir metas" del MetaPanel (portado de BIP, sep-2026; lib/stats/sugerir):
//   meta sugerida(mes) = pronóstico si seguís igual × ambición (conservadora +0% · realista +10% ·
//   agresiva +20%; en KPIs "menor es mejor" la ambición BAJA el valor) + probabilidad de llegar
//   (2.000 simulaciones con los errores históricos del pronóstico).
// La historia se pide A DEMANDA a /api/metas/historia (mismas series que el Seguimiento). Solo
// completa meses que no cerraron; "Aplicar" las carga en el panel y el usuario revisa y Guarda.
import { useMemo, useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { sugerirTodas, AMBICIONES, type Ambicion, type Sugerencia } from "@/lib/stats/sugerir";
import { SEMAFORO_COLOR } from "@/lib/metas";
import { LearnButton } from "@/components/knowledge/learn-button";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

interface HistKpi { kpi: string; realM: (number | null)[]; histM: (number | null)[] | null; tipo: "sum" | "rate"; direccion: "up" | "down"; unidad: string }

const pctP = (p: number | null) => (p == null ? "—" : `${Math.round(p * 100)}%`);
const probColor = (p: number | null) => (p == null ? "#64748b" : p >= 0.7 ? SEMAFORO_COLOR.verde : p >= 0.3 ? SEMAFORO_COLOR.amarillo : SEMAFORO_COLOR.rojo);
function fmt(n: number | null | undefined, unidad?: string | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const s = abs >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : abs >= 10_000 ? `${(n / 1_000).toFixed(0)}K` : n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
  return unidad === "%" ? `${s}%` : unidad === "$" ? `$${s}` : s;
}

export function SugerirMetas({ plan, anio, kpis, direccionDe, unidadDe, onAplicar }: {
  plan: string;
  anio: number;
  kpis: string[];
  direccionDe: (kpi: string) => "up" | "down";
  unidadDe: (kpi: string) => string | null | undefined;
  /** kpi → sugerencia elegida (valores[12], null en meses cerrados). */
  onAplicar: (s: Record<string, Sugerencia>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hist, setHist] = useState<Record<string, HistKpi> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [amb, setAmb] = useState<Ambicion>("realista");
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [aplicado, setAplicado] = useState(false);

  async function abrir() {
    setOpen((o) => !o);
    if (hist || loading) return;
    setLoading(true); setErr(null);
    try {
      const r = await fetch(`/api/metas/historia?plan=${encodeURIComponent(plan)}&anio=${anio}`, { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { kpis?: HistKpi[]; error?: string };
      if (!r.ok || !j.kpis) setErr(j.error ?? "No pudimos leer la historia de estos KPIs.");
      else {
        const m = Object.fromEntries(j.kpis.map((k) => [k.kpi, k]));
        setHist(m);
        setSel(Object.fromEntries(kpis.filter((k) => m[k]).map((k) => [k, true])));
      }
    } catch { setErr("No pudimos leer la historia de estos KPIs."); }
    finally { setLoading(false); }
  }

  const dirs = kpis.map((k) => direccionDe(k)).join(",");
  const sug = useMemo(() => {
    const out: Record<string, Record<Ambicion, Sugerencia>> = {};
    if (!hist) return out;
    for (const k of kpis) {
      const h = hist[k];
      if (!h || (!h.realM.some((v) => v != null) && !(h.histM ?? []).some((v) => v != null))) continue;
      out[k] = sugerirTodas({ realM: h.realM, histM: h.histM, tipo: h.tipo, direccion: direccionDe(k), unidad: unidadDe(k) ?? h.unidad, seed: `sug-${plan}-${k}` });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hist, dirs]);
  const filas = kpis.filter((k) => sug[k]);

  return (
    <div className="mb-3 rounded-md border bg-muted/30 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><LearnButton k="sugerir_metas" /><span><b className="text-foreground">¿Qué meta poner?</b> Te sugerimos una a partir del pronóstico de cada KPI, con la probabilidad de llegar.</span></div>
        <button type="button" onClick={abrir} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-[11.5px] font-medium hover:bg-muted">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          {open ? "Cerrar" : "Sugerir metas"}
        </button>
      </div>
      {open && (
        <div className="mt-2.5">
          {loading && <p className="text-[11.5px] text-muted-foreground">Calculando el pronóstico…</p>}
          {err && <p className="text-[11.5px] text-red-700">{err}</p>}
          {hist && (
            <>
              <div role="radiogroup" aria-label="Ambición" className="mb-2.5 flex flex-wrap gap-1.5">
                {AMBICIONES.map((a) => (
                  <button key={a.id} type="button" role="radio" aria-checked={amb === a.id} onClick={() => { setAmb(a.id); setAplicado(false); }}
                    className={`rounded-md border px-2.5 py-1 text-left text-[11.5px] ${amb === a.id ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"}`}>
                    <b>{a.label}</b> <span className="opacity-80">· {a.texto}</span>
                  </button>
                ))}
              </div>
              {!filas.length ? <p className="text-[11.5px] text-muted-foreground">Todavía no hay historia suficiente de estos KPIs para sugerir metas.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse text-[12px]">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-1.5" /><th className="px-2 py-1.5">KPI</th><th className="px-2 py-1.5">Meses</th>
                        <th className="px-2 py-1.5 text-right">Meta sugerida</th><th className="px-2 py-1.5 text-right">Si seguís igual</th><th className="px-2 py-1.5 text-right">Prob. de llegar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((k) => {
                        const sg = sug[k]![amb];
                        const h = hist[k]!;
                        const agg = (arr: (number | null)[]) => { const v = sg.meses.map((i) => arr[i]).filter((x): x is number => x != null); return v.length ? (h.tipo === "sum" ? v.reduce((a, b) => a + b, 0) : v.reduce((a, b) => a + b, 0) / v.length) : null; };
                        const disabled = !sg.meses.length;
                        const u = unidadDe(k) ?? h.unidad;
                        return (
                          <tr key={k} className="border-t">
                            <td className="px-2 py-1.5"><input type="checkbox" disabled={disabled} checked={!disabled && !!sel[k]} onChange={(e) => { setSel({ ...sel, [k]: e.target.checked }); setAplicado(false); }} aria-label={`Aplicar a ${k}`} /></td>
                            <td className="px-2 py-1.5 font-medium">{k}</td>
                            <td className="px-2 py-1.5 text-muted-foreground">{sg.meses.length ? `${MESES[sg.meses[0]!]}–${MESES[sg.meses[sg.meses.length - 1]!]}` : "—"}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(agg(sg.valores), u)}{h.tipo === "rate" ? " prom." : ""}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmt(agg(sg.base), u)}</td>
                            <td className="px-2 py-1.5 text-right" title={sg.motivo ?? `Método: ${sg.metodoTexto} · ${sg.n} meses con dato · 2.000 simulaciones`}>
                              <b style={{ color: probColor(sg.probabilidad) }}>{pctP(sg.probabilidad)}</b>
                              {sg.probabilidad == null && <div className="ml-auto max-w-[220px] text-[10px] text-muted-foreground">{sg.motivo}</div>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <button type="button" disabled={!filas.some((k) => sel[k] && sug[k]![amb].meses.length)}
                  onClick={() => { onAplicar(Object.fromEntries(filas.filter((k) => sel[k]).map((k) => [k, sug[k]![amb]]))); setAplicado(true); }}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40">Aplicar a las metas</button>
                {aplicado && <span className="text-[11px] font-semibold text-emerald-700">✓ Cargadas: revisalas y tocá Guardar.</span>}
              </div>
              <p className="mt-2 text-[10.5px] text-muted-foreground">Solo completa los meses que todavía no cerraron (lo ya medido no se toca). &ldquo;Si seguís igual&rdquo; = el pronóstico del KPI (estacionalidad del año anterior si hay 13+ meses; si no, ritmo reciente ponderado). La probabilidad sale de 2.000 simulaciones con los errores históricos de ese pronóstico: 20–50% es exigente pero posible; menos de 10% suele ser imposible. Con menos de 6 meses de historia se propone la línea base sin probabilidad.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
