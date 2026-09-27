import "server-only";
import type { AgeSnap, Edad, RedSnap } from "@/lib/post-snapshots-core";

// Persistencia de las fotos por edad (tabla social_post_snapshots, migración 0115). REST con la
// service key (sin cookies → sirve en crons y en señales). FAIL-SAFE: sin la tabla, record devuelve
// {ok:false} y el sync sigue; get devuelve []. La primera observación dentro de la ventana de cada
// edad gana (upsert on conflict do nothing = `resolution=ignore-duplicates`).

function sb(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export async function recordPostSnapshots(rows: AgeSnap[], fuente: string): Promise<{ ok: boolean; n: number; error?: string }> {
  if (!rows.length) return { ok: true, n: 0 };
  const c = sb();
  if (!c) return { ok: false, n: 0, error: "sin credenciales de Supabase" };
  try {
    const payload = rows.map((r) => ({
      marca: r.marca, red: r.red, post_key: r.post, edad_dias: r.edad, horas_edad: r.horas,
      likes: r.likes, comentarios: r.comentarios, views: r.views, followers: r.followers, alcance: r.alcance ?? null, fuente,
    }));
    const res = await fetch(`${c.url}/rest/v1/social_post_snapshots?on_conflict=red,post_key,edad_dias`, {
      method: "POST",
      headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, n: 0, error: `${res.status}: ${(await res.text()).slice(0, 160)}` };
    return { ok: true, n: rows.length };
  } catch (e) {
    return { ok: false, n: 0, error: (e as Error).message };
  }
}

/** Fotos de los últimos `days` días de observación (default 150). Nunca tira. */
export async function getPostSnapshots(opts: { days?: number; limit?: number; edad?: Edad } = {}): Promise<AgeSnap[]> {
  const c = sb();
  if (!c) return [];
  try {
    const since = new Date(Date.now() - (opts.days ?? 150) * 86_400_000).toISOString();
    const q = `social_post_snapshots?select=marca,red,post_key,edad_dias,horas_edad,likes,comentarios,views,followers,alcance&observed_at=gte.${since}${opts.edad ? `&edad_dias=eq.${opts.edad}` : ""}&order=observed_at.desc&limit=${opts.limit ?? 6000}`;
    const res = await fetch(`${c.url}/rest/v1/${q}`, { headers: { apikey: c.key, Authorization: `Bearer ${c.key}` }, cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<Record<string, unknown>>;
    return data.map((r) => ({
      marca: String(r.marca), red: r.red as RedSnap, post: String(r.post_key), edad: Number(r.edad_dias) as Edad, horas: Number(r.horas_edad) || 0,
      likes: Number(r.likes) || 0, comentarios: Number(r.comentarios) || 0, views: r.views == null ? null : Number(r.views),
      followers: r.followers == null ? null : Number(r.followers), ...(r.alcance != null ? { alcance: Number(r.alcance) } : {}),
    }));
  } catch {
    return [];
  }
}
