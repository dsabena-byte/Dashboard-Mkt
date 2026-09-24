import type { ShareEngagement as SoeData } from "@/lib/signals/model";

// "Share of engagement": qué parte de las interacciones (likes + comentarios) del set
// competitivo se lleva Drean, en la VENTANA COMÚN que todas las marcas tienen completa.
// Mismo cálculo que el KPI "Share of engagement" del plan "Mercado y competencia" (Mapa /
// Seguimiento / metas en /seo-search) y que la señal cruce_soe_*: lib/mercado-kpis →
// shareOfEngagement (lib/signals/model). Server component sin estado: barras por marca
// (Drean en azul, competencia en gris pizarra) + evolución mensual.
// Usa el AÑO completo y todas las redes/marcas (no depende de los filtros del tablero).

const DATA = "#1e40af";
const SLATE = "#cbd5e1";
const nf = (v: number, d = 0) => v.toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d });
const fN = (v: number) => (v >= 1e6 ? `${nf(v / 1e6, 1)}M` : v >= 1e4 ? `${nf(v / 1e3, 1)}K` : nf(v));
const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const mesLbl = (ym: string) => `${MES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const fecha = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const RED: Record<string, string> = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook", TIKTOK: "TikTok" };

export function ShareEngagementSection({ soe, shareSearch }: { soe: SoeData | null; shareSearch?: { mes: string; share: number } | null }) {
  if (!soe) return null;
  const max = Math.max(...soe.porMarca.map((b) => b.share), 1);
  const fair = 100 / soe.porMarca.length;
  const mx = Math.max(...soe.mensual.map((x) => x.share), 1);
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Share of engagement</h3>
          <p className="text-xs text-muted-foreground">
            Parte de las interacciones (likes + comentarios) del set competitivo que se lleva Drean · {soe.redes.map((r) => RED[r] ?? r).join(" + ")} ·{" "}
            {fecha(soe.desde)} → {fecha(soe.hasta)} ({soe.dias} días que todas las marcas tienen completos). Año completo, no depende de los filtros.
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold tracking-tight tabular-nums" style={{ color: DATA }}>{nf(soe.sharePropio, 1)}%</div>
          <div className="text-[11px] text-muted-foreground">share Drean · reparto parejo {nf(fair, 0)}%</div>
        </div>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-2.5">
          {soe.porMarca.map((b) => (
            <div key={b.marca}>
              <div className="mb-0.5 flex justify-between gap-2 text-xs">
                <span className="font-semibold">
                  {b.marca}{b.propia ? " (Drean)" : ""}{" "}
                  <span className="font-normal text-muted-foreground">· {b.posts} posts · {fN(b.porPost)} por post</span>
                </span>
                <span className="font-semibold tabular-nums text-muted-foreground">{nf(b.share, 1)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-muted">
                <div className="h-full rounded" style={{ width: `${Math.max(2, (b.share / max) * 100)}%`, background: b.propia ? DATA : SLATE }} />
              </div>
            </div>
          ))}
        </div>
        {soe.mensual.length >= 2 ? (
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Share Drean por mes</div>
            <div className="flex h-28 items-end gap-2 border-b">
              {soe.mensual.map((m) => (
                <div key={m.mes} className="flex h-full flex-1 flex-col items-center justify-end" title={`${mesLbl(m.mes)}: ${nf(m.propio)} de ${nf(m.total)} interacciones`}>
                  <span className="mb-0.5 text-[10px] font-semibold tabular-nums">{nf(m.share, 1)}%</span>
                  <div className="w-[70%] max-w-[34px] rounded-t" style={{ height: `${Math.max(3, (m.share / mx) * 85)}%`, background: DATA }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-2">{soe.mensual.map((m) => <span key={m.mes} className="flex-1 text-center text-[10px] text-muted-foreground">{mesLbl(m.mes)}</span>)}</div>
          </div>
        ) : (
          <p className="self-center text-xs text-muted-foreground">La evolución mensual aparece cuando haya al menos dos meses comparables.</p>
        )}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        {shareSearch ? <>Share of Search de Drean ({mesLbl(shareSearch.mes)}): <b className="text-foreground">{nf(shareSearch.share, 1)}%</b>. </> : null}
        Cómo leerlo: si el share of engagement es menor que el share of search, la marca tiene demanda pero la conversación en redes la capitaliza la
        competencia; si es mayor, el engagement no se está convirtiendo en búsquedas. Meta del KPI: plan “Mercado y competencia” (en /seo-search).
      </p>
    </section>
  );
}
