// Cola Standard de DataForSEO para la SERP (portado de BIP COST-10): encola, junta lo que está listo y
// deja afuera (→ /live en el cron) lo que no llega o falla. fetch simulado; no llama a la API real.
// Correr: cd apps/web && npx tsx scripts/seo-standard-queue.test.ts
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Mod = require("module") as { _load: (req: string, ...a: unknown[]) => unknown };
const origLoad = Mod._load;
Mod._load = function (req: string, ...a: unknown[]) { return req === "server-only" ? {} : origLoad.call(this, req, ...a); };
process.env.DATAFORSEO_AUTH = "dGVzdDp0ZXN0";
let ok = 0, fail = 0;
const check = (name: string, cond: boolean) => { if (cond) ok++; else { fail++; console.error("FAIL", name); } };

type Call = { url: string; method: string; body?: unknown };
const calls: Call[] = [];
const organic = (domain: string, rank: number) => ({ type: "organic", domain, rank_group: rank, url: `https://${domain}/x` });
let sinSaldo = false;
// kw "a" lista enseguida; "b" siempre en cola; "c" falla la tarea; "d" no se encoló.
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input); const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  calls.push({ url, method, body });
  const json = (x: unknown) => new Response(JSON.stringify(x), { status: 200 });
  if (url.endsWith("/task_post")) {
    if (sinSaldo) return json({ status_code: 20000, tasks: [{ status_code: 40200, status_message: "Payment Required" }] });
    return json({ status_code: 20000, tasks: (body as Array<{ tag: string; keyword: string }>).filter((t) => t.keyword !== "d").map((t) => ({ id: `id-${t.keyword}`, status_code: 20100, data: { tag: t.tag } })) });
  }
  if (url.includes("/task_get/advanced/")) {
    const id = url.split("/").pop();
    if (id === "id-a") return json({ status_code: 20000, tasks: [{ status_code: 20000, result: [{ items: [organic("drean.com.ar", 3)] }] }] });
    if (id === "id-b") return json({ status_code: 20000, tasks: [{ status_code: 40602, status_message: "Task In Queue" }] });
    return json({ status_code: 20000, tasks: [{ status_code: 40501, status_message: "Invalid Field" }] });
  }
  throw new Error("url inesperada " + url);
}) as typeof fetch;

(async () => {
  const { dfsSerpStandard, isFatalDfsError } = await import("../src/lib/dataforseo");
  const tasks = ["a", "b", "c", "d"].map((k) => ({ keyword: k, location_code: 2032, language_code: "es", depth: 100 }));
  const got = await dfsSerpStandard<{ domain: string; rank_group: number }>(tasks, Date.now() + 250, { pollMs: 100 });
  const post = calls.find((c) => c.url.endsWith("/task_post"));
  check("un solo task_post", calls.filter((c) => c.url.endsWith("/task_post")).length === 1);
  check("task_post con depth 100 y tag = keyword", (post?.body as Array<{ depth: number; tag: string; keyword: string }>).every((t) => t.depth === 100 && t.tag === t.keyword));
  check("a llega por la cola (pos 3)", got.get("a")?.[0]?.rank_group === 3);
  check("b (en cola), c (fallida), d (no encolada) quedan para /live", !got.has("b") && !got.has("c") && !got.has("d"));
  check("hace poll de b más de una vez antes del deadline", calls.filter((c) => c.url.endsWith("/id-b")).length >= 2);
  // deadline vencido: no espera, devuelve vacío (todo a /live)
  calls.length = 0;
  const got0 = await dfsSerpStandard(tasks, 0, { pollMs: 100 });
  check("deadline 0 → no lee la cola", got0.size === 0 && calls.filter((c) => c.url.includes("task_get")).length === 0);
  // sin saldo = error fatal que corta el sync
  sinSaldo = true;
  let fatal = false;
  try { await dfsSerpStandard(tasks, Date.now() + 100); } catch (e) { fatal = isFatalDfsError(e); }
  check("sin saldo en task_post → error fatal", fatal);
  console.log(`seo-standard-queue: ${ok} OK, ${fail} FAIL`);
  if (fail) process.exit(1);
})();
