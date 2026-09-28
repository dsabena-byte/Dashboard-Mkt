import { NextResponse } from "next/server";
import { mirrorImageStrict, uploadBucketJson } from "@/lib/meta-image-mirror";
import {
  DV360_ADVERTISER_ID,
  DV360_MANIFEST_KEY,
  DV360_THUMBS_PREFIX,
  resolveThumbs,
  thumbCandidates,
  type Dv360ApiCreative,
  type Dv360ThumbEntry,
  type Dv360ThumbManifest,
} from "@/lib/dv360-thumbs-shared";

// Miniaturas de las piezas de DV360 (SOLO LECTURA de la Display & Video 360 API).
// Los números de DV360 NO cambian: siguen llegando del reporte de OMD (Apps Script → dv360_creatives), que solo
// trae el NOMBRE del creative. Acá: lista TODOS los creatives del anunciante Drean, baja la imagen (simgad / YouTube),
// la espeja al bucket `meta-thumbs` (dv360/<creativeId>.jpg, si ya está no se re-baja) y escribe el manifiesto
// `dv360/index.json` (nombre → url) que lee /performance. Sin migración.
//
// GET /api/cron/dv360-thumbs          → sincroniza
// GET /api/cron/dv360-thumbs?dry=1    → solo prueba la descarga de las primeras imágenes, no escribe nada
// GET /api/cron/dv360-thumbs?adv=<id> → otro anunciante (default 8003891470 "Drean Argentina")
// Protegido con CRON_SECRET (workflow dv360-thumbs.yml).

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const API = "https://displayvideo.googleapis.com/v4";
const CONCURRENCY = 6;
const DRY_SAMPLE = 8;

async function accessToken(): Promise<{ token: string; scopes: string[] }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN ?? "",
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`OAuth refresh ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { access_token: string; scope?: string };
  return { token: data.access_token, scopes: (data.scope ?? "").split(" ").filter(Boolean) };
}

async function listCreatives(token: string, adv: string): Promise<Dv360ApiCreative[]> {
  const out: Dv360ApiCreative[] = [];
  let pageToken = "";
  for (let i = 0; i < 50; i++) {
    const qs = new URLSearchParams({ pageSize: "200" });
    if (pageToken) qs.set("pageToken", pageToken);
    const res = await fetch(`${API}/advertisers/${adv}/creatives?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`DV360 creatives ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as { creatives?: Dv360ApiCreative[]; nextPageToken?: string };
    out.push(...(body.creatives ?? []));
    pageToken = body.nextPageToken ?? "";
    if (!pageToken) break;
  }
  return out;
}

/** Nombres de creative que usa el dash (dv360_creatives), para medir cuántos matchean. */
async function reportNames(): Promise<string[]> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return [];
  const names = new Set<string>();
  for (let off = 0; off < 50_000; off += 1000) {
    const r = await fetch(`${base}/rest/v1/dv360_creatives?select=creative&order=mes,canal,categoria,rol,creative&limit=1000&offset=${off}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!r.ok) break;
    const rows = (await r.json()) as { creative: string | null }[];
    for (const x of rows) if (x.creative) names.add(x.creative);
    if (rows.length < 1000) break;
  }
  return [...names];
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]!);
      }
    }),
  );
  return out;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const dry = url.searchParams.get("dry") === "1";
  const adv = url.searchParams.get("adv") || DV360_ADVERTISER_ID;
  const t0 = Date.now();
  try {
    const { token, scopes } = await accessToken();
    if (!scopes.some((s) => s.endsWith("/display-video"))) {
      return NextResponse.json({ ok: false, estado: "no_scope", error: "GOOGLE_REFRESH_TOKEN sin scope display-video" }, { status: 500 });
    }
    const creatives = await listCreatives(token, adv);
    const porTipo: Record<string, number> = {};
    for (const c of creatives) porTipo[c.creativeType ?? "?"] = (porTipo[c.creativeType ?? "?"] ?? 0) + 1;

    const conImagen = creatives
      .map((c) => ({ c, cand: thumbCandidates(c) }))
      .filter((x): x is { c: Dv360ApiCreative; cand: NonNullable<ReturnType<typeof thumbCandidates>> } => !!x.cand && !!x.c.creativeId);
    const sinImagen = creatives.length - conImagen.length;
    const trabajo = dry ? conImagen.slice(0, DRY_SAMPLE) : conImagen;

    const hostOk: Record<string, number> = {};
    const failures: { id: string; nombre: string; error: string }[] = [];
    let nuevas = 0, yaEstaban = 0;
    const results = await pool(trabajo, CONCURRENCY, async ({ c, cand }) => {
      const key = `${DV360_THUMBS_PREFIX}/${c.creativeId}.jpg`;
      let lastErr = "sin URL";
      for (const src of cand.urls) {
        const r = await mirrorImageStrict(src, key, { dry });
        if (r.ok) {
          const host = r.already ? "bucket" : new URL(src).host;
          hostOk[host] = (hostOk[host] ?? 0) + 1;
          if (r.already) yaEstaban++; else nuevas++;
          const e: Dv360ThumbEntry = {
            creativeId: c.creativeId!,
            name: c.displayName ?? "",
            url: r.url,
            w: c.dimensions?.widthPixels ?? null,
            h: c.dimensions?.heightPixels ?? null,
            type: cand.type,
          };
          return e;
        }
        lastErr = `${new URL(src).host}: ${r.error}`;
      }
      failures.push({ id: c.creativeId!, nombre: c.displayName ?? "", error: lastErr });
      return null;
    });
    const items = results.filter((x): x is Dv360ThumbEntry => !!x);

    // Cobertura contra los nombres que usa el dash (solo informativo).
    const nombres = await reportNames().catch(() => [] as string[]);
    const { map, unmatched } = resolveThumbs(nombres, items);
    const porVia = Object.values(map).reduce<Record<string, number>>((a, t) => ((a[t.via] = (a[t.via] ?? 0) + 1), a), {});

    let manifest: { ok: boolean; url?: string; error?: string; skipped?: boolean } = { ok: true, skipped: true, error: "dry-run: no se escribe" };
    if (!dry) {
      const m: Dv360ThumbManifest = { generatedAt: new Date().toISOString(), advertiserId: adv, items };
      // Un error transitorio que dejó 0 imágenes NO pisa un manifiesto bueno.
      manifest = items.length > 0 ? await uploadBucketJson(DV360_MANIFEST_KEY, m) : { ok: false, error: "0 imágenes: no se pisa el manifiesto" };
    }

    return NextResponse.json({
      ok: dry ? failures.length < trabajo.length || trabajo.length === 0 : manifest.ok,
      dry,
      advertiserId: adv,
      creatives: creatives.length,
      porTipo,
      conImagen: conImagen.length,
      sinImagen,
      procesadas: trabajo.length,
      espejadas: items.length,
      nuevas,
      yaEstaban,
      hostOk,
      failures: failures.slice(0, 30),
      failuresTotal: failures.length,
      manifest,
      reporte: {
        nombres: nombres.filter((n) => n !== "Unknown").length,
        // En dry-run solo se cruza contra la muestra de DRY_SAMPLE imágenes → el match real sale en la corrida completa.
        matcheados: Object.keys(map).length,
        ...(dry ? { nota: `dry-run: match solo contra ${trabajo.length} imágenes de muestra` } : {}),
        porVia,
        sinMatch: unmatched,
      },
      muestra: items.slice(0, 5).map((i) => ({ nombre: i.name, url: i.url, tipo: i.type })),
      ms: Date.now() - t0,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 }, { status: 500 });
  }
}
