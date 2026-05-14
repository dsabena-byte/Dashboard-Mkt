import "server-only";
import { getServerSupabase } from "./supabase-server";

export interface PlanningMediaRow {
  fecha: string;
  campania: string;
  rol: string | null;
  touchpoint: string | null;
  sistema: string | null;
  formato: string | null;
  inversion: number;
  tipo: "media" | "costo";
}

export interface PlanningFilter {
  fecha?: string;     // 'YYYY-MM-01' month
  campania?: string;
  rol?: string;
  sistema?: string;
  medio?: "Digital" | "TV Cable" | "OOH" | "Costos";
}

const TV_SISTEMAS = new Set(["TVC", "TV Cable", "TVA"]);
const OOH_SISTEMAS = new Set(["OOH", "Vía Pública", "Via Publica"]);

export function classifyMedio(
  row: Pick<PlanningMediaRow, "tipo" | "sistema">,
): "Digital" | "TV Cable" | "OOH" | "Costos" {
  if (row.tipo === "costo") return "Costos";
  if (row.sistema && TV_SISTEMAS.has(row.sistema)) return "TV Cable";
  if (row.sistema && OOH_SISTEMAS.has(row.sistema)) return "OOH";
  return "Digital";
}

export async function getPlanningMedia(filter: PlanningFilter = {}): Promise<PlanningMediaRow[]> {
  const supabase = getServerSupabase();

  let query = supabase
    .from("planning_media")
    .select("fecha, campania, rol, touchpoint, sistema, formato, inversion, tipo");

  if (filter.fecha) query = query.eq("fecha", filter.fecha);
  if (filter.campania) query = query.eq("campania", filter.campania);
  if (filter.rol) query = query.eq("rol", filter.rol);
  if (filter.sistema) query = query.eq("sistema", filter.sistema);

  const { data, error } = await query.returns<PlanningMediaRow[]>();
  if (error) throw new Error(`planning_media: ${error.message}`);

  const rows = data ?? [];
  return filter.medio ? rows.filter((r) => classifyMedio(r) === filter.medio) : rows;
}

export interface PlanningTotals {
  total: number;
  digital: number;
  tv: number;
  ooh: number;
  costos: number;
  build: number;
  consider: number;
  topCategoria: { nombre: string; inversion: number } | null;
  topSistema: { nombre: string; inversion: number } | null;
}

export function aggregateTotals(rows: PlanningMediaRow[]): PlanningTotals {
  const byMedio = { Digital: 0, "TV Cable": 0, OOH: 0, Costos: 0 };
  const byCat = new Map<string, number>();
  const bySis = new Map<string, number>();
  let build = 0;
  let consider = 0;

  for (const r of rows) {
    const medio = classifyMedio(r);
    byMedio[medio] += r.inversion;

    // Mayor categoría, Mayor plataforma y Build/Consider se calculan SOLO sobre Digital.
    // (Build/Consider es una construcción de "Rol of Comms" digital; TVC/OOH siempre son
    // Build pero no entran en la métrica de mix. Mayor categoría matchea el donut "Por
    // categoría digital".)
    if (r.tipo === "media" && medio === "Digital") {
      byCat.set(r.campania, (byCat.get(r.campania) ?? 0) + r.inversion);
      if (r.sistema) bySis.set(r.sistema, (bySis.get(r.sistema) ?? 0) + r.inversion);
      if (r.rol === "Build") build += r.inversion;
      if (r.rol === "Consider") consider += r.inversion;
    }
  }

  const total = byMedio.Digital + byMedio["TV Cable"] + byMedio.OOH + byMedio.Costos;
  const topCat = [...byCat.entries()].sort(([, a], [, b]) => b - a)[0];
  const topSis = [...bySis.entries()].sort(([, a], [, b]) => b - a)[0];

  return {
    total,
    digital: byMedio.Digital,
    tv: byMedio["TV Cable"],
    ooh: byMedio.OOH,
    costos: byMedio.Costos,
    build,
    consider,
    topCategoria: topCat ? { nombre: topCat[0], inversion: topCat[1] } : null,
    topSistema: topSis ? { nombre: topSis[0], inversion: topSis[1] } : null,
  };
}

export interface CategoryBreakdown {
  campania: string;
  build: number;
  consider: number;
  total: number;
}

export function aggregateByCategoria(rows: PlanningMediaRow[]): CategoryBreakdown[] {
  const map = new Map<string, CategoryBreakdown>();
  for (const r of rows) {
    if (r.tipo !== "media") continue;
    const existing = map.get(r.campania) ?? { campania: r.campania, build: 0, consider: 0, total: 0 };
    existing.total += r.inversion;
    if (r.rol === "Build") existing.build += r.inversion;
    if (r.rol === "Consider") existing.consider += r.inversion;
    map.set(r.campania, existing);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export interface SistemaFormatoBreakdown {
  sistema: string;
  byFormato: Record<string, number>;
  total: number;
}

export function aggregateBySistemaFormato(rows: PlanningMediaRow[]): SistemaFormatoBreakdown[] {
  const map = new Map<string, SistemaFormatoBreakdown>();
  for (const r of rows) {
    if (r.tipo !== "media" || !r.sistema) continue;
    if (classifyMedio(r) !== "Digital") continue;
    const existing = map.get(r.sistema) ?? {
      sistema: r.sistema,
      byFormato: {},
      total: 0,
    };
    const fmt = r.formato ?? "Sin formato";
    existing.byFormato[fmt] = (existing.byFormato[fmt] ?? 0) + r.inversion;
    existing.total += r.inversion;
    map.set(r.sistema, existing);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export interface CostosBreakdown {
  iibb: number;
  cheque: number;
  techProg: number;
  techYt: number;
  comOnline: number;
  comOffline: number;
  total: number;
}

export function aggregateCostos(rows: PlanningMediaRow[]): CostosBreakdown {
  const out: CostosBreakdown = {
    iibb: 0,
    cheque: 0,
    techProg: 0,
    techYt: 0,
    comOnline: 0,
    comOffline: 0,
    total: 0,
  };
  for (const r of rows) {
    if (r.tipo !== "costo") continue;
    const f = (r.formato ?? "").toLowerCase();
    if (f.includes("iibb") || f.includes("percep")) out.iibb += r.inversion;
    else if (f.includes("cheque")) out.cheque += r.inversion;
    else if (f.includes("tech") && f.includes("yt")) out.techYt += r.inversion;
    else if (f.includes("tech") && (f.includes("programm") || f.includes("prog"))) out.techProg += r.inversion;
    else if (f.includes("comisi") && f.includes("on")) out.comOnline += r.inversion;
    else if (f.includes("comisi") && f.includes("off")) out.comOffline += r.inversion;
    else if (f.includes("comisi")) out.comOnline += r.inversion;
    out.total += r.inversion;
  }
  return out;
}

export interface PlanningFilterOptions {
  meses: string[];           // YYYY-MM-01
  campanias: string[];
  roles: string[];
  sistemas: string[];
}

export async function getPlanningFilterOptions(): Promise<PlanningFilterOptions> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("planning_media")
    .select("fecha, campania, rol, sistema")
    .returns<{ fecha: string; campania: string; rol: string | null; sistema: string | null }[]>();
  if (error) throw new Error(`planning filters: ${error.message}`);

  const rows = data ?? [];
  const meses = [...new Set(rows.map((r) => r.fecha))].sort();
  const campanias = [...new Set(rows.map((r) => r.campania))].filter(Boolean).sort();
  const roles = [...new Set(rows.map((r) => r.rol).filter(Boolean) as string[])].sort();
  const sistemas = [...new Set(rows.map((r) => r.sistema).filter(Boolean) as string[])].sort();
  return { meses, campanias, roles, sistemas };
}

/**
 * Devuelve el mes "en curso" disponible: el más reciente que tenga data.
 * Si no hay data, devuelve el primer día del mes actual.
 */
export async function getDefaultMonth(): Promise<string> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("planning_media")
    .select("fecha")
    .order("fecha", { ascending: false })
    .limit(1)
    .returns<{ fecha: string }[]>();
  if (data && data.length > 0) return data[0]!.fecha;
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export const PALETA_CATEGORIA: Record<string, string> = {
  Brand: "#3b82f6",
  Cocina: "#f97316",
  Refrigeración: "#22c55e",
  Refrigeracion: "#22c55e",
  Lavado: "#a78bfa",
  Promoción: "#facc15",
  Promocion: "#facc15",
  UGC: "#f43f5e",
};

export const PALETA_SISTEMA: Record<string, string> = {
  YouTube: "#f43f5e",
  TikTok: "#22c55e",
  Meta: "#3b82f6",
  "Mercado Ads": "#facc15",
  "Prog. Video": "#a78bfa",
  "Programmatic Video": "#a78bfa",
  "Google Search": "#34d399",
  GeoMobile: "#fb923c",
  "Google DemandGen": "#94a3b8",
  "Diarios Online": "#64748b",
  TVC: "#f43f5e",
  "TV Cable": "#f43f5e",
  OOH: "#facc15",
};

export const PALETA_FORMATO: Record<string, string> = {
  Bumper: "#3b82f6",
  TrueView: "#f43f5e",
  InFeed: "#22c55e",
  "Video/Stories/Reels": "#a78bfa",
  "MeliPlay/Display+": "#facc15",
  "MeliPlay & Display+": "#facc15",
  "Open Exchange": "#94a3b8",
  Display: "#fb923c",
  Txt: "#34d399",
  "Carrusel/Link Clicks": "#6ee7b7",
  "Carrusel & Link Click": "#6ee7b7",
  "TrueView 15s": "#c4b5fd",
  Múltiples: "#fca5a5",
  Multiples: "#fca5a5",
  HE: "#cbd5e1",
};

export function colorFor(palette: Record<string, string>, key: string, fallback = "#64748b"): string {
  return palette[key] ?? fallback;
}

export function formatMonthLabel(fecha: string): string {
  // 'YYYY-MM-01' → 'Mes YYYY' en español
  const [year, month] = fecha.split("-");
  const names = [
    "Enero", "Febrero", "Marzo", "Abril",
    "Mayo", "Junio", "Julio", "Agosto",
    "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const idx = parseInt(month ?? "1", 10) - 1;
  return `${names[idx] ?? month} ${year}`;
}
