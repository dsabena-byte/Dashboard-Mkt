// Smoke de RENDER con data real (solo lectura): las secciones nuevas de /seo-search y /web se renderizan
// a HTML sin tirar. Correr: cd apps/web && npx tsx scripts/web-seo-render-smoke.tsx
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Mod = require("module") as { _load: (req: string, ...a: unknown[]) => unknown };
const orig = Mod._load;
Mod._load = function (req: string, ...a: unknown[]) {
  if (req === "server-only") return {};
  if (req === "react") { const r = orig.call(this, req, ...a) as Record<string, unknown>; return { ...r, cache: r.cache ?? (<T,>(f: T) => f) }; }
  return orig.call(this, req, ...a);
};

// tsconfig usa jsx: preserve → tsx compila con el runtime clásico: React global.
(globalThis as unknown as { React: unknown }).React = require("react");

(async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const S = await import("../src/components/seo-search/seo-avanzado-section");
  const W = await import("../src/components/web/web-calidad");
  const { runWebCalidad } = await import("../src/lib/web-calidad-server");
  const { getEcommerceMensual } = await import("../src/lib/ecommerce-queries");
  const { cierreDeMes } = await import("../src/lib/web-forecast");
  const { chequeoConsent } = await import("../src/lib/web-consent");
  let fails = 0;
  for (const [name, C] of Object.entries({ MarcaDigitalSection: S.MarcaDigitalSection, LlmoIcSection: S.LlmoIcSection, KwEvolucionSection: S.KwEvolucionSection, ScAvanzadoSection: S.ScAvanzadoSection, AuditoriaSection: S.AuditoriaSection })) {
    try { const el = await (C as () => Promise<React.ReactElement | null>)(); const html = el ? renderToStaticMarkup(el) : ""; console.log(`  ✓ ${name}: ${html.length} chars`); if (/\bBIP\b/.test(html)) { fails++; console.error(`  ✗ ${name} menciona BIP`); } }
    catch (e) { fails++; console.error(`  ✗ ${name}:`, (e as Error).message); }
  }
  const ecom = await getEcommerceMensual(new Date().getUTCFullYear());
  const c = cierreDeMes(ecom.diario, { metaTx: 400, metaIngresos: 600_000_000 });
  const snap = await runWebCalidad();
  const ch = chequeoConsent(Object.fromEntries(Object.entries(snap.consent!.clicks).filter(([m]) => m < new Date().toISOString().slice(0, 7))), snap.consent!.sesiones);
  const html = renderToStaticMarkup(<>{c && <W.CierreMesSection c={c} />}<W.ConsentCheckSection c={ch} criterio={snap.consent!.criterio} todas={snap.consent!.sesionesTodas} /><W.WebQuickWinsSection funnel={null} ai={null} iaMensual={snap.iaMensual} drops={[]} sitioDelta={null} periodo="los últimos 28 días" /><W.WebCalidadPendiente status="no_table" /></>);
  console.log(`  ✓ web: ${html.length} chars`);
  if (/\bBIP\b/.test(html)) { fails++; console.error("  ✗ web menciona BIP"); }
  console.log(fails ? `render-smoke: ${fails} FALLAS` : "render-smoke: OK");
  if (fails) process.exit(1);
})();
