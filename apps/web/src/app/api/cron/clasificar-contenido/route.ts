import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Taxonomía (editable). El cron clasifica el contenido orgánico de Drean
// (meta_posts) por categoría de producto y por pilar de contenido.
// Categorías alineadas con las de pauta (pauta_performance).
const CATEGORIAS = ["Brand", "Lavado", "Refrigeración", "Cocción", "Promoción"] as const;
const PILARES = [
  "Liderazgo marca/porfolio",
  "Calidad superior",
  "Respaldo Posventa",
  "Elegir bien",
  "Experiencia uso",
] as const;

const PILAR_DEFS = `
- "Liderazgo marca/porfolio": liderazgo, portfolio de productos único, superioridad/premium tangible, tecnología propia.
- "Calidad superior": convierte la calidad de Drean en evidencia; durabilidad y calidad que se siente ("toda tu vida").
- "Respaldo Posventa": el servicio/posventa como argumento de compra; red instalada como diferencial (vs marcas sin servicio).
- "Elegir bien": compra inteligente; costo oculto/riesgo de comprar barato vs lo que realmente conviene y da tranquilidad.
- "Experiencia uso": experiencias REALES de uso/testimonios que validan la elección y conectan emocionalmente.`;

const CATEGORIA_DEFS = `
- "Lavado": lavarropas, secarropas, lavasecarropas.
- "Refrigeración": heladeras, freezers.
- "Cocción": cocinas, hornos, anafes, microondas.
- "Promoción": ofertas, descuentos, financiación/cuotas, % off o eventos comerciales (Drean Week, Hot Sale, Cyber, etc.).
- "Brand": institucional/marca o multi-categoría sin foco en un producto ni en una promo.`;

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

async function supabaseQuery<T>(query: string): Promise<T> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${url}/rest/v1/${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function supabasePatch(platform: string, postId: string, data: Record<string, unknown>): Promise<number> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const q = `meta_posts?platform=eq.${encodeURIComponent(platform)}&post_id=eq.${encodeURIComponent(postId)}`;
  const res = await fetch(`${url}/rest/v1/${q}`, {
    method: "PATCH",
    cache: "no-store",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${res.status}: ${await res.text()}`);
  const updated = (await res.json()) as unknown[];
  return Array.isArray(updated) ? updated.length : 0;
}

interface PostRow {
  platform: string;
  post_id: string;
  message: string | null;
}

interface Clasif {
  i: number;
  categoria: string;
  pilar: string;
  confianza: number;
}

async function classifyBatch(posts: PostRow[]): Promise<Map<number, Clasif>> {
  const apiKey = env("OPENAI_API_KEY");
  const list = posts
    .map((p, i) => `${i + 1}. ${(p.message ?? "").replace(/\s+/g, " ").slice(0, 500)}`)
    .join("\n");

  const prompt = `Sos analista de marketing de Drean (electrodomésticos, Argentina). Clasificá cada post orgánico según su CATEGORÍA de producto y su PILAR de contenido.

CATEGORÍAS válidas:${CATEGORIA_DEFS}

PILARES válidos:${PILAR_DEFS}

Posts (caption):
${list}

Reglas:
- Si el post muestra o menciona un tipo de producto específico (lavarropas, heladera, cocina, etc.), usá ESA categoría aunque el tono sea de marca.
- Si es una promo/oferta/evento comercial (Drean Week, Hot Sale, cuotas, % off), usá "Promoción".
- Usá "Brand" solo si es institucional/multi-categoría, sin foco de producto ni promo.

Devolvé SOLO un JSON: {"items":[{"i":<número>,"categoria":"<una de las categorías>","pilar":"<uno de los pilares>","confianza":<0..1>}]}. Usá EXACTAMENTE los nombres dados.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      response_format: { type: "json_object" },
      max_tokens: 1500,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  const parsed = JSON.parse(data.choices[0]?.message?.content ?? "{}") as { items?: Clasif[] };
  const map = new Map<number, Clasif>();
  for (const it of parsed.items ?? []) {
    const categoria = (CATEGORIAS as readonly string[]).includes(it.categoria) ? it.categoria : "Brand";
    const pilar = (PILARES as readonly string[]).includes(it.pilar) ? it.pilar : null;
    if (pilar) map.set(it.i, { i: it.i, categoria, pilar, confianza: Number(it.confianza) || 0 });
  }
  return map;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reqUrl = new URL(request.url);
  const batchSize = Math.min(Math.max(Number(reqUrl.searchParams.get("batch") ?? 20), 1), 40);
  const results: Record<string, unknown> = {};

  try {
    // Posts orgánicos de Drean (meta_posts) con caption y sin clasificar.
    const posts = await supabaseQuery<PostRow[]>(
      `meta_posts?select=platform,post_id,message&pilar_contenido=is.null&message=not.is.null&order=fecha_post.desc&limit=${batchSize}`,
    );
    results.toProcess = posts.length;

    if (posts.length === 0) {
      return NextResponse.json({ ok: true, message: "Sin posts pendientes de clasificar", results });
    }

    const clasif = await classifyBatch(posts);
    const now = new Date().toISOString();
    let ok = 0;
    const errors: string[] = [];

    for (let i = 0; i < posts.length; i++) {
      const c = clasif.get(i + 1);
      if (!c) continue;
      try {
        const updated = await supabasePatch(posts[i]!.platform, posts[i]!.post_id, {
          categoria: c.categoria,
          pilar_contenido: c.pilar,
          clasif_confianza: c.confianza,
          clasif_at: now,
        });
        ok += updated;
      } catch (e) {
        errors.push(e instanceof Error ? e.message.slice(0, 100) : String(e));
      }
    }
    results.clasificados = ok;
    if (errors.length) results.errors = errors.slice(0, 5);

    const pending = await supabaseQuery<Array<{ post_id: string }>>(
      "meta_posts?select=post_id&pilar_contenido=is.null&message=not.is.null",
    );
    results.pendientes = Array.isArray(pending) ? pending.length : 0;

    return NextResponse.json({ ok: true, timestamp: now, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message, results }, { status: 500 });
  }
}
