"use client";
import { useState } from "react";
import { FATIGA_CAIDA, FRECUENCIA_MES_ALTA, FATIGA_MIN_IMPR, mesCorto, type FatigaResumen, type FatigaPieza } from "@/lib/pauta-fatiga";
import { LearnButton } from "@/components/knowledge/learn-button";

// Fatiga creativa por pieza — tab Eficiencia Medios de /performance. Serie MENSUAL por pieza (Meta por
// permalink, DV360 por creativo) de la tasa (VTR ≥50% en video, CTR en el resto) y la frecuencia.
// Tasa en azul, frecuencia en gris pizarra; semáforo SOLO en la pastilla de estado.

const ESTADO: Record<FatigaPieza["estado"], { label: string; color: string; bg: string }> = {
  fatiga: { label: "Fatiga", color: "#b91c1c", bg: "rgba(220,38,38,.08)" },
  frecuencia_alta: { label: "Frecuencia alta", color: "#b45309", bg: "rgba(217,119,6,.10)" },
  ok: { label: "Sin fatiga", color: "#15803d", bg: "rgba(22,163,74,.10)" },
};
const nf = (v: number, d = 0) => v.toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d });
const shortN = (v: number) => (v >= 1e6 ? `${nf(v / 1e6, 1)}M` : v >= 1e3 ? `${nf(v / 1e3, 0)}K` : nf(v));

function Spark({ p }: { p: FatigaPieza }) {
  const W = 120, H = 30;
  const t = p.meses.map((m) => m.tasa), f = p.meses.map((m) => m.freq ?? 0);
  const mx = (xs: number[]) => Math.max(...xs, 1e-9);
  const pts = (xs: number[]) => xs.map((v, i) => `${xs.length === 1 ? W / 2 : (i / (xs.length - 1)) * (W - 6) + 3},${H - 3 - (v / mx(xs)) * (H - 6)}`).join(" ");
  return (
    <svg width={W} height={H} aria-label={`${p.metrica} y frecuencia por mes`}>
      {f.some((v) => v > 0) && <polyline points={pts(f)} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3 2" />}
      <polyline points={pts(t)} fill="none" stroke="#1e40af" strokeWidth={2} />
    </svg>
  );
}

export function FatigaSection({ f }: { f: FatigaResumen }) {
  const [todas, setTodas] = useState(false);
  const flag = f.piezas.filter((p) => p.estado !== "ok");
  const lista = todas ? f.piezas : flag.length ? flag : f.piezas.slice(0, 5);
  return (
    <section className="mb-6 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">Fatiga creativa por pieza <LearnButton k="fatiga" /></h3>
        <span className="text-[11px] text-muted-foreground">
          {f.evaluadas} piezas al aire en el último mes · {f.sinSerie} con un solo mes (rotan antes de poder medir desgaste) ·{" "}
          <b className="text-foreground">{f.piezas.filter((p) => p.estado === "fatiga").length} con fatiga</b>
        </span>
      </div>
      <p className="mb-3 mt-1 text-[11px] text-muted-foreground">
        Una pieza está <b>fatigada</b> cuando su tasa cae ≥{FATIGA_CAIDA}% contra los 1-2 meses previos <b>mientras su frecuencia sube</b> (la
        misma gente la ve más veces y responde menos). Tasa = VTR ≥50% en video, CTR en el resto. Serie mensual (la pauta se guarda por mes),
        meses con ≥{nf(FATIGA_MIN_IMPR)} impresiones. Meta: frecuencia de la pieza (impresiones ÷ alcance). DV360 no da alcance por pieza: se
        usa la frecuencia de su <b>línea</b> (canal × categoría). Frecuencia mensual &gt;{FRECUENCIA_MES_ALTA} = alta. El mes en curso es parcial
        (su frecuencia todavía acumula). Año completo, no responde a los filtros.
      </p>
      {f.piezas.length === 0 ? (
        <p className="text-xs text-muted-foreground">Ninguna pieza al aire tiene 2+ meses con volumen: con la rotación actual no hay desgaste que medir.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-xs">
            <thead className="border-b bg-muted/40">
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Pieza</th><th className="px-3 py-2">Medio</th><th className="px-3 py-2">Meses</th>
                <th className="px-3 py-2 text-right">Tasa último</th><th className="px-3 py-2 text-right">Previos</th><th className="px-3 py-2 text-right">Cambio</th>
                <th className="px-3 py-2 text-right">Frecuencia</th><th className="px-3 py-2">Evolución</th><th className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p) => {
                const e = ESTADO[p.estado];
                return (
                  <tr key={p.key} className="border-b align-top last:border-0">
                    <td className="max-w-[260px] px-3 py-2">
                      <div className="flex items-center gap-2">
                        {p.thumb && <img src={p.thumb} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />}
                        <div className="min-w-0">
                          {p.permalink ? <a href={p.permalink} target="_blank" rel="noreferrer" className="block truncate font-medium hover:underline">{p.nombre}</a> : <div className="truncate font-medium">{p.nombre}</div>}
                          <div className="text-[10.5px] text-muted-foreground">{p.categoria ?? "—"}</div>
                        </div>
                      </div>
                      <div className="mt-1 text-[10.5px] leading-snug text-muted-foreground">{p.motivo}</div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{p.fuente === "DV360" ? `DV360 ${p.canal}` : "Meta"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{p.meses.map((m) => mesCorto(m.mes)).join(" · ")}{p.parcial ? " (en curso)" : ""}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{p.metrica} {nf(p.tasaUlt, p.metrica === "CTR" ? 2 : 1)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{nf(p.tasaPrev, p.metrica === "CTR" ? 2 : 1)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.caidaPct == null ? "—" : `${p.caidaPct > 0 ? "+" : ""}${nf(p.caidaPct)}%`}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{p.frecPrev != null ? `${nf(p.frecPrev, 1)} → ` : ""}{p.frecUlt != null ? nf(p.frecUlt, 1) : "—"}{p.frecFuente === "línea" && <span className="text-muted-foreground"> (línea)</span>}</td>
                    <td className="px-3 py-2"><Spark p={p} /><div className="text-[10px] text-muted-foreground">{shortN(p.meses[p.meses.length - 1]?.impr ?? 0)} impr. último mes</div></td>
                    <td className="px-3 py-2"><span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: e.color, background: e.bg }}>{e.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-muted-foreground">
            <span><i className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: "#1e40af" }} />Tasa ({"VTR/CTR"}) <i className="ml-3 mr-1 inline-block w-4 align-middle" style={{ borderTop: "1.5px dashed #94a3b8" }} />Frecuencia</span>
            {f.piezas.length > lista.length || todas ? (
              <button onClick={() => setTodas((v) => !v)} className="font-semibold" style={{ color: "#1e40af" }}>{todas ? "Ver solo las marcadas" : `Ver las ${f.piezas.length} piezas con serie`}</button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
