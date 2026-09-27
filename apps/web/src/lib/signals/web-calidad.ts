// Señales de WEB (portado de BIP, sep-2026): calidad del dato / tracking, embudo de ecommerce,
// tráfico desde asistentes de IA, landings que perdieron tráfico + (Drean) cierre proyectado del
// mes vs meta y chequeo indirecto de consent. PURO: recibe el snapshot del cron web-calidad, la
// serie diaria de compras y las metas; la lógica vive en lib/web-calidad.ts / web-forecast.ts /
// web-consent.ts (la misma que ve el tablero). Imports relativos (testeable suelto).
import { ecomFunnel, aiTraffic, landingDrops, trackingQuality, type WebReports } from "../web-calidad";
import { cierreDeMes, type DiaWeb } from "../web-forecast";
import { chequeoConsent } from "../web-consent";
import type { WebCalidadSnapshot } from "../web-calidad-shared";
import { type Signal, fInt, fPct, fDelta, fMoney, clip, r2 } from "./types";

export interface WebCalidadTotals { sessions: number; ke: number; tx: number; revenue: number }

export function webCalidadSignals(r: WebReports, t: WebCalidadTotals, opts: { per?: string; failedReports?: string[]; currency?: string | null } = {}): Signal[] {
  const out: Signal[] = [];
  const S = (s: Omit<Signal, "dash">) => out.push({ ...s, dash: "web" });
  const per = opts.per ?? "";

  // ── 1. Calidad del dato: cada falla es una alerta (los avisos se ven en el sello del tablero). ──
  const q = trackingQuality(r, { tx: t.tx, revenue: t.revenue, ke: t.ke, sessions: t.sessions, currency: opts.currency ?? null, failedReports: opts.failedReports });
  for (const c of q.checks.filter((x) => x.estado === "falla" && x.key !== "conversiones")) S({
    key: `web_tracking_${c.key}`, tipo: "alerta", prioridad: c.key === "purchase_value" || c.key === "purchase" ? "alta" : "media",
    titulo: `Calidad del dato: ${c.label.toLowerCase()} — ${c.detalle.split(":")[0]}`,
    descripcion: `${c.detalle} Las conclusiones del tablero sobre ese punto no son confiables hasta corregirlo.`,
    acciones: [c.arreglo ?? "Revisar la implementación de GA4", "Validar en GA4 → DebugView después del cambio"],
    datos: { check: c.key, estado: c.estado, sello: q.sello },
  });

  // ── 2. Embudo: paso que más empeoró vs el período anterior ──
  const f = ecomFunnel(r);
  if (f?.mayorCaida && f.mayorCaida.deltaPp <= -3 && f.mayorCaida.tasaPrev > 0 && f.mayorCaida.deltaPp / f.mayorCaida.tasaPrev <= -0.15) {
    const m = f.mayorCaida;
    const aov = t.tx > 0 ? t.revenue / t.tx : 0;
    S({
      key: "web_funnel_step_drop", tipo: "alerta", prioridad: m.deltaPp / m.tasaPrev <= -0.3 ? "alta" : "media",
      titulo: `Embudo: "${m.label}" cayó a ${fPct(m.tasa, 1)} (${fPct(m.tasaPrev, 1)} en los 28 días previos${per ? ` a ${per}` : ""})`,
      descripcion: `Es el paso que más empeoró (${m.deltaPp.toFixed(1)} pp). Con la tasa anterior se habrían logrado ≈${fInt(m.comprasPerdidas)} compras más${aov > 0 ? ` (≈${fMoney(m.comprasPerdidas * aov)})` : ""}. Conversión punta a punta: ${f.total != null ? fPct(f.total, 2) : "—"}${f.totalPrev != null ? ` vs ${fPct(f.totalPrev, 2)}` : ""}.`,
      acciones: m.key === "add_to_cart"
        ? ["Revisar precio, stock, cuotas y envío visibles en la ficha de producto", "Comparar mobile vs desktop en el embudo por dispositivo"]
        : m.key === "begin_checkout"
          ? ["Revisar el carrito: costo de envío sorpresa, cupones, botón de checkout visible", "Mostrar cuotas y medios de pago antes del checkout"]
          : ["Revisar el checkout: registro obligatorio, errores de pago, medios disponibles", "Probar el pago con cada medio (tarjeta, Mercado Pago) en mobile"],
      datos: { paso: m.key, tasa: r2(m.tasa), tasaPrevia: r2(m.tasaPrev), deltaPp: r2(m.deltaPp), total: f.total == null ? null : r2(f.total) },
      impacto: aov > 0
        ? { metrica: "Ingresos perdidos vs la tasa anterior", valor: Math.round(m.comprasPerdidas * aov), unidad: "$" }
        : { metrica: "Compras perdidas vs la tasa anterior", valor: Math.round(m.comprasPerdidas), unidad: "compras" },
    });
  }
  if (f) {
    const mob = f.porDispositivo.find((d) => d.device === "mobile"), desk = f.porDispositivo.find((d) => d.device === "desktop");
    if (mob?.total != null && desk?.total != null && (mob.usuarios[0] ?? 0) >= 100 && (desk.usuarios[0] ?? 0) >= 100 && mob.total <= desk.total * 0.5) S({
      key: "web_funnel_mobile_gap", tipo: "oportunidad", prioridad: "media",
      titulo: `En mobile compra el ${fPct(mob.total, 2)} de quienes ven un producto vs ${fPct(desk.total, 2)} en desktop`,
      descripcion: `Mobile es ${fInt(mob.usuarios[0] ?? 0)} usuarios en ficha. Si convirtiera la mitad que desktop sumaría ≈${fInt((mob.usuarios[0] ?? 0) * ((desk.total / 2 - mob.total) / 100))} compras en el período.`,
      acciones: ["Recorrer la compra en un celular: velocidad, formularios, pago", "Priorizar checkout express / billeteras en mobile"],
      datos: { mobile: r2(mob.total), desktop: r2(desk.total) },
    });
  }

  // ── 3. Tráfico desde asistentes de IA ──
  const ai = aiTraffic(r, t);
  if (ai && ai.sesiones >= 20) {
    const top = ai.porAsistente[0];
    const convBetter = ai.conv != null && ai.convSitio != null && ai.convSitio > 0 && ai.conv >= ai.convSitio * 1.3;
    const growing = ai.delta != null && ai.sesionesPrev >= 10 && ai.delta >= 30;
    if (convBetter || growing) S({
      key: "web_ai_referrals", tipo: "oportunidad", prioridad: convBetter && ai.share >= 1 ? "media" : "baja",
      titulo: `Los asistentes de IA trajeron ${fInt(ai.sesiones)} sesiones (${fPct(ai.share, 2)} del sitio)${growing ? `, ${fDelta(ai.delta!)} vs los 28 días previos` : ""}`,
      descripcion: `${top ? `Principal: ${top.asistente} (${fInt(top.sesiones)}). ` : ""}Conversión desde IA ${ai.conv != null ? fPct(ai.conv, 2) : "—"} vs ${ai.convSitio != null ? fPct(ai.convSitio, 2) : "—"} del sitio.${convBetter ? " Es tráfico de alta intención: llega con la pregunta resuelta." : ""}`,
      acciones: ["Cruzar con Visibilidad en IA del tablero SEO: qué preguntas nombran a Drean y qué fuentes cita la IA", "Reforzar las páginas a las que llegan (ficha técnica, comparativas, preguntas frecuentes)"],
      datos: { sesiones: ai.sesiones, sesionesPrevias: ai.sesionesPrev, share: r2(ai.share), conv: ai.conv == null ? null : r2(ai.conv), convSitio: ai.convSitio == null ? null : r2(ai.convSitio), porAsistente: ai.porAsistente.slice(0, 5) },
    });
  }

  // ── 4. Landings que perdieron tráfico (más que el sitio) ──
  const ld = landingDrops(r, { top: 3 });
  if (ld.drops.length) {
    const lost = ld.drops.reduce((a, d) => a + d.perdidas, 0);
    S({
      key: "web_landing_traffic_drop", tipo: "alerta", prioridad: ld.drops.length >= 2 || (ld.drops[0]?.delta ?? 0) <= -60 ? "media" : "baja",
      titulo: `${ld.drops.length} página${ld.drops.length > 1 ? "s" : ""} de entrada perdi${ld.drops.length > 1 ? "eron" : "ó"} tráfico mucho más que el sitio (${ld.sitioDelta != null ? fDelta(ld.sitioDelta) : "—"})`,
      descripcion: ld.drops.map((d) => `${clip(d.path, 50)}: ${fInt(d.sesionesPrev)} → ${fInt(d.sesiones)} (${fDelta(d.delta)})`).join(" · ") + ".",
      acciones: ["Revisar si cambió la URL, se despublicó o redirige mal", "Ver en Search Console si perdió posiciones; en Plan de Medios si se pausó la pauta que la usaba"],
      datos: { sitioDelta: ld.sitioDelta == null ? null : r2(ld.sitioDelta), landings: ld.drops.map((d) => ({ path: d.path, sesiones: d.sesiones, sesionesPrevias: d.sesionesPrev, delta: r2(d.delta) })) },
      impacto: { metrica: "Sesiones perdidas", valor: Math.round(lost), unidad: "sesiones" },
    });
  }
  return out;
}

/** Drean: cierre proyectado del mes vs meta + consent + calidad (si hay snapshot con GA4). */
export function computeWebCalidadSignals(inp: { snapshot: WebCalidadSnapshot | null; diario: DiaWeb[]; metaTx: (number | null)[]; metaIngresos: (number | null)[]; now?: Date }): Signal[] {
  const out: Signal[] = [];
  const S = (s: Omit<Signal, "dash">) => out.push({ ...s, dash: "web" });
  const now = inp.now ?? new Date();

  // ── Cierre proyectado (solo con meta y fuera de "preliminar") ──
  const c0 = cierreDeMes(inp.diario);
  if (c0 && c0.mes.slice(0, 4) === String(now.getUTCFullYear())) {
    const mi = Number(c0.mes.slice(5, 7)) - 1;
    const c = cierreDeMes(inp.diario, { metaTx: inp.metaTx[mi] ?? null, metaIngresos: inp.metaIngresos[mi] ?? null });
    if (c && !c.preliminar) {
      for (const [k, lab, fmt] of [["ingresos", "Ingresos", (v: number) => fMoney(v)], ["tx", "Transacciones", (v: number) => fInt(v)]] as const) {
        const p = c[k];
        if (p.estado !== "debajo" || p.meta == null) continue;
        S({
          key: `web_cierre_${k}_debajo`, tipo: "alerta", prioridad: (p.pctMeta ?? 100) < 85 ? "alta" : "media",
          titulo: `${lab} del mes: cierre proyectado ${fmt(p.cierre)} (${p.pctMeta != null ? fPct(p.pctMeta, 0) : "—"} de la meta ${fmt(p.meta)})`,
          descripcion: `Real a la fecha ${fmt(p.real)} con ${c.diasConDato} de ${c.diasMes} días. Rango probable ${p.p10 != null ? fmt(p.p10) : "—"} a ${p.p90 != null ? fmt(p.p90) : "—"}: la meta queda por encima del rango. Para llegar hacen falta ${p.necesarioDia != null ? fmt(p.necesarioDia) : "—"}/día vs un ritmo de ${fmt(p.ritmoDia)}/día.`,
          acciones: ["Revisar la pauta de conversión (Performance Max / Search) de los días que quedan", "Activar una acción comercial corta (cuotas, envío) si el gap es grande"],
          datos: { mes: c.mes, real: Math.round(p.real), cierre: Math.round(p.cierre), p10: p.p10 == null ? null : Math.round(p.p10), p90: p.p90 == null ? null : Math.round(p.p90), meta: p.meta, pctMeta: p.pctMeta },
          impacto: { metrica: `Gap a la meta de ${lab.toLowerCase()}`, valor: Math.round(p.meta - p.cierre), unidad: k === "ingresos" ? "$" : "compras" },
        });
      }
    }
  }

  const snap = inp.snapshot;
  if (!snap) return out;
  // ── Consent / pérdida de medición ──
  if (snap.consent) {
    const ym = now.toISOString().slice(0, 7);
    const ch = chequeoConsent(Object.fromEntries(Object.entries(snap.consent.clicks).filter(([m]) => m < ym)), snap.consent.sesiones);
    if (ch.estado === "perdida_media" || ch.estado === "perdida_alta" || ch.estado === "caida") S({
      key: `web_consent_${ch.estado}`, tipo: "alerta", prioridad: ch.estado === "perdida_media" ? "media" : "alta",
      titulo: ch.titulo,
      descripcion: `${ch.detalle} Base: ${snap.consent.criterio}.`,
      acciones: ch.acciones,
      datos: { meses: ch.meses.filter((m) => m.ratio != null).slice(-6).map((m) => ({ mes: m.mes, clicks: m.clicks, sesiones: m.sesiones, ratio: m.ratio == null ? null : r2(m.ratio) })) },
    });
  }
  // ── Calidad / embudo / IA / landings (reportes GA4 del snapshot) ──
  const g = snap.ga4;
  if (g?.ok) out.push(...webCalidadSignals(g.reports, g.totals, { per: `${g.periodo.start}→${g.periodo.end}`, failedReports: g.failed, currency: g.totals.currency }));
  else {
    // Sin GA4 en el snapshot: tráfico desde IA mensual (web_traffic) — crecimiento del último mes cerrado.
    const ym = now.toISOString().slice(0, 7);
    const ms = snap.iaMensual.filter((m) => m.mes < ym);
    const u = ms[ms.length - 1], p = ms[ms.length - 2];
    if (u && p && p.sesiones >= 50 && u.sesiones >= p.sesiones * 1.3) S({
      key: "web_ai_referrals", tipo: "oportunidad", prioridad: "baja",
      titulo: `Los asistentes de IA trajeron ${fInt(u.sesiones)} sesiones en ${u.mes} (${fDelta(((u.sesiones - p.sesiones) / p.sesiones) * 100)} vs ${p.mes})`,
      descripcion: `${u.sesionesSitio ? `${fPct((u.sesiones / u.sesionesSitio) * 100, 2)} del sitio. ` : ""}${fInt(u.transacciones)} compras (${fMoney(u.ingresos)}).`,
      acciones: ["Cruzar con Visibilidad en IA del tablero SEO", "Reforzar las páginas a las que llegan"],
      datos: { meses: ms.slice(-4).map((m) => ({ mes: m.mes, sesiones: m.sesiones, compras: m.transacciones })) },
    });
  }
  return out;
}
