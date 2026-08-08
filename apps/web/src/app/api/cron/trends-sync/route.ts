import { NextResponse } from "next/server";
import {
  MARCAS,
  CATEGORIAS,
  CATEGORIA_TERMINO,
  buildKeywordUniverse,
  LOCATION_CODE_AR,
  LANGUAGE_CODE_ES,
  type KeywordDef,
} from "@/lib/competitive-config";

// Módulo A · Demanda. Trae de DataForSEO (keywords_data):
//  1) Volúmenes ABSOLUTOS por keyword + histórico mensual (google_ads/search_volume)
//     → tabla search_volume → base del Share of Search.
//  2) Interés relativo de Google Trends, serie semanal (google_trends/explore)
//     → tabla trends_interest → shape/estacionalidad.
// Estructuras validadas contra la respuesta real de la API (Argentina, es).
// Trigger: .github/workflows/trends-sync.yml (Authorization: Bearer CRON_SECRET).

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DFS_API = "https://api.dataforseo.com/v3";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

async function dfsPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${DFS_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${env("DATAFORSEO_AUTH")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    status_code?: number;
    status_message?: string;
    tasks?: Array<{ status_code?: number; status_message?: string; result?: unknown }>;
  };
  if (!res.ok || json.status_code !== 20000) {
    throw new Error(`DataForSEO ${path}: ${json.status_code} ${json.status_message ?? res.status}`);
  }
  return json as T;
}

async function sbUpsert(table: string, onConflict: string, rows: unknown[]): Promise<void> {
  if (rows.length === 0) return;
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) throw new Error(`Supabase ${table}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
}

const chunk = <T>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

// ===== 1) Volúmenes absolutos (search_volume) =====
interface SearchVolumeRow {
  keyword: string;
  search_volume: number | null;
  cpc: number | null;
  competition: string | null;
  competition_index: number | null;
  monthly_searches?: Array<{ year: number; month: number; search_volume: number | null }>;
}

async function syncSearchVolume(defs: KeywordDef[]): Promise<number> {
  const byKeyword = new Map(defs.map((d) => [d.keyword, d]));
  const rows: Record<string, unknown>[] = [];
  // El endpoint acepta ~1000 keywords por request; mandamos todo en una llamada.
  const resp = await dfsPost<{ tasks: Array<{ result: SearchVolumeRow[] }> }>(
    "/keywords_data/google_ads/search_volume/live",
    [{ keywords: defs.map((d) => d.keyword), location_code: LOCATION_CODE_AR, language_code: LANGUAGE_CODE_ES }],
  );
  const result = resp.tasks?.[0]?.result ?? [];
  const fetchedAt = new Date().toISOString();
  for (const r of result) {
    const def = byKeyword.get(r.keyword);
    if (!def) continue;
    // Una fila por mes del histórico (para el Share of Search en el tiempo).
    for (const m of r.monthly_searches ?? []) {
      const mes = `${m.year}-${String(m.month).padStart(2, "0")}-01`;
      rows.push({
        keyword: r.keyword,
        marca: def.marca,
        categoria: def.categoria,
        generico: def.generico,
        mes,
        search_volume: m.search_volume,
        cpc: r.cpc,
        competition: r.competition,
        competition_index: r.competition_index,
        fetched_at: fetchedAt,
      });
    }
  }
  await sbUpsert("search_volume", "keyword,mes", rows);
  return rows.length;
}

// ===== 2) Interés relativo (Google Trends) =====
interface TrendsGraphItem {
  type: string;
  keywords: string[];
  data?: Array<{ date_from: string; values: Array<number | null> }>;
}

async function syncTrends(defs: KeywordDef[]): Promise<number> {
  const byKeyword = new Map(defs.map((d) => [d.keyword, d]));
  const rows: Record<string, unknown>[] = [];
  const fetchedAt = new Date().toISOString();
  // Google Trends compara máx. 5 términos por request → batches de 5.
  for (const batch of chunk(defs, 5)) {
    const resp = await dfsPost<{ tasks: Array<{ result: Array<{ items: TrendsGraphItem[] }> }> }>(
      "/keywords_data/google_trends/explore/live",
      [{ keywords: batch.map((d) => d.keyword), location_code: LOCATION_CODE_AR, language_code: LANGUAGE_CODE_ES, time_range: "past_12_months" }],
    );
    const items = resp.tasks?.[0]?.result?.[0]?.items ?? [];
    const graph = items.find((it) => it.type === "google_trends_graph");
    if (!graph?.data) continue;
    // graph.keywords mantiene el orden; values[] está alineado a ese orden.
    graph.keywords.forEach((kw, idx) => {
      const def = byKeyword.get(kw);
      if (!def) return;
      for (const point of graph.data ?? []) {
        const val = point.values?.[idx];
        if (val == null) continue;
        rows.push({ keyword: kw, marca: def.marca, categoria: def.categoria, fecha: point.date_from, interes: val, fetched_at: fetchedAt });
      }
    });
  }
  await sbUpsert("trends_interest", "keyword,fecha", rows);
  return rows.length;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const only = url.searchParams.get("only"); // "volume" | "trends" | null (ambos)
  const defs = buildKeywordUniverse();
  const out: Record<string, unknown> = {
    keywords: defs.length,
    marcas: MARCAS.length,
    categorias: CATEGORIAS.map((c) => CATEGORIA_TERMINO[c]),
  };
  try {
    if (only !== "trends") out.search_volume_filas = await syncSearchVolume(defs);
    if (only !== "volume") out.trends_filas = await syncTrends(defs);
    out.ok = true;
    return NextResponse.json(out);
  } catch (e) {
    out.ok = false;
    out.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }
}
