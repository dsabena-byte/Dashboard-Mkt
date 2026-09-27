import "server-only";
import { NextResponse } from "next/server";
import { getDataset, listDatasets } from "@/lib/tableros-server";
import { isNativeId } from "@/lib/native-datasets-core";
import {
  aiSchema, annotateSchema, explainResolution, fallbackPlan, prepare, rankDatasets, resolvePrompt, validateNlOutput,
  type AiDataset, type NlOutput,
} from "@/lib/viz";

// ============================================================================
// "Armame el tablero" en lenguaje natural (mode "nl" de /api/tableros/ai). Portado de BIP (sep-2026).
//  1. Esquemas de TODAS las fuentes: planillas subidas (las 8 más recientes) + fuentes nativas del
//     dashboard que el usuario puede ver (Plan de Medios, Web, Redes IG, Seguimiento; lib/native-datasets).
//     Nunca se manda la data entera al modelo: esquema + 8 filas de muestra por dataset.
//  2. Capa semántica (lib/viz/semantic): términos del pedido → columnas/métricas del catálogo único
//     (lib/metricas); se eligen los 4 datasets más relevantes y se le pasan al modelo las "pistas" y las
//     métricas derivadas con su fórmula oficial (CPM, CTR, CPC, frecuencia, ER…).
//  3. Validación ESTRICTA del JSON (validateNlOutput). Con errores → 1 reintento de reparación. Si sigue
//     mal: se usa la parte válida; si no hay → fallback determinístico (fallbackPlan). Si tampoco → 422.
// ============================================================================
const MAX_PLANILLAS = 8;
const MAX_DATASETS_AI = 4;
const MAX_TOKENS = 3500;

const NL_RULES = `Formato de respuesta (SOLO JSON):
{"reply": "1 oración en español rioplatense: qué armaste", "widgets": [Widget...], "calcs": [Calc...], "blends": [Blend...]}
Si el pedido NO se puede responder con estos datos: {"widgets": [], "motivo": "qué dato falta, en 1 oración"}.
Blend (cruce de dos fuentes por mes) = {"id":"b0","datasetId": dataset del gráfico (el que tiene UNA fila por mes, ej. "nat:pauta"),"remoteDatasetId": otro dataset,"localKey": fieldId de fecha del local,"remoteKey": fieldId de fecha del remoto,"fields":[fieldIds numéricos del remoto],"grain":"month"} → en el local aparecen como "bl_<id>_<fieldId>". Usalo SOLO para mostrar en UN gráfico métricas de dos fuentes distintas por mes (ej. inversión de Plan de Medios vs usuarios de la web: combo, barra = inversión, línea eje derecho = usuarios).
Capa semántica (OBLIGATORIA):
- Cada campo trae "metrica" (id del catálogo único de métricas), "definicion" y "agg" (el agregado correcto: usalo).
- Cada dataset trae "derivadas": métricas calculadas con la fórmula OFICIAL. Si piden CPA, CPM, CTR, CPC, ROAS, Frecuencia, Engagement rate, Ticket promedio o Inversión/Facturación, agregá ESA expr como Calc (mismo name y datasetId) y usala como "calc:<name>". Nunca inventes otra fórmula ni promedies un ratio fila por fila.
- "pistas" = cómo se entendió cada término del pedido (qué columna y de qué dataset). Respetalas.
- Datasets "nat:*" = fuentes nativas del dashboard de Drean (solo lectura). El resto son planillas subidas.
- TODO gráfico lleva "datasetId". Cada fieldId pertenece SOLO a su dataset.
- Armá lo pedido (2 a 8 gráficos): una fila de KPIs de lo pedido (w 1) y después los gráficos. "por mes" = x fecha + grain "month". "por <dimensión>" = barra horizontal ordenada desc con topN 15.`;

async function openaiJson(messages: { role: string; content: string }[], model: string): Promise<{ json: unknown; text: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw Object.assign(new Error("sin OPENAI_API_KEY"), { status: 503 });
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, temperature: 0.1, max_tokens: MAX_TOKENS, response_format: { type: "json_object" }, messages }),
  });
  if (!res.ok) throw Object.assign(new Error(`OpenAI ${res.status}`), { status: 502 });
  const d = await res.json();
  const text = String(d?.choices?.[0]?.message?.content ?? "");
  try { return { json: JSON.parse(text), text }; } catch { return { json: null, text }; }
}

export async function runNl(body: Record<string, unknown>, cfg: { widgetDef: string; model: string; allowed: string[] | null }): Promise<NextResponse> {
  const prompt = String(body.prompt ?? "").trim().slice(0, 1500);
  if (!prompt) return NextResponse.json({ error: "Contame qué querés ver. Ej.: “inversión por medio y por mes”." }, { status: 400 });
  const primary = typeof body.primary === "string" ? body.primary : null;

  // 1 · Fuentes disponibles (planillas recientes + nativas permitidas) → esquemas.
  const list = await listDatasets(false, { allowed: cfg.allowed }).catch(() => []);
  const own = list.filter((d) => !isNativeId(d.id)).slice(0, MAX_PLANILLAS);
  if (primary && !own.some((d) => d.id === primary)) { const p = list.find((d) => d.id === primary && !isNativeId(d.id)); if (p) own.unshift(p); }
  const ids = [...own.map((d) => d.id), ...list.filter((d) => isNativeId(d.id)).map((d) => d.id)];
  const loaded = await Promise.all(ids.map((id) => getDataset(id, cfg.allowed).catch(() => null)));
  const schemas: AiDataset[] = [];
  for (const ds of loaded) {
    if (!ds || !ds.rows.length || !ds.columns.length) continue;
    schemas.push(aiSchema(prepare({ ...ds, rows: ds.rows.slice(0, 20_000) }), ds.id));
  }
  if (!schemas.length) return NextResponse.json({ error: "Todavía no hay datos para armar el tablero: subí una planilla o pedí acceso a Plan de Medios, Web, Redes o Seguimiento." }, { status: 422 });
  const names = Object.fromEntries(schemas.map((s) => [s.id, s.name]));

  // 2 · Capa semántica.
  const res = resolvePrompt(prompt, schemas);
  const order = rankDatasets(res, schemas, primary);
  const chosen = order.slice(0, MAX_DATASETS_AI).map((id) => schemas.find((s) => s.id === id)).filter((x): x is AiDataset => !!x);
  const entendi = explainResolution(res, names);
  const primaryAi = chosen.find((c) => c.id === primary)?.id ?? chosen[0]!.id;

  const pistas = {
    metricas: res.metrics.map((m) => ({ termino: m.term, metrica: m.metrica, nombre: m.nombre, opciones: m.cands.filter((c) => chosen.some((d) => d.id === c.datasetId)).slice(0, 4).map((c) => ({ datasetId: c.datasetId, fieldId: c.fieldId, calc: c.calc, agg: c.agg })) })),
    aperturas: res.dims.map((d) => ({ termino: d.term, grain: d.grain, opciones: d.cands.filter((c) => chosen.some((x) => x.id === c.datasetId)).slice(0, 4) })),
    compara: res.compare,
    grano: res.grain,
    sinResolver: res.sinResolver,
  };
  const user = JSON.stringify({ pedido: prompt, pistas, datasetPrincipal: primaryAi, datasets: chosen.map((d) => ({ ...annotateSchema(d), sample: d.sample.slice(0, 8) })) }).slice(0, 60_000);
  const messages = [
    { role: "system", content: `Sos el analista de BI del equipo de marketing de Drean (electrodomésticos, Argentina). El usuario describe en lenguaje natural el tablero que quiere y vos lo armás sobre SUS datos, con criterio profesional (estilo Tableau, pero simple). ${cfg.widgetDef}\n${NL_RULES}` },
    { role: "user", content: user },
  ];

  // 3 · Modelo → validación estricta → 1 reparación → parcial → fallback.
  let via: "ia" | "reparado" | "parcial" | "automatico" = "ia";
  let out: NlOutput | null = null;
  let motivo: string | undefined;
  let aiError: string | null = null;
  try {
    const first = await openaiJson(messages, cfg.model);
    let v = validateNlOutput(first.json, chosen, primaryAi);
    motivo = v.value.motivo;
    if (!v.ok && !(v.value.motivo && !v.value.widgets.length)) {
      const repair = await openaiJson([
        ...messages,
        { role: "assistant", content: first.text.slice(0, 12_000) || "{}" },
        { role: "user", content: `Tu respuesta no pasa la validación del esquema. Errores:\n- ${v.errors.slice(0, 20).join("\n- ")}\nCorregí SOLO eso (usá fieldIds que existan en el dataset de cada gráfico) y devolvé el JSON COMPLETO de nuevo.` },
      ], cfg.model);
      const v2 = validateNlOutput(repair.json, chosen, primaryAi);
      if (v2.ok || v2.value.widgets.length >= v.value.widgets.length) { v = v2; via = "reparado"; }
      motivo = v2.value.motivo ?? motivo;
    }
    if (v.ok) out = v.value;
    else if (v.value.widgets.length) { out = v.value; via = "parcial"; }
  } catch (e) {
    aiError = e instanceof Error ? e.message : "error";
  }
  if (!out) {
    const fb = fallbackPlan(res, schemas);
    if (fb) { out = fb; via = "automatico"; }
  }
  console.log(JSON.stringify({ evt: "tableros_nl", via: out ? via : "sin_resultado", widgets: out?.widgets.length ?? 0, metricas: res.metrics.length, aiError: aiError ? aiError.slice(0, 60) : undefined }));

  if (!out) {
    const faltan = [...res.metrics.filter((m) => !m.cands.length).map((m) => m.term), ...res.sinResolver];
    const msg = motivo ?? (faltan.length ? `No encontré ${faltan.map((f) => `“${f}”`).join(", ")} en tus fuentes.` : "No reconocí qué métrica querés ver.");
    return NextResponse.json({
      error: `${msg} Probá nombrando una métrica y cómo abrirla (ej.: “inversión por mes”, “alcance de Instagram por mes”).`,
      entendi, disponibles: schemas.map((s) => s.name),
    }, { status: 422 });
  }
  const usados = [...new Set([...out.widgets.map((w) => String(w.datasetId ?? primaryAi)), ...out.blends.map((b) => b.remoteDatasetId)])];
  const reply = out.reply || (via === "automatico"
    ? `Armé ${out.widgets.length} gráficos con lo que reconocí de tu pedido${aiError ? " (sin IA)" : ""}.`
    : `Listo: ${out.widgets.length} gráficos.`);
  return NextResponse.json({ widgets: out.widgets, calcs: out.calcs, blends: out.blends, datasets: usados, primary: String(out.widgets[0]?.datasetId ?? primaryAi), reply, via, entendi });
}
