import { NextResponse } from "next/server";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

interface PostResumen {
  marca: string;
  positivo: number | null;
  negativo: number | null;
  resumen_sentimiento: string | null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const marca = url.searchParams.get("marca");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!marca || !from || !to) {
    return NextResponse.json({ error: "Params: marca, from, to" }, { status: 400 });
  }

  const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const openaiKey = env("OPENAI_API_KEY");

  try {
    // 1. Buscar si ya existe un resumen para este combo
    const cacheRes = await fetch(
      `${supabaseUrl}/rest/v1/social_brand_sentiment_summary?marca=eq.${marca}&periodo_from=eq.${from}&periodo_to=eq.${to}&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    );
    const cached = (await cacheRes.json()) as Array<{ resumen: string; posts_analizados: number }>;
    if (cached.length > 0) {
      return NextResponse.json({ ok: true, source: "cache", marca, resumen: cached[0].resumen, posts: cached[0].posts_analizados });
    }

    // 2. Traer todos los resúmenes individuales del período
    const postsRes = await fetch(
      `${supabaseUrl}/rest/v1/social_posts?select=marca,positivo,negativo,resumen_sentimiento&marca=eq.${marca}&red_social=eq.INSTAGRAM&resumen_sentimiento=not.is.null&fecha=gte.${from}&fecha=lte.${to}&limit=200`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
    );
    const posts = (await postsRes.json()) as PostResumen[];

    if (posts.length === 0) {
      return NextResponse.json({ ok: true, source: "empty", marca, resumen: "Sin análisis disponible para este período.", posts: 0 });
    }

    // 3. Agrupar resúmenes
    const resumenes = posts
      .map((p) => p.resumen_sentimiento)
      .filter(Boolean)
      .slice(0, 50);

    const avgPos = posts.reduce((s, p) => s + (p.positivo ?? 0), 0) / posts.length;
    const avgNeg = posts.reduce((s, p) => s + (p.negativo ?? 0), 0) / posts.length;

    // 4. Sintetizar con GPT
    const prompt = `Sos un analista de redes sociales. Tenés ${resumenes.length} análisis individuales de posts de Instagram de la marca "${marca}" (electrodomésticos argentinos).

Sentimiento promedio: ${Math.round(avgPos)}% positivo, ${Math.round(avgNeg)}% negativo.

Análisis individuales:
${resumenes.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Generá un resumen ejecutivo en español de MÁXIMO 3 oraciones que sintetice:
- Temas positivos recurrentes (qué valoran los usuarios)
- Temas negativos recurrentes (qué quejas hay)

NO menciones posts individuales. Hablá de tendencias generales. Formato: texto plano, sin bullets.`;

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.3,
      }),
    });

    if (!gptRes.ok) {
      const body = await gptRes.text();
      throw new Error(`OpenAI ${gptRes.status}: ${body}`);
    }

    const gptData = (await gptRes.json()) as { choices: Array<{ message: { content: string } }> };
    const resumen = gptData.choices[0]?.message?.content?.trim() ?? "Sin análisis.";

    // 5. Guardar en cache
    await fetch(`${supabaseUrl}/rest/v1/social_brand_sentiment_summary?on_conflict=marca,periodo_from,periodo_to`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ marca, periodo_from: from, periodo_to: to, posts_analizados: posts.length, resumen }),
    });

    return NextResponse.json({ ok: true, source: "generated", marca, resumen, posts: posts.length });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
