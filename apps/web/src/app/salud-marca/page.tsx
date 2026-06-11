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
import { getPosicionamiento, type PosBrand } from "@/lib/salud-marca-queries";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const TABS = [
  { key: "lavado", label: "Lavado", idx: 0 },
  { key: "refrigeracion", label: "Refrigeración", idx: 1 },
  { key: "coccion", label: "Cocción", idx: 2 },
  { key: "marca", label: "Marca", idx: 3 },
] as const;

// ===== Vista comparativa (posicionamiento vs competencia) =====
// Marcas core de Lavado (Drean + competencia). 5ta = LG (mayor value share).
const LAVADO_BRANDS = ["Drean", "Samsung", "Whirlpool", "Philco", "LG"];
const HIGHLIGHT = "Drean";

const pct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
const idx = (v: number | null) => (v == null ? "—" : `${Math.round(v)}`);

type PosKind = "Mercado" | "Tienda";
interface PosRow {
  label: string;
  kind: PosKind;
  get: (p: PosBrand) => number | null;
  fmt: (v: number | null) => string;
}
const POS_DIMS: Array<{ title: string; subtitle: string; rows: PosRow[] }> = [
  {
    title: "TOM / SOM · Saliencia",
    subtitle: "Presencia en góndola y en los segmentos de volumen",
    rows: [
      { label: "Floor Share %", kind: "Tienda", get: (p) => p.floor, fmt: pct },
      { label: "Share Value · Mid %", kind: "Mercado", get: (p) => p.vs.Mid, fmt: pct },
      { label: "Share Value · Low %", kind: "Mercado", get: (p) => p.vs.Low, fmt: pct },
    ],
  },
  {
    title: "Poder de marca",
    subtitle: "Diferenciación: gama alta y premium de precio",
    rows: [
      { label: "Share Value · High %", kind: "Mercado", get: (p) => p.vs.High, fmt: pct },
      { label: "Índice de precio · High", kind: "Mercado", get: (p) => p.ip.High, fmt: idx },
      { label: "Índice de precio · Mid", kind: "Mercado", get: (p) => p.ip.Mid, fmt: idx },
      { label: "Índice de precio · Low", kind: "Mercado", get: (p) => p.ip.Low, fmt: idx },
    ],
  },
];

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export default async function SaludMarcaPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const tab = TABS.find((t) => t.key === searchParams?.tab) ?? TABS[0];

  // ===== Lavado: vista comparativa por marca (nuevo diseño) =====
  if (tab.key === "lavado") {
    const pos = await safe(getPosicionamiento("Lavado", LAVADO_BRANDS), { mesMercado: null, rows: [] });
    return (
      <div className="space-y-5">
        <Header tab={tab} />
        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-bold tracking-tight">Lavado — posicionamiento vs competencia</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Indicadores con data comparativa (GFK + Floor Share). Mercado: último mes mensual
              {pos.mesMercado ? ` (${pos.mesMercado.slice(0, 7)})` : ""}. Floor Share: total Lavado, últimas semanas.
            </p>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col className="w-[32%]" />
                {LAVADO_BRANDS.map((b) => (
                  <col key={b} className="w-[13.6%]" />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2 text-left">Dimensión / Indicador</th>
                  {LAVADO_BRANDS.map((b) => (
                    <th key={b} className={`px-2 py-2 text-right ${b === HIGHLIGHT ? "border-l text-primary" : ""}`}>
                      {b}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {POS_DIMS.map((dim) => (
                  <Fragment key={dim.title}>
                    <tr>
                      <td colSpan={1 + LAVADO_BRANDS.length} className="px-2 pb-1 pt-4">
                        <span className="text-[13px] font-bold uppercase tracking-wide text-primary">{dim.title}</span>
                        <span className="ml-2 text-[10px] font-normal normal-case text-muted-foreground">{dim.subtitle}</span>
                      </td>
                    </tr>
                    {dim.rows.map((r) => (
                      <tr key={r.label} className="border-t">
                        <td className="px-2 py-1.5">
                          <span className={`mr-1.5 inline-block rounded px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${r.kind === "Tienda" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                            {r.kind}
                          </span>
                          <span className="text-foreground">{r.label}</span>
                        </td>
                        {pos.rows.map((p) => (
                          <td
                            key={p.marca}
                            className={`px-2 py-1.5 text-right tabular-nums ${p.marca === HIGHLIGHT ? "border-l font-semibold text-foreground" : "text-foreground/90"}`}
                          >
                            {r.fmt(r.get(p))}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Posicionamiento competitivo: solo indicadores donde hay data vs competencia (mercado GFK + floor share).
              Los indicadores de comunicación (solo Drean) y % CB se siguen en sus dashboards propios.
            </p>
          </div>
        </section>
      </div>
    );
  }

  // ===== Resto de categorías + Marca: modelo de construcción (sin cambios) =====
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
  const esMarca = tab.key === "marca";

  return (
    <div className="space-y-5">
      <Header tab={tab} />
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
        </div>
      </section>
    </div>
  );
}

function Header({ tab }: { tab: (typeof TABS)[number] }) {
  return (
    <>
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Salud de Marca</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          El resultado se mide con la investigación de fin de año. Mientras tanto seguimos los indicadores que la
          construyen, mapeados a las dimensiones de marca a lo largo del funnel: <b>Saliencia</b> → <b>Poder de marca</b>{" "}
          → <b>Intención de compra</b>.
        </p>
      </header>
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
    </>
  );
}
