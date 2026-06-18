// Tipos + agregaciones puras de la pauta de CONVERSIÓN (parte baja del funnel).
// Sin "server-only" → usable desde el client component. Los queries a Supabase
// viven en pauta-conversion-queries.ts.
//
// Fuente: GA4 (campañas inhouse_*, 100% Google Ads).
//   - Volumen / engagement: web_traffic (sesiones, usuarios, rebote, pageviews)
//   - Conversión: ga4_purchases_daily (transacciones, ingresos)
//   - Inversión: ga4_ads_cost_daily (advertiserAdCost → costo, clics, impresiones)

export interface ConversionDailyRow {
  fecha: string;         // YYYY-MM-DD
  campaign: string;      // utm_campaign (empieza con "inhouse")
  sesiones: number;
  usuarios: number;      // usuarios activos
  usuarios_nuevos: number;
  bounce_rate: number | null; // 0..1, ponderado por sesiones del día/campaña
  pageviews: number;
  transacciones: number;
  ingresos: number;      // revenue (≠ inversión)
  costo: number;         // inversión (advertiserAdCost)
  ad_clicks: number;
  ad_impresiones: number;
}

// ---- Helpers de display de campañas ----------------------------------------

const MES_NOMBRES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// "2026-06-12" → "2026-06"
export function isoToMonthKey(fecha: string): string {
  return fecha.slice(0, 7);
}
// "2026-06" → "Junio 2026"
export function monthKeyToLabel(key: string): string {
  const [y, m] = key.split("-");
  const idx = Number(m ?? "1") - 1;
  return `${MES_NOMBRES[idx] ?? m} ${y}`;
}

// Nombre legible: saca el prefijo "inhouse_" y deja el resto.
export function cleanCampaign(name: string): string {
  return name.replace(/^inhouse[_-]?/i, "") || name;
}

// Clasifica la campaña por TIPO de red de Google Ads a partir del nombre.
export function campaignTipo(name: string): string {
  const n = name.toLowerCase();
  if (/\b(pmax|performance[_-]?max|p[_-]?max)\b/.test(n)) return "Performance Max";
  if (/\bshop(ping)?\b/.test(n)) return "Shopping";
  if (/\b(dem(and)?[_-]?gen|dgen|discovery)\b/.test(n)) return "Demand Gen";
  if (/\b(video|yt|youtube)\b/.test(n)) return "Video";
  if (/\b(display|gdn)\b/.test(n)) return "Display";
  if (/\b(search|se|sem|brand|nonbrand|generic)\b/.test(n)) return "Search";
  return "Otras";
}

// Etapa del lower funnel a partir del nombre (lower/mid/upper/top).
export function campaignEtapa(name: string): string {
  const n = name.toLowerCase();
  if (/\blower\b/.test(n)) return "Lower";
  if (/\bmid(dle)?\b/.test(n)) return "Mid";
  if (/\b(upper|top)\b/.test(n)) return "Upper";
  return "—";
}

// ---- Totales + KPIs derivados ----------------------------------------------

export interface ConversionKpis {
  sesiones: number;
  usuarios: number;
  usuarios_nuevos: number;
  pageviews: number;
  transacciones: number;
  ingresos: number;
  costo: number;
  ad_clicks: number;
  ad_impresiones: number;
  bounce_rate: number | null;  // 0..1 ponderado por sesiones
  // derivados
  tasa_conversion: number | null; // transacciones / sesiones
  ticket_promedio: number | null; // ingresos / transacciones
  cpa: number | null;             // inversión / transacciones (= CAC de compra)
  cpc: number | null;             // inversión / clics de ads
  roas: number | null;            // ingresos / inversión
  hasCosto: boolean;
}

function rowsToKpis(rows: ConversionDailyRow[]): ConversionKpis {
  let sesiones = 0, usuarios = 0, usuarios_nuevos = 0, pageviews = 0;
  let transacciones = 0, ingresos = 0, costo = 0, ad_clicks = 0, ad_impresiones = 0;
  let bounceNum = 0, bounceDen = 0;
  for (const r of rows) {
    sesiones += r.sesiones;
    usuarios += r.usuarios;
    usuarios_nuevos += r.usuarios_nuevos;
    pageviews += r.pageviews;
    transacciones += r.transacciones;
    ingresos += r.ingresos;
    costo += r.costo;
    ad_clicks += r.ad_clicks;
    ad_impresiones += r.ad_impresiones;
    if (r.bounce_rate != null && r.sesiones > 0) {
      bounceNum += r.bounce_rate * r.sesiones;
      bounceDen += r.sesiones;
    }
  }
  const hasCosto = costo > 0;
  return {
    sesiones, usuarios, usuarios_nuevos, pageviews,
    transacciones, ingresos, costo, ad_clicks, ad_impresiones,
    bounce_rate: bounceDen > 0 ? bounceNum / bounceDen : null,
    tasa_conversion: sesiones > 0 ? transacciones / sesiones : null,
    ticket_promedio: transacciones > 0 ? ingresos / transacciones : null,
    cpa: hasCosto && transacciones > 0 ? costo / transacciones : null,
    cpc: hasCosto && ad_clicks > 0 ? costo / ad_clicks : null,
    roas: hasCosto && ingresos > 0 ? ingresos / costo : null,
    hasCosto,
  };
}

export function aggregateConversion(rows: ConversionDailyRow[]): ConversionKpis {
  return rowsToKpis(rows);
}

// ---- Por campaña ------------------------------------------------------------

export interface CampaignAggregate extends ConversionKpis {
  campaign: string;       // raw
  nombre: string;         // limpio
  tipo: string;
  etapa: string;
}

export function aggregateByCampaign(rows: ConversionDailyRow[]): CampaignAggregate[] {
  const groups = new Map<string, ConversionDailyRow[]>();
  for (const r of rows) {
    const g = groups.get(r.campaign);
    if (g) g.push(r);
    else groups.set(r.campaign, [r]);
  }
  return [...groups.entries()]
    .map(([campaign, rs]) => ({
      campaign,
      nombre: cleanCampaign(campaign),
      tipo: campaignTipo(campaign),
      etapa: campaignEtapa(campaign),
      ...rowsToKpis(rs),
    }))
    .sort((a, b) => (b.costo - a.costo) || (b.sesiones - a.sesiones));
}

// ---- Por tipo de campaña ----------------------------------------------------

export interface TipoAggregate extends ConversionKpis {
  tipo: string;
}

export function aggregateByTipo(rows: ConversionDailyRow[]): TipoAggregate[] {
  const groups = new Map<string, ConversionDailyRow[]>();
  for (const r of rows) {
    const tipo = campaignTipo(r.campaign);
    const g = groups.get(tipo);
    if (g) g.push(r);
    else groups.set(tipo, [r]);
  }
  return [...groups.entries()]
    .map(([tipo, rs]) => ({ tipo, ...rowsToKpis(rs) }))
    .sort((a, b) => (b.costo - a.costo) || (b.sesiones - a.sesiones));
}

// ---- Evolución mensual ------------------------------------------------------

export interface MonthAggregate {
  mesKey: string;   // "2026-06"
  mesLabel: string; // "Junio 2026"
  sesiones: number;
  transacciones: number;
  ingresos: number;
  costo: number;
  tasa_conversion: number | null;
  roas: number | null;
}

export function aggregateByMonth(rows: ConversionDailyRow[]): MonthAggregate[] {
  const groups = new Map<string, ConversionDailyRow[]>();
  for (const r of rows) {
    const key = isoToMonthKey(r.fecha);
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }
  return [...groups.entries()]
    .map(([mesKey, rs]) => {
      const k = rowsToKpis(rs);
      return {
        mesKey,
        mesLabel: monthKeyToLabel(mesKey),
        sesiones: k.sesiones,
        transacciones: k.transacciones,
        ingresos: k.ingresos,
        costo: k.costo,
        tasa_conversion: k.tasa_conversion,
        roas: k.roas,
      };
    })
    .sort((a, b) => a.mesKey.localeCompare(b.mesKey));
}

// Lista de meses presentes (claves), ordenada ascendente.
export function monthKeys(rows: ConversionDailyRow[]): string[] {
  return [...new Set(rows.map((r) => isoToMonthKey(r.fecha)))].sort();
}
