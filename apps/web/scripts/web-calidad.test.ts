// Test de los quick wins de Web (portado de BIP): embudo, calidad del dato, tráfico desde IA, landings
// en caída + señales. cd apps/web && npx tsx scripts/web-calidad.test.ts   (datos sintéticos; sin red)
import { splitRanges, ecomFunnel, aiTraffic, asistenteDe, landingDrops, trackingQuality, eventTotals } from "../src/lib/web-calidad";
import { webCalidadSignals } from "../src/lib/signals/web-calidad";
import type { Ga4Report, WebReports as WR } from "../src/lib/web-calidad";
// Los reportes de BIP traen más claves (cur/prev/…): el motor las ignora salvo para leer sellos de muestreo.
type WebReports = WR & Record<string, Ga4Report | undefined>;

let pass = 0, fail = 0;
const ok = (c: unknown, m: string, info?: unknown) => { if (c) pass++; else { fail++; console.error("  ✗", m, info ?? ""); } };
const has = (s: { key: string }[], k: string) => s.some((x) => x.key === k);

const E: Ga4Report = { rows: [] };
const rep = (rows: [string[], (number | string)[]][], extra: Partial<Ga4Report> = {}): Ga4Report => ({ rows: rows.map(([d, m]) => ({ dimensionValues: d.map((value) => ({ value })), metricValues: m.map((v) => ({ value: String(v) })) })), ...extra });
// cur: users, sessions, pv, avgSession, bounce, tx, revenue, newUsers, keyEvents
const tot = (ses: number, tx: number, rev: number, ke: number) => rep([[[], [ses * 0.8, ses, ses * 2, 60, 0.5, tx, rev, ses * 0.5, ke]]]);
const base = (): WebReports => ({ cur: tot(10000, 100, 5_000_000, 400), prev: tot(10000, 120, 6_000_000, 450), monthly: E, daily: E, chan: E, chanDaily: E, landing: E, landingDaily: E, items: E, dev: E, region: E, pages: E });

// ── splitRanges: por header, por valor, sin rango ──
{
  const byHead = splitRanges(rep([[["purchase", "cur"], [1, 2]], [["purchase", "prev"], [3, 4]]], { dimensionHeaders: [{ name: "eventName" }, { name: "dateRange" }] }));
  ok(byHead[0].range === "cur" && byHead[1].range === "prev" && byHead[1].dims[0] === "purchase" && byHead[1].mets[1] === 4, "splitRanges por header");
  const byVal = splitRanges(rep([[["date_range_1", "x"], [1]]]));
  ok(byVal[0].range === "prev" && byVal[0].dims[0] === "x", "splitRanges por valor (date_range_1)");
  ok(splitRanges(rep([[["x"], [1]]]))[0].range === "cur", "sin dimensión de rango = cur");
  ok(splitRanges(undefined).length === 0, "reporte ausente = vacío");
}

// ── Embudo ──
const H = { dimensionHeaders: [{ name: "eventName" }, { name: "deviceCategory" }, { name: "dateRange" }] };
const ev = (rows: [string, string, "cur" | "prev", number, number][]) => rep(rows.map(([e, d, r, c, u]) => [[e, d, r], [c, u]]), H);
{
  const r = base();
  r.events = ev([
    ["view_item", "mobile", "cur", 9000, 3000], ["add_to_cart", "mobile", "cur", 400, 200], ["begin_checkout", "mobile", "cur", 150, 100], ["purchase", "mobile", "cur", 40, 40],
    ["view_item", "desktop", "cur", 6000, 2000], ["add_to_cart", "desktop", "cur", 500, 300], ["begin_checkout", "desktop", "cur", 200, 150], ["purchase", "desktop", "cur", 60, 60],
    ["view_item", "mobile", "prev", 9000, 3000], ["add_to_cart", "mobile", "prev", 800, 400], ["begin_checkout", "mobile", "prev", 300, 200], ["purchase", "mobile", "prev", 70, 70],
    ["view_item", "desktop", "prev", 6000, 2000], ["add_to_cart", "desktop", "prev", 500, 300], ["begin_checkout", "desktop", "prev", 200, 150], ["purchase", "desktop", "prev", 50, 50],
  ]);
  const f = ecomFunnel(r)!;
  ok(f && f.steps.length === 4, "embudo de 4 pasos");
  ok(f.steps[0].usuarios === 5000 && f.steps[1].usuarios === 500, "usuarios por paso sumados por dispositivo", f.steps);
  ok(Math.abs(f.steps[1].tasa! - 10) < 1e-9 && Math.abs(f.steps[1].tasaPrev! - 14) < 1e-9, "tasa carrito 10% vs 14%");
  ok(Math.abs(f.total! - 2) < 1e-9, "conversión punta a punta 100/5000 = 2%", f.total);
  ok(f.mayorCaida?.key === "add_to_cart" && f.mayorCaida.deltaPp < -3.9, "mayor caída = carrito", f.mayorCaida);
  // perdidas = 5000 × 4% × (100/500) = 40
  ok(Math.abs((f.mayorCaida?.comprasPerdidas ?? 0) - 40) < 1e-6, "compras perdidas = 40", f.mayorCaida);
  ok(f.porDispositivo[0].device === "mobile" && Math.abs(f.porDispositivo[0].total! - (40 / 3000) * 100) < 1e-9, "conversión mobile");
  ok(f.pasosFaltantes.length === 0, "sin pasos faltantes");
  const s = webCalidadSignals(r, { sessions: 10000, ke: 400, tx: 100, revenue: 5_000_000 });
  ok(has(s, "web_funnel_step_drop"), "señal de caída de embudo");
  const sd = s.find((x) => x.key === "web_funnel_step_drop")!;
  ok(sd.impacto?.unidad === "$" && sd.impacto.valor === Math.round(40 * 50_000), "impacto en $ con AOV", sd.impacto);
  // Paso faltante: begin_checkout en 0 con purchase > 0.
  const r2 = base();
  r2.events = ev([["view_item", "mobile", "cur", 100, 100], ["add_to_cart", "mobile", "cur", 10, 10], ["purchase", "mobile", "cur", 2, 2]]);
  ok(ecomFunnel(r2)!.pasosFaltantes.includes("begin_checkout"), "detecta paso faltante");
  ok(ecomFunnel({ ...base(), events: E }) === null, "sin eventos = sin embudo");
  // Brecha mobile vs desktop.
  const r3 = base();
  r3.events = ev([["view_item", "mobile", "cur", 1000, 1000], ["purchase", "mobile", "cur", 5, 5], ["view_item", "desktop", "cur", 500, 500], ["purchase", "desktop", "cur", 20, 20]]);
  ok(has(webCalidadSignals(r3, { sessions: 3000, ke: 30, tx: 25, revenue: 100 }), "web_funnel_mobile_gap"), "señal mobile convierte ≤ mitad de desktop");
}

// ── Calidad del dato ──
{
  // Sitio de leads sin ecommerce: purchase "no aplica", sello confiable.
  const lead = base();
  lead.cur = tot(5000, 0, 0, 120); lead.events = E;
  lead.landing = rep([[["/"], [4000, 8000, 100]], [["/contacto"], [1000, 1500, 20]]]);
  lead.chan = rep([[["Organic Search"], [3000, 4000, 8000, 80]], [["Direct"], [800, 1000, 2000, 40]]]);
  const q = trackingQuality(lead, { tx: 0, revenue: 0, ke: 120, sessions: 5000 });
  ok(q.sello === "confiable", "leads sin problemas → confiable", q);
  ok(q.checks.find((c) => c.key === "purchase")?.estado === "na", "purchase no aplica en leads");

  // Compras sin valor + sin add_to_cart + purchase duplicado + Unassigned alto + umbrales.
  const bad = base();
  bad.events = ev([["purchase", "mobile", "cur", 200, 90], ["view_item", "mobile", "cur", 5000, 2000]]);
  bad.chan = rep([[["Unassigned"], [1, 3000, 1, 0]], [["Direct"], [1, 7000, 1, 0]]], { metadata: { subjectToThresholding: true } });
  bad.landing = rep([[["(not set)"], [800, 0, 0]], [["/"], [9200, 0, 0]]]);
  const qb = trackingQuality(bad, { tx: 100, revenue: 0, ke: 0, sessions: 10000 });
  const st = (k: string) => qb.checks.find((c) => c.key === k)?.estado;
  ok(qb.sello === "incompleto", "compras sin valor → incompleto");
  ok(st("purchase_value") === "falla", "purchase sin value/currency = falla");
  ok(st("purchase_dup") === "aviso", "200 purchase para 100 tx = duplicado");
  ok(st("add_to_cart") === "aviso" && st("view_item") === "ok", "falta add_to_cart");
  ok(st("canal_unassigned") === "falla", "30% Unassigned = falla");
  ok(st("landing_not_set") === "aviso", "8% landing (not set) = aviso");
  ok(st("umbrales") === "aviso", "umbrales de privacidad detectados");
  const sb = webCalidadSignals(bad, { sessions: 10000, ke: 0, tx: 100, revenue: 0 });
  ok(has(sb, "web_tracking_purchase_value") && sb.find((x) => x.key === "web_tracking_purchase_value")!.prioridad === "alta", "señal alta por purchase sin valor");
  ok(has(sb, "web_tracking_canal_unassigned"), "señal por atribución");
  ok(!sb.some((x) => x.key === "web_tracking_purchase_dup"), "los avisos no generan señal");

  // Embudo sin purchase.
  const nop = base();
  nop.events = ev([["view_item", "mobile", "cur", 5000, 2000], ["add_to_cart", "mobile", "cur", 100, 80]]);
  ok(trackingQuality(nop, { tx: 0, revenue: 0, ke: 10, sessions: 10000 }).checks.find((c) => c.key === "purchase")?.estado === "falla", "eventos de ecommerce sin purchase = falla");
  // Muestreo en cualquier reporte.
  const smp = base();
  smp.cur = { ...tot(10000, 0, 0, 10), metadata: { samplingMetadatas: [{ samplesReadCount: "1", samplingSpaceSize: "10" }] } };
  ok(trackingQuality(smp, { tx: 0, revenue: 0, ke: 10, sessions: 10000 }).checks.find((c) => c.key === "muestreo")?.estado === "aviso", "muestreo detectado");
  // Snapshot viejo sin `events` → no opina del embudo; reporte events fallido tampoco.
  const old = base(); delete old.events;
  ok(!trackingQuality(old, { tx: 10, revenue: 0, ke: 0, sessions: 100 }).checks.some((c) => c.key === "purchase"), "snapshot sin events: sin checks de embudo");
  const failed = base(); failed.events = E;
  ok(!trackingQuality(failed, { tx: 10, revenue: 10, ke: 0, sessions: 100, failedReports: ["events"] }).checks.some((c) => c.key === "add_to_cart"), "events fallido: sin checks de embudo");
  ok(trackingQuality(failed, { tx: 10, revenue: 10, ke: 0, sessions: 100, failedReports: ["events"] }).checks.find((c) => c.key === "reportes")?.estado === "aviso", "reporte fallido = aviso");
  ok(eventTotals(bad).purchase.eventos === 200, "eventTotals");
}

// ── Tráfico desde IA ──
{
  ok(asistenteDe("chatgpt.com") === "ChatGPT" && asistenteDe("perplexity") === "Perplexity" && asistenteDe("gemini.google.com") === "Gemini" && asistenteDe("copilot.microsoft.com") === "Copilot" && asistenteDe("google") === null, "nombres de asistentes");
  const r = base();
  r.aiRef = rep([
    [["chatgpt.com", "cur"], [300, 250, 30, 5]], [["chat.openai.com", "cur"], [20, 10, 1, 0]], [["perplexity", "cur"], [80, 60, 8, 1]],
    [["chatgpt.com", "prev"], [150, 100, 10, 1]], [["google", "cur"], [9999, 0, 0, 0]],
  ], { dimensionHeaders: [{ name: "sessionSource" }, { name: "dateRange" }] });
  const a = aiTraffic(r, { sessions: 10000, ke: 400, tx: 100 })!;
  ok(a.sesiones === 400 && a.sesionesPrev === 150, "suma sesiones IA (ignora fuentes que no son IA)", a);
  ok(a.porAsistente[0].asistente === "ChatGPT" && a.porAsistente[0].sesiones === 320, "ChatGPT agrupa chatgpt + openai");
  ok(Math.abs(a.share - 4) < 1e-9, "share 4% del sitio");
  ok(a.ecommerce && Math.abs(a.conv! - 1.5) < 1e-9 && Math.abs(a.convSitio! - 1) < 1e-9, "conversión por compras (ecommerce)", a);
  ok(has(webCalidadSignals(r, { sessions: 10000, ke: 400, tx: 100, revenue: 1 }), "web_ai_referrals"), "señal IA (crece y convierte mejor)");
  ok(aiTraffic(base(), { sessions: 1, ke: 0, tx: 0 }) === null, "sin IA = null");
}

// ── Landings en caída ──
{
  const r = base();
  r.landing = rep([[["/"], [5000, 0, 50]], [["/lavarropas"], [200, 0, 2]], [["/promo"], [900, 0, 9]]]);
  r.landingPrev = rep([[["/"], [5000]], [["/lavarropas"], [1000]], [["/promo"], [1000]], [["/vieja"], [30]], [["(not set)"], [900]]]);
  const d = landingDrops(r);
  ok(d.sitioDelta != null && d.sitioDelta < 0, "delta del sitio negativo", d.sitioDelta);
  ok(d.drops.length === 1 && d.drops[0].path === "/lavarropas" && d.drops[0].perdidas === 800, "solo la landing que cae mucho más que el sitio (sin base chica ni not set)", d.drops);
  ok(has(webCalidadSignals(r, { sessions: 6100, ke: 61, tx: 0, revenue: 0 }), "web_landing_traffic_drop"), "señal de landing en caída");
  ok(landingDrops(base()).drops.length === 0 && landingDrops(base()).sitioDelta === null, "sin período anterior = nada");
}

// ── Integración: snapshot viejo sin los reportes nuevos no rompe ──
{
  const old = base(); delete old.events; delete old.aiRef; delete old.landingPrev;
  let threw = false; try { webCalidadSignals(old, { sessions: 10000, ke: 400, tx: 100, revenue: 5_000_000 }); } catch { threw = true; }
  ok(!threw, "snapshot sin reportes nuevos no rompe");
}

console.log(`web-calidad: ${pass} OK, ${fail} fallas`);
if (fail) process.exit(1);
