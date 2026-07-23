import { NextResponse } from "next/server";

// Helper de OAuth de TikTok: intercambia el `auth_code` (que TikTok devuelve en el
// redirect después de autorizar la app) por el `access_token` de larga duración y
// la lista de `advertiser_id` accesibles. NO escribe nada: sólo devuelve el token
// para que lo cargues como secret TIKTOK_ACCESS_TOKEN.
//
// Flujo:
//  1) Abrir (como admin de la cuenta):
//       https://business-api.tiktok.com/portal/auth?app_id=<APP_ID>&state=x&redirect_uri=<REDIRECT>
//  2) TikTok redirige a <REDIRECT>?auth_code=XXXX  → copiar ese auth_code.
//  3) GET /api/diag/tiktok-oauth?auth_code=XXXX  → devuelve access_token + advertiser_ids.

export const dynamic = "force-dynamic";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

export async function GET(request: Request) {
  const out: Record<string, unknown> = {};
  try {
    const code = new URL(request.url).searchParams.get("auth_code");
    if (!code) {
      out.error = "Falta ?auth_code=... (lo devuelve TikTok en el redirect tras autorizar la app)";
      return NextResponse.json(out, { status: 400 });
    }
    const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: env("TIKTOK_APP_ID"),
        secret: env("TIKTOK_APP_SECRET"),
        auth_code: code,
      }),
    });
    const json = (await res.json()) as {
      code?: number;
      message?: string;
      data?: { access_token?: string; advertiser_ids?: string[]; scope?: string[] };
    };
    if (json.code !== 0) {
      out.error = `TikTok oauth code=${json.code}: ${json.message ?? ""}`;
      return NextResponse.json(out, { status: 502 });
    }
    out.ok = true;
    out.access_token = json.data?.access_token; // → cargar como TIKTOK_ACCESS_TOKEN
    out.advertiser_ids = json.data?.advertiser_ids; // → cargar como TIKTOK_ADVERTISER_ID (coma-separado)
    out.scope = json.data?.scope;
    out.siguiente = "Cargá access_token y advertiser_ids como secrets, luego probá /api/diag/tiktok-access";
    return NextResponse.json(out);
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }
}
