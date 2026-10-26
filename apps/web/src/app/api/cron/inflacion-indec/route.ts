import { NextResponse } from "next/server";
import { comoSistema } from "@/lib/supabase-server";
import { guardarInflaciones } from "@/lib/presupuesto-server";
import { INDEC_IPC_URL, parseIpcIndec } from "@/lib/indec-ipc";

// Inflación REAL desde INDEC (CSV oficial, IPC nivel general nacional) → bgt_inflacion versión "REAL <año>".
// Solo escribe los meses que cambian (cada uno queda en el historial). Las líneas BGT / 4+8 / 8+4 no se tocan.
// ?dry=1 = muestra lo que traería sin escribir. Workflow inflacion-indec.yml (días 8–20, cuando INDEC publica).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handler(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const res = await fetch(INDEC_IPC_URL, { headers: { "User-Agent": "Mozilla/5.0 (dashboard-mkt)" }, cache: "no-store" });
    if (!res.ok) throw new Error(`INDEC respondió ${res.status}`);
    // shortcut: el CSV viene en latin1 pero las columnas que usamos son ASCII, alcanza con text().
    const serie = parseIpcIndec(await res.text());
    if (!serie.length) throw new Error("El CSV de INDEC no trajo meses");
    const ultimo = serie[serie.length - 1]!;
    if (new URL(request.url).searchParams.get("dry")) return NextResponse.json({ ok: true, dry: true, meses: serie.length, ultimo });
    const cambios = await guardarInflaciones(serie.map((s) => ({ version: `REAL ${s.anio}`, mes: s.mes, pct: s.pct })), "INDEC (automático)", { fuente: "INDEC", ignorarCierre: true });
    return NextResponse.json({ ok: true, meses: serie.length, cambios, ultimo });
  } catch (e) {
    console.error("[inflacion-indec]", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// Sin sesión: lee con service role solo después de validar CRON_SECRET (dentro de handler).
export const GET = (req: Request) => comoSistema(() => handler(req));
