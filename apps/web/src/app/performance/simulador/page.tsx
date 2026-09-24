import Link from "next/link";
import { PlanMediosSubnav } from "@/components/pauta/plan-medios-subnav";
import { Simulador } from "@/components/simulador/simulador";
import { getSimuladorData } from "@/lib/simulador-server";
import { ComoFunciona } from "@/components/knowledge/como-funciona";

// Simulador de presupuesto (portado de BIP, sep-2026): curvas de respuesta por medio desde el Plan de
// Medios (mismo modelo por medio que el Tablero: buildPautaMediosMensual) → sliders por medio,
// proyección de impresiones / alcance / clicks y "Optimizar automáticamente". Matemática pura en
// lib/simulador.ts. + Proyección de demanda de la categoría (búsquedas genéricas).
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function SimuladorPage() {
  const { model, demanda } = await getSimuladorData();
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Plan de Medios</h2>
        <p className="text-sm text-muted-foreground">
          Mové el presupuesto mensual entre medios y mirá qué pasa con los resultados. Las curvas salen de la propia pauta: cada peso extra rinde un poco menos que el anterior.
        </p>
      </header>
      <ComoFunciona
        titulo="Cómo funciona el Simulador de presupuesto"
        defaultOpen
        items={[
          { titulo: "Para qué sirve", texto: <>Probar cómo repartir el presupuesto mensual entre medios <b>antes</b> de ejecutarlo: cuántas impresiones, alcance y clicks te daría cada reparto.</> },
          { titulo: "De dónde salen los números", texto: <>De la pauta real de los meses cerrados del Tablero (Meta, DV360 y Google Ads por API; TikTok, Mercado Ads, Geo y offline de OMD). Para cada medio se arma una curva inversión → resultado con su propia historia, calibrada al promedio de los últimos 3 meses.</> },
          { titulo: "Rendimientos decrecientes", texto: <>Cada peso extra en un medio rinde un poco menos que el anterior (la curva se aplana). Por eso subir mucho un solo medio no multiplica los resultados en la misma proporción. En el gráfico &ldquo;Curva&rdquo; ves dónde estás hoy y dónde queda lo simulado.</> },
          { titulo: "Cómo usarlo", texto: <>1) Mové la inversión de cada medio con el control o escribí mín./máx. 2) Mirá el cambio vs hoy en las cards de arriba. 3) Elegí &ldquo;Optimizar para&rdquo; (impresiones, alcance o clicks) y tocá <b>Optimizar automáticamente</b>: reparte el mismo total hacia donde el próximo peso rinde más, dentro del mín./máx. de cada medio (por defecto 50% y 200% de lo de hoy; los podés cambiar). <b>Volver a hoy</b> deshace todo.</> },
          { titulo: "Qué tener en cuenta", texto: <>Es una estimación, no una promesa: los medios con pocos meses de datos usan una eficiencia promedio. TV, OOH, DOOH y radio solo proyectan contactos. El alcance es la suma por medio (no descuenta a la gente que ve varios medios).</> },
          { titulo: "Demanda de la categoría", texto: <>Al final, la proyección de búsquedas genéricas de cada categoría (Google) para anticipar los meses de mayor demanda y concentrar la pauta ahí.</> },
        ]}
      />
      <PlanMediosSubnav current="/performance/simulador" />
      {model.channels.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-sm">
          <div className="font-semibold">Todavía no hay pauta para simular.</div>
          <p className="mt-1 text-muted-foreground">
            El simulador se arma con los meses cerrados del <Link href="/performance" className="font-semibold" style={{ color: "#1e40af" }}>Tablero</Link> (Meta, DV360, Google Ads y la carga de OMD). Con un par de meses de datos por medio se arma solo.
          </p>
        </div>
      ) : (
        <Simulador model={model} demanda={demanda} />
      )}
    </div>
  );
}
