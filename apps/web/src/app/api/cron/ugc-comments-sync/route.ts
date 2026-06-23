import { NextResponse } from "next/server";

// Scrapea (Apify) los comentarios del post de IG de cada pieza UGC y los guarda en
// ugc_comments. Idempotente por permalink: borra los existentes y reinserta.
// ?batch=N (default 5) limita cuántos permalinks procesa por corrida.
// ?force=1 reprocesa también los que ya tienen comentarios.

export const maxDuration = 60;

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
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

interface ApifyComment {
  text?: string;
  ownerUsername?: string;
  username?: string;
  likesCount?: number;
  timestamp?: string;
}

async function scrapeComments(postUrl: string): Promise<ApifyComment[]> {
  const token = env("APIFY_API_TOKEN");
  const res = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directUrls: [postUrl], resultsType: "comments", resultsLimit: 100 }),
    },
  );
  if (!res.ok) throw new Error(`Apify ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const items = (await res.json()) as ApifyComment[];
  return items.filter((i) => (i.text ?? "").trim().length > 0);
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const batch = Math.min(Math.max(parseInt(url.searchParams.get("batch") ?? "5", 10) || 5, 1), 20);
  const force = url.searchParams.get("force") === "1";

  try {
    // Permalinks de las piezas UGC (IG).
    const ugc = await sb<Array<{ instagram_permalink_url: string | null }>>(
      "meta_paid_creatives?select=instagram_permalink_url&categoria=eq.UGC&instagram_permalink_url=not.is.null",
    );
    const permalinks = [...new Set(ugc.map((r) => r.instagram_permalink_url).filter((p): p is string => !!p))];

    // Ya scrapeados (para no repetir, salvo force).
    let done = new Set<string>();
    if (!force) {
      const existing = await sb<Array<{ permalink: string }>>("ugc_comments?select=permalink");
      done = new Set(existing.map((r) => r.permalink));
    }
    const pending = permalinks.filter((p) => !done.has(p));
    const toProcess = pending.slice(0, batch);

    const processed: Array<{ permalink: string; comments: number }> = [];
    let errors = 0;
    for (const permalink of toProcess) {
      try {
        const comments = await scrapeComments(permalink);
        // Idempotente: borrar y reinsertar.
        await sb(`ugc_comments?permalink=eq.${encodeURIComponent(permalink)}`, { method: "DELETE" });
        if (comments.length > 0) {
          const rows = comments.slice(0, 100).map((c) => ({
            permalink,
            author: c.ownerUsername ?? c.username ?? null,
            comment_text: (c.text ?? "").slice(0, 2000),
            like_count: Math.round(Number(c.likesCount ?? 0) || 0),
            comment_date: c.timestamp ?? null,
          }));
          await sb("ugc_comments", { method: "POST", body: JSON.stringify(rows) });
        }
        processed.push({ permalink, comments: comments.length });
      } catch (e) {
        errors++;
        processed.push({ permalink, comments: -1 });
        void e;
      }
    }

    return NextResponse.json({
      ok: errors === 0,
      total_ugc: permalinks.length,
      ya_scrapeados: done.size,
      procesados: toProcess.length,
      restantes: pending.length - toProcess.length,
      errors,
      processed,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
