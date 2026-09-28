import { NextResponse } from "next/server";
import { partFacebook, partInstagram, partWeb, partFbFollowers, newCtx } from "@/lib/competencia-scraper";
import { igApifyToca } from "@/lib/competencia-scraper-core";

// Scraper de competencia en CÓDIGO — reemplaza a n8n (ver docs/n8n-migracion.md). Workflow competencia-social.yml.
//   ?part=fb      Facebook de las 5 marcas (diario, como n8n 07:00 UTC)
//   ?part=ig      Instagram por Apify SOLO para comentarios/sentimiento/pin (días COMPETENCIA_IG_APIFY_DIAS, default lunes;
//                 ?force=1 lo corre igual). Las métricas diarias de IG vienen de Business Discovery (competencia-ig).
//   ?part=web     SimilarWeb → competitor_web (semanal, como n8n domingo 00:00 UTC)
//   ?part=fbfol   Seguidores de las Páginas de FB → social_followers (semanal; nuevo, n8n no lo tenía)
//   ?dry=1        corre actores + LLM y devuelve las filas SIN escribir (para scripts/n8n-paridad.ts). Funciona con el flag apagado.
// Guarda: COMPETENCIA_SCRAPER_CODE=1 habilita la escritura (así n8n y el código no corren dos veces por accidente).
// Cupo de Apify agotado → las partes siguientes se saltean y se informa (`apifySinCupo`).

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const u = new URL(request.url);
  const dry = u.searchParams.get("dry") === "1";
  const force = u.searchParams.get("force") === "1";
  const parts = (u.searchParams.get("part") ?? "fb").split(",").map((s) => s.trim()).filter(Boolean);
  const enabled = process.env.COMPETENCIA_SCRAPER_CODE === "1";
  if (!enabled && !dry) {
    return NextResponse.json({ ok: true, estado: "desactivado", motivo: "COMPETENCIA_SCRAPER_CODE != 1 (n8n sigue siendo la fuente). Usá ?dry=1 para comparar.", parts });
  }
  const num = (k: string) => { const n = Number(u.searchParams.get(k)); return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined; };
  const ctx = newCtx(dry);
  const results: Record<string, unknown> = {};
  for (const p of parts) {
    try {
      if (p === "fb") results.fb = await partFacebook(ctx, { limit: num("limit"), analizarTodos: u.searchParams.get("analizar") === "todos" });
      else if (p === "ig") {
        results.ig = force || dry || igApifyToca(process.env.COMPETENCIA_IG_APIFY_DIAS, new Date())
          ? await partInstagram(ctx, { posts: num("posts"), dias: num("dias") })
          : { estado: "no_toca_hoy", dias: process.env.COMPETENCIA_IG_APIFY_DIAS ?? "1 (lunes)" };
      } else if (p === "web") results.web = await partWeb(ctx);
      else if (p === "fbfol") results.fbfol = await partFbFollowers(ctx);
      else results[p] = { estado: "parte_desconocida" };
    } catch (e) {
      results[p] = { estado: "error", error: (e as Error).message.slice(0, 240) };
    }
  }
  const estados = Object.values(results).map((r) => (r as { estado?: string }).estado);
  // ok:false solo ante un error inesperado o de escritura (el workflow lo marca en rojo); sin cupo = estado.
  const ok = !estados.some((e) => e === "error" || e === "error_escritura" || e === "error_apify");
  return NextResponse.json({ ok, dry, timestamp: new Date().toISOString(), apifySinCupo: ctx.quota.stopped ? ctx.quota.message : undefined, results });
}
