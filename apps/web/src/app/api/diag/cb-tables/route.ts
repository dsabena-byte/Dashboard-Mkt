import { NextResponse } from "next/server";

// Diagnóstico de tablas de Cuadros Básicos / Floor Share en Supabase.
// Lista candidatas + 1 fila de ejemplo + columnas para cada una.

export async function GET() {
  try {
    const rawUrl = process.env.CB_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.CB_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!rawUrl || !key) throw new Error("Faltan CB_SUPABASE_URL / CB_SUPABASE_SERVICE_ROLE_KEY (o las defaults)");
    // Normalizar: sin trailing slash, sin espacios, sin path extra
    const url = rawUrl.trim().replace(/\/+$/, "").replace(/\/rest\/v1.*$/, "");
    const using = process.env.CB_SUPABASE_URL ? "CB_SUPABASE_*" : "default SUPABASE_*";

    // Tablas reales del proyecto CB
    const patterns = [
      "cuadro_basico_semanal",
      "floor_share",
      "sync_status",
    ];

    const found: Array<Record<string, unknown>> = [];
    const errors: Array<Record<string, unknown>> = [];
    for (const name of patterns) {
      const res = await fetch(`${url}/rest/v1/${name}?select=*&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        const data = await res.json() as Array<Record<string, unknown>>;
        const sample = data[0] ?? null;
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
      } else {
        const body = await res.text();
        errors.push({ table: name, status: res.status, body: body.slice(0, 400) });
      }
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      using_env: using,
      raw_url_length: rawUrl.length,
      raw_url_first_50: rawUrl.slice(0, 50),
      raw_url_last_10: rawUrl.slice(-10),
      normalized_url: url,
      first_fetch_url: `${url}/rest/v1/cuadro_basico_semanal?select=*&limit=1`,
      found_tables: found.length,
      tables: found,
      errors,
      hint: "Si tu tabla no está en la lista, decime el nombre exacto.",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
