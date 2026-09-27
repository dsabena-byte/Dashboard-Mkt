// Eval del copiloto SIN OpenAI (portado de BIP, sep-2026, con las tools de Drean):
//   1. definiciones: toda tool tiene nombre/descr./schema válido y (si se puede) convertible a `strict: true`;
//   2. ruteo: cada pregunta del set dorado (src/lib/chat/eval-set.ts) encuentra su tool esperada en el
//      top-3 de un buscador léxico (BM25) sobre las DEFINICIONES de las tools → si una descripción pierde
//      vocabulario, el test falla antes de que el modelo empiece a elegir mal;
//   3. argumentos: los args de ejemplo pasan la validación estricta y los inválidos se rechazan;
//   4. schema: validateArgs / toOpenAiStrict; 5. respuestas verificadas y feedback (puros).
// Correr: cd apps/web && npx tsx scripts/copiloto-eval.test.ts
/* eslint-disable @typescript-eslint/no-require-imports */
import { validateArgs, toOpenAiStrict, esStrictValido, type JsonSchema } from "../src/lib/chat/schema";
import { EVAL_SET } from "../src/lib/chat/eval-set";
import { tokens, similitud, elegirVerificadas, bloqueVerificadas, parseFeedback, resumenFeedback, peoresRespuestas, type Verificada, type FeedbackRow } from "../src/lib/chat/verified";

// `lib/chat/registry.ts` es server-only (el paquete "server-only" lo resuelve Next) y algunas queries usan
// React `cache()` (solo existe dentro de Next): para leer las DEFINICIONES reales de las tools se stubean.
// Ninguna tool se ejecuta.
const Mod = require("node:module");
const orig = Mod._resolveFilename;
Mod._resolveFilename = function (req: string, ...rest: unknown[]) {
  if (req === "server-only") return require.resolve("./empty-module.cjs");
  return orig.call(this, req, ...rest);
};
const React = require("react");
if (!React.cache) React.cache = (f: unknown) => f;

let fail = 0, okN = 0;
const ok = (c: unknown, m: string) => { if (c) okN++; else { fail++; console.error(`FAIL ${m}`); } };

(async () => {
  const { buildChatTools } = await import("../src/lib/chat/registry");
  const { RENDER_TOOLS } = await import("../src/lib/chat/copiloto");
  const { tools } = buildChatTools("overview", null, { posts: new Map() });
  const byName = new Map(tools.map((t) => [t.name, t]));

  // ── 1. Definiciones ──
  const nombres = [...tools.map((t) => t.name), ...RENDER_TOOLS.map((t) => t.function.name)];
  ok(new Set(nombres).size === nombres.length, "nombres de tools únicos");
  let strictN = 0;
  for (const t of tools) {
    ok(/^[a-z][a-z_]{2,40}$/.test(t.name), `${t.name}: nombre válido`);
    ok(t.description.length >= 60, `${t.name}: descripción con contexto (≥60 caracteres)`);
    const s = t.parameters as JsonSchema;
    ok(s.type === "object", `${t.name}: schema raíz objeto`);
    for (const r of s.required ?? []) ok(r in (s.properties ?? {}), `${t.name}: required '${r}' existe`);
    const st = toOpenAiStrict(s);
    if (st) { strictN++; const errs = esStrictValido(st); ok(errs.length === 0, `${t.name}: strict válido ${errs.join("; ")}`); }
    // Sin argumentos: solo falla si hay requeridos.
    const vacio = validateArgs(s, {});
    ok(vacio.ok === !(s.required ?? []).length, `${t.name}: {} ${vacio.ok ? "pasa" : "falla"} según required`);
  }
  // Con CHAT_STRICT_TOOLS=1 las no convertibles van sin strict (se validan igual en el server).
  ok(strictN >= Math.ceil(tools.length * 0.8), `al menos 80% de las tools convertibles a strict (${strictN}/${tools.length})`);

  // ── 2. Ruteo léxico (BM25 sobre definiciones) ──
  const docOf = (t: (typeof tools)[number]): string[] => {
    const s = t.parameters as JsonSchema;
    const extra: string[] = [];
    for (const p of Object.values(s.properties ?? {})) { if (p.description) extra.push(String(p.description)); if (p.enum) extra.push(p.enum.map(String).join(" ")); }
    const nombre = t.name.replace(/_/g, " ");
    return [...tokens(`${nombre} ${nombre} ${nombre} ${t.description} ${extra.join(" ")}`)];
  };
  const docs = tools.map((t) => ({ name: t.name, toks: docOf(t) }));
  const N = docs.length;
  const avgLen = docs.reduce((a, d) => a + d.toks.length, 0) / N;
  const df = new Map<string, number>();
  for (const d of docs) for (const w of new Set(d.toks)) df.set(w, (df.get(w) ?? 0) + 1);
  const bm25 = (q: string) => {
    const qt = [...tokens(q)];
    return docs.map((d) => {
      const tf = new Map<string, number>();
      for (const w of d.toks) tf.set(w, (tf.get(w) ?? 0) + 1);
      let sc = 0;
      for (const w of qt) {
        const f = tf.get(w) ?? 0; if (!f) continue;
        const idf = Math.log(1 + (N - (df.get(w) ?? 0) + 0.5) / ((df.get(w) ?? 0) + 0.5));
        sc += idf * (f * 2.2) / (f + 1.2 * (0.5 + 0.5 * d.toks.length / avgLen));
      }
      return { name: d.name, sc };
    }).sort((a, b) => b.sc - a.sc);
  };
  let top1 = 0, top3 = 0;
  for (const c of EVAL_SET) {
    for (const t of c.tools) ok(byName.has(t), `${c.id}: la tool esperada ${t} existe`);
    const rank = bm25(c.q);
    const pos = rank.findIndex((r) => c.tools.includes(r.name));
    if (pos === 0) top1++;
    if (pos >= 0 && pos < 3) top3++;
    ok(pos >= 0 && pos < 3, `${c.id} "${c.q}" → esperada ${c.tools.join("|")}, top-3 fue ${rank.slice(0, 3).map((r) => r.name).join(", ")}`);
    // ── 3. Argumentos de ejemplo ──
    if (c.args) {
      const t = byName.get(c.tools[0]!);
      if (t) { const v = validateArgs(t.parameters as JsonSchema, c.args); ok(v.ok, `${c.id}: args de ejemplo válidos para ${t.name} (${v.errores.join("; ")})`); }
    }
  }
  ok(EVAL_SET.length >= 40, `set dorado con ≥40 preguntas (${EVAL_SET.length})`);
  ok(new Set(EVAL_SET.map((c) => c.id)).size === EVAL_SET.length, "ids del set únicos");
  const cubiertas = new Set(EVAL_SET.flatMap((c) => c.tools));
  for (const t of tools) ok(cubiertas.has(t.name), `el set cubre la tool ${t.name}`);
  console.log(`ruteo léxico: top-1 ${top1}/${EVAL_SET.length} · top-3 ${top3}/${EVAL_SET.length}`);

  // Argumentos inválidos → error explicable (la tool no corre).
  const pauta = byName.get("get_pauta_performance")!.parameters as JsonSchema;
  const bad = validateArgs(pauta, { nivel: "semanal" });
  ok(!bad.ok && (bad.errores[0] ?? "").includes("nivel"), "enum inválido se rechaza con detalle");
  const fix = validateArgs(pauta, { nivel: "Medio", extra: 1 });
  ok(fix.ok && fix.args.nivel === "medio" && !("extra" in fix.args), "coerciones: mayúsculas en enum, propiedad extra descartada");
  const web = byName.get("get_web_detalle")!.parameters as JsonSchema;
  ok(!validateArgs(web, {}).ok, "falta requerido → error");
  ok(!validateArgs(web, { nivel: null }).ok, "requerido en null → error");
  ok(validateArgs(pauta, { nivel: null, desde: null }).ok, "opcionales en null (modo strict) = sin valor");
  const calcS = byName.get("calc")!.parameters as JsonSchema;
  ok(!validateArgs(calcS, { operacion: "inventada" }).ok, "calc: operación desconocida → error");
  ok(!validateArgs(pauta, "hola").ok, "args no-objeto → error");

  // ── 4. Schema (unitario) ──
  const s: JsonSchema = { type: "object", properties: { n: { type: "integer", minimum: 1, maximum: 5 }, b: { type: "boolean" }, xs: { type: "array", items: { type: "number" }, maxItems: 2 } }, required: ["n"], additionalProperties: false };
  const r1 = validateArgs(s, { n: 2.6, b: "true", xs: [1, "2", 3] });
  ok(r1.ok && r1.args.n === 3 && r1.args.b === true && JSON.stringify(r1.args.xs) === "[1,2]", "integer redondea, bool de texto, maxItems recorta y convierte");
  const st = toOpenAiStrict(s)!;
  ok(JSON.stringify(st.required) === JSON.stringify(["n", "b", "xs"]), "strict: todo required");
  ok(Array.isArray(st.properties!.b!.type) && (st.properties!.b!.type as string[]).includes("null"), "strict: opcional → nullable");
  ok(!Array.isArray(st.properties!.n!.type), "strict: requerido no nullable");
  ok(toOpenAiStrict({ type: "object", properties: { data: { type: "array", items: { type: "object" } } } }) == null, "strict: objeto libre no convertible");
  const e2 = { type: "object", properties: { m: { type: "string", enum: ["a", "b"] } } } as JsonSchema;
  ok((toOpenAiStrict(e2)!.properties!.m!.enum as unknown[]).includes(null), "strict: enum opcional incluye null");

  // ── 5. Verificadas + feedback ──
  ok(tokens("Campañas de Meta").has("campa") && tokens("¿Qué campaña?").has("campa"), "tokens con raíz (plural y acentos)");
  ok(similitud("¿Qué campaña escalo este mes?", "¿Qué campañas debería escalar?") > 0.4, "similitud alta entre paráfrasis");
  ok(similitud("¿Cómo viene mi web?", "¿Qué formato de reels rinde?") === 0, "similitud 0 sin tokens en común");
  const ver: Verificada[] = [
    { id: 1, pregunta: "¿Qué medios debería escalar y cuáles cortar?", respuesta: "Mirá CPM vs mediana…", tools: ["get_pauta_performance"], pathname: "/performance" },
    { id: 2, pregunta: "¿Cuál es mi mejor formato en Instagram?", respuesta: "Reels…", tools: ["get_ig_organic"] },
    { id: 3, pregunta: "¿Qué medio escalo?", respuesta: "…", tools: ["get_pauta_performance"] },
  ];
  const el = elegirVerificadas("¿Qué medio escalo y cuál corto este mes?", ver, { pathname: "/performance" });
  ok(el.length >= 1 && el[0]!.tools.includes("get_pauta_performance"), "elige verificadas de pauta para una pregunta de pauta");
  ok(!elegirVerificadas("¿Cómo viene el tráfico web?", ver).length, "sin ejemplo parecido → ninguno");
  ok(bloqueVerificadas([]) === "", "sin ejemplos → bloque vacío");
  ok(bloqueVerificadas(el).includes("no copies cifras"), "el bloque exige re-consultar los números");
  ok(!parseFeedback({ rating: 0, pregunta: "a", respuesta: "b" }).ok, "feedback: rating inválido");
  ok(!parseFeedback({ rating: 1, pregunta: "", respuesta: "b" }).ok, "feedback: sin pregunta");
  const pf = parseFeedback({ rating: -1, motivo: "dato_incorrecto", comentario: " no es así ", pregunta: "p", respuesta: "r", tools: ["calc", "calc", "DROP TABLE"], pathname: "/web" });
  ok(pf.ok && pf.v.comentario === "no es así" && pf.v.tools.length === 1 && pf.v.motivo === "dato_incorrecto", "feedback: limpia comentario y tools");
  const pf2 = parseFeedback({ rating: 1, motivo: "otro", pregunta: "p", respuesta: "r", pathname: "http://x" });
  ok(pf2.ok && pf2.v.motivo === null && pf2.v.pathname === null, "feedback 👍 sin motivo y pathname solo interno");
  const rows: FeedbackRow[] = [
    { id: 1, rating: 1, motivo: null, comentario: null, pregunta: "p", respuesta: "r", tools: ["calc"], pathname: null, created_at: "2026-09-01" },
    { id: 2, rating: -1, motivo: "lenta", comentario: null, pregunta: "p", respuesta: "r", tools: ["calc"], pathname: null, created_at: "2026-09-03" },
    { id: 3, rating: -1, motivo: "dato_incorrecto", comentario: "mal", pregunta: "p", respuesta: "r", tools: ["calc"], pathname: null, created_at: "2026-09-02" },
    { id: 4, rating: -1, motivo: "dato_incorrecto", comentario: null, pregunta: "p", respuesta: "r", tools: [], pathname: null, created_at: "2026-09-04", revisado: true },
  ];
  const rs = resumenFeedback(rows);
  ok(rs.total === 4 && rs.negativos === 3 && rs.pctPositivo === 25, "resumen: totales");
  ok(rs.porMotivo[0]?.motivo === "dato_incorrecto" && rs.porMotivo[0].n === 2, "resumen: motivo más frecuente");
  ok(rs.porTool[0]?.tool === "calc" && rs.porTool[0].pctNegativo === 66.7, "resumen: % 👎 por tool");
  const pe = peoresRespuestas(rows);
  ok(pe.map((r) => r.id).join(",") === "3,2,4", "peores: sin revisar + dato incorrecto + comentario primero, revisadas al final");

  console.log(`copiloto-eval: ${okN} OK, ${fail} FAIL`);
  if (fail) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
