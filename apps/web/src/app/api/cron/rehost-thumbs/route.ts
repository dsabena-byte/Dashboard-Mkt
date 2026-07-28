import { NextResponse } from "next/server";
import { sbAdmin } from "@/lib/supabase-admin";
import { mirrorMetaImage } from "@/lib/meta-image-mirror";

// Re-hostea las miniaturas de competencia (social_posts.thumbnail_url) a Supabase
// Storage, porque las URLs del CDN de IG/FB caducan en 1-2 días. Toma las filas
// cuyo thumbnail_url todavía apunta a un CDN externo (no re-hosteado), baja la
// imagen y la sube al bucket, y pisa thumbnail_url con la URL permanente.
//
// Trigger: GitHub Actions (.github/workflows/rehost-thumbs.yml), varias veces al
// día para agarrar las imágenes nuevas antes de que caduquen.
//   ?dry=1  → no re-hostea, sólo lista lo que haría.
//   ?limit=N → máximo de filas a procesar (default 150).

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TABLE = "social_posts";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dry = url.searchParams.get("dry") === "1";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 150), 1), 400);

  const supaHost = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const rehostedPrefix = `${supaHost}/storage/v1/object/public/`;

  // Filas con miniatura seteada. Filtramos en código las ya re-hosteadas
  // (las que ya apuntan a nuestro Storage).
  const q = `${TABLE}?select=id,thumbnail_url&thumbnail_url=not.is.null&order=fecha.desc&limit=${limit * 3}`;
  const res = await sbAdmin(q, { method: "GET" });
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: `read ${res.status}: ${(await res.text()).slice(0, 300)}` }, { status: 500 });
  }
  const rows = (await res.json()) as { id: string; thumbnail_url: string }[];
  const pendientes = rows.filter((r) => r.thumbnail_url && !r.thumbnail_url.startsWith(rehostedPrefix)).slice(0, limit);

  if (dry) {
    return NextResponse.json({ ok: true, dry: true, pendientes: pendientes.length, sample: pendientes.slice(0, 10) });
  }

  let rehosted = 0;
  let failed = 0;
  for (const r of pendientes) {
    try {
      const permanent = await mirrorMetaImage(r.thumbnail_url, `competencia/${r.id}.jpg`);
      if (permanent && permanent.startsWith(rehostedPrefix)) {
        await sbAdmin(`${TABLE}?id=eq.${r.id}`, { method: "PATCH", body: JSON.stringify({ thumbnail_url: permanent }) });
        rehosted++;
      } else {
        // mirrorMetaImage devuelve la URL original si la descarga/subida falló
        // (p.ej. URL ya caducada). La dejamos para reintentar en la próxima corrida.
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ ok: true, procesadas: pendientes.length, rehosted, failed });
}
