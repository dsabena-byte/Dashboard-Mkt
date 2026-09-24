import Link from "next/link";
import { PlanMediosSubnav } from "@/components/pauta/plan-medios-subnav";
import { Simulador } from "@/components/simulador/simulador";
import { getSimuladorData } from "@/lib/simulador-server";

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
      <PlanMediosSubnav current="/performance/simulador" />
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Plan de Medios</h2>
        <p className="text-sm text-muted-foreground">
          Mové el presupuesto mensual entre medios y mirá qué pasa con los resultados. Las curvas salen de la propia pauta: cada peso extra rinde un poco menos que el anterior.
        </p>
      </header>
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
