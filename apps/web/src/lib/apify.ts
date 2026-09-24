import "server-only";
// Cliente REST mínimo de Apify (portado de BIP): corre un actor de forma SÍNCRONA y devuelve los
// items del dataset. Gate: APIFY_API_TOKEN (env server-side, ya usado por ugc-comments-sync).

const API = "https://api.apify.com/v2";

export function apifyEnabled(): boolean {
  return Boolean(process.env.APIFY_API_TOKEN);
}

// actorId con "~" (no "/"): ej "apify~facebook-ads-scraper".
export async function runActor<T = Record<string, unknown>>(actorId: string, input: Record<string, unknown>, timeoutSecs = 240): Promise<T[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("APIFY_API_TOKEN no configurado");
  const url = `${API}/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=${timeoutSecs}`;
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Apify ${actorId} → ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = (await res.json()) as T[];
  return Array.isArray(json) ? json : [];
}
