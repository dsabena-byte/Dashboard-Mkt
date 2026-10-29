import { NextResponse } from "next/server";
import { postKey } from "@/lib/post-snapshots-core";
import { guardarComentarios, type ComentarioRow } from "@/lib/social-comments";
import { analyze } from "@/lib/competencia-scraper";
import type { TaggedPost } from "@/lib/competencia-scraper-core";

// Comentarios de los posts PROPIOS de Instagram (dreanargentina) por la API de Meta (gratis, con el token de la
// Página) → social_post_comments + sentimiento de social_posts con el mismo prompt del scraper (gpt-4o-mini).
//   ?desde=YYYY-MM-DD   posts desde esa fecha (default: últimos 30 días)
//   ?todos=1            reclasifica también los que ya tienen % (sin esto: solo los vacíos y los de <30 días)
//   ?dry=1              lee y clasifica, NO escribe
// Corta a los ~240 s y devuelve `restantes` (el workflow vuelve a llamar).

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com/v22.0";
const MARCA = "dreanargentina";
const DAY = 86_400_000;

async function graph<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(`Graph ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j as T;
}
function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase no configurado");
  return { url, h: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } };
}

interface Post { id: number; url: string; fecha: string; copy: string | null; positivo: number | null }
interface Media { id: string; permalink?: string; timestamp?: string; comments_count?: number }

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const t0 = Date.now();
  const u = new URL(req.url);
  const dry = u.searchParams.get("dry") === "1";
  const todos = u.searchParams.get("todos") === "1";
  const desde = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get("desde") ?? "") ? u.searchParams.get("desde")! : new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10);
  const reciente = new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10);
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) return NextResponse.json({ ok: false, error: "META_SYSTEM_USER_TOKEN no configurado" }, { status: 500 });

  try {
    const c = sb();
    // Token de la Página con la cuenta de IG (los comentarios de IG lo exigen).
    const pages = await graph<{ data?: { access_token?: string; instagram_business_account?: { id?: string; username?: string } }[] }>(
      `${GRAPH}/me/accounts?fields=access_token,instagram_business_account{id,username}&access_token=${token}`);
    const page = pages.data?.find((p) => p.instagram_business_account?.username === MARCA) ?? pages.data?.find((p) => p.instagram_business_account?.id);
    const igId = page?.instagram_business_account?.id, pageToken = page?.access_token;
    if (!igId || !pageToken) return NextResponse.json({ ok: false, error: "No se encontró la Página con Instagram" }, { status: 500 });

    // Posts de social_posts del período y media de la cuenta (para el id que pide la API).
    const pr = await fetch(`${c.url}/rest/v1/social_posts?select=id,url,fecha,copy,positivo&red_social=eq.INSTAGRAM&marca=eq.${MARCA}&fecha=gte.${desde}&order=fecha`, { headers: c.h, cache: "no-store" });
    if (!pr.ok) throw new Error(`Supabase ${pr.status}`);
    const posts = (await pr.json()) as Post[];
    const media = new Map<string, Media>();
    let next: string | undefined = `${GRAPH}/${igId}/media?fields=id,permalink,timestamp,comments_count&limit=100&access_token=${pageToken}`;
    while (next) {
      const j: { data?: Media[]; paging?: { next?: string } } = await graph(next);
      for (const m of j.data ?? []) if (m.permalink) media.set(postKey(m.permalink), m);
      const ultimo = j.data?.[j.data.length - 1]?.timestamp;
      next = ultimo && ultimo.slice(0, 10) < desde ? undefined : j.paging?.next;
    }

    const aClasificar: TaggedPost[] = [];
    const filas: ComentarioRow[] = [];
    let sinMedia = 0, restantes = 0, leidos = 0;
    for (const p of posts) {
      if (!(todos || p.positivo == null || p.fecha >= reciente)) continue;
      if (Date.now() - t0 > 200_000) { restantes++; continue; }
      const m = media.get(postKey(p.url));
      if (!m) { sinMedia++; continue; }
      const textos: string[] = [];
      if ((m.comments_count ?? 0) > 0) {
        let url: string | undefined = `${GRAPH}/${m.id}/comments?fields=id,text,timestamp,like_count&limit=100&access_token=${pageToken}`;
        for (let pag = 0; url && pag < 5; pag++) {
          const j: { data?: { id: string; text?: string; timestamp?: string; like_count?: number }[]; paging?: { next?: string } } = await graph(url);
          for (const x of j.data ?? []) {
            const t = (x.text ?? "").trim();
            if (!t) continue;
            textos.push(t);
            filas.push({ clave: x.id, post_url: p.url, post_key: postKey(p.url), red_social: "INSTAGRAM", marca: MARCA, texto: t.slice(0, 2000), like_count: x.like_count ?? null, fecha: x.timestamp ?? null, fuente: "graph" });
          }
          url = j.paging?.next;
        }
      }
      leidos++;
      // El prompt toma hasta 20 comentarios: se usan los más recientes (la API los da del más nuevo al más viejo).
      if (textos.length) aClasificar.push({ url: p.url, caption: p.copy ?? "", commentTexts: textos } as TaggedPost);
    }

    const guardado = dry ? { guardados: 0 } : await guardarComentarios(filas);
    const { map, errores } = await analyze(aClasificar);
    const cambios: { url: string; positivo: number; negativo: number; neutro: number }[] = [];
    for (const p of aClasificar) {
      const s = map.get(p.url)?.sentimiento;
      if (!s) continue;
      const n = (v: unknown) => Math.round(Number(v) || 0);
      cambios.push({ url: p.url, positivo: n(s.positivo), negativo: n(s.negativo), neutro: n(s.neutro) });
    }
    if (!dry) {
      for (const x of cambios) {
        // resumen en null → el cron ig-sentiment-analysis lo regenera con los % nuevos.
        const r = await fetch(`${c.url}/rest/v1/social_posts?url=eq.${encodeURIComponent(x.url)}`, {
          method: "PATCH", headers: c.h, cache: "no-store",
          body: JSON.stringify({ positivo: x.positivo, negativo: x.negativo, neutro: x.neutro, resumen_sentimiento: null, updated_at: new Date().toISOString() }),
        });
        if (!r.ok) errores.push(`PATCH ${r.status}`);
      }
    }
    return NextResponse.json({
      ok: errores.length === 0 && !guardado.error, dry, desde, posts: posts.length, leidos, sinMedia, restantes,
      comentarios: filas.length, guardados: guardado.guardados, errorGuardado: guardado.error,
      clasificados: cambios.length, errores, ms: Date.now() - t0, muestra: dry ? cambios.slice(0, 50) : undefined,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
