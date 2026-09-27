import "server-only";

// ============================================================================
// Cliente REST de DataForSEO (Basic auth con DATAFORSEO_AUTH, base64 login:password).
// Location Argentina (2032), idioma es. Portado de BIP (sep-2026). Lo usa /api/cron/seo-sync (SERP):
// cola Standard (task_post + task_get, ≈3,3× más barato) con fallback a /live.
//
// DataForSEO responde HTTP 200 aunque la tarea falle: el estado real está en
// `status_code` (raíz) y `tasks[0].status_code` (20000 = ok). 402xx = sin saldo/pago →
// DataForSeoError con `balance: true` (el sync NO debe pisar el snapshot bueno).
// ============================================================================

const DFS = "https://api.dataforseo.com/v3";
export const LOCATION_AR = 2032;
export const LANGUAGE_ES = "es";

export function dataforseoEnabled(): boolean {
  return Boolean(process.env.DATAFORSEO_AUTH);
}

export class DataForSeoError extends Error {
  code: number | null;
  balance: boolean;
  constructor(message: string, code: number | null) {
    super(message);
    this.name = "DataForSeoError";
    this.code = code;
    this.balance = code != null && code >= 40200 && code < 40300;
  }
}
/** Error que debe CORTAR el sync completo (sin saldo / credenciales): no tiene sentido seguir. */
export function isFatalDfsError(e: unknown): boolean {
  if (!(e instanceof DataForSeoError)) return false;
  return e.balance || e.code === 40100 || e.code === 40101 || e.code === 401;
}
/** Para usar en catch "best-effort": re-lanza solo los errores fatales. */
export function rethrowIfFatal(e: unknown): void {
  if (isFatalDfsError(e)) throw e;
}

export type DfsResponse<T> = { status_code?: number; status_message?: string; tasks?: Array<{ status_code?: number; status_message?: string; result?: T[] | null }> };

export async function dfsPost<T = unknown>(path: string, body: unknown): Promise<DfsResponse<T>> {
  const auth = process.env.DATAFORSEO_AUTH;
  if (!auth) throw new DataForSeoError("DATAFORSEO_AUTH no configurado", 401);
  const res = await fetch(`${DFS}${path}`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* cuerpo no-JSON */ }
  if (!res.ok) {
    const code = res.status === 402 ? 40200 : (Number(json?.status_code) || res.status);
    throw new DataForSeoError(`DataForSEO ${path} → HTTP ${res.status}${json?.status_message ? `: ${json.status_message}` : ""}`, code);
  }
  const rootCode = Number(json?.status_code);
  if (rootCode && rootCode !== 20000) throw new DataForSeoError(`DataForSEO ${path} → ${rootCode}: ${json?.status_message ?? ""}`, rootCode);
  const t0 = json?.tasks?.[0];
  const taskCode = Number(t0?.status_code);
  if (taskCode && taskCode !== 20000) throw new DataForSeoError(`DataForSEO ${path} → tarea ${taskCode}: ${t0?.status_message ?? ""}`, taskCode);
  return (json ?? {}) as DfsResponse<T>;
}

// ── Standard queue (task_post + task_get): ~3,3× más barato que /live ─────────────────────────
// task_post acepta hasta 100 tareas por request y devuelve un id por tarea (20100 = creada).
// task_get devuelve 20000 cuando está lista; 40601/40602 = todavía en cola. task_get no se cobra.
export const DFS_TASK_CREATED = 20100;
export const DFS_TASK_PENDING = new Set([40601, 40602]);

async function dfsFetch(path: string, init: RequestInit): Promise<{ res: Response; json: DfsResponse<unknown> & Record<string, unknown> }> {
  const auth = process.env.DATAFORSEO_AUTH;
  if (!auth) throw new DataForSeoError("DATAFORSEO_AUTH no configurado", 401);
  const res = await fetch(`${DFS}${path}`, { ...init, headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }, cache: "no-store" });
  let json: any = null;
  try { json = await res.json(); } catch { /* cuerpo no-JSON */ }
  if (!res.ok) {
    const code = res.status === 402 ? 40200 : (Number(json?.status_code) || res.status);
    throw new DataForSeoError(`DataForSEO ${path} → HTTP ${res.status}${json?.status_message ? `: ${json.status_message}` : ""}`, code);
  }
  const rootCode = Number(json?.status_code);
  if (rootCode && rootCode !== 20000) throw new DataForSeoError(`DataForSEO ${path} → ${rootCode}: ${json?.status_message ?? ""}`, rootCode);
  return { res, json: json ?? {} };
}

/** Encola tareas (≤100 por request). Devuelve el id por `tag`; las que fallan quedan sin id (→ fallback Live). */
export async function dfsTaskPost(path: string, tasks: Array<Record<string, unknown> & { tag: string }>): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (let i = 0; i < tasks.length; i += 100) {
    const { json } = await dfsFetch(path, { method: "POST", body: JSON.stringify(tasks.slice(i, i + 100)) });
    for (const t of (json.tasks ?? []) as Array<{ id?: string; status_code?: number; data?: { tag?: string } }>) {
      const code = Number(t.status_code);
      if (code >= 40200 && code < 40300) throw new DataForSeoError(`DataForSEO ${path} → tarea ${code}`, code);
      if (code === DFS_TASK_CREATED && t.id && t.data?.tag) ids.set(t.data.tag, t.id);
    }
  }
  return ids;
}

/** Lee una tarea encolada. `null` = todavía no está lista. Error = la tarea falló (→ fallback Live). */
export async function dfsTaskGet<T = unknown>(path: string, id: string): Promise<T[] | null> {
  const { json } = await dfsFetch(`${path}/${encodeURIComponent(id)}`, { method: "GET" });
  const t0 = json.tasks?.[0];
  const code = Number(t0?.status_code);
  if (DFS_TASK_PENDING.has(code)) return null;
  if (code && code !== 20000) throw new DataForSeoError(`DataForSEO ${path} → tarea ${code}: ${t0?.status_message ?? ""}`, code);
  return (t0?.result ?? []) as T[];
}

/**
 * SERP orgánica por la cola Standard: encola `tasks` (cada una con `keyword`), junta los resultados
 * listos hasta `deadline` (poll cada `pollMs`) y devuelve los items por keyword. Las que no llegaron
 * o fallaron quedan FUERA del mapa → el llamador las pide por /live. Un error fatal (sin saldo /
 * credenciales) se propaga.
 */
export async function dfsSerpStandard<I = unknown>(tasks: Array<Record<string, unknown> & { keyword: string }>, deadline: number, opts: { pollMs?: number; conc?: number } = {}): Promise<Map<string, I[]>> {
  const pollMs = opts.pollMs ?? 10_000, conc = opts.conc ?? 8;
  const got = new Map<string, I[]>();
  let ids: Map<string, string>;
  try { ids = await dfsTaskPost("/serp/google/organic/task_post", tasks.map((t) => ({ ...t, tag: t.keyword }))); }
  catch (e) { if (isFatalDfsError(e)) throw e; return got; }
  const pending = new Set(tasks.map((t) => t.keyword).filter((k) => ids.has(k)));
  while (pending.size && Date.now() < deadline) {
    const batch = [...pending];
    for (let i = 0; i < batch.length; i += conc) {
      await Promise.all(batch.slice(i, i + conc).map(async (kw) => {
        try {
          const res = await dfsTaskGet<{ items?: I[] }>("/serp/google/organic/task_get/advanced", ids.get(kw)!);
          if (res === null) return; // sigue en cola
          got.set(kw, res[0]?.items ?? []);
          pending.delete(kw);
        } catch (e) { if (isFatalDfsError(e)) throw e; pending.delete(kw); /* tarea fallida → /live */ }
      }));
    }
    if (pending.size && Date.now() + pollMs < deadline) await new Promise((r) => setTimeout(r, pollMs));
    else break;
  }
  return got;
}
