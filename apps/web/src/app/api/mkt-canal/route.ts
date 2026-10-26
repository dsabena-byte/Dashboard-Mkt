import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { allowedFromRows, isPathAllowed } from "@/lib/dashboard-access";
import { checkRateLimit } from "@/lib/chat/rate-limit";
import { claveFila, sanearFilas } from "@/lib/mkt-canal-core";
import { extraerReporte, filasExistentes, guardarFilas } from "@/lib/mkt-canal-server";
import { aiQuotaGate } from "@/lib/ai-quota";

// Mkt Canal · subir reporte de un retailer.
//   POST multipart {archivo, cliente?} → la IA lee el archivo → { filas, antes, errores, notas } (NO escribe).
//   PUT  { filas }                     → valida y guarda (upsert por cliente·acción·mes·plataforma).
// Exige sesión y acceso a /mkt-canal (dashboard_access).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BYTES = 10 * 1024 * 1024;
// Vercel corta los bodies de >4,5 MB (413) → los archivos grandes suben directo a Storage (bucket privado) y se leen desde ahí.
const BUCKET = "mkt-canal-uploads";
const PATH_RE = /^[0-9a-f-]{36}\.[a-z0-9]{1,6}$/;

async function storage(path: string, init: RequestInit = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Object.assign(new Error("Falta la configuración de Supabase."), { status: 503 });
  return fetch(`${url}/storage/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, ...init.headers } });
}

/** {sign: nombre} → URL firmada para subir; {path, nombre, cliente?} → archivo ya subido a Storage. */
async function archivoDeStorage(body: { sign?: string; path?: string; nombre?: string }): Promise<Response | File> {
  if (body.sign) {
    await storage("bucket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }) }).catch(() => null);
    const ext = (body.sign.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "bin";
    const path = `${crypto.randomUUID()}.${ext}`;
    const r = await storage(`object/upload/sign/${BUCKET}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = (await r.json().catch(() => ({}))) as { url?: string };
    if (!r.ok || !d.url) throw new Error(`No se pudo preparar la subida (Storage ${r.status}).`);
    return NextResponse.json({ uploadUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1${d.url}`, path });
  }
  if (!body.path || !PATH_RE.test(body.path)) return NextResponse.json({ error: "Archivo inválido." }, { status: 400 });
  const r = await storage(`object/${BUCKET}/${body.path}`);
  if (!r.ok) return NextResponse.json({ error: `No se encontró el archivo subido (Storage ${r.status}).` }, { status: 400 });
  const buf = await r.arrayBuffer();
  await storage(`object/${BUCKET}/${body.path}`, { method: "DELETE" }).catch(() => null);
  if (buf.byteLength > MAX_BYTES) return NextResponse.json({ error: "El archivo pesa más de 10 MB." }, { status: 400 });
  return new File([buf], String(body.nombre ?? body.path).slice(0, 200), { type: r.headers.get("content-type") ?? "" });
}

async function usuario(): Promise<string | null> {
  try {
    const supabase = getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("dashboard_access").select("dashboard_path");
    return isPathAllowed("/mkt-canal", allowedFromRows(data as { dashboard_path: string }[] | null)) ? (user.email ?? user.id) : "";
  } catch { return null; }
}

const err = (e: unknown) => {
  const status = (e as { status?: number })?.status ?? 500;
  if (status === 500) console.error("[mkt-canal]", e);
  return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status });
};

// GET ?tabla=acciones|aacc → filas para el iframe del tablero (antes las leía con la clave pública).
const TABLAS: Record<string, string> = { acciones: "mkt_canal_acciones?select=*&order=id", aacc: "mkt_canal_aacc?select=cliente,mes,aacc&order=mes" };
export async function GET(req: Request) {
  const q = TABLAS[new URL(req.url).searchParams.get("tabla") ?? ""];
  if (!q) return NextResponse.json({ error: "Tabla inválida." }, { status: 400 });
  const u = await usuario();
  if (u === null) return NextResponse.json({ error: "Sin sesión." }, { status: 401 });
  if (!u) return NextResponse.json({ error: "Sin acceso a Mkt Canal." }, { status: 403 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Falta la configuración de Supabase." }, { status: 503 });
  const r = await fetch(`${url}/rest/v1/${q}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
  return NextResponse.json(r.ok ? await r.json() : { error: `Supabase ${r.status}` }, { status: r.ok ? 200 : 502 });
}

export async function POST(req: Request) {
  const u = await usuario();
  if (u === null) return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  if (!u) return NextResponse.json({ error: "Tu usuario no tiene acceso a Mkt Canal." }, { status: 403 });
  const rl = checkRateLimit(`mkt-canal:${u}`);
  if (!rl.ok) return NextResponse.json({ error: `Demasiados archivos seguidos. Probá en ${rl.retryInSec} s.` }, { status: 429 });
  let file: unknown, clienteIn: unknown;
  if (req.headers.get("content-type")?.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    try {
      const r = await archivoDeStorage(body);
      if (r instanceof Response) return r;
      file = r; clienteIn = body.cliente;
    } catch (e) { return err(e); }
  } else {
    const fd = await req.formData().catch(() => null);
    file = fd?.get("archivo"); clienteIn = fd?.get("cliente");
  }
  if (!(file instanceof File)) return NextResponse.json({ error: "Elegí un archivo." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "El archivo pesa más de 10 MB." }, { status: 400 });
  const cuota = await aiQuotaGate("mkt_canal"); // tope diario persistido (D-10)
  if (cuota) return cuota;
  try {
    const r = await extraerReporte(file, String(clienteIn ?? "").trim().slice(0, 60) || undefined);
    const antes = await filasExistentes(r.filas);
    return NextResponse.json({ ...r, antes: Object.fromEntries(r.filas.filter((f) => antes.has(claveFila(f))).map((f) => [claveFila(f), antes.get(claveFila(f))])) });
  } catch (e) { return err(e); }
}

export async function PUT(req: Request) {
  const u = await usuario();
  if (u === null) return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  if (!u) return NextResponse.json({ error: "Tu usuario no tiene acceso a Mkt Canal." }, { status: 403 });
  const body = await req.json().catch(() => null);
  const { filas, errores } = sanearFilas(body?.filas);
  if (errores.length) return NextResponse.json({ error: "Corregí las filas marcadas antes de guardar.", errores }, { status: 400 });
  if (!filas.length) return NextResponse.json({ error: "No hay filas para guardar." }, { status: 400 });
  try { return NextResponse.json({ ok: true, ...(await guardarFilas(filas)) }); } catch (e) { return err(e); }
}
