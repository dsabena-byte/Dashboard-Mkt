import "server-only";
import { getServerSupabase } from "./supabase-server";
import { getCbSupabase } from "./supabase-cb";

// Última fecha de actualización de una tabla (max de una columna timestamp).
// Sirve para mostrar en cada dashboard "Datos actualizados al ...", así se
// distingue un problema de sincronización de uno de ejecución.
export async function maxUpdatedAt(
  table: string,
  db: "principal" | "cb" = "principal",
  col = "updated_at",
  filter?: { col: string; val: string },
): Promise<string | null> {
  // Cliente tipado con string dinámico → relajamos el tipo del builder.
  type LooseB = {
    select: (c: string) => LooseB;
    eq: (c: string, v: string) => LooseB;
    order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null; error: unknown }> };
  };
  const client = (db === "cb" ? getCbSupabase() : getServerSupabase()) as unknown as { from: (t: string) => LooseB };
  let q = client.from(table).select(col);
  if (filter) q = q.eq(filter.col, filter.val);
  const { data, error } = await q.order(col, { ascending: false }).limit(1);
  const v = !error && data?.length ? (data[0] as Record<string, unknown>)?.[col] : null;
  if (typeof v === "string") return v;
  // Tablas con RLS sin policy (solo service key: search_console_snapshot, seo_audit_snapshot, …): el
  // cliente con la sesión del usuario no ve filas → "sin fecha". Solo se lee la fecha máxima.
  return db === "principal" ? maxUpdatedAtService(table, col, filter) : null;
}

async function maxUpdatedAtService(table: string, col: string, filter?: { col: string; val: string }): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const f = filter ? `&${encodeURIComponent(filter.col)}=eq.${encodeURIComponent(filter.val)}` : "";
  try {
    const r = await fetch(`${url}/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(col)}${f}&order=${encodeURIComponent(col)}.desc.nullslast&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store",
    });
    if (!r.ok) return null;
    const rows = (await r.json()) as Record<string, unknown>[];
    const v = rows[0]?.[col];
    return typeof v === "string" ? v : null;
  } catch { return null; }
}

// Para dashboards que combinan varias fuentes: devuelve la fecha más reciente.
export async function maxUpdatedAtMany(
  sources: Array<{ table: string; db?: "principal" | "cb"; col?: string }>,
): Promise<string | null> {
  const dates = await Promise.all(sources.map((s) => maxUpdatedAt(s.table, s.db ?? "principal", s.col ?? "updated_at").catch(() => null)));
  const valid = dates.filter((d): d is string => !!d).sort();
  return valid.length ? valid[valid.length - 1]! : null;
}
