import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Taxonomía (editable). El cron clasifica el contenido orgánico de Drean
// (meta_posts) por categoría de producto y por pilar de contenido, MIRANDO LA
// IMAGEN (visión) además del caption. Categorías alineadas con pauta.
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
- "Brand": institucional/marca, o MULTI-CATEGORÍA (la imagen muestra dos o más tipos de producto distintos / portfolio completo) sin foco en un único producto ni promo.`;

const REGLAS = `Reglas (mirá la IMAGEN además del caption; muchas stories no tienen caption, clasificá por la imagen):
- Si la imagen muestra DOS O MÁS categorías de producto distintas juntas (ej. heladera + cocina + lavarropas, o un portfolio/lineup completo) → "Brand".
- Si la imagen muestra UNA sola categoría de producto (aunque sean varias unidades de lo mismo, ej. solo cocinas, o solo heladeras) → ESA categoría, aunque el caption tenga tono de marca.
- Si es promo/oferta/evento comercial (Drean Week, Hot Sale, cuotas, % off) → "Promoción".
- "Brand" también para institucional puro sin producto visible.`;

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
  thumbnail_url: string | null;
  media_type: string | null;
}

interface Clasif {
  categoria: string;
  pilar: string;
  confianza: number;
}

// Clasifica UN post con visión (imagen + caption). Per-post para ser robusto a
// thumbnails caídos: un error no tira abajo el resto del batch.
async function classifyOne(post: PostRow): Promise<Clasif | null> {
  const apiKey = env("OPENAI_API_KEY");
  const caption = (post.message ?? "").replace(/\s+/g, " ").slice(0, 600).trim();

  const prompt = `Sos analista de marketing de Drean (electrodomésticos, Argentina). Clasificá este post orgánico según su CATEGORÍA de producto y su PILAR de contenido.

CATEGORÍAS válidas:${CATEGORIA_DEFS}

PILARES válidos:${PILAR_DEFS}

${REGLAS}

Caption del post: ${caption || "(sin caption — clasificá por la imagen)"}

Devolvé SOLO un JSON: {"categoria":"<una de las categorías>","pilar":"<uno de los pilares>","confianza":<0..1>}. Usá EXACTAMENTE los nombres dados.`;

  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  if (post.thumbnail_url) {
    content.push({ type: "image_url", image_url: { url: post.thumbnail_url, detail: "low" } });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content }],
      temperature: 0.1,
      response_format: { type: "json_object" },
      max_tokens: 200,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  const it = JSON.parse(data.choices[0]?.message?.content ?? "{}") as Partial<Clasif>;
  const categoria = (CATEGORIAS as readonly string[]).includes(it.categoria ?? "") ? it.categoria! : "Brand";
  const pilar = (PILARES as readonly string[]).includes(it.pilar ?? "") ? it.pilar! : null;
  if (!pilar) return null;
  return { categoria, pilar, confianza: Number(it.confianza) || 0 };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reqUrl = new URL(request.url);
  const batchSize = Math.min(Math.max(Number(reqUrl.searchParams.get("batch") ?? 10), 1), 25);
  // force=1 reclasifica también los ya clasificados (para aplicar la nueva lógica de visión).
  const force = reqUrl.searchParams.get("force") === "1";
  // offset: para paginar en modo force (en force no hay filtro que "consuma" los ya hechos).
  const offset = Math.max(Number(reqUrl.searchParams.get("offset") ?? 0), 0);
  const results: Record<string, unknown> = { offset };

  try {
    // Posts orgánicos de Drean (meta_posts) con thumbnail. Incluye stories (sin caption).
    const filtro = force ? "" : "&pilar_contenido=is.null";
    const posts = await supabaseQuery<PostRow[]>(
      `meta_posts?select=platform,post_id,message,thumbnail_url,media_type&thumbnail_url=not.is.null${filtro}&order=fecha_post.desc&limit=${batchSize}&offset=${offset}`,
    );
    results.toProcess = posts.length;

    if (posts.length === 0) {
      return NextResponse.json({ ok: true, message: "Sin posts pendientes de clasificar", results });
    }

    const now = new Date().toISOString();
    let ok = 0;
    const errors: string[] = [];

    for (const post of posts) {
      try {
        const c = await classifyOne(post);
        if (!c) continue;
        const updated = await supabasePatch(post.platform, post.post_id, {
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
      "meta_posts?select=post_id&pilar_contenido=is.null&thumbnail_url=not.is.null",
    );
    results.pendientes = Array.isArray(pending) ? pending.length : 0;

    return NextResponse.json({ ok: true, timestamp: now, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message, results }, { status: 500 });
  }
}
