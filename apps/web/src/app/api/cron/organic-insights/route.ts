import { NextResponse } from "next/server";
import { computeOrganicInsights, type MetaPostMin } from "@/lib/organic-insights";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

// =============================================================================
// /api/cron/organic-insights
//
// Calcula insights del orgánico Drean (IG + FB) sobre los últimos 30 días vs
// los 30 días previos, y upsertea los resultados en insights_log.
//
// Disparado por GitHub Actions diariamente. Idempotente: el upsert por
// (categoria, signal_key) reemplaza la fila si la misma señal vuelve a
// emitirse.
// =============================================================================

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

async function supabaseUpsert(
  table: string,
  rows: unknown[],
  onConflict: string,
): Promise<string> {
  if (rows.length === 0) return "sin data";
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 400)}`);
  }
  return `${rows.length} filas OK`;
}

async function supabaseSelect<T>(
  table: string,
  query: string,
): Promise<T[]> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status}: ${body.slice(0, 400)}`);
  }
  return res.json() as Promise<T[]>;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  try {
    const today = new Date();
    const day30 = new Date(today);
    day30.setUTCDate(day30.getUTCDate() - 30);
    const day60 = new Date(today);
    day60.setUTCDate(day60.getUTCDate() - 60);

    const iso = (d: Date) => d.toISOString();
    results.range_current = `${iso(day30)} → ${iso(today)}`;
    results.range_previous = `${iso(day60)} → ${iso(day30)}`;

    // Fetch posts (últimos 60 días para tener current + previous)
    const allPosts = await supabaseSelect<MetaPostMin>(
      "meta_posts",
      `select=platform,post_id,fecha_post,permalink,message,media_type,reach,engagement,reactions,video_views&fecha_post=gte.${iso(day60)}&fecha_post=lte.${iso(today)}&limit=10000`,
    );
    results.posts_fetched = allPosts.length;

    const currentPeriod = allPosts.filter((p) => p.fecha_post >= iso(day30));
    const previousPeriod = allPosts.filter((p) => p.fecha_post < iso(day30) && p.fecha_post >= iso(day60));
    results.posts_current = currentPeriod.length;
    results.posts_previous = previousPeriod.length;

    const insights = computeOrganicInsights({ currentPeriod, previousPeriod });
    results.insights_generated = insights.length;

    // Upsert
    const rows = insights.map((i) => ({
      categoria: "organico_drean",
      signal_key: i.signal_key,
      prioridad: i.prioridad,
      tipo: i.tipo,
      titulo: i.titulo,
      descripcion: i.descripcion,
      acciones: i.acciones,
      datos: i.datos,
      fecha_generado: new Date().toISOString(),
      estado: "nuevo",
    }));
    results.upsert = await supabaseUpsert("insights_log", rows, "categoria,signal_key");

    // Devolvemos preview de las top 5 señales generadas
    results.top5 = insights.slice(0, 5).map((i) => ({
      prioridad: i.prioridad,
      tipo: i.tipo,
      titulo: i.titulo,
    }));

    return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message, results }, { status: 500 });
  }
}
