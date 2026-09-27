// Sentimiento de comentarios POR POST — núcleo PURO y client-safe.
//
// Fuente: `social_posts` (positivo/neutro/negativo en % + `resumen_sentimiento`, los llena el cron
// ig-sentiment-analysis). Los posts propios del tablero vienen de la API de Meta (`meta_posts`) →
// se cruzan por SHORTCODE de IG (`postKey`: /p/ y /reel/ dan la misma clave).

export interface PostSentiment {
  positivo: number | null;
  neutro: number | null;
  negativo: number | null;
  resumen: string | null;
  comentarios: number | null;
}

interface SentimentRow {
  positivo?: number | null;
  neutro?: number | null;
  negativo?: number | null;
  resumen_sentimiento?: string | null;
  comentarios?: number | null;
}

/** Resumen útil (descarta vacíos, "Error…" y "Sin comentarios…"). */
export function resumenValido(r: string | null | undefined): string | null {
  const t = String(r ?? "").trim();
  if (!t || /^(error|sin comentarios)/i.test(t)) return null;
  return t;
}

/** Porcentajes normalizados a 100 (null si no hay análisis). */
export function sentimentPcts(s: Pick<PostSentiment, "positivo" | "neutro" | "negativo">): { pos: number; neu: number; neg: number } | null {
  const p = Math.max(0, Number(s.positivo ?? 0));
  const u = Math.max(0, Number(s.neutro ?? 0));
  const n = Math.max(0, Number(s.negativo ?? 0));
  const tot = p + u + n;
  if (!(tot > 0)) return null;
  return { pos: (p / tot) * 100, neu: (u / tot) * 100, neg: (n / tot) * 100 };
}

export function toPostSentiment(row: SentimentRow | null | undefined): PostSentiment | null {
  if (!row) return null;
  return {
    positivo: row.positivo ?? null,
    neutro: row.neutro ?? null,
    negativo: row.negativo ?? null,
    resumen: resumenValido(row.resumen_sentimiento),
    comentarios: row.comentarios ?? null,
  };
}

/** Parte "Pos: … Neg: …" en segmentos con su tono (texto libre = tono null). */
export function resumenSegmentos(r: string): Array<{ tono: "pos" | "neu" | "neg" | null; texto: string }> {
  const re = /(Pos|Neu|Neg)\s*:/gi;
  const out: Array<{ tono: "pos" | "neu" | "neg" | null; texto: string }> = [];
  const marks: Array<{ i: number; end: number; tono: "pos" | "neu" | "neg" }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(r))) marks.push({ i: m.index, end: m.index + m[0].length, tono: m[1]!.toLowerCase() as "pos" | "neu" | "neg" });
  if (marks.length === 0) return [{ tono: null, texto: r.trim() }];
  const pre = r.slice(0, marks[0]!.i).trim();
  if (pre) out.push({ tono: null, texto: pre });
  marks.forEach((mk, k) => {
    const texto = r.slice(mk.end, k + 1 < marks.length ? marks[k + 1]!.i : r.length).trim();
    if (texto) out.push({ tono: mk.tono, texto });
  });
  return out;
}
