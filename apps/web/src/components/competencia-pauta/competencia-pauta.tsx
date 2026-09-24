"use client";
import { useMemo, useState } from "react";
import type { BrandAds, BrandSummary, CompetitorAd } from "@/lib/ad-library-shared";
import type { AdEngagement, BrandIntensity, SustainedAd } from "@/lib/ad-intensity";

// Pauta de la competencia (cliente) — portado de BIP (sep-2026): resumen por marca + grilla de
// creativos filtrable. Sistema visual de Drean: marca propia en azul #1e40af; ámbar solo para estado.

const PLAT: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", messenger: "Messenger", audience_network: "Audience Network", threads: "Threads" };
const fd = (s: string | null) => (s ? new Date(s).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" }) : "—");
const start = (a: CompetitorAd) => a.startDate ?? a.firstSeen;
const daysSince = (s: string) => Math.max(0, Math.floor((Date.now() - new Date(s).getTime()) / 86_400_000));
const SEL = "rounded-md border bg-background px-2 py-1.5 text-sm";

const k = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n)));

export function CompetenciaPauta({ brands, summaries, updatedAt, intensity = [], sustained = [], engagement = {} }: { brands: BrandAds[]; summaries: BrandSummary[]; updatedAt: string | null; intensity?: BrandIntensity[]; sustained?: SustainedAd[]; engagement?: Record<string, AdEngagement> }) {
  const [sortEng, setSortEng] = useState(false);
  const [marca, setMarca] = useState<string>("__all");
  const [win, setWin] = useState<"7" | "30" | "all">("30");
  const [fmt, setFmt] = useState<string>("__all");
  const ads = useMemo(() => {
    const now = Date.now();
    return brands.filter((b) => (marca === "__all" ? !b.own : b.marca === marca))
      .flatMap((b) => b.ads.map((a) => ({ ...a, marca: b.marca })))
      .filter((a) => a.active)
      .filter((a) => win === "all" || now - new Date(start(a)).getTime() <= Number(win) * 86_400_000)
      .filter((a) => fmt === "__all" || a.format === fmt)
      .sort((x, y) => sortEng ? ((engagement[y.id]?.likes ?? -1) + (engagement[y.id]?.comentarios ?? 0)) - ((engagement[x.id]?.likes ?? -1) + (engagement[x.id]?.comentarios ?? 0)) : start(y).localeCompare(start(x)));
  }, [brands, marca, win, fmt, sortEng, engagement]);
  const adById = useMemo(() => new Map(brands.flatMap((b) => b.ads.map((a) => [a.id, a] as const))), [brands]);
  const matched = Object.keys(engagement).length;
  const formatos = [...new Set(brands.flatMap((b) => b.ads.map((a) => a.format)))];
  const comp = summaries.filter((s) => !s.own);
  const tot = { activos: comp.reduce((a, s) => a + s.activos, 0), n7: comp.reduce((a, s) => a + s.nuevos7, 0), n30: comp.reduce((a, s) => a + s.nuevos30, 0) };
  const own = summaries.find((s) => s.own);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { t: "Anuncios activos de la competencia", v: tot.activos, s: `${comp.filter((s) => s.activos > 0).length} de ${comp.length} marcas pautando` },
          { t: "Nuevos últimos 7 días", v: tot.n7, s: "Competencia (fecha de inicio en Meta)" },
          { t: "Nuevos últimos 30 días", v: tot.n30, s: "Competencia" },
          { t: `${own?.marca ?? "Marca propia"} · activos`, v: own?.activos ?? 0, s: `Referencia · ${own?.nuevos30 ?? 0} nuevos en 30 días` },
        ].map((k) => (
          <div key={k.t} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{k.t}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: "#1e40af" }}>{k.v}</div>
            <div className="mt-1 text-xs text-muted-foreground">{k.s}</div>
          </div>
        ))}
      </div>

      {intensity.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-semibold">Índice de intensidad de pauta</h3>
            <p className="mb-3 text-[11px] text-muted-foreground">Estimado con lo público (avisos, mensajes, lanzamientos, días al aire, plataformas). 100 = la marca que más pauta.</p>
            <div className="space-y-2">
              {intensity.map((b) => (
                <div key={b.marca} className="grid grid-cols-[110px_1fr_36px] items-center gap-2 text-xs" title={`${b.activos} avisos · ${b.creatividades} mensajes · ${b.versionesPorCreatividad} versiones por mensaje · ${b.diasPromedio} días al aire prom. · ${b.sostenidos} sostenidos 30+ días · ${b.lanzamientos30} lanzados en 30 días`}>
                  <span className={`truncate ${b.own ? "font-semibold" : ""}`} style={b.own ? { color: "#1e40af" } : undefined}>{b.marca}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${b.indice}%`, background: b.own ? "#1e40af" : "#64748b" }} /></span>
                  <span className="text-right font-semibold tabular-nums">{b.indice}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-[11px]">
                <thead><tr className="text-muted-foreground">{["Marca", "Mensajes", "Versiones/msj", "Días al aire", "Sostenidos", "Nuevos 30d"].map((h, i) => <th key={h} className={`py-1 font-semibold ${i ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                <tbody>{intensity.filter((b) => b.activos).map((b) => (
                  <tr key={b.marca} className="border-t"><td className="py-1">{b.marca}</td><td className="text-right tabular-nums">{b.creatividades}</td><td className="text-right tabular-nums">{b.versionesPorCreatividad}</td><td className="text-right tabular-nums">{b.diasPromedio}</td><td className="text-right tabular-nums">{b.sostenidos}</td><td className="text-right tabular-nums">{b.lanzamientos30}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-semibold">Avisos que más sostienen</h3>
            <p className="mb-3 text-[11px] text-muted-foreground">Los que llevan más días activos (y en cuántas versiones corren): la mejor pista de qué mensaje les rinde.</p>
            <div className="space-y-2">
              {sustained.slice(0, 8).map((s) => { const a = adById.get(s.id); const e = engagement[s.id]; return a ? (
                <a key={s.id} href={a.url} target="_blank" rel="noreferrer" className="flex gap-2.5 rounded-lg border p-2 hover:bg-muted/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {a.thumb ? <img src={a.thumb} alt="" className="h-12 w-12 shrink-0 rounded object-cover" referrerPolicy="no-referrer" /> : <span className="h-12 w-12 shrink-0 rounded bg-muted" />}
                  <span className="min-w-0 text-xs">
                    <span className="font-semibold">{s.marca}</span> <span className="text-muted-foreground">· {s.dias} días al aire{s.versiones > 1 ? ` · ${s.versiones} versiones` : ""}{e ? ` · ♥ ${k(e.likes)} · 💬 ${k(e.comentarios)}` : ""}</span>
                    <span className="line-clamp-2 block text-muted-foreground">{a.body || a.title || "(sin texto)"}</span>
                  </span>
                </a>) : null; })}
              {!sustained.length && <p className="text-xs text-muted-foreground">Sin avisos activos de la competencia.</p>}
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pb-1 pt-3">
          <h3 className="text-sm font-semibold">Resumen por marca</h3>
          <span className="text-[11px] text-muted-foreground">Actualizado {fd(updatedAt)} · clic en una marca para ver sus anuncios</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-xs">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
                {["Marca", "Activos", "Nuevos 7 días", "Nuevos 30 días", "Formatos", "Dónde", "Activo desde"].map((h, i) => (
                  <th key={h} className={`px-3 py-2 font-semibold ${i >= 1 && i <= 3 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...summaries].sort((a, b) => (a.own ? 1 : 0) - (b.own ? 1 : 0) || b.activos - a.activos).map((s) => (
                <tr key={s.marca} className={`cursor-pointer border-t ${marca === s.marca ? "bg-muted/60" : ""}`} onClick={() => setMarca(marca === s.marca ? "__all" : s.marca)}>
                  <td className="px-3 py-2 font-semibold" style={s.own ? { color: "#1e40af" } : undefined}>
                    {s.marca}{s.own && <span className="font-normal text-muted-foreground"> · marca propia</span>}
                    {s.stale && <span title={s.error ?? ""} className="ml-1.5 text-[10.5px] font-medium" style={{ color: "#92400e" }}>sin actualizar</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.activos}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${s.nuevos7 ? "font-semibold" : ""}`}>{s.nuevos7}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.nuevos30}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.formatos.map(([f, n]) => `${f} ${n}`).join(" · ") || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.plataformas.slice(0, 3).map(([p]) => PLAT[p] ?? p).join(", ") || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fd(s.masViejo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select className={SEL} value={marca} onChange={(e) => setMarca(e.target.value)}>
          <option value="__all">Toda la competencia</option>
          {brands.map((b) => <option key={b.marca} value={b.marca}>{b.marca}{b.own ? " (marca propia)" : ""}</option>)}
        </select>
        <select className={SEL} value={win} onChange={(e) => setWin(e.target.value as "7" | "30" | "all")}>
          <option value="7">Lanzados en los últimos 7 días</option>
          <option value="30">Lanzados en los últimos 30 días</option>
          <option value="all">Todos los activos</option>
        </select>
        <select className={SEL} value={fmt} onChange={(e) => setFmt(e.target.value)}>
          <option value="__all">Todos los formatos</option>
          {formatos.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={sortEng} onChange={(e) => setSortEng(e.target.checked)} />Ordenar por me gusta + comentarios</label>
        <span className="text-xs text-muted-foreground">{ads.length} {ads.length === 1 ? "anuncio" : "anuncios"} · {matched} con métricas del posteo</span>
      </div>

      {ads.length === 0 ? (
        <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground">No hay anuncios con este filtro. Probá con “Todos los activos”.</div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
          {ads.slice(0, 120).map((a) => (
            <a key={`${a.marca}-${a.id}`} href={a.url} target="_blank" rel="noreferrer" className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">
              <div className="flex aspect-square items-center justify-center overflow-hidden bg-muted">
                {a.thumb
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={a.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  : <span className="text-xs text-muted-foreground">Sin vista previa</span>}
              </div>
              <div className="flex flex-col gap-1 px-3 py-2.5">
                <div className="flex justify-between gap-2 text-[11px]">
                  <span className="font-semibold">{a.marca}</span>
                  <span className="text-muted-foreground">{a.format}</span>
                </div>
                {a.title && <div className="text-xs font-semibold leading-snug">{a.title}</div>}
                <div className="line-clamp-4 text-xs leading-snug text-muted-foreground">{a.body || "(sin texto)"}</div>
                {engagement[a.id] && (
                  <div className="mt-0.5 flex flex-wrap gap-x-2 rounded-md bg-muted/60 px-2 py-1 text-[11px] font-medium" title={`Métricas del posteo en ${engagement[a.id]!.red === "INSTAGRAM" ? "Instagram" : "Facebook"} del ${fd(engagement[a.id]!.fecha)} (mismo texto que el anuncio)`}>
                    <span>♥ {k(engagement[a.id]!.likes)}</span><span>💬 {k(engagement[a.id]!.comentarios)}</span>{engagement[a.id]!.views > 0 && <span>▶ {k(engagement[a.id]!.views)}</span>}<span className="font-normal text-muted-foreground">posteo {engagement[a.id]!.red === "INSTAGRAM" ? "IG" : "FB"}</span>
                  </div>
                )}
                <div className="mt-0.5 text-[11px] text-muted-foreground/80">
                  Desde {fd(start(a))} · {daysSince(start(a))} días{a.platforms.length ? ` · ${a.platforms.map((p) => PLAT[p] ?? p).join(", ")}` : ""}{a.cta ? ` · ${a.cta}` : ""}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Fuente: Biblioteca de anuncios de Meta (pública), vía Apify. Muestra anuncios activos en Argentina de páginas cuyo nombre coincide con la marca; no incluye inversión ni alcance (Meta no los publica para anuncios comerciales). Me gusta y comentarios: solo de los avisos que coinciden con un posteo orgánico de la marca.</p>
    </div>
  );
}
