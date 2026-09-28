import { getMercadoSeries, getMercadoMetas } from "@/lib/mercado-kpis-server";
import { MERCADO_KPIS, MERCADO_PLAN, lastIdx, metaYtd, realYtd } from "@/lib/mercado-kpis";
import { MetaKpiCard } from "@/components/metas/meta-kpi-card";
import { MetaPanel } from "@/components/metas/meta-panel";
import { MetaEvolChart, type MetaEvolDatum } from "@/components/pauta/meta-evol-chart";

// "Tus KPIs de mercado vs meta" (plan del Mapa "Mercado y competencia"), arriba de todo
// en /seo-search. Checklist de metas: getMetaKpi server-side (vía getMercadoMetas) →
// MetaKpiCard (headline = último mes con dato, filas Mes + Acum. YTD con semáforo) y, APARTE, la
// grilla "Evolución mensual · real vs meta" (MetaEvolChart, mismo sistema que Plan de Medios: año
// completo, real azul vs meta gris pizarra) → MetaPanel colapsable (router.refresh al guardar).
// Estructura estándar de todos los tableros (pedido del user sep-2026): cards por un lado, gráficos por otro. Server component: el real sale de las MISMAS series que el
// Seguimiento (lib/mercado-kpis), así lo que ve el usuario acá = lo que suma al Mapa.

const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const CAT_SHORT: Record<string, string> = { Lavado: "Lav", "Refrigeración": "Refri", "Cocción": "Cocc" };

export async function MercadoMetasSection() {
  const anio = new Date().getFullYear();
  const [res, metas] = await Promise.all([getMercadoSeries(anio).catch(() => null), getMercadoMetas(anio)]);
  if (!res) return null;

  const now = new Date();
  const mesCerrado = Math.max(1, now.getMonth()); // 1-12: último mes cerrado (para el semáforo del panel)
  const fmtU = (v: number | null, u: "%" | "pts") => (v == null ? "—" : u === "%" ? `${v.toFixed(1)}%` : v.toFixed(1));

  const cards = MERCADO_KPIS.map((spec) => {
    const s = res.series[spec.key]!;
    const m = metas[spec.key]!;
    const ref = lastIdx(s.realM);
    const nReal = s.realM.filter((v) => v != null).length;
    // Año completo (Ene–Dic), como los gráficos de Plan de Medios.
    const data: MetaEvolDatum[] = MES.map((mes, i) => ({ mes, real: s.realM[i] ?? null, meta: m.valores[i] ?? null }));
    const catLine = s.realCatM && ref >= 0
      ? Object.entries(s.realCatM).map(([c, arr]) => `${CAT_SHORT[c] ?? c} ${fmtU(arr[ref] ?? null, spec.unidad)}`).join(" · ")
      : null;
    return { spec, s, m, ref, nReal, data, catLine };
  });

  return (
    <section id="metas-mercado" className="space-y-3 scroll-mt-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Tus KPIs de mercado vs meta</h2>
        <p className="text-xs text-muted-foreground">
          Real (azul) vs meta (gris) de los KPIs del plan <strong>{MERCADO_PLAN}</strong> del Mapa Estratégico — son los mismos
          valores que suma el Seguimiento. Share of Search y de engagement son mensuales (meses cerrados); Visibilidad en IA y el
          índice de posición son la foto del relevamiento de cada mes. El índice es <strong>mejor cuanto más bajo</strong>.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ spec, s, m, ref }) => (
          <MetaKpiCard
            key={spec.key}
            title={spec.label}
            medida={spec.medida}
            headlineActual={ref >= 0 ? s.realM[ref]! : null}
            headlineLabel={ref >= 0 ? `${MES[ref]} ${String(anio).slice(2)}` : "sin dato"}
            unidad={spec.unidad}
            direccion={m.direccion}
            umbralVerde={m.umbralVerde}
            umbralAmarillo={m.umbralAmarillo}
            rows={[
              { label: ref >= 0 ? `Mes ${MES[ref]}` : "Mes", actual: ref >= 0 ? s.realM[ref]! : null, meta: ref >= 0 ? (m.valores[ref] ?? null) : null },
              { label: "Acum. YTD", actual: realYtd(s, ref), meta: metaYtd(m.valores, ref) },
            ]}
          />
        ))}
      </div>

      <div className="pt-2">
        <h3 className="text-sm font-semibold tracking-tight">Evolución mensual · real vs meta</h3>
        <p className="text-[10px] text-muted-foreground">
          Año completo {anio}. Real en azul, meta en gris pizarra. Cargá las metas en el configurador de abajo.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map(({ spec, s, m, ref, nReal, data, catLine }) => (
          <div key={spec.key} className="rounded-lg border bg-background p-4">
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{spec.label} &mdash; real vs meta</h4>
            {/* Con < 2 meses de dato y sin metas no hay evolución que mostrar: se explica en vez de dibujar una barra suelta. */}
            {nReal >= 2 || m.valores.some((v) => v != null) ? (
              <MetaEvolChart data={data} mode="bar" unidad={spec.unidad === "%" ? "%" : "x"} realName={spec.label} metaName={`Meta ${spec.label.toLowerCase()}`} />
            ) : (
              <p className="flex min-h-[120px] items-center justify-center text-center text-xs text-muted-foreground">
                {ref >= 0
                  ? `Todavía hay un solo relevamiento (${MES[ref]}): la evolución mes a mes se arma con cada nueva corrida.`
                  : "Todavía no hay datos para este KPI."}
              </p>
            )}
            <div className="mt-2 space-y-0.5 text-[10px] leading-snug text-muted-foreground/80">
              {catLine && <div>Por categoría ({MES[ref]}): {catLine}</div>}
              <div>Fuente: {s.fuente}</div>
              {s.nota && <div className={spec.key === "Visibilidad en IA" ? "text-amber-700" : undefined}>{s.nota}</div>}
            </div>
          </div>
        ))}
      </div>

      <MetaPanel
        plan={MERCADO_PLAN}
        titulo="Configuración de metas — Mercado y competencia"
        subtitulo={`Metas mensuales de los KPIs de mercado (total Drean). El semáforo del panel compara el real de ${MES[mesCerrado - 1]} vs su meta. Índice de posición SEO: dirección "menor es mejor".`}
        mes={mesCerrado}
        kpis={cards.map(({ spec, s }) => ({
          nombre: spec.key,
          unidad: spec.unidad === "%" ? "%" : undefined,
          direccion: spec.direccion,
          actual: s.realM[mesCerrado - 1] ?? null,
        }))}
      />
    </section>
  );
}
