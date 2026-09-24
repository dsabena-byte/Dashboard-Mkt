"use client";

import { useEffect, useRef, useState } from "react";
import { DynamicChart } from "@/components/dynamic-chart";
import { MiniMarkdown } from "@/components/chat/mini-markdown";
import { PostCards } from "@/components/chat/post-cards";
import type { DashContexto } from "@/lib/chat/contexto";
import type { ChartSpec, TableSpec, PostCard, ChatStep } from "@/lib/chat/types";

// Copiloto "Preguntale a tus datos" (v2, motor de BIP): botón flotante + panel. Manda el
// pathname para que el motor sepa qué dashboard mira el usuario; lee la respuesta NDJSON
// (pasos "Consultando…" en vivo + respuesta final con markdown, gráficos, tablas y
// tarjetas de posts). Lo monta <GlobalDataChat> según la URL.

type Msg = {
  role: "user" | "assistant";
  content: string;
  charts?: ChartSpec[];
  tables?: TableSpec[];
  posts?: PostCard[];
  steps?: ChatStep[];
  error?: boolean;
};

const AZUL = "#1e40af";

function Table({ t }: { t: TableSpec }) {
  return (
    <div className="my-2 overflow-x-auto">
      {t.title && <div className="mb-1 text-[12px] font-semibold">{t.title}</div>}
      <table className="w-full border-collapse text-[11.5px]">
        <thead>
          <tr>
            {t.columns.map((c, i) => (
              <th key={i} className={`whitespace-nowrap border-b border-slate-200 px-2 py-1 font-semibold text-slate-500 ${i === 0 ? "text-left" : "text-right"}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td key={ci} className={`border-t border-slate-100 px-2 py-1 tabular-nums ${ci === 0 ? "text-left" : "text-right"}`}>
                  {typeof c === "number" ? c.toLocaleString("es-AR", { maximumFractionDigits: 2 }) : c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Steps({ steps, live }: { steps: ChatStep[]; live?: boolean }) {
  if (!steps.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1 text-[10.5px] text-slate-500 ${live ? "" : "mt-1.5"}`}>
      <span>{live ? "Consultando:" : "Datos consultados:"}</span>
      {steps.map((s, i) => {
        const on = live && i === steps.length - 1;
        return (
          <span
            key={i}
            className="rounded-full border px-2 py-px"
            style={{ background: on ? "#eff6ff" : "#f1f5f9", color: on ? AZUL : "#475569", borderColor: on ? "#bfdbfe" : "transparent" }}
          >
            {s.label}
          </span>
        );
      })}
    </div>
  );
}

export function DataChat({ pathname, ctx }: { pathname: string; ctx: DashContexto }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveSteps, setLiveSteps] = useState<ChatStep[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy, liveSteps]);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    setLiveSteps([]);
    const ac = new AbortController();
    abortRef.current = ac;
    const push = (m: Msg) => setMsgs((prev) => [...prev, m]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathname, messages: next.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content })) }),
        signal: ac.signal,
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok || !ct.includes("ndjson") || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; text?: string };
        push({ role: "assistant", content: data.error ?? data.text ?? "Sin respuesta.", error: !res.ok });
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let done = false;
      const steps: ChatStep[] = [];
      while (!done) {
        const r = await reader.read();
        if (r.done) break;
        buf += dec.decode(r.value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev: { type?: string; tool?: string; label?: string; text?: string; charts?: ChartSpec[]; tables?: TableSpec[]; posts?: PostCard[]; steps?: ChatStep[] };
          try { ev = JSON.parse(line); } catch { continue; }
          if (ev.type === "step") {
            steps.push({ tool: ev.tool ?? "", label: ev.label ?? "" });
            setLiveSteps([...steps]);
          } else if (ev.type === "final") {
            push({ role: "assistant", content: ev.text || "Sin respuesta.", charts: ev.charts, tables: ev.tables, posts: ev.posts, steps: ev.steps ?? steps });
            done = true;
          }
        }
      }
      if (!done) push({ role: "assistant", content: "La respuesta se cortó. Probá de nuevo.", error: true });
    } catch (e) {
      if ((e as Error).name !== "AbortError") push({ role: "assistant", content: "Hubo un error al consultar. Probá de nuevo.", error: true });
    } finally {
      if (abortRef.current === ac) {
        setBusy(false);
        setLiveSteps([]);
        abortRef.current = null;
      }
    }
  }

  function nueva() {
    abortRef.current?.abort();
    abortRef.current = null;
    setMsgs([]);
    setInput("");
    setBusy(false);
    setLiveSteps([]);
  }

  const canSend = !busy && !!input.trim();

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 rounded-full px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
          style={{ background: AZUL }}
        >
          ✨ Preguntale a tus datos
        </button>
      )}
      {open && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">✨ Preguntale a tus datos</div>
              <div className="truncate text-[11px] text-slate-500">Mirando: {ctx.label} · cruza objetivos, pauta, redes, web, SEO, trade, mercado y marca</div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {msgs.length > 0 && (
                <button onClick={nueva} title="Nueva conversación" className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-50">
                  Nueva
                </button>
              )}
              <button onClick={() => setOpen(false)} aria-label="Cerrar" className="px-1 text-xl leading-none text-slate-500 hover:text-slate-900">
                ×
              </button>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-slate-50 p-4">
            {msgs.length === 0 && (
              <div className="flex flex-col gap-2">
                <p className="mb-1 text-[13px] leading-relaxed text-slate-500">
                  Preguntá en lenguaje simple. Cruzo <b className="font-semibold text-slate-900">todas las fuentes</b>, calculo correlaciones y proyecciones, y te digo qué palanca mover y cuánto impacta.
                </p>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sugerencias para {ctx.label}</div>
                {ctx.sugerencias.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[12.5px] leading-snug text-slate-800 hover:border-slate-300">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "max-w-[88%] self-end" : "w-full"}>
                {m.role === "user" ? (
                  <div className="whitespace-pre-wrap rounded-2xl rounded-br-sm px-3 py-2 text-[13px] leading-snug text-white" style={{ background: AZUL }}>
                    {m.content}
                  </div>
                ) : (
                  <div className={`rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] leading-relaxed ${m.error ? "text-amber-700" : "text-slate-900"}`}>
                    <MiniMarkdown text={m.content} />
                    {m.charts?.map((c, ci) => (
                      <div key={ci} className="mt-2">
                        <DynamicChart spec={c} />
                      </div>
                    ))}
                    {m.tables?.map((t, ti) => <Table key={ti} t={t} />)}
                    {m.posts && <PostCards posts={m.posts} />}
                    {m.steps && <Steps steps={m.steps} />}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <div className="text-[12.5px] text-slate-500">{liveSteps.length ? "Cruzando tus datos…" : "Pensando qué datos necesito…"}</div>
                <Steps steps={liveSteps} live />
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="flex items-end gap-2 border-t border-slate-200 bg-white p-3">
            <textarea
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ej: ¿qué medio escalo y cuál corto?"
              className="max-h-[120px] flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 outline-none focus:ring-1 focus:ring-blue-800"
            />
            <button
              onClick={() => send(input)}
              disabled={!canSend}
              className="rounded-lg px-3.5 py-2.5 text-[13px] font-semibold text-white"
              style={{ background: canSend ? AZUL : "#cbd5e1", cursor: canSend ? "pointer" : "default" }}
            >
              Enviar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
