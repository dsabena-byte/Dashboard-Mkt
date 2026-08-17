"use client";

import { useRef, useState } from "react";
import { DynamicChart } from "@/components/dynamic-chart";
import type { ChartSpec } from "@/lib/chat/types";

// Copiloto GENÉRICO: botón flotante + drawer + hilo. Se monta en cualquier
// dashboard pasándole su `dashboard` id (mapea a lib/chat/registry.ts). El hilo
// muestra respuestas de texto y gráficos (<DynamicChart>) inline.
interface Msg {
  role: "user" | "assistant";
  content: string;
  charts?: ChartSpec[];
}

export function DataChat({ dashboard, suggestions = [] }: { dashboard: string; suggestions?: string[] }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboard,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = (await res.json()) as { text?: string; charts?: ChartSpec[]; error?: string };
      setMsgs([...next, { role: "assistant", content: data.text || data.error || "…", charts: data.charts ?? [] }]);
    } catch {
      setMsgs([...next, { role: "assistant", content: "Error al consultar. Reintentá." }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-90"
        >
          ✨ Preguntá a tus datos
        </button>
      )}
      {open && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b p-3">
            <span className="text-sm font-bold">✨ Copiloto de datos</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground" aria-label="Cerrar">
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {msgs.length === 0 && (
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>Preguntame sobre tus datos o pedime un gráfico. Ejemplos:</p>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full rounded border bg-card p-2 text-left transition hover:bg-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : ""}>
                <div
                  className={`inline-block max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-2 text-xs ${
                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {m.content}
                </div>
                {m.charts?.map((c, j) => (
                  <div key={j} className="mt-2">
                    <DynamicChart spec={c} />
                  </div>
                ))}
              </div>
            ))}
            {loading && <div className="text-xs text-muted-foreground">Pensando…</div>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribí tu pregunta…"
              className="flex-1 rounded border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}
