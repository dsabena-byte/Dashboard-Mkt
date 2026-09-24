import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { allowedFromRows } from "@/lib/dashboard-access";
import { buildChatTools } from "@/lib/chat/registry";
import { RENDER_TOOLS, systemPrompt, chatModel } from "@/lib/chat/copiloto";
import { contextoDe, toolLabel, GENERAL } from "@/lib/chat/contexto";
import { checkRateLimit } from "@/lib/chat/rate-limit";
import type { ChartSpec, TableSpec, PostCard, ChatStep, ToolCtx } from "@/lib/chat/types";

// ============================================================================
// Motor del copiloto "Preguntale a tus datos" (v2, portado de BIP). Loop de
// function-calling (OpenAI) sobre TODOS los sets de tools que el usuario tiene
// permitidos, con el del dashboard actual primero. Respuesta en NDJSON:
//   {"type":"step","tool","label"}  … a medida que consulta datos (para la UI)
//   {"type":"final","text","charts","tables","posts","steps"}  al terminar.
// Errores previos al loop (auth, config, rate limit) salen como JSON común.
// ============================================================================

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_STEPS = 10;
const MAX_TOOL_CHARS = 20_000;
const MAX_HISTORY = 12;

type InMsg = { role: "user" | "assistant"; content: string };
interface ChatRequest {
  pathname?: string;
  dashboard?: string; // legacy (v1): id del dashboard
  messages?: InMsg[];
}

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "OPENAI_API_KEY no configurada" }, { status: 500 });

  // Usuario + dashboards permitidos (misma regla que el middleware/sidebar).
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  let allowed: string[] | null = null;
  try {
    const { data } = await supabase.from("dashboard_access").select("dashboard_path");
    allowed = allowedFromRows(data as { dashboard_path: string }[] | null);
  } catch {
    allowed = null;
  }

  const rl = checkRateLimit(user.id);
  if (!rl.ok) return NextResponse.json({ error: `Llegaste al límite de consultas por un rato. Probá de nuevo en ${Math.ceil(rl.retryInSec / 60)} min.` }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as ChatRequest;
  const pathname = typeof body.pathname === "string" ? body.pathname.slice(0, 200) : typeof body.dashboard === "string" ? `/${body.dashboard}` : "/";
  const dash = contextoDe(pathname) ?? GENERAL;
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }));
  if (!history.length || history[history.length - 1]!.role !== "user") return NextResponse.json({ error: "Mensaje vacío." }, { status: 400 });

  const ctx: ToolCtx = { posts: new Map() };
  const { tools } = buildChatTools(dash.key, allowed, ctx);
  const toolMap = new Map(tools.map((t) => [t.name, t]));
  const openaiTools = [...tools.map((t) => ({ type: "function" as const, function: { name: t.name, description: t.description, parameters: t.parameters } })), ...RENDER_TOOLS];
  const model = chatModel();

  const messages: Array<Record<string, unknown>> = [{ role: "system", content: systemPrompt({ dash, pathname, restringido: allowed !== null }) }, ...history];
  const charts: ChartSpec[] = [];
  const tables: TableSpec[] = [];
  const posts: PostCard[] = [];
  const steps: ChatStep[] = [];
  const t0 = Date.now();
  let tokens = 0;
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => {
        try { controller.enqueue(enc.encode(`${JSON.stringify(o)}\n`)); } catch { /* cliente cerró */ }
      };
      const final = (text: string) => send({ type: "final", text, charts, tables, posts, steps });
      let ok = false;
      try {
        for (let step = 0; step < MAX_STEPS; step++) {
          const last = step === MAX_STEPS - 1;
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model, temperature: 0.2, messages, tools: openaiTools, parallel_tool_calls: true, ...(last ? { tool_choice: "none" } : {}) }),
            cache: "no-store",
          });
          const json = await res.json().catch(() => null);
          tokens += Number(json?.usage?.total_tokens ?? 0);
          const msg = json?.choices?.[0]?.message;
          if (!msg) {
            final(json?.error?.message ? `No pude procesar la consulta (${String(json.error.message).slice(0, 160)}).` : "No pude procesar la consulta.");
            return;
          }
          if (!msg.tool_calls?.length) { ok = true; final(msg.content ?? ""); return; }

          messages.push(msg);
          // Aviso de progreso (un paso por fuente distinta).
          for (const tc of msg.tool_calls) {
            const name = String(tc.function?.name ?? "");
            let label = toolLabel(name);
            if (name === "calc") {
              try { label = `Cálculo: ${JSON.parse(tc.function.arguments || "{}").operacion ?? ""}`.replace(/_/g, " "); } catch { /* label genérico */ }
            }
            if (!steps.some((s) => s.label === label)) { const s = { tool: name, label }; steps.push(s); send({ type: "step", ...s }); }
          }
          // Tools en paralelo; las respuestas se agregan en el orden de las llamadas.
          const outs = await Promise.all(msg.tool_calls.map(async (tc: { id: string; function?: { name?: string; arguments?: string } }) => {
            const name = String(tc.function?.name ?? "");
            let out: unknown;
            try {
              const args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
              if (name === "render_chart") {
                const spec = args as ChartSpec;
                if (Array.isArray(spec?.data) && spec.data.length && Array.isArray(spec.series) && spec.series.length) { charts.push({ ...spec, data: spec.data.slice(0, 60) }); out = { ok: true }; }
                else out = { error: "data y series requeridos" };
              } else if (name === "render_table") {
                const t = args as TableSpec;
                if (Array.isArray(t?.columns) && Array.isArray(t.rows)) { tables.push({ ...t, rows: t.rows.slice(0, 50) }); out = { ok: true }; }
                else out = { error: "columns y rows requeridos" };
              } else if (name === "render_posts") {
                const refs: string[] = Array.isArray(args.refs) ? args.refs.map(String).slice(0, 12) : [];
                const found = refs.map((r) => ctx.posts.get(r)).filter((p): p is PostCard => !!p && !posts.some((x) => x.ref === p.ref));
                posts.push(...found);
                out = { ok: true, mostrados: found.length, ...(found.length < refs.length ? { aviso: "Algunos ref no existen: usá los ref que devolvió la última consulta de posts/creativos." } : {}) };
              } else if (toolMap.has(name)) {
                out = await toolMap.get(name)!.run(args);
              } else out = { error: "tool desconocida o no disponible para este usuario" };
            } catch (e) {
              out = { error: (e as Error).message };
            }
            let content = JSON.stringify(out) ?? "null";
            if (content.length > MAX_TOOL_CHARS) content = `${content.slice(0, MAX_TOOL_CHARS)}… [recortado: pedí menos filas con top o un período más acotado]`;
            return { role: "tool", tool_call_id: tc.id, content };
          }));
          messages.push(...outs);
        }
        final("La consulta necesitó demasiados pasos; probá con algo más específico.");
      } catch (e) {
        final(`Hubo un error al consultar tus datos (${(e as Error).message?.slice(0, 120) ?? "error"}). Probá de nuevo.`);
      } finally {
        try { controller.close(); } catch { /* ya cerrado */ }
        console.log(JSON.stringify({ evt: "chat_query", path: pathname, tools: steps.map((s) => s.tool), ms: Date.now() - t0, tokens, ok, model }));
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}
