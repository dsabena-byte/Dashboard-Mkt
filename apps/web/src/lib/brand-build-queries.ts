import "server-only";
import { getServerSupabase } from "./supabase-server";
import { getPautaPerformance, getInfluenciaPerformance } from "./pauta-queries";
import { getWebByCategory } from "./web-queries";
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

// ---------- Web por categoría (vw_drean_web_by_category) ----------
// Home y Otros = Brand → solo suman a Drean total. Lavavajillas tampoco es core.
const WEB_TO_CORE: Record<string, CoreCat> = {
  Lavado: "Lavado",
  Refrigeración: "Refrigeración",
  Refrigeracion: "Refrigeración",
  Cocinas: "Cocción",
  Cocción: "Cocción",
  Coccion: "Cocción",
};
interface WebAgg { usuarios: number; pageviews: number }
export interface WebByCategoria {
  byCat: Record<CoreCat, WebAgg>;
  drean: WebAgg;
}

export async function getWebByCategoria(year = 2026): Promise<WebByCategoria | null> {
  const to = new Date().toISOString().slice(0, 10);
  const rows = await getWebByCategory({ from: `${year}-01-01`, to });
  if (!rows || rows.length === 0) return null;
  const mk = (): WebAgg => ({ usuarios: 0, pageviews: 0 });
  const byCat: Record<CoreCat, WebAgg> = { Lavado: mk(), Refrigeración: mk(), Cocción: mk() };
  const drean: WebAgg = mk();
  for (const r of rows) {
    const u = r.usuarios ?? 0, pv = r.pageviews ?? 0;
    drean.usuarios += u; drean.pageviews += pv;
    const core = WEB_TO_CORE[r.categoria];
    if (core) { byCat[core].usuarios += u; byCat[core].pageviews += pv; }
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
  if (rows.length === 0) return null; // tabla vacía → "—" (no 0 engañoso)
  let impresiones = 0, clicks = 0;
  for (const r of rows) { impresiones += r.impresiones ?? 0; clicks += r.clics ?? 0; }
  if (impresiones === 0 && clicks === 0) return null;
  return { impresiones, clicks };
}

// ---------- Mercado (share + índice de precio) por categoría ----------
const MERCADO_TO_CORE: Record<string, CoreCat> = {
  Lavado: "Lavado",
  Refrigeración: "Refrigeración",
  Refrigeracion: "Refrigeración",
  Cocción: "Cocción",
  Coccion: "Cocción",
  Cocinas: "Cocción",
};
export interface MercadoCell {
  suHigh: number | null; suMid: number | null; suLow: number | null;
  svHigh: number | null; svMid: number | null; svLow: number | null;
  idxHigh: number | null; idxMid: number | null; idxLow: number | null;
}
export interface MercadoByCategoria {
  byCat: Record<CoreCat, MercadoCell>;
  mes: string | null;
}
interface MercadoRowDb {
  mes: string;
  categoria: string;
  share_units_high: number | null; share_units_mid: number | null; share_units_low: number | null;
  share_value_high: number | null; share_value_mid: number | null; share_value_low: number | null;
  index_price_high: number | null; index_price_mid: number | null; index_price_low: number | null;
}
export async function getMercadoByCategoria(): Promise<MercadoByCategoria | null> {
  const supabase = getServerSupabase();
  const res = await supabase
    .from("mercado_categoria")
    .select("mes, categoria, share_units_high, share_units_mid, share_units_low, share_value_high, share_value_mid, share_value_low, index_price_high, index_price_mid, index_price_low")
    .order("mes", { ascending: false })
    .limit(1000);
  if (res.error) return null;
  const rows = (res.data ?? []) as MercadoRowDb[];
  if (rows.length === 0) return null;
  const latest = rows[0]!.mes;
  const empty = (): MercadoCell => ({
    suHigh: null, suMid: null, suLow: null,
    svHigh: null, svMid: null, svLow: null,
    idxHigh: null, idxMid: null, idxLow: null,
  });
  const byCat: Record<CoreCat, MercadoCell> = { Lavado: empty(), Refrigeración: empty(), Cocción: empty() };
  for (const r of rows) {
    if (r.mes !== latest) continue;
    const core = MERCADO_TO_CORE[r.categoria];
    if (core) {
      byCat[core] = {
        suHigh: r.share_units_high, suMid: r.share_units_mid, suLow: r.share_units_low,
        svHigh: r.share_value_high, svMid: r.share_value_mid, svLow: r.share_value_low,
        idxHigh: r.index_price_high, idxMid: r.index_price_mid, idxLow: r.index_price_low,
      };
    }
  }
  return { byCat, mes: latest };
}

// ---------- Ensamblado del modelo ----------
export interface BrandCell {
  display: string;
  value: number | null; // valor numérico para la barra de intensidad
}
export interface BrandRow {
  kind: "Mental" | "Físico" | "Mercado";
  label: string;
  unidad: string;            // "personas" | "%" | "x" | "visitas" ...
  cells: BrandCell[];        // [Lavado, Refrigeración, Cocción, Drean]
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
const fmtPct = (n: number) => `${n.toFixed(0)}%`;
const fmtFreq = (n: number) => `${n.toFixed(1)}x`;
const fmtIdx = (n: number) => n.toFixed(0);

export function buildBrandModel(
  pauta: PautaByCategoria | null,
  organic: OrganicPilarMix | null,
  fs: FloorShareU4M | null,
  cb: CbU3M | null,
  web: WebByCategoria | null,
  influencia: { alcance: number; views: number } | null,
  canal: { impresiones: number; clicks: number } | null,
  mercado: MercadoByCategoria | null,
): BrandComponent[] {
  const orgSum = (cat: CoreCat | "drean", field: "reach" | "views" | "engagement", pilares: readonly string[] = BRAND_PILARES) => {
    if (!organic) return 0;
    const cats = cat === "drean" ? BRAND_CATEGORIAS : [cat];
    return cats.reduce((s, c) => s + pilares.reduce((ss, p) => ss + (organic.cells[c]?.[p]?.[field] ?? 0), 0), 0);
  };

  const mk = (v: number | null, fmt: (n: number) => string): BrandCell => ({
    display: v == null ? "—" : fmt(v),
    value: v,
  });
  // fila normal: valor por categoría core + Drean
  const numRow = (
    kind: BrandRow["kind"],
    label: string,
    unidad: string,
    valFn: (c: CoreCat) => number | null,
    dreanVal: number | null,
    fmt: (n: number) => string,
  ): BrandRow => ({
    kind, label, unidad,
    cells: [...CORE.map((c) => mk(valFn(c), fmt)), mk(dreanVal, fmt)],
  });
  // fila a nivel Drean (sin desagregar por categoría)
  const dreanRow = (kind: BrandRow["kind"], label: string, unidad: string, dreanVal: number | null, fmt: (n: number) => string): BrandRow => ({
    kind, label, unidad,
    cells: [mk(null, fmt), mk(null, fmt), mk(null, fmt), mk(dreanVal, fmt)],
  });

  const lidCal = ["Liderazgo marca/porfolio", "Calidad superior"] as const;
  const freq = (a: PautaAgg | undefined) => (a && a.alcance > 0 ? a.impresiones / a.alcance : null);
  const fsVal = (c: CoreCat) => (fs ? fs[FS_KEY[c]].avgU4M : null);
  const fsDrean = fs ? CORE.reduce((s, c) => s + fs[FS_KEY[c]].avgU4M * PESO[c], 0) : null;
  const cbVal = (c: CoreCat) => (cb ? cb.cbByCategoria[FS_KEY[c]] : null);
  const cbDrean = cb ? cb.cb.avg : null;
  const mField = (f: keyof MercadoCell) => (c: CoreCat) => mercado?.byCat[c][f] ?? null;
  const wAvg = (fn: (c: CoreCat) => number | null): number | null => {
    let s = 0;
    for (const c of CORE) {
      const v = fn(c);
      if (v == null) return null;
      s += v * PESO[c];
    }
    return s;
  };

  return [
    {
      title: "TOM / SOM · Saliencia",
      subtitle: "Awareness — personas alcanzadas y estímulos",
      rows: [
        numRow("Mental", "Alcance · personas (pauta + orgánico)", "personas",
          (c) => (pauta?.byCat[c].alcance ?? 0) + orgSum(c, "reach"),
          (pauta?.drean.alcance ?? 0) + orgSum("drean", "reach"), fmtNum),
        numRow("Mental", "Frecuencia (impresiones/alcance)", "x",
          (c) => freq(pauta?.byCat[c]), freq(pauta?.drean), fmtFreq),
        numRow("Mental", "Visualizaciones (pauta + orgánico)", "views",
          (c) => (pauta?.byCat[c].views ?? 0) + orgSum(c, "views"),
          (pauta?.drean.views ?? 0) + orgSum("drean", "views"), fmtNum),
        numRow("Físico", "Floor Share %", "%", fsVal, fsDrean, fmtPct),
      ],
    },
    {
      title: "Poder de marca",
      subtitle: "Significancia + Diferenciación — relevancia, premium y diferencia",
      rows: [
        numRow("Mental", "Alcance contenido de marca (Liderazgo+Calidad)", "personas",
          (c) => orgSum(c, "reach", lidCal), orgSum("drean", "reach", lidCal), fmtNum),
        numRow("Físico", "% CB · disponibilidad en PDV", "%", cbVal, cbDrean, fmtPct),
        numRow("Mercado", "Índice de precio · High", "idx", mField("idxHigh"), wAvg(mField("idxHigh")), fmtIdx),
        numRow("Mercado", "Índice de precio · Mid", "idx", mField("idxMid"), wAvg(mField("idxMid")), fmtIdx),
        numRow("Mercado", "Índice de precio · Low", "idx", mField("idxLow"), wAvg(mField("idxLow")), fmtIdx),
      ],
    },
    {
      title: "Intención de compra",
      subtitle: "Consideración → Compra — señales de intención y share de mercado",
      rows: [
        numRow("Mental", "Usuarios web (personas)", "personas",
          (c) => web?.byCat[c].usuarios ?? null, web?.drean.usuarios ?? null, fmtNum),
        numRow("Mental", "Páginas visitadas", "páginas",
          (c) => web?.byCat[c].pageviews ?? null, web?.drean.pageviews ?? null, fmtNum),
        numRow("Mental", "Clicks pauta", "clicks",
          (c) => pauta?.byCat[c].clicks ?? null, pauta?.drean.clicks ?? null, fmtNum),
        dreanRow("Mental", "Mkt de Influencia · alcance", "personas", influencia ? influencia.alcance : null, fmtNum),
        dreanRow("Mental", "Mkt de Canal · impresiones", "impresiones", canal ? canal.impresiones : null, fmtNum),
        numRow("Mercado", "Share value · High %", "%", mField("svHigh"), wAvg(mField("svHigh")), fmtPct),
        numRow("Mercado", "Share value · Mid %", "%", mField("svMid"), wAvg(mField("svMid")), fmtPct),
        numRow("Mercado", "Share value · Low %", "%", mField("svLow"), wAvg(mField("svLow")), fmtPct),
        numRow("Mercado", "Share units · High %", "%", mField("suHigh"), wAvg(mField("suHigh")), fmtPct),
        numRow("Mercado", "Share units · Mid %", "%", mField("suMid"), wAvg(mField("suMid")), fmtPct),
        numRow("Mercado", "Share units · Low %", "%", mField("suLow"), wAvg(mField("suLow")), fmtPct),
      ],
    },
  ];
}
