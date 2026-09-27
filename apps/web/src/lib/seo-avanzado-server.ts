import "server-only";
import { cache } from "react";
import { getSearchConsoleSnapshot } from "@/lib/search-console";
import { getSeoAudit, type SeoAuditEstado } from "@/lib/seo-audit";
import { calibrateCtrCurve, type CtrCurve } from "@/lib/ctr-curve";
import { analyzeScDeep, type ScDeep } from "@/lib/sc-deep";
import { analizarFuentesIa, type FuentesIa, type DominiosMarca } from "@/lib/llmo-fuentes";
import { evolucionKeywords, type KwEvolResumen } from "@/lib/seo-kw-evolucion";
import { saludDigital, type SaludDigital, type EsosResult } from "@/lib/marca-indices";
import { esosPorCategoria, obsDigital, llmoConIc, kwRowsConUniverso, CAT_LABEL, type ShareLite, type GfkLite, type LlmoLite, type IdxLite, type SocialLite, type LlmoCat } from "@/lib/seo-avanzado";
import { KEYWORD_UNIVERSE } from "@/lib/seo-keyword-universe";
import { TRACKED_DOMAINS } from "@/lib/competitive-config";
import { getTenant } from "@/lib/tenant/current";

// ============================================================================
// Lector ÚNICO de la capa SEO/GEO avanzada de Drean (portado de BIP lib/seo-avanzado-server.ts).
// Arma, a partir de lo YA persistido (snapshots de Search Console y de la auditoría, seo_llmo +
// seo_llmo_muestra, seo_rankings, vw_share_of_search, mercado_share, seo_index_history,
// social_posts), lo que usan /seo-search y las señales. Nunca llama APIs externas; nunca tira.
// Tablas chicas (≤ unos miles de filas), REST con service key. Memo por request (cache()).
// ============================================================================

export interface SeoAvanzado {
  curve: CtrCurve | null;
  scDeep: ScDeep | null;
  scSite: string | null;
  scImpresionesMes: number | null;
  audit: SeoAuditEstado;
  llmo: LlmoCat[];
  fuentes: FuentesIa[];
  muestrasDisponibles: boolean;
  kwEvol: KwEvolResumen | null;
  esos: { categoria: string; label: string; res: EsosResult }[];
  salud: SaludDigital | null;
  ownBrand: string;
}

async function rest<T>(query: string): Promise<{ ok: boolean; rows: T[] }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, rows: [] };
  try {
    const res = await fetch(`${url}/rest/v1/${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
    if (!res.ok) return { ok: false, rows: [] };
    return { ok: true, rows: (await res.json()) as T[] };
  } catch { return { ok: false, rows: [] }; }
}

export function dominiosDrean(): DominiosMarca {
  return {
    propio: TRACKED_DOMAINS.filter((d) => d.display === "Drean").map((d) => d.dominio),
    competidores: TRACKED_DOMAINS.filter((d) => d.tipo === "marca" && d.display !== "Drean").map((d) => d.dominio),
    retailers: TRACKED_DOMAINS.filter((d) => d.tipo !== "marca").map((d) => d.dominio),
  };
}

export const loadSeoAvanzado = cache(async (): Promise<SeoAvanzado> => {
  const t = getTenant();
  const ownBrand = t.ownBrand.label || "Drean";
  const now = new Date();
  const hoyYm = now.toISOString().slice(0, 7);
  const anio = now.getUTCFullYear();
  const desde28 = new Date(now.getTime() - 28 * 864e5).toISOString();
  const [sc, audit, share, gfk, llmo, idx, social, muestras, ranks] = await Promise.all([
    getSearchConsoleSnapshot().catch(() => null),
    getSeoAudit().catch(() => ({ status: "no_table" }) as SeoAuditEstado),
    rest<ShareLite>(`vw_share_of_search?mes=gte.${anio - 2}-01-01&select=categoria,marca,mes,share_pct&limit=10000`),
    rest<GfkLite>(`mercado_share?segmento=eq.Total&select=mes,categoria,segmento,marca,unit_share,agregacion&limit=5000`),
    rest<LlmoLite>(`seo_llmo?select=categoria,marca,mes,menciones,prompts,share_pct&limit=5000`),
    rest<IdxLite>(`seo_index_history?select=categoria,marca,mes,indice&limit=5000`),
    rest<SocialLite>(`social_posts?fecha=gte.${anio - 1}-01-01&select=marca,fecha,likes,comentarios&limit=10000`),
    rest<{ categoria: string; marcas: string[]; fuentes: string[] }>(`seo_llmo_muestra?fecha=gte.${desde28}&select=categoria,marcas,fuentes&order=id&limit=5000`),
    rest<{ fecha: string; categoria: string | null; keyword: string; posicion: number | null; url: string | null; search_volume: number | null }>(`seo_rankings?dominio=eq.drean.com.ar&select=fecha,categoria,keyword,posicion,url,search_volume&order=fecha.asc&limit=10000`),
  ]);

  const scData = sc?.status === "ok" && sc.data.ok ? sc.data : null;
  const curve = scData ? calibrateCtrCurve(scData.queries, { ownBrand: "drean" }) : null;
  const scDeep = scData ? analyzeScDeep(scData, { ownBrand: "drean", curve }) : null;
  const cerr = (scData?.monthly ?? []).filter((m) => m.dias >= 20);

  const socialLabels = Object.fromEntries(t.socialAccounts.map((a) => [a.key, a.label]));
  const obs = obsDigital({ share: share.rows, llmo: llmo.rows, idx: idx.rows, social: social.rows, socialLabels, hoyYm });
  const salud = obs.length ? saludDigital(obs, ownBrand) : null;

  const fuentes = Object.keys(CAT_LABEL).map((cat) => analizarFuentesIa(muestras.rows, cat, ownBrand, dominiosDrean())).filter((f) => f.respuestas > 0);
  const kwRows = kwRowsConUniverso(ranks.rows, KEYWORD_UNIVERSE, "drean.com.ar", ownBrand);
  const kwEvol = kwRows.length ? evolucionKeywords(kwRows) : null;

  return {
    curve, scDeep, scSite: scData?.site ?? null, scImpresionesMes: cerr[cerr.length - 1]?.impressions ?? null,
    audit,
    llmo: llmoConIc(llmo.rows, ownBrand),
    fuentes, muestrasDisponibles: muestras.ok,
    kwEvol: kwEvol && kwEvol.semanas >= 2 ? kwEvol : null,
    esos: esosPorCategoria(share.rows, gfk.rows, ownBrand, hoyYm),
    salud: salud?.own ? salud : null,
    ownBrand,
  };
});
