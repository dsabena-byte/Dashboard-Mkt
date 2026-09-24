import "server-only";

// Rate limit simple por usuario, en memoria (por instancia serverless: es un freno de
// abuso/costo, no una cuota exacta). Ventana deslizante: máx. LIMIT consultas cada WINDOW_MS.
const LIMIT = 30;
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

export function checkRateLimit(key: string, now = Date.now()): { ok: true } | { ok: false; retryInSec: number } {
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= LIMIT) {
    hits.set(key, arr);
    return { ok: false, retryInSec: Math.ceil((WINDOW_MS - (now - arr[0]!)) / 1000) };
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1]! > WINDOW_MS) hits.delete(k);
  return { ok: true };
}
