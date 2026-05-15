import "server-only";
import { getServerSupabase } from "./supabase-server";

export interface CompetitorWebRow {
  competidor: string;
  dominio: string;
  fecha: string;
  visitas_estimadas: number | null;
  visitantes_unicos: number | null;
  bounce_rate: number | null;
  pages_per_visit: number | null;
  avg_visit_duration: number | null;
  fuentes_trafico: unknown;
  paginas_top: unknown;
  paises_top: unknown;
  keywords_top: unknown;
}

export interface CompetitorWebSnapshotWithDelta extends CompetitorWebRow {
  deltaVisitas: number | null;          // diferencia absoluta vs snapshot anterior
  deltaVisitasPct: number | null;       // % de variación
  fechaAnterior: string | null;
}

// Competidores que no son relevantes para el benchmark (distorsionan visualizaciones).
// Samsung opera con tráfico global desde shop.samsung.com, ~10M visitas vs ~200k de la pauta argentina.
const HIDDEN_COMPETITORS = new Set(["Samsung"]);

async function fetchAll(): Promise<CompetitorWebRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("competitor_web")
    .select(
      "competidor, dominio, fecha, visitas_estimadas, visitantes_unicos, bounce_rate, pages_per_visit, avg_visit_duration, fuentes_trafico, paginas_top, paises_top, keywords_top",
    )
    .order("fecha", { ascending: false })
    .returns<CompetitorWebRow[]>();
  if (error) throw new Error(`competitor_web: ${error.message}`);
  return (data ?? []).filter((r) => !HIDDEN_COMPETITORS.has(r.competidor));
}

/**
 * Snapshot actual con delta vs ejecución previa para detectar picos de tráfico.
 */
export async function getCompetitorWebSnapshot(): Promise<CompetitorWebSnapshotWithDelta[]> {
  const all = await fetchAll();
  const byComp = new Map<string, CompetitorWebRow[]>();
  for (const r of all) {
    if (!byComp.has(r.competidor)) byComp.set(r.competidor, []);
    byComp.get(r.competidor)!.push(r);
  }
  const out: CompetitorWebSnapshotWithDelta[] = [];
  for (const [, rows] of byComp) {
    const latest = rows[0]!;
    const prev = rows[1];
    let deltaVisitas: number | null = null;
    let deltaVisitasPct: number | null = null;
    if (prev && latest.visitas_estimadas !== null && prev.visitas_estimadas !== null && prev.visitas_estimadas > 0) {
      deltaVisitas = latest.visitas_estimadas - prev.visitas_estimadas;
      deltaVisitasPct = deltaVisitas / prev.visitas_estimadas;
    }
    out.push({ ...latest, deltaVisitas, deltaVisitasPct, fechaAnterior: prev?.fecha ?? null });
  }
  return out.sort((a, b) => (b.visitas_estimadas ?? 0) - (a.visitas_estimadas ?? 0));
}

/**
 * Serie temporal de visitas por competidor.
 * Devuelve los últimos `limit` snapshots ordenados ascendentes por fecha.
 */
export async function getCompetitorWebHistory(limit = 12): Promise<
  Array<{
    competidor: string;
    dominio: string;
    serie: Array<{ fecha: string; visitas: number | null }>;
  }>
> {
  const all = await fetchAll();
  const byComp = new Map<string, CompetitorWebRow[]>();
  for (const r of all) {
    if (!byComp.has(r.competidor)) byComp.set(r.competidor, []);
    byComp.get(r.competidor)!.push(r);
  }
  return [...byComp.entries()].map(([competidor, rows]) => {
    const sorted = [...rows].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const trimmed = sorted.slice(-limit);
    return {
      competidor,
      dominio: rows[0]?.dominio ?? "",
      serie: trimmed.map((r) => ({ fecha: r.fecha, visitas: r.visitas_estimadas })),
    };
  });
}

export interface SourceBreakdown {
  competidor: string;
  fuentes: Array<{ name: string; value: number }>;
}

/**
 * Distribución de fuentes de tráfico (direct, search, social, referral, paid, mail).
 * El JSON puede venir en distintos shapes según el actor — soportamos varios.
 */
export async function getCompetitorTrafficSources(): Promise<SourceBreakdown[]> {
  const snap = await getCompetitorWebSnapshot();
  return snap.map((r) => ({ competidor: r.competidor, fuentes: parseSources(r.fuentes_trafico) }));
}

function parseSources(raw: unknown): Array<{ name: string; value: number }> {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  const candidates: Record<string, unknown> = (() => {
    if (r.shares && typeof r.shares === "object") return r.shares as Record<string, unknown>;
    if (r.trafficSources && typeof r.trafficSources === "object") return r.trafficSources as Record<string, unknown>;
    if (r.engagements && typeof r.engagements === "object") {
      const eng = r.engagements as Record<string, unknown>;
      if (eng.trafficSources && typeof eng.trafficSources === "object") {
        return eng.trafficSources as Record<string, unknown>;
      }
    }
    return r;
  })();

  const out: Array<{ name: string; value: number }> = [];
  for (const [k, v] of Object.entries(candidates)) {
    const num = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(num) || num === 0) continue;
    if (typeof v === "object") continue;
    out.push({ name: prettyLabel(k), value: num });
  }
  return out.sort((a, b) => b.value - a.value);
}

function prettyLabel(k: string): string {
  const map: Record<string, string> = {
    direct: "Directo",
    directVisits: "Directo",
    search: "Buscadores",
    searchVisits: "Buscadores",
    organic: "Search orgánico",
    paid: "Search pago",
    social: "Social",
    socialVisits: "Social",
    referrals: "Referrals",
    referralVisits: "Referrals",
    mail: "Mail",
    mailVisits: "Mail",
    display: "Display",
    displayAds: "Display",
  };
  return map[k] ?? k.charAt(0).toUpperCase() + k.slice(1);
}

export interface KeywordRow {
  competidor: string;
  keywords: Array<{ keyword: string; visits: number | null; share: number | null }>;
}

export async function getCompetitorKeywords(topN = 10): Promise<KeywordRow[]> {
  const snap = await getCompetitorWebSnapshot();
  return snap.map((r) => ({
    competidor: r.competidor,
    keywords: parseKeywords(r.keywords_top, topN),
  }));
}

function parseKeywords(
  raw: unknown,
  topN: number,
): Array<{ keyword: string; visits: number | null; share: number | null }> {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>)
    .map((k) => ({
      keyword: String(k.keyword ?? k.name ?? k.term ?? ""),
      visits: numOrNull(k.visits ?? k.value ?? k.traffic),
      share: numOrNull(k.share ?? k.percent ?? k.percentage),
    }))
    .filter((k) => k.keyword)
    .slice(0, topN);
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
