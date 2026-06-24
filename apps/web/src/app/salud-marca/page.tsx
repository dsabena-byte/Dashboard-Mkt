import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { getDreanSerie, type DreanMesSeg } from "@/lib/salud-marca-queries";
import {
  type KVals, NK,
  KANTAR_LAVADO, KANTAR_REFRI, KANTAR_COCCION,
  computeDreanConsolidado, SM_DIMS,
  type SMState,
} from "@/lib/salud-marca-model";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const TABS = [
  { key: "lavado", label: "Lavado", idx: 0 },
  { key: "refrigeracion", label: "Refrigeración", idx: 1 },
  { key: "coccion", label: "Cocción", idx: 2 },
  { key: "marca", label: "Marca", idx: 3 },
] as const;

// Salud de Marca Kantar (Drean, categoría Lavado) por ola de medición.
// Valores transcritos del tracking Kantar. Cada ola se cruza con la data de
// mercado del mes correspondiente (donde tenemos serie GFK).
// Olas de medición (metadata). Los valores Kantar por marca están en KANTAR.
// "2024" del tracking = Nov 2024 (ola nov-24); "2025" = Nov 2025 (ola nov-25).
const WAVES_LAVADO = [
  { label: "nov-23", mes: "2023-11-01" },
  { label: "jun-24", mes: "2024-06-01" },
  { label: "nov-24", mes: "2024-11-01" },
  { label: "jun-25", mes: "2025-06-01" },
  { label: "nov-25", mes: "2025-11-01" },
  { label: "nov-26", mes: "2026-11-01" }, // ola futura a estimar
] as const;
const WAVES_REFRI = [
  { label: "nov-23", mes: "2023-11-01" },
  { label: "jun-24", mes: "2024-06-01" },
  { label: "nov-24", mes: "2024-11-01" },
  { label: "jun-25", mes: "2025-06-01" },
  { label: "nov-25", mes: "2025-11-01" },
  { label: "nov-26", mes: "2026-11-01" }, // ola futura a estimar
] as const;
const WAVES_COCCION = [
  { label: "nov-23", mes: "2023-11-01" },
  { label: "jun-24", mes: "2024-06-01" },
  { label: "nov-24", mes: "2024-11-01" },
  { label: "jun-25", mes: "2025-06-01" },
  { label: "nov-25", mes: "2025-11-01" },
  { label: "nov-26", mes: "2026-11-01" },
] as const;

// Marcas con tracking Kantar disponible (selector). El nombre en mayúscula es la marca en mercado_share.
const SM_BRANDS_LAVADO = ["Drean", "Samsung", "Whirlpool", "LG", "Philco"] as const;
const SM_BRANDS_REFRI = ["Drean", "Samsung", "Gafa", "Whirlpool", "LG", "Philco"] as const;
const SM_BRANDS_COCCION = ["Drean", "Whirlpool", "Escorial", "Gafa", "Electrolux", "Longvie", "Florencia"] as const;
// Config de Salud de Marca por categoría (la vista EvolucionView es la misma).
// Las tablas Kantar y el modelo de consolidación viven en @/lib/salud-marca-model.
const SM_CAT: Record<string, {
  categoria: string; label: string; tabKey: string;
  waves: ReadonlyArray<{ label: string; mes: string }>;
  brands: readonly string[];
  kantar: Record<string, Record<string, KVals>>;
}> = {
  lavado: { categoria: "Lavado", label: "Lavado", tabKey: "lavado", waves: WAVES_LAVADO, brands: SM_BRANDS_LAVADO, kantar: KANTAR_LAVADO },
  refrigeracion: { categoria: "Refrigeración", label: "Refrigeración", tabKey: "refrigeracion", waves: WAVES_REFRI, brands: SM_BRANDS_REFRI, kantar: KANTAR_REFRI },
  coccion: { categoria: "Cocción", label: "Cocción", tabKey: "coccion", waves: WAVES_COCCION, brands: SM_BRANDS_COCCION, kantar: KANTAR_COCCION },
};

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export default async function SaludMarcaPage({ searchParams }: { searchParams?: { tab?: string; view?: string; marca?: string } }) {
  const tab = TABS.find((t) => t.key === searchParams?.tab) ?? TABS[0];

  // ===== Lavado / Refrigeración: Evolución (Salud de Marca vs Mercado) =====
  const smCfg = SM_CAT[tab.key];
  if (smCfg) {
    const marca = (smCfg.brands as readonly string[]).includes(searchParams?.marca ?? "") ? searchParams!.marca! : "Drean";
    return (
      <div className="space-y-5">
        <Header tab={tab} />
        <EvolucionView
          marca={marca}
          serieU12={await safe(getDreanSerie(smCfg.categoria, "MAT", marca.toUpperCase()), new Map<string, DreanMesSeg>())}
          waves={smCfg.waves}
          brands={smCfg.brands}
          kantarData={smCfg.kantar}
          catLabel={smCfg.label}
          tabKey={smCfg.tabKey}
        />
      </div>
    );
  }

  // ===== Tab "Marca": Salud de Marca consolidada de Drean (3 categorías + ponderación) =====
  const dreanSeries = {
    lav: await safe(getDreanSerie("Lavado", "MAT", "DREAN"), new Map<string, DreanMesSeg>()),
    ref: await safe(getDreanSerie("Refrigeración", "MAT", "DREAN"), new Map<string, DreanMesSeg>()),
    coc: await safe(getDreanSerie("Cocción", "MAT", "DREAN"), new Map<string, DreanMesSeg>()),
  };

  return (
    <div className="space-y-5">
      <Header tab={tab} />
      <DreanSaludConsolidada series={dreanSeries} />
    </div>
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

// ===== Tab "Marca": Salud de Marca consolidada de Drean por categoría =====
// SM por categoría = 0,25·(TOM+SOM+Intención+Poder). Salud de Marca global =
// Σ SM_categoría · peso_categoría (el peso es el mix de la categoría en cada ola).
// Para nov-26: se usan los valores proyectados (mismos coeficientes que EST_* de
// EvolucionView); donde no hay proyección de marca se ARRASTRA el último real
// (nov-25) y se muestra en otro color (ámbar) con su aclaración.
function DreanSaludConsolidada({ series }: { series: Record<"lav" | "ref" | "coc", Map<string, DreanMesSeg>> }) {
  // Cálculo compartido con el card Obj.4 de /overview (una sola fuente de verdad).
  const rows = computeDreanConsolidado(series); // solo olas de noviembre (anuales)
  const waves = rows.map((r) => r.w);
  const dims = SM_DIMS;
  const cls = (s: SMState) => s === "proj" ? "text-blue-600" : s === "carry" ? "text-amber-600" : "text-foreground";
  const p1 = (v: number | null) => v == null ? "—" : `${v.toFixed(1)}%`;

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-bold tracking-tight">Salud de Marca — Drean por categoría
          <span className="ml-2 text-[11px] font-normal text-muted-foreground">SM categoría = 0,25·(TOM+SOM+Intención+Poder) · Global = Σ SM·peso de categoría</span>
        </h3>
      </div>
      <div className="overflow-x-auto p-4">
        <table className="min-w-[600px] text-xs">
          <thead>
            <tr className="border-b">
              <th className="sticky left-0 z-20 bg-card px-2 py-1.5 text-left text-[10px] font-semibold uppercase text-muted-foreground" rowSpan={2}>Dimensión</th>
              {waves.map((w) => (
                <th key={w} className="border-l px-2 py-1 text-center text-[11px] font-bold" colSpan={4}>{w}</th>
              ))}
            </tr>
            <tr className="border-b text-[9px] font-semibold uppercase text-muted-foreground">
              {waves.map((w) => (
                <Fragment key={w}>
                  <th className="border-l px-2 py-1 text-center">Lav</th>
                  <th className="px-2 py-1 text-center">Refri</th>
                  <th className="px-2 py-1 text-center">Cocc</th>
                  <th className="bg-sky-50 px-2 py-1 text-center text-sky-700">SM</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {dims.map((d) => (
              <tr key={d.key} className="border-t">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-2 py-1.5 text-foreground">{d.label}</td>
                {rows.map((row) => (
                  <Fragment key={row.w}>
                    <td className={`border-l px-2 py-1.5 text-center tabular-nums ${cls(row.lav[d.key].s)}`}>{p1(row.lav[d.key].v)}</td>
                    <td className={`px-2 py-1.5 text-center tabular-nums ${cls(row.ref[d.key].s)}`}>{p1(row.ref[d.key].v)}</td>
                    <td className={`px-2 py-1.5 text-center tabular-nums ${cls(row.coc[d.key].s)}`}>{p1(row.coc[d.key].v)}</td>
                    <td className="bg-sky-50 px-2 py-1.5"></td>
                  </Fragment>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 bg-muted/40 font-bold">
              <td className="sticky left-0 z-10 whitespace-nowrap bg-muted px-2 py-1.5 text-foreground">Salud de Marca</td>
              {rows.map((row) => (
                <Fragment key={row.w}>
                  <td className={`border-l px-2 py-1.5 text-center tabular-nums ${cls(row.lav.sm.s)}`}>{p1(row.lav.sm.v)}</td>
                  <td className={`px-2 py-1.5 text-center tabular-nums ${cls(row.ref.sm.s)}`}>{p1(row.ref.sm.v)}</td>
                  <td className={`px-2 py-1.5 text-center tabular-nums ${cls(row.coc.sm.s)}`}>{p1(row.coc.sm.v)}</td>
                  <td className="bg-sky-100 px-2 py-1.5 text-center tabular-nums font-bold text-sky-800">{p1(row.comp)}</td>
                </Fragment>
              ))}
            </tr>
            <tr className="border-t text-[10px] text-muted-foreground">
              <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-2 py-1.5">Peso categoría</td>
              {rows.map((row) => (
                <Fragment key={row.w}>
                  <td className="border-l px-2 py-1.5 text-center tabular-nums">{(row.wt.lav * 100).toFixed(0)}%</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{(row.wt.ref * 100).toFixed(0)}%</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{(row.wt.coc * 100).toFixed(0)}%</td>
                  <td className="bg-sky-50 px-2 py-1.5 text-center tabular-nums">100%</td>
                </Fragment>
              ))}
            </tr>
          </tbody>
        </table>
        <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
          <p>
            <span className="font-semibold text-blue-600">Azul</span> = valor <strong>proyectado</strong> para nov-26 (modelo de mercado).{" "}
            <span className="font-semibold text-amber-600">Ámbar</span> = se <strong>arrastra el valor de nov-25</strong> porque esa
            categoría/dimensión <strong>no tiene proyección de marca</strong> (Refrigeración no se estima; Intención no acopla en ninguna
            categoría; Poder no se estima en Lavado).
          </p>
        </div>
      </div>
    </section>
  );
}

function EvolucionView({ marca, serieU12, waves, brands, kantarData, catLabel, tabKey }: {
  marca: string;
  serieU12: Map<string, DreanMesSeg>;
  waves: ReadonlyArray<{ label: string; mes: string }>;
  brands: readonly string[];
  kantarData: Record<string, Record<string, KVals>>;
  catLabel: string;
  tabKey: string;
}) {
  const kFor = (label: string): KVals => kantarData[marca]?.[label] ?? NK;
  const esDrean = marca === "Drean"; // el modelo de estimación está calibrado sobre Drean
  const esLavado = tabKey === "lavado"; // la estimación TOM/SOM solo está calibrada para Lavado
  const p1 = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
  const i0 = (v: number | null) => (v == null ? "—" : `${Math.round(v)}`);

  // Filas Kantar. Las de funnel/poder/salud van en %; los componentes de la hélice
  // (Significancia/Diferenciación/Saliencia) van como índice (base 100, sin %).
  const kPct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
  const kIdx = (v: number | null) => (v == null ? "—" : `${Math.round(v)}`);
  // Estimación baseline desde mercado, con BLEND 50/50 (metodología Kantar): la salud de
  // marca de una ola pondera 50% compradores de los últimos 12m (U12 en T) + 50% de 12-24m
  // (U12 en T-12, un año antes). Calibrado por OLS sobre las olas medidas:
  //   driver_TOM = 0,5·D(T) + 0,5·D(T-12),  D = 0,85·VS_High + 0,15·VS_Mid
  //   TOM ≈ 13,23 + 1,154·driver_TOM     (R2=0,90, LOO 2,3; 5 olas incl. nov-23)
  //   driver_SOM = 0,5·US_Total(T) + 0,5·US_Total(T-12)
  //   SOM ≈ 33,73 + 1,083·driver_SOM     (R2=0,94, LOO 1,4; 5 olas incl. nov-23)
  // Es inercia comercial; no captura medios/tienda/comunicación.
  const prev12 = (mes: string) => { const [y, m] = mes.split("-"); return `${Number(y) - 1}-${m}-01`; };
  const blend = (fn: (s?: DreanMesSeg) => number | null, serie: Map<string, DreanMesSeg>, mes: string): number | null => {
    const a = fn(serie.get(mes)), b = fn(serie.get(prev12(mes)));
    return a == null || b == null ? null : 0.5 * a + 0.5 * b;
  };
  const dTom = (s?: DreanMesSeg): number | null => {
    const H = s?.vs.High, M = s?.vs.Mid;
    return H == null || M == null ? null : 0.85 * H + 0.15 * M;
  };
  // Ecuaciones por marca: TOM ← blend(0,85·VS_High+0,15·VS_Mid); SOM ← blend(US_Total).
  // Cada marca se calibra por separado (R²/LOO sobre sus 5 olas). Solo se estima donde hay señal.
  const tomEq = (a: number, b: number) => (serie: Map<string, DreanMesSeg>, mes: string): number | null => {
    const d = blend(dTom, serie, mes);
    return d == null ? null : a + b * d;
  };
  const somEq = (a: number, b: number) => (serie: Map<string, DreanMesSeg>, mes: string): number | null => {
    const d = blend((s) => s?.usTotal ?? null, serie, mes);
    return d == null ? null : a + b * d;
  };
  // Estimación desde unit share total (blend 50/50) — driver usado en Refri.
  const usTotEq = somEq; // a + b·blend(US_Total); alias semántico (no solo SOM)
  // Driver Mid+High (unit share) — usado en Cocción: el equity se construye desde la
  // gama media/alta (el segmento Low de entrada no construye marca). D = US_Mid + US_High.
  const dMH = (s?: DreanMesSeg): number | null => {
    const M = s?.us.Mid, H = s?.us.High;
    return M == null || H == null ? null : M + H;
  };
  const mhEq = (a: number, b: number) => (serie: Map<string, DreanMesSeg>, mes: string): number | null => {
    const d = blend(dMH, serie, mes);
    return d == null ? null : a + b * d;
  };
  type EstFn = (s: Map<string, DreanMesSeg>, m: string) => number | null;
  // damp = peso del modelo vs el último valor real (inercia de marca). 1 = modelo
  // puro; 0,5 = 50% modelo + 50% último medido (amortigua extrapolación fuera de rango).
  type EstCfg = { tom?: EstFn; tomBand?: number; som?: EstFn; somBand?: number; poder?: EstFn; poderBand?: number; damp?: number; nota: ReactNode };
  const notaModelo = (
    <p>
      <strong>1. Blend 50/50 (metodología Kantar).</strong> Driver = 0,5·U12(T) + 0,5·U12(T-12, un año antes). <strong>TOM</strong> ←
      value share gama alta (0,85·VS<sub>High</sub> + 0,15·VS<sub>Mid</sub>); <strong>SOM</strong> ← unit share total. <strong>2.</strong> Es la
      <em> inercia comercial</em> (no incluye medios/tienda/comunicación). <strong>3.</strong> Cada marca se calibra por separado.
    </p>
  );
  const EST_LAVADO: Record<string, EstCfg> = {
    Drean: {
      tom: tomEq(13.23, 1.154), tomBand: 2.3, som: somEq(33.73, 1.083), somBand: 1.4,
      nota: (
        <>
          <p className="font-semibold text-foreground"><span className="text-blue-600">≈</span> Drean — se estiman TOM y SOM (marca enfocada en la categoría, fuerte relación mercado↔salud)</p>
          {notaModelo}
          <p>Ecuaciones: <strong>TOM ≈ 13,2 + 1,154·driver</strong> (R²=0,90, ±2,3) · <strong>SOM ≈ 33,7 + 1,083·driver</strong> (R²=0,94, ±1,4). Intención y Poder no se estiman.</p>
        </>
      ),
    },
    Samsung: {
      som: somEq(8.82, 3.405), somBand: 1.4,
      nota: (
        <>
          <p className="font-semibold text-foreground"><span className="text-blue-600">≈</span> Samsung — solo se estima SOM</p>
          <p><strong>SOM ≈ 8,8 + 3,41·driver</strong> (R²=0,88): su share of mind en lavado sigue su volumen (US Total).</p>
          <p><strong>TOM no se estima</strong>: su notoriedad no depende del share en lavado (marca multicategoría; R²=0,16, pendiente negativa) → se mantiene en su nivel real.</p>
        </>
      ),
    },
    Philco: {
      tom: tomEq(1.2, 0.33), tomBand: 0.6,
      nota: (
        <>
          <p className="font-semibold text-foreground"><span className="text-blue-600">≈</span> Philco — solo se estima TOM (señal moderada/frágil)</p>
          <p><strong>TOM ≈ 1,2 + 0,33·driver</strong> (R²=0,72; marca chica, N=5). SOM: sin señal suficiente.</p>
        </>
      ),
    },
    Whirlpool: {
      nota: <p>{marca} — <strong>no se estima</strong> TOM ni SOM: el mercado de lavado no predice su salud de marca (relación débil/espuria; marca multicategoría). Solo se muestran los valores reales.</p>,
    },
    LG: {
      nota: <p>{marca} — <strong>no se estima</strong> TOM ni SOM: el mercado de lavado no predice su salud de marca (relación débil/espuria; marca multicategoría). Solo se muestran los valores reales.</p>,
    },
  };
  // Refrigeración. Driver = blend(US_Total) para TOM/SOM/Poder (en refri Drean casi
  // no juega en High premium; la señal está en el share TOTAL). Calibrado por OLS
  // sobre las olas medidas (N=4 con blend → direccional, no de precisión).
  const notaRefri = (
    <p>
      <strong>Blend 50/50 (Kantar).</strong> Driver = 0,5·U12(T) + 0,5·U12(T-12). En refrigeración el predictor es el{" "}
      <strong>unit share TOTAL</strong> (no la gama alta, donde Drean casi no compite). <em>Inercia comercial</em>; no incluye
      medios/tienda/comunicación. N=4 olas con blend → estimación <strong>direccional</strong>.
    </p>
  );
  const EST_REFRI: Record<string, EstCfg> = {
    Samsung: {
      tom: usTotEq(-13.97, 1.724), tomBand: 0.4,
      som: usTotEq(-15.51, 4.012), somBand: 3.0,
      poder: usTotEq(-10.36, 1.647), poderBand: 1.2,
      damp: 0.5,
      nota: (
        <>
          <p className="font-semibold text-foreground"><span className="text-blue-600">≈</span> Samsung (refri) — se estiman TOM, SOM y Poder desde el unit share total</p>
          {notaRefri}
          <p>
            Ecuaciones: <strong>TOM ≈ −13,97 + 1,724·driver</strong> (R²=0,97, ±0,4) · <strong>SOM ≈ −15,51 + 4,012·driver</strong>{" "}
            (R²=0,73, ±3,0) · <strong>Poder ≈ −10,36 + 1,647·driver</strong> (R²=0,85, ±1,2). Driver = blend(US Total).
          </p>
          <p>
            <strong>Amortiguación 50/50:</strong> como nov-26 extrapola por debajo del rango calibrado y la marca tiene inercia, la
            estimación final = 50%·modelo + 50%·último valor medido. Intención, Significancia y Diferenciación <strong>no se
            estiman</strong> (sin señal de mercado) → se mantienen en su último valor.
          </p>
        </>
      ),
    },
    Philco: {
      tom: usTotEq(-3.05, 1.101), tomBand: 0.5,
      som: usTotEq(3.64, 2.706), somBand: 2.5,
      poder: usTotEq(2.86, 0.646), poderBand: 0.3,
      damp: 0.5,
      nota: (
        <>
          <p className="font-semibold text-foreground"><span className="text-blue-600">≈</span> Philco (refri) — se estiman TOM, SOM y Poder desde el unit share total</p>
          {notaRefri}
          <p>
            Philco viene <strong>creciendo fuerte</strong> (US Total 4,9 → 12,9) y su marca acompaña al share (correlaciones muy altas).
            Ecuaciones: <strong>TOM ≈ −3,05 + 1,101·driver</strong> (R²=0,98) · <strong>SOM ≈ 3,64 + 2,706·driver</strong> (R²=0,85) ·{" "}
            <strong>Poder ≈ 2,86 + 0,646·driver</strong> (R²=0,99). Driver = blend(US Total). <strong>Amortiguación 50/50</strong> (N=4).
            Intención/Significancia/Diferenciación no se estiman.
          </p>
        </>
      ),
    },
    Drean: {
      nota: (
        <>
          <p className="font-semibold text-foreground">Drean (refri) — <strong>no se estima</strong> desde mercado</p>
          <p>
            Drean es <strong>nueva</strong> en refrigeración: entró por distribución/precio (ganó share rápido 2023-24) <em>antes</em> de
            construir marca. Share e indicadores de marca están <strong>desacoplados</strong> (incluso inversos): TOM/SOM/Poder planos
            mientras el share subió y corrigió, y la Intención sube por <em>construcción de marca</em>, no por share. Correlaciones
            débiles/espurias → <strong>se mantienen los últimos valores reales</strong>. (Con planes de medios/comunicación sí se podría
            modelar, pero no desde el mercado.)
          </p>
        </>
      ),
    },
    Gafa: {
      nota: (
        <>
          <p className="font-semibold text-foreground">Gafa (refri) — <strong>no se estima</strong> desde mercado</p>
          <p>
            Incumbente fuerte: su brand equity se mantiene <strong>estable</strong> (TOM ~19, SOM ~49, Poder ~12) aunque su share cae
            (US Total 22,8 → 13,3). Relación mercado↔marca débil/inversa (espuria) → se mantienen los últimos valores reales.
          </p>
        </>
      ),
    },
    Whirlpool: {
      nota: (
        <>
          <p className="font-semibold text-foreground">Whirlpool (refri) — <strong>no se estima</strong> desde mercado</p>
          <p>
            Su share <strong>creció</strong> (US Total 2,6 → 10,8) pero la marca <strong>no acompañó</strong> (TOM/SOM planos o bajando).
            Share y marca <strong>desacoplados</strong> → se mantienen los últimos valores reales.
          </p>
        </>
      ),
    },
    LG: {
      nota: (
        <>
          <p className="font-semibold text-foreground">LG (refri) — <strong>no se estima</strong> desde mercado</p>
          <p>
            GFK <strong>no desglosa el share total de LG</strong> en refrigeración (sin driver de mercado disponible) → se mantienen los
            últimos valores reales.
          </p>
        </>
      ),
    },
  };
  // Cocción. Driver = blend(US_Mid + US_High): el equity se construye desde la gama
  // media/alta; el segmento Low (entrada) no construye marca. Calibrado por OLS sobre
  // las olas medidas (N=5; nov-23 sin T-12 → blend direccional).
  const notaCoccion = (
    <p>
      <strong>Blend 50/50 (Kantar).</strong> Driver = 0,5·(US<sub>Mid</sub>+US<sub>High</sub>)(T) + 0,5·(…)(T-12). En cocción el equity{" "}
      <strong>se construye desde la gama media/alta</strong>: el segmento Low (entrada) tiene mucho volumen pero{" "}
      <strong>no construye marca</strong> (verificado: Escorial domina Low y su marca está desacoplada). <em>Inercia comercial</em>;
      no incluye medios/tienda/comunicación. N=5 olas → estimación <strong>direccional</strong>.
    </p>
  );
  const EST_COCCION: Record<string, EstCfg> = {
    Drean: {
      tom: mhEq(-0.05, 0.637), tomBand: 1.4,
      som: mhEq(3.74, 1.538), somBand: 4.7,
      poder: mhEq(8.53, 0.245), poderBand: 0.6,
      damp: 0.3,
      nota: (
        <>
          <p className="font-semibold text-foreground"><span className="text-blue-600">≈</span> Drean (cocción) — se estiman TOM, SOM y Poder desde la gama media/alta</p>
          {notaCoccion}
          <p>
            Drean <strong>lanzó un nuevo portfolio en may-25</strong> enfocado en Mid (y modelos High a fin de año): su presencia
            Mid+High saltó y arrastró la <strong>notoriedad/propiedad</strong> de marca (TOM/SOM/Poder/Saliencia suben juntos; el segmento
            High es el termómetro más fino, r≈+0,8). Ecuaciones: <strong>TOM ≈ −0,05 + 0,637·driver</strong> (R²=0,41, ±1,4) ·{" "}
            <strong>SOM ≈ 3,74 + 1,538·driver</strong> (R²=0,36, ±4,7) · <strong>Poder ≈ 8,53 + 0,245·driver</strong> (R²=0,24, ±0,6).
          </p>
          <p>
            <strong>Amortiguación fuerte 0,3</strong> (= 30%·modelo + 70%·último real): el driver nov-26 (≈17,7) extrapola{" "}
            <strong>2,5× por encima del máximo observado</strong> (7,1) y la relación se calibra sobre una sola inflexión (nov-25) → alta
            confianza en la <em>dirección</em>, baja en la <em>magnitud</em>. <strong>Intención y la hélice (Significancia/Diferenciación/
            Saliencia) no se estiman</strong>: todavía no acoplan (la marca construye notoriedad antes que preferencia) → se mantienen en su
            último valor real.
          </p>
        </>
      ),
    },
    Escorial: {
      nota: (
        <>
          <p className="font-semibold text-foreground">Escorial (cocción) — <strong>no se estima</strong> desde mercado</p>
          <p>
            Líder de volumen del <strong>segmento de entrada</strong> (Low, anchos ≤52cm: 86%→74%) con índice de precio ~0,65 (vende ~35%
            bajo el promedio). Su share <em>total</em> de unidades está <strong>desacoplado/invertido</strong> respecto del equity: tocó
            máximo (44,5%, nov-24) justo cuando la marca tocó piso (TOM 10, Poder 8,5), porque el volumen lo mueve el mix de precio del canal
            de entrada, no el pull de marca (correlaciones marca↔share total negativas; Poder vs US Total = −0,53; R²&lt;0,36). El segmento
            Low <strong>no construye marca</strong> → se mantienen los últimos valores reales (equity range-bound con erosión suave desde el
            pico nov-23).
          </p>
        </>
      ),
    },
    Electrolux: {
      tom: usTotEq(-3.35, 3.906), tomBand: 2.1,
      som: usTotEq(7.02, 5.597), somBand: 2.1,
      poder: usTotEq(7.25, 1.676), poderBand: 0.8,
      damp: 0.5,
      nota: (
        <>
          <p className="font-semibold text-foreground"><span className="text-blue-600">≈</span> Electrolux (cocción) — se estiman TOM, SOM y Poder desde el unit share total</p>
          <p>
            <strong>Blend 50/50 (Kantar).</strong> Driver = 0,5·US<sub>Total</sub>(T) + 0,5·US<sub>Total</sub>(T-12). Marca premium{" "}
            <strong>chica y en crecimiento parejo</strong> (US Total 0,84 → 2,43): su marca <strong>construye en lockstep</strong> con el
            share total (TOM 1→6, SOM 14→19, Poder 9,1→11,4). Acople fuerte y coherente: Poder +0,85, TOM +0,83, SOM +0,82.
          </p>
          <p>
            Ecuaciones: <strong>TOM ≈ −3,35 + 3,91·driver</strong> (R²=0,68, ±2,1) · <strong>SOM ≈ 7,02 + 5,60·driver</strong> (R²=0,88, ±2,1) ·{" "}
            <strong>Poder ≈ 7,25 + 1,68·driver</strong> (R²=0,73, ±0,8). <strong>Amortiguación 0,5</strong>: el driver nov-26 (3,57) extrapola
            1,62× sobre el rango calibrado (extrapolación moderada). <strong>Intención y la hélice no se estiman</strong>{" "}
            (no acoplan; Intención R²≈0) → se mantienen en su último valor real.
          </p>
        </>
      ),
    },
    Whirlpool: {
      nota: (
        <>
          <p className="font-semibold text-foreground">Whirlpool (cocción) — <strong>no se estima</strong> desde mercado</p>
          <p>
            Marca <strong>premium pura</strong> (índice de precio 1,5-1,8) que se está <strong>retirando a una posición más chica pero más
            premium</strong>: pierde share de volumen en gama media/alta (blend Mid+High 15,7 → 10,2) <em>mientras</em> su equity{" "}
            <strong>se fortalece</strong> (Poder 11,3→14,3; Intención 26→36; Diferenciación 155→169, la más alta de la categoría). Es{" "}
            <strong>premiumización por contracción</strong>: la relación marca↔share de volumen es <strong>inversa</strong> (Poder vs share
            = −0,78) y el único driver coherente es el índice de precio (Poder vs precio = +0,80), no proyectable a nov-26. → Equity
            resiliente, se mantienen los últimos valores reales.
          </p>
        </>
      ),
    },
    Longvie: {
      nota: (
        <>
          <p className="font-semibold text-foreground">Longvie (cocción) — <strong>no se estima</strong> desde mercado</p>
          <p>
            Incumbente mid-tier (TOM ~13, presencia sólida en High). Su share y su SOM <strong>co-movieron en un ciclo</strong> (ambos pico
            nov-24), pero bajo la <strong>metodología de blend 50/50 la señal se lava</strong> (SOM↔blend +0,32) porque el año móvil sigue
            subiendo cuando el SOM ya cae. Poder/TOM/Intención no acoplan (Poder −0,24). Sin driver confiable → equity estable, se mantienen
            los últimos valores reales.
          </p>
        </>
      ),
    },
    Gafa: {
      nota: (
        <>
          <p className="font-semibold text-foreground">Gafa (cocción) — <strong>no se estima</strong> desde mercado</p>
          <p>
            GFK <strong>no desglosa el share total de Gafa</strong> en cocción (queda en “otros”; solo aparece en Mid hasta may-24). Sin
            driver de mercado disponible → se mantienen los últimos valores reales.
          </p>
        </>
      ),
    },
    Florencia: {
      nota: (
        <>
          <p className="font-semibold text-foreground">Florencia (cocción) — <strong>no se estima</strong> desde mercado</p>
          <p>
            Jugador grande de <strong>volumen</strong> (~15% total) pero <strong>comprado por precio, no por marca</strong>: índice de precio
            bajísimo (High 46-73, Mid 86-94) y la <strong>marca más débil</strong> de la categoría (Poder ~5, Diferenciación 57-62). Además
            Kantar <strong>no tiene TOM/SOM</strong> de jun-24 a nov-25 (no hay con qué calibrar). → Se mantienen los últimos valores reales.
          </p>
        </>
      ),
    },
  };
  // Selección de modelo por categoría. La estimación está calibrada por marca y
  // categoría; donde no hay config, se muestra solo lo medido.
  const EST = esLavado ? EST_LAVADO : tabKey === "refrigeracion" ? EST_REFRI : tabKey === "coccion" ? EST_COCCION : {};
  const cfg: EstCfg | undefined = EST[marca];
  // Salud de Marca compuesta = 0,25·(TOM + SOM + Intención + Poder); null si falta alguno.
  const saludDe = (k: KVals): number | null => {
    const xs = [k.tom, k.som, k.int, k.poder];
    return xs.every((v) => v != null) ? 0.25 * (xs[0]! + xs[1]! + xs[2]! + xs[3]!) : null;
  };
  const kantar: Array<{ label: string; get: (k: KVals) => number | null; fmt: (v: number | null) => string; bold?: boolean; estKey?: "tom" | "som" | "poder" }> = [
    { label: "Top of Mind", get: (k) => k.tom, fmt: kPct, estKey: "tom" },
    { label: "Share of Mind", get: (k) => k.som, fmt: kPct, estKey: "som" },
    { label: "Intención de compra", get: (k) => k.int, fmt: kPct },
    { label: "Poder de Marca", get: (k) => k.poder, fmt: kPct, estKey: "poder" },
    // Componentes de la hélice de Poder de Marca (índice base 100).
    { label: "· Significancia (índice)", get: (k) => k.sig, fmt: kIdx },
    { label: "· Diferenciación (índice)", get: (k) => k.dif, fmt: kIdx },
    { label: "· Saliencia (índice)", get: (k) => k.sal, fmt: kIdx },
    { label: "Salud de Marca", get: saludDe, fmt: kPct, bold: true },
  ];
  type MRow = { label: string; get: (s?: DreanMesSeg) => number | null; fmt: (v: number | null) => string };
  const mkt: MRow[] = [
    { label: "Value share · High %", get: (s) => s?.vs.High ?? null, fmt: p1 },
    { label: "Value share · Mid %", get: (s) => s?.vs.Mid ?? null, fmt: p1 },
    { label: "Value share · Low %", get: (s) => s?.vs.Low ?? null, fmt: p1 },
    { label: "Unit share · High %", get: (s) => s?.us.High ?? null, fmt: p1 },
    { label: "Unit share · Mid %", get: (s) => s?.us.Mid ?? null, fmt: p1 },
    { label: "Unit share · Low %", get: (s) => s?.us.Low ?? null, fmt: p1 },
    { label: "Índice de precio · High", get: (s) => s?.ip.High ?? null, fmt: i0 },
    { label: "Índice de precio · Mid", get: (s) => s?.ip.Mid ?? null, fmt: i0 },
    { label: "Índice de precio · Low", get: (s) => s?.ip.Low ?? null, fmt: i0 },
  ];
  // Grupos de indicadores de mercado, separados visualmente con un encabezado/línea.
  const mktGroups: Record<string, string> = { vs: "Value Share", us: "Unit Share", ip: "Índice de Precio" };
  const mktGroupOf = (l: string) => (l.startsWith("Value") ? "vs" : l.startsWith("Unit") ? "us" : "ip");
  // Fila resumen al pie de cada grupo:
  //   Value Share / Unit Share = Total (Marca) de GFK (no calculado).
  //   Índice = (IP_High/100) · (IP_Mid/100) · (IP_Low/100) → producto de índices (calculado).
  const summaryLabel: Record<string, string> = { vs: "Value Share · Total (GFK)", us: "Unit Share · Total (GFK)", ip: "Índice general" };
  const general = (sv: DreanMesSeg | undefined, grp: string): number | null => {
    if (!sv) return null;
    if (grp === "vs") return sv.vsTotal;
    if (grp === "us") return sv.usTotal;
    // Índice general = producto de los índices de precio disponibles (High·Mid·Low).
    // Si falta alguno (ej. una marca no compite en ese segmento), se multiplica
    // solo con los que hay; null únicamente si no hay ninguno.
    const ips = [sv.ip.High, sv.ip.Mid, sv.ip.Low].filter((v): v is number => v != null);
    if (ips.length === 0) return null;
    return ips.reduce((acc, v) => acc * (v / 100), 1);
  };

  // Bloque de mercado standalone y COLAPSABLE de forma independiente (<details>).
  // Tocando el título se contrae/expande. Se usa para mensual y U12 (MAT).
  const mercadoTable = (s: Map<string, DreanMesSeg>, title: string, subtitle: string, note?: ReactNode) => (
    <details open className="overflow-hidden rounded-xl border bg-card">
      <summary className="cursor-pointer select-none px-4 py-3 marker:text-muted-foreground">
        <span className="text-sm font-bold tracking-tight">{title}</span>
        <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{subtitle}</span>
      </summary>
      <div className="overflow-x-auto border-t p-4">
        <table className="w-full min-w-[600px] table-fixed text-xs">
          <colgroup>
            <col className="w-[22%]" />
            {waves.map((w) => (
              <col key={w.label} className="w-[13%]" />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="sticky left-0 z-20 bg-card px-2 py-2 text-left">Indicador</th>
              {waves.map((w) => (
                <th key={w.label} className="px-2 py-2 text-right">{w.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mkt.map((r, ri) => {
              const grp = mktGroupOf(r.label);
              const newGroup = ri === 0 || mktGroupOf(mkt[ri - 1]!.label) !== grp;
              const lastOfGroup = ri === mkt.length - 1 || mktGroupOf(mkt[ri + 1]!.label) !== grp;
              const vals = waves.map((w) => r.get(s.get(w.mes)));
              const prevs = prevAvail(vals);
              const genVals = lastOfGroup ? waves.map((w) => general(s.get(w.mes), grp)) : [];
              const genPrev = lastOfGroup ? prevAvail(genVals) : [];
              const genFmt = (v: number | null) => (v == null ? "—" : grp === "ip" ? v.toFixed(2) : `${v.toFixed(1)}%`);
              return (
                <Fragment key={r.label}>
                  {newGroup && (
                    <tr className={ri === 0 ? "" : "border-t-2 border-foreground/25"}>
                      <td colSpan={1 + waves.length} className="whitespace-nowrap px-2 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-primary">
                        {mktGroups[grp]}
                      </td>
                    </tr>
                  )}
                  <tr className="border-t">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-card px-2 py-1.5 pl-4 text-foreground">{r.label}</td>
                    {waves.map((w, i) => (
                      <td key={w.label} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-foreground/90">
                        {r.fmt(vals[i] ?? null)}
                        <Delta curr={vals[i] ?? null} prev={prevs[i] ?? null} />
                      </td>
                    ))}
                  </tr>
                  {lastOfGroup && (
                    <tr className="border-t bg-muted/40 font-semibold">
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-muted px-2 py-1.5 pl-4 text-foreground">{summaryLabel[grp]}</td>
                      {waves.map((w, i) => (
                        <td key={w.label} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-foreground">
                          {genFmt(genVals[i] ?? null)}
                          <Delta curr={genVals[i] ?? null} prev={genPrev[i] ?? null} />
                        </td>
                      ))}
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {note && <div className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{note}</div>}
      </div>
    </details>
  );

  // Bloque Kantar standalone (la parte de marca, siempre visible).
  const kantarTable = () => (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold tracking-tight">{catLabel} — Salud de Marca (Kantar)</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {marca}. Columnas = olas de medición. Debajo de cada valor, el desvío vs la ola anterior.
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {brands.map((b) => (
              <Link
                key={b}
                href={`/salud-marca?tab=${tabKey}&view=evolucion&marca=${b}`}
                scroll={false}
                className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${b === marca ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}
              >
                {b}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[600px] table-fixed text-xs">
          <colgroup>
            <col className="w-[22%]" />
            {waves.map((w) => (
              <col key={w.label} className="w-[13%]" />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="sticky left-0 z-20 bg-card px-2 py-2 text-left">Indicador</th>
              {waves.map((w) => (
                <th key={w.label} className="px-2 py-2 text-right">{w.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kantar.map((r) => {
              const vals = waves.map((w) => r.get(kFor(w.label)));
              const prevs = prevAvail(vals);
              return (
                <tr key={r.label} className="border-t">
                  <td className={`sticky left-0 z-10 whitespace-nowrap bg-card px-2 py-1.5 ${r.bold ? "font-bold text-foreground" : r.label.startsWith("·") ? "pl-5 text-foreground/80" : "text-foreground"}`}>{r.label}</td>
                  {waves.map((w, i) => {
                    const actual = vals[i] ?? null;
                    // Si no hay medición y la marca tiene ecuación para ese indicador, estimamos desde el mercado.
                    const estFn = r.estKey === "tom" ? cfg?.tom : r.estKey === "som" ? cfg?.som : r.estKey === "poder" ? cfg?.poder : undefined;
                    const band = r.estKey === "tom" ? cfg?.tomBand : r.estKey === "poder" ? cfg?.poderBand : cfg?.somBand;
                    // Estimación: modelo de mercado, amortiguado hacia el último valor
                    // real (inercia de marca) según cfg.damp (1 = modelo puro).
                    const modelEst = actual == null && estFn ? estFn(serieU12, w.mes) : null;
                    const anchor = prevs[i] ?? null;
                    const dampW = cfg?.damp ?? 1;
                    const est = modelEst == null ? null : dampW >= 1 || anchor == null ? modelEst : dampW * modelEst + (1 - dampW) * anchor;
                    return (
                      <td key={w.label} className={`whitespace-nowrap px-2 py-1.5 text-right tabular-nums ${r.bold ? "font-bold" : "text-foreground/90"}`}>
                        {actual != null ? (
                          <>
                            {r.fmt(actual)}
                            <Delta curr={actual} prev={prevs[i] ?? null} />
                          </>
                        ) : est != null ? (
                          <span className="text-blue-600" title={`Estimado desde el mercado (±${band} pts)`}>
                            ≈{r.fmt(est)}
                            <Delta curr={est} prev={prevs[i] ?? null} />
                          </span>
                        ) : (
                          r.fmt(null)
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {cfg?.nota && (
          <div className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">{cfg.nota}</div>
        )}
      </div>
    </section>
  );

  // Tres bloques independientes: Kantar (marca, siempre visible) y dos de Mercado
  // (mensual y U12), cada uno colapsable por separado para enfocar el análisis.
  return (
    <div className="space-y-5">
      {kantarTable()}
      {mercadoTable(
        serieU12,
        `${catLabel} — Mercado · GFK (U12 · año móvil)`,
        `${marca}. MAT (acumulado móvil 12 meses) cerrando en el mes de cada ola; olas sin serie MAT quedan en “—”. Tocá el título para contraer/expandir.`,
        esLavado && esDrean ? (
          <>
            <strong>nov-26 (proyección).</strong> Valores <strong>mensuales finales</strong> asumidos para nov-26 — VS High 20% ·
            VS Mid 45% · US Total 35% (los que usa el modelo). El U12 que se muestra es el <strong>año móvil que cierra en
            nov-26</strong> = promedio de los 12 meses dic-25 → nov-26, construido con los meses reales más una
            <strong> rampa lineal</strong> desde el último dato real hasta esos valores finales. Por eso el U12 queda por debajo del
            mensual final: VS High <strong>15,4</strong> · VS Mid <strong>41,5</strong> · US Total <strong>28,1</strong> (el año
            móvil arrastra los meses flojos de 2026 y no rebota tan rápido).
          </>
        ) : undefined,
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
          Salud de marca medida por <b>Kantar</b> (Top of Mind, Share of Mind, Intención y Poder de marca) por categoría,
          contrastada con la evolución de mercado. La proyección de <b>Nov-2026</b> se estima desde los drivers de mercado de
          cada marca. El tab <b>Marca</b> consolida a Drean ponderando las categorías.
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
