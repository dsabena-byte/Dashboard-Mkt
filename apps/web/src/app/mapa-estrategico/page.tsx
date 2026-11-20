import { MapaEditor } from "@/components/mapa-estrategico/mapa-editor";
import { getMapaConfig, getMetasAnio } from "@/lib/mapa-server";
import { HowToRead } from "@/components/knowledge/how-to-read";
import { MapaVisual } from "@/components/mapa-estrategico/mapa-visual";

export const metadata = { title: "Mapa Estratégico" };
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function MapaEstrategicoPage() {
  const anio = new Date().getFullYear();
  const [initial, metas] = await Promise.all([getMapaConfig(), getMetasAnio(anio)]); // config desde la DB (SSR) → sin spinner de carga
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
      <HowToRead slug="mapa-estrategico" />

      {/* Pedido del user (nov-2026, para el directorio): arriba el mapa visual, abajo el proceso 1-5; sin la validación de pesos. */}
      {initial && <MapaVisual config={initial} metas={metas} anio={anio} />}
      <MapaEditor initial={initial} />
    </div>
  );
}
