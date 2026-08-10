import { NextResponse } from "next/server";
import { CATEGORIAS, CATEGORIA_TERMINO, marcasDeCategoria } from "@/lib/competitive-config";

// LLMO (LLM Optimization / GEO) — visibilidad de marca en respuestas de IA.
// Para cada categoría le pregunta a un LLM (varias formas, varias corridas) "¿qué
// <categoria> conviene en Argentina?", cuenta cuántas veces menciona cada marca
// del set y en qué orden, y calcula el SHARE de menciones. Es el Share of Search
// del canal de IA generativa. Guarda en seo_llmo (mes actual).

export const maxDuration = 300;
// Modelo CON búsqueda web en vivo: mide la visibilidad real en IA (lo que la IA
// responde hoy leyendo la web), no la memoria de entrenamiento. No acepta
// temperature. Las llamadas son más lentas, por eso 1 corrida por prompt.
const MODEL = "gpt-4o-search-preview";
const REPEATS = 1;

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

function buildPrompts(term: string): string[] {
  return [
    `¿Cuáles son las mejores marcas de ${term} en Argentina? Nombralas.`,
    `Voy a comprar un ${term} en Argentina. ¿Qué marcas me recomendás?`,
    `¿Qué marca de ${term} conviene comprar en Argentina? Dame opciones.`,
    `Hacé un ranking de las marcas de ${term} más recomendadas en Argentina.`,
    `Si tuvieras que elegir un ${term} en Argentina, ¿qué marcas considerarías?`,
  ];
}

async function askLLM(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
      // Búsqueda geolocalizada en Argentina (no resultados globales).
      web_search_options: {
        user_location: { type: "approximate", approximate: { country: "AR", city: "Buenos Aires", region: "Buenos Aires" } },
      },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 150)}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const apiKey = env("OPENAI_API_KEY");
    const now = new Date();
    const mes = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

    const out: Array<Record<string, unknown>> = [];
    for (const cat of CATEGORIAS) {
      const term = CATEGORIA_TERMINO[cat];
      const brands = marcasDeCategoria(cat);
      const stat = new Map<string, { menciones: number; rankSum: number }>();
      let evaluated = 0;

      for (let rep = 0; rep < REPEATS; rep++) {
        for (const p of buildPrompts(term)) {
          let text = "";
          try { text = await askLLM(apiKey, p); } catch { continue; }
          if (!text) continue;
          evaluated++;
          const low = text.toLowerCase();
          const appearances = brands
            .map((b) => ({ b, idx: low.search(new RegExp(`\\b${escape(b.toLowerCase())}\\b`)) }))
            .filter((x) => x.idx >= 0)
            .sort((a, z) => a.idx - z.idx);
          appearances.forEach((x, order) => {
            const s = stat.get(x.b) ?? { menciones: 0, rankSum: 0 };
            s.menciones++;
            s.rankSum += order + 1;
            stat.set(x.b, s);
          });
        }
      }

      const totalMenciones = [...stat.values()].reduce((s, v) => s + v.menciones, 0) || 1;
      for (const b of brands) {
        const s = stat.get(b) ?? { menciones: 0, rankSum: 0 };
        out.push({
          categoria: cat,
          marca: b,
          mes,
          menciones: s.menciones,
          prompts: evaluated,
          share_pct: Math.round((s.menciones / totalMenciones) * 1000) / 10,
          rank_prom: s.menciones > 0 ? Math.round((s.rankSum / s.menciones) * 100) / 100 : null,
          modelo: MODEL,
        });
      }
    }

    if (out.length) {
      await sb("seo_llmo?on_conflict=categoria,marca,mes", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify(out),
      });
    }
    return NextResponse.json({ ok: true, mes, filas: out.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
