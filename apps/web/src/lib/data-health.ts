// ============================================================================
// "Confianza en el dato" por tablero (portado de BIP, sep-2026; sin reconectar: Drean no tiene
// OAuth por cliente). Modelo PURO (client-safe): qué fuentes alimenta cada tablero y cómo se lee su
// frescura, con la MISMA regla que /monitoreo y /api/cron/health (estadoDe: ok ≤1,5× la cadencia ·
// atrasado ≤3× · crítico >3×). Lo dibuja components/data-health.tsx bajo el título del tablero.
// Solo fuentes con lectura barata (max de una columna indexada, ~0,5 s en paralelo y en Suspense):
// NO se usa web_traffic.created_at (~5 s) → GA4 se mide por ga4_monthly_users.
// Test: scripts/data-health.test.ts
// ============================================================================
import { estadoDe, type Estado } from "./monitoreo-config";

export interface FuenteDash {
  label: string;
  tabla: string;
  col: string;
  cadenciaH: number;
  db?: "principal" | "cb";
  filter?: { col: string; val: string };
}

const F = {
  meta: { label: "Meta Ads", tabla: "meta_paid_creatives", col: "fetched_at", cadenciaH: 24 },
  dv360: { label: "DV360", tabla: "dv360_creatives", col: "updated_at", cadenciaH: 24 },
  gads: { label: "Google Ads", tabla: "ga4_google_ads_daily", col: "updated_at", cadenciaH: 24 },
  omd: { label: "OMD (carga mensual)", tabla: "pauta_performance", col: "updated_at", cadenciaH: 720 },
  ga4: { label: "GA4", tabla: "ga4_monthly_users", col: "updated_at", cadenciaH: 24 },
  ig: { label: "Instagram", tabla: "meta_posts", col: "updated_at", cadenciaH: 12, filter: { col: "platform", val: "instagram" } },
  fb: { label: "Facebook", tabla: "meta_posts", col: "updated_at", cadenciaH: 24, filter: { col: "platform", val: "facebook" } },
  competencia: { label: "Competencia (redes)", tabla: "social_posts", col: "updated_at", cadenciaH: 168 },
  trade: { label: "Trade (CB + Floor Share)", tabla: "trade_monthly", col: "updated_at", cadenciaH: 24 },
  bgt: { label: "BGT", tabla: "bgt_marketing", col: "updated_at", cadenciaH: 12 },
  gfk: { label: "GfK", tabla: "mercado_share", col: "updated_at", cadenciaH: 2160 },
  demanda: { label: "Demanda (DataForSEO)", tabla: "search_volume", col: "fetched_at", cadenciaH: 168 },
  serp: { label: "Posición SEO", tabla: "seo_rankings", col: "fetched_at", cadenciaH: 720 },
  llmo: { label: "Visibilidad en IA", tabla: "seo_llmo", col: "updated_at", cadenciaH: 168 },
  sc: { label: "Search Console", tabla: "search_console_snapshot", col: "updated_at", cadenciaH: 168 },
  ugc: { label: "UGC (Meta Ads)", tabla: "meta_paid_creatives", col: "fetched_at", cadenciaH: 24, filter: { col: "categoria", val: "UGC" } },
  ugcCom: { label: "Comentarios UGC", tabla: "ugc_comments", col: "fetched_at", cadenciaH: 24 },
} satisfies Record<string, FuenteDash>;

/** Fuentes por tablero (slug de ruta). Sin entrada = el tablero no muestra la línea. */
export const DASH_FUENTES: Record<string, FuenteDash[]> = {
  overview: [F.meta, F.dv360, F.ga4, F.ig, F.trade],
  performance: [F.meta, F.dv360, F.gads, F.omd],
  "performance-conversion": [F.gads],
  web: [F.ga4, F.gads],
  redes: [F.ig, F.fb, F.competencia],
  "seo-search": [F.demanda, F.serp, F.llmo, F.sc],
  funnel: [F.bgt],
  mercado: [F.gfk],
  "salud-marca": [F.gfk],
  influencia: [F.ugc, F.ugcCom],
};

export interface ItemSalud { label: string; estado: Estado; ageH: number | null; date: string | null; cadenciaH: number }
export interface SaludDash { items: ItemSalud[]; peor: Estado; resumen: string }

const ORDEN: Record<Estado, number> = { critico: 0, atrasado: 1, sindato: 2, ok: 3 };

export function fmtEdad(ageH: number | null): string {
  if (ageH == null) return "sin fecha";
  if (ageH < 1) return "hace <1 h";
  if (ageH < 48) return `hace ${Math.round(ageH)} h`;
  return `hace ${Math.round(ageH / 24)} d`;
}

/** Estado de cada fuente y el peor (para el tono de la línea). `dates` en el mismo orden que `fuentes`. */
export function buildSaludDash(fuentes: FuenteDash[], dates: (string | null)[], nowMs: number): SaludDash {
  const items = fuentes.map((f, i) => {
    const date = dates[i] ?? null;
    const { estado, ageH } = estadoDe(date, f.cadenciaH, nowMs);
    return { label: f.label, estado, ageH, date, cadenciaH: f.cadenciaH };
  });
  const peor = items.reduce<Estado>((p, it) => (ORDEN[it.estado] < ORDEN[p] ? it.estado : p), "ok");
  const malos = items.filter((it) => it.estado === "critico" || it.estado === "atrasado");
  const resumen = !items.length ? ""
    : !malos.length ? "Datos al día"
      : `${malos.map((m) => m.label).join(", ")} ${malos.length === 1 ? "está" : "están"} ${peor === "critico" ? "desactualizado" : "atrasado"}${malos.length === 1 ? "" : "s"}`;
  return { items, peor, resumen };
}
