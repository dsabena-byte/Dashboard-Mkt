import { PlanMediosSubnav } from "@/components/pauta/plan-medios-subnav";
import { CompetenciaPauta } from "@/components/competencia-pauta/competencia-pauta";
import { getAdLibrary } from "@/lib/ad-library";
import { brandSummary, adLibraryBrands } from "@/lib/ad-library-shared";
import { ComoFunciona } from "@/components/knowledge/como-funciona";

// Pauta de la competencia (portado de BIP, sep-2026): anuncios activos de la competencia en la
// Biblioteca de anuncios de Meta (Facebook + Instagram, Argentina), actualizados cada lunes por el
// cron /api/cron/ad-library (Apify). El render solo lee el snapshot (una fila por marca). Fail-safe:
// sin migración / sin token / sin corrida → estado vacío que explica qué falta.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function CompetenciaPautaPage() {
  const st = await getAdLibrary();
  return (
    <div className="space-y-4">
      <PlanMediosSubnav current="/performance/competencia" />
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Plan de Medios</h2>
        <p className="text-sm text-muted-foreground">
          Anuncios activos de la competencia en Facebook e Instagram (Biblioteca de anuncios de Meta, Argentina). Se actualiza todos los lunes.
        </p>
      </header>
      <ComoFunciona
        titulo="Cómo funciona Pauta de la competencia"
        defaultOpen={st.status !== "ok"}
        items={[
          { titulo: "Qué muestra", texto: <>Los anuncios <b>activos</b> que cada marca tiene hoy en Facebook e Instagram en Argentina, tomados de la Biblioteca de anuncios de Meta (pública). Marcas: {adLibraryBrands().map((b) => b.marca).join(", ")}.</> },
          { titulo: "Cómo se actualiza", texto: <>Automáticamente todos los lunes: se busca cada marca y se guardan sus anuncios (hasta 40 por marca). Si una marca falla, se conservan sus anuncios de la semana anterior marcados como &ldquo;sin actualizar&rdquo;.</> },
          { titulo: "Qué mirar", texto: <>Cuántos anuncios activos tiene cada marca, cuáles son nuevos en la semana, qué formatos usan (video, imagen, carrusel) y cuánto tiempo llevan al aire: un aviso que sigue activo muchas semanas suele ser uno que les funciona.</> },
          { titulo: "Qué NO muestra", texto: <>Meta no publica inversión ni impresiones de los anuncios comerciales en Argentina: esto mide <b>actividad y mensajes</b> de la competencia, no cuánto gastan. Solo cubre Meta (no Google, TikTok ni offline).</> },
        ]}
      />
      {st.status !== "ok" ? (
        <div className="rounded-xl border bg-card p-6 text-sm">
          <div className="font-semibold">{st.status === "no_config" ? "Monitoreo en preparación" : "Todavía no hay anuncios para mostrar"}</div>
          <p className="mt-1 text-muted-foreground">{st.motivo}</p>
        </div>
      ) : (
        <CompetenciaPauta brands={st.data.brands} summaries={st.data.brands.map((b) => brandSummary(b))} updatedAt={st.data.updatedAt} />
      )}
    </div>
  );
}
