import { NextResponse } from "next/server";
import { getDashboardChat } from "@/lib/chat/registry";
import type { ChartSpec, PostCard } from "@/lib/chat/types";

// ============================================================================
// Motor GENÉRICO del copiloto. Loop de function-calling (OpenAI) sobre las tools
// del dashboard pedido. Devuelve { text, charts }. No es específico de Redes:
// sirve para cualquier dashboard registrado en lib/chat/registry.ts.
// ============================================================================

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface OAIToolCall {
  id: string;
  function: { name: string; arguments: string };
}
interface OAIMessage {
  role: string;
  content: string | null;
  tool_calls?: OAIToolCall[];
  tool_call_id?: string;
}
interface ChatRequest {
  dashboard?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
}

const RENDER_CHART_TOOL = {
  type: "function" as const,
  function: {
    name: "render_chart",
    description:
      "Renderiza un gráfico para el usuario. Llamalo cuando pida graficar/visualizar. Armá el spec con la data que ya obtuviste de las otras tools; no inventes valores.",
    parameters: {
      type: "object",
      required: ["type", "data", "xKey", "series"],
      properties: {
        type: { type: "string", enum: ["bar", "line", "composed"] },
        title: { type: "string" },
        xKey: { type: "string", description: "clave del eje X en cada objeto de data" },
        data: { type: "array", items: { type: "object" } },
        series: {
          type: "array",
          items: {
            type: "object",
            required: ["key", "label"],
            properties: {
              key: { type: "string" },
              label: { type: "string" },
              type: { type: "string", enum: ["bar", "line"] },
              axis: { type: "string", enum: ["left", "right"] },
            },
          },
        },
      },
    },
  },
};

const RENDER_POSTS_TOOL = {
  type: "function" as const,
  function: {
    name: "render_posts",
    description:
      "Muestra posteos como TARJETAS VISUALES con su miniatura. Usalo cuando el usuario pida ver/mostrar los posts (ej. 'mostrame los posteos', 'quiero verlos'). Pasá los posts con su thumbnail y url tal como vinieron de las tools; no los listes también en texto.",
    parameters: {
      type: "object",
      required: ["posts"],
      properties: {
        posts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              titulo: { type: "string", description: "primeras palabras del mensaje del post" },
              plataforma: { type: "string", enum: ["Instagram", "Facebook"] },
              fecha: { type: "string" },
              tipo: { type: "string" },
              alcance: { type: "number" },
              engagement: { type: "number" },
              thumbnail: { type: "string", description: "url de la miniatura tal cual vino de la tool" },
              url: { type: "string", description: "permalink del post" },
            },
          },
        },
      },
    },
  },
};

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY no configurada" }, { status: 500 });

  const body = (await req.json()) as ChatRequest;
  const dash = getDashboardChat(body.dashboard ?? "");
  if (!dash) return NextResponse.json({ error: "dashboard desconocido" }, { status: 400 });

  const toolMap = new Map(dash.tools.map((t) => [t.name, t]));
  const tools = [
    ...dash.tools.map((t) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
    RENDER_CHART_TOOL,
    RENDER_POSTS_TOOL,
  ];

  // Fecha de hoy (zona Argentina, UTC-3) para que el modelo resuelva rangos
  // relativos ("últimos N meses/días", "este mes/año") desde HOY y no desde su
  // conocimiento previo (cutoff), que devolvía rangos sin data.
  const nowAr = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const today = nowAr.toISOString().slice(0, 10);
  const dateCtx =
    `Fecha de hoy: ${today} (zona horaria Argentina, el año en curso es ${nowAr.getUTCFullYear()}). ` +
    `Para cualquier rango relativo ("últimos N meses/días", "este mes", "este año", "año pasado"), ` +
    `calculá las fechas from/to (YYYY-MM-DD) a partir de HOY, nunca de tu conocimiento previo. `;

  const messages: OAIMessage[] = [
    { role: "system", content: dateCtx + dash.context },
    ...(body.messages ?? []).map((m) => ({ role: m.role, content: m.content })),
  ];

  const charts: ChartSpec[] = [];
  const posts: PostCard[] = [];

  for (let step = 0; step < 6; step++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages, tools, temperature: 0.2 }),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `OpenAI ${res.status}: ${await res.text()}` }, { status: 502 });
    }
    const json = (await res.json()) as { choices?: Array<{ message?: OAIMessage }> };
    const msg = json.choices?.[0]?.message;
    if (!msg) return NextResponse.json({ error: "OpenAI sin respuesta" }, { status: 502 });
    messages.push(msg);

    const calls = msg.tool_calls ?? [];
    if (calls.length === 0) {
      return NextResponse.json({ text: msg.content ?? "", charts, posts });
    }

    for (const call of calls) {
      const name = call.function?.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function?.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }
      let result: unknown;
      if (name === "render_chart") {
        charts.push(args as unknown as ChartSpec);
        result = { ok: true };
      } else if (name === "render_posts") {
        const arr = Array.isArray(args.posts) ? (args.posts as PostCard[]) : [];
        posts.push(...arr);
        result = { ok: true };
      } else {
        const tool = toolMap.get(name);
        result = tool ? await tool.run(args) : { error: `tool desconocida: ${name}` };
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  return NextResponse.json({ text: "No pude completar la respuesta (demasiados pasos).", charts, posts });
}
