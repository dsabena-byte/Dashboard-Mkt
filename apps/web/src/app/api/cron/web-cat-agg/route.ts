import { NextResponse } from "next/server";

// Precalcula la distribución mensual de usuarios web por categoría en
// web_monthly_by_category. Lee la vista lenta vw_drean_web_by_category (~8.8s) UNA
// vez acá, en background, para que el ingreso a Seguimiento Objetivos no la pague.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

interface DiaCatRow { fecha: string; categoria: string | null; usuarios: number | null; sesiones: number | null; conversiones: number | null; pageviews: number | null; bounce_rate: number | null }

// Lee la vista con paginación por Range (supera 1000 filas/año).
async function fetchAll(url: string, key: string, query: string): Promise<DiaCatRow[]> {
  const out: DiaCatRow[] = [];
  const page = 1000;
  for (let from = 0; from < 200_000; from += page) {
    const res = await fetch(`${url}/rest/v1/${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + page - 1}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`vw_drean_web_by_category ${res.status}: ${await res.text()}`);
    const rows = (await res.json()) as DiaCatRow[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

async function supabaseUpsert(url: string, key: string, table: string, rows: unknown[], onConflict: string): Promise<string> {
  if (rows.length === 0) return "sin data";
  const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) return `error ${res.status}: ${await res.text()}`;
  return `${rows.length} filas OK`;
}

interface MesCanalRow { mes: string; canal: string; sesiones: number | null; conversiones: number | null; pageviews: number | null }
async function syncMonthlyByChannel(url: string, key: string, now: string): Promise<string> {
  const res = await fetch(`${url}/rest/v1/vw_drean_web_monthly_by_channel?select=mes,canal,sesiones,conversiones,pageviews&order=mes`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store",
  });
  if (!res.ok) return `vista ${res.status}: ${(await res.text()).slice(0, 200)}`;
  const rows = ((await res.json()) as MesCanalRow[])
    .filter((r) => r.mes && r.canal)
    .map((r) => ({ mes: r.mes, canal: r.canal, sesiones: r.sesiones ?? 0, conversiones: r.conversiones ?? 0, pageviews: r.pageviews ?? 0, updated_at: now }));
  if (!rows.length) return "sin data";
  for (let i = 0; i < rows.length; i += 500) {
    const r = await supabaseUpsert(url, key, "web_monthly_by_channel", rows.slice(i, i + 500), "mes,canal");
    if (r.includes("error")) return r;
  }
  await fetch(`${url}/rest/v1/web_monthly_by_channel?updated_at=lt.${encodeURIComponent(now)}`, {
    method: "DELETE", headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=minimal" },
  }).catch(() => null);
  return `${rows.length} filas OK`;
}

// (4) KPIs mensuales → web_monthly_kpis (0151). vw_drean_web_monthly tarda ~6 s (agrega web_traffic entera).
interface MesKpiRow { mes: string; sesiones: number | null; pageviews: number | null; bounce_rate: number | null; avg_session_duration: number | null }
async function syncMonthlyKpis(url: string, key: string, now: string): Promise<string> {
  const res = await fetch(`${url}/rest/v1/vw_drean_web_monthly?select=mes,sesiones,pageviews,bounce_rate,avg_session_duration&order=mes`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store",
  });
  if (!res.ok) return `vista ${res.status}: ${(await res.text()).slice(0, 200)}`;
  const rows = ((await res.json()) as MesKpiRow[])
    .filter((r) => r.mes)
    .map((r) => ({ mes: r.mes, sesiones: r.sesiones ?? 0, pageviews: r.pageviews ?? 0, bounce_rate: r.bounce_rate, avg_session_duration: r.avg_session_duration, updated_at: now }));
  return supabaseUpsert(url, key, "web_monthly_kpis", rows, "mes");
}

// (5) Top productos por MES → web_top_products_monthly (0151). El RPC tarda ~6 s por semana: se paga acá,
// para el mes en curso y los 2 anteriores (de a uno, sin paralelo: el RPC se cortaba por timeout) (el tablero abre en el último mes cerrado). Top 200 por mes.
interface ProdRow { landing_page: string; sku: string | null; producto_slug: string | null; categoria: string | null; sesiones: number | null; usuarios: number | null; conversiones: number | null; pageviews: number | null }
async function syncTopProducts(url: string, key: string, now: string): Promise<string> {
  const hoy = new Date();
  const uno = async (k: number): Promise<string> => {
    const ini = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - k, 1));
    const fin = new Date(Date.UTC(ini.getUTCFullYear(), ini.getUTCMonth() + 1, 0));
    const mes = ini.toISOString().slice(0, 10);
    const semanas: { from: string; to: string }[] = [];
    for (let d = new Date(ini); d <= fin; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 7))) {
      const h = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 6));
      semanas.push({ from: d.toISOString().slice(0, 10), to: (h > fin ? fin : h).toISOString().slice(0, 10) });
    }
    // De a una semana: en paralelo las consultas se cortaban por statement timeout (23-nov-2026).
    const partes: ProdRow[][] = [];
    for (const w of semanas) partes.push(await (async () => {
      const r = await fetch(`${url}/rest/v1/rpc/top_products_in_range`, {
        method: "POST", cache: "no-store",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_from: w.from, p_to: w.to, p_limit: 200 }),
      });
      if (!r.ok) throw new Error(`rpc ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return (await r.json()) as ProdRow[];
    })());
    const map = new Map<string, ProdRow & { sesiones: number; usuarios: number; conversiones: number; pageviews: number }>();
    for (const row of partes.flat()) {
      const acc = map.get(row.landing_page);
      if (acc) { acc.sesiones += row.sesiones ?? 0; acc.usuarios += row.usuarios ?? 0; acc.conversiones += row.conversiones ?? 0; acc.pageviews += row.pageviews ?? 0; }
      else map.set(row.landing_page, { ...row, sesiones: row.sesiones ?? 0, usuarios: row.usuarios ?? 0, conversiones: row.conversiones ?? 0, pageviews: row.pageviews ?? 0 });
    }
    const filas = [...map.values()].sort((a, b) => b.sesiones - a.sesiones).slice(0, 200).map((r) => ({
      mes, landing_page: r.landing_page, sku: r.sku, producto_slug: r.producto_slug, categoria: r.categoria,
      sesiones: r.sesiones, usuarios: r.usuarios, conversiones: r.conversiones, pageviews: r.pageviews, updated_at: now,
    }));
    const up = await supabaseUpsert(url, key, "web_top_products_monthly", filas, "mes,landing_page");
    if (up.includes("error")) return `${mes.slice(0, 7)}: ${up}`;
    await fetch(`${url}/rest/v1/web_top_products_monthly?mes=eq.${mes}&updated_at=lt.${encodeURIComponent(now)}`, {
      method: "DELETE", headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=minimal" },
    }).catch(() => null);
    return `${mes.slice(0, 7)}: ${filas.length}`;
  };
  const res: string[] = [];
  for (const k of [2, 1, 0]) res.push(await uno(k).catch((e) => `error: ${e instanceof Error ? e.message : String(e)}`));
  return res.join(" · ");
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = env("NEXT_PUBLIC_SUPABASE_URL");
    const key = env("SUPABASE_SERVICE_ROLE_KEY");
    const year = new Date().getUTCFullYear();

    // Lee el año actual + el anterior (para YoY / rangos históricos del dash).
    const rows = await fetchAll(url, key, `vw_drean_web_by_category?fecha=gte.${year - 1}-01-01&fecha=lte.${year}-12-31&select=fecha,categoria,usuarios,sesiones,conversiones,pageviews,bounce_rate`);

    const now = new Date().toISOString();

    // (1) DIARIO por categoría → web_daily_by_category (lo que lee getWebByCategory).
    const daily = rows
      .filter((r) => r.fecha && r.categoria)
      .map((r) => ({
        fecha: r.fecha, categoria: r.categoria, usuarios: r.usuarios ?? 0, sesiones: r.sesiones ?? 0,
        conversiones: r.conversiones ?? 0, pageviews: r.pageviews ?? 0, bounce_rate: r.bounce_rate, updated_at: now,
      }));

    // (2) MENSUAL por categoría → web_monthly_by_category (lo que lee el Seguimiento).
    const agg = new Map<string, { mes: string; categoria: string; usuarios: number; sesiones: number; conversiones: number }>();
    for (const r of rows) {
      if (!r.fecha || !r.categoria) continue;
      const mes = `${r.fecha.slice(0, 7)}-01`;
      const k = `${mes}|${r.categoria}`;
      const e = agg.get(k) ?? { mes, categoria: r.categoria, usuarios: 0, sesiones: 0, conversiones: 0 };
      e.usuarios += r.usuarios ?? 0; e.sesiones += r.sesiones ?? 0; e.conversiones += r.conversiones ?? 0;
      agg.set(k, e);
    }
    const monthly = [...agg.values()].map((e) => ({ ...e, updated_at: now }));

    // Upsert diario en lotes (pueden ser miles de filas).
    let dailyOk = 0;
    for (let i = 0; i < daily.length; i += 500) {
      const res = await supabaseUpsert(url, key, "web_daily_by_category", daily.slice(i, i + 500), "fecha,categoria");
      if (res.includes("error")) return NextResponse.json({ ok: false, error: `daily ${res}` }, { status: 500 });
      dailyOk += Math.min(500, daily.length - i);
    }
    const monthlyRes = await supabaseUpsert(url, key, "web_monthly_by_category", monthly, "mes,categoria");

    // (3) MENSUAL por canal → web_monthly_by_channel (migración 0121; lo leen señales, Seguimiento, /web y
    // el copiloto vía lib/web-monthly-channel.ts). La vista agrega web_traffic entera (~5 s): se paga acá.
    // Historia completa (son ~15 canales × mes); las filas que esta corrida no tocó se borran (canal que
    // dejó de existir). No fatal: sin la migración, los lectores caen a la vista.
    const channelRes = await syncMonthlyByChannel(url, key, now).catch((e) => `error: ${e instanceof Error ? e.message : String(e)}`);

    // (4) y (5): no fatales; sin la migración 0151 los lectores caen a la vista / RPC.
    // En serie: en paralelo con el resto se cortaban por statement timeout.
    const kpisRes = await syncMonthlyKpis(url, key, now).catch((e) => `error: ${e instanceof Error ? e.message : String(e)}`);
    const productosRes = await syncTopProducts(url, key, now).catch((e) => `error: ${e instanceof Error ? e.message : String(e)}`);

    return NextResponse.json({ ok: true, dias_leidos: rows.length, daily_upsert: dailyOk, monthly_upsert: monthly.length, monthlyRes, channelRes, kpisRes, productosRes });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
