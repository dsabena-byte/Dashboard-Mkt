import { NextResponse } from "next/server";

// Trae los comentarios de las piezas UGC vía Graph API (no solo el post público que
// ve Apify). Para cada pieza: saca del ad el effective_instagram_media_id (IG) y/o
// effective_object_story_id (FB), y lee los comentarios con el token del system user.
// Guarda en ugc_comments (misma tabla que Apify). Reporta qué vía funcionó.
// ?batch=N (default 10).

export const maxDuration = 60;

const GRAPH_API = "https://graph.facebook.com/v22.0";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

async function graphGet<T = unknown>(url: string): Promise<{ ok: boolean; body: T; error?: string }> {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) return { ok: false, body: body as T, error: JSON.stringify(body).slice(0, 200) };
  return { ok: true, body: body as T };
}

async function sb<T>(path: string, init?: RequestInit): Promise<T> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  if (init?.method && init.method !== "GET") return {} as T;
  return res.json() as Promise<T>;
}

interface IgComment { text?: string; username?: string; timestamp?: string; like_count?: number }
interface FbComment { message?: string; from?: { name?: string }; created_time?: string; like_count?: number }

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const batch = Math.min(Math.max(parseInt(url.searchParams.get("batch") ?? "10", 10) || 10, 1), 30);

  try {
    const token = env("META_SYSTEM_USER_TOKEN");
    // Piezas UGC (una por ad_id, con su permalink).
    const pieces = await sb<Array<{ ad_id: string; instagram_permalink_url: string | null }>>(
      "meta_paid_creatives?select=ad_id,instagram_permalink_url&categoria=eq.UGC&instagram_permalink_url=not.is.null",
    );
    // dedupe por permalink (una pieza por post).
    const byLink = new Map<string, string>();
    for (const p of pieces) if (p.instagram_permalink_url && !byLink.has(p.instagram_permalink_url)) byLink.set(p.instagram_permalink_url, p.ad_id);
    const entries = [...byLink.entries()].slice(0, batch);

    const processed: Array<{ permalink: string; via: string; comments: number; media_id?: string; owner?: string; media_type?: string; error?: string }> = [];

    for (const [permalink, adId] of entries) {
      let comments: Array<{ text: string; author: string | null; likes: number; date: string | null }> = [];
      let via = "none";
      let lastError: string | undefined;

      // 1) Ids del creative del ad.
      const adRes = await graphGet<{ creative?: { effective_instagram_media_id?: string; effective_object_story_id?: string } }>(
        `${GRAPH_API}/${adId}?fields=creative{effective_instagram_media_id,effective_object_story_id}&access_token=${token}`,
      );
      const igMediaId = adRes.body?.creative?.effective_instagram_media_id;
      const storyId = adRes.body?.creative?.effective_object_story_id;
      if (!adRes.ok) lastError = adRes.error;

      // Diagnóstico: de qué cuenta es la media y su tipo.
      let owner: string | undefined;
      let mediaType: string | undefined;
      if (igMediaId) {
        const m = await graphGet<{ username?: string; media_type?: string; owner?: { username?: string } }>(
          `${GRAPH_API}/${igMediaId}?fields=username,media_type,owner{username}&access_token=${token}`,
        );
        if (m.ok) {
          owner = m.body.owner?.username ?? m.body.username;
          mediaType = m.body.media_type;
        } else if (!lastError) lastError = m.error;
      }

      // 2) IG media comments.
      if (igMediaId) {
        const r = await graphGet<{ data?: IgComment[]; error?: unknown }>(
          `${GRAPH_API}/${igMediaId}/comments?fields=text,username,timestamp,like_count&limit=100&access_token=${token}`,
        );
        if (r.ok && r.body.data) {
          comments = r.body.data.filter((c) => (c.text ?? "").trim()).map((c) => ({ text: (c.text ?? "").slice(0, 2000), author: c.username ?? null, likes: Math.round(Number(c.like_count ?? 0) || 0), date: c.timestamp ?? null }));
          via = "ig_media";
        } else lastError = r.error ?? lastError;
      }
      // 3) Fallback: FB post comments.
      if (comments.length === 0 && storyId) {
        const r = await graphGet<{ data?: FbComment[]; error?: unknown }>(
          `${GRAPH_API}/${storyId}/comments?fields=message,from,created_time,like_count&limit=100&access_token=${token}`,
        );
        if (r.ok && r.body.data) {
          comments = r.body.data.filter((c) => (c.message ?? "").trim()).map((c) => ({ text: (c.message ?? "").slice(0, 2000), author: c.from?.name ?? null, likes: Math.round(Number(c.like_count ?? 0) || 0), date: c.created_time ?? null }));
          via = via === "ig_media" ? via : "fb_story";
        } else lastError = r.error ?? lastError;
      }

      // 4) Guardar (si trajo algo, reemplaza lo de ese permalink).
      try {
        if (comments.length > 0) {
          await sb(`ugc_comments?permalink=eq.${encodeURIComponent(permalink)}`, { method: "DELETE" });
          await sb("ugc_comments", {
            method: "POST",
            body: JSON.stringify(comments.map((c) => ({ permalink, author: c.author, comment_text: c.text, like_count: c.likes, comment_date: c.date }))),
          });
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }

      processed.push({ permalink, via, comments: comments.length, media_id: igMediaId, owner, media_type: mediaType, ...(lastError && comments.length === 0 ? { error: lastError } : {}) });
    }

    return NextResponse.json({ ok: true, piezas: byLink.size, procesados: entries.length, processed });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
