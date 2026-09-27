// Chequeo con DATA REAL (solo lectura): capa SEO/GEO avanzada de Drean (Search Console a fondo,
// visibilidad en IA con IC de Wilson, evolución por keyword, ESoS y salud digital).
// Correr: cd apps/web && npx tsx scripts/seo-avanzado-real.ts
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Mod = require("module") as { _load: (req: string, ...a: unknown[]) => unknown };
const orig = Mod._load;
Mod._load = function (req: string, ...a: unknown[]) {
  if (req === "server-only") return {};
  if (req === "react") { const r = orig.call(this, req, ...a) as Record<string, unknown>; return { ...r, cache: r.cache ?? (<T,>(f: T) => f) }; }
  return orig.call(this, req, ...a);
};

(async () => {
  const { loadSeoAvanzado } = await import("../src/lib/seo-avanzado-server");
  const { fTasaIc } = await import("../src/lib/llmo-stats");
  const a = await loadSeoAvanzado();
  console.log("SC:", a.scSite, "· impresiones último mes cerrado:", a.scImpresionesMes, "· curva propia:", a.curve ? a.curve.fuente.join("/") : "no (referencia AWR)");
  if (a.scDeep) {
    console.log("  canibalización:", a.scDeep.canibalizacion.length, a.scDeep.canibalizacion.slice(0, 3).map((c) => `${c.query} (${c.impresiones} impr, ${c.urls.length} URLs)`));
    console.log("  decae:", a.scDeep.decaimiento.length, "· dispositivos:", a.scDeep.dispositivos.filas.length, "· disponible (datos nuevos):", a.scDeep.disponible);
  }
  console.log("Auditoría:", a.audit.status);
  for (const c of a.llmo) console.log(`IA ${c.label} (${c.mes}):`, c.marcas.slice(0, 5).map((m) => `${m.marca} ${fTasaIc(m.s)} n=${m.s.n}${m.s.suficiente ? "" : " (insuf.)"}`).join(" | "));
  console.log("fuentes IA:", a.fuentes.length, "· tabla muestras:", a.muestrasDisponibles);
  if (a.kwEvol) console.log(`kw: ${a.kwEvol.desde}→${a.kwEvol.hasta} · ${a.kwEvol.semanas} fotos · entraron top10 ${a.kwEvol.entraronTop10} · salieron ${a.kwEvol.salieronTop10} · ganadoras`, a.kwEvol.ganadoras.slice(0, 4).map((k) => `${k.keyword} ${k.posDesde ?? "—"}→${k.posHasta ?? "—"}`), "· perdedoras", a.kwEvol.perdedoras.slice(0, 4).map((k) => `${k.keyword} ${k.posDesde ?? "—"}→${k.posHasta ?? "—"}`));
  for (const e of a.esos) console.log(`ESoS ${e.label}: último`, e.res.ultimo, "· racha", e.res.racha, "· lectura", e.res.lectura, "· meses alineados", e.res.mesesAlineados, "· rezago", e.res.lag);
  if (a.salud) console.log("Salud digital:", a.salud.ultimo?.mes, "índice", a.salud.own?.indice, "rank", a.salud.rank, "de", a.salud.ultimo?.marcas.length, "· componentes", a.salud.ultimo?.componentes, "· top", a.salud.ultimo?.marcas.slice(0, 4).map((m) => `${m.marca} ${m.indice}`));
})();
