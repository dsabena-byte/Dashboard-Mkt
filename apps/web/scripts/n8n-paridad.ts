// Paridad scraper en código vs n8n: compara las filas de un dry-run de /api/cron/competencia-social contra
// lo que n8n escribió en la base (social_posts por url / competitor_web por competidor). SOLO LECTURA.
//
// Uso (desde apps/web, con NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en el entorno):
//   curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP/api/cron/competencia-social?part=fb&dry=1&analizar=todos" > fb.json
//   curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP/api/cron/competencia-social?part=ig&dry=1" > ig.json
//   curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP/api/cron/competencia-social?part=web&dry=1" > web.json
//   npx tsx scripts/n8n-paridad.ts fb.json ig.json web.json [--json] [--detalle]
//
// Por campo: igual · ganancia (n8n vacío, código con dato) · PÉRDIDA (código vacío, n8n con dato) · distinto.
// Los contadores (likes/comentarios/views) se leen en momentos distintos → se informa la diferencia, no es error.
// Además: posts por marca y red, faltantes (n8n tiene, el código no, dentro de la misma ventana de fechas) y extras.
import { readFileSync } from "node:fs";
import { postKey } from "../src/lib/post-snapshots-core";

type Row = Record<string, unknown>;
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB || !KEY) { console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(2); }
async function get(path: string): Promise<Row[]> {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: { apikey: KEY!, Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()) as Row[];
}
async function getAll(path: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let off = 0; ; off += 1000) { const d = await get(`${path}&order=id&limit=1000&offset=${off}`); out.push(...d); if (d.length < 1000) break; }
  return out;
}

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith("--"));
const asJson = args.includes("--json"), detalle = args.includes("--detalle");
if (!files.length) { console.error("Uso: npx tsx scripts/n8n-paridad.ts <dry.json>... [--json] [--detalle]"); process.exit(2); }

const social: Row[] = [], web: Row[] = [];
for (const f of files) {
  const j = JSON.parse(readFileSync(f, "utf8")) as { results?: Record<string, { rows?: Row[] }> };
  for (const [part, r] of Object.entries(j.results ?? {})) {
    if (!r?.rows) continue;
    if (part === "web") web.push(...r.rows); else if (part === "fb" || part === "ig") social.push(...r.rows);
  }
}

const vacio = (v: unknown) => v === null || v === undefined || v === "" || v === 0;
const FIELDS = ["red_social", "marca", "fecha", "pilar", "positivo", "negativo", "neutro", "likes", "comentarios", "views", "engagement", "tipo", "content_type", "followers", "thumbnail_url", "copy"] as const;
const COUNTERS = new Set(["likes", "comentarios", "views", "followers"]);
type Cmp = { igual: number; ganancia: number; perdida: number; distinto: number; deltas: number[]; ejemplos: string[] };
const newCmp = (): Cmp => ({ igual: 0, ganancia: 0, perdida: 0, distinto: 0, deltas: [], ejemplos: [] });

async function paridadSocial() {
  if (!social.length) return null;
  const minF = social.map((r) => String(r.fecha)).sort()[0]!;
  const reds = [...new Set(social.map((r) => String(r.red_social)))];
  const db = await getAll(`social_posts?select=url,red_social,marca,fecha,pilar,positivo,negativo,neutro,likes,comentarios,views,engagement,tipo,content_type,followers,thumbnail_url,copy,created_at&red_social=in.(${reds.join(",")})&fecha=gte.${minF}`);
  const dbBy = new Map(db.map((r) => [postKey(String(r.url)), r]));
  const codeBy = new Map(social.map((r) => [postKey(String(r.url)), r]));
  const campos: Record<string, Cmp> = Object.fromEntries(FIELDS.map((k) => [k, newCmp()]));
  let comparados = 0;
  const extras: string[] = [];
  for (const [k, c] of codeBy) {
    const n = dbBy.get(k);
    if (!n) { extras.push(`${c.red_social} ${c.marca} ${c.fecha} ${c.url}`); continue; }
    comparados++;
    for (const fld of FIELDS) {
      const a = n[fld], b = c[fld], cm = campos[fld]!;
      // thumbnail: la de n8n se re-hostea a Storage → se compara presencia, no la URL.
      const same = fld === "thumbnail_url" ? vacio(a) === vacio(b) : (a ?? null) === (b ?? null) || (typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 1e-9);
      if (same) cm.igual++;
      else if (vacio(a) && !vacio(b)) cm.ganancia++;
      else if (!vacio(a) && vacio(b)) { cm.perdida++; if (cm.ejemplos.length < 5) cm.ejemplos.push(`${n.url} n8n=${JSON.stringify(a)} código=${JSON.stringify(b)}`); }
      else {
        cm.distinto++;
        if (COUNTERS.has(fld) && typeof a === "number" && typeof b === "number") cm.deltas.push(b - a);
        if (cm.ejemplos.length < 5) cm.ejemplos.push(`${n.url} n8n=${JSON.stringify(a)} código=${JSON.stringify(b)}`);
      }
    }
  }
  // Faltantes: posts de n8n dentro de la ventana de fechas que el código cubrió para esa marca+red.
  const ventana = new Map<string, { min: string; max: string }>();
  for (const r of social) {
    const k = `${r.red_social}|${r.marca}`, fe = String(r.fecha), w = ventana.get(k);
    ventana.set(k, w ? { min: fe < w.min ? fe : w.min, max: fe > w.max ? fe : w.max } : { min: fe, max: fe });
  }
  const faltantes = db.filter((r) => { const w = ventana.get(`${r.red_social}|${r.marca}`); return w && String(r.fecha) >= w.min && String(r.fecha) <= w.max && !codeBy.has(postKey(String(r.url))); })
    .map((r) => `${r.red_social} ${r.marca} ${r.fecha} ${r.url}`);
  const porMarca: Record<string, { codigo: number; n8n: number }> = {};
  for (const r of social) { const k = `${r.red_social} ${r.marca}`; (porMarca[k] ??= { codigo: 0, n8n: 0 }).codigo++; }
  for (const r of db) { const w = ventana.get(`${r.red_social}|${r.marca}`); if (!w || String(r.fecha) < w.min || String(r.fecha) > w.max) continue; const k = `${r.red_social} ${r.marca}`; (porMarca[k] ??= { codigo: 0, n8n: 0 }).n8n++; }
  const resumen = Object.fromEntries(Object.entries(campos).map(([k, c]) => {
    const d = c.deltas.sort((x, y) => x - y);
    return [k, { igual: c.igual, ganancia: c.ganancia, PERDIDA: c.perdida, distinto: c.distinto, ...(d.length ? { deltaMediana: d[Math.floor(d.length / 2)] } : {}), ...(detalle ? { ejemplos: c.ejemplos } : {}) }];
  }));
  return { filasCodigo: social.length, comparados, porMarcaEnVentana: porMarca, faltantes: faltantes.length, extras: extras.length, campos: resumen, ...(detalle ? { listaFaltantes: faltantes.slice(0, 50), listaExtras: extras.slice(0, 50) } : {}) };
}

async function paridadWeb() {
  if (!web.length) return null;
  const db = await get("competitor_web?select=fecha,competidor,dominio,visitas_estimadas,visitantes_unicos,bounce_rate,pages_per_visit,avg_visit_duration,fuentes_trafico,paginas_top,paises_top,keywords_top&order=fecha.desc&limit=100");
  const out: Record<string, unknown> = {};
  const WF = ["dominio", "visitas_estimadas", "visitantes_unicos", "bounce_rate", "pages_per_visit", "avg_visit_duration", "fuentes_trafico", "paginas_top", "paises_top", "keywords_top"];
  for (const c of web) {
    const n = db.find((r) => r.competidor === c.competidor);
    if (!n) { out[String(c.competidor)] = "EXTRA (n8n no lo tenía)"; continue; }
    const dif: Record<string, string> = {};
    for (const k of WF) {
      const a = JSON.stringify(n[k] ?? null), b = JSON.stringify(c[k] ?? null);
      if (a === b) continue;
      dif[k] = vacio(n[k]) ? "ganancia" : vacio(c[k]) ? "PERDIDA" : `distinto (n8n ${n.fecha}: ${a.slice(0, 60)} · código: ${b.slice(0, 60)})`;
    }
    out[String(c.competidor)] = Object.keys(dif).length ? dif : "igual";
  }
  const ult = String(db[0]?.fecha ?? "");
  const faltan = db.filter((r) => r.fecha === ult && !web.some((c) => c.competidor === r.competidor)).map((r) => r.competidor);
  return { ultimaFechaN8n: ult, porCompetidor: out, faltantes: faltan };
}

async function main() {
  const res = { social: await paridadSocial(), web: await paridadWeb() };
  if (asJson) console.log(JSON.stringify(res, null, 2));
  else {
    if (res.social) {
      const s = res.social;
      console.log(`\n== social_posts: ${s.filasCodigo} filas del código, ${s.comparados} ya estaban (n8n), ${s.extras} extras, ${s.faltantes} faltantes en la ventana`);
      for (const [k, v] of Object.entries(s.porMarcaEnVentana)) console.log(`   ${k.padEnd(28)} código ${v.codigo}  n8n ${v.n8n}`);
      console.log("   campo          igual  ganancia  PÉRDIDA  distinto");
      for (const [k, v] of Object.entries(s.campos)) console.log(`   ${k.padEnd(14)} ${String(v.igual).padStart(5)}  ${String(v.ganancia).padStart(8)}  ${String(v.PERDIDA).padStart(7)}  ${String(v.distinto).padStart(8)}${"deltaMediana" in v ? `  (Δ mediana ${v.deltaMediana})` : ""}`);
      if (detalle) console.log(JSON.stringify({ ejemplos: Object.fromEntries(Object.entries(s.campos).map(([k, v]) => [k, (v as { ejemplos?: string[] }).ejemplos])), faltantes: s.listaFaltantes, extras: s.listaExtras }, null, 2));
    }
    if (res.web) { console.log(`\n== competitor_web (vs última foto de n8n ${res.web.ultimaFechaN8n})`); console.log(JSON.stringify(res.web.porCompetidor, null, 2)); if (res.web.faltantes.length) console.log("   FALTAN:", res.web.faltantes.join(", ")); }
    const perd = res.social ? Object.values(res.social.campos).reduce((a, v) => a + v.PERDIDA, 0) : 0;
    console.log(`\nVeredicto: ${perd === 0 && !(res.social?.faltantes) ? "sin pérdidas" : `revisar (${perd} pérdidas de campo, ${res.social?.faltantes ?? 0} posts faltantes)`}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
