import "server-only";
// pauta_edad (0150): escritura desde los crons de cada medio (?edad=1) y lectura para «Edad × medio».
import { normEdad, type FilaEdad } from "@/lib/pauta-edad";
import { getFxRates } from "@/lib/tc-finanzas";

function cfg() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return { url, h: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } };
}

/** formato vacío = el medio; estimado = cruce edad × ubicación estimado (solo Meta). */
export type FilaEdadIn = Omit<FilaEdad, "medio" | "mes" | "spend" | "formato" | "estimado" | "video_p50"> & { video_p50?: number } & { spend: number; formato?: string; estimado?: boolean; moneda?: "ARS" | "USD" };

/** Reemplaza las filas de un medio y mes. Sin filas no toca nada (un pedido vacío no borra lo bueno). */
export async function guardarEdad(medio: string, mes: string, filas: FilaEdadIn[]): Promise<number> {
  if (!filas.length) return 0;
  const { url, h } = cfg();
  // Suma por pieza × edad normalizada (55-64 + 65+ → 55+).
  const agg = new Map<string, FilaEdadIn & { edad: string }>();
  for (const f of filas) {
    const edad = normEdad(f.edad);
    const k = `${f.pieza_id}|${edad}|${f.formato || medio}`;
    const a = agg.get(k);
    if (!a) { agg.set(k, { ...f, edad }); continue; }
    a.impresiones += f.impresiones; a.clicks += f.clicks; a.video_completos += f.video_completos; a.video_p50 = (a.video_p50 ?? 0) + (f.video_p50 ?? 0);
    a.interacciones += f.interacciones; a.spend += f.spend;
  }
  const now = new Date().toISOString();
  const rows = [...agg.values()].map((f) => ({
    medio, mes, pieza_id: f.pieza_id, edad: f.edad, formato: f.formato || medio, estimado: !!f.estimado, tipo: f.tipo,
    impresiones: Math.round(f.impresiones), clicks: Math.round(f.clicks), video_completos: Math.round(f.video_completos), video_p50: Math.round(f.video_p50 ?? 0),
    interacciones: Math.round(f.interacciones), spend: Math.round(f.spend * 100) / 100, moneda: f.moneda ?? "ARS", updated_at: now,
  }));
  const del = await fetch(`${url}/rest/v1/pauta_edad?medio=eq.${encodeURIComponent(medio)}&mes=eq.${mes}`, { method: "DELETE", headers: { ...h, Prefer: "return=minimal" } });
  if (!del.ok) throw new Error(`pauta_edad delete ${del.status}: ${(await del.text()).slice(0, 200)}`);
  for (let i = 0; i < rows.length; i += 1000) {
    const res = await fetch(`${url}/rest/v1/pauta_edad`, { method: "POST", headers: { ...h, Prefer: "return=minimal" }, body: JSON.stringify(rows.slice(i, i + 1000)) });
    if (!res.ok) throw new Error(`pauta_edad insert ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return rows.length;
}

/** Filas del año, con DV360 (USD) pasado a $ con el TC REAL de finanzas del mes (sin TC del mes: el último cargado). */
export async function getPautaEdad(anio: number): Promise<{ filas: FilaEdad[]; meses: string[] }> {
  const { url, h } = cfg();
  const filas: (FilaEdad & { moneda: string })[] = [];
  for (let off = 0; off < 200_000; off += 1000) {
    const res = await fetch(`${url}/rest/v1/pauta_edad?select=medio,mes,pieza_id,edad,formato,estimado,tipo,impresiones,clicks,video_completos,video_p50,interacciones,spend,moneda&mes=like.${anio}-*&order=medio,mes,pieza_id,edad,formato&limit=1000&offset=${off}`, { headers: h, cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`pauta_edad ${res.status}`);
    const rows = (await res.json()) as (FilaEdad & { moneda: string })[];
    filas.push(...rows.map((r) => ({ ...r, spend: Number(r.spend), video_p50: Number(r.video_p50 ?? 0) })));
    if (rows.length < 1000) break;
  }
  if (filas.some((f) => f.moneda === "USD")) {
    const fx = await getFxRates();
    const claves = Object.keys(fx).sort();
    const tcDe = (mes: string) => fx[`${mes}-01`] ?? fx[claves.filter((k) => k <= `${mes}-01`).pop() ?? claves[claves.length - 1] ?? ""] ?? 0;
    for (const f of filas) if (f.moneda === "USD") f.spend *= tcDe(f.mes);
  }
  return { filas, meses: [...new Set(filas.map((f) => f.mes))].sort() };
}
