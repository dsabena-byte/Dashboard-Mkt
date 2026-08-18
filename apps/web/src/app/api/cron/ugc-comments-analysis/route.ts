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

// Métricas de interacción de la pieza pautada (misma data que la pauta de marca),
// traídas de meta_paid_creatives por instagram_permalink_url. Absolutos + tasas
// sobre impresiones (denominador elegido: impresiones, consistente con save/share rate).
interface PieceMetrics {
  impresiones: number;
  alcance: number;
  reactions: number;
  comments: number;
  shares: number;
  saves: number;
  vtr: number;
  post_engagement: number;
  save_rate: number; // %
  share_rate: number; // %
  reaction_rate: number; // %
  comment_rate: number; // %
}

// Promedio UGC (pooled) para dar contexto: cada tasa se lee ARRIBA/EN LÍNEA/ABAJO
// del promedio del propio universo UGC, no contra un absoluto inventado.
interface UgcBenchmark {
  save_rate: number;
  share_rate: number;
  reaction_rate: number;
  comment_rate: number;
  vtr: number;
}

function ratesOf(m: {
  impresiones?: number | null;
  reactions?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  alcance?: number | null;
  vtr?: number | null;
  post_engagement?: number | null;
}): PieceMetrics {
  const impresiones = Number(m.impresiones ?? 0);
  const den = impresiones > 0 ? impresiones : 1;
  const reactions = Number(m.reactions ?? 0);
  const comments = Number(m.comments ?? 0);
  const shares = Number(m.shares ?? 0);
  const saves = Number(m.saves ?? 0);
  return {
    impresiones,
    alcance: Number(m.alcance ?? 0),
    reactions,
    comments,
    shares,
    saves,
    vtr: Number(m.vtr ?? 0),
    post_engagement: Number(m.post_engagement ?? 0),
    save_rate: (saves / den) * 100,
    share_rate: (shares / den) * 100,
    reaction_rate: (reactions / den) * 100,
    comment_rate: (comments / den) * 100,
  };
}

// Clasifica una tasa contra el promedio UGC (±20% de banda = "en línea").
function rel(value: number, avg: number): string {
  if (!avg || avg <= 0) return "sin referencia";
  if (value >= avg * 1.2) return "ARRIBA del promedio UGC";
  if (value <= avg * 0.8) return "ABAJO del promedio UGC";
  return "en línea con el promedio UGC";
}

async function analyze(
  adName: string,
  comments: string[],
  metrics: PieceMetrics | null,
  bench: UgcBenchmark | null,
): Promise<Analysis> {
  const apiKey = env("OPENAI_API_KEY");

  const senales =
    metrics && bench
      ? `Señales cuantitativas de ESTA pieza (data real de la pauta), comparadas contra el promedio de todas las piezas UGC:
- Guardados: ${metrics.saves} (tasa ${metrics.save_rate.toFixed(3)}% de impresiones → ${rel(metrics.save_rate, bench.save_rate)})
- Compartidos: ${metrics.shares} (tasa ${metrics.share_rate.toFixed(3)}% → ${rel(metrics.share_rate, bench.share_rate)})
- Reacciones/me gusta: ${metrics.reactions} (tasa ${metrics.reaction_rate.toFixed(3)}% → ${rel(metrics.reaction_rate, bench.reaction_rate)})
- VTR (retención de video): ${metrics.vtr.toFixed(2)} → ${rel(metrics.vtr, bench.vtr)}
- Comentarios: ${metrics.comments} (tasa ${metrics.comment_rate.toFixed(3)}% → ${rel(metrics.comment_rate, bench.comment_rate)})
- Volumen: ${metrics.impresiones.toLocaleString("es-AR")} impresiones, ${metrics.alcance.toLocaleString("es-AR")} de alcance.

Cómo usar estas señales (CALIBRAN las variables cualitativas, NO son un puntaje aparte):
- Guardados por encima del promedio ⇒ contenido de referencia/valioso ⇒ refuerza credibilidad e intención de compra.
- Compartidos por encima del promedio ⇒ la gente lo recomienda/hay advocacy ⇒ refuerza percepción de marca y credibilidad.
- Reacciones/VTR altas ⇒ el contenido gustó y retuvo la atención ⇒ refuerza percepción de marca.
- IMPORTANTE: NO declares percepción negativa ni baja intención SOLO porque hay pocos comentarios, si guardados/compartidos/VTR muestran resonancia por encima del promedio. Los comentarios son una señal más, no la única.
- Si las señales cuantitativas y los comentarios se contradicen, explicá la tensión en el 'detalle' correspondiente.`
      : `(No hay métricas de interacción disponibles para esta pieza; analizá solo con los comentarios.)`;

  const prompt = `Sos un estratega de contenido de marketing. Analizás una pieza UGC (creador genera contenido) de Drean (electrodomésticos) para validar el contenido y mejorar futuros guiones. Tenés DOS fuentes de evidencia: los comentarios reales y las señales cuantitativas de interacción de la pauta. Integrá AMBAS en cada variable cualitativa.

Pieza: "${adName}"

${senales}

Comentarios (${comments.length}):
${comments.length ? comments.map((c, i) => `${i + 1}. ${c}`).join("\n") : "(sin comentarios de texto)"}

Devolvé SOLO un JSON con esta forma exacta (en español, conciso y accionable). En cada 'detalle' podés citar la señal cuantitativa que justifica el nivel (ej. "guardados por encima del promedio"):
{
  "resumen": "1-2 oraciones con el balance general, integrando comentarios y señales de interacción",
  "credibilidad": {"nivel": "alta|media|baja", "detalle": "¿el contenido se percibe creíble/auténtico o como publicidad? evidencia de comentarios + guardados/compartidos"},
  "intencion_compra": {"nivel": "alta|media|baja", "detalle": "¿mueve la intención de compra? señales: preguntas de precio/dónde comprar, ganas de tenerlo, y guardados (contenido guardado como referencia de compra)"},
  "percepcion_marca": {"nivel": "positiva|neutra|negativa", "detalle": "¿cómo queda parada la marca? sentimiento de comentarios + resonancia (compartidos/reacciones/VTR)"},
  "mejoras": ["mejora concreta de contenido/guión 1", "mejora 2", "mejora 3"]
}
Si hay pocos comentarios, apoyate más en las señales cuantitativas y aclará la limitación en el resumen.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 850,
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

    // Piezas UGC: nombre + métricas de interacción de la pauta (misma data que la
    // pauta de marca) por permalink, para enriquecer el análisis cualitativo.
    const pieces = await sb<
      Array<{
        ad_name: string | null;
        instagram_permalink_url: string | null;
        impresiones: number | null;
        alcance: number | null;
        reactions: number | null;
        comments: number | null;
        shares: number | null;
        saves: number | null;
        vtr: number | null;
        post_engagement: number | null;
      }>
    >(
      "meta_paid_creatives?select=ad_name,instagram_permalink_url,impresiones,alcance,reactions,comments,shares,saves,vtr,post_engagement&categoria=eq.UGC",
    );
    const nameByLink = new Map<string, string>();
    const metricsByLink = new Map<string, PieceMetrics>();
    for (const p of pieces) {
      if (!p.instagram_permalink_url) continue;
      nameByLink.set(p.instagram_permalink_url, p.ad_name ?? "");
      metricsByLink.set(p.instagram_permalink_url, ratesOf(p));
    }

    // Benchmark UGC (pooled): tasa promedio = sum(métrica) / sum(impresiones).
    // Robusto ante piezas con denominador chico. VTR promedio ponderado por impresiones.
    let sImp = 0, sReact = 0, sComm = 0, sShare = 0, sSave = 0, sVtrW = 0;
    for (const m of metricsByLink.values()) {
      if (m.impresiones <= 0) continue;
      sImp += m.impresiones;
      sReact += m.reactions;
      sComm += m.comments;
      sShare += m.shares;
      sSave += m.saves;
      sVtrW += m.vtr * m.impresiones;
    }
    const bench: UgcBenchmark = {
      save_rate: sImp ? (sSave / sImp) * 100 : 0,
      share_rate: sImp ? (sShare / sImp) * 100 : 0,
      reaction_rate: sImp ? (sReact / sImp) * 100 : 0,
      comment_rate: sImp ? (sComm / sImp) * 100 : 0,
      vtr: sImp ? sVtrW / sImp : 0,
    };

    const processed: Array<{ permalink: string; n: number; status: string }> = [];
    let errors = 0;
    for (const permalink of toProcess) {
      try {
        const rows = await sb<Array<{ comment_text: string }>>(
          `ugc_comments?select=comment_text&permalink=eq.${encodeURIComponent(permalink)}&limit=100`,
        );
        const comments = rows.map((r) => r.comment_text).filter(Boolean);
        const analysis = await analyze(nameByLink.get(permalink) ?? "", comments, metricsByLink.get(permalink) ?? null, bench);
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
