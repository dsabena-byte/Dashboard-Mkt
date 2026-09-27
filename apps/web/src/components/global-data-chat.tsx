"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DataChat, type AskRequest } from "@/components/data-chat";
import { contextoDe, GENERAL } from "@/lib/chat/contexto";
import { COPILOTO_ASK_EVENT } from "@/lib/copiloto-guia";

// Copiloto global: detecta el dashboard por la URL y monta <DataChat> con el contexto
// (label, foco, sugerencias) de ese dashboard — lib/chat/contexto.ts. Solo aparece en
// dashboards de datos (no en login, contenido, monitoreo…). Un solo mount para todo el
// sitio; en cualquier dashboard el motor puede cruzar TODAS las fuentes permitidas.
// "Guiame paso a paso": escucha `copiloto:ask` {prompt} (lib/copiloto-guia) → abre el chat y
// envía la pregunta. En rutas sin copiloto propio (ej. /guia, /alerts) lo monta con el contexto general.
export function GlobalDataChat() {
  const pathname = usePathname() || "/";
  const [ask, setAsk] = useState<AskRequest | null>(null);

  useEffect(() => {
    const onAsk = (e: Event) => {
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (typeof prompt === "string" && prompt.trim()) setAsk({ id: Date.now() + Math.random(), prompt: prompt.trim() });
    };
    window.addEventListener(COPILOTO_ASK_EVENT, onAsk as EventListener);
    return () => window.removeEventListener(COPILOTO_ASK_EVENT, onAsk as EventListener);
  }, []);

  if (pathname.startsWith("/login")) return null;
  const propio = pathname === "/" ? null : contextoDe(pathname);
  const ctx = propio ?? (ask ? GENERAL : null);
  if (!ctx) return null;
  return <DataChat pathname={propio ? pathname : "/"} ctx={ctx} ask={ask} />;
}
