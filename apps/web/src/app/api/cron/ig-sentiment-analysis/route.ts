import { NextResponse } from "next/server";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

async function supabaseQuery<T>(query: string, method = "GET"): Promise<T> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${url}/rest/v1/${query}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${res.status}: ${body}`);
  }
  if (method === "GET") return res.json() as Promise<T>;
  return {} as T;
}

async function supabaseUpdate(id: string, data: Record<string, unknown>): Promise<void> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${url}/rest/v1/social_posts?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase PATCH ${res.status}: ${body}`);
  }
}

interface SocialPostRow {
  id: string;
  url: string;
  marca: string;
  red_social: string;
  positivo: number | null;
  negativo: number | null;
  neutro: number | null;
  likes: number | null;
  comentarios: number | null;
}

async function scrapeComments(postUrl: string): Promise<string[]> {
  const token = env("APIFY_API_TOKEN");

  const runRes = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [postUrl],
        resultsType: "comments",
        resultsLimit: 50,
      }),
    },
  );

  if (!runRes.ok) {
    const body = await runRes.text();
    throw new Error(`Apify ${runRes.status}: ${body}`);
  }

  const items = (await runRes.json()) as Array<{ text?: string }>;
  return items
    .map((i) => i.text ?? "")
    .filter((t) => t.length > 0)
    .slice(0, 50);
}

async function analyzeWithGPT(
  comments: string[],
  positivo: number,
  negativo: number,
  neutro: number,
): Promise<string> {
  const apiKey = env("OPENAI_API_KEY");

  const prompt = `Comentarios de Instagram (electrodomésticos). Sentimiento: ${positivo}% pos, ${negativo}% neg, ${neutro}% neu.

${comments.slice(0, 30).map((c, i) => `${i + 1}. ${c}`).join("\n")}

Respuesta: UNA sola oración de máximo 120 caracteres. Formato: "Pos: [tema]. Neg: [tema]." Si no hay negativos, solo "Pos: [tema]." Si no hay positivos, solo "Neg: [tema]." Sin explicaciones extra.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 80,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content?.trim() ?? "Sin análisis disponible.";
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reqUrl = new URL(request.url);
  const batchSize = Number(reqUrl.searchParams.get("batch") ?? 3);
  const results: Record<string, unknown> = {};

  try {
    // 1. Buscar posts con sentimiento pero sin resumen
    const posts = await supabaseQuery<SocialPostRow[]>(
      `social_posts?select=id,url,marca,red_social,positivo,negativo,neutro,likes,comentarios&resumen_sentimiento=is.null&positivo=not.is.null&red_social=eq.INSTAGRAM&order=fecha.desc&limit=${batchSize}`,
    );

    results.postsToProcess = posts.length;

    if (posts.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No hay posts pendientes de análisis",
        results,
      });
    }

    const processed: Array<{ id: string; url: string; status: string }> = [];

    for (const post of posts) {
      try {
        // 2. Scrapear comentarios del post
        const comments = await scrapeComments(post.url);

        if (comments.length === 0) {
          await supabaseUpdate(post.id, {
            resumen_sentimiento: "Sin comentarios disponibles para analizar.",
          });
          processed.push({ id: post.id, url: post.url, status: "sin_comentarios" });
          continue;
        }

        // 3. Analizar con GPT
        const resumen = await analyzeWithGPT(
          comments,
          post.positivo ?? 0,
          post.negativo ?? 0,
          post.neutro ?? 0,
        );

        // 4. Guardar en Supabase
        await supabaseUpdate(post.id, { resumen_sentimiento: resumen });
        processed.push({
          id: post.id,
          url: post.url,
          status: `ok (${comments.length} comentarios)`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await supabaseUpdate(post.id, {
          resumen_sentimiento: `Error: ${msg.slice(0, 100)}`,
        });
        processed.push({ id: post.id, url: post.url, status: `error: ${msg.slice(0, 80)}` });
      }
    }

    results.processed = processed;

    // Contar pendientes restantes
    const pending = await supabaseQuery<Array<{ count: number }>>(
      "social_posts?select=id&resumen_sentimiento=is.null&positivo=not.is.null&red_social=eq.INSTAGRAM",
    );
    results.pendientes = Array.isArray(pending) ? pending.length : 0;

    return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
