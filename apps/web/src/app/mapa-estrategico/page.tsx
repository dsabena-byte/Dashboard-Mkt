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
          Definí tus objetivos estratégicos, conectá los KPIs de cada plan y ajustá cuánto aporta cada uno
          (por objetivo la suma se capa en 100%). En el Ciclo 1 los pesos son tu <b className="text-foreground">hipótesis</b> de
          negocio; en el Ciclo 2 se recalibran con la evidencia. <b className="text-foreground">Guardá</b> para que el
          tablero de Seguimiento lea el mapa.
        </p>
      </header>

      <MapaEditor />
    </div>
  );
}
