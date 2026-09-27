// Chequeo con DATA REAL (solo lectura, no persiste): arma el snapshot de calidad web como el cron
// (sin GA4 en el sandbox → queda en errores) y muestra tráfico desde IA + chequeo de consent.
// Correr: cd apps/web && npx tsx scripts/web-calidad-real.ts
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Mod = require("module") as { _load: (req: string, ...a: unknown[]) => unknown };
const orig = Mod._load;
Mod._load = function (req: string, ...a: unknown[]) { return req === "server-only" ? {} : orig.call(this, req, ...a); };

(async () => {
  const { runWebCalidad } = await import("../src/lib/web-calidad-server");
  const { chequeoConsent } = await import("../src/lib/web-consent");
  const t0 = Date.now();
  const s = await runWebCalidad();
  console.log(`snapshot en ${((Date.now() - t0) / 1000).toFixed(1)}s · errores:`, s.errores);
  console.log("IA por mes:");
  for (const m of s.iaMensual) console.log(`  ${m.mes}: ${m.sesiones} ses (${m.sesionesSitio ? ((m.sesiones / m.sesionesSitio) * 100).toFixed(2) : "?"}% del sitio) · tx ${m.transacciones} · $${Math.round(m.ingresos).toLocaleString("es-AR")} ·`, JSON.stringify(m.porAsistente));
  if (s.consent) {
    const mesActual = new Date().toISOString().slice(0, 7);
    const cerr = Object.fromEntries(Object.entries(s.consent.clicks).filter(([m]) => m < mesActual));
    const c = chequeoConsent(cerr, s.consent.sesiones);
    console.log("consent:", c.estado, "·", c.titulo, "·", c.detalle);
    for (const m of c.meses) console.log(`  ${m.mes}: clicks ${m.clicks} · sesiones ${m.sesiones} · ratio ${m.ratio?.toFixed(2)} (todas google/cpc: ${s.consent.sesionesTodas[m.mes] ?? 0})`);
  }
})();
