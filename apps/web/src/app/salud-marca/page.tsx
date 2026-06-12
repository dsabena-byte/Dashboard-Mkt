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
import { getPosicionamiento, getDreanSerie, type PosBrand, type DreanMesSeg } from "@/lib/salud-marca-queries";

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
      { label: "Poder de Marca (crudo = [VS High + VS Mid] × Π IP/100)", kind: "Mercado", get: (p) => p.poderHmRaw, fmt: (v) => (v == null ? "—" : v.toFixed(1)) },
      { label: "Poder de Marca (índice, líder = 100)", kind: "Mercado", get: (p) => p.poderHm, fmt: idx },
    ],
  },
];

// Salud de Marca Kantar (Drean, categoría Lavado) por ola de medición.
// Valores transcritos del tracking Kantar. Cada ola se cruza con la data de
// mercado del mes correspondiente (donde tenemos serie GFK).
// poder/sig/dif/sal = hélice Kantar de Drean (Poder de Marca y sus 3 componentes:
// Significancia 40% · Diferenciación 30% · Saliencia 30%, en índice base 100).
// "2024" del tracking = Nov 2024 (ola nov-24); "2025" = Nov 2025 (ola nov-25).
const WAVES = [
  { label: "nov-23", mes: "2023-11-01", tom: 54, som: 80, int: 34, poder: 18.4, salud: null, sig: 138, dif: 109, sal: 262 },
  { label: "jun-24", mes: "2024-06-01", tom: 53, som: 77, int: 43, poder: 19.9, salud: 48.2, sig: 151, dif: 107, sal: 251 },
  { label: "nov-24", mes: "2024-11-01", tom: 44, som: 74, int: 40, poder: 19.2, salud: 44.3, sig: 147, dif: 115, sal: 232 },
  { label: "jun-25", mes: "2025-06-01", tom: 45, som: 74, int: 38, poder: 19.6, salud: 44.2, sig: 143, dif: 107, sal: 246 },
  { label: "nov-25", mes: "2025-11-01", tom: 40.1, som: 69.1, int: 40, poder: 17.4, salud: 41.7, sig: 127, dif: 106, sal: 237 },
  // Ola futura a estimar — sin datos todavía.
  { label: "nov-26", mes: "2026-11-01", tom: null, som: null, int: null, poder: null, salud: null, sig: null, dif: null, sal: null },
] as const;
type Wave = (typeof WAVES)[number];

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export default async function SaludMarcaPage({ searchParams }: { searchParams?: { tab?: string; view?: string } }) {
  const tab = TABS.find((t) => t.key === searchParams?.tab) ?? TABS[0];

  // ===== Lavado: dos sub-vistas (Evolución vs Mercado en el tiempo / Competencia) =====
  if (tab.key === "lavado") {
    const view = searchParams?.view === "competencia" ? "competencia" : "evolucion";
    const subtabs: Array<[string, string]> = [
      ["evolucion", "Evolución · Salud de Marca vs Mercado"],
      ["competencia", "Competencia"],
    ];
    return (
      <div className="space-y-5">
        <Header tab={tab} />
        <div className="flex flex-wrap gap-2">
          {subtabs.map(([k, l]) => (
            <Link
              key={k}
              href={`/salud-marca?tab=lavado&view=${k}`}
              scroll={false}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                view === k ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {l}
            </Link>
          ))}
        </div>
        {view === "competencia" ? (
          <CompetenciaView pos={await safe(getPosicionamiento("Lavado", LAVADO_BRANDS), { mesMercado: null, rows: [] })} />
        ) : (
          <EvolucionView
            serie={await safe(getDreanSerie("Lavado"), new Map<string, DreanMesSeg>())}
            serieU12={await safe(getDreanSerie("Lavado", "MAT"), new Map<string, DreanMesSeg>())}
          />
        )}
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

// Vista competitiva por marca (preservada).
function CompetenciaView({ pos }: { pos: { mesMercado: string | null; rows: PosBrand[] } }) {
  return (
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
                      <td key={p.marca} className={`px-2 py-1.5 text-right tabular-nums ${p.marca === HIGHLIGHT ? "border-l font-semibold text-foreground" : "text-foreground/90"}`}>
                        {r.fmt(r.get(p))}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Vista evolución: Salud de Marca Kantar (Drean Lavado) vs variables de mercado,
// por ola de medición (columnas = momentos). Sirve para ver qué variable de
// mercado se mueve junto a cada indicador de salud de marca.
// Para cada posición, el último valor no nulo ANTERIOR (para comparar contra la
// medición previa, salteando olas sin dato).
function prevAvail(values: (number | null)[]): (number | null)[] {
  const out: (number | null)[] = [];
  let last: number | null = null;
  for (const v of values) {
    out.push(last);
    if (v != null) last = v;
  }
  return out;
}

// Desvío de una medición vs la anterior: flechita con color (▲ verde creció /
// ▼ rojo bajó / ▬ gris se mantuvo) + % de cambio. Va debajo de cada valor.
function Delta({ curr, prev }: { curr: number | null; prev: number | null }) {
  if (curr == null || prev == null) return null;
  const delta = curr - prev;
  const dir = delta === 0 ? "flat" : delta > 0 ? "up" : "down";
  const icon = dir === "up" ? "▲" : dir === "down" ? "▼" : "▬";
  const color = dir === "up" ? "text-emerald-600" : dir === "down" ? "text-red-600" : "text-muted-foreground";
  const pct = prev !== 0 ? (delta / prev) * 100 : null;
  const label = pct == null ? (delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)) : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
  return <span className={`ml-1 text-[9px] ${color}`}>{icon}{label}</span>;
}

function EvolucionView({ serie, serieU12 }: { serie: Map<string, DreanMesSeg>; serieU12: Map<string, DreanMesSeg> }) {
  const p1 = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
  const i0 = (v: number | null) => (v == null ? "—" : `${Math.round(v)}`);

  // Filas Kantar. Las de funnel/poder/salud van en %; los componentes de la hélice
  // (Significancia/Diferenciación/Saliencia) van como índice (base 100, sin %).
  const kPct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
  const kIdx = (v: number | null) => (v == null ? "—" : `${Math.round(v)}`);
  const kantar: Array<{ label: string; get: (w: Wave) => number | null; fmt: (v: number | null) => string; bold?: boolean }> = [
    { label: "Top of Mind", get: (w) => w.tom, fmt: kPct },
    { label: "Share of Mind", get: (w) => w.som, fmt: kPct },
    { label: "Intención de compra", get: (w) => w.int, fmt: kPct },
    { label: "Poder de Marca", get: (w) => w.poder, fmt: kPct },
    // Componentes de la hélice de Poder de Marca (Drean, índice base 100).
    { label: "· Significancia (índice)", get: (w) => w.sig, fmt: kIdx },
    { label: "· Diferenciación (índice)", get: (w) => w.dif, fmt: kIdx },
    { label: "· Saliencia (índice)", get: (w) => w.sal, fmt: kIdx },
    { label: "Salud de Marca", get: (w) => w.salud, fmt: kPct, bold: true },
  ];
  type MRow = { label: string; get: (s?: DreanMesSeg) => number | null; fmt: (v: number | null) => string };
  const mkt: MRow[] = [
    { label: "Value share · High %", get: (s) => s?.vs.High ?? null, fmt: p1 },
    { label: "Value share · Mid %", get: (s) => s?.vs.Mid ?? null, fmt: p1 },
    { label: "Value share · Low %", get: (s) => s?.vs.Low ?? null, fmt: p1 },
    { label: "Value share · Total %", get: (s) => s?.vsTotal ?? null, fmt: p1 },
    { label: "Unit share · High %", get: (s) => s?.us.High ?? null, fmt: p1 },
    { label: "Unit share · Mid %", get: (s) => s?.us.Mid ?? null, fmt: p1 },
    { label: "Unit share · Low %", get: (s) => s?.us.Low ?? null, fmt: p1 },
    { label: "Unit share · Total %", get: (s) => s?.usTotal ?? null, fmt: p1 },
    { label: "Índice de precio · High", get: (s) => s?.ip.High ?? null, fmt: i0 },
    { label: "Índice de precio · Mid", get: (s) => s?.ip.Mid ?? null, fmt: i0 },
    { label: "Índice de precio · Low", get: (s) => s?.ip.Low ?? null, fmt: i0 },
  ];

  // Bloque de mercado standalone y COLAPSABLE de forma independiente (<details>).
  // Tocando el título se contrae/expande. Se usa para mensual y U12 (MAT).
  const mercadoTable = (s: Map<string, DreanMesSeg>, title: string, subtitle: string) => (
    <details open className="overflow-hidden rounded-xl border bg-card">
      <summary className="cursor-pointer select-none px-4 py-3 marker:text-muted-foreground">
        <span className="text-sm font-bold tracking-tight">{title}</span>
        <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{subtitle}</span>
      </summary>
      <div className="overflow-x-auto border-t p-4">
        <table className="w-full table-fixed text-xs">
          <colgroup>
            <col className="w-[22%]" />
            {WAVES.map((w) => (
              <col key={w.label} className="w-[13%]" />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-2 text-left">Indicador</th>
              {WAVES.map((w) => (
                <th key={w.label} className="px-2 py-2 text-right">{w.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mkt.map((r) => {
              const vals = WAVES.map((w) => r.get(s.get(w.mes)));
              const prevs = prevAvail(vals);
              return (
                <tr key={r.label} className="border-t">
                  <td className="whitespace-nowrap px-2 py-1.5 text-foreground">{r.label}</td>
                  {WAVES.map((w, i) => (
                    <td key={w.label} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-foreground/90">
                      {r.fmt(vals[i] ?? null)}
                      <Delta curr={vals[i] ?? null} prev={prevs[i] ?? null} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );

  // Bloque Kantar standalone (la parte de marca, siempre visible).
  const kantarTable = () => (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-bold tracking-tight">Lavado — Salud de Marca (Kantar)</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Drean. Columnas = olas de medición. Debajo de cada valor, el desvío vs la ola anterior.
        </p>
      </div>
      <div className="overflow-x-auto p-4">
        <table className="w-full table-fixed text-xs">
          <colgroup>
            <col className="w-[22%]" />
            {WAVES.map((w) => (
              <col key={w.label} className="w-[13%]" />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-2 text-left">Indicador</th>
              {WAVES.map((w) => (
                <th key={w.label} className="px-2 py-2 text-right">{w.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kantar.map((r) => {
              const vals = WAVES.map((w) => r.get(w));
              const prevs = prevAvail(vals);
              return (
                <tr key={r.label} className="border-t">
                  <td className={`whitespace-nowrap px-2 py-1.5 ${r.bold ? "font-bold text-foreground" : r.label.startsWith("·") ? "pl-5 text-foreground/80" : "text-foreground"}`}>{r.label}</td>
                  {WAVES.map((w, i) => (
                    <td key={w.label} className={`whitespace-nowrap px-2 py-1.5 text-right tabular-nums ${r.bold ? "font-bold" : "text-foreground/90"}`}>
                      {r.fmt(vals[i] ?? null)}
                      <Delta curr={vals[i] ?? null} prev={prevs[i] ?? null} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );

  // Tres bloques independientes: Kantar (marca, siempre visible) y dos de Mercado
  // (mensual y U12), cada uno colapsable por separado para enfocar el análisis.
  return (
    <div className="space-y-5">
      {kantarTable()}
      {mercadoTable(
        serie,
        "Lavado — Mercado · GFK (mensual)",
        "Drean. Valor del mes de cada ola. Tocá el título para contraer/expandir este bloque.",
      )}
      {mercadoTable(
        serieU12,
        "Lavado — Mercado · GFK · U12 (año móvil)",
        "Drean. MAT (acumulado móvil 12 meses) cerrando en el mes de cada ola; olas sin serie MAT quedan en “—”. Tocá el título para contraer/expandir.",
      )}
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
