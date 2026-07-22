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

    // Soporte para backfill: ?days=180 para traer más historial
    const reqUrl = new URL(request.url);
    const daysParam = Number(reqUrl.searchParams.get("days") ?? 30);
    const days = Math.min(Math.max(daysParam, 1), 365);

    const toDate = new Date();
    toDate.setUTCDate(toDate.getUTCDate() - 1);
    const fromDate = new Date(toDate);
    fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1));
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
        bounce_rate: Number(r.metricValues[3]?.value ?? 0),
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
        bounce_rate: Number(r.metricValues[3]?.value ?? 0),
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
        // eventCount = transacciones; purchaseRevenue = Total de ingresos (≠ inversión).
        metrics: [{ name: "eventCount" }, { name: "purchaseRevenue" }],
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
      const revenue = Number(r.metricValues[1]?.value ?? 0);
      const existing = purchaseMap.get(key);
      if (existing) {
        (existing.purchases as number) += count;
        (existing.revenue as number) += revenue;
      } else {
        purchaseMap.set(key, { fecha, utm_source: source, utm_medium: medium, utm_campaign: campaign, purchases: count, revenue });
      }
    }

    results.purchaseUpsert = await supabaseUpsert(
      "ga4_purchases_daily",
      [...purchaseMap.values()].filter((r) => r.fecha && String(r.fecha).length === 10),
      "fecha,utm_source,utm_medium,utm_campaign",
    );

    // =====================================================
    // REPORT 5: Inversión por campaña (→ ga4_ads_cost_daily)
    // ----------------------------------------------------
    // advertiserAdCost = cuánta plata se GASTÓ en cada campaña (≠ revenue).
    // Requiere Google Ads vinculado a la propiedad GA4; si no lo está, GA4
    // devuelve error y seguimos sin romper el resto del sync.
    let costRows: GA4Row[] = [];
    try {
      costRows = await runReport(accessToken, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: "date" },
          { name: "sessionSource" },
          { name: "sessionMedium" },
          { name: "sessionCampaignName" },
        ],
        metrics: [
          { name: "advertiserAdCost" },
          { name: "advertiserAdClicks" },
          { name: "advertiserAdImpressions" },
        ],
        limit: 100000,
      });
    } catch (err) {
      results.cost_error = err instanceof Error ? err.message : "no disponible (¿Google Ads vinculado a GA4?)";
    }

    const costMap = new Map<string, Record<string, unknown>>();
    for (const r of costRows) {
      const fecha = fmtDate(r.dimensionValues[0]?.value ?? "");
      const source = normUtm(r.dimensionValues[1]?.value);
      const medium = normUtm(r.dimensionValues[2]?.value);
      const campaign = normUtm(r.dimensionValues[3]?.value);
      const cost = Number(r.metricValues[0]?.value ?? 0);
      const clicks = Number(r.metricValues[1]?.value ?? 0);
      const impressions = Number(r.metricValues[2]?.value ?? 0);
      if (cost === 0 && clicks === 0 && impressions === 0) continue;
      const key = `${fecha}|${source}|${medium}|${campaign}`;
      const existing = costMap.get(key);
      if (existing) {
        (existing.cost as number) += cost;
        (existing.ad_clicks as number) += clicks;
        (existing.ad_impressions as number) += impressions;
      } else {
        costMap.set(key, { fecha, utm_source: source, utm_medium: medium, utm_campaign: campaign, cost, ad_clicks: clicks, ad_impressions: impressions });
      }
    }

    if (costMap.size > 0) {
      results.costUpsert = await supabaseUpsert(
        "ga4_ads_cost_daily",
        [...costMap.values()].filter((r) => r.fecha && String(r.fecha).length === 10),
        "fecha,utm_source,utm_medium,utm_campaign",
      );
    }

    // =====================================================
    // REPORT 5B: Inversión Google Ads por campaña REAL (→ ga4_google_ads_daily)
    // ----------------------------------------------------
    // Usa las dimensiones NATIVAS de Google Ads que expone la GA4 Data API
    // (googleAdsAccountName/CustomerId/CampaignId/Name/Type). Requiere el link
    // GA4↔Google Ads.
    //
    // ⚠️ El property tiene vinculada una cuenta MANAGER (MCC) de la agencia de
    // ecommerce con MUCHAS marcas (Nike, BK, Farmaonline, etc.), así que este
    // reporte ve TODAS. Por eso SÓLO guardamos las cuentas de Drean (allowlist
    // por Customer ID). Con la allowlist vacía no se guarda nada, pero el sync
    // devuelve el inventario de cuentas vinculadas en `results.gads_accounts`
    // para poder identificar la de Drean/OMD y cargar su Customer ID acá.
    const DREAN_ADS_CUSTOMER_IDS: string[] = [
      // "1234567890", // ecommerce (inhouse) — completar con el CID real
      // "9876543210", // OMD Marketing — completar con el CID real
    ];

    let gadsRows: GA4Row[] = [];
    try {
      gadsRows = await runReport(accessToken, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: "date" },
          { name: "googleAdsAccountName" },
          { name: "googleAdsCustomerId" },
          { name: "googleAdsCampaignId" },
          { name: "googleAdsCampaignName" },
          { name: "googleAdsCampaignType" },
        ],
        metrics: [
          { name: "advertiserAdCost" },
          { name: "advertiserAdClicks" },
          { name: "advertiserAdImpressions" },
          { name: "advertiserAdCostPerClick" },
        ],
        limit: 100000,
      });
    } catch (err) {
      results.gads_error = err instanceof Error ? err.message : "no disponible (¿Google Ads vinculado a GA4?)";
    }

    // Inventario de cuentas vinculadas (diagnóstico para validar el link y
    // encontrar el Customer ID de Drean/OMD).
    const acctAgg = new Map<string, { account: string; customer_id: string; campaigns: Set<string>; cost: number; drean: boolean }>();
    const gadsMap = new Map<string, Record<string, unknown>>();
    for (const r of gadsRows) {
      const fecha = fmtDate(r.dimensionValues[0]?.value ?? "");
      const account = r.dimensionValues[1]?.value ?? "";
      const customerId = (r.dimensionValues[2]?.value ?? "").replace(/-/g, "");
      const campaignId = r.dimensionValues[3]?.value ?? "";
      const campaignName = r.dimensionValues[4]?.value ?? "";
      const campaignType = r.dimensionValues[5]?.value ?? null;
      if (!campaignId || campaignId === "(not set)") continue;
      const cost = Number(r.metricValues[0]?.value ?? 0);
      const clicks = Number(r.metricValues[1]?.value ?? 0);
      const impressions = Number(r.metricValues[2]?.value ?? 0);
      const cpc = Number(r.metricValues[3]?.value ?? 0);
      if (cost === 0 && clicks === 0 && impressions === 0) continue;

      // Diagnóstico de cuentas.
      const acct = acctAgg.get(customerId) ?? { account, customer_id: customerId, campaigns: new Set<string>(), cost: 0, drean: false };
      acct.campaigns.add(campaignName);
      acct.cost += cost;
      // Señal de Drean: nombre de cuenta o campaña que la delata.
      const sig = `${account} ${campaignName}`.toLowerCase();
      if (/drean|mabe|ardr|inhouse.*(lavarrop|heladera|cocina|refriger)/.test(sig)) acct.drean = true;
      acctAgg.set(customerId, acct);

      // Sólo acumulamos filas de cuentas de Drean (allowlist).
      if (!DREAN_ADS_CUSTOMER_IDS.includes(customerId)) continue;
      const key = `${fecha}|${campaignId}`;
      const existing = gadsMap.get(key);
      if (existing) {
        (existing.cost as number) += cost;
        (existing.clicks as number) += clicks;
        (existing.impressions as number) += impressions;
      } else {
        gadsMap.set(key, {
          fecha,
          customer_id: customerId,
          account_name: account === "(not set)" ? "" : account,
          campaign_id: campaignId,
          campaign_name: campaignName === "(not set)" ? "" : campaignName,
          campaign_type: campaignType === "(not set)" ? null : campaignType,
          cost,
          clicks,
          impressions,
          cpc,
        });
      }
    }
    // Recalcular CPC agregado (costo/clicks) para filas fusionadas.
    for (const v of gadsMap.values()) {
      const c = v.clicks as number;
      v.cpc = c > 0 ? Math.round(((v.cost as number) / c) * 100) / 100 : (v.cpc as number);
    }

    // Cuentas de Drean detectadas (lo importante para validar el link y sacar el CID).
    results.gads_drean_accounts = [...acctAgg.values()]
      .filter((a) => a.drean)
      .sort((a, b) => b.cost - a.cost)
      .map((a) => ({ account: a.account, customer_id: a.customer_id, campañas: a.campaigns.size, costo: Math.round(a.cost) }));
    // Inventario general (top por gasto) por si hay que revisar a mano.
    results.gads_accounts = [...acctAgg.values()]
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 40)
      .map((a) => ({ account: a.account, customer_id: a.customer_id, campañas: a.campaigns.size, costo: Math.round(a.cost) }));
    results.gadsRows = gadsRows.length;
    results.gads_allowlist = DREAN_ADS_CUSTOMER_IDS.length;
    if (gadsMap.size > 0) {
      results.gadsUpsert = await supabaseUpsert(
        "ga4_google_ads_daily",
        [...gadsMap.values()].filter((r) => r.fecha && String(r.fecha).length === 10),
        "fecha,campaign_id",
      );
    } else {
      results.gadsUpsert = "0 (allowlist vacía o sin cuentas de Drean; ver gads_accounts)";
    }

    // =====================================================
    // REPORT 6: Productos comprados por campaña (→ ga4_items_daily)
    // ----------------------------------------------------
    // itemsPurchased + itemRevenue por ítem, filtrado a campañas inhouse_*.
    // Si GA4 rechaza la combinación item-scope + sessionCampaignName, se captura
    // el error y el sync sigue sin romper.
    let itemRows: GA4Row[] = [];
    try {
      itemRows = await runReport(accessToken, {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: "date" },
          { name: "sessionCampaignName" },
          { name: "itemName" },
        ],
        metrics: [{ name: "itemsPurchased" }, { name: "itemRevenue" }],
        dimensionFilter: {
          filter: {
            fieldName: "sessionCampaignName",
            stringFilter: { value: "inhouse", matchType: "BEGINS_WITH", caseSensitive: false },
          },
        },
        limit: 100000,
      });
    } catch (err) {
      results.items_error = err instanceof Error ? err.message : "no disponible";
    }

    const itemMap = new Map<string, Record<string, unknown>>();
    for (const r of itemRows) {
      const fecha = fmtDate(r.dimensionValues[0]?.value ?? "");
      const campaign = normUtm(r.dimensionValues[1]?.value);
      const itemName = r.dimensionValues[2]?.value ?? "";
      if (!itemName || itemName === "(not set)") continue;
      const purchased = Number(r.metricValues[0]?.value ?? 0);
      const revenue = Number(r.metricValues[1]?.value ?? 0);
      if (purchased === 0 && revenue === 0) continue;
      const key = `${fecha}|${campaign}|${itemName}`;
      const existing = itemMap.get(key);
      if (existing) {
        (existing.items_purchased as number) += purchased;
        (existing.item_revenue as number) += revenue;
      } else {
        itemMap.set(key, { fecha, utm_campaign: campaign, item_name: itemName, items_purchased: purchased, item_revenue: revenue });
      }
    }

    if (itemMap.size > 0) {
      results.itemsUpsert = await supabaseUpsert(
        "ga4_items_daily",
        [...itemMap.values()].filter((r) => r.fecha && String(r.fecha).length === 10),
        "fecha,utm_campaign,item_name",
      );
    }

    // =====================================================
    // REPORT 4: Usuarios únicos por mes (→ ga4_monthly_users)
    // ----------------------------------------------------
    // IMPORTANTE: este reporte NO usa el `?days=` del request porque
    // GA4 devuelve un valor por mes calendario incluido en el rango.
    // Si pedimos solo los últimos 3 días, GA4 nos da yearMonth=202606
    // con sesiones de Jun 1-3, y el upsert por `mes` sobreescribe el
    // total mensual con esos pocos días. Para evitar perder data
    // histórica, siempre pedimos desde el inicio del año actual hasta
    // ayer (incluye el mes en curso completo + meses anteriores).
    const monthlyStart = `${new Date().getUTCFullYear()}-01-01`;
    try {
      const monthlyRows = await runReport(accessToken, {
        dateRanges: [{ startDate: monthlyStart, endDate }],
        dimensions: [{ name: "yearMonth" }],
        metrics: [
          { name: "totalUsers" },
          { name: "newUsers" },
          { name: "sessions" },
          { name: "screenPageViews" },
        ],
      });

      const monthlyUpsertRows = monthlyRows.map((r) => {
        const ym = r.dimensionValues[0]?.value ?? "";
        const mes = `${ym.slice(0, 4)}-${ym.slice(4, 6)}-01`;
        return {
          mes,
          total_users: Number(r.metricValues[0]?.value ?? 0),
          new_users: Number(r.metricValues[1]?.value ?? 0),
          sesiones: Number(r.metricValues[2]?.value ?? 0),
          pageviews: Number(r.metricValues[3]?.value ?? 0),
        };
      });

      results.monthlyUpsert = await supabaseUpsert(
        "ga4_monthly_users",
        monthlyUpsertRows,
        "mes",
      );
    } catch {
      results.monthly_error = "no disponible";
    }

    return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
