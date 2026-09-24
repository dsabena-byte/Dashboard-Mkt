import { PlanMediosSubnav } from "@/components/pauta/plan-medios-subnav";
import { CompetenciaPauta } from "@/components/competencia-pauta/competencia-pauta";
import { getAdLibrary } from "@/lib/ad-library";
import { brandSummary } from "@/lib/ad-library-shared";

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
