import { NextResponse } from "next/server";
import { TRACKED_DOMAINS, LOCATION_CODE_AR, LANGUAGE_CODE_ES } from "@/lib/competitive-config";
import { KEYWORD_UNIVERSE } from "@/lib/seo-keyword-universe";

// Módulo B · SEO Competitivo (SERP-matrix). Para cada keyword del universo
// consulta la SERP de Google Argentina y guarda la POSICIÓN de cada dominio
// trackeado (marcas + retailers) → seo_rankings. De ahí sale el índice
// conglomerado + los buckets Faltantes/Débiles/Fuertes.
//
// Vercel corta a 300s, así que se procesa por CHUNKS: ?offset=N&limit=M. El
// workflow seo-sync.yml llama en loop hasta cubrir todo el universo.
// Trigger: .github/workflows/seo-sync.yml (Authorization: Bearer CRON_SECRET).

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DFS_API = "https://api.dataforseo.com/v3";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

interface SerpTask {
  status_code?: number;
  status_message?: string;
  result?: Array<{ items?: Array<{ type?: string; domain?: string; url?: string; rank_group?: number }> }>;
}
async function serp(keyword: string): Promise<SerpTask | undefined> {
  const res = await fetch(`${DFS_API}/serp/google/organic/live/advanced`, {
    method: "POST",
    headers: { Authorization: `Basic ${env("DATAFORSEO_AUTH")}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ keyword, location_code: LOCATION_CODE_AR, language_code: LANGUAGE_CODE_ES, depth: 100 }]),
    signal: AbortSignal.timeout(45000), // que una keyword colgada no trabe el batch
  });
  const json = (await res.json()) as { status_code?: number; tasks?: SerpTask[] };
  const task = json.tasks?.[0];
  if (json.status_code === 40200 || task?.status_code === 40200) throw new Error("DataForSEO sin saldo (Payment Required) — cargá fondos");
  return task;
}

async function sbUpsert(rows: unknown[]): Promise<void> {
  if (rows.length === 0) return;
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetch(`${url}/rest/v1/seo_rankings?on_conflict=dominio,keyword,fecha`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!res.ok) throw new Error(`Supabase seo_rankings: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 80), 1), 200);

  // Universo ordenado por volumen desc (lo más importante primero).
  const universo = [...KEYWORD_UNIVERSE].sort((a, b) => b.volume - a.volume);
  const slice = universo.slice(offset, offset + limit);
  const fecha = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  const out: Record<string, unknown> = { total: universo.length, offset, limit, procesadas: slice.length };
  try {
    const rows: Record<string, unknown>[] = [];
    // Las llamadas SERP live (depth 100) tardan ~6s c/u; en secuencial 40 keywords
    // rozan los 300s de Vercel. Se procesan en batches CONCURRENTES para bajar el
    // tiempo a ~1/8 (DataForSEO soporta esta concurrencia holgadamente).
    const CONCURRENCY = 8;
    let sinSaldo = false;
    for (let i = 0; i < slice.length && !sinSaldo; i += CONCURRENCY) {
      const batch = slice.slice(i, i + CONCURRENCY);
      const tasks = await Promise.all(
        batch.map(async (kw) => {
          try {
            return { kw, task: await serp(kw.keyword) };
          } catch (e) {
            if (String(e).includes("sin saldo")) sinSaldo = true;
            return { kw, task: undefined }; // falla puntual (timeout/red): se saltea
          }
        }),
      );
      for (const { kw, task } of tasks) {
        const items = task?.result?.[0]?.items ?? [];
        const seen = new Set<string>();
        for (const it of items) {
          if (it.type !== "organic") continue;
          const dom = (it.domain ?? "").toLowerCase();
          for (const td of TRACKED_DOMAINS) {
            if (dom.includes(td.dominio) && !seen.has(td.display)) {
              seen.add(td.display);
              rows.push({ dominio: td.dominio, marca: td.display, keyword: kw.keyword, categoria: kw.categoria, posicion: it.rank_group ?? null, search_volume: kw.volume, url: it.url ?? null, fecha, fetched_at: now });
            }
          }
        }
      }
    }
    if (sinSaldo) throw new Error("DataForSEO sin saldo (Payment Required) — cargá fondos");
    await sbUpsert(rows);
    out.filas = rows.length;
    out.resto = Math.max(0, universo.length - (offset + slice.length));
    out.ok = true;
    return NextResponse.json(out);
  } catch (e) {
    out.ok = false;
    out.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }
}
