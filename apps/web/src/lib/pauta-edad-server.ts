import "server-only";
// Lector (REST, service key) de «Edad × medio y formato»: meta_paid_breakdown (0150) del año + qué anuncios son
// video (meta_paid_creatives.video_plays). Devuelve celdas ya cruzadas (chico) para filtrar en el cliente.
import { cruzarEdadFormato, type CeldaEdad, type FilaBreakdown } from "@/lib/pauta-edad";

async function restAll<T>(path: string): Promise<T[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const out: T[] = [];
  for (let off = 0; off < 200_000; off += 1000) {
    const res = await fetch(`${url}/rest/v1/${path}&limit=1000&offset=${off}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export async function getPautaEdad(anio: number): Promise<{ celdas: CeldaEdad[]; meses: string[] }> {
  const [filas, creat] = await Promise.all([
    restAll<FilaBreakdown>(`meta_paid_breakdown?select=mes,ad_id,dim,valor,impresiones,alcance,clicks,link_clicks,landing_views,interacciones,video_p100,thruplay,spend&mes=like.${anio}-*&order=mes,ad_id,dim,valor`),
    restAll<{ ad_id: string; video_plays: number | null }>(`meta_paid_creatives?select=ad_id,video_plays&video_plays=gt.0&order=id`),
  ]);
  const videos = new Set(creat.map((c) => c.ad_id));
  // Sin la fila del anuncio en creatives: es video si tuvo reproducciones completas en el breakdown.
  for (const f of filas) if ((f.video_p100 ?? 0) > 0 || (f.thruplay ?? 0) > 0) videos.add(f.ad_id);
  return { celdas: cruzarEdadFormato(filas, (id) => videos.has(id)), meses: [...new Set(filas.map((f) => f.mes))].sort() };
}
