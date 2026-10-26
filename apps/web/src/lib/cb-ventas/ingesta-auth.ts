import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

// Rutas del Office Script del Excel "FC + BO" (/api/cb-ventas/ingesta y /pares). No pasan por la sesión
// (el middleware las saltea): se autentican SOLO con el header x-refresh-secret = CB_VENTAS_INGESTA_SECRET.
// Sin la env → 401 siempre (fail closed). Nunca por query string (queda en logs).
// CORS abierto: el Office Script corre en el sandbox de Excel Online (otro origen); sin el secreto no hay datos.

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-refresh-secret",
  "Access-Control-Max-Age": "86400",
};

export function cors<T extends Response>(res: T): T {
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
}

export const preflight = () => cors(new NextResponse(null, { status: 204 }));

export function secretoOk(request: Request): boolean {
  const esperado = process.env.CB_VENTAS_INGESTA_SECRET ?? "";
  const dado = request.headers.get("x-refresh-secret") ?? "";
  if (esperado.length < 16 || dado.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(dado), Buffer.from(esperado));
}

export const noAutorizado = () => cors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
