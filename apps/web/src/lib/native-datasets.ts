import "server-only";
// ============================================================================
// Datasets nativos de solo lectura ("nat:*") para Mis tableros / "Armame el tablero" / umbrales de
// alertas. Leen SOLO fuentes baratas o precalculadas (regla de PERF de CLAUDE.md):
//  · Plan de Medios: las mismas queries que /performance (tablas chicas) + buildPautaMediosMensual
//    (año actual + anterior), igual que el Simulador.
//  · Web: vw_drean_web_monthly + ga4_monthly_users + vw_drean_web_monthly_by_channel (mensuales).
//  · Redes: meta_posts de Instagram (año actual + anterior, solo columnas numéricas).
//  · Seguimiento: getSeguimientoKpis (React cache por request).
// Acceso: cada dataset se ofrece solo si el usuario puede ver el dashboard de origen (dashboard_access).
// ============================================================================
import { getPautaPerformance } from "@/lib/pauta-queries";
import { getMetaPaidCreatives } from "@/lib/meta-paid-queries";
import { getDv360Creatives, getDv360Reach } from "@/lib/dv360-queries";
import { getGoogleAdsOmd } from "@/lib/google-ads-omd-queries";
import { getFxRates } from "@/lib/fx-queries";
import { buildPautaMediosMensual } from "@/lib/pauta-medios-model";
import { getSeguimientoKpis } from "@/lib/objetivos-kpis";
import { isPathAllowed } from "@/lib/dashboard-access";
import type { Dataset } from "@/lib/viz";
import {
  NATIVE_DEFS, isNativeId, nativeDef, pautaMensual, pautaPorMedio, redesIgMensual, seguimientoTabla, webMensual,
  type IgPostLike, type NativeDef, type PautaYear, type WebChanLike, type WebMonthLike, type WebUsersLike,
} from "@/lib/native-datasets-core";

export { isNativeId } from "@/lib/native-datasets-core";

const safe = async <T>(p: Promise<T>, fb: T): Promise<T> => { try { return await p; } catch { return fb; } };
const isPmax = (canal: string) => /pmax|performance ?max/i.test(canal);

async function rest<T>(query: string): Promise<T[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(`${url}/rest/v1/${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
    return res.ok ? ((await res.json()) as T[]) : [];
  } catch { return []; }
}

/** Fuentes nativas que el usuario puede ver (allowed = dashboard_access; null = sin restricción). */
export function nativeDefsFor(allowed: string[] | null): NativeDef[] {
  return NATIVE_DEFS.filter((d) => isPathAllowed(d.dash, allowed));
}

/** Lista para el selector de fuentes (sin leer datos: row_count -1 = "datos del dashboard"). */
export function listNativeDatasets(allowed: string[] | null): { id: string; name: string; row_count: number; native: true; descripcion: string }[] {
  return nativeDefsFor(allowed).map((d) => ({ id: d.id, name: d.name, row_count: -1, native: true as const, descripcion: d.descripcion }));
}

async function pautaYears(now: Date): Promise<PautaYear[]> {
  const [pauta, metaPaid, dv360, dv360Reach, gads, fxRates] = await Promise.all([
    safe(getPautaPerformance(true), []), // Pauta Mkt incluye UGC
    safe(getMetaPaidCreatives(true), []),
    safe(getDv360Creatives(), []),
    safe(getDv360Reach(), []),
    safe(getGoogleAdsOmd(), []),
    safe(getFxRates(), {} as Record<string, number>),
  ]);
  const anio = now.getUTCFullYear();
  const base = { pauta, metaPaid, dv360, dv360Reach, googleAdsOmd: gads.filter((r) => !isPmax(r.canal)), fxRates };
  return [
    { anio: anio - 1, meses: buildPautaMediosMensual({ ...base, anio: anio - 1, currentMonth: 13 }) },
    { anio, meses: buildPautaMediosMensual({ ...base, anio, currentMonth: now.getUTCMonth() + 1 }) },
  ];
}

/**
 * Dataset nativo por id (null = id desconocido o sin acceso). Filas vacías = sin datos todavía.
 * `allowed` = dashboards permitidos del usuario (null = sin restricción, p. ej. cron o link compartido).
 */
export async function getNativeDataset(id: string, allowed: string[] | null = null, now = new Date()): Promise<Dataset | null> {
  if (!isNativeId(id)) return null;
  const def = nativeDef(id);
  if (!def || !isPathAllowed(def.dash, allowed)) return null;
  const y = now.getUTCFullYear();
  try {
    switch (def.key) {
      case "pauta": return pautaMensual(await pautaYears(now));
      case "pauta-medios": return pautaPorMedio(await pautaYears(now));
      case "web": {
        const [monthly, users, chan] = await Promise.all([
          rest<WebMonthLike>(`vw_drean_web_monthly?mes=gte.${y - 1}-01-01&select=mes,sesiones,pageviews,avg_session_duration&order=mes`),
          rest<WebUsersLike>(`ga4_monthly_users?mes=gte.${y - 1}-01-01&select=mes,total_users&order=mes`),
          rest<WebChanLike>(`vw_drean_web_monthly_by_channel?mes=gte.${y - 1}-01-01&select=mes,conversiones`),
        ]);
        return webMensual(monthly, users, chan);
      }
      case "redes": {
        const posts = await rest<IgPostLike>(`meta_posts?platform=eq.instagram&fecha_post=gte.${y - 1}-01-01T00:00:00Z&select=fecha_post,reach,engagement,reactions,clicks,media_type&order=fecha_post&limit=10000`);
        return redesIgMensual(posts);
      }
      case "seguimiento": {
        const kpis = await safe(getSeguimientoKpis(y, false), []);
        return seguimientoTabla(y, kpis);
      }
    }
  } catch {
    return { id: def.id, name: def.name, columns: [], rows: [] };
  }
  return null;
}
