// ============================================================================
// Respuestas verificadas del copiloto (puro; portado de BIP, sep-2026): similitud pregunta ↔ ejemplos
// verificados por el equipo en /copiloto
// y bloque few-shot para el system prompt. Patrón "Verified Query Repository" (Snowflake) / "verified
// answers" (Power BI): el ejemplo enseña el MÉTODO (qué tools consultar, cómo responder); los números
// se vuelven a traer siempre con las tools.
// ============================================================================

export interface Verificada {
  id: number;
  pregunta: string;
  respuesta: string;
  tools: string[];
  pathname?: string | null;
}

const STOP = new Set(
  "a al algo como con cual cuales cuanto cuantos cuanta cuantas de del el ella en es esta este esto la las le lo los mas me mi mis muy no o para pero por que qué se si sin sobre su sus te tu tus un una uno unos y ya hay son fue ser estan esta estoy vs mes meses año ano dame decime mostrame quiero saber".split(" "),
);

/** Normaliza: minúsculas, sin acentos, sin signos. */
export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9ñ%\s]/g, " ").replace(/\s+/g, " ").trim();
}

// Raíz liviana (sin librería): prefijo de 5 letras después de sacar el plural → "campañas"≈"campaña",
// "escalo"≈"escalar". Truncado por prefijo = stemming simple que funciona bien en español para
// textos cortos (preguntas).
function raiz(w: string): string {
  let x = w;
  if (x.length > 5 && x.endsWith("es")) x = x.slice(0, -2);
  else if (x.length > 4 && x.endsWith("s")) x = x.slice(0, -1);
  return x.slice(0, 5);
}

export function tokens(s: string): Set<string> {
  return new Set(normalizar(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w)).map(raiz));
}

/** Similitud 0..1 (Dice sobre tokens con raíz). */
export function similitud(a: string, b: string): number {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return (2 * inter) / (A.size + B.size);
}

export const UMBRAL_SIMILITUD = 0.4;

/**
 * Las k verificadas más parecidas a `pregunta` sobre el umbral. Bonus chico si es del mismo tablero.
 */
export function elegirVerificadas(pregunta: string, candidatas: Verificada[], opts: { pathname?: string; k?: number; umbral?: number } = {}): (Verificada & { score: number })[] {
  const k = opts.k ?? 2;
  const umbral = opts.umbral ?? UMBRAL_SIMILITUD;
  return candidatas
    .map((v) => {
      let score = similitud(pregunta, v.pregunta);
      if (score > 0 && opts.pathname && v.pathname && v.pathname === opts.pathname) score += 0.05;
      return { ...v, score: Math.round(score * 1000) / 1000 };
    })
    .filter((v) => v.score >= umbral)
    .sort((a, b) => b.score - a.score || b.id - a.id)
    .slice(0, k);
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Bloque para el system prompt (vacío si no hay ejemplos). */
export function bloqueVerificadas(vs: Verificada[]): string {
  if (!vs.length) return "";
  const items = vs.map((v, i) => `Ejemplo ${i + 1}\nPregunta: ${clip(v.pregunta.trim(), 300)}\nDatos consultados: ${v.tools.length ? v.tools.join(", ") : "—"}\nRespuesta aprobada:\n${clip(v.respuesta.trim(), 1500)}`).join("\n\n");
  return `\n\n## Respuestas verificadas por el equipo (ejemplos de método)\nEstas preguntas parecidas fueron revisadas y aprobadas. Seguí el MISMO método (consultá las mismas fuentes y respondé con esa estructura), pero TODOS los números salen de las tools de esta conversación: no copies cifras del ejemplo.\n\n${items}`;
}

// ── Feedback (validación del body; puro para testear) ─────────────────────────────────────────
export const MOTIVOS_FEEDBACK = ["dato_incorrecto", "no_respondio", "incompleta", "lenta", "otro"] as const;
export type MotivoFeedback = (typeof MOTIVOS_FEEDBACK)[number];
export const MOTIVO_LABEL: Record<MotivoFeedback, string> = {
  dato_incorrecto: "Un dato está mal",
  no_respondio: "No respondió lo que pregunté",
  incompleta: "Le faltó información",
  lenta: "Tardó demasiado",
  otro: "Otra cosa",
};

export interface FeedbackInput {
  rating: 1 | -1;
  motivo: MotivoFeedback | null;
  comentario: string | null;
  pregunta: string;
  respuesta: string;
  tools: string[];
  pathname: string | null;
}

/** Valida el body de /api/chat/feedback. Devuelve el input limpio o el motivo del rechazo. */
export function parseFeedback(b: unknown): { ok: true; v: FeedbackInput } | { ok: false; error: string } {
  if (typeof b !== "object" || b === null) return { ok: false, error: "body inválido" };
  const o = b as Record<string, unknown>;
  const rating = Number(o.rating);
  if (rating !== 1 && rating !== -1) return { ok: false, error: "rating debe ser 1 o -1" };
  const pregunta = typeof o.pregunta === "string" ? o.pregunta.trim().slice(0, 2000) : "";
  const respuesta = typeof o.respuesta === "string" ? o.respuesta.trim().slice(0, 12000) : "";
  if (!pregunta || !respuesta) return { ok: false, error: "faltan pregunta o respuesta" };
  const motivo = (MOTIVOS_FEEDBACK as readonly string[]).includes(String(o.motivo)) ? (o.motivo as MotivoFeedback) : null;
  const comentario = typeof o.comentario === "string" && o.comentario.trim() ? o.comentario.trim().slice(0, 1000) : null;
  const tools = Array.isArray(o.tools) ? [...new Set(o.tools.filter((t): t is string => typeof t === "string" && /^[a-z_]{2,40}$/.test(t)))].slice(0, 20) : [];
  const pathname = typeof o.pathname === "string" && o.pathname.startsWith("/") ? o.pathname.slice(0, 200) : null;
  return { ok: true, v: { rating: rating as 1 | -1, motivo: rating === -1 ? motivo : null, comentario, pregunta, respuesta, tools, pathname } };
}

// ── Vista de revisión (/copiloto): ranking de peores respuestas (puro) ─────────────────────────
export interface FeedbackRow { id: number; user_email?: string | null; rating: number; motivo: string | null; comentario: string | null; pregunta: string; respuesta: string; tools: string[]; pathname: string | null; created_at: string; revisado?: boolean }

export interface ResumenFeedback {
  total: number; positivos: number; negativos: number; pctPositivo: number | null;
  porMotivo: { motivo: string; n: number }[];
  /** Tools con más 👎 relativos (mín. 3 calificaciones). */
  porTool: { tool: string; n: number; negativos: number; pctNegativo: number }[];
}

export function resumenFeedback(rows: FeedbackRow[]): ResumenFeedback {
  const pos = rows.filter((r) => r.rating > 0).length;
  const neg = rows.filter((r) => r.rating < 0);
  const mot = new Map<string, number>();
  for (const r of neg) mot.set(r.motivo ?? "sin_motivo", (mot.get(r.motivo ?? "sin_motivo") ?? 0) + 1);
  const tool = new Map<string, { n: number; neg: number }>();
  for (const r of rows) for (const t of new Set(r.tools)) { const x = tool.get(t) ?? { n: 0, neg: 0 }; x.n++; if (r.rating < 0) x.neg++; tool.set(t, x); }
  return {
    total: rows.length, positivos: pos, negativos: neg.length,
    pctPositivo: rows.length ? Math.round((pos / rows.length) * 1000) / 10 : null,
    porMotivo: [...mot.entries()].map(([motivo, n]) => ({ motivo, n })).sort((a, b) => b.n - a.n),
    porTool: [...tool.entries()].filter(([, x]) => x.n >= 3).map(([t, x]) => ({ tool: t, n: x.n, negativos: x.neg, pctNegativo: Math.round((x.neg / x.n) * 1000) / 10 })).sort((a, b) => b.pctNegativo - a.pctNegativo || b.n - a.n),
  };
}

/**
 * "Peores respuestas" = 👎 sin revisar primero, priorizando las que traen comentario (más accionables)
 * y "dato incorrecto" (lo más grave para la confianza), después las más recientes.
 */
export function peoresRespuestas(rows: FeedbackRow[], n = 30): FeedbackRow[] {
  const peso = (r: FeedbackRow) => (r.revisado ? 0 : 100) + (r.motivo === "dato_incorrecto" ? 10 : 0) + (r.comentario ? 5 : 0);
  return rows.filter((r) => r.rating < 0).sort((a, b) => peso(b) - peso(a) || b.created_at.localeCompare(a.created_at)).slice(0, n);
}
