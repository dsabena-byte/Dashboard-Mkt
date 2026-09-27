import "server-only";
// Lecturas chicas (REST service key, sin cookies) para el pacing de Plan de Medios:
//  · Presupuesto vigente de la cuenta de pauta en bgt_marketing (cuenta "PUBLICIDAD TV", concepto
//    "PAUTA ATL"), ~40 filas del año → versión vigente por cuatrimestre (BGT / 4+8 / 8+4).
//  · Momento del dato = última sync de Meta (fetched_at más reciente, 1 fila).
// Nunca tiran: sin dato → null.
import { bgtVigentePorMes, BGT_PAUTA_CUENTA } from "@/lib/pauta-pacing";

async function rest<T>(query: string): Promise<T[] | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T[];
  } catch { return null; }
}

export async function getBgtPautaMensual(anio: number): Promise<{ versiones: (string | null)[]; valores: (number | null)[] } | null> {
  const rows = await rest<{ presupuesto: string; mes: string; ars: number | string | null }>(
    `bgt_marketing?select=presupuesto,mes,ars&cuenta=eq.${encodeURIComponent(BGT_PAUTA_CUENTA)}&anio=eq.${anio}&limit=2000`,
  );
  if (!rows?.length) return null;
  const r = bgtVigentePorMes(rows.map((x) => ({ presupuesto: x.presupuesto, mes: x.mes, ars: Number(x.ars) || 0 })), anio);
  return r.valores.some((v) => v != null) ? r : null;
}

/** Última sync de Meta (fetched_at). */
export async function getPautaAsOf(): Promise<string | null> {
  const rows = await rest<{ fetched_at: string | null }>("meta_paid_creatives?select=fetched_at&order=fetched_at.desc.nullslast&limit=1");
  return rows?.[0]?.fetched_at ?? null;
}
