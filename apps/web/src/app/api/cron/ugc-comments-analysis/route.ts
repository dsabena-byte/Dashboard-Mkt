import { NextResponse } from "next/server";

// Analiza con LLM los comentarios de cada pieza UGC (de ugc_comments) y guarda el
// resultado en ugc_piece_analysis: credibilidad, intención de compra, percepción de
// marca y mejoras de contenido/guión. ?batch=N (default 5), ?force=1 reanaliza todo.

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

interface Analysis {
  resumen: string;
  credibilidad: { nivel: string; detalle: string };
  intencion_compra: { nivel: string; detalle: string };
  percepcion_marca: { nivel: string; detalle: string };
  mejoras: string[];
}

async function analyze(adName: string, comments: string[]): Promise<Analysis> {
  const apiKey = env("OPENAI_API_KEY");
  const prompt = `Sos un estratega de contenido de marketing. Analizás los comentarios de una pieza UGC (creador genera contenido) de Drean (electrodomésticos) para validar el contenido y mejorar futuros guiones.

Pieza: "${adName}"
Comentarios (${comments.length}):
${comments.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Devolvé SOLO un JSON con esta forma exacta (en español, conciso y accionable):
{
  "resumen": "1-2 oraciones con el balance general",
  "credibilidad": {"nivel": "alta|media|baja", "detalle": "¿el contenido se percibe creíble/auténtico o como publicidad? evidencia de los comentarios"},
  "intencion_compra": {"nivel": "alta|media|baja", "detalle": "¿hay señales de que mueve la intención de compra? ej. preguntas de precio/dónde comprar, ganas de tenerlo"},
  "percepcion_marca": {"nivel": "positiva|neutra|negativa", "detalle": "¿cómo queda parada la marca? sentimiento + temas"},
  "mejoras": ["mejora concreta de contenido/guión 1", "mejora 2", "mejora 3"]
}
Si hay pocos comentarios, igual inferí lo que puedas y aclará la limitación en el resumen.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 700,
      temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return JSON.parse(data.choices[0]?.message?.content ?? "{}") as Analysis;
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
    // Permalinks con comentarios.
    const withComments = await sb<Array<{ permalink: string }>>("ugc_comments?select=permalink");
    const counts = new Map<string, number>();
    for (const r of withComments) counts.set(r.permalink, (counts.get(r.permalink) ?? 0) + 1);
    // Ya analizados (para saltarlos salvo force).
    const done = force ? new Set<string>() : new Set((await sb<Array<{ permalink: string }>>("ugc_piece_analysis?select=permalink")).map((r) => r.permalink));
    const pending = [...counts.keys()].filter((p) => !done.has(p));
    const toProcess = pending.slice(0, batch);

    // Nombre de la pieza por permalink (para contexto del prompt).
    const pieces = await sb<Array<{ ad_name: string | null; instagram_permalink_url: string | null }>>(
      "meta_paid_creatives?select=ad_name,instagram_permalink_url&categoria=eq.UGC",
    );
    const nameByLink = new Map<string, string>();
    for (const p of pieces) if (p.instagram_permalink_url) nameByLink.set(p.instagram_permalink_url, p.ad_name ?? "");

    const processed: Array<{ permalink: string; n: number; status: string }> = [];
    let errors = 0;
    for (const permalink of toProcess) {
      try {
        const rows = await sb<Array<{ comment_text: string }>>(
          `ugc_comments?select=comment_text&permalink=eq.${encodeURIComponent(permalink)}&limit=100`,
        );
        const comments = rows.map((r) => r.comment_text).filter(Boolean);
        const analysis = await analyze(nameByLink.get(permalink) ?? "", comments);
        await sb("ugc_piece_analysis?on_conflict=permalink", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify([{ permalink, n_comments: comments.length, analysis, updated_at: new Date().toISOString() }]),
        });
        processed.push({ permalink, n: comments.length, status: "ok" });
      } catch (e) {
        errors++;
        processed.push({ permalink, n: 0, status: `error: ${(e instanceof Error ? e.message : String(e)).slice(0, 80)}` });
      }
    }

    return NextResponse.json({ ok: errors === 0, con_comentarios: counts.size, procesados: toProcess.length, restantes: pending.length - toProcess.length, errors, processed });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
