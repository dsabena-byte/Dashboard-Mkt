import { MapaEditor } from "@/components/mapa-estrategico/mapa-editor";

export const metadata = { title: "Mapa Estratégico" };

export default function MapaEstrategicoPage() {
  return (
    <div className="space-y-5">
      <header>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Mapa Estratégico</h2>
          <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground">Ciclo 1 · Construir</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Cómo cada Plan y sus KPIs empujan los 3 objetivos estratégicos. En el Ciclo 1 los vínculos y pesos
          son tu <b className="text-foreground">hipótesis</b> de negocio (sin datos históricos); en el Ciclo 2 se recalibran con la evidencia.
        </p>
      </header>

      <div className="flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/[0.04] px-4 py-3">
        <span className="text-base leading-tight">🧭</span>
        <p className="text-[12.5px] text-muted-foreground">
          <b className="text-foreground">Está pre-conectado con una hipótesis inicial.</b> Corregí lo que no te cierre:
          mové los sliders de contribución, sacá o agregá vínculos, renombrá KPIs y planes. Tus cambios se guardan
          en este navegador. Cuando el mapa te represente, sumamos las metas por KPI y lo conectamos a los datos reales.
        </p>
      </div>

      <MapaEditor />
    </div>
  );
}
