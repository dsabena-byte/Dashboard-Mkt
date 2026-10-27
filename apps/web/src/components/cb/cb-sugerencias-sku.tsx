"use client";

// Pestaña "Sugerencias de SKUs" de /cuadros-basicos: SKUs fuera del CB del cliente (o tipología) que ya están exhibidos
// en sus tiendas y subirían el % CB. Datos calculados en el server (lib/cb-sugerencias-sku-server.ts).
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { GrupoSku } from "@/lib/cb-sugerencias-sku";

const pctCls = (p: number) => (p >= 80 ? "text-emerald-700" : p >= 70 ? "text-amber-700" : "text-rose-700");
const pp = (x: number) => `+${x.toFixed(1)} pp`;

export function CbSugerenciasSku({ porCliente, porTipologia, semanas, desde, hasta, minSemanas }: {
  porCliente: GrupoSku[]; porTipologia: GrupoSku[]; semanas: number[]; desde: number | null; hasta: number | null; minSemanas: number;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<"cliente" | "tipologia">("cliente");
  const grupos = modo === "cliente" ? porCliente : porTipologia;
  const [sel, setSel] = useState<string | null>(null);
  const g = useMemo(() => grupos.find((x) => x.grupo === sel) ?? grupos[0], [grupos, sel]);
  const nSem = desde != null && hasta != null ? semanas.filter((s) => s >= desde && s <= hasta).length : 0;
  const periodo = (d: number, h: number) => router.push(`/cuadros-basicos?tab=sku&desde=${d}&hasta=${h}` as never);

  if (!semanas.length) {
    return (
      <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
        Todavía no hay exhibición cargada. Subí los archivos semanales de exhibición (ReportExhibitions) en <b>Cargar datos</b>: se reconocen solos.
        Hace falta al menos {minSemanas} semanas (un mes).
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-4 text-xs">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">Desde
            <select className="rounded border px-2 py-1" value={desde ?? ""} onChange={(e) => periodo(Number(e.target.value), hasta!)}>
              {semanas.filter((s) => s <= (hasta ?? 99)).map((s) => <option key={s} value={s}>Sem {s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">Hasta
            <select className="rounded border px-2 py-1" value={hasta ?? ""} onChange={(e) => periodo(Math.min(desde!, Number(e.target.value)), Number(e.target.value))}>
              {semanas.map((s) => <option key={s} value={s}>Sem {s}</option>)}
            </select>
          </label>
          <div className="flex overflow-hidden rounded-md border">
            {(["cliente", "tipologia"] as const).map((m) => (
              <button key={m} onClick={() => { setModo(m); setSel(null); }} className={`px-3 py-1.5 ${modo === m ? "bg-blue-700 text-white" : "hover:bg-muted"}`}>
                {m === "cliente" ? "Por cliente" : "Por tipología"}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1">{modo === "cliente" ? "Cliente" : "Tipología"}
            <select className="rounded border px-2 py-1" value={g?.grupo ?? ""} onChange={(e) => setSel(e.target.value)}>
              {grupos.map((x) => <option key={x.grupo} value={x.grupo}>{x.grupo} · {x.pct.toFixed(0)}% CB · {x.sugerencias.length} sugerencias</option>)}
            </select>
          </label>
        </div>
        {nSem < minSemanas && (
          <p className="mt-2 rounded bg-amber-50 p-2 text-amber-900">El período tiene {nSem} semana{nSem !== 1 ? "s" : ""}: para que la sugerencia sea firme hace falta al menos {minSemanas} (un mes).</p>
        )}
        <p className="mt-2 text-muted-foreground">
          Un SKU cuenta como exhibido en una tienda si apareció (sin «Retirada») en al menos la mitad de las semanas relevadas del período.
          El % CB es el de la última semana del período. Cada sugerencia se estima por separado: no se suman.
        </p>
      </section>

      {g && (
        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold">💡 {g.grupo}</h3>
            <span className="text-xs text-muted-foreground">
              % CB actual <b className={pctCls(g.pct)}>{g.pct.toFixed(1)}%</b> · {g.real.toLocaleString("es-AR")} / {g.target.toLocaleString("es-AR")} · {g.tiendas} tiendas
            </span>
          </div>
          {!g.sugerencias.length ? (
            <p className="text-xs text-muted-foreground">No hay SKUs fuera del CB exhibidos en estas tiendas que suban el %.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-1.5 pr-2">SKU sugerido</th>
                    <th className="pr-2">Categoría · segmento</th>
                    <th className="pr-2 text-right">Exhibido en</th>
                    <th className="pr-2">Como homólogo de (del CB)</th>
                    <th className="pr-2 text-right">% CB si es homólogo</th>
                    <th className="text-right">% CB si se suma al CB</th>
                  </tr>
                </thead>
                <tbody>
                  {g.sugerencias.map((s) => (
                    <tr key={s.sku} className="border-b align-top">
                      <td className="py-1.5 pr-2"><div className="font-mono font-semibold">{s.sku}</div><div className="text-muted-foreground">{s.descripcion}</div></td>
                      <td className="pr-2">{s.categoria}<div className="text-muted-foreground">{s.segmento || "—"}</div></td>
                      <td className="pr-2 text-right tabular-nums">{s.tiendasExh}/{s.tiendas} tiendas</td>
                      <td className="pr-2">
                        {s.homologo ? (
                          <>
                            <span className="font-mono">{s.homologo.de}</span>
                            <div className="text-muted-foreground">{s.homologo.mismoSegmento ? "mismo segmento" : "mismo tipo, otra capacidad"} · cubre {s.homologo.recupera} faltante{s.homologo.recupera !== 1 ? "s" : ""}</div>
                          </>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="pr-2 text-right tabular-nums">
                        {s.homologo ? <><span className={pctCls(g.pct + s.homologo.deltaPp)}>{(g.pct + s.homologo.deltaPp).toFixed(1)}%</span><div className="text-emerald-700">{pp(s.homologo.deltaPp)}</div></> : "—"}
                      </td>
                      <td className="text-right tabular-nums">
                        {s.nuevoDeltaPp > 0 ? <><span className={pctCls(g.pct + s.nuevoDeltaPp)}>{(g.pct + s.nuevoDeltaPp).toFixed(1)}%</span><div className="text-emerald-700">{pp(s.nuevoDeltaPp)}</div></> : <span className="text-muted-foreground">no sube</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
