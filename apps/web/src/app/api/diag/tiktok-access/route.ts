import { NextResponse } from "next/server";

// Diagnóstico de acceso a la TikTok Marketing API. NO escribe nada: verifica que
// el access token funciona, lista los advertisers autorizados y corre un reporte
// mínimo para confirmar que los campos de video responden con data real. Es el
// "gate" de validación: hasta que esto devuelva datos reales, no confiamos en
// ningún número del conector.
//
// Uso:
//   GET /api/diag/tiktok-access                       → lista advertisers autorizados
//   GET /api/diag/tiktok-access?advertiser=ID&days=7  → reporte chico de esa cuenta

export const dynamic = "force-dynamic";

const TT_API = "https://business-api.tiktok.com/open_api/v1.3";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

async function ttGet(path: string, params: Record<string, string>, token: string): Promise<unknown> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${TT_API}${path}?${qs}`, {
    method: "GET",
    headers: { "Access-Token": token, "Content-Type": "application/json" },
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { http_status: res.status, body: text.slice(0, 1500) };
  }
}

export async function GET(request: Request) {
  const out: Record<string, unknown> = {};
  try {
    const token = env("TIKTOK_ACCESS_TOKEN");
    const url = new URL(request.url);
    const advertiser = url.searchParams.get("advertiser")?.replace(/\D/g, "");
    const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 7), 1), 90);

    if (!advertiser) {
      // Paso 1: ¿qué advertisers ve este token? (confirma app + token + scope)
      out.authorizedAdvertisers = await ttGet(
        "/oauth2/advertiser/get/",
        { app_id: env("TIKTOK_APP_ID"), secret: env("TIKTOK_APP_SECRET") },
        token,
      );
      return NextResponse.json(out);
    }

    // Paso 2: reporte mínimo a nivel AD — confirma que el embudo de video responde.
    const to = new Date();
    to.setUTCDate(to.getUTCDate() - 1);
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - (days - 1));
    out.info = await ttGet(
      "/advertiser/info/",
      { advertiser_ids: JSON.stringify([advertiser]), fields: JSON.stringify(["name", "currency", "timezone"]) },
      token,
    );
    out.report = await ttGet(
      "/report/integrated/get/",
      {
        advertiser_id: advertiser,
        report_type: "BASIC",
        data_level: "AUCTION_AD",
        dimensions: JSON.stringify(["ad_id", "stat_time_day"]),
        metrics: JSON.stringify([
          "ad_name", "spend", "impressions", "clicks",
          "video_play_actions", "video_views_p25", "video_views_p50", "video_views_p75", "video_views_p100",
          "likes", "comments", "shares",
        ]),
        start_date: from.toISOString().slice(0, 10),
        end_date: to.toISOString().slice(0, 10),
        page: "1",
        page_size: "20",
      },
      token,
    );
    return NextResponse.json(out);
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }
}
