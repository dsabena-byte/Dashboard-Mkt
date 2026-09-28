// Paridad Business Discovery ↔ scraper (n8n + Apify) — núcleo PURO (sin I/O), testeado en
// scripts/bd-paridad.test.ts.
//
// Business Discovery (BD) corre DESPUÉS del scraper y actualiza las filas de social_posts que el
// scraper ya cargó. Regla: BD nunca puede dejar una fila con MENOS información que la que tenía:
//  · contadores (likes, comentarios, views) solo suben: si BD trae un valor menor (o no lo trae),
//    se conserva el del scraper. Evita que un dato de otra definición (ej. views de Reels) pise el
//    del scraper y que la serie "baje" entre corridas;
//  · followers del post = seguidores AL MOMENTO del post (lo usa el ER por post): solo se completa
//    si la fila no lo tenía, no se reemplaza por el de hoy;
//  · nunca se escribe null.
// Además, los posts que SOLO encontró BD (el scraper no los trajo) no tienen pilar: se clasifican
// con el mismo vocabulario de 5 pilares del scraper (pilarPrompt / parsePilares).

export interface MetricRow { likes: number | null; comentarios: number | null; views: number | null; followers: number | null }
export interface BdMetrics { likes: number | null; comentarios: number | null; views: number | null }

const pos = (n: number | null | undefined): number | null => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null);

/** Patch de métricas para una fila existente. Vacío = no hay nada que mejorar. */
export function bdMetricPatch(existing: MetricRow, bd: BdMetrics, followersHoy: number | null): Record<string, number> {
  const patch: Record<string, number> = {};
  const up = (k: "likes" | "comentarios" | "views", v: number | null) => {
    const nv = pos(v);
    if (nv == null || (k === "views" && nv === 0)) return;
    const cur = pos(existing[k]);
    if (cur == null || nv > cur) patch[k] = nv;
  };
  up("likes", bd.likes);
  up("comentarios", bd.comentarios);
  up("views", bd.views);
  const f = pos(followersHoy);
  if (f && !(pos(existing.followers) ?? 0)) patch.followers = f;
  return patch;
}

// ── Pilar de los posts que solo trajo BD ──────────────────────────────────────────────────────
export const PILARES = ["Branding", "Producto", "Promo", "Influencer", "Educacional"] as const;
export type Pilar = (typeof PILARES)[number];
export const PILAR_LOTE = 60;

export function pilarPrompt(items: { i: number; marca: string; copy: string }[]): string {
  return `Sos analista de redes sociales de electrodomésticos en Argentina. Clasificá cada post de Instagram en UNO de estos pilares de contenido (escrito exactamente igual): ${PILARES.join(", ")}.
- Branding: institucional, valores, efemérides, aniversarios, marca.
- Producto: muestra o describe un producto o sus funciones.
- Promo: precio, descuento, cuotas, sorteo, concurso, evento comercial.
- Influencer: contenido de o con creadores, colaboraciones.
- Educacional: tips, recetas, cuidados, cómo usar.
Posts:
${items.map((x) => `${x.i}. [${x.marca}] ${x.copy.replace(/\s+/g, " ").slice(0, 280) || "(sin texto)"}`).join("\n")}

Devolvé SOLO un JSON: {"pilares":[{"i":<número>,"pilar":"<pilar>"}]} con una entrada por post.`;
}

/** Normaliza un pilar al vocabulario del scraper ("Producto/Branding" → el primero válido; si no, Branding). */
export function pickPilar(raw: unknown): Pilar {
  const s = String(raw ?? "").trim();
  const hit = (x: string) => PILARES.find((p) => p.toLowerCase() === x.trim().toLowerCase());
  return hit(s) ?? s.split("/").map(hit).find(Boolean) ?? "Branding";
}

export function parsePilares(text: string): Map<number, Pilar> {
  const out = new Map<number, Pilar>();
  try {
    const j = JSON.parse(text) as { pilares?: { i?: unknown; pilar?: unknown }[] };
    for (const t of j.pilares ?? []) {
      const i = Number(t.i);
      if (Number.isInteger(i) && typeof t.pilar === "string" && t.pilar.trim()) out.set(i, pickPilar(t.pilar));
    }
  } catch { /* respuesta inválida → sin pilares */ }
  return out;
}
