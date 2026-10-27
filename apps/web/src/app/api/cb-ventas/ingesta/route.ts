import { NextResponse } from "next/server";
import { cors, noAutorizado, preflight, secretoOk } from "@/lib/cb-ventas/ingesta-auth";
import { leerCuadroBasico, svc } from "@/lib/cb-ventas/server";
import { procesarPayload } from "@/lib/cb-ventas/core";
import type { VentasPayload } from "@/lib/cb-ventas/types";

// POST → recibe el MISMO payload que /api/ventas de la app vieja ({ generatedAt?, fc: [...], bo: [...] }),
// filtra contra el cuadro básico, normaliza y REEMPLAZA todas las ventas (vt_ventas) en una transacción.
// GET → estado de la última carga. Auth: header x-refresh-secret = CB_VENTAS_INGESTA_SECRET.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const OPTIONS = () => preflight();

const json = (body: unknown, status = 200) => cors(NextResponse.json(body, { status }));

export async function GET(request: Request) {
  if (!secretoOk(request)) return noAutorizado();
  const { data, error } = await svc().from("vt_ingestas").select("at,generated_at,filas,detalle").order("id", { ascending: false }).limit(1).maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, ultima: data });
}

export async function POST(request: Request) {
  if (!secretoOk(request)) return noAutorizado();
  let payload: VentasPayload;
  try {
    payload = (await request.json()) as VentasPayload;
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }
  if (!payload || !Array.isArray(payload.fc) || !Array.isArray(payload.bo)) {
    return json({ error: "El payload tiene que tener arrays `fc` y `bo`" }, 400);
  }
  try {
    const { cuadroBasico } = await leerCuadroBasico(undefined, { todos: true });
    if (cuadroBasico.length === 0) return json({ error: "El cuadro básico está vacío: cargalo antes de mandar ventas." }, 409);
    const r = procesarPayload(payload, cuadroBasico);
    if (r.rows.length === 0 && r.matchedCB.fc + r.matchedCB.bo > 0) {
      return json({ error: "Todas las filas (post-filtro CB) fallaron validación", details: r.errors.slice(0, 20), totalErrors: r.errors.length, received: r.received, matchedCB: r.matchedCB }, 422);
    }
    const generatedAt = payload.generatedAt && !Number.isNaN(Date.parse(payload.generatedAt)) ? payload.generatedAt : new Date().toISOString();
    const detalle = { received: r.received, matchedCB: r.matchedCB, skippedNoCB: r.skippedNoCB, skippedInvalid: r.errors.length };
    const { error } = await svc().rpc("vt_reemplazar_ventas", { p_rows: r.rows, p_generated_at: generatedAt, p_detalle: detalle });
    if (error) {
      console.error("[cb-ventas/ingesta] rpc:", error.message);
      return json({ ok: false, error: "No se pudieron guardar las ventas (¿falta la migración 0139?)" }, 500);
    }
    return json({
      ok: true,
      generatedAt,
      rows: r.rows.length,
      fc: r.rows.filter((x) => x.tipo === "FC").length,
      bo: r.rows.filter((x) => x.tipo === "BO").length,
      pedidos: new Set(r.rows.map((x) => x.documentoVentas)).size,
      ...detalle,
      invalidSample: r.errors.slice(0, 10),
    });
  } catch (e) {
    console.error("[cb-ventas/ingesta]", e instanceof Error ? e.message : e);
    return json({ ok: false, error: "Error procesando las ventas" }, 500);
  }
}
