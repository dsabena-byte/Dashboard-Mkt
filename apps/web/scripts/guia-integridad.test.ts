// Integridad del Proceso Estratégico (lib/guia + lib/knowledge): ids, títulos espejo, KPIs, tableros.
// Correr: cd apps/web && npx tsx scripts/guia-integridad.test.ts
import { MODULOS, DASH_HREF, dashLinks } from "../src/lib/guia";
import { MODULO_TITULO } from "../src/lib/guia/titulos";
import { DASH_KNOW, KPI_KNOW, kpiKnowFor } from "../src/lib/knowledge";

let fails = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) {
    fails++;
    console.error("FAIL:", msg);
  }
};

const ids = new Set(MODULOS.map((m) => m.id));
check(ids.size === MODULOS.length, "ids de módulo duplicados");
for (const m of MODULOS) {
  check(MODULO_TITULO[m.id] === m.titulo, `titulos.ts desincronizado: ${m.id}`);
  for (const r of m.relacionados ?? []) check(ids.has(r), `${m.id}: relacionado inexistente ${r}`);
  for (const k of m.kpiKeys) check(Boolean(KPI_KNOW[k]), `${m.id}: kpiKey inexistente ${k}`);
  for (const s of m.dashSlugs) check(dashLinks([s]).length > 0, `${m.id}: dashSlug sin ruta ${s}`);
  const txt = JSON.stringify(m);
  for (const bad of ["Optimize", "Accelerate", "**Fuentes de datos**", "entrá a Fuentes de datos", "pestaña **Insights**", "/tablero/", "/cuenta/", "Nango", "SharePoint", "BIP"])
    check(!txt.includes(bad), `${m.id}: término de otra plataforma "${bad}"`);
}
for (const id of Object.keys(MODULO_TITULO)) check(ids.has(id), `titulos.ts tiene id huérfano ${id}`);
for (const [slug, d] of Object.entries(DASH_KNOW)) {
  for (const id of d.modulos ?? []) check(ids.has(id), `DASH_KNOW.${slug}: módulo inexistente ${id}`);
  check(Boolean(DASH_HREF[slug]), `DASH_KNOW.${slug}: no es una ruta de Drean`);
}
for (const [k, v] of Object.entries(KPI_KNOW))
  for (const p of v.palancas ?? []) if (p.modulo) check(ids.has(p.modulo), `KPI_KNOW.${k}: palanca a módulo inexistente ${p.modulo}`);
const validRoutes = new Set(["/mapa-estrategico", "/overview", "/performance", "/performance-conversion", "/redes", "/influencia", "/mkt-canal", "/web", "/seo-search", "/cuadros-basicos", "/floor-share", "/salud-marca", "/mercado", "/funnel", "/contenido", "/monitoreo"]);
for (const [s, d] of Object.entries(DASH_HREF)) check(validRoutes.has(d.href), `DASH_HREF.${s}: ruta inexistente ${d.href}`);

// Títulos reales de las cards de Drean → guía
for (const [t, k] of [["Alcance único", "alcance"], ["VTR (≥50%)", "vtr"], ["Inversión", "inversion"], ["Frecuencia", "frecuencia"], ["Clicks", "clicks"], ["Impresiones", "impresiones"], ["Floor Share Lavado", "floor_share"], ["Value share", "share_valor"], ["ROAS", "roas"], ["Cumplimiento CB", "cb"]] as const)
  check(kpiKnowFor(t)?.key === k, `kpiKnowFor("${t}") → ${kpiKnowFor(t)?.key} (esperado ${k})`);

console.log(`${MODULOS.length} módulos · ${Object.keys(KPI_KNOW).length} KPIs · ${Object.keys(DASH_KNOW).length} tableros`);
if (fails) {
  console.error(`${fails} fallas`);
  process.exit(1);
}
console.log("OK");
