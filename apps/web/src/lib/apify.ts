import "server-only";
// Cliente REST mínimo de Apify (portado de BIP): corre un actor de forma SÍNCRONA y devuelve los
// items del dataset. Gate: APIFY_API_TOKEN (env server-side, ya usado por ugc-comments-sync).

const API = "https://api.apify.com/v2";

export function apifyEnabled(): boolean {
  return Boolean(process.env.APIFY_API_TOKEN);
}

/** Error de cupo de la cuenta (402/403 "usage limit"): hay que cortar la corrida, no reintentar. */
export class ApifyQuotaError extends Error {
  constructor(message: string) { super(message); this.name = "ApifyQuotaError"; }
}

/** ¿El status/texto de Apify es "se acabó el cupo mensual / sin crédito"? (puro, testeado vía competencia-scraper-core). */
export { isApifyQuotaText } from "./competencia-scraper-core";
import { isApifyQuotaText } from "./competencia-scraper-core";

export interface RunOpts {
  /** Corta los actores pay-per-result al llegar a N items (Apify `maxItems`). */
  maxItems?: number;
  /** Tope de gasto de la corrida en US$ (Apify `maxTotalChargeUsd`, actores pay-per-event). */
  maxChargeUsd?: number;
}

// actorId con "~" (no "/"): ej "apify~facebook-ads-scraper".
export async function runActor<T = Record<string, unknown>>(actorId: string, input: Record<string, unknown>, timeoutSecs = 240, opts: RunOpts = {}): Promise<T[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN no configurado");
  const q = new URLSearchParams({ token, timeout: String(timeoutSecs) });
  if (opts.maxItems && opts.maxItems > 0) q.set("maxItems", String(Math.ceil(opts.maxItems)));
  if (opts.maxChargeUsd && opts.maxChargeUsd > 0) q.set("maxTotalChargeUsd", String(opts.maxChargeUsd));
  const url = `${API}/acts/${actorId}/run-sync-get-dataset-items?${q.toString()}`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), cache: "no-store" });
  if (!res.ok) {
    const txt = (await res.text().catch(() => "")).replace(/token=[^&\s"]+/g, "token=***");
    const msg = `Apify ${actorId} → ${res.status}: ${txt.slice(0, 300)}`;
    if (isApifyQuotaText(res.status, txt)) throw new ApifyQuotaError(msg);
    throw new Error(msg);
  }
  const json = (await res.json()) as T[];
  return Array.isArray(json) ? json : [];
}
