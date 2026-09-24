import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/chat/rate-limit";
import { getServerSupabase } from "@/lib/supabase-server";
import { canUseTableros } from "@/lib/tableros-server";
import { CHART_TYPES, sanitizeWidget, type AiDataset, type Prepared } from "@/lib/viz";

// IA de Mis tableros (portado de BIP; modelo OPENAI_INSIGHTS_MODEL, default gpt-4o-mini; respuesta JSON):
//   mode "widgets"   → arma gráficos a partir de un pedido ("¿Qué querés ver?")
//   mode "tablero"   → arma un tablero profesional completo
//   mode "narrativa" → resumen ejecutivo del reporte (sobre los datos agregados que manda el cliente)
// Recibe SOLO el esquema + una muestra chica de filas (nunca la planilla entera). Los widgets
// devueltos se sanean contra el esquema (ids de campo válidos, tipos/opciones permitidos).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = () => process.env.OPENAI_INSIGHTS_MODEL || "gpt-4o-mini";

const WIDGET_SPEC = `Formato de respuesta (SOLO JSON): {"widgets":[Widget...],"calcs":[Calc...]}
Widget = {
 "type": ${CHART_TYPES.map((t) => `"${t}"`).join("|")},
 "title": string corto en español, "subtitle"?: string,
 "datasetId"?: id del dataset (default: el principal),
 "w": 1-4 (ancho en una grilla de 4 columnas), "h": "s"|"m"|"l",
 "q": {
   "x"?: fieldId (eje/categoría/filas; en scatter = detalle), "series"?: fieldId (color; en heatmap = filas Y),
   "rows"?: [fieldId] (pivot filas / tabla filas extra), "cols"?: [fieldId] (pivot columnas),
   "measures": [{"id":"m0","field": fieldId | "__rows" (contar filas) | "calc:<nombre de un calc>", "agg":"sum"|"avg"|"min"|"max"|"count"|"countd"|"median", "calc"?:"none"|"pct_total"|"running"|"moving_avg"|"diff_prev"|"pct_prev"|"yoy"|"yoy_pct", "label"?: string, "mark"?:"bar"|"line", "axis"?:"left"|"right"}],
   "filters"?: [{"field": fieldId, "op":"in"|"notin"|"between"|"gte"|"lte"|"contains"|"date_relative", "values"?: [string], "min"?, "max"?, "text"?, "rel"?:"last_n_days"|"last_n_months"|"this_month"|"prev_month"|"this_quarter"|"this_year"|"ytd"|"prev_year", "n"?: number, "anchor"?:"datos"}],
   "grain"?: "day"|"week"|"month"|"quarter"|"year",
   "sort"?: {"by":"x"|"value","dir":"asc"|"desc"}, "topN"?: {"n": number, "others": true},
   "target"?: {"field"?: fieldId, "agg"?: "sum"|"avg", "value"?: number, "label"?: string}, "dateField"?: fieldId
 },
 "opts": {"orientation"?:"v"|"h", "stack"?:"none"|"stacked"|"percent", "labels"?: bool, "kpiMode"?:"total"|"last", "compare"?:"none"|"prev_period"|"prev_year", "direction"?:"up"|"down", "totals"?: bool, "detail"?: bool, "text"?: markdown (solo type "text"), "cond"?: [{"measure":"m0","kind":"bars"|"scale"|"semaforo","green"?:n,"yellow"?:n,"dir"?:"up"|"down"}]}
}
Calc = {"datasetId": id, "name": string, "expr": string, "format"?: "currency"|"percent"|"ratio"|"number"}
 expr: campos por su LABEL entre corchetes. Agregado (ratio correcto): SUM([Ventas]) / SUM([Inversión]). Por fila: [Ventas] - [Costo], IF([Canal] = "Online", "Digital", "Otro"). Funciones: SUM AVG MIN MAX COUNT COUNTD MEDIAN IF IFNULL AND OR NOT ABS ROUND DIV CONTAINS LEFT RIGHT CONCAT UPPER LOWER YEAR QUARTER MONTH WEEK DAY. Para % multiplicá por 100 y usá format "percent".
Reglas:
- Usá SOLO fieldIds del esquema ("id" de cada campo). Nunca inventes columnas.
- Medidas = campos role "measure" (o "__rows"). Dimensiones = role "dimension". Porcentajes/ratios (format percent/pct_frac/ratio) se promedian (agg "avg") o se calculan con un Calc agregado; montos se suman.
- Evolución: x = campo fecha + "grain":"month" (tipo line o bar). Ranking: type "bar", "opts":{"orientation":"h"}, sort value desc, topN 10 con others.
- KPI: type "kpi", w 1, h "s", sin x; "opts":{"kpiMode":"total","compare":"prev_year"} si hay más de 12 meses de datos, si no "prev_period" o "none". Si hay columna de presupuesto/meta, usala como target.
- Real vs meta: type "bar" con "target". Dos medidas de distinta escala: type "combo" (1ª barra eje izquierdo, 2ª línea eje derecho).
- Participación: donut (máx. 6 porciones con topN others). Matriz de 2 dimensiones: heatmap o pivot. Detalle: table.
- Grilla de 4 columnas: fila de KPIs (w 1 c/u, que sumen 4), gráficos grandes w 4 o dos de w 2.
- Títulos claros, en español, sin emojis.`;

function fakePrepared(ds: AiDataset, calcNames: string[]): Prepared {
  const byId = new Map<string, unknown>(ds.fields.map((f) => [f.id, f]));
  for (const n of calcNames) byId.set(`calc:${n}`, { id: `calc:${n}` });
  return { byId } as unknown as Prepared;
}

async function openai(messages: { role: string; content: string }[], maxTokens: number): Promise<Record<string, unknown>> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw Object.assign(new Error("La IA no está configurada en este entorno."), { status: 503 });
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL(), temperature: 0.2, max_tokens: maxTokens, response_format: { type: "json_object" }, messages }),
  });
  if (!res.ok) throw Object.assign(new Error(`La IA respondió con error (${res.status}).`), { status: 502 });
  const d = await res.json();
  const txt = d?.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(txt); } catch { throw Object.assign(new Error("La IA devolvió un formato inválido."), { status: 502 }); }
}

export async function POST(req: Request) {
  if (!(await canUseTableros())) return NextResponse.json({ error: "Tu usuario no tiene acceso a Mis tableros." }, { status: 403 });
  let userKey = "anon";
  try { userKey = (await getServerSupabase().auth.getUser()).data.user?.id ?? "anon"; } catch { /* noop */ }
  const rl = checkRateLimit(`tableros:${userKey}`);
  if (!rl.ok) return NextResponse.json({ error: `Muchas consultas seguidas. Probá de nuevo en ${Math.ceil(rl.retryInSec / 60)} min.` }, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = body.mode === "narrativa" ? "narrativa" : body.mode === "tablero" ? "tablero" : "widgets";

  try {
    if (mode === "narrativa") {
      const payload = JSON.stringify({ tablero: body.title, periodo: body.periodo, filtros: body.filtros, graficos: body.widgets }).slice(0, 60_000);
      const out = await openai([
        { role: "system", content: `Sos un analista de marketing senior de Drean (electrodomésticos, Argentina). Escribís el RESUMEN EJECUTIVO de un reporte a partir de los datos agregados de sus gráficos. Español rioplatense neutro, tono técnico y directo, sin relleno marketinero ni emojis. Usá SOLO los números provistos (no inventes). Formato markdown simple: un párrafo de situación (2-3 oraciones), "## Hallazgos" con 3 a 5 viñetas (cada una con un número concreto y su lectura), "## Próximos pasos" con 2-3 viñetas accionables. 150-260 palabras. Respondé JSON {"texto": "..."}.` },
        { role: "user", content: payload },
      ], 1200);
      return NextResponse.json({ texto: String(out.texto ?? "").slice(0, 6000) });
    }

    const datasets = (Array.isArray(body.datasets) ? body.datasets : []).slice(0, 4) as AiDataset[];
    if (!datasets.length || !datasets.every((d) => d && typeof d.id === "string" && Array.isArray(d.fields))) return NextResponse.json({ error: "Falta el esquema de la planilla." }, { status: 400 });
    const prompt = String(body.prompt ?? "").slice(0, 1500);
    const user = JSON.stringify({
      pedido: prompt || "Armá un tablero profesional completo.",
      modo: mode === "tablero" ? "Tablero completo (6 a 10 gráficos): KPIs principales con comparación, evolución, aperturas por la dimensión principal, participación y un ranking/detalle." : "Solo los gráficos que respondan el pedido (1 a 4).",
      datasetPrincipal: body.primary ?? datasets[0]!.id,
      datasets: datasets.map((d) => ({ ...d, sample: (d.sample ?? []).slice(0, 8) })),
    }).slice(0, 60_000);
    const out = await openai([
      { role: "system", content: `Sos un analista de BI que diseña tableros para el equipo de marketing de Drean con criterio profesional (estilo Tableau, pero simple). ${WIDGET_SPEC}` },
      { role: "user", content: user },
    ], 3500);

    const calcs = (Array.isArray(out.calcs) ? out.calcs : []).slice(0, 10).filter((c) => c && typeof c === "object" && typeof (c as Record<string, unknown>).name === "string" && typeof (c as Record<string, unknown>).expr === "string") as Record<string, unknown>[];
    const byDs = new Map(datasets.map((d) => [d.id, d]));
    const widgets = (Array.isArray(out.widgets) ? out.widgets : []).slice(0, 16).map((w) => {
      const raw = (w && typeof w === "object" ? w : {}) as Record<string, unknown>;
      const dsId = typeof raw.datasetId === "string" && byDs.has(raw.datasetId) ? raw.datasetId : String(body.primary ?? datasets[0]!.id);
      const ds = byDs.get(dsId) ?? datasets[0];
      const names = calcs.filter((c) => !c.datasetId || c.datasetId === dsId).map((c) => String(c.name));
      return sanitizeWidget({ ...raw, datasetId: dsId }, fakePrepared(ds!, names));
    }).filter(Boolean);
    return NextResponse.json({ widgets, calcs });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status });
  }
}
