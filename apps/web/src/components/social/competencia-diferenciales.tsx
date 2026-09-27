import type { PautaMarca, PautaProb } from "@/lib/redes-competencia";
import type { TemaGap, TemaStat } from "@/lib/redes-temas";

// Pauta probable + temas por marca de la competencia (server component). Paleta sobria: Drean en azul
// de datos, competencia en gris pizarra. "Probable" = modelo relativo a la propia marca, nunca un hecho.

const DATA = "#1e40af";
const SLATE = "#94a3b8";
const nf = (v: number, d = 0) => v.toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d });
const fN = (v: number) => (v >= 1e6 ? `${nf(v / 1e6, 1)}M` : v >= 1e4 ? `${nf(v / 1e3, 1)}K` : nf(v));

export interface PautaPostLite { url: string; marca: string; fecha: string | null; views: number | null; likes: number | null; comentarios: number | null; prob: PautaProb; copy: string | null }

export function CompetenciaDiferenciales({
  pauta, pautaPosts, temas, gaps, labels, ownKey, temasActivos,
}: {
  pauta: PautaMarca[];
  pautaPosts: PautaPostLite[];
  temas: { marca: string; temas: TemaStat[] }[];
  gaps: TemaGap[];
  labels: Record<string, string>;
  ownKey: string;
  temasActivos: boolean;
}) {
  const lbl = (k: string) => labels[k] ?? k;
  const maxShare = Math.max(...pauta.map((p) => p.share), 1);
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-base font-semibold tracking-tight">Pauta probable de la competencia</h3>
        <p className="text-xs text-muted-foreground">
          Posts con views ≥ 3× la mediana de su marca y red y ≤ 1/3 de su interacción por view (patrón de un posteo impulsado con pauta);
          alta = ≥ 5× y ≤ 1/5, o marcado como patrocinado por el scraper. Mínimo 8 posts con views por marca y red. Es una probabilidad.
        </p>
        {pauta.length ? (
          <div className="mt-3 flex flex-col gap-2">
            {pauta.map((p) => (
              <div key={p.marca}>
                <div className="mb-0.5 flex justify-between text-xs">
                  <span className="font-semibold">{lbl(p.marca)} <span className="font-normal text-muted-foreground">· {p.probables} de {p.posts} posts · {p.alta} alta</span></span>
                  <span className="tabular-nums text-muted-foreground">{nf(p.share, 1)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-muted">
                  <div className="h-full rounded" style={{ width: `${Math.max(2, (p.share / maxShare) * 100)}%`, background: p.marca === ownKey ? DATA : SLATE }} />
                </div>
              </div>
            ))}
          </div>
        ) : <p className="mt-3 text-xs text-muted-foreground">Sin posts con patrón de pauta en el período.</p>}
        {pautaPosts.length > 0 && (
          <div className="mt-4">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Posts más probables</div>
            <ul className="flex flex-col gap-1.5 text-[11px]">
              {pautaPosts.map((p) => (
                <li key={p.url} className="flex items-start justify-between gap-2 border-b pb-1 last:border-0">
                  <a href={p.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                    <span className="font-semibold">{lbl(p.marca)}</span> · {p.fecha?.slice(8, 10)}/{p.fecha?.slice(5, 7)} · {(p.copy ?? "(sin texto)").replace(/\s+/g, " ").slice(0, 70)}
                  </a>
                  <span className="shrink-0 tabular-nums text-muted-foreground" title={p.prob.motivo}>{fN(p.views ?? 0)} views · {p.prob.nivel}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="rounded-lg border bg-card p-4">
        <h3 className="text-base font-semibold tracking-tight">Temas por marca</h3>
        <p className="text-xs text-muted-foreground">
          Tema corto de cada post (clasificación automática diaria sobre el texto, reusando los temas ya usados). Share = % de los posts de la
          marca con tema; ER = mediana de engagement por seguidor.
        </p>
        {!temasActivos ? (
          <p className="mt-3 text-xs text-muted-foreground">Todavía no hay temas clasificados (requiere la migración 0116 y una corrida del proceso diario de competencia).</p>
        ) : (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {temas.map((m) => (
                <div key={m.marca}>
                  <div className="text-xs font-semibold" style={{ color: m.marca === ownKey ? DATA : "#0f172a" }}>{lbl(m.marca)}</div>
                  <ul className="mt-0.5 text-[11px] text-muted-foreground">
                    {m.temas.map((t) => (
                      <li key={t.tema} className="flex justify-between gap-2">
                        <span className="truncate">{t.tema}</span>
                        <span className="shrink-0 tabular-nums">{nf(t.share, 0)}%{t.er_mediana != null ? ` · ${nf(t.er_mediana, 3)}%` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            {gaps.length > 0 && (
              <div className="mt-4 rounded border-l-2 pl-3" style={{ borderColor: DATA }}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Temas que rinden en la competencia y Drean casi no usa</div>
                <ul className="mt-1 text-[11px]">
                  {gaps.slice(0, 4).map((g) => (
                    <li key={g.tema}><strong>{g.tema}</strong> · {g.posts} posts de {g.marcas.map(lbl).join(", ")} · ER {nf(g.vsMediana, 1)}× la mediana rival</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
