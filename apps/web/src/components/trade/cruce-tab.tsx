import { getTrPrecalc } from "@/lib/trade-db";
import type { CruceTrade } from "@/lib/trade-cruce";
import { CruceTradeView } from "./cruce-view";

// Pestaña "CB × Floor Share": lee el cruce precalculado (se recalcula en cada carga de CB/FS). Una fila.
export async function TradeCruceTab() {
  const cruce = await getTrPrecalc<CruceTrade & { calculado?: string }>("cruce");
  if (!cruce) {
    return (
      <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
        El cruce todavía no está calculado: aparece cuando los datos de Trade viven en el tablero (migración de los
        datos o la primera carga desde “Cargar datos”).
      </div>
    );
  }
  return (
    <section className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Cómo cerrar el Cuadro Básico en cada tienda impacta el share de góndola de Drean. Estado actual = el último relevamiento
        de cada tienda.{" "}
        {cruce.calculado && <>Calculado el {new Date(cruce.calculado).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}.</>}
      </p>
      <CruceTradeView analisis={cruce} />
    </section>
  );
}
