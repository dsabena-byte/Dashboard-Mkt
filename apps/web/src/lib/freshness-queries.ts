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
): Promise<string | null> {
  // Cliente tipado con string dinámico → relajamos el tipo del builder.
  const supabase = (db === "cb" ? getCbSupabase() : getServerSupabase()) as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null; error: unknown }> };
      };
    };
  };
  const { data, error } = await supabase.from(table).select(col).order(col, { ascending: false }).limit(1);
  if (error || !data || data.length === 0) return null;
  const v = data[0]?.[col];
  return typeof v === "string" ? v : null;
}

// Para dashboards que combinan varias fuentes: devuelve la fecha más reciente.
export async function maxUpdatedAtMany(
  sources: Array<{ table: string; db?: "principal" | "cb"; col?: string }>,
): Promise<string | null> {
  const dates = await Promise.all(sources.map((s) => maxUpdatedAt(s.table, s.db ?? "principal", s.col ?? "updated_at").catch(() => null)));
  const valid = dates.filter((d): d is string => !!d).sort();
  return valid.length ? valid[valid.length - 1]! : null;
}
