import { NextResponse } from "next/server";
import { getCbRows } from "@/lib/cb-queries";
import { getFloorShareRows, getAvailableWeeks, getTiendaClienteMap } from "@/lib/floor-share-queries";

// Copia la data del proyecto CB (lento) a tablas mirror en el PRINCIPAL (rápido),
// para que /cuadros-basicos y /floor-share lean el mirror al instante. Clean-replace
// (DELETE + INSERT) en cada corrida. Paga acá, en background, la lentitud del proyecto CB.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

async function replaceAll(url: string, key: string, table: string, deleteFilter: string, rows: unknown[]): Promise<string> {
  const base = { apikey: key, Authorization: `Bearer ${key}` };
  // 1) DELETE todo (filtro que matchea todas las filas).
  const del = await fetch(`${url}/rest/v1/${table}?${deleteFilter}`, {
    method: "DELETE",
    headers: { ...base, Prefer: "return=minimal" },
  });
  if (!del.ok) return `delete error ${del.status}: ${await del.text()}`;
  // 2) INSERT en lotes.
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetch(`${url}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...base, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!res.ok) return `insert error ${res.status}: ${await res.text()}`;
  }
  return `${rows.length} filas OK`;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = env("NEXT_PUBLIC_SUPABASE_URL");
    const key = env("SUPABASE_SERVICE_ROLE_KEY");

    // Lee del proyecto CB (lento) — acá sí, en background.
    const { weeks } = await getAvailableWeeks();
    const fsWeeks = weeks.slice(0, 30); // ~7 meses, cubre las 26 que usa el dash
    const [cbRows, fsRows, tiendaCliente] = await Promise.all([
      getCbRows({}),
      getFloorShareRows({ semanas: fsWeeks }),
      getTiendaClienteMap(),
    ]);

    const tcRows = [...tiendaCliente.entries()].map(([numero_tienda, cliente]) => ({ numero_tienda, cliente }));

    const [cbRes, fsRes, tcRes] = await Promise.all([
      replaceAll(url, key, "cb_semanal_mirror", "semana=gte.0", cbRows),
      replaceAll(url, key, "floor_share_mirror", "semana=gte.0", fsRows),
      replaceAll(url, key, "cb_tienda_cliente_mirror", "numero_tienda=not.is.null", tcRows),
    ]);

    const ok = ![cbRes, fsRes, tcRes].some((r) => r.includes("error"));
    return NextResponse.json({ ok, cb: cbRes, floor_share: fsRes, tienda_cliente: tcRes }, { status: ok ? 200 : 500 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
