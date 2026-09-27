// ============================================================================
// "Guiame paso a paso" — puente entre las recomendaciones/señales/Diagnóstico IA/🎓 y el copiloto.
// CLIENT-SAFE y PURO (salvo `pedirGuia`, que solo despacha un evento del navegador).
//
// Cualquier botón dispara `window` CustomEvent `copiloto:ask` con { prompt }; <GlobalDataChat>
// (montado una vez en el layout) lo escucha, abre el chat y ENVÍA la pregunta sola. En rutas sin
// copiloto propio monta el chat con el contexto general. El prompt arranca con GUIA_MARCA, que el
// system prompt (lib/chat/copiloto.ts, "Modo guía") reconoce para responder paso a paso, sin jerga.
// Test: cd apps/web && npx tsx scripts/copiloto-guia.test.ts
// ============================================================================
import { contextoDe } from "@/lib/chat/contexto";

export const COPILOTO_ASK_EVENT = "copiloto:ask";
export const GUIA_MARCA = "Guiame paso a paso";
const MAX_PROMPT = 2500;

export interface GuiaItem {
  /** Qué es: título de la recomendación / señal / oportunidad. */
  titulo: string;
  /** Slug del tablero (ej. "seo-search") o ruta ("/seo-search"). */
  dash?: string;
  /** El dato / por qué (con números). */
  dato?: string | null;
  /** Qué hacer (acciones sugeridas, tal cual). */
  queHacer?: (string | null | undefined)[];
  /** Impacto estimado legible. */
  impacto?: string | null;
  /** Tipo de ítem para el encabezado ("recomendación", "oportunidad", "guía de la métrica"…). */
  tipo?: string;
}

/** Texto plano: sin HTML (el 🎓 trae <b> y entidades) y sin espacios de más. */
export function textoPlano(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Nombre humano del tablero (el del copiloto) a partir del slug o la ruta. */
export function tableroLabel(dash: string | undefined): string | null {
  if (!dash) return null;
  const path = dash.startsWith("/") ? dash : `/${dash}`;
  if (path === "/") return null;
  return contextoDe(path)?.label ?? null;
}

/** Arma la pregunta que se manda al copiloto: contexto del ítem + pedido de guía no técnica. */
export function promptGuia(it: GuiaItem): string {
  const lines: string[] = [];
  const tablero = tableroLabel(it.dash);
  lines.push(`${GUIA_MARCA}${it.tipo ? ` con esta ${it.tipo}` : ""}${tablero ? ` del tablero ${tablero}` : ""}:`);
  lines.push(`«${textoPlano(it.titulo)}»`);
  const dato = textoPlano(it.dato);
  if (dato) lines.push(`Dato: ${dato}`);
  const imp = textoPlano(it.impacto);
  if (imp) lines.push(`Impacto estimado: ${imp}`);
  const qh = (it.queHacer ?? []).map(textoPlano).filter(Boolean);
  if (qh.length) lines.push(`Lo que sugiere el tablero: ${qh.map((x, i) => `(${i + 1}) ${x}`).join(" ")}`);
  lines.push("No soy técnico: explicame en palabras simples qué significa, qué hago primero, quién del equipo o de la agencia lo tiene que hacer, dónde hago clic, cuánto tiempo lleva y cómo veo en el tablero si funcionó. Si hay que pedírselo a la agencia o al desarrollador, pasame el mensaje listo para copiar.");
  const out = lines.join("\n");
  return out.length > MAX_PROMPT ? `${out.slice(0, MAX_PROMPT - 1)}…` : out;
}

/** Abre el copiloto y le manda la pregunta (lo atiende <GlobalDataChat>). */
export function pedirGuia(prompt: string): void {
  if (typeof window === "undefined" || !prompt.trim()) return;
  window.dispatchEvent(new CustomEvent(COPILOTO_ASK_EVENT, { detail: { prompt } }));
}
