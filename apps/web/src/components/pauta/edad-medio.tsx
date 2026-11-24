"use client";
// Edad × formato (Eficiencia Medios): los formatos más baratos por edad, uno para video y otro para imagen.
// Video = costo por reproducción vista al 50% o más; imagen = costo por clic.
// Formato = ubicación en Meta (IG Feed, IG Reels, IG Stories…); en los demás medios = el medio (TikTok, YouTube…).
// Datos: pauta_edad (crons de Meta, TikTok, DV360 y Google Ads con ?edad=1). DV360 ya viene en $ (TC REAL).
import { useMemo, useState } from "react";
import { resumir, rankingFormatos, type FilaEdad, type Metrica } from "@/lib/pauta-edad";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const mesLabel = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const fmt$ = (n: number) => `$ ${n >= 100 ? Math.round(n).toLocaleString("es-AR") : n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;

function Ranking({ filas, meses, tipo, res, titulo, unidad }: { filas: FilaEdad[]; meses: string[]; tipo: "video" | "imagen"; res: Metrica; titulo: string; unidad: string }) {
  const r = useMemo(() => resumir(filas, { tipo, por: "formato", meses }), [filas, tipo, meses]);
  const edades = r.edades.filter((e) => e !== "Sin dato");
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-sm font-semibold">{titulo}</div>
      <div className="mb-3 text-xs text-muted-foreground">Los 3 formatos más baratos por {unidad} en cada edad.</div>
      {r.total[res] === 0 ? (
        <div className="text-sm text-muted-foreground">Todavía sin datos para este período.</div>
      ) : (
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="w-16 py-1.5 text-left font-medium">Edad</th>
              <th className="py-1.5 text-left font-medium">1º</th>
              <th className="py-1.5 text-left font-medium">2º</th>
              <th className="py-1.5 text-left font-medium">3º</th>
            </tr>
          </thead>
          <tbody>
            {edades.map((e) => {
              const rk = rankingFormatos(r, e, res, 3);
              return (
                <tr key={e} className="border-t">
                  <td className="py-2 font-medium">{e}</td>
                  {[0, 1, 2].map((i) => {
                    const p = rk[i];
                    return (
                      <td key={i} className="py-1.5 pr-2">
                        {p ? (
                          <div className={`rounded-md px-2 py-1 ${i === 0 ? "bg-blue-50 text-blue-900" : ""}`}>
                            <div className="truncate font-semibold" title={p.formato}>{p.formato}</div>
                            <div className="text-[11px] text-muted-foreground">{fmt$(p.costo)}</div>
                          </div>
                        ) : <span className="px-2 text-muted-foreground">—</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function EdadMedioSection({ filas, meses }: { filas: FilaEdad[]; meses: string[] }) {
  const [mes, setMes] = useState<string>("");
  const sel = useMemo(() => (mes ? [mes] : []), [mes]);

  if (!filas.length) {
    return (
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        Todavía no hay datos de edad. Se cargan con las sincronizaciones diarias de Meta, TikTok, DV360 y Google Ads.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Formato = ubicación en Meta (IG Reels, IG Stories, FB Feed…); en los demás medios, el medio. Solo entran formatos con al menos 5% de la inversión de esa edad.
        </p>
        <select className="rounded-md border border-border bg-card px-2 py-1 text-xs" value={mes} onChange={(e) => setMes(e.target.value)}>
          <option value="">Todo el año</option>
          {meses.map((m) => <option key={m} value={m}>{mesLabel(m)}</option>)}
        </select>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Ranking filas={filas} meses={sel} tipo="video" res="video_p50" titulo="Video · costo por reproducción vista al 50% o más" unidad="reproducción al 50%+" />
        <Ranking filas={filas} meses={sel} tipo="imagen" res="clicks" titulo="Imagen · costo por clic" unidad="clic" />
      </div>
    </div>
  );
}
