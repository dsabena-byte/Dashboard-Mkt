import { NextResponse } from "next/server";

const GA4_PROPERTY_ID = "250596979";
const GA4_API = "https://analyticsdata.googleapis.com/v1beta";

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
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google OAuth refresh failed ${res.status}: ${body}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

interface GA4Row {
  dimensionValues: Array<{ value: string }>;
  metricValues: Array<{ value: string }>;
}

async function runReport(accessToken: string, body: Record<string, unknown>): Promise<GA4Row[]> {
  const res = await fetch(`${GA4_API}/properties/${GA4_PROPERTY_ID}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 runReport ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { rows?: GA4Row[] };
  return data.rows ?? [];
}

async function supabaseUpsert(table: string, rows: unknown[], onConflict: string): Promise<string> {
  if (rows.length === 0) return "sin data";
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const chunks: unknown[][] = [];
  for (let i = 0; i < rows.length; i += 500) chunks.push(rows.slice(i, i + 500));
  let total = 0;
  for (const chunk of chunks) {
    const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: "POST",
      headers: {
        apikey: key, Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const body = await res.text();
      return `error ${res.status} (chunk ${total}): ${body}`;
    }
    total += chunk.length;
  }
  return `${total} filas OK`;
}

function normUtm(v: string | undefined | null): string | null {
  if (!v || v === "(not set)" || v === "(none)" || v === "(direct)") return null;
  return v.toLowerCase().replace(/\s+/g, "-");
}

function fmtDate(d: string): string {
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  try {
    const accessToken = await getAccessToken();
    results.auth = "OK";

    const toDate = new Date();
    toDate.setUTCDate(toDate.getUTCDate() - 1);
    const fromDate = new Date(toDate);
    fromDate.setUTCDate(fromDate.getUTCDate() - 29);
    const startDate = fromDate.toISOString().slice(0, 10);
    const endDate = toDate.toISOString().slice(0, 10);
    results.range = `${startDate} → ${endDate}`;

    // =====================================================
    // REPORT 1: Tráfico por canal (→ web_traffic, ~15k filas)
    // =====================================================
    const mainRows = await runReport(accessToken, {
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: "date" },
        { name: "sessionSource" },
        { name: "sessionMedium" },
        { name: "sessionCampaignName" },
      ],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
        { name: "screenPageViews" },
      ],
      limit: 100000,
    });
    results.mainRows = mainRows.length;

    const trafficRows: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    for (const r of mainRows) {
      const fecha = fmtDate(r.dimensionValues[0]?.value ?? "");
      const source = normUtm(r.dimensionValues[1]?.value);
      const medium = normUtm(r.dimensionValues[2]?.value);
      const campaign = normUtm(r.dimensionValues[3]?.value);
      const key = `${fecha}|${source}|${medium}|${campaign}`;
      if (seen.has(key)) continue;
      seen.add(key);
      trafficRows.push({
        fecha,
        utm_source: source,
        utm_medium: medium,
        utm_campaign: campaign,
        sesiones: Number(r.metricValues[0]?.value ?? 0),
        usuarios: Number(r.metricValues[1]?.value ?? 0),
        usuarios_nuevos: Number(r.metricValues[2]?.value ?? 0),
        bounce_rate: Number(r.metricValues[3]?.value ?? 0) / 100,
        avg_session_duration: Number(r.metricValues[4]?.value ?? 0),
        pageviews: Number(r.metricValues[5]?.value ?? 0),
        conversiones: 0,
        eventos_clave: 0,
      });
    }

    results.trafficUpsert = await supabaseUpsert(
      "web_traffic",
      trafficRows,
      "fecha,utm_source,utm_medium,utm_campaign,utm_content,landing_page",
    );

    // =====================================================
    // REPORT 2: Landing pages (→ web_landing_daily, ~10k filas)
    // =====================================================
    let landingRows: GA4Row[] = [];
    try {
      landingRows = await runReport(accessToken, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: "date" },
          { name: "landingPagePlusQueryString" },
        ],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "newUsers" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
          { name: "screenPageViews" },
        ],
        limit: 50000,
      });
    } catch {
      results.landing_error = "no disponible";
    }
    results.landingApiRows = landingRows.length;

    const landingUpsertRows: Array<Record<string, unknown>> = [];
    const seenLanding = new Set<string>();
    for (const r of landingRows) {
      const fecha = fmtDate(r.dimensionValues[0]?.value ?? "");
      const lp = r.dimensionValues[1]?.value ?? "";
      if (!lp || lp === "(not set)") continue;
      const key = `${fecha}|${lp}`;
      if (seenLanding.has(key)) continue;
      seenLanding.add(key);
      landingUpsertRows.push({
        fecha,
        landing_page: lp,
        sesiones: Number(r.metricValues[0]?.value ?? 0),
        usuarios: Number(r.metricValues[1]?.value ?? 0),
        usuarios_nuevos: Number(r.metricValues[2]?.value ?? 0),
        bounce_rate: Number(r.metricValues[3]?.value ?? 0) / 100,
        avg_session_duration: Number(r.metricValues[4]?.value ?? 0),
        pageviews: Number(r.metricValues[5]?.value ?? 0),
      });
    }

    results.landingUpsert = await supabaseUpsert(
      "web_landing_daily",
      landingUpsertRows,
      "fecha,landing_page",
    );

    // =====================================================
    // REPORT 3: Purchases (→ ga4_purchases_daily)
    // =====================================================
    let purchaseRows: GA4Row[] = [];
    try {
      purchaseRows = await runReport(accessToken, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: "date" },
          { name: "sessionSource" },
          { name: "sessionMedium" },
          { name: "sessionCampaignName" },
          { name: "eventName" },
        ],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            stringFilter: { value: "purchase", matchType: "EXACT" },
          },
        },
        limit: 100000,
      });
    } catch {
      results.purchases_error = "no disponible";
    }

    const purchaseMap = new Map<string, Record<string, unknown>>();
    for (const r of purchaseRows) {
      const fecha = fmtDate(r.dimensionValues[0]?.value ?? "");
      const source = normUtm(r.dimensionValues[1]?.value);
      const medium = normUtm(r.dimensionValues[2]?.value);
      const campaign = normUtm(r.dimensionValues[3]?.value);
      const key = `${fecha}|${source}|${medium}|${campaign}`;
      const count = Number(r.metricValues[0]?.value ?? 0);
      const existing = purchaseMap.get(key);
      if (existing) {
        (existing.purchases as number) += count;
      } else {
        purchaseMap.set(key, { fecha, utm_source: source, utm_medium: medium, utm_campaign: campaign, purchases: count });
      }
    }

    results.purchaseUpsert = await supabaseUpsert(
      "ga4_purchases_daily",
      [...purchaseMap.values()].filter((r) => r.fecha && String(r.fecha).length === 10),
      "fecha,utm_source,utm_medium,utm_campaign",
    );

    return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
