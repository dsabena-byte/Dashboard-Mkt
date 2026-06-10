import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DEFAULT_BGT_URL =
  "https://raw.githubusercontent.com/dsabena-byte/Dashboard-BGT/main/data.json";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
}

async function supabaseUpsert(table: string, rows: unknown[], onConflict: string): Promise<string> {
  if (rows.length === 0) return "sin data";
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const chunks: unknown[][] = [];
  for (let i = 0; i < rows.length; i += 500) chunks.push(rows.slice(i, i + 500));
  let total = 0;
  for (const chunk of chunks) {
    const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const body = await res.text();
      return `error ${res.status} (chunk ${total}): ${body}`;
    }
    total += chunk.length;
  }
  return `${total} filas OK`;
}

interface AggRow {
  presupuesto: string;
  anio: number;
  mes: string;
  cuenta: string;
  concepto: string;
  ars: number;
  usd: number;
  updated_at: string;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};
  try {
    const sourceUrl = process.env.BGT_DATA_JSON_URL || DEFAULT_BGT_URL;
    results.source = sourceUrl;

    const res = await fetch(`${sourceUrl}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`data.json ${res.status}`);
    const json = (await res.json()) as { rows?: unknown[]; syncedAt?: string } | unknown[];
    const raw = (Array.isArray(json) ? json : json.rows ?? []) as unknown[][];
    results.rowsIn = raw.length;
    results.sourceSyncedAt = Array.isArray(json) ? null : json.syncedAt ?? null;

    // Agregación por clave natural (suma ars/usd de conceptos repetidos).
    const now = new Date().toISOString();
    const map = new Map<string, AggRow>();
    for (const r of raw) {
      const presupuesto = String(r[0] ?? "").trim();
      const cuenta = String(r[1] ?? "").trim();
      const anio = parseInt(String(r[2] ?? ""), 10) || 0;
      const mes = String(r[3] ?? "").toUpperCase().trim();
      const concepto = String(r[4] ?? "").trim();
      const ars = Number(r[5]) || 0;
      const usd = Number(r[6]) || 0;
      if (!presupuesto || !anio || !mes) continue;
      const k = `${presupuesto}¦${anio}¦${mes}¦${cuenta}¦${concepto}`;
      const ex = map.get(k);
      if (ex) {
        ex.ars += ars;
        ex.usd += usd;
      } else {
        map.set(k, { presupuesto, anio, mes, cuenta, concepto, ars, usd, updated_at: now });
      }
    }
    const rows = [...map.values()];
    results.rowsAgg = rows.length;

    results.upsert = await supabaseUpsert(
      "bgt_marketing",
      rows,
      "presupuesto,anio,mes,cuenta,concepto",
    );

    return NextResponse.json({ ok: true, timestamp: now, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message, results }, { status: 500 });
  }
}
