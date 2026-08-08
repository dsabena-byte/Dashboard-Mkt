import { NextResponse } from "next/server";
import { MARCAS, CATEGORIAS, LOCATION_CODE_AR, LANGUAGE_CODE_ES } from "@/lib/competitive-config";

// Módulo B · SEO. Trae de DataForSEO Labs (por dominio, Argentina):
//  - domain_rank_overview → seo_domain_overview (visibilidad: keywords, ETV, posiciones)
//  - ranked_keywords → seo_rankings (keywords que rankea cada dominio, filtradas a categoría)
//  - domain_intersection → seo_keyword_gap (keywords donde el competidor rankea y Drean no)
// Category-pure: las keywords se clasifican/filtran por términos de electrodomésticos.
// Estructuras validadas contra la respuesta real. Trigger: seo-sync.yml.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DFS_API = "https://api.dataforseo.com/v3";
const DREAN_DOMAIN = "drean.com.ar";

// Términos que marcan relevancia de electrodoméstico (para clasificar/filtrar).
const CAT_TERMS: Record<string, string[]> = {
  lavarropas: ["lavarropa", "lavarropas", "secarropa"],
  heladeras: ["heladera", "freezer", "refriger"],
  cocinas: ["cocina", "horno", "anafe", "hornalla"],
};
function categoriaDeKeyword(kw: string): string | null {
  const l = kw.toLowerCase();
  for (const cat of CATEGORIAS) if (CAT_TERMS[cat]?.some((t) => l.includes(t))) return cat;
  return null;
}

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

async function dfs<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${DFS_API}${path}`, {
    method: "POST",
    headers: { Authorization: `Basic ${env("DATAFORSEO_AUTH")}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { status_code?: number; status_message?: string; tasks?: Array<{ status_code?: number; status_message?: string; result?: unknown }> };
  const task = json.tasks?.[0];
  if (json.status_code !== 20000 || task?.status_code !== 20000) {
    throw new Error(`DataForSEO ${path}: ${task?.status_code ?? json.status_code} ${task?.status_message ?? json.status_message}`);
  }
  return json as T;
}

async function sbUpsert(table: string, onConflict: string, rows: unknown[]): Promise<void> {
  if (rows.length === 0) return;
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!res.ok) throw new Error(`Supabase ${table}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
}

const marcaDeDominio = (dom: string) => MARCAS.find((m) => m.dominio === dom)?.nombre ?? null;
const hoy = () => new Date().toISOString().slice(0, 10);

// ── Overview (scorecard de visibilidad) ──
interface OverviewResp { tasks: Array<{ result: Array<{ items: Array<{ metrics: { organic?: { count?: number; etv?: number; pos_1?: number; pos_2_3?: number; pos_4_10?: number } } }> }> }> }
async function syncOverview(domains: string[]): Promise<number> {
  const rows: Record<string, unknown>[] = [];
  const fecha = hoy();
  for (const dom of domains) {
    const r = await dfs<OverviewResp>("/dataforseo_labs/google/domain_rank_overview/live", [{ target: dom, location_code: LOCATION_CODE_AR, language_code: LANGUAGE_CODE_ES }]).catch(() => null);
    const org = r?.tasks?.[0]?.result?.[0]?.items?.[0]?.metrics?.organic;
    if (!org) continue;
    rows.push({ dominio: dom, marca: marcaDeDominio(dom), fecha, keywords_count: org.count ?? null, pos_1_3: (org.pos_1 ?? 0) + (org.pos_2_3 ?? 0), pos_4_10: org.pos_4_10 ?? null, etv: org.etv ?? null, fetched_at: new Date().toISOString() });
  }
  await sbUpsert("seo_domain_overview", "dominio,fecha", rows);
  return rows.length;
}

// ── Ranked keywords (posiciones por dominio, filtradas a categoría) ──
interface RankedResp { tasks: Array<{ result: Array<{ items: Array<{ keyword_data: { keyword: string; keyword_info?: { search_volume?: number } }; ranked_serp_element?: { serp_item?: { rank_group?: number; url?: string } } }> }> }> }
async function syncRanked(domains: string[], limit: number): Promise<number> {
  const rows: Record<string, unknown>[] = [];
  const fecha = hoy();
  for (const dom of domains) {
    const r = await dfs<RankedResp>("/dataforseo_labs/google/ranked_keywords/live", [{ target: dom, location_code: LOCATION_CODE_AR, language_code: LANGUAGE_CODE_ES, limit, order_by: ["ranked_serp_element.serp_item.rank_group,asc"] }]).catch(() => null);
    for (const it of r?.tasks?.[0]?.result?.[0]?.items ?? []) {
      const kw = it.keyword_data?.keyword;
      const cat = categoriaDeKeyword(kw ?? "");
      if (!cat) continue; // category-pure: solo keywords de electrodoméstico
      const se = it.ranked_serp_element?.serp_item;
      rows.push({ dominio: dom, marca: marcaDeDominio(dom), keyword: kw, categoria: cat, posicion: se?.rank_group ?? null, search_volume: it.keyword_data?.keyword_info?.search_volume ?? null, url: se?.url ?? null, fecha, fetched_at: new Date().toISOString() });
    }
  }
  await sbUpsert("seo_rankings", "dominio,keyword,fecha", rows);
  return rows.length;
}

// ── Keyword gap (competidor rankea, Drean no) ──
interface GapResp { tasks: Array<{ result: Array<{ items: Array<{ keyword_data: { keyword: string; keyword_info?: { search_volume?: number } }; first_domain_serp_element?: { serp_item?: { rank_group?: number } } }> }> }> }
async function syncGap(competidores: string[], limit: number): Promise<number> {
  const rows: Record<string, unknown>[] = [];
  const fecha = hoy();
  for (const comp of competidores) {
    const r = await dfs<GapResp>("/dataforseo_labs/google/domain_intersection/live", [{ target1: comp, target2: DREAN_DOMAIN, location_code: LOCATION_CODE_AR, language_code: LANGUAGE_CODE_ES, intersections: false, limit, order_by: ["first_domain_serp_element.rank_group,asc"] }]).catch(() => null);
    for (const it of r?.tasks?.[0]?.result?.[0]?.items ?? []) {
      const kw = it.keyword_data?.keyword;
      const cat = categoriaDeKeyword(kw ?? "");
      if (!cat) continue;
      rows.push({ keyword: kw, competidor: marcaDeDominio(comp) ?? comp, categoria: cat, pos_competidor: it.first_domain_serp_element?.serp_item?.rank_group ?? null, search_volume: it.keyword_data?.keyword_info?.search_volume ?? null, fecha, fetched_at: new Date().toISOString() });
    }
  }
  await sbUpsert("seo_keyword_gap", "keyword,competidor,fecha", rows);
  return rows.length;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const rankedLimit = Math.min(Math.max(Number(url.searchParams.get("ranked_limit") ?? 300), 0), 1000);
  const gapLimit = Math.min(Math.max(Number(url.searchParams.get("gap_limit") ?? 100), 0), 1000);
  const only = url.searchParams.get("only"); // overview | ranked | gap | null(todos)

  const domains = [...new Set(MARCAS.map((m) => m.dominio))];
  const competidores = domains.filter((d) => d !== DREAN_DOMAIN);
  const out: Record<string, unknown> = { dominios: domains.length };
  try {
    if (!only || only === "overview") out.overview_filas = await syncOverview(domains);
    if ((!only || only === "ranked") && rankedLimit > 0) out.ranked_filas = await syncRanked(domains, rankedLimit);
    if ((!only || only === "gap") && gapLimit > 0) out.gap_filas = await syncGap(competidores, gapLimit);
    out.ok = true;
    return NextResponse.json(out);
  } catch (e) {
    out.ok = false;
    out.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }
}
