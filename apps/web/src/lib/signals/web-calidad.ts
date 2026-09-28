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
    titulo: `Hay un problema en cómo se mide la web: ${c.label.toLowerCase()} — ${c.detalle.split(":")[0]}`,
    descripcion: `${c.detalle} Hasta que se corrija, lo que muestra el tablero sobre ese punto no es confiable.`,
    acciones: [c.arreglo ?? "Pedile al equipo web que revise cómo está instalado Google Analytics (GA4)", "Después del cambio, que lo verifique en Google Analytics → DebugView (la vista para probar la medición en vivo)"],
    datos: { check: c.key, estado: c.estado, sello: q.sello },
  });

  // ── 2. Embudo: paso que más empeoró vs el período anterior ──
  const f = ecomFunnel(r);
  if (f?.mayorCaida && f.mayorCaida.deltaPp <= -3 && f.mayorCaida.tasaPrev > 0 && f.mayorCaida.deltaPp / f.mayorCaida.tasaPrev <= -0.15) {
    const m = f.mayorCaida;
    const aov = t.tx > 0 ? t.revenue / t.tx : 0;
    S({
      key: "web_funnel_step_drop", tipo: "alerta", prioridad: m.deltaPp / m.tasaPrev <= -0.3 ? "alta" : "media",
      titulo: `Recorrido de compra: el paso "${m.label}" bajó a ${fPct(m.tasa, 1)} (era ${fPct(m.tasaPrev, 1)} en los 28 días anteriores${per ? ` a ${per}` : ""})`,
      descripcion: `Es el paso del recorrido de compra (embudo) que más empeoró: ${m.deltaPp.toFixed(1)} puntos. Con el % anterior se habrían logrado ≈${fInt(m.comprasPerdidas)} compras más${aov > 0 ? ` (≈${fMoney(m.comprasPerdidas * aov)})` : ""}. De cada 100 que ven un producto, compran ${f.total != null ? fPct(f.total, 2) : "—"}${f.totalPrev != null ? ` (antes ${fPct(f.totalPrev, 2)})` : ""}.`,
      acciones: m.key === "add_to_cart"
        ? ["Revisá que en la página del producto se vean bien el precio, el stock, las cuotas y el envío", "Compará celular contra computadora en el recorrido por dispositivo"]
        : m.key === "begin_checkout"
          ? ["Revisá el carrito: que el envío no aparezca de sorpresa, que los cupones funcionen y que el botón para pagar se vea", "Mostrá cuotas y medios de pago antes del paso de pago"]
          : ["Pedile al equipo web que revise el paso de pago (checkout): si obliga a registrarse, si hay errores de pago, qué medios hay", "Que pruebe pagar con cada medio (tarjeta, Mercado Pago) desde un celular"],
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
      titulo: `Desde el celular compra el ${fPct(mob.total, 2)} de quienes ven un producto; desde la computadora, el ${fPct(desk.total, 2)}`,
      descripcion: `Desde el celular, ${fInt(mob.usuarios[0] ?? 0)} personas vieron un producto. Si compraran aunque sea la mitad que desde la computadora, serían ≈${fInt((mob.usuarios[0] ?? 0) * ((desk.total / 2 - mob.total) / 100))} compras más en el período.`,
      acciones: ["Hacé una compra de prueba desde un celular: fijate la velocidad, los formularios y el pago", "Pedile al equipo web un pago rápido en el celular (billeteras como Mercado Pago, sin registrarse — checkout express)"],
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
      key: "web_ai_referrals", metrica: "sesiones", tipo: "oportunidad", prioridad: convBetter && ai.share >= 1 ? "media" : "baja",
      titulo: `Asistentes de IA como ChatGPT trajeron ${fInt(ai.sesiones)} visitas (${fPct(ai.share, 2)} de la web)${growing ? `, ${fDelta(ai.delta!)} contra los 28 días anteriores` : ""}`,
      descripcion: `${top ? `El que más trae: ${top.asistente} (${fInt(top.sesiones)}). ` : ""}De esas visitas, termina en compra o consulta el ${ai.conv != null ? fPct(ai.conv, 2) : "—"}; en toda la web, el ${ai.convSitio != null ? fPct(ai.convSitio, 2) : "—"}.${convBetter ? " Es gente con ganas de comprar: llega con la duda ya resuelta." : ""}`,
      acciones: ["Mirá en el tablero SEO (Visibilidad en IA) en qué preguntas aparece Drean y qué páginas cita la IA", "Mejorá las páginas a las que llega esa gente: ficha técnica, comparativas, preguntas frecuentes"],
      datos: { sesiones: ai.sesiones, sesionesPrevias: ai.sesionesPrev, share: r2(ai.share), conv: ai.conv == null ? null : r2(ai.conv), convSitio: ai.convSitio == null ? null : r2(ai.convSitio), porAsistente: ai.porAsistente.slice(0, 5) },
    });
  }

  // ── 4. Landings que perdieron tráfico (más que el sitio) ──
  const ld = landingDrops(r, { top: 3 });
  if (ld.drops.length) {
    const lost = ld.drops.reduce((a, d) => a + d.perdidas, 0);
    S({
      key: "web_landing_traffic_drop", tipo: "alerta", prioridad: ld.drops.length >= 2 || (ld.drops[0]?.delta ?? 0) <= -60 ? "media" : "baja",
      titulo: `${ld.drops.length} página${ld.drops.length > 1 ? "s" : ""} por donde entra la gente perdi${ld.drops.length > 1 ? "eron" : "ó"} muchas más visitas que el resto de la web (toda la web: ${ld.sitioDelta != null ? fDelta(ld.sitioDelta) : "—"})`,
      descripcion: ld.drops.map((d) => `${clip(d.path, 50)}: ${fInt(d.sesionesPrev)} → ${fInt(d.sesiones)} visitas (${fDelta(d.delta)})`).join(" · ") + ".",
      acciones: ["Pedile al equipo web que revise si cambió la dirección de la página, si se dio de baja o si redirige mal", "Mirá en Search Console si bajó en Google, y en Plan de Medios si se pausaron los avisos que llevaban ahí"],
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
          titulo: `${lab} online del mes: si sigue así, el mes cierra en ${fmt(p.cierre)} (${p.pctMeta != null ? fPct(p.pctMeta, 0) : "—"} de la meta de ${fmt(p.meta)})`,
          descripcion: `Van ${fmt(p.real)} con ${c.diasConDato} de ${c.diasMes} días. Lo más probable es terminar entre ${p.p10 != null ? fmt(p.p10) : "—"} y ${p.p90 != null ? fmt(p.p90) : "—"}: la meta queda por encima. Para llegar hacen falta ${p.necesarioDia != null ? fmt(p.necesarioDia) : "—"} por día y hoy se hacen ${fmt(p.ritmoDia)} por día.`,
          acciones: ["Revisá con quien maneja los avisos de venta (Performance Max y búsqueda en Google) qué se puede hacer en los días que quedan", "Si falta mucho, lanzá una acción comercial corta (cuotas, envío gratis)"],
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
      key: "web_ai_referrals", metrica: "sesiones", tipo: "oportunidad", prioridad: "baja",
      titulo: `Asistentes de IA como ChatGPT trajeron ${fInt(u.sesiones)} visitas en ${u.mes} (${fDelta(((u.sesiones - p.sesiones) / p.sesiones) * 100)} contra ${p.mes})`,
      descripcion: `${u.sesionesSitio ? `${fPct((u.sesiones / u.sesionesSitio) * 100, 2)} de la web. ` : ""}${fInt(u.transacciones)} compras (${fMoney(u.ingresos)}).`,
      acciones: ["Mirá en el tablero SEO (Visibilidad en IA) en qué preguntas aparece Drean", "Mejorá las páginas a las que llega esa gente"],
      datos: { meses: ms.slice(-4).map((m) => ({ mes: m.mes, sesiones: m.sesiones, compras: m.transacciones })) },
    });
  }
  return out;
}
