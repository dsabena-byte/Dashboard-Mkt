// Smoke (SOLO LECTURA) de las fuentes nativas de Mis tableros ("nat:*") + umbrales contra la DB real.
// Correr: cd apps/web && npx tsx scripts/native-datasets-smoke.ts
// Fuera de Next no hay cookies ni `server-only`: se stubean, y el cliente de @dashboard/db se reemplaza por
// uno de supabase-js con la service key (misma data que ve un usuario sin restricción); unstable_cache = passthrough.
// No escribe nada.
/* eslint-disable @typescript-eslint/no-require-imports */
import Module from "node:module";

const M = Module as unknown as { _resolveFilename: (req: string, ...a: unknown[]) => string; _load: (req: string, ...a: unknown[]) => unknown };
const orig = M._resolveFilename;
M._resolveFilename = (req: string, ...a: unknown[]) => (req === "server-only" ? require.resolve("./empty-module.cjs") : orig(req, ...a));
const origLoad = M._load;
M._load = (req: string, ...a: unknown[]) => {
  if (req === "next/cache") return { ...(origLoad(req, ...a) as object), unstable_cache: (f: unknown) => f };
  if (req === "next/headers") return { cookies: () => ({ getAll: () => [], get: () => undefined, set: () => undefined }) };
  if (req === "@dashboard/db") {
    const { createClient } = require("@supabase/supabase-js");
    return { createServerClient: () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) };
  }
  return origLoad(req, ...a);
};
const React = require("react");
if (!React.cache) React.cache = (f: unknown) => f;

async function main() {
  const { getNativeDataset, listNativeDatasets } = await import("../src/lib/native-datasets");
  const { seriesDesdeNativos } = await import("../src/lib/umbrales");
  let fails = 0;
  const ok = (name: string, cond: boolean, extra = "") => { if (!cond) fails++; console.log(`${cond ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`); };

  ok("restringido a /web ve solo Web", JSON.stringify(listNativeDatasets(["/web"]).map((d) => d.id)) === JSON.stringify(["nat:web"]));
  ok("sin acceso → null", (await getNativeDataset("nat:pauta", ["/web"])) === null);
  const ds: Record<string, Awaited<ReturnType<typeof getNativeDataset>>> = {};
  for (const id of ["nat:pauta", "nat:pauta-medios", "nat:web", "nat:redes", "nat:seguimiento"]) {
    const t0 = Date.now();
    const d = await getNativeDataset(id, null);
    ds[id] = d;
    ok(`${id}: filas`, !!d && d.rows.length > 0, `${d?.rows.length ?? 0} filas · ${Date.now() - t0} ms · cols ${d?.columns.join("|")}`);
    if (d?.rows.length) console.log("   últimas:", JSON.stringify(d.rows.slice(-2)));
  }
  const s = seriesDesdeNativos({ pauta: ds["nat:pauta"], web: ds["nat:web"], redes: ds["nat:redes"] });
  const last = (k: string) => JSON.stringify((s[k] ?? []).slice(-3));
  console.log("   serie inversion:", last("inversion"));
  console.log("   serie cpm:", last("cpm"));
  console.log("   serie sesiones:", last("sesiones"));
  console.log("   serie alcance_organico:", last("alcance_organico"));
  const ago = ds["nat:pauta"]?.rows.find((r) => r[0] === "2026-08-01");
  ok("pauta ago-2026 presente", !!ago, JSON.stringify(ago));
  const metaAgo = ds["nat:pauta-medios"]?.rows.find((r) => r[0] === "2026-08-01" && r[1] === "Meta");
  ok("Meta ago-2026 por API", !!metaAgo && metaAgo[7] === "API", JSON.stringify(metaAgo));
  console.log(fails ? `${fails} fallas` : "OK");
  if (fails) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
