import { Fragment } from "react";
import Link from "next/link";
import {
  getOrganicPilarMix,
  getPautaByCategoria,
  getWebByCategoria,
  getInfluenciaTotals,
  getCanalTotals,
  getMercadoByCategoria,
  buildBrandModel,
} from "@/lib/brand-build-queries";
import { getFloorShareU4M } from "@/lib/floor-share-queries";
import { getCbU3M } from "@/lib/cb-queries";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Cada tab muestra una sola columna del modelo (índice de la celda).
const TABS = [
  { key: "lavado", label: "Lavado", idx: 0 },
  { key: "refrigeracion", label: "Refrigeración", idx: 1 },
  { key: "coccion", label: "Cocción", idx: 2 },
  { key: "marca", label: "Marca", idx: 3 },
] as const;

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export default async function SaludMarcaPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const [floorShare, cb, brandMix, pautaByCat] = await Promise.all([
    safe(getFloorShareU4M(), null as Awaited<ReturnType<typeof getFloorShareU4M>> | null),
    safe(getCbU3M(), null as Awaited<ReturnType<typeof getCbU3M>> | null),
    safe(getOrganicPilarMix(), null),
    safe(getPautaByCategoria(), null),
  ]);
  const [webByCat, influencia, canal, mercado] = await Promise.all([
    safe(getWebByCategoria(), null),
    safe(getInfluenciaTotals(), null),
    safe(getCanalTotals(), null),
    safe(getMercadoByCategoria(), null),
  ]);
  const brandModel = buildBrandModel(pautaByCat, brandMix, floorShare, cb, webByCat, influencia, canal, mercado);

  const tab = TABS.find((t) => t.key === searchParams?.tab) ?? TABS[0];
  const esMarca = tab.key === "marca";

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Salud de Marca</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          El resultado se mide con la investigación de fin de año. Mientras tanto seguimos los indicadores proyectivos
          (leading) que la construyen, mapeados a cada dimensión de marca a lo largo del funnel: <b>Saliencia</b> →{" "}
          <b>Poder de marca</b> → <b>Intención de compra</b>. Conectan <b>Comunicación</b> (medios + contenido),{" "}
          <b>Tienda</b> (Floor Share + CB) y <b>Mercado</b> (market share + índice de precio).
        </p>
      </header>

      {/* Tabs: una categoría a la vez, más Marca (Drean general) */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/salud-marca?tab=${t.key}`}
            scroll={false}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              t.key === tab.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-bold tracking-tight">
            {esMarca ? "Marca — Drean general" : tab.label}
            {esMarca && (
              <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                ponderado por categoría (Lavado 60 / Refrigeración 30 / Cocción 10)
              </span>
            )}
          </h3>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full table-fixed text-xs">
            <colgroup>
              <col className="w-[72%]" />
              <col className="w-[28%]" />
            </colgroup>
            <thead>
              <tr className="border-b text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2 text-left">Dimensión / Indicador</th>
                <th className="px-2 py-2 text-right">{tab.label}</th>
              </tr>
            </thead>
            <tbody>
              {brandModel.map((comp) => (
                <Fragment key={comp.title}>
                  <tr>
                    <td colSpan={2} className="px-2 pb-1 pt-4">
                      <span className="text-[13px] font-bold uppercase tracking-wide text-primary">{comp.title}</span>
                      <span className="ml-2 text-[10px] font-normal normal-case text-muted-foreground">{comp.subtitle}</span>
                    </td>
                  </tr>
                  {comp.rows.map((r) => (
                    <tr key={r.label} className="border-t">
                      <td className="px-2 py-1.5">
                        <span className={`mr-1.5 inline-block rounded px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${r.kind === "Mental" ? "bg-blue-50 text-blue-700" : r.kind === "Físico" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                          {r.kind === "Mental" ? "Comunicación" : r.kind === "Físico" ? "Tienda" : "Mercado"}
                        </span>
                        <span className="text-foreground">{r.label}</span>
                      </td>
                      <td className="border-l px-2 py-1.5 text-right font-semibold tabular-nums text-foreground">
                        {r.cells[tab.idx]?.display ?? "—"}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Indicadores proyectivos (leading) por dimensión de marca. No reemplazan la investigación de fin de año:
            muestran cómo venimos construyendo el resultado.
          </p>
        </div>
      </section>
    </div>
  );
}
