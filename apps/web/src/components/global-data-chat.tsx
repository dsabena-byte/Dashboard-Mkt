"use client";

import { usePathname } from "next/navigation";
import { DataChat } from "@/components/data-chat";
import { contextoDe } from "@/lib/chat/contexto";

// Copiloto global: detecta el dashboard por la URL y monta <DataChat> con el contexto
// (label, foco, sugerencias) de ese dashboard — lib/chat/contexto.ts. Solo aparece en
// dashboards de datos (no en login, contenido, monitoreo…). Un solo mount para todo el
// sitio; en cualquier dashboard el motor puede cruzar TODAS las fuentes permitidas.
export function GlobalDataChat() {
  const pathname = usePathname() || "/";
  if (pathname === "/" || pathname.startsWith("/login")) return null;
  const ctx = contextoDe(pathname);
  if (!ctx) return null;
  return <DataChat pathname={pathname} ctx={ctx} />;
}
