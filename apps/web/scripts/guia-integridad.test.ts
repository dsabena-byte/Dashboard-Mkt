// Integridad del Proceso Estratégico (lib/guia + lib/knowledge): ids, títulos espejo, KPIs, tableros.
// Correr: cd apps/web && npx tsx scripts/guia-integridad.test.ts
import { MODULOS, DASH_HREF, dashLinks } from "../src/lib/guia";
import { MODULO_TITULO } from "../src/lib/guia/titulos";
import { DASH_KNOW, KPI_KNOW, kpiKnowFor } from "../src/lib/knowledge";
import { FUNC_KNOW, FUNC_ALIASES } from "../src/lib/knowledge-funciones";

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

// Guías de funcionalidades (lib/knowledge-funciones): campos completos, sin "BIP", alias que resuelven
// a su propia clave (y no pisan alias de KPIs existentes) y títulos reales de las secciones → guía.
for (const [k, v] of Object.entries(FUNC_KNOW)) {
  check(KPI_KNOW[k] === v, `FUNC_KNOW.${k}: no quedó fusionada en KPI_KNOW (clave repetida)`);
  check(Boolean(v.name && v.comoLeer && v.mejorPractica && v.oportunidad && v.marco && v.formula && v.palancas?.length), `FUNC_KNOW.${k}: faltan campos`);
  check(!/\bBIP\b/.test(JSON.stringify(v)), `FUNC_KNOW.${k}: dice "BIP"`);
}
for (const [k, list] of Object.entries(FUNC_ALIASES)) {
  check(Boolean(FUNC_KNOW[k]), `FUNC_ALIASES.${k}: clave sin guía`);
  for (const a of list) check(kpiKnowFor(a)?.key === k, `FUNC_ALIASES "${a}" → ${kpiKnowFor(a)?.key} (esperado ${k})`);
}
for (const [t, k] of [["Ritmo de inversión", "pacing"], ["Fatiga creativa", "fatiga"], ["Inversión diaria por medio", "gasto_diario"], ["Marca vs activación", "marca_activacion"], ["Qué aporta cada medio · MMM-lite", "mmm"], ["Stories de Instagram", "stories_ig"], ["Formatos y horarios propios", "formatos_horarios"], ["Pauta probable de la competencia", "pauta_probable"], ["Core Web Vitals", "cwv"], ["Search Console a fondo", "sc_fondo"], ["Qué hacer ahora", "que_hacer"], ["Armame el tablero", "armame_tablero"], ["Tus umbrales", "umbrales"], ["Calidad del copiloto", "copiloto_calidad"], ["Salud digital de marca", "salud_digital"], ["Cierre proyectado", "prob_meta"]] as const)
  check(kpiKnowFor(t)?.key === k, `kpiKnowFor("${t}") → ${kpiKnowFor(t)?.key} (esperado ${k})`);

// Mercado Libre para marcas (portado de la base original, sep-2026): módulos, fuentes oficiales y enlaces.
// Drean no tiene Góndola Mercado Libre: ningún módulo puede mandar a un tablero o dato que no existe.
const MELI = ["mercado-libre-para-marcas", "meli-como-funciona", "meli-publicaciones", "meli-reputacion", "meli-logistica", "meli-precio-promociones", "meli-mercado-ads", "meli-preguntas-opiniones", "meli-medicion", "meli-errores-checklist"];
const DOMINIOS_OK = /^https:\/\/([a-z0-9-]+\.)*(mercadolibre\.com\.ar|mercadoads\.com|tn\.com\.ar|c5n\.com)\//;
const indiceMeli = MODULOS.find((m) => m.id === "mercado-libre-para-marcas");
for (const id of MELI) {
  const m = MODULOS.find((x) => x.id === id);
  check(Boolean(m), `ML: ${id} no existe`);
  if (!m) continue;
  check(m.plataforma === "mercadolibre", `ML: ${id} sin plataforma mercadolibre`);
  check((m.fuentes ?? []).length > 0, `ML: ${id} sin fuentes`);
  check(/^\d{4}-\d{2}-\d{2}$/.test(m.fuentesConsultadas ?? ""), `ML: ${id} sin fuentesConsultadas`);
  for (const f of m.fuentes ?? []) check(DOMINIOS_OK.test(f.url), `ML: ${id} fuente no oficial ${f.url}`);
  const txt = JSON.stringify(m);
  for (const bad of ["Góndola Mercado Libre", "gondola", "Lo más buscado", "share of shelf", "Share of shelf", "add-on"])
    check(!txt.includes(bad), `ML: ${id} menciona algo que Drean no tiene: "${bad}"`);
  if (id !== "mercado-libre-para-marcas") check((indiceMeli?.relacionados ?? []).includes(id), `ML: el índice no enlaza ${id}`);
}
for (const m of MODULOS) {
  for (const f of m.fuentes ?? []) {
    check(/^https:\/\/\S+$/.test(f.url), `${m.id}: fuente sin https ${f.url}`);
    check(f.titulo.trim().length > 3, `${m.id}: fuente sin título`);
    if (f.fecha) check(/^\d{4}-\d{2}-\d{2}$/.test(f.fecha), `${m.id}: fecha de fuente inválida ${f.fecha}`);
  }
}
check((DASH_KNOW.performance?.modulos ?? []).includes("meli-mercado-ads"), "DASH_KNOW.performance no enlaza Mercado Ads");
check((DASH_KNOW.performance?.modulos ?? []).includes("mercado-libre-para-marcas"), "DASH_KNOW.performance no enlaza el índice de ML");

console.log(`${MODULOS.length} módulos · ${Object.keys(KPI_KNOW).length} KPIs · ${Object.keys(DASH_KNOW).length} tableros`);
if (fails) {
  console.error(`${fails} fallas`);
  process.exit(1);
}
console.log("OK");
