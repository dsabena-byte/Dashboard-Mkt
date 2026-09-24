// ============================================================================
// Método BIP (portado a Drean, sep-2026) — índice de la guía. Junta los módulos de cada nivel y expone helpers.
// Client-safe, pero pesado (todo el contenido): importarlo solo desde server components
// o desde páginas de /guia. Para el cliente liviano (drawer de KPI) usar lib/guia/titulos.ts.
// ============================================================================
import type { Etapa, Modulo } from "./types";
import { METODO } from "./metodo";
import { ESTRATEGICO } from "./estrategico";
import { TACTICO_MEDIOS } from "./tactico-medios";
import { TACTICO_CANALES } from "./tactico-canales";
import { OPERATIVO_META_GOOGLE } from "./operativo-meta-google";
import { OPERATIVO_OTROS } from "./operativo-otros";

export * from "./types";

export const MODULOS: Modulo[] = [
  ...METODO,
  ...ESTRATEGICO,
  ...TACTICO_MEDIOS,
  ...TACTICO_CANALES,
  ...OPERATIVO_META_GOOGLE,
  ...OPERATIVO_OTROS,
];

const BY_ID = new Map(MODULOS.map((m) => [m.id, m]));

export function getModulo(id: string): Modulo | undefined {
  return BY_ID.get(id);
}

export function modulosByIds(ids: string[] | undefined): Modulo[] {
  return (ids ?? []).map((id) => BY_ID.get(id)).filter((m): m is Modulo => Boolean(m));
}

/** Módulo que explica cada etapa del ciclo (para el header del Método). */
export const ETAPA_MODULO: Record<Etapa, string> = {
  construir: "ciclo-construir",
  aprender: "ciclo-aprender",
  optimizar: "ciclo-optimizar",
  acelerar: "ciclo-acelerar",
};

/** Slug de tablero → ruta y nombre en el menú de Drean (components/sidebar.tsx). Los slugs
 *  "trade", "resultados", "inversion" y "conexiones" vienen del contenido original de BIP y se
 *  mapean a las rutas equivalentes de Drean. */
export const DASH_HREF: Record<string, { href: string; label: string }> = {
  "mapa-estrategico": { href: "/mapa-estrategico", label: "Mapa Estratégico" },
  overview: { href: "/overview", label: "Seguimiento Objetivos" },
  performance: { href: "/performance", label: "Plan de Medios" },
  "performance-conversion": { href: "/performance-conversion", label: "Performance Conversión" },
  redes: { href: "/redes", label: "Redes Sociales" },
  influencia: { href: "/influencia", label: "Mkt de Influencia" },
  "mkt-canal": { href: "/mkt-canal", label: "Mkt Canal Comercial" },
  web: { href: "/web", label: "Web / Ecommerce" },
  "seo-search": { href: "/seo-search", label: "Optimización SEO" },
  "cuadros-basicos": { href: "/cuadros-basicos", label: "Cuadros Básicos" },
  "floor-share": { href: "/floor-share", label: "Floor Share" },
  "salud-marca": { href: "/salud-marca", label: "Salud de Marca" },
  mercado: { href: "/mercado", label: "Resultados Comerciales" },
  resultados: { href: "/mercado", label: "Resultados Comerciales" },
  funnel: { href: "/funnel", label: "Inversión de Marketing" },
  inversion: { href: "/funnel", label: "Inversión de Marketing" },
  contenido: { href: "/contenido", label: "Generador de Contenido" },
  monitoreo: { href: "/monitoreo", label: "Monitoreo conexiones" },
  conexiones: { href: "/monitoreo", label: "Monitoreo conexiones" },
};

/** Slugs que en Drean son más de un tablero (Trade Mkt = Cuadros Básicos + Floor Share). */
const DASH_EXPAND: Record<string, string[]> = { trade: ["cuadros-basicos", "floor-share"] };

/** Tableros (ruta + label) de un módulo, expandidos y sin duplicar rutas. */
export function dashLinks(slugs: string[]): { slug: string; href: string; label: string }[] {
  const out: { slug: string; href: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const s of slugs.flatMap((x) => DASH_EXPAND[x] ?? [x])) {
    const d = DASH_HREF[s];
    if (!d || seen.has(d.href)) continue;
    seen.add(d.href);
    out.push({ slug: s, ...d });
  }
  return out;
}

/** Texto plano para búsqueda (sin marcas de markdown-lite). */
export function textoBusqueda(m: Modulo): string {
  const partes = [
    m.titulo, m.resumen, ...(m.canal ?? []), m.plataforma ?? "",
    ...m.secciones.map((s) => s.titulo),
    ...(m.pasos ?? []).map((p) => p.titulo),
    ...(m.benchmarks ?? []).map((b) => b.metrica),
  ];
  return partes.join(" ").replace(/\*\*|`/g, "");
}
