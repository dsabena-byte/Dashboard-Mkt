import { NextResponse } from "next/server";
import { computeTradeMonthlyFromCb } from "@/lib/trade-monthly";

// Precalcula el resultado mensual de Trade (CB + Floor Share) en trade_monthly
// (proyecto principal). Paga acá, en background, el costo de paginar la tabla CB
// entera (~26s) para que el Seguimiento Objetivos lea el resultado al instante.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Env var ${key} no configurada`);
  return v;
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
    const anio = new Date().getUTCFullYear();

    const t = await computeTradeMonthlyFromCb(anio);
    const now = new Date().toISOString();
    const rows = Array.from({ length: 12 }, (_, i) => ({
      anio,
      mes: i + 1,
      cb_pct: t.cb[i],
      fs_general: t.fsGeneral[i],
      fs_lavado: t.fsCat.Lavado?.[i] ?? null,
      fs_refri: t.fsCat["Refrigeración"]?.[i] ?? null,
      fs_coccion: t.fsCat["Cocción"]?.[i] ?? null,
      updated_at: now,
    }));

    const res = await fetch(`${url}/rest/v1/trade_monthly?on_conflict=anio,mes`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `upsert ${res.status}: ${await res.text()}` }, { status: 500 });
    }

    const conDato = rows.filter((r) => r.cb_pct != null || r.fs_general != null).length;
    return NextResponse.json({ ok: true, anio, filas: rows.length, meses_con_dato: conDato });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
