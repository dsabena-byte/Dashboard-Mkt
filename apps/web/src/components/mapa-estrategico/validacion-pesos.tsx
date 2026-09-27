"use client";

// "¿Tus pesos se sostienen en tus datos?" (portado de BIP, sep-2026): por objetivo, cada KPI vinculado
// con su evidencia contra el share de mercado de Drean (correlación rezagada 0-3 meses sobre
// variaciones mes a mes). Se calcula A DEMANDA (botón) → no suma costo al render del Mapa.
// El semáforo solo marca el nivel de evidencia; la advertencia de causalidad va SIEMPRE visible.
import { useState } from "react";
import { Loader2, FlaskConical } from "lucide-react";
import type { ValidacionMapaData } from "@/lib/mapa-validacion-server";
import type { NivelEvidencia } from "@/lib/stats/validacion";
import { LearnButton } from "@/components/knowledge/learn-button";

const PILL: Record<NivelEvidencia, { cls: string; t: string }> = {
  fuerte: { cls: "bg-emerald-50 text-emerald-700", t: "Evidencia fuerte" },
  moderada: { cls: "bg-sky-50 text-sky-800", t: "Evidencia moderada" },
  "sin evidencia": { cls: "bg-slate-100 text-slate-600", t: "Sin evidencia" },
  contraria: { cls: "bg-red-50 text-red-700", t: "Se mueve al revés" },
  "sin datos": { cls: "bg-slate-50 text-slate-400", t: "Sin datos suficientes" },
  "es el resultado": { cls: "bg-slate-50 text-slate-500", t: "Es el resultado" },
};

export function ValidacionPesos() {
  const [data, setData] = useState<ValidacionMapaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pedido, setPedido] = useState(false);
  const [sel, setSel] = useState<string>("");

  async function correr() {
    setLoading(true); setErr(null); setPedido(true);
    try {
      const r = await fetch("/api/mapa-estrategico/validacion", { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { data?: ValidacionMapaData | null; error?: string };
      if (!r.ok) throw new Error(j.error ?? "No se pudo calcular la validación.");
      setData(j.data ?? null);
      setSel(j.data?.resultados[0]?.id ?? "");
    } catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  }

  const r = data?.resultados.find((x) => x.id === sel) ?? data?.resultados[0];
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">¿Tus pesos se sostienen en tus datos? <LearnButton k="validar_mapa" /></h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            El Mapa es una hipótesis: &ldquo;estos KPIs explican estos objetivos&rdquo;. Acá se contrasta con el resultado de negocio (share de mercado de Drean, GfK):
            si las variaciones de cada KPI acompañan a las del share, en el mismo mes o con hasta 3 meses de adelanto.
          </p>
        </div>
        <button type="button" onClick={correr} disabled={loading} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
          {pedido ? "Recalcular" : "Validar con mis datos"}
        </button>
      </div>

      {err && <p className="mt-3 text-xs text-red-700">{err}</p>}
      {pedido && !loading && !err && !r && (
        <p className="mt-3 text-[12px] text-muted-foreground">Todavía no hay un resultado de negocio con 13+ meses para comparar (el share de GfK mensual necesita al menos un año cargado).</p>
      )}
      {r && data && (
        <div className="mt-3">
          {data.resultados.length > 1 && (
            <div role="tablist" aria-label="Resultado de negocio" className="mb-3 flex gap-5 border-b">
              {data.resultados.map((x) => (
                <button key={x.id} role="tab" aria-selected={x.id === r.id} onClick={() => setSel(x.id)}
                  className={`-mb-px border-b-2 px-0.5 pb-2 text-[12.5px] font-semibold ${x.id === r.id ? "border-amber-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  vs {x.resultado}
                </button>
              ))}
            </div>
          )}
          <div className="mb-3 text-[11.5px] text-muted-foreground">
            Resultado: <b className="text-foreground">{r.resultado}</b>{r.nota ? ` (${r.nota})` : ""} · {r.resumen.fuerte} con evidencia fuerte · {r.resumen.moderada} moderada · {r.resumen.sinEvidencia} sin evidencia{r.resumen.contraria ? ` · ${r.resumen.contraria} al revés` : ""}{r.resumen.sinDatos ? ` · ${r.resumen.sinDatos} sin datos suficientes` : ""}
            {data.nota && <span className="block text-amber-700">{data.nota}</span>}
          </div>
          <div className="flex flex-col gap-4">
            {data.objetivos.map((o) => {
              const vs = r.vinculos.filter((v) => v.objetivoId === o.id).sort((a, b) => b.peso - a.peso);
              if (!vs.length) return null;
              return (
                <div key={o.id}>
                  <div className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold"><span className="h-2.5 w-2.5 rounded" style={{ background: o.color }} />{o.nombre}</div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-[12px]">
                      <tbody>
                        {vs.map((v) => (
                          <tr key={`${v.plan}|${v.kpi}`} className="border-t align-top">
                            <td className="w-[200px] px-2 py-1.5"><b>{v.kpi}</b><div className="text-[10.5px] text-muted-foreground">{v.plan} · peso {v.peso}%</div></td>
                            <td className="w-[150px] px-2 py-1.5"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${PILL[v.nivel].cls}`}>{PILL[v.nivel].t}</span></td>
                            <td className="px-2 py-1.5 text-muted-foreground">{v.lectura}{v.sugerencia && <div className="mt-0.5 text-foreground">→ {v.sugerencia}</div>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground"><b className="text-foreground">Ojo:</b> {r.advertencia} Método: correlación de Pearson sobre variaciones mes a mes (Δ log), rezagos 0 a 3 meses, IC 95% de Fisher y p-valor corregido por probar 4 rezagos (Bonferroni); mínimo 12 pares de meses.</p>
        </div>
      )}
    </section>
  );
}
