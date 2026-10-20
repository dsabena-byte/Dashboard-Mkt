import "server-only";
import { PLATAFORMAS, claveFila, mergeConAnterior, sanearFilas, type FilaCanal } from "./mkt-canal-core";

// Mkt Canal: la IA lee un reporte de un retailer (PDF, imagen o Excel/CSV) y devuelve filas de
// `mkt_canal_acciones`; el usuario las revisa y recién ahí se guardan (upsert por cliente·acción·mes·plataforma).
const MODEL = process.env.OPENAI_MKT_CANAL_MODEL || "gpt-4o-mini";

const PROMPT = `Sos analista de marketing de Drean (electrodomésticos, Argentina). Te paso el reporte de una acción de marketing
con un retailer (Oncity, Cetrogar, Jumbo, Naldo, Megatone, La Anónima u otro). Extraé SOLO números que estén en el reporte; nunca inventes.
Devolvé JSON {"filas":[...], "notas": "texto corto con lo que no pudiste leer o dudas"}.
Cada fila = un cliente · una acción · un mes · una plataforma, con:
cliente (nombre del retailer), accion (nombre de la campaña, ej "Hot Sale", "Drean Week", "Cobranding mensual"),
mes ("AAAA-MM"), plataforma (una de: ${PLATAFORMAS.join(", ")}; Facebook/Instagram = Meta; banners/home del sitio = On-site; newsletter = Email),
impresiones, clics, sesiones (visitas al sitio: "Session"/"Sesiones"), conversiones, ingresos, entregados (emails), aperturas (emails), inversion (pesos), todos números o null si el reporte no lo dice.
Si un mismo mes y plataforma aparece varias veces para la misma acción, sumalos en una fila.
Excel con varias hojas: leé TODAS las hojas; cada hoja suele ser una plataforma (el nombre de la hoja la indica: WEB/banner/home = On-site,
GOOGLE = Google, META/FB/IG = Meta, MAIL = Email). Si una hoja no dice campaña ni fecha, usá la campaña y el período de las otras hojas del
mismo archivo (o del nombre del archivo). Si el reporte no dice el año, usá ${new Date().getFullYear()}. Si el período cruza dos meses, asignalo al mes de inicio y avisalo en "notas".
Columnas: "Views"/"Vistas"/"Impresiones" = impresiones; "Ingresos"/"Revenue" = ingresos. "Session"/"Sesiones" = sesiones. Columnas sin campo (CTR) se ignoran.
Nunca dejes afuera una hoja con números: si falta un dato (cliente, acción o mes), devolvé la fila igual con ese campo vacío.
Escribí el nombre del retailer bien (Oncity, no "Onctiy").
PDF de presentación (slides con capturas): leé TODAS las páginas y las capturas, no solo el texto. Tablas por plataforma (GENERAL/GOOGLE/META)
con una fila por mes: tomá solo los meses con valores distintos de 0 (Inversión = inversion, Impresiones, Clicks = clics, Sesiones,
Transacciones = conversiones, Revenue = ingresos). Si hay una tabla GENERAL y otra por plataforma con el mismo dato, usá la de la plataforma
(no la sumes dos veces). Newsletter/mailing: "Total de emails enviados" = entregados, "Aperturas únicas" = aperturas, "Total clicks" = clics,
impresiones = null; varios newsletters del mismo mes van como filas separadas (se suman solos). Si el reporte no nombra la campaña, usá
accion = "Cobranding mensual".`;

async function contenido(file: File): Promise<unknown[]> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (/\.(xlsx|xls|csv)$/.test(name)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "buffer", cellFormula: false });
    const csv = wb.SheetNames.slice(0, 10).map((n) => `## Hoja ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n]!, { rawNumbers: true })}`).join("\n\n").slice(0, 60_000);
    return [{ type: "text", text: `Archivo ${file.name} (${wb.SheetNames.length} hojas: ${wb.SheetNames.join(", ")}):\n${csv}` }];
  }
  const b64 = buf.toString("base64");
  if (/\.pdf$/.test(name) || file.type === "application/pdf") {
    return [{ type: "file", file: { filename: file.name, file_data: `data:application/pdf;base64,${b64}` } }];
  }
  if (/^image\/(png|jpeg|webp|gif)$/.test(file.type)) {
    return [{ type: "image_url", image_url: { url: `data:${file.type};base64,${b64}`, detail: "high" } }];
  }
  throw Object.assign(new Error("Formato no soportado. Subí un PDF, una imagen (PNG/JPG) o un Excel/CSV."), { status: 400 });
}

export async function extraerReporte(file: File, cliente?: string): Promise<{ filas: FilaCanal[]; errores: string[]; notas: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw Object.assign(new Error("Falta OPENAI_API_KEY."), { status: 503 });
  const partes = await contenido(file);
  const pista = cliente ? `El retailer es ${cliente}.` : "";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: [{ type: "text", text: `${pista} Extraé las filas.` }, ...partes] },
      ],
    }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[mkt-canal] OpenAI", res.status, body.slice(0, 400));
    throw Object.assign(new Error(`La IA no pudo leer el archivo (OpenAI ${res.status}).`), { status: 502 });
  }
  const d = await res.json();
  let j: { filas?: unknown; notas?: unknown } = {};
  try { j = JSON.parse(String(d?.choices?.[0]?.message?.content ?? "{}")); } catch { /* respuesta no JSON → sin filas */ }
  const r = sanearFilas(j.filas, true);
  return { ...r, notas: String(j.notas ?? "").slice(0, 1000) };
}

function rest(path: string, init?: RequestInit) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !k) throw new Error("Falta la configuración de Supabase.");
  return fetch(`${url}/rest/v1/${path}`, { ...init, cache: "no-store", headers: { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
}

/** Filas ya guardadas con la misma clave (para mostrar "antes" y no pisar lo que el reporte no trae). */
export async function filasExistentes(filas: FilaCanal[]): Promise<Map<string, FilaCanal>> {
  const clientes = [...new Set(filas.map((f) => f.cliente))];
  const meses = [...new Set(filas.map((f) => f.mes))];
  if (!clientes.length) return new Map();
  const q = `mkt_canal_acciones?select=*&cliente=in.(${clientes.map((c) => `"${c.replace(/"/g, "")}"`).join(",")})&mes=in.(${meses.join(",")})`;
  const r = await rest(q);
  if (!r.ok) throw new Error(`No se pudo leer la base (${r.status}).`);
  const rows = (await r.json()) as FilaCanal[];
  return new Map(rows.map((x) => [claveFila(x), x]));
}

export async function guardarFilas(filas: FilaCanal[]): Promise<{ nuevas: number; actualizadas: number; sinSesiones?: boolean }> {
  const antes = await filasExistentes(filas);
  const now = new Date().toISOString();
  const payload = filas.map((f) => ({ ...mergeConAnterior(f, antes.get(claveFila(f))), updated_at: now }));
  const r = await rest("mkt_canal_acciones?on_conflict=cliente,accion,mes,plataforma", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const txt = await r.text();
    // Sin la migración 0127 no existe la columna `sesiones`: se guarda sin ella y se avisa.
    if (/sesiones/.test(txt) && payload.some((p) => "sesiones" in p)) {
      return { ...(await guardarFilas(filas.map(({ sesiones: _s, ...f }) => f as FilaCanal))), sinSesiones: true };
    }
    throw new Error(`No se pudo guardar (${r.status}): ${txt.slice(0, 200)}`);
  }
  const actualizadas = filas.filter((f) => antes.has(claveFila(f))).length;
  return { nuevas: filas.length - actualizadas, actualizadas };
}
