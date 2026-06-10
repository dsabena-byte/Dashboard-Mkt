import "server-only";
import { getServerSupabase } from "./supabase-server";
import { getPautaPerformance, getInfluenciaPerformance } from "./pauta-queries";
import type { FloorShareU4M } from "./floor-share-queries";
import type { CbU3M } from "./cb-queries";

// ============================================================================
// Salud de Marca (Obj. 4) — construcción de marca (indicadores proyectivos).
// El modelo mide el RESULTADO del estímulo (personas alcanzadas, frecuencia,
// visualizaciones, usuarios/páginas web), no la cantidad de contenidos.
// Cada medio impacta un componente: TOM/SOM/Saliencia, Poder (signif+difer),
// Intención. Por categoría core (Lavado/Refri/Cocción) + Drean general.
// ============================================================================

export const BRAND_CATEGORIAS = ["Brand", "Lavado", "Refrigeración", "Cocción", "Promoción"] as const;
export const BRAND_PILARES = [
  "Liderazgo marca/porfolio",
  "Calidad superior",
  "Respaldo Posventa",
  "Elegir bien",
  "Experiencia uso",
] as const;

type CoreCat = "Lavado" | "Refrigeración" | "Cocción";
const CORE: CoreCat[] = ["Lavado", "Refrigeración", "Cocción"];
const PESO: Record<CoreCat, number> = { Lavado: 0.6, Refrigeración: 0.3, Cocción: 0.1 };
const FS_KEY = { Lavado: "lavado", Refrigeración: "refri", Cocción: "coccion" } as const;

// ---------- Orgánico (meta_posts clasificado) por categoría × pilar ----------
export interface OrganicMixCell {
  posts: number;
  reach: number;
  views: number;
  engagement: number;
}
export interface OrganicPilarMix {
  cells: Record<string, Record<string, OrganicMixCell>>;
}

interface OrgRow {
  categoria: string | null;
  pilar_contenido: string | null;
  reach: number | null;
  video_views: number | null;
  engagement: number | null;
}

export async function getOrganicPilarMix(year = 2026): Promise<OrganicPilarMix | null> {
  const supabase = getServerSupabase();
  const res = await supabase
    .from("meta_posts")
    .select("categoria, pilar_contenido, reach, video_views, engagement")
    .not("pilar_contenido", "is", null)
    .gte("fecha_post", `${year}-01-01T00:00:00Z`)
    .limit(5000);
  if (res.error) return null;
  const rows = (res.data ?? []) as OrgRow[];
  if (rows.length === 0) return null;

  const cells: Record<string, Record<string, OrganicMixCell>> = {};
  for (const c of BRAND_CATEGORIAS) {
    cells[c] = {};
    for (const p of BRAND_PILARES) cells[c]![p] = { posts: 0, reach: 0, views: 0, engagement: 0 };
  }
  for (const r of rows) {
    const cat = r.categoria && cells[r.categoria] ? r.categoria : "Brand";
    const pil = r.pilar_contenido;
    if (!pil || !cells[cat]![pil]) continue;
    const cell = cells[cat]![pil]!;
    cell.posts += 1;
    cell.reach += r.reach ?? 0;
    cell.views += r.video_views ?? 0;
    cell.engagement += r.engagement ?? 0;
  }
  return { cells };
}

// ---------- Pauta por categoría (alcance, impresiones, views, clicks) ----------
const PAUTA_TO_CORE: Record<string, CoreCat> = {
  Lavado: "Lavado",
  Refrigeración: "Refrigeración",
  Refrigeracion: "Refrigeración",
  Cocción: "Cocción",
  Coccion: "Cocción",
  Cocinas: "Cocción",
};
interface PautaAgg { alcance: number; impresiones: number; views: number; clicks: number }
export interface PautaByCategoria {
  byCat: Record<CoreCat, PautaAgg>;
  drean: PautaAgg;
}
function emptyAgg(): PautaAgg { return { alcance: 0, impresiones: 0, views: 0, clicks: 0 }; }

export async function getPautaByCategoria(): Promise<PautaByCategoria> {
  const rows = await getPautaPerformance();
  const byCat: Record<CoreCat, PautaAgg> = { Lavado: emptyAgg(), Refrigeración: emptyAgg(), Cocción: emptyAgg() };
  const drean = emptyAgg();
  for (const r of rows) {
    const alc = r.alcance ?? 0, imp = r.impresiones ?? 0, vw = r.views ?? 0, clk = r.clics ?? 0;
    drean.alcance += alc; drean.impresiones += imp; drean.views += vw; drean.clicks += clk;
    const core = PAUTA_TO_CORE[r.categoria];
    if (core) {
      byCat[core].alcance += alc; byCat[core].impresiones += imp; byCat[core].views += vw; byCat[core].clicks += clk;
    }
  }
  return { byCat, drean };
}

// ---------- Web por categoría (GA4 funnel: usuarios + páginas) ----------
const WEB_TO_CORE: Record<string, CoreCat> = {
  Lavado: "Lavado",
  Refrigeración: "Refrigeración",
  Cocinas: "Cocción",
  Cocción: "Cocción",
};
interface WebAgg { usuarios: number; sesiones: number; pageviews: number }
export interface WebByCategoria {
  byCat: Record<CoreCat, WebAgg>;
  drean: WebAgg;
}
interface WebRow { categoria: string | null; usuarios: number | null; sesiones: number | null; pageviews: number | null }

export async function getWebByCategoria(year = 2026): Promise<WebByCategoria | null> {
  const supabase = getServerSupabase();
  const res = await supabase
    .from("vw_ga4_funnel")
    .select("categoria, usuarios, sesiones, pageviews")
    .gte("fecha", `${year}-01-01`)
    .limit(20000);
  if (res.error) return null;
  const rows = (res.data ?? []) as WebRow[];
  if (rows.length === 0) return null;
  const mk = (): WebAgg => ({ usuarios: 0, sesiones: 0, pageviews: 0 });
  const byCat: Record<CoreCat, WebAgg> = { Lavado: mk(), Refrigeración: mk(), Cocción: mk() };
  const drean: WebAgg = mk();
  for (const r of rows) {
    const u = r.usuarios ?? 0, s = r.sesiones ?? 0, pv = r.pageviews ?? 0;
    drean.usuarios += u; drean.sesiones += s; drean.pageviews += pv;
    const core = r.categoria ? WEB_TO_CORE[r.categoria] : undefined;
    if (core) { byCat[core].usuarios += u; byCat[core].sesiones += s; byCat[core].pageviews += pv; }
  }
  return { byCat, drean };
}

// ---------- Influencia (UGC) y Mkt de Canal — nivel Drean ----------
export async function getInfluenciaTotals(): Promise<{ alcance: number; views: number }> {
  const rows = await getInfluenciaPerformance();
  let alcance = 0, views = 0;
  for (const r of rows) { alcance += r.alcance ?? 0; views += r.views ?? 0; }
  return { alcance, views };
}

export async function getCanalTotals(year = 2026): Promise<{ impresiones: number; clicks: number } | null> {
  const supabase = getServerSupabase();
  const res = await supabase
    .from("mkt_canal_acciones")
    .select("impresiones, clics")
    .gte("mes", `${year}-01`)
    .limit(20000);
  if (res.error) return null;
  const rows = (res.data ?? []) as Array<{ impresiones: number | null; clics: number | null }>;
  let impresiones = 0, clicks = 0;
  for (const r of rows) { impresiones += r.impresiones ?? 0; clicks += r.clics ?? 0; }
  return { impresiones, clicks };
}

// ---------- Ensamblado del modelo ----------
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
  web: WebByCategoria | null,
  influencia: { alcance: number; views: number } | null,
  canal: { impresiones: number; clicks: number } | null,
): BrandComponent[] {
  const orgSum = (cat: CoreCat | "drean", field: "reach" | "views" | "engagement", pilares: readonly string[] = BRAND_PILARES) => {
    if (!organic) return 0;
    const cats = cat === "drean" ? BRAND_CATEGORIAS : [cat];
    return cats.reduce((s, c) => s + pilares.reduce((ss, p) => ss + (organic.cells[c]?.[p]?.[field] ?? 0), 0), 0);
  };

  // row helper: fn(core) para las 3 categorías + valor drean ya formateado
  const row = (kind: "Mental" | "Físico", label: string, fn: (c: CoreCat) => string, drean: string): BrandRow => ({
    kind, label, cells: [...CORE.map(fn), drean],
  });
  const dreanOnly = (kind: "Mental" | "Físico", label: string, drean: string): BrandRow => ({
    kind, label, cells: ["—", "—", "—", drean],
  });

  const lidCal = ["Liderazgo marca/porfolio", "Calidad superior"] as const;

  // Frecuencia = impresiones / alcance
  const freq = (a: PautaAgg | undefined) => (a && a.alcance > 0 ? `${(a.impresiones / a.alcance).toFixed(1)}x` : "—");

  const fsDrean = fs ? pctStr(CORE.reduce((s, c) => s + fs[FS_KEY[c]].avgU4M * PESO[c], 0)) : "—";
  const cbCell = (c: CoreCat) => pctStr(cb ? cb.cbByCategoria[FS_KEY[c]] : null);
  const cbDrean = pctStr(cb ? cb.cb.avg : null);

  return [
    {
      title: "TOM / SOM · Saliencia",
      subtitle: "Awareness — personas alcanzadas y estímulos",
      rows: [
        row("Mental", "Alcance · personas (pauta + orgánico)",
          (c) => fmtNum((pauta?.byCat[c].alcance ?? 0) + orgSum(c, "reach")),
          fmtNum((pauta?.drean.alcance ?? 0) + orgSum("drean", "reach"))),
        row("Mental", "Frecuencia (impresiones/alcance)",
          (c) => freq(pauta?.byCat[c]), freq(pauta?.drean)),
        row("Mental", "Visualizaciones (pauta + orgánico)",
          (c) => fmtNum((pauta?.byCat[c].views ?? 0) + orgSum(c, "views")),
          fmtNum((pauta?.drean.views ?? 0) + orgSum("drean", "views"))),
        row("Físico", "Floor Share %", (c) => pctStr(fs ? fs[FS_KEY[c]].avgU4M : null), fsDrean),
      ],
    },
    {
      title: "Poder de marca",
      subtitle: "Significancia + Diferenciación — calidad del estímulo",
      rows: [
        row("Mental", "Alcance contenido de marca (Liderazgo+Calidad)",
          (c) => fmtNum(orgSum(c, "reach", lidCal)), fmtNum(orgSum("drean", "reach", lidCal))),
        row("Físico", "% CB · portfolio presente", cbCell, cbDrean),
      ],
    },
    {
      title: "Intención de compra",
      subtitle: "Consideración — señales de intención",
      rows: [
        row("Mental", "Usuarios web (personas)",
          (c) => fmtNum(web?.byCat[c].usuarios ?? 0), fmtNum(web?.drean.usuarios ?? 0)),
        row("Mental", "Sesiones web",
          (c) => fmtNum(web?.byCat[c].sesiones ?? 0), fmtNum(web?.drean.sesiones ?? 0)),
        row("Mental", "Páginas visitadas",
          (c) => fmtNum(web?.byCat[c].pageviews ?? 0), fmtNum(web?.drean.pageviews ?? 0)),
        row("Mental", "Clicks pauta",
          (c) => fmtNum(pauta?.byCat[c].clicks ?? 0), fmtNum(pauta?.drean.clicks ?? 0)),
        dreanOnly("Mental", "Mkt de Influencia · alcance", influencia ? fmtNum(influencia.alcance) : "—"),
        dreanOnly("Mental", "Mkt de Canal · impresiones", canal ? fmtNum(canal.impresiones) : "—"),
        row("Físico", "% CB · disponibilidad", cbCell, cbDrean),
      ],
    },
  ];
}
