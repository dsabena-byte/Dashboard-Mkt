import "server-only";
import { sbAdmin } from "@/lib/supabase-admin";
import { getServerSupabase } from "@/lib/supabase-server";
import { allowedFromRows, isPathAllowed } from "@/lib/dashboard-access";
import { upgradeDashboard, sanitizeDashboard, type DashboardV2, type Dataset } from "@/lib/viz";

// ============================================================================
// "Mis tableros" (motor de planillas portado de BIP) — persistencia server-only.
// Single-tenant (Drean): tablas `tableros_datasets` (planillas) y `tableros` (config v2 de
// cada tablero, jsonb) — migración supabase/migrations/0109_tableros.sql. Acceso por REST con
// la service key (mismo patrón que /api/mapa-estrategico). FAIL-SAFE: si las tablas no
// existen, se lanza TablerosMissingError y las páginas muestran qué migración correr.
// El motor puro vive en lib/viz (client-safe).
// ============================================================================

export type { Dataset } from "@/lib/viz";

/** Filas de `tableros` que NO son tableros (config de otros módulos). */
export const RESERVED_SLUGS = new Set(["cfg-kantar"]);
export const MAX_DATASET_ROWS = 20_000;

export class TablerosMissingError extends Error {
  constructor() { super("Faltan las tablas de Mis tableros: correr la migración supabase/migrations/0109_tableros.sql en el SQL Editor de Supabase."); }
}

async function fail(res: Response): Promise<never> {
  const body = await res.text().catch(() => "");
  // PostgREST: tabla inexistente → 404 con code PGRST205 (o 42P01 "does not exist").
  if (res.status === 404 || /PGRST205|42P01|does not exist|Could not find the table/i.test(body)) throw new TablerosMissingError();
  throw new Error(`Supabase ${res.status}: ${body.slice(0, 300)}`);
}

async function get<T>(path: string): Promise<T> {
  const res = await sbAdmin(path, { method: "GET" });
  if (!res.ok) await fail(res);
  return (await res.json()) as T;
}

// ── Acceso ──────────────────────────────────────────────────────────────────
/**
 * El usuario logueado puede usar Mis tableros si no tiene restricción de dashboards o si
 * `/tableros` está entre sus permitidos (tabla dashboard_access). El middleware ya exige login.
 */
export async function canUseTableros(path = "/tableros"): Promise<boolean> {
  try {
    const supabase = getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase.from("dashboard_access").select("dashboard_path");
    return isPathAllowed(path, allowedFromRows(data as { dashboard_path: string }[] | null));
  } catch {
    return false;
  }
}

// ── Tableros ────────────────────────────────────────────────────────────────
interface TableroRow { slug: string; title: string | null; config: unknown; updated_at: string | null }

export async function getDashboardConfig(slug: string): Promise<DashboardV2 | null> {
  if (RESERVED_SLUGS.has(slug)) return null;
  const rows = await get<TableroRow[]>(`tableros?slug=eq.${encodeURIComponent(slug)}&select=slug,title,config,updated_at`);
  const r = rows[0];
  if (!r) return null;
  return upgradeDashboard(r.config ?? {}, { title: r.title ?? "", datasetId: null });
}

export async function saveDashboardConfig(slug: string, raw: unknown): Promise<void> {
  if (RESERVED_SLUGS.has(slug)) throw new Error("ese nombre está reservado");
  const clean = sanitizeDashboard(upgradeDashboard(raw));
  const res = await sbAdmin("tableros?on_conflict=slug", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ slug, title: clean.title, config: clean, updated_at: new Date().toISOString() }]),
  });
  if (!res.ok) await fail(res);
}

export interface DashboardListItem { slug: string; title: string; datasetId: string | null; widgets: number; updatedAt: string | null; custom: boolean }

export async function listDashboards(): Promise<DashboardListItem[]> {
  const rows = await get<TableroRow[]>("tableros?select=slug,title,config,updated_at&order=updated_at.desc");
  return rows.filter((d) => !RESERVED_SLUGS.has(d.slug)).map((d) => {
    const cfg = (d.config ?? {}) as { widgets?: unknown[]; datasetId?: string | null };
    return {
      slug: d.slug,
      title: d.title || d.slug,
      datasetId: typeof cfg.datasetId === "string" ? cfg.datasetId : null,
      widgets: Array.isArray(cfg.widgets) ? cfg.widgets.length : 0,
      updatedAt: d.updated_at,
      custom: true,
    };
  });
}

export async function renameDashboard(slug: string, title: string): Promise<void> {
  if (RESERVED_SLUGS.has(slug)) throw new Error("ese nombre está reservado");
  const rows = await get<TableroRow[]>(`tableros?slug=eq.${encodeURIComponent(slug)}&select=slug,title,config,updated_at`);
  const config = { ...((rows[0]?.config as Record<string, unknown>) ?? {}), title };
  const res = await sbAdmin(`tableros?slug=eq.${encodeURIComponent(slug)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ title, config, updated_at: new Date().toISOString() }) });
  if (!res.ok) await fail(res);
}

export async function deleteDashboard(slug: string): Promise<void> {
  if (RESERVED_SLUGS.has(slug)) throw new Error("ese nombre está reservado");
  const res = await sbAdmin(`tableros?slug=eq.${encodeURIComponent(slug)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  if (!res.ok) await fail(res);
}

/** Slug nuevo: t-<nombre>-<4 chars>. */
export function customSlug(title: string): string {
  const base = title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "tablero";
  return `t-${base}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── Config reservada (ej. Kantar por planilla) ──────────────────────────────
export async function getReservedConfig<T>(slug: string): Promise<{ config: T; updatedAt: string | null } | null> {
  const rows = await get<TableroRow[]>(`tableros?slug=eq.${encodeURIComponent(slug)}&select=slug,title,config,updated_at`);
  const r = rows[0];
  return r ? { config: r.config as T, updatedAt: r.updated_at } : null;
}
export async function saveReservedConfig(slug: string, title: string, config: unknown): Promise<void> {
  const res = await sbAdmin("tableros?on_conflict=slug", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ slug, title, config, updated_at: new Date().toISOString() }]),
  });
  if (!res.ok) await fail(res);
}
export async function deleteReservedConfig(slug: string): Promise<void> {
  const res = await sbAdmin(`tableros?slug=eq.${encodeURIComponent(slug)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  if (!res.ok) await fail(res);
}

// ── Planillas (datasets) ────────────────────────────────────────────────────
export interface DatasetListItem { id: string; name: string; row_count: number; columns?: string[]; source?: unknown; updated_at?: string | null }

export async function getDataset(id: string): Promise<Dataset | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await get<{ id: string; name: string; columns: string[] | null; rows: unknown[][] | null }[]>(`tableros_datasets?id=eq.${id}&select=id,name,columns,rows`);
  const d = rows[0];
  if (!d) return null;
  return { id: d.id, name: d.name, columns: (d.columns ?? []).map(String), rows: (d.rows ?? []) as unknown[][] };
}

export async function listDatasets(withColumns = false): Promise<DatasetListItem[]> {
  const sel = withColumns ? "id,name,row_count,columns,source,updated_at" : "id,name,row_count,source,updated_at";
  return get<DatasetListItem[]>(`tableros_datasets?select=${sel}&order=updated_at.desc`);
}

/** Todas las planillas que usa un tablero (principal, por widget y cruces). */
export async function getDatasetsFor(cfg: DashboardV2): Promise<Record<string, Dataset>> {
  const ids = new Set<string>();
  if (cfg.datasetId) ids.add(cfg.datasetId);
  for (const w of cfg.widgets) if (w.datasetId) ids.add(w.datasetId);
  for (const s of Object.values(cfg.datasets)) for (const b of s.blends ?? []) ids.add(b.datasetId);
  const out: Record<string, Dataset> = {};
  const list = await Promise.all([...ids].slice(0, 8).map((id) => getDataset(id).catch(() => null)));
  for (const d of list) if (d) out[d.id] = d;
  return out;
}

export async function insertDataset(d: { name: string; columns: string[]; rows: unknown[][]; source: Record<string, unknown> }): Promise<{ id: string }> {
  const res = await sbAdmin("tableros_datasets", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify([{ name: d.name.slice(0, 200), columns: d.columns, rows: d.rows, row_count: d.rows.length, source: d.source, updated_at: new Date().toISOString() }]),
  });
  if (!res.ok) await fail(res);
  const rows = (await res.json()) as { id: string }[];
  return { id: rows[0]!.id };
}

/** Quitar una planilla: si la usa un tablero (o la config de Kantar), no se borra. */
export async function removeDataset(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "id inválido" };
  const all = await get<TableroRow[]>("tableros?select=slug,title,config,updated_at");
  const uses = all.filter((d) => JSON.stringify(d.config ?? {}).includes(id));
  if (uses.length) {
    const names = uses.map((u) => (u.slug === "cfg-kantar" ? "Kantar por planilla" : u.title || u.slug)).join(", ");
    return { ok: false, error: `La usa: ${names}. Cambiale la planilla antes de quitarla.` };
  }
  const res = await sbAdmin(`tableros_datasets?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  if (!res.ok) await fail(res);
  return { ok: true };
}

// ── Parseo de archivos ──────────────────────────────────────────────────────
/** Primera hoja de un Excel/CSV → columnas (fila 1) + filas (hasta MAX_DATASET_ROWS). */
export async function parseSpreadsheet(buf: Buffer): Promise<{ columns: string[]; rows: unknown[][]; truncated: boolean }> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!ws) throw new Error("el archivo no tiene hojas");
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false });
  const columns = (aoa[0] ?? []).map((c) => String(c ?? ""));
  const body = aoa.slice(1);
  return { columns, rows: body.slice(0, MAX_DATASET_ROWS), truncated: body.length > MAX_DATASET_ROWS };
}
