// Quick wins de WEB (estado del arte, sep-2026): embudo de ecommerce, calidad del dato de GA4,
// tráfico que llega desde asistentes de IA y landings que perdieron tráfico. PURO y client-safe
// (sin server-only, sin red): recibe los reportes GA4 ya leídos (snapshot del cron web-calidad) → lo
// usan el tablero /web, las señales (lib/signals/web.ts) y los tests. Portado de BIP (sep-2026).
// Drean: los reportes GA4 los trae el cron /api/cron/web-calidad (propiedad fija de drean.com.ar) y se
// guardan en web_calidad_snapshot (migración 0117). Mismo formato que la Data API de GA4.
export type Ga4Report = {
  rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[];
  rowCount?: number;
  dimensionHeaders?: { name: string }[];
  metadata?: {
    currencyCode?: string; timeZone?: string;
    samplingMetadatas?: { samplesReadCount?: string; samplingSpaceSize?: string }[];
    subjectToThresholding?: boolean;
    dataLossFromOtherRow?: boolean;
  };
};
/** Reportes que usa la capa de calidad (subconjunto de los de BIP). */
export interface WebReports {
  /** Landings del período actual (landingPage × sessions, screenPageViews, keyEvents). */
  landing: Ga4Report;
  /** Canales del período actual (sessionDefaultChannelGroup × totalUsers, sessions, screenPageViews, keyEvents). */
  chan: Ga4Report;
  /** Eventos de ecommerce × dispositivo, cur/prev. */
  events?: Ga4Report;
  /** Sesiones desde asistentes de IA (sessionSource), cur/prev. */
  aiRef?: Ga4Report;
  /** Landings del período anterior. */
  landingPrev?: Ga4Report;
}

/** Eventos que pide el reporte `events` (embudo + chequeo de tracking). */
export const GA4_FUNNEL_EVENTS = ["view_item_list", "view_item", "add_to_cart", "begin_checkout", "add_payment_info", "purchase", "generate_lead"] as const;
/** Fuentes de sesión de asistentes de IA (RE2, sin mayúsculas). */
export const AI_SOURCE_REGEX = "chatgpt|openai|perplexity|gemini\\.google|bard\\.google|copilot|claude\\.ai|deepseek|meta\\.ai|you\\.com|poe\\.com|mistral|grok";

const num = (s?: string) => { const v = Number(s || 0); return Number.isFinite(v) ? v : 0; };
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);

// ── Rangos "cur" / "prev" ─────────────────────────────────────────────────────
// Con dos dateRanges con nombre GA4 agrega la dimensión "dateRange". Se ubica por el header; si el
// header no está (snapshot recortado) se reconoce por el valor. Sin dimensión → todo es "cur".
export interface RangedRow { range: "cur" | "prev"; dims: string[]; mets: number[] }
export function splitRanges(r: Ga4Report | undefined | null): RangedRow[] {
  const heads = (r?.dimensionHeaders ?? []).map((h) => h.name);
  const hIdx = heads.indexOf("dateRange");
  return (r?.rows ?? []).map((row) => {
    const vals = row.dimensionValues.map((d) => d.value);
    let idx = hIdx;
    if (idx < 0) idx = vals.findIndex((v) => v === "cur" || v === "prev" || v === "date_range_0" || v === "date_range_1");
    const rv = idx >= 0 ? vals[idx] : "cur";
    return { range: rv === "prev" || rv === "date_range_1" ? "prev" : "cur", dims: vals.filter((_, i) => i !== idx), mets: row.metricValues.map((m) => num(m.value)) };
  });
}

// ── Embudo de ecommerce ──────────────────────────────────────────────────────
export const FUNNEL_STEPS = [
  { key: "view_item", label: "Vio un producto" },
  { key: "add_to_cart", label: "Agregó al carrito" },
  { key: "begin_checkout", label: "Inició el checkout" },
  { key: "purchase", label: "Compró" },
] as const;
export type FunnelKey = (typeof FUNNEL_STEPS)[number]["key"];

export interface FunnelStep {
  key: FunnelKey; label: string;
  usuarios: number; usuariosPrev: number; eventos: number;
  /** % de usuarios que pasan del paso anterior a este (null en el primero o sin base). */
  tasa: number | null; tasaPrev: number | null;
}
export interface EcomFunnel {
  steps: FunnelStep[];
  /** Conversión punta a punta (compró ÷ vio producto). */
  total: number | null; totalPrev: number | null;
  porDispositivo: { device: string; usuarios: number[]; total: number | null }[];
  /** Paso que más empeoró vs el período anterior (en puntos), con compras perdidas estimadas. */
  mayorCaida: { key: FunnelKey; label: string; tasa: number; tasaPrev: number; deltaPp: number; comprasPerdidas: number } | null;
  /** Hay algún paso sin datos entre dos pasos con datos (tracking incompleto). */
  pasosFaltantes: FunnelKey[];
}

/** Totales por evento (usuarios sumados por dispositivo ≈ usuarios; eventos exactos). */
export function eventTotals(r: WebReports): Record<string, { usuarios: number; usuariosPrev: number; eventos: number; eventosPrev: number }> {
  const out: Record<string, { usuarios: number; usuariosPrev: number; eventos: number; eventosPrev: number }> = {};
  for (const x of splitRanges(r.events)) {
    const ev = x.dims[0] ?? "";
    const e = out[ev] ?? (out[ev] = { usuarios: 0, usuariosPrev: 0, eventos: 0, eventosPrev: 0 });
    if (x.range === "cur") { e.eventos += x.mets[0] ?? 0; e.usuarios += x.mets[1] ?? 0; }
    else { e.eventosPrev += x.mets[0] ?? 0; e.usuariosPrev += x.mets[1] ?? 0; }
  }
  return out;
}

export function ecomFunnel(r: WebReports): EcomFunnel | null {
  const ev = eventTotals(r);
  const u = (k: string) => ev[k]?.usuarios ?? 0;
  if (!FUNNEL_STEPS.some((s) => u(s.key) > 0)) return null;
  const steps: FunnelStep[] = FUNNEL_STEPS.map((s, i) => {
    const cur = ev[s.key] ?? { usuarios: 0, usuariosPrev: 0, eventos: 0, eventosPrev: 0 };
    const prevStep = i > 0 ? ev[FUNNEL_STEPS[i - 1]!.key] : undefined;
    return {
      key: s.key, label: s.label, usuarios: cur.usuarios, usuariosPrev: cur.usuariosPrev, eventos: cur.eventos,
      tasa: i > 0 && prevStep && prevStep.usuarios > 0 && cur.usuarios > 0 ? Math.min(100, (cur.usuarios / prevStep.usuarios) * 100) : null,
      tasaPrev: i > 0 && prevStep && prevStep.usuariosPrev > 0 && cur.usuariosPrev > 0 ? Math.min(100, (cur.usuariosPrev / prevStep.usuariosPrev) * 100) : null,
    };
  });
  const first = steps[0], last = steps[steps.length - 1];
  const total = first!.usuarios > 0 && last!.usuarios > 0 ? (last!.usuarios / first!.usuarios) * 100 : null;
  const totalPrev = first!.usuariosPrev > 0 && last!.usuariosPrev > 0 ? (last!.usuariosPrev / first!.usuariosPrev) * 100 : null;

  // Por dispositivo (solo período actual).
  const byDev = new Map<string, Record<string, number>>();
  for (const x of splitRanges(r.events)) {
    if (x.range !== "cur") continue;
    const d = x.dims[1] || "otros";
    const m = byDev.get(d) ?? {};
    const ev0 = x.dims[0] ?? "";
    m[ev0] = (m[ev0] ?? 0) + (x.mets[1] ?? 0);
    byDev.set(d, m);
  }
  const porDispositivo = [...byDev.entries()].map(([device, m]) => {
    const us = FUNNEL_STEPS.map((s) => m[s.key] ?? 0);
    return { device, usuarios: us, total: us[0]! > 0 && us[3]! > 0 ? (us[3]! / us[0]!) * 100 : null };
  }).filter((d) => d.usuarios.some((v) => v > 0)).sort((a, b) => b.usuarios[0]! - a.usuarios[0]!);

  // Pasos faltantes: un paso en 0 con un paso anterior y uno posterior con datos.
  const pasosFaltantes = steps.filter((s, i) => s.usuarios === 0 && steps.slice(0, i).some((x) => x.usuarios > 0) && steps.slice(i + 1).some((x) => x.usuarios > 0)).map((s) => s.key);

  // Mayor caída: paso con peor Δ (pp) vs el período anterior, con base previa suficiente (≥ 50 usuarios).
  let mayorCaida: EcomFunnel["mayorCaida"] = null;
  for (let i = 1; i < steps.length; i++) {
    const s = steps[i], base = steps[i - 1];
    if (s!.tasa == null || s!.tasaPrev == null || base!.usuariosPrev < 50) continue;
    const d = s!.tasa - s!.tasaPrev;
    if (d >= 0 || (mayorCaida && d >= mayorCaida.deltaPp)) continue;
    // Compras perdidas = usuarios del paso anterior × (tasa previa − actual) × conversión actual del resto del embudo.
    const downstream = s!.usuarios > 0 ? last!.usuarios / s!.usuarios : 0;
    const perdidas = base!.usuarios * ((s!.tasaPrev - s!.tasa) / 100) * (s!.key === "purchase" ? 1 : downstream);
    mayorCaida = { key: s!.key, label: s!.label, tasa: s!.tasa, tasaPrev: s!.tasaPrev, deltaPp: d, comprasPerdidas: Math.max(0, perdidas) };
  }
  return { steps, total, totalPrev, porDispositivo, mayorCaida, pasosFaltantes };
}

// ── Tráfico desde asistentes de IA ───────────────────────────────────────────
const AI_NAMES: [RegExp, string][] = [
  [/chatgpt|openai/i, "ChatGPT"], [/perplexity/i, "Perplexity"], [/gemini|bard/i, "Gemini"], [/copilot/i, "Copilot"],
  [/claude/i, "Claude"], [/deepseek/i, "DeepSeek"], [/meta\.ai/i, "Meta AI"], [/you\.com/i, "You.com"], [/poe\.com/i, "Poe"],
  [/mistral/i, "Mistral"], [/grok/i, "Grok"],
];
export function asistenteDe(source: string): string | null {
  for (const [re, n] of AI_NAMES) if (re.test(source)) return n;
  return null;
}
export interface AiTraffic {
  sesiones: number; sesionesPrev: number; delta: number | null;
  /** % de las sesiones del sitio. */
  share: number;
  eventosClave: number; transacciones: number;
  /** Conversión (eventos clave o compras ÷ sesiones) de la IA vs el sitio. */
  conv: number | null; convSitio: number | null; engagement: number | null;
  porAsistente: { asistente: string; sesiones: number; sesionesPrev: number; conv: number | null }[];
  ecommerce: boolean;
}
export function aiTraffic(r: WebReports, sitio: { sessions: number; ke: number; tx: number }): AiTraffic | null {
  const rows = splitRanges(r.aiRef);
  const ecommerce = sitio.tx > 0;
  const m = new Map<string, { s: number; sp: number; eng: number; ke: number; tx: number }>();
  for (const x of rows) {
    const a = asistenteDe(x.dims[0] ?? "");
    if (!a) continue;
    const e = m.get(a) ?? { s: 0, sp: 0, eng: 0, ke: 0, tx: 0 };
    if (x.range === "cur") { e.s += x.mets[0] ?? 0; e.eng += x.mets[1] ?? 0; e.ke += x.mets[2] ?? 0; e.tx += x.mets[3] ?? 0; }
    else e.sp += x.mets[0] ?? 0;
    m.set(a, e);
  }
  const all = [...m.values()];
  const s = all.reduce((a, e) => a + e.s, 0), sp = all.reduce((a, e) => a + e.sp, 0);
  if (s === 0 && sp === 0) return null;
  const ke = all.reduce((a, e) => a + e.ke, 0), tx = all.reduce((a, e) => a + e.tx, 0), eng = all.reduce((a, e) => a + e.eng, 0);
  const conv = pct(ecommerce ? tx : ke, s);
  return {
    sesiones: s, sesionesPrev: sp, delta: sp > 0 ? ((s - sp) / sp) * 100 : null,
    share: sitio.sessions > 0 ? (s / sitio.sessions) * 100 : 0,
    eventosClave: ke, transacciones: tx, conv, convSitio: pct(ecommerce ? sitio.tx : sitio.ke, sitio.sessions), engagement: pct(eng, s),
    porAsistente: [...m.entries()].map(([asistente, e]) => ({ asistente, sesiones: e.s, sesionesPrev: e.sp, conv: pct(ecommerce ? e.tx : e.ke, e.s) })).sort((a, b) => b.sesiones - a.sesiones || b.sesionesPrev - a.sesionesPrev),
    ecommerce,
  };
}

// ── Landings que perdieron tráfico ───────────────────────────────────────────
export interface LandingDrop { path: string; sesiones: number; sesionesPrev: number; delta: number; perdidas: number; conv: number | null; vsSitioPp: number }
/** Landings con base previa relevante que cayeron ≥ 30% y ≥ 20 pp más que el sitio. Top 5 por sesiones perdidas. */
export function landingDrops(r: WebReports, opts: { top?: number } = {}): { sitioDelta: number | null; drops: LandingDrop[] } {
  const prevRows = r.landingPrev?.rows ?? [];
  if (!prevRows.length) return { sitioDelta: null, drops: [] };
  const cur = new Map<string, { s: number; ke: number }>();
  for (const x of r.landing.rows ?? []) cur.set(x.dimensionValues[0]!.value, { s: num(x.metricValues[0]?.value), ke: num(x.metricValues[2]?.value) });
  const prev = new Map<string, number>();
  for (const x of prevRows) prev.set(x.dimensionValues[0]!.value, num(x.metricValues[0]?.value));
  const totC = [...cur.values()].reduce((a, v) => a + v.s, 0), totP = [...prev.values()].reduce((a, v) => a + v, 0);
  if (totP <= 0) return { sitioDelta: null, drops: [] };
  const sitioDelta = ((totC - totP) / totP) * 100;
  const minBase = Math.max(50, totP * 0.01);
  const drops: LandingDrop[] = [];
  for (const [path, sp] of prev) {
    if (sp < minBase || !path || path === "(not set)") continue;
    const c = cur.get(path) ?? { s: 0, ke: 0 };
    const delta = ((c.s - sp) / sp) * 100;
    if (delta > -30 || delta - sitioDelta > -20) continue;
    drops.push({ path, sesiones: c.s, sesionesPrev: sp, delta, perdidas: sp - c.s, conv: pct(c.ke, c.s), vsSitioPp: delta - sitioDelta });
  }
  drops.sort((a, b) => b.perdidas - a.perdidas);
  return { sitioDelta, drops: drops.slice(0, opts.top ?? 5) };
}

// ── Calidad del dato (sello + checklist de tracking) ────────────────────────
export type EstadoCheck = "ok" | "aviso" | "falla" | "na";
export interface CheckCalidad { key: string; label: string; estado: EstadoCheck; detalle: string; arreglo?: string }
export interface CalidadDato { sello: "confiable" | "advertencias" | "incompleto"; checks: CheckCalidad[]; fallas: number; avisos: number }
export const SELLO_LABEL: Record<CalidadDato["sello"], string> = { confiable: "Confiable", advertencias: "Con advertencias", incompleto: "Incompleto" };

const fmtPct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;
const fmtInt = (v: number) => Math.round(v).toLocaleString("es-AR");

export function trackingQuality(r: WebReports, opts: { tx: number; revenue: number; ke: number; sessions: number; currency?: string | null; productPages?: number; failedReports?: string[] }): CalidadDato {
  const checks: CheckCalidad[] = [];
  const C = (c: CheckCalidad) => checks.push(c);
  const ev = eventTotals(r);
  const e = (k: string) => ev[k]?.eventos ?? 0;
  // Snapshots viejos (sin `events`) o reporte fallido → no se opina sobre el embudo.
  const hasEventsReport = r.events !== undefined && !(opts.failedReports ?? []).includes("events");
  const purchases = Math.max(e("purchase"), opts.tx);
  const ecomSignals = e("view_item") + e("add_to_cart") + e("begin_checkout");

  // 1. Conversiones medidas.
  C(opts.ke > 0 || opts.tx > 0
    ? { key: "conversiones", label: "Conversiones medidas", estado: "ok", detalle: opts.tx > 0 ? `${fmtInt(opts.tx)} compras y ${fmtInt(opts.ke)} eventos clave en el período.` : `${fmtInt(opts.ke)} eventos clave en el período.` }
    : { key: "conversiones", label: "Conversiones medidas", estado: opts.sessions > 0 ? "falla" : "na", detalle: "No hay compras ni eventos clave: no se puede medir qué genera negocio.", arreglo: "En GA4 → Administrar → Eventos clave, marcá las acciones de negocio (compra, formulario, WhatsApp, click a tienda)." });

  if (hasEventsReport) {
    // 2. purchase presente cuando hay embudo.
    if (purchases > 0) C({ key: "purchase", label: "Evento purchase", estado: "ok", detalle: `${fmtInt(e("purchase") || opts.tx)} compras registradas.` });
    else if (ecomSignals > 0) C({ key: "purchase", label: "Evento purchase", estado: "falla", detalle: `Hay ${fmtInt(ecomSignals)} eventos de ecommerce (producto/carrito/checkout) pero ninguna compra.`, arreglo: "Revisá que la página de confirmación dispare purchase con transaction_id, value y currency." });
    else C({ key: "purchase", label: "Evento purchase", estado: "na", detalle: (opts.productPages ?? 0) >= 3 ? "El sitio tiene páginas de producto pero no mide ecommerce (si la venta es en retailers, medí el click a tienda como evento clave)." : "El sitio no mide ecommerce." });

    if (purchases > 0) {
      // 3. purchase con value/currency (sin currency GA4 no registra ingresos).
      C(opts.revenue > 0
        ? { key: "purchase_value", label: "purchase con valor y moneda", estado: "ok", detalle: `Ingresos registrados${opts.currency ? ` en ${opts.currency}` : ""}.` }
        : { key: "purchase_value", label: "purchase con valor y moneda", estado: "falla", detalle: "Hay compras pero $0 de ingresos: el evento llega sin value o sin currency.", arreglo: "Enviá value (número) y currency (ej. \"ARS\") en cada purchase; sin currency GA4 descarta el ingreso." });
      // 4. purchase duplicado: eventos purchase vs transacciones únicas.
      if (opts.tx > 0 && e("purchase") > opts.tx * 1.2) C({ key: "purchase_dup", label: "purchase sin duplicados", estado: "aviso", detalle: `${fmtInt(e("purchase"))} eventos purchase para ${fmtInt(opts.tx)} transacciones: se dispara más de una vez por compra (recargas de la página de gracias).`, arreglo: "Dispará purchase una sola vez por transaction_id (guardá una marca en la sesión)." });
      else if (opts.tx > 0) C({ key: "purchase_dup", label: "purchase sin duplicados", estado: "ok", detalle: "Un evento por transacción." });
      // 5-7. Pasos del embudo.
      const paso = (k: string, label: string, why: string) => C(e(k) > 0
        ? { key: k, label: `Evento ${k}`, estado: "ok", detalle: `${fmtInt(e(k))} eventos.` }
        : { key: k, label: `Evento ${k}`, estado: "aviso", detalle: `Hay compras pero no ${label}: ${why}`, arreglo: `Implementá ${k} con el array items (item_id, item_name, price).` });
      paso("view_item", "vistas de producto", "no se puede medir la conversión de la ficha de producto.");
      paso("add_to_cart", "agregados al carrito", "no se ve en qué paso se cae la compra.");
      paso("begin_checkout", "inicios de checkout", "no se separa el abandono de carrito del abandono de pago.");
    }
  }

  // 8. Landing (not set) y canal Unassigned.
  const landRows = r.landing.rows ?? [];
  const landTot = landRows.reduce((a, x) => a + num(x.metricValues[0]?.value), 0);
  const notSet = landRows.filter((x) => { const v = x.dimensionValues[0]!.value; return v === "(not set)" || v === ""; }).reduce((a, x) => a + num(x.metricValues[0]?.value), 0);
  if (landTot > 0) {
    const sh = (notSet / landTot) * 100;
    C({ key: "landing_not_set", label: "Landing identificada", estado: sh >= 20 ? "falla" : sh >= 5 ? "aviso" : "ok", detalle: `${fmtPct(sh)} de las sesiones sin página de entrada ("(not set)").`, ...(sh >= 5 ? { arreglo: "Suele ser sesiones que arrancan sin page_view (tag cargado tarde, apps, consentimiento): revisá que el page_view sea el primer evento." } : {}) });
  }
  const chRows = r.chan.rows ?? [];
  const chTot = chRows.reduce((a, x) => a + num(x.metricValues[1]?.value), 0);
  const unas = chRows.filter((x) => /unassigned|\(not set\)|\(other\)/i.test(x.dimensionValues[0]!.value)).reduce((a, x) => a + num(x.metricValues[1]?.value), 0);
  if (chTot > 0) {
    const sh = (unas / chTot) * 100;
    C({ key: "canal_unassigned", label: "Atribución de canal", estado: sh >= 20 ? "falla" : sh >= 5 ? "aviso" : "ok", detalle: `${fmtPct(sh)} de las sesiones en canal "Unassigned" (sin atribución).`, ...(sh >= 5 ? { arreglo: "Etiquetá con UTM (utm_source/medium/campaign) los links de pauta, mails y redes; usá valores de medium estándar (cpc, email, social)." } : {}) });
  }

  // 9. Sellos de GA4: muestreo, umbrales de privacidad, fila (other).
  const reps = Object.entries(r).filter(([, v]) => v && typeof v === "object") as [string, Ga4Report][];
  const sampled = reps.filter(([, v]) => (v.metadata?.samplingMetadatas?.length ?? 0) > 0).map(([k]) => k);
  const thresh = reps.filter(([, v]) => v.metadata?.subjectToThresholding).map(([k]) => k);
  const other = reps.filter(([, v]) => v.metadata?.dataLossFromOtherRow).map(([k]) => k);
  C(sampled.length
    ? { key: "muestreo", label: "Sin muestreo", estado: "aviso", detalle: `GA4 respondió con datos muestreados en ${sampled.length} reporte${sampled.length > 1 ? "s" : ""}: los números son estimaciones.`, arreglo: "Achicá el rango de fechas o usá la exportación a BigQuery para datos completos." }
    : { key: "muestreo", label: "Sin muestreo", estado: "ok", detalle: "Todos los reportes vienen completos (sin muestreo)." });
  if (thresh.length) C({ key: "umbrales", label: "Umbrales de privacidad", estado: "aviso", detalle: "GA4 aplicó umbrales de privacidad (Google Signals / datos demográficos): oculta filas chicas, los totales por segmento pueden quedar bajos.", arreglo: "En GA4 → Administrar → Identidad para los informes, usá \"Basada en dispositivos\" para ver todas las filas." });
  if (other.length) C({ key: "other_row", label: "Sin fila (other)", estado: "aviso", detalle: "La propiedad superó el límite de valores únicos: parte del tráfico se agrupó en \"(other)\".", arreglo: "Evitá parámetros con valores únicos (IDs, timestamps) en dimensiones personalizadas." });

  // 10. Reportes que fallaron en la lectura.
  if (opts.failedReports?.length) C({ key: "reportes", label: "Lectura completa", estado: "aviso", detalle: `No se pudieron leer ${opts.failedReports.length} reporte${opts.failedReports.length > 1 ? "s" : ""} de GA4 en la última actualización (${opts.failedReports.join(", ")}).` });

  const fallas = checks.filter((c) => c.estado === "falla").length;
  const avisos = checks.filter((c) => c.estado === "aviso").length;
  return { sello: fallas ? "incompleto" : avisos ? "advertencias" : "confiable", checks, fallas, avisos };
}
