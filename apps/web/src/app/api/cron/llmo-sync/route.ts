import { NextResponse } from "next/server";
import { CATEGORIAS, marcasDeCategoria } from "@/lib/competitive-config";
import { llmoPromptSet, pickPromptsForRun, weekIndex, aggregateLlmo, LLMO_WINDOW_DAYS, LLMO_CALLS_MAX } from "@/lib/llmo-stats";
import { extraerCitas, textoRespuesta } from "@/lib/llmo-fuentes";

// LLMO (LLM Optimization / GEO) — visibilidad de marca en respuestas de IA, con DISEÑO ESTADÍSTICO
// (portado de BIP, sep-2026; lib/llmo-stats.ts):
//  · 12 prompts por categoría en 4 intenciones (descubrimiento / comparación / evaluación / compra).
//  · Cada corrida (semanal, workflow llmo-sync.yml) hace K llamadas por categoría (env
//    LLMO_CALLS_POR_CAT, default 12 = el set completo) al modelo CON búsqueda web geolocalizada en AR.
//  · Cada respuesta = una MUESTRA (marcas nombradas + URLs citadas) en seo_llmo_muestra (0118).
//  · seo_llmo (mes actual) = agregado de las muestras de los últimos 28 días: prompts = respuestas (n),
//    menciones = respuestas que nombran la marca (k), share_pct = share of model. Con n y k la UI
//    calcula la tasa de mención con intervalo de Wilson 95% (llmoStats).
//  · Si una categoría no obtuvo NINGUNA respuesta, NO se escribe (antes quedaban filas en 0 —
//    sep-2026 — que parecían "0% de visibilidad").
// Modelo: OpenAI Responses API + tool hosteada `web_search` (forzada con tool_choice), geolocalizada en
// AR. Env OPENAI_LLMO_MODEL (default gpt-4.1-mini). OJO: gpt-4o-search-preview (chat completions) fue
// dado de baja el 23-jul-2026 → desde entonces todas las llamadas daban 404 y sep-2026 quedó en 0.
// Costo aprox. (ver LLMO_USD_POR_LLAMADA en lib/llmo-stats.ts): tool call web_search + tokens ≈ US$0,03/llamada
// → 12 × 3 categorías × ~4,3 corridas/mes ≈ US$4,6/mes.

export const maxDuration = 300;
const MODEL = process.env.OPENAI_LLMO_MODEL?.trim() || "gpt-4.1-mini";
const CONC = 4;

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

async function sb(path: string, init?: RequestInit): Promise<Response> {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

/** Body de la llamada a la Responses API (web_search forzada, ubicación AR). */
function llmoRequestBody(prompt: string) {
  return {
    model: MODEL,
    input: prompt,
    max_output_tokens: 800,
    // Búsqueda web obligatoria y geolocalizada en Argentina (no resultados globales).
    tools: [{
      type: "web_search",
      search_context_size: "low",
      user_location: { type: "approximate", country: "AR", city: "Buenos Aires", region: "Buenos Aires", timezone: "America/Argentina/Buenos_Aires" },
    }],
    tool_choice: { type: "web_search" },
  };
}

async function askLLM(apiKey: string, prompt: string): Promise<{ content: string; resp: unknown }> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(llmoRequestBody(prompt)),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const resp = (await res.json()) as { error?: { message?: string } | null; status?: string };
  if (resp.error?.message) throw new Error(`OpenAI: ${resp.error.message.slice(0, 300)}`);
  return { content: textoRespuesta(resp), resp };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Muestra { categoria: string; fecha: string; prompt_id: string; intencion: string; modelo: string; marcas: string[]; fuentes: string[]; rank: Map<string, number> }

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const apiKey = env("OPENAI_API_KEY");
    const now = new Date();
    const mes = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const k = Math.min(LLMO_CALLS_MAX, Math.max(1, Math.round(Number(process.env.LLMO_CALLS_POR_CAT ?? 12)) || 12));
    const week = weekIndex(now);

    // 1) Llamadas (K por categoría, en paralelo acotado).
    const jobs = CATEGORIAS.flatMap((cat) => pickPromptsForRun(llmoPromptSet(cat, now.getUTCFullYear()), k, week).map((p) => ({ cat, p })));
    const nuevas: Muestra[] = [];
    const errores: string[] = [];
    let i = 0;
    await Promise.all(Array.from({ length: CONC }, async () => {
      while (i < jobs.length) {
        const { cat, p } = jobs[i++]!;
        try {
          const { content, resp } = await askLLM(apiKey, p.texto);
          if (!content) { if (errores.length < 5) errores.push(`Respuesta vacía (${p.id})`); continue; }
          const low = content.toLowerCase();
          const apar = marcasDeCategoria(cat)
            .map((b) => ({ b, idx: low.search(new RegExp(`\\b${escape(b.toLowerCase())}\\b`)) }))
            .filter((x) => x.idx >= 0)
            .sort((a, z) => a.idx - z.idx);
          nuevas.push({ categoria: cat, fecha: new Date().toISOString(), prompt_id: p.id, intencion: p.intencion, modelo: MODEL, marcas: apar.map((x) => x.b), fuentes: extraerCitas(resp), rank: new Map(apar.map((x, o) => [x.b, o + 1])) });
        } catch (e) { if (errores.length < 5) errores.push((e as Error).message); }
      }
    }));

    // 2) Persistir las muestras nuevas (fail-safe: sin la migración 0118 se sigue sin acumular).
    let muestrasOk = false;
    if (nuevas.length) {
      const r = await sb("seo_llmo_muestra", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(nuevas.map(({ rank: _r, ...m }) => m)) }).catch(() => null);
      muestrasOk = !!r?.ok;
    }

    // 3) Pool de la ventana (28 días) por categoría: las guardadas (incluye las nuevas si se guardaron) o solo las nuevas.
    const desde = new Date(now.getTime() - LLMO_WINDOW_DAYS * 864e5).toISOString();
    let pool: { categoria: string; marcas: string[] }[] = nuevas;
    if (muestrasOk) {
      const r = await sb(`seo_llmo_muestra?fecha=gte.${desde}&select=categoria,marcas&order=id&limit=5000`).catch(() => null);
      if (r?.ok) pool = (await r.json()) as { categoria: string; marcas: string[] }[];
    }

    const out: Array<Record<string, unknown>> = [];
    const resumen: Record<string, { respuestas: number; nuevas: number }> = {};
    for (const cat of CATEGORIAS) {
      const ms = pool.filter((m) => m.categoria === cat);
      const nuevasCat = nuevas.filter((m) => m.categoria === cat);
      resumen[cat] = { respuestas: ms.length, nuevas: nuevasCat.length };
      if (!ms.length || !nuevasCat.length) continue; // sin respuestas en esta corrida → no pisar el mes con ceros
      const brands = marcasDeCategoria(cat).map((b) => ({ marca: b, own: b === "Drean" }));
      const agg = aggregateLlmo(ms.map((m) => ({ categoria: cat, fecha: "", prompt: "", modelo: MODEL, marcas: m.marcas })), brands);
      for (const a of agg) {
        const ranks = nuevasCat.map((m) => m.rank.get(a.marca)).filter((x): x is number => x != null);
        out.push({
          categoria: cat, marca: a.marca, mes,
          menciones: a.menciones, prompts: a.respuestas,
          share_pct: Math.round(a.share_pct * 10) / 10,
          rank_prom: ranks.length ? Math.round((ranks.reduce((s, x) => s + x, 0) / ranks.length) * 100) / 100 : null,
          modelo: MODEL,
          updated_at: now.toISOString(),
        });
      }
    }

    if (out.length) {
      const r = await sb("seo_llmo?on_conflict=categoria,marca,mes", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(out) });
      if (!r.ok) throw new Error(`seo_llmo ${r.status}: ${(await r.text()).slice(0, 200)}`);
    }
    const ok = out.length > 0;
    // Si TODAS las llamadas fallaron no se escribió nada (ver `continue` arriba): devolver el primer error claro.
    const error = nuevas.length === 0 ? `0 respuestas de ${jobs.length} llamadas (modelo ${MODEL}). Primer error: ${errores[0] ?? "sin detalle"}` : undefined;
    return NextResponse.json({
      ok, error, modelo: MODEL, mes, llamadas: jobs.length, respuestas: nuevas.length, porCategoria: resumen, filas: out.length,
      muestrasGuardadas: muestrasOk, hint: muestrasOk ? undefined : "Sin la migración 0118 (seo_llmo_muestra) no se acumulan muestras ni fuentes: n = solo esta corrida.",
      errores,
    }, { status: ok ? 200 : 502 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
