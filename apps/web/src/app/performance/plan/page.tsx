import Link from "next/link";
import type { Route } from "next";
import { PlanMediosSubnav } from "@/components/pauta/plan-medios-subnav";
import { ComoFunciona } from "@/components/knowledge/como-funciona";
import { PlanAnual } from "@/components/pauta/plan-anual";
import { MetaPanel } from "@/components/metas/meta-panel";
import { getInflacionMes, getPlanAnual, getRefMeses } from "@/lib/plan-medios-anual-server";
import { getMetaValoresMensuales } from "@/lib/metas-server";
import { usuarioPresupuesto } from "@/lib/presupuesto-server";
import { PLAN_META_KPIS } from "@/lib/plan-medios-anual";
import { KPIS_OTROS, type HistOtros } from "@/lib/plan-otros-kpis";
import { getHistOtros } from "@/lib/plan-otros-kpis-server";

// Plan de Medios ANUAL (oct-2026, reemplaza el Excel del BGT): se edita el plan, se recalculan la
// inversión por medio/objetivo/categoría y los impactos esperados, y con un botón se cargan como metas
// mensuales de "Pauta Mkt" (después se ajustan en el panel de metas de abajo). Cálculo puro en
// lib/plan-medios-anual.ts.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const safe = async <T,>(p: Promise<T>, fb: T): Promise<T> => { try { return await p; } catch { return fb; } };
const UNIDAD: Record<string, string> = { "Inversión": "$", "Frecuencia": "x", "VTR (≥50%)": "%" };

export default async function PlanAnualPage({ searchParams }: { searchParams?: { anio?: string } }) {
  const hoy = new Date().getFullYear();
  const pedido = Number(searchParams?.anio);
  const anio = pedido >= hoy - 1 && pedido <= hoy + 2 ? pedido : hoy + 1;
  const otrosKeys = Object.entries(KPIS_OTROS).flatMap(([p, ks]) => ks.map(([k]) => [p, k] as const));
  const vacio = (): (number | null)[] => Array.from({ length: 12 }, () => null);
  const [plan, refMeses, { infl, origen }, usuario, metasActuales, hist, metasOtros] = await Promise.all([
    getPlanAnual(anio),
    safe(getRefMeses(), []),
    getInflacionMes(),
    safe(usuarioPresupuesto(), null),
    Promise.all(PLAN_META_KPIS.map((k) => safe(getMetaValoresMensuales("Pauta Mkt", k, anio), Array.from({ length: 12 }, () => null)))),
    safe<HistOtros>(getHistOtros(anio), { anioBase: anio - 1, series: {}, seguidores: { ultimo: null, fecha: null, porMes: 0 } }),
    Promise.all(otrosKeys.map(([p, k]) => safe(getMetaValoresMensuales(p, k, anio), vacio()))),
  ]);
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Plan de Medios</h2>
        <p className="text-sm text-muted-foreground">Armá el plan del año, mirá qué compra cada peso en cada medio y usalo como metas.</p>
      </header>
      <ComoFunciona
        titulo="Cómo funciona el Plan anual"
        items={[
          { titulo: "Para qué sirve", texto: <>Reemplaza el Excel del BGT de medios: cambiás el BGT del mes, el peso de un medio, una ola o el mix por categoría y se recalcula todo (medio × mes, objetivo, categoría y medio × categoría).</> },
          { titulo: "Cómo se reparte cada medio", texto: <><b>Costo fijo</b> (OOH): el costo de enero se ajusta en abril, julio y octubre por la inflación del trimestre anterior. <b>Olas</b> (TV, radio, DOOH): un % del BGT anual repartido en los meses de la ola. <b>Curva</b> (digital): lo que queda del mes se reparte según el peso de cada medio.</> },
          { titulo: "De dónde salen los impactos", texto: <>De lo que rindió cada medio en los meses cerrados del Tablero (Meta y TikTok: los 2 últimos meses, con las piezas nuevas; el resto, todo el año). La plata del plan se lleva a pesos de esa referencia con la inflación cargada en Inversión de Marketing → Cargar datos → Inflación, (la REAL de INDEC si ya salió; si no, la del presupuesto más reciente: 8+4, 4+8 o BGT) y pasa por la curva del Simulador (cada peso extra rinde un poco menos). TV, radio y DOOH no tienen medición: suman inversión pero no impactos.</> },
          { titulo: "Metas", texto: <>Guardá el plan y tocá <b>Usar como metas</b>: carga las metas mensuales de Inversión, Alcance, Frecuencia, Impresiones, VTR y Clicks de Pauta Mkt para ese año. Después las podés ajustar a mano en el panel de abajo.</> },
          { titulo: "Metas de Web, Redes y SEO", texto: <>En la sección 6 armás el calendario de campañas de Redes (tipo × mes × intensidad) y la ambición de Web, Facebook y SEO. Instagram = un mes normal + el efecto de cada campaña (el sorteo está calibrado con Casa FOA sep-2026; el resto son supuestos editables). Web = mismo mes del año anterior + la ambición. SEO = continuidad. Cada tablero tiene su botón <b>Usar como metas</b>.</> },
          { titulo: "Quién edita", texto: <>Los editores del presupuesto (los mismos que cargan el BGT). Cada cambio queda en el Historial de Inversión de Marketing → Cargar datos.</> },
        ]}
      />
      <PlanMediosSubnav current="/performance/plan" />
      <nav className="flex gap-2 text-sm">
        {[hoy, hoy + 1].map((a) => (
          <Link key={a} href={`/performance/plan?anio=${a}` as Route} className={`rounded-md border px-3 py-1 ${a === anio ? "border-amber-500 font-semibold" : "text-muted-foreground"}`}>{a}</Link>
        ))}
      </nav>
      <PlanAnual
        key={anio}
        anio={anio}
        inicial={plan.config}
        guardado={plan.guardado}
        sinTabla={plan.sinTabla}
        refMeses={refMeses}
        infl={infl}
        inflOrigen={origen}
        editor={!!usuario?.editor}
        email={usuario?.email ?? null}
        metasActuales={Object.fromEntries(PLAN_META_KPIS.map((k, i) => [k, metasActuales[i]!]))}
        hist={hist}
        metasOtros={Object.fromEntries(otrosKeys.map(([p, k], i) => [`${p}|${k}`, metasOtros[i]!]))}
      />
      <MetaPanel
        plan="Pauta Mkt"
        anio={anio}
        titulo={`Metas de Pauta Mkt ${anio} (ajuste manual)`}
        subtitulo="Después de cargarlas desde el plan, podés cambiar cualquier mes acá."
        kpis={PLAN_META_KPIS.map((k) => ({ nombre: k, unidad: UNIDAD[k] ?? "u" }))}
      />
    </div>
  );
}
