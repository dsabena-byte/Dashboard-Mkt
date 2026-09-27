// Señales nuevas de Web y SEO con DATA REAL (solo lectura, no persiste nada).
// Correr: cd apps/web && npx tsx scripts/web-seo-senales-real.ts
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Mod = require("module") as { _load: (req: string, ...a: unknown[]) => unknown };
const orig = Mod._load;
Mod._load = function (req: string, ...a: unknown[]) {
  if (req === "server-only") return {};
  if (req === "react") { const r = orig.call(this, req, ...a) as Record<string, unknown>; return { ...r, cache: r.cache ?? (<T,>(f: T) => f) }; }
  return orig.call(this, req, ...a);
};

(async () => {
  const { runWebCalidad } = await import("../src/lib/web-calidad-server");
  const { getEcommerceMensual } = await import("../src/lib/ecommerce-queries");
  const { computeWebCalidadSignals } = await import("../src/lib/signals/web-calidad");
  const { loadSeoAvanzado } = await import("../src/lib/seo-avanzado-server");
  const { computeSeoAvanzadoSignals } = await import("../src/lib/signals/seo-avanzado");
  const y = new Date().getUTCFullYear();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const metas = (await (await fetch(`${url}/rest/v1/kpi_meta_valores?plan=eq.Web%20%2F%20Ecommerce&anio=eq.${y}&select=kpi,mes,valor`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })).json()) as { kpi: string; mes: number; valor: number | null }[];
  const arr = (k: string) => Array.from({ length: 12 }, (_, i) => metas.find((m) => m.kpi === k && Number(m.mes) === i + 1)?.valor ?? null);
  const [snap, ecom] = await Promise.all([runWebCalidad(), getEcommerceMensual(y)]);
  const web = computeWebCalidadSignals({ snapshot: snap, diario: ecom.diario, metaTx: arr("Transacciones"), metaIngresos: arr("Total Ingresos") });
  console.log(`WEB (${web.length}):`); for (const s of web) console.log(`  [${s.prioridad}/${s.tipo}] ${s.key}: ${s.titulo}`);
  const a = await loadSeoAvanzado();
  const au = a.audit.status === "ok" && a.audit.data.ok ? a.audit.data : null;
  const seo = computeSeoAvanzadoSignals({ scDeep: a.scDeep, scSite: a.scSite, scImpresionesMes: a.scImpresionesMes, audit: au ? { issues: au.issues, bots: au.bots, paginas: au.paginas?.length } : null, fuentes: a.fuentes, kwEvol: a.kwEvol, esos: a.esos, llmoN: a.llmo.map((c) => ({ categoria: c.categoria, label: c.label, n: c.marcas[0]?.s.n ?? 0 })) });
  console.log(`SEO (${seo.length}):`); for (const s of seo) console.log(`  [${s.prioridad}/${s.tipo}] ${s.key}: ${s.titulo}`);
})();
