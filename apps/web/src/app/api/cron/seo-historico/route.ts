import { NextResponse } from "next/server";
import { TRACKED_DOMAINS, LOCATION_CODE_AR, LANGUAGE_CODE_ES } from "@/lib/competitive-config";
import { KEYWORD_UNIVERSE } from "@/lib/seo-keyword-universe";

// Completa un mes faltante de seo_rankings con la foto histórica de DataForSEO Labs
// (historical_serps: una SERP por mes, últimos 12 meses, US$0,00012 por foto).
// Nació para octubre-2026 (la corrida se cortó sin saldo: 196/486 keywords).
//   ?modo=probe&n=5            → NO escribe: meses que devuelve + posición Drean vs nuestra foto (sep/nov) + costo.
//   ?modo=fill&mes=2026-10&fecha=2026-10-07&offset=0&limit=40
//                              → escribe en `fecha` SOLO las keywords sin filas ese mes.
// Trigger: .github/workflows/seo-historico.yml (Authorization: Bearer CRON_SECRET). Gasto aprobado por el user 25-nov-2026.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

type SerpItem = { type?: string; domain?: string; url?: string; rank_group?: number; breadcrumb?: string };
type Snapshot = { datetime?: string; items?: SerpItem[] };

async function historico(keyword: string, desde: string): Promise<{ snaps: Snapshot[]; cost: number; status?: string }> {
  const res = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/historical_serps/live", {
    method: "POST",
    headers: { Authorization: `Basic ${env("DATAFORSEO_AUTH")}`, "Content-Type": "application/json" },
    body: JSON.stringify([{ keyword, location_code: LOCATION_CODE_AR, language_code: LANGUAGE_CODE_ES, date_from: desde }]),
    signal: AbortSignal.timeout(60000),
  });
  const json = (await res.json()) as { status_code?: number; tasks?: Array<{ status_code?: number; status_message?: string; cost?: number; result?: Array<{ items?: Snapshot[] }> }> };
  const t = json.tasks?.[0];
  if (json.status_code === 40200 || t?.status_code === 40200) throw new Error("DataForSEO sin saldo (Payment Required)");
  return { snaps: t?.result?.[0]?.items ?? [], cost: t?.cost ?? 0, status: t?.status_code === 20000 ? undefined : `${t?.status_code} ${t?.status_message}` };
}

function filas(items: SerpItem[]) {
  const out: { dominio: string; marca: string; posicion: number | null; url: string | null }[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (it.type !== "organic") continue;
    const redir = /\/goto\?url=/.test(String(it.url ?? ""));
    const dom = (redir ? (String(it.breadcrumb ?? "").match(/^https?:\/\/([^\s/›]+)/i)?.[1] ?? "") : (it.domain ?? "")).toLowerCase();
    for (const td of TRACKED_DOMAINS) {
      if (dom.includes(td.dominio) && !seen.has(td.display)) {
        seen.add(td.display);
        out.push({ dominio: td.dominio, marca: td.display, posicion: it.rank_group ?? null, url: it.url ?? null });
      }
    }
  }
  return out;
}

async function sb(path: string, init?: RequestInit) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${env("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`Supabase ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const modo = url.searchParams.get("modo") ?? "probe";
  const universo = [...KEYWORD_UNIVERSE].sort((a, b) => b.volume - a.volume);
  const out: Record<string, unknown> = { modo };
  try {
    if (modo === "probe") {
      const n = Math.min(Math.max(Number(url.searchParams.get("n") ?? 5), 1), 10);
      const kws = universo.slice(0, n);
      const nuestras = (await (await sb(`seo_rankings?select=keyword,fecha,posicion&marca=eq.Drean&fecha=gte.2026-08-01&keyword=in.(${encodeURIComponent(kws.map((k) => `"${k.keyword}"`).join(","))})`)).json()) as { keyword: string; fecha: string; posicion: number }[];
      let cost = 0;
      const detalle = [];
      for (const kw of kws) {
        const r = await historico(kw.keyword, "2026-06-01");
        cost += r.cost;
        detalle.push({
          keyword: kw.keyword,
          status: r.status,
          fotos: r.snaps.map((s) => ({ fecha: s.datetime?.slice(0, 10), organicos: (s.items ?? []).filter((i) => i.type === "organic").length, drean: filas(s.items ?? []).find((f) => f.marca === "Drean")?.posicion ?? null })),
          nuestra: nuestras.filter((x) => x.keyword === kw.keyword).map((x) => ({ fecha: x.fecha, drean: x.posicion })),
        });
      }
      out.costo_usd = cost;
      out.detalle = detalle;
      out.ok = true;
      return NextResponse.json(out);
    }

    // fill
    const mes = url.searchParams.get("mes") ?? "2026-10";
    const fecha = url.searchParams.get("fecha") ?? `${mes}-07`;
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 40), 1), 100);
    const [y = 2026, m = 10] = mes.split("-").map(Number);
    const fin = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const hechas = new Set(((await (await sb(`seo_rankings?select=keyword&fecha=gte.${mes}-01&fecha=lte.${fin}&limit=20000`)).json()) as { keyword: string }[]).map((h) => h.keyword));
    const faltan = universo.filter((k) => !hechas.has(k.keyword));
    const chunk = faltan.slice(offset, offset + limit);
    const now = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];
    let cost = 0, sinFoto = 0, sinDominios = 0;
    const CONC = 8;
    for (let i = 0; i < chunk.length; i += CONC) {
      const res = await Promise.all(chunk.slice(i, i + CONC).map(async (kw) => ({ kw, r: await historico(kw.keyword, `${mes}-01`).catch((e) => { if (String(e).includes("sin saldo")) throw e; return null; }) })));
      for (const { kw, r } of res) {
        if (!r) { sinFoto++; continue; }
        cost += r.cost;
        const snap = r.snaps.find((s) => s.datetime?.slice(0, 7) === mes);
        if (!snap) { sinFoto++; continue; }
        const fs = filas(snap.items ?? []);
        if (!fs.length) sinDominios++;
        for (const f of fs) rows.push({ ...f, keyword: kw.keyword, categoria: kw.categoria, search_volume: kw.volume, fecha, fetched_at: now });
      }
    }
    for (let i = 0; i < rows.length; i += 500) {
      await sb("seo_rankings?on_conflict=dominio,keyword,fecha", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows.slice(i, i + 500)) });
    }
    Object.assign(out, { mes, fecha, faltaban: faltan.length, procesadas: chunk.length, sinFoto, sinDominios, quedan: sinFoto + sinDominios, filas: rows.length, costo_usd: cost, resto: Math.max(0, faltan.length - offset - chunk.length), ok: true });
    return NextResponse.json(out);
  } catch (e) {
    out.ok = false;
    out.error = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out, { status: 500 });
  }
}
