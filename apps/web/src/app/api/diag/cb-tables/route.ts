import { NextResponse } from "next/server";

// Diagnóstico de tablas de Cuadros Básicos / Floor Share en Supabase.
// Lista candidatas + 1 fila de ejemplo + columnas para cada una.

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

export async function GET() {
  try {
    const url = env("NEXT_PUBLIC_SUPABASE_URL");
    const key = env("SUPABASE_SERVICE_ROLE_KEY");

    // Patrones candidatos
    const patterns = [
      "cuadros_basicos", "cuadro_basico", "cb_checklist", "cb_visitas",
      "cb_detalle", "cb_resultados", "cb", "infaltables", "estrategicos",
      "floor_share", "floorshare", "gondola", "share_gondola",
      "trade_marketing", "trade_mkt",
    ];

    const found: Array<Record<string, unknown>> = [];
    for (const name of patterns) {
      const res = await fetch(`${url}/rest/v1/${name}?select=*&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        const data = await res.json() as Array<Record<string, unknown>>;
        const sample = data[0] ?? null;
        // Conteo
        const countRes = await fetch(`${url}/rest/v1/${name}?select=*`, {
          method: "HEAD",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            Prefer: "count=exact",
          },
        });
        const countHeader = countRes.headers.get("content-range") ?? "";
        const count = countHeader.split("/")[1] ?? "?";
        found.push({
          table: name,
          columns: sample ? Object.keys(sample) : [],
          row_count: count,
          sample,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      found_tables: found.length,
      tables: found,
      hint: "Si tu tabla no está en la lista, decime el nombre exacto.",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
