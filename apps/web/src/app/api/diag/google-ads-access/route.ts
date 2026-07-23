import { NextResponse } from "next/server";

// Diagnóstico de acceso a la Google Ads API. NO escribe nada: sólo verifica que
// las credenciales + developer token + scope `adwords` funcionan, lista las
// cuentas accesibles y corre una consulta mínima para confirmar que los campos
// de video existen. Es el "gate" de validación: hasta que esto devuelva datos
// reales, no confiamos en ningún número del conector.
//
// Uso:  GET /api/diag/google-ads-access?customer=2703756419&days=7
//   - sin ?customer: lista las cuentas accesibles (customers:listAccessibleCustomers)
//   - con  ?customer: corre un SELECT chico sobre esa cuenta y devuelve filas crudas

export const dynamic = "force-dynamic";

const GADS_API = "https://googleads.googleapis.com/v18";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: env("GOOGLE_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth refresh failed ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; scope?: string };
  return data.access_token;
}

function gadsHeaders(token: string): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "developer-token": env("GOOGLE_ADS_DEVELOPER_TOKEN"),
    "Content-Type": "application/json",
  };
  const login = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  if (login) h["login-customer-id"] = login.replace(/\D/g, "");
  return h;
}

export async function GET(request: Request) {
  const out: Record<string, unknown> = {};
  try {
    const token = await getAccessToken();
    out.auth = "OK";

    const url = new URL(request.url);
    const customer = url.searchParams.get("customer")?.replace(/\D/g, "");
    const days = Math.min(Math.max(Number(url.searchParams.get("days") ?? 7), 1), 90);

    if (!customer) {
      // Paso 1: ¿qué cuentas ve este token? (confirma dev token + scope adwords)
      const res = await fetch(`${GADS_API}/customers:listAccessibleCustomers`, {
        method: "GET",
        headers: gadsHeaders(token),
      });
      const body = await res.text();
      out.listAccessibleCustomers = { status: res.status, body: safeJson(body) };
      return NextResponse.json(out);
    }

    // Paso 2: consulta mínima sobre una cuenta — confirma que los campos de
    // video responden con data real (esto es lo que valida la profundidad).
    const to = new Date();
    to.setUTCDate(to.getUTCDate() - 1);
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - (days - 1));
    const query = `
      SELECT
        segments.date,
        campaign.name,
        campaign.advertising_channel_type,
        ad_group_ad.ad.id,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.interactions,
        metrics.video_views,
        metrics.video_view_rate,
        metrics.video_quartile_p25_rate,
        metrics.video_quartile_p50_rate,
        metrics.video_quartile_p75_rate,
        metrics.video_quartile_p100_rate
      FROM ad_group_ad
      WHERE segments.date BETWEEN '${from.toISOString().slice(0, 10)}' AND '${to.toISOString().slice(0, 10)}'
      ORDER BY metrics.impressions DESC
      LIMIT 20`;
    const res = await fetch(`${GADS_API}/customers/${customer}/googleAds:search`, {
      method: "POST",
      headers: gadsHeaders(token),
      body: JSON.stringify({ query, pageSize: 20 }),
    });
    const body = await res.text();
    out.query = { customer, status: res.status, body: safeJson(body) };
    return NextResponse.json(out);
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 2000);
  }
}
