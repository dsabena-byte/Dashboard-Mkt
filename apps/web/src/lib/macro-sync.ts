import "server-only";
import { mergeIndices, parseArgentinaDatos, parseBcraCotizaciones, promedioMensual, type IndiceMes } from "./moneda";

// ============================================================================
// Sync del dólar → tabla `indices_macro` (mes, usd_oficial, usd_mep). Portado de BIP (sep-2026).
// Ya NO baja IPC (28-sep-2026: sin ajuste por inflación en ningún cálculo; la columna `ipc` de la
// tabla queda sin uso y no se toca). Fuentes públicas y gratuitas (sin API key):
//  · Dólar oficial: API del BCRA "Estadísticas Cambiarias v1.0" (/Cotizaciones/USD, referencia
//    diaria) → PROMEDIO del mes. Fallback: argentinadatos.com (oficial, venta).
//  · Dólar MEP (opcional): argentinadatos.com /cotizaciones/dolares/bolsa (promedio del mes).
// Upsert por mes con UN LOTE POR COLUMNA → una fuente caída NO pisa lo que otra ya cargó.
// Escribe por REST con la service key (patrón del repo). Nunca tira: devuelve el detalle por fuente.
// ============================================================================

const BCRA_API = "https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD";
const ADATOS = "https://api.argentinadatos.com/v1/cotizaciones/dolares";

async function getJson(url: string, ms = 30_000): Promise<unknown> {
  const r = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(ms), cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${new URL(url).host}`);
  return r.json();
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Dólar oficial diario del BCRA en tramos de ~1 año (el endpoint pagina por rango de fechas). */
export async function fetchUsdOficialBcra(desde: string, hasta: string): Promise<{ fecha: string; valor: number }[]> {
  const out: { fecha: string; valor: number }[] = [];
  let a = new Date(`${desde}T00:00:00Z`);
  const fin = new Date(`${hasta}T00:00:00Z`);
  while (a <= fin) {
    const b = new Date(Math.min(fin.getTime(), a.getTime() + 360 * 86_400_000));
    out.push(...parseBcraCotizaciones(await getJson(`${BCRA_API}?fechadesde=${ymd(a)}&fechahasta=${ymd(b)}&limit=1000`)));
    a = new Date(b.getTime() + 86_400_000);
  }
  return out;
}

export interface MacroSyncResult { ok: boolean; filas: number; oficial: { meses: number; fuente?: string; error?: string }; mep: { meses: number; error?: string }; ultimo: { usd: string | null }; error?: string }

export async function runMacroSync(opts: { desde?: string } = {}): Promise<MacroSyncResult> {
  const hoy = new Date();
  // Por defecto: últimos ~25 meses (promedio del mes en curso incluido). Backfill: ?desde=2023-01-01.
  const desde = opts.desde ?? ymd(new Date(Date.UTC(hoy.getUTCFullYear() - 2, hoy.getUTCMonth() - 1, 1)));
  const res: MacroSyncResult = { ok: false, filas: 0, oficial: { meses: 0 }, mep: { meses: 0 }, ultimo: { usd: null } };

  let oficial: { mes: string; valor: number }[] = [];
  try { oficial = promedioMensual(await fetchUsdOficialBcra(desde, ymd(hoy))); if (oficial.length) res.oficial.fuente = "BCRA"; }
  catch (e) { res.oficial.error = `BCRA: ${(e as Error).message}`; }
  if (!oficial.length) {
    try {
      oficial = promedioMensual(parseArgentinaDatos(await getJson(`${ADATOS}/oficial`)).filter((d) => d.fecha >= desde));
      if (oficial.length) res.oficial.fuente = "argentinadatos (oficial)";
    } catch (e) { res.oficial.error = `${res.oficial.error ?? ""} · argentinadatos: ${(e as Error).message}`.trim(); }
  }
  res.oficial.meses = oficial.length;

  let mep: { mes: string; valor: number }[] = [];
  try { mep = promedioMensual(parseArgentinaDatos(await getJson(`${ADATOS}/bolsa`)).filter((d) => d.fecha >= desde)); res.mep.meses = mep.length; }
  catch (e) { res.mep.error = (e as Error).message; }

  res.ultimo = { usd: oficial.at(-1)?.mes ?? null };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { res.error = "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"; return res; }
  const now = new Date().toISOString();
  // Un lote por columna → una fuente vacía nunca pisa con null lo que otra cargó.
  const lotes: [keyof IndiceMes, IndiceMes[]][] = [
    ["usd_oficial", mergeIndices(oficial, [])],
    ["usd_mep", mergeIndices([], mep)],
  ];
  try {
    for (const [col, rows] of lotes) {
      if (!rows.length) continue;
      const payload = rows.map((r) => ({ mes: `${r.mes}-01`, [col]: r[col], updated_at: now }));
      const r = await fetch(`${url}/rest/v1/indices_macro?on_conflict=mes`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const txt = await r.text();
        throw new Error(/PGRST205|does not exist/.test(txt) ? "Falta la tabla indices_macro: correr la migración 0110_indices_macro.sql" : `indices_macro (${col}): ${r.status} ${txt.slice(0, 200)}`);
      }
      res.filas += rows.length;
    }
  } catch (e) { res.error = (e as Error).message; return res; }
  res.ok = res.filas > 0;
  if (!res.ok) res.error = "Ninguna fuente devolvió datos (¿red bloqueada o API caída?). No se escribió nada.";
  return res;
}
