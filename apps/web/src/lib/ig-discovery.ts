import "server-only";
import { bdFieldsParam, parseBd, usagePct, classifyBdError, bdPlan, normHandle, validHandle, BD_USAGE_STOP_PCT, type BdErrorKind, type BdPost } from "@/lib/ig-discovery-core";

// Cliente de Business Discovery (Graph API oficial) para la competencia de Instagram. Usa el token de
// la Página de Drean (META_SYSTEM_USER_TOKEN → page token, el mismo del ig-sync). Secuencial por marca,
// con corte por uso de rate limit (headers de Meta) y sin reintentos agresivos: si Meta limita, la
// corrida para y lo que falta queda con el dato del scraper (n8n + Apify). Nunca tira.

const GRAPH = "https://graph.facebook.com/v22.0";

/** Cuenta propia de IG con la que se consulta (Business Discovery corre "desde" la cuenta propia). */
export interface BdAsset { igId: string; pageToken: string }

/** Página de Drean (misma constante que ig-sync / meta-fb-sync). */
export const DREAN_PAGE_ID = "257587170945975";

/**
 * Token de la Página + id de IG propio a partir de META_SYSTEM_USER_TOKEN (mismo flujo que ig-sync).
 * Devuelve null (con motivo) si falta el env o Meta no responde. Nunca tira ni expone el token.
 */
export async function getDreanIgAsset(): Promise<{ asset: BdAsset | null; motivo?: string }> {
  const token = process.env.META_SYSTEM_USER_TOKEN;
  if (!token) return { asset: null, motivo: "META_SYSTEM_USER_TOKEN no configurado" };
  try {
    const pr = await fetch(`${GRAPH}/me/accounts?fields=id,access_token&limit=100&access_token=${encodeURIComponent(token)}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const pj = (await pr.json().catch(() => null)) as { data?: { id: string; access_token?: string }[] } | null;
    const pageToken = pj?.data?.find((p) => p.id === DREAN_PAGE_ID)?.access_token;
    if (!pageToken) return { asset: null, motivo: `Página ${DREAN_PAGE_ID} sin token (HTTP ${pr.status})` };
    const ir = await fetch(`${GRAPH}/${DREAN_PAGE_ID}?fields=instagram_business_account&access_token=${encodeURIComponent(pageToken)}`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    const ij = (await ir.json().catch(() => null)) as { instagram_business_account?: { id: string } } | null;
    const igId = ij?.instagram_business_account?.id;
    if (!igId) return { asset: null, motivo: `Página sin cuenta de IG Business vinculada (HTTP ${ir.status})` };
    return { asset: { igId, pageToken } };
  } catch (e) {
    return { asset: null, motivo: (e as Error).message.slice(0, 160) };
  }
}

export interface BdResult {
  ok: boolean;
  handle: string;
  followers: number | null;
  mediaCount: number | null;
  posts: BdPost[];
  likesOcultos: number;
  /** true = se leyó hasta `fromDate` o hasta el final de la cuenta. */
  complete: boolean;
  error?: BdErrorKind;
  message?: string;
  calls: number;
}

export interface BdSession {
  /** % máximo de uso informado por Meta en la última respuesta. */
  usage: number;
  /** true = se cortó por rate limit: no hacer más llamadas en esta corrida. */
  stopped: boolean;
  calls: number;
}
export const newBdSession = (): BdSession => ({ usage: 0, stopped: false, calls: 0 });

async function call(asset: BdAsset, fields: string, s: BdSession): Promise<{ json?: unknown; err?: { kind: BdErrorKind; message: string } }> {
  const url = `${GRAPH}/${asset.igId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(asset.pageToken)}`;
  s.calls++;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    s.usage = Math.max(s.usage, usagePct(res.headers.get("x-app-usage"), res.headers.get("x-business-use-case-usage")));
    if (s.usage >= BD_USAGE_STOP_PCT) s.stopped = true;
    const json = (await res.json().catch(() => null)) as { error?: { code?: number; error_subcode?: number; message?: string } } | null;
    if (res.ok && json && !json.error) return { json };
    const e = json?.error;
    const kind = classifyBdError(e?.code, e?.error_subcode, e?.message ?? `HTTP ${res.status}`);
    if (kind === "rate" || res.status === 429) s.stopped = true;
    // Nunca devolver el token en el mensaje.
    const msg = (e?.message ?? `HTTP ${res.status}`).replace(/access_token=[^&\s]+/g, "access_token=***").slice(0, 200);
    return { err: { kind: res.status === 429 ? "rate" : kind, message: msg } };
  } catch (e) {
    return { err: { kind: "otro", message: (e as Error).message.slice(0, 200) } };
  }
}

/** Seguidores + posts (desde `fromDate`) de UNA cuenta Business/Creator de Instagram. */
export async function fetchBusinessDiscovery(asset: BdAsset, rawHandle: string, marca: string, fromDate: string, mode: "daily" | "full", s: BdSession): Promise<BdResult> {
  const handle = normHandle(rawHandle);
  const out: BdResult = { ok: false, handle, followers: null, mediaCount: null, posts: [], likesOcultos: 0, complete: false, calls: 0 };
  if (!validHandle(handle)) return { ...out, error: "no_business", message: "usuario de Instagram inválido" };
  const { limit, maxPages } = bdPlan(mode);
  let after: string | null = null;
  let lite = false;
  for (let page = 0; page < maxPages; page++) {
    if (s.stopped) { out.error ??= "rate"; break; }
    const before = s.calls;
    let r = await call(asset, bdFieldsParam(handle, { limit, after, lite }), s);
    // view_count rechazado → reintenta la misma página sin ese campo (una vez).
    if (r.err?.kind === "campo" && !lite) { lite = true; r = await call(asset, bdFieldsParam(handle, { limit, after, lite }), s); }
    out.calls += s.calls - before;
    if (r.err) { out.error = r.err.kind; out.message = r.err.message; break; }
    const p = parseBd(r.json, marca, fromDate);
    if (!p.ok) { out.error = "otro"; out.message = "respuesta sin business_discovery"; break; }
    out.ok = true;
    out.followers = p.followers;
    out.mediaCount = p.mediaCount;
    out.posts.push(...p.posts);
    out.likesOcultos += p.likesOcultos;
    if (!p.after || p.reachedFrom) { out.complete = true; break; }
    after = p.after;
  }
  // Si la 1ª página anduvo y una siguiente falló, igual es un resultado válido (parcial).
  if (out.ok) delete out.error;
  return out;
}
