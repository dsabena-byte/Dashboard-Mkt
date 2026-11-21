"use client";
// Edad × medio y formato (Eficiencia Medios): qué formato de Meta rinde mejor en cada rango de edad.
// Datos: meta_paid_breakdown (cron meta-paid-sync?edad=1). Cruce edad × formato estimado dentro de cada anuncio
// (Meta no da las dos aperturas juntas); totales por edad y por formato, exactos.
import { useMemo, useState } from "react";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { resumir, mejorFormato, edadLabel, type CeldaEdad, type Metrica } from "@/lib/pauta-edad";

const RESULTADOS: { id: Metrica; label: string; corto: string }[] = [
  { id: "link_clicks", label: "Clics al sitio", corto: "clic" },
  { id: "landing_views", label: "Visitas a la web", corto: "visita" },
  { id: "video_p100", label: "Videos vistos completos", corto: "video completo" },
  { id: "interacciones", label: "Interacciones", corto: "interacción" },
  { id: "impresiones", label: "Impresiones", corto: "mil impresiones" },
];
const COLORES = ["#1e40af", "#60a5fa", "#0891b2", "#7c3aed", "#be185d", "#ca8a04", "#94a3b8"];
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const mesLabel = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const fmtN = (n: number) => Math.round(n).toLocaleString("es-AR");
const fmt$ = (n: number) => `$ ${n >= 100 ? Math.round(n).toLocaleString("es-AR") : n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
const btn = (on: boolean) =>
  `rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${on ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:bg-muted"}`;

export function EdadFormatoSection({ celdas, meses }: { celdas: CeldaEdad[]; meses: string[] }) {
  const [tipo, setTipo] = useState<"todas" | "video" | "imagen">("todas");
  const [res, setRes] = useState<Metrica>("link_clicks");
  const [mes, setMes] = useState<string>("");
  const r = useMemo(() => resumir(celdas, { tipo, meses: mes ? [mes] : [] }), [celdas, tipo, mes]);
  const def = RESULTADOS.find((x) => x.id === res)!;
  // Costo por resultado (impresiones = costo por mil).
  const costo = (spend: number, n: number) => (n > 0 ? (res === "impresiones" ? (spend / n) * 1000 : spend / n) : null);
  const top = r.formatos.slice(0, 6);
  const otros = r.formatos.slice(6);

  const series = useMemo(() => {
    const grupos: [string, string[]][] = [...top.map((f) => [f, [f]] as [string, string[]]), ...(otros.length ? [["Otros", otros] as [string, string[]]] : [])];
    return grupos.map(([nombre, fs]) => ({
      nombre,
      puntos: r.edades.map((e, i) => {
        const v = fs.reduce((a, f) => { const c = r.celda(e, f); return { n: a.n + c[res], s: a.s + c.spend }; }, { n: 0, s: 0 });
        return { x: i, y: Math.round(v.n), z: v.s, edad: edadLabel(e), costo: costo(v.s, v.n) };
      }).filter((p) => p.y > 0),
    }));
  }, [r, res, top.join(), otros.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!celdas.length) {
    return (
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        Todavía no hay datos de edad y ubicación de Meta. Se cargan con la sincronización diaria de Meta (07:30): el mes en curso y los dos anteriores.
      </div>
    );
  }

  // Conclusiones automáticas.
  const porEdad = r.edades.map((e) => ({ e, v: r.porEdad.get(e)! })).filter((x) => x.v[res] > 0);
  const masVolumen = [...porEdad].sort((a, b) => b.v[res] - a.v[res])[0];
  const masBarata = [...porEdad].filter((x) => x.v.spend >= r.total.spend * 0.05).sort((a, b) => a.v.spend / a.v[res] - b.v.spend / b.v[res])[0];
  const formatoTop = r.formatos.map((f) => ({ f, v: r.porFormato.get(f)! })).filter((x) => x.v[res] >= 10 && x.v.spend >= r.total.spend * 0.05).sort((a, b) => a.v.spend / a.v[res] - b.v.spend / b.v[res])[0];
  const costoTotal = costo(r.total.spend, r.total[res]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Qué ubicación de Meta (Feed, Reels, Stories, Explore…) consigue cada resultado más barato en cada rango de edad. Solo Meta (Instagram y Facebook); montos en $ de la cuenta.
        Los totales por edad y por formato son exactos; el cruce edad × formato es estimado dentro de cada anuncio porque Meta no entrega las dos aperturas juntas
        ({Math.round(r.pctExacto * 100)}% de la inversión viene de anuncios en una sola ubicación: ese tramo es exacto).
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {(["todas", "video", "imagen"] as const).map((t) => (
          <button key={t} className={btn(tipo === t)} onClick={() => setTipo(t)}>{t === "todas" ? "Todas las piezas" : t === "video" ? "Video" : "Imagen"}</button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        {RESULTADOS.map((x) => (
          <button key={x.id} className={btn(res === x.id)} onClick={() => setRes(x.id)}>{x.label}</button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        <select className="rounded-md border border-border bg-card px-2 py-1 text-xs" value={mes} onChange={(e) => setMes(e.target.value)}>
          <option value="">Todo el año</option>
          {meses.map((m) => <option key={m} value={m}>{mesLabel(m)}</option>)}
        </select>
      </div>

      {r.total[res] === 0 ? (
        <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Sin {def.label.toLowerCase()} con estos filtros.</div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              masVolumen && { t: "Edad con más resultados", v: edadLabel(masVolumen.e), d: `${fmtN(masVolumen.v[res])} ${def.label.toLowerCase()} (${Math.round((masVolumen.v[res] / r.total[res]) * 100)}% del total)` },
              masBarata && { t: "Edad más eficiente", v: edadLabel(masBarata.e), d: `${fmt$(costo(masBarata.v.spend, masBarata.v[res])!)} por ${def.corto} vs ${fmt$(costoTotal!)} promedio` },
              formatoTop && { t: "Formato más eficiente", v: formatoTop.f, d: `${fmt$(costo(formatoTop.v.spend, formatoTop.v[res])!)} por ${def.corto} vs ${fmt$(costoTotal!)} promedio` },
            ].filter(Boolean).map((c) => c && (
              <div key={c.t} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="text-xs text-muted-foreground">{c.t}</div>
                <div className="mt-1 text-xl font-semibold">{c.v}</div>
                <div className="mt-1 text-xs text-muted-foreground">{c.d}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-2 text-sm font-semibold">{def.label} por edad y formato · {mes ? mesLabel(mes) : `año ${meses[0]?.slice(0, 4) ?? ""}`}</div>
            <div className="text-xs text-muted-foreground">Altura = cantidad de resultados · tamaño de la burbuja = inversión.</div>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" dataKey="x" domain={[-0.5, r.edades.length - 0.5]} ticks={r.edades.map((_, i) => i)} tickFormatter={(i: number) => edadLabel(r.edades[i] ?? "")} tick={{ fontSize: 11 }} />
                  <YAxis type="number" dataKey="y" width={56} tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtN(v)} />
                  <ZAxis type="number" dataKey="z" range={[40, 900]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={({ payload }) => {
                      const p = payload?.[0]?.payload as { edad: string; y: number; z: number; costo: number | null } | undefined;
                      const nombre = payload?.[0]?.name;
                      if (!p) return null;
                      return (
                        <div className="rounded-md border bg-card px-2 py-1 text-xs shadow">
                          <div className="font-semibold">{nombre} · {p.edad}</div>
                          <div>{fmtN(p.y)} {def.label.toLowerCase()}</div>
                          <div>Inversión {fmt$(p.z)}</div>
                          {p.costo != null && <div>{fmt$(p.costo)} por {def.corto}</div>}
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {series.map((s, i) => (
                    <Scatter key={s.nombre} name={s.nombre} data={s.puntos} fill={COLORES[i % COLORES.length]} fillOpacity={0.7} shape="circle" />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-2 text-sm font-semibold">Costo por {def.corto} · edad × formato · {mes ? mesLabel(mes) : "año"}</div>
            <div className="mb-2 text-xs text-muted-foreground">En azul, el formato más barato de cada edad (con al menos 5% de la inversión de esa edad y 10 resultados). «—» = sin resultados.</div>
            <div className="overflow-hidden">
              <table className="w-full table-fixed text-[11px]">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="w-16 px-1 py-1.5 text-left">Edad</th>
                    {top.map((f) => <th key={f} className="truncate px-1 py-1.5 text-right" title={f}>{f}</th>)}
                    <th className="px-1 py-1.5 text-right">Total</th>
                    <th className="w-24 px-1 py-1.5 text-left">Mejor</th>
                  </tr>
                </thead>
                <tbody>
                  {r.edades.map((e) => {
                    const best = mejorFormato(r, e, res);
                    const tot = r.porEdad.get(e)!;
                    return (
                      <tr key={e} className="border-t">
                        <td className="px-1 py-1.5 font-medium">{edadLabel(e)}</td>
                        {top.map((f) => {
                          const c = r.celda(e, f);
                          const k = costo(c.spend, c[res]);
                          return (
                            <td key={f} className={`whitespace-nowrap px-1 py-1.5 text-right ${best?.formato === f ? "bg-blue-50 font-semibold text-blue-800" : ""}`} title={`${fmtN(c[res])} ${def.label.toLowerCase()} · ${fmt$(c.spend)}`}>
                              {k == null ? "—" : fmt$(k)}
                            </td>
                          );
                        })}
                        <td className="whitespace-nowrap px-1 py-1.5 text-right font-medium">{costo(tot.spend, tot[res]) == null ? "—" : fmt$(costo(tot.spend, tot[res])!)}</td>
                        <td className="truncate px-1 py-1.5">{best?.formato ?? "—"}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t bg-slate-50 font-medium">
                    <td className="px-1 py-1.5">Total</td>
                    {top.map((f) => {
                      const v = r.porFormato.get(f)!;
                      const k = costo(v.spend, v[res]);
                      return <td key={f} className="whitespace-nowrap px-1 py-1.5 text-right">{k == null ? "—" : fmt$(k)}</td>;
                    })}
                    <td className="whitespace-nowrap px-1 py-1.5 text-right">{costoTotal == null ? "—" : fmt$(costoTotal)}</td>
                    <td className="px-1 py-1.5">{formatoTop?.f ?? "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {otros.length > 0 && <div className="mt-2 text-xs text-muted-foreground">Formatos con menos inversión fuera de la tabla: {otros.join(", ")}.</div>}
          </div>
        </>
      )}
    </div>
  );
}
