import { Fragment, type ReactNode } from "react";
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
import { getDreanSerie, type DreanMesSeg } from "@/lib/salud-marca-queries";

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
] as const;

// Marcas con tracking Kantar disponible (selector). El nombre en mayúscula es la marca en mercado_share.
const SM_BRANDS_LAVADO = ["Drean", "Samsung", "Whirlpool", "LG", "Philco"] as const;
const SM_BRANDS_REFRI = ["Drean", "Samsung", "Gafa", "Whirlpool", "LG", "Philco"] as const;
type KVals = { tom: number | null; som: number | null; int: number | null; poder: number | null; sig: number | null; dif: number | null; sal: number | null };
const NK: KVals = { tom: null, som: null, int: null, poder: null, sig: null, dif: null, sal: null };
// Kantar por marca y ola. TOM/SOM/Intención en %; Poder en %; hélice (sig/dif/sal) en índice base 100.
// Intención de compra = "Sería mi primera opción". Competidores: nov-23 solo Poder+hélice; nov-26 sin dato.
const KANTAR_LAVADO: Record<string, Record<string, KVals>> = {
  Drean: {
    "nov-23": { tom: 54, som: 80, int: 34, poder: 18.4, sig: 138, dif: 109, sal: 262 },
    "jun-24": { tom: 53, som: 77, int: 43, poder: 19.9, sig: 151, dif: 107, sal: 251 },
    "nov-24": { tom: 44, som: 74, int: 40, poder: 19.2, sig: 147, dif: 115, sal: 232 },
    "jun-25": { tom: 45, som: 74, int: 38, poder: 19.6, sig: 143, dif: 107, sal: 246 },
    "nov-25": { tom: 40.1, som: 69.1, int: 40, poder: 17.4, sig: 127, dif: 106, sal: 237 },
  },
  Samsung: {
    "nov-23": { tom: 13, som: 55, int: 37, poder: 16.7, sig: 140, dif: 196, sal: 121 },
    "jun-24": { tom: 12, som: 54, int: 28, poder: 16.6, sig: 139, dif: 181, sal: 126 },
    "nov-24": { tom: 10, som: 51, int: 35, poder: 17.9, sig: 159, dif: 186, sal: 114 },
    "jun-25": { tom: 11, som: 51, int: 37, poder: 17.4, sig: 154, dif: 184, sal: 124 },
    "nov-25": { tom: 14, som: 47, int: 34, poder: 16.0, sig: 131, dif: 179, sal: 124 },
  },
  Whirlpool: {
    "nov-23": { tom: 13, som: 47, int: 26, poder: 14.1, sig: 129, dif: 145, sal: 128 },
    "jun-24": { tom: 9, som: 50, int: 25, poder: 13.8, sig: 127, dif: 146, sal: 119 },
    "nov-24": { tom: 14, som: 47, int: 32, poder: 15.1, sig: 134, dif: 150, sal: 130 },
    "jun-25": { tom: 13, som: 43, int: 28, poder: 13.5, sig: 135, dif: 144, sal: 119 },
    "nov-25": { tom: 12, som: 38, int: 24, poder: 13.6, sig: 130, dif: 150, sal: 116 },
  },
  LG: {
    "nov-23": { tom: 5, som: 28, int: 19, poder: 11.0, sig: 105, dif: 151, sal: 83 },
    "jun-24": { tom: 5, som: 36, int: 21, poder: 11.0, sig: 104, dif: 149, sal: 94 },
    "nov-24": { tom: 7, som: 27, int: 17, poder: 10.9, sig: 103, dif: 154, sal: 88 },
    "jun-25": { tom: 7, som: 35, int: 15, poder: 10.7, sig: 98, dif: 153, sal: 101 },
    "nov-25": { tom: 7, som: 30, int: 18, poder: 10.7, sig: 115, dif: 131, sal: 93 },
  },
  Philco: {
    "nov-23": { tom: 1, som: 11, int: 7, poder: 5.4, sig: 81, dif: 75, sal: 73 },
    "jun-24": { tom: 2, som: 9, int: 7, poder: 5.5, sig: 89, dif: 82, sal: 67 },
    "nov-24": { tom: 1, som: 12, int: 8, poder: 5.7, sig: 83, dif: 83, sal: 70 },
    "jun-25": { tom: 2, som: 15, int: 9, poder: 5.9, sig: 89, dif: 71, sal: 79 },
    "nov-25": { tom: 3, som: 15, int: 14, poder: 6.1, sig: 87, dif: 75, sal: 87 },
  },
};

// Kantar Refrigeración. TOM/SOM de las barras; Intención = "Sería mi primera
// opción"; Poder + hélice (sig/dif/sal índice base 100). Sin Patrick ni Electrolux.
const KANTAR_REFRI: Record<string, Record<string, KVals>> = {
  Drean: {
    "nov-23": { tom: 12, som: 34, int: 13, poder: 9.3, sig: 98, dif: 97, sal: 119 },
    "jun-24": { tom: 9, som: 29, int: 14, poder: 9.2, sig: 109, dif: 94, sal: 106 },
    "nov-24": { tom: 10, som: 37, int: 20, poder: 10.4, sig: 111, dif: 112, sal: 119 },
    "jun-25": { tom: 9, som: 29, int: 19, poder: 9.2, sig: 103, dif: 94, sal: 111 },
    "nov-25": { tom: 13, som: 36, int: 25, poder: 10.4, sig: 114, dif: 94, sal: 123 },
  },
  Samsung: {
    "nov-23": { tom: 10, som: 52, int: 36, poder: 16.5, sig: 165, dif: 177, sal: 118 },
    "jun-24": { tom: 14, som: 46, int: 36, poder: 15.6, sig: 137, dif: 171, sal: 126 },
    "nov-24": { tom: 14, som: 52, int: 41, poder: 16.4, sig: 130, dif: 194, sal: 133 },
    "jun-25": { tom: 13, som: 48, int: 41, poder: 16.3, sig: 143, dif: 189, sal: 130 },
    "nov-25": { tom: 11, som: 43, int: 37, poder: 13.3, sig: 133, dif: 167, sal: 122 },
  },
  Gafa: {
    "nov-23": { tom: 19, som: 50, int: 22, poder: 11.8, sig: 119, dif: 87, sal: 157 },
    "jun-24": { tom: 20, som: 53, int: 25, poder: 12.0, sig: 128, dif: 89, sal: 164 },
    "nov-24": { tom: 19, som: 47, int: 22, poder: 10.8, sig: 119, dif: 75, sal: 159 },
    "jun-25": { tom: 15, som: 50, int: 27, poder: 12.2, sig: 129, dif: 91, sal: 149 },
    "nov-25": { tom: 20, som: 47, int: 35, poder: 12.7, sig: 134, dif: 93, sal: 156 },
  },
  Whirlpool: {
    "nov-23": { tom: 15, som: 46, int: 29, poder: 12.3, sig: 124, dif: 135, sal: 132 },
    "jun-24": { tom: 16, som: 50, int: 30, poder: 14.5, sig: 132, dif: 157, sal: 146 },
    "nov-24": { tom: 13, som: 43, int: 33, poder: 13.7, sig: 134, dif: 145, sal: 125 },
    "jun-25": { tom: 16, som: 41, int: 31, poder: 14.1, sig: 126, dif: 146, sal: 135 },
    "nov-25": { tom: 12, som: 41, int: 33, poder: 12.6, sig: 124, dif: 152, sal: 127 },
  },
  LG: {
    "nov-23": { tom: 1, som: 14, int: 11, poder: 8.6, sig: 99, dif: 136, sal: 64 },
    "jun-24": { tom: 3, som: 20, int: 18, poder: 10.2, sig: 103, dif: 156, sal: 71 },
    "nov-24": { tom: 4, som: 26, int: 20, poder: 10.2, sig: 109, dif: 134, sal: 87 },
    "jun-25": { tom: 1, som: 17, int: 17, poder: 9.4, sig: 101, dif: 146, sal: 72 },
    "nov-25": { tom: 3, som: 22, int: 30, poder: 9.8, sig: 107, dif: 144, sal: 82 },
  },
  Philco: {
    "nov-23": { tom: 6, som: 20, int: 10, poder: 6.5, sig: 83, dif: 76, sal: 93 },
    "jun-24": { tom: 1, som: 12, int: 7, poder: 5.4, sig: 77, dif: 74, sal: 74 },
    "nov-24": { tom: 2, som: 16, int: 10, poder: 5.7, sig: 78, dif: 86, sal: 77 },
    "jun-25": { tom: 3, som: 21, int: 10, poder: 6.3, sig: 88, dif: 80, sal: 89 },
    "nov-25": { tom: 6, som: 25, int: 19, poder: 8.2, sig: 99, dif: 101, sal: 96 },
  },
};

// Config de Salud de Marca por categoría (la vista EvolucionView es la misma).
const SM_CAT: Record<string, {
  categoria: string; label: string; tabKey: string;
  waves: ReadonlyArray<{ label: string; mes: string }>;
  brands: readonly string[];
  kantar: Record<string, Record<string, KVals>>;
}> = {
  lavado: { categoria: "Lavado", label: "Lavado", tabKey: "lavado", waves: WAVES_LAVADO, brands: SM_BRANDS_LAVADO, kantar: KANTAR_LAVADO },
  refrigeracion: { categoria: "Refrigeración", label: "Refrigeración", tabKey: "refrigeracion", waves: WAVES_REFRI, brands: SM_BRANDS_REFRI, kantar: KANTAR_REFRI },
};

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

// Tabla del modelo de construcción de marca (reutilizable): conexión de KPIs de
// comunicación/tienda/mercado con las dimensiones de marca (Saliencia → Poder → Intención).
function BrandBuildTable({ brandModel, idx, label, title, subtitle, kinds }: {
  brandModel: ReturnType<typeof buildBrandModel>;
  idx: number;
  label: string;
  title: string;
  subtitle?: string;
  kinds?: Array<"Mental" | "Físico" | "Mercado">; // si se pasa, filtra filas por tipo
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-bold tracking-tight">
          {title}
          {subtitle && <span className="ml-2 text-[11px] font-normal text-muted-foreground">{subtitle}</span>}
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
              <th className="px-2 py-2 text-right">{label}</th>
            </tr>
          </thead>
          <tbody>
            {brandModel.map((comp) => {
              const rows = kinds ? comp.rows.filter((r) => kinds.includes(r.kind)) : comp.rows;
              if (rows.length === 0) return null;
              return (
              <Fragment key={comp.title}>
                <tr>
                  <td colSpan={2} className="px-2 pb-1 pt-4">
                    <span className="text-[13px] font-bold uppercase tracking-wide text-primary">{comp.title}</span>
                    <span className="ml-2 text-[10px] font-normal normal-case text-muted-foreground">{comp.subtitle}</span>
                  </td>
                </tr>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t">
                    <td className="px-2 py-1.5">
                      <span className={`mr-1.5 inline-block rounded px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${r.kind === "Mental" ? "bg-blue-50 text-blue-700" : r.kind === "Físico" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {r.kind === "Mental" ? "Comunicación" : r.kind === "Físico" ? "Tienda" : "Mercado"}
                      </span>
                      <span className="text-foreground">{r.label}</span>
                    </td>
                    <td className="border-l px-2 py-1.5 text-right font-semibold tabular-nums text-foreground">
                      {r.cells[idx]?.display ?? "—"}
                    </td>
                  </tr>
                ))}
              </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
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
      <BrandBuildTable
        brandModel={brandModel}
        idx={tab.idx}
        label={tab.label}
        title={esMarca ? "Marca — Drean general" : tab.label}
        subtitle={esMarca ? "ponderado por categoría (Lavado 60 / Refrigeración 30 / Cocción 10)" : undefined}
      />
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
  type EstCfg = { tom?: (s: Map<string, DreanMesSeg>, m: string) => number | null; tomBand?: number; som?: (s: Map<string, DreanMesSeg>, m: string) => number | null; somBand?: number; nota: ReactNode };
  const notaModelo = (
    <p>
      <strong>1. Blend 50/50 (metodología Kantar).</strong> Driver = 0,5·U12(T) + 0,5·U12(T-12, un año antes). <strong>TOM</strong> ←
      value share gama alta (0,85·VS<sub>High</sub> + 0,15·VS<sub>Mid</sub>); <strong>SOM</strong> ← unit share total. <strong>2.</strong> Es la
      <em> inercia comercial</em> (no incluye medios/tienda/comunicación). <strong>3.</strong> Cada marca se calibra por separado.
    </p>
  );
  const EST: Record<string, EstCfg> = {
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
  // La estimación TOM/SOM está calibrada solo para Lavado (refri aún no tiene
  // historia suficiente de mercado). En otras categorías se muestra solo lo medido.
  const cfg: EstCfg | undefined = esLavado ? EST[marca] : undefined;
  // Salud de Marca compuesta = 0,25·(TOM + SOM + Intención + Poder); null si falta alguno.
  const saludDe = (k: KVals): number | null => {
    const xs = [k.tom, k.som, k.int, k.poder];
    return xs.every((v) => v != null) ? 0.25 * (xs[0]! + xs[1]! + xs[2]! + xs[3]!) : null;
  };
  const kantar: Array<{ label: string; get: (k: KVals) => number | null; fmt: (v: number | null) => string; bold?: boolean; estKey?: "tom" | "som" }> = [
    { label: "Top of Mind", get: (k) => k.tom, fmt: kPct, estKey: "tom" },
    { label: "Share of Mind", get: (k) => k.som, fmt: kPct, estKey: "som" },
    { label: "Intención de compra", get: (k) => k.int, fmt: kPct },
    { label: "Poder de Marca", get: (k) => k.poder, fmt: kPct },
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
    const { High, Mid, Low } = sv.ip;
    if (High == null || Mid == null || Low == null) return null;
    return (High / 100) * (Mid / 100) * (Low / 100);
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
        <table className="w-full table-fixed text-xs">
          <colgroup>
            <col className="w-[22%]" />
            {waves.map((w) => (
              <col key={w.label} className="w-[13%]" />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-2 text-left">Indicador</th>
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
                    <td className="whitespace-nowrap px-2 py-1.5 pl-4 text-foreground">{r.label}</td>
                    {waves.map((w, i) => (
                      <td key={w.label} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-foreground/90">
                        {r.fmt(vals[i] ?? null)}
                        <Delta curr={vals[i] ?? null} prev={prevs[i] ?? null} />
                      </td>
                    ))}
                  </tr>
                  {lastOfGroup && (
                    <tr className="border-t bg-muted/40 font-semibold">
                      <td className="whitespace-nowrap px-2 py-1.5 pl-4 text-foreground">{summaryLabel[grp]}</td>
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
        <table className="w-full table-fixed text-xs">
          <colgroup>
            <col className="w-[22%]" />
            {waves.map((w) => (
              <col key={w.label} className="w-[13%]" />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-2 text-left">Indicador</th>
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
                  <td className={`whitespace-nowrap px-2 py-1.5 ${r.bold ? "font-bold text-foreground" : r.label.startsWith("·") ? "pl-5 text-foreground/80" : "text-foreground"}`}>{r.label}</td>
                  {waves.map((w, i) => {
                    const actual = vals[i] ?? null;
                    // Si no hay medición y la marca tiene ecuación para ese indicador, estimamos desde el mercado.
                    const estFn = r.estKey === "tom" ? cfg?.tom : r.estKey === "som" ? cfg?.som : undefined;
                    const band = r.estKey === "tom" ? cfg?.tomBand : cfg?.somBand;
                    const est = actual == null && estFn ? estFn(serieU12, w.mes) : null;
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
