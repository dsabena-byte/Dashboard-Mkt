import { NextResponse } from "next/server";
import { partFacebook, partInstagram, partWeb, partFbFollowers, newCtx } from "@/lib/competencia-scraper";
import { igApifyToca, fbToca, FB_DIAS_DEFAULT, IG_APIFY_DIAS_DEFAULT } from "@/lib/competencia-scraper-core";

// Scraper de competencia en CÓDIGO — reemplaza a n8n (ver docs/n8n-migracion.md). Workflow competencia-social.yml.
//   ?part=fb      Facebook de las 5 marcas (días COMPETENCIA_FB_DIAS, default lun y jue; ?force=1 lo corre igual)
//   ?part=ig      Instagram por Apify SOLO para comentarios/sentimiento/pin (días COMPETENCIA_IG_APIFY_DIAS, default lunes;
//                 ?force=1 lo corre igual). Las métricas diarias de IG vienen de Business Discovery (competencia-ig).
//   ?part=web     SimilarWeb → competitor_web (mensual, día 15: el dato de SimilarWeb es mensual)
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
      if (p === "fb") {
        results.fb = force || dry || fbToca(process.env.COMPETENCIA_FB_DIAS, new Date())
          ? await partFacebook(ctx, { limit: num("limit"), analizarTodos: u.searchParams.get("analizar") === "todos" })
          : { estado: "no_toca_hoy", dias: process.env.COMPETENCIA_FB_DIAS ?? `${FB_DIAS_DEFAULT} (lun y jue)` };
      }
      else if (p === "ig") {
        results.ig = force || dry || igApifyToca(process.env.COMPETENCIA_IG_APIFY_DIAS, new Date())
          ? await partInstagram(ctx, { posts: num("posts"), dias: num("dias") })
          : { estado: "no_toca_hoy", dias: process.env.COMPETENCIA_IG_APIFY_DIAS ?? `${IG_APIFY_DIAS_DEFAULT} (lunes)` };
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
