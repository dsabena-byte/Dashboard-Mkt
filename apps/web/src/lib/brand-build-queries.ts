import "server-only";
import { getServerSupabase } from "./supabase-server";
import { getPautaPerformance } from "./pauta-queries";
import type { FloorShareU4M } from "./floor-share-queries";
import type { CbU3M } from "./cb-queries";

// ============================================================================
// Salud de Marca (Obj. 4) — construcción de marca (leading indicators).
// Mix de contenido orgánico de Drean por CATEGORÍA × PILAR (clasificación LLM
// en meta_posts), alineado a las categorías de pauta para poder sumar luego
// orgánico + pauta en la misma dimensión.
// ============================================================================

export const BRAND_CATEGORIAS = ["Brand", "Lavado", "Refrigeración", "Cocción", "Promoción"] as const;
export const BRAND_PILARES = [
  "Liderazgo marca/porfolio",
  "Calidad superior",
  "Respaldo Posventa",
  "Elegir bien",
  "Experiencia uso",
] as const;

export interface OrganicMixCell {
  posts: number;
  reach: number;
  engagement: number;
}

export interface OrganicPilarMix {
  // counts[categoria][pilar]
  cells: Record<string, Record<string, OrganicMixCell>>;
  totalByCat: Record<string, number>;   // posts por categoría
  totalByPilar: Record<string, number>; // posts por pilar
  total: number;
  desde: string; // YYYY-MM-01 del rango usado
}

interface Row {
  categoria: string | null;
  pilar_contenido: string | null;
  reach: number | null;
  engagement: number | null;
}

export async function getOrganicPilarMix(year = 2026): Promise<OrganicPilarMix | null> {
  const supabase = getServerSupabase();
  const desde = `${year}-01-01`;
  const res = await supabase
    .from("meta_posts")
    .select("categoria, pilar_contenido, reach, engagement")
    .not("pilar_contenido", "is", null)
    .gte("fecha_post", `${desde}T00:00:00Z`)
    .limit(5000);
  if (res.error) return null;
  const rows = (res.data ?? []) as Row[];
  if (rows.length === 0) return null;

  const cells: Record<string, Record<string, OrganicMixCell>> = {};
  const totalByCat: Record<string, number> = {};
  const totalByPilar: Record<string, number> = {};
  let total = 0;

  for (const c of BRAND_CATEGORIAS) {
    cells[c] = {};
    for (const p of BRAND_PILARES) cells[c]![p] = { posts: 0, reach: 0, engagement: 0 };
    totalByCat[c] = 0;
  }
  for (const p of BRAND_PILARES) totalByPilar[p] = 0;

  for (const r of rows) {
    const cat = r.categoria && cells[r.categoria] ? r.categoria : "Brand";
    const pil = r.pilar_contenido;
    if (!pil || !cells[cat]![pil]) continue;
    const cell = cells[cat]![pil]!;
    cell.posts += 1;
    cell.reach += r.reach ?? 0;
    cell.engagement += r.engagement ?? 0;
    totalByCat[cat] = (totalByCat[cat] ?? 0) + 1;
    totalByPilar[pil] = (totalByPilar[pil] ?? 0) + 1;
    total += 1;
  }

  return { cells, totalByCat, totalByPilar, total, desde };
}

// ============================================================================
// Modelo completo de construcción de Salud de Marca:
// componente → Mental/Físico → KPI de ejecución, por categoría core + Drean.
// ============================================================================

type CoreCat = "Lavado" | "Refrigeración" | "Cocción";
const CORE: CoreCat[] = ["Lavado", "Refrigeración", "Cocción"];
const PESO: Record<CoreCat, number> = { Lavado: 0.6, Refrigeración: 0.3, Cocción: 0.1 };
const FS_KEY = { Lavado: "lavado", Refrigeración: "refri", Cocción: "coccion" } as const;

const PAUTA_TO_CORE: Record<string, CoreCat> = {
  Lavado: "Lavado",
  Refrigeración: "Refrigeración",
  Refrigeracion: "Refrigeración",
  Cocción: "Cocción",
  Coccion: "Cocción",
  Cocinas: "Cocción",
};

export interface PautaByCategoria {
  byCat: Record<CoreCat, { alcance: number; clicks: number }>;
  drean: { alcance: number; clicks: number };
}

export async function getPautaByCategoria(): Promise<PautaByCategoria> {
  const rows = await getPautaPerformance();
  const byCat: Record<CoreCat, { alcance: number; clicks: number }> = {
    Lavado: { alcance: 0, clicks: 0 },
    Refrigeración: { alcance: 0, clicks: 0 },
    Cocción: { alcance: 0, clicks: 0 },
  };
  let dA = 0;
  let dC = 0;
  for (const r of rows) {
    const a = r.alcance ?? 0;
    const c = r.clics ?? 0;
    dA += a;
    dC += c;
    const core = PAUTA_TO_CORE[r.categoria];
    if (core) {
      byCat[core].alcance += a;
      byCat[core].clicks += c;
    }
  }
  return { byCat, drean: { alcance: dA, clicks: dC } };
}

export interface BrandRow {
  kind: "Mental" | "Físico";
  label: string;
  cells: string[]; // [Lavado, Refrigeración, Cocción, Drean]
}
export interface BrandComponent {
  title: string;
  subtitle: string;
  rows: BrandRow[];
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}
function pctStr(n: number | null): string {
  return n == null ? "—" : `${n.toFixed(0)}%`;
}

export function buildBrandModel(
  pauta: PautaByCategoria | null,
  organic: OrganicPilarMix | null,
  fs: FloorShareU4M | null,
  cb: CbU3M | null,
): BrandComponent[] {
  const orgPosts = (pilares: string[], cat: CoreCat) =>
    organic ? pilares.reduce((s, p) => s + (organic.cells[cat]?.[p]?.posts ?? 0), 0) : 0;
  const orgPostsDrean = (pilares: string[]) =>
    organic
      ? BRAND_CATEGORIAS.reduce((s, c) => s + pilares.reduce((ss, p) => ss + (organic.cells[c]?.[p]?.posts ?? 0), 0), 0)
      : 0;
  const orgMetric = (cat: CoreCat, field: "reach" | "engagement") =>
    organic ? BRAND_PILARES.reduce((s, p) => s + (organic.cells[cat]?.[p]?.[field] ?? 0), 0) : 0;
  const orgMetricDrean = (field: "reach" | "engagement") =>
    organic
      ? BRAND_CATEGORIAS.reduce((s, c) => s + BRAND_PILARES.reduce((ss, p) => ss + (organic.cells[c]?.[p]?.[field] ?? 0), 0), 0)
      : 0;

  const row = (kind: "Mental" | "Físico", label: string, fn: (c: CoreCat) => string, drean: string): BrandRow => ({
    kind,
    label,
    cells: [...CORE.map(fn), drean],
  });

  const lidCal = ["Liderazgo marca/porfolio", "Calidad superior"];
  const elegPos = ["Elegir bien", "Respaldo Posventa"];

  const fsDrean = fs ? pctStr(CORE.reduce((s, c) => s + fs[FS_KEY[c]].avgU4M * PESO[c], 0)) : "—";
  const cbCell = (c: CoreCat) => pctStr(cb ? cb.cbByCategoria[FS_KEY[c]] : null);
  const cbDrean = pctStr(cb ? cb.cb.avg : null);

  return [
    {
      title: "TOM / SOM",
      subtitle: "Awareness · Saliencia",
      rows: [
        row("Mental", "Alcance (pauta + orgánico)",
          (c) => fmtNum((pauta?.byCat[c].alcance ?? 0) + orgMetric(c, "reach")),
          fmtNum((pauta?.drean.alcance ?? 0) + orgMetricDrean("reach"))),
        row("Físico", "Floor Share %", (c) => pctStr(fs ? fs[FS_KEY[c]].avgU4M : null), fsDrean),
      ],
    },
    {
      title: "Poder de marca",
      subtitle: "Significancia + Diferenciación",
      rows: [
        row("Mental", "Contenido Liderazgo + Calidad (posts)",
          (c) => String(orgPosts(lidCal, c)), String(orgPostsDrean(lidCal))),
        row("Mental", "Engagement orgánico",
          (c) => fmtNum(orgMetric(c, "engagement")), fmtNum(orgMetricDrean("engagement"))),
        row("Físico", "% CB (portfolio presente)", cbCell, cbDrean),
      ],
    },
    {
      title: "Intención de compra",
      subtitle: "Consideración",
      rows: [
        row("Mental", "Clicks pauta",
          (c) => fmtNum(pauta?.byCat[c].clicks ?? 0), fmtNum(pauta?.drean.clicks ?? 0)),
        row("Mental", "Contenido Elegir bien + Posventa (posts)",
          (c) => String(orgPosts(elegPos, c)), String(orgPostsDrean(elegPos))),
        row("Físico", "% CB (disponibilidad)", cbCell, cbDrean),
      ],
    },
  ];
}
