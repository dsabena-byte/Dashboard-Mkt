import "server-only";
// ============================================================================
// Alertas por email + reporte ejecutivo mensual — portado de BIP (sep-2026), single-tenant (Drean).
//   · Resumen SEMANAL (lunes) con lo nuevo y lo que sigue abierto.
//   · Alertas DIARIAS solo si aparece algo NUEVO de prioridad alta (resto de los días).
//   · REPORTE EJECUTIVO el primer día hábil del mes (mes cerrado anterior).
// Candidatas: computeSignals() (lib/signals, todas las reglas) + desvíos de KPIs vs meta del
// Seguimiento (getSeguimientoKpis, solo meses CERRADOS) + anuncios nuevos de la competencia
// (snapshot de la Ad Library). Dedupe: alert_log; prefs: alert_prefs (singleton id=1) — migración
// 0108_alertas.sql. Sin migración: prefs por default, sin dedupe (el diario NO se envía, para no
// repetir lo mismo todos los días) y la UI avisa.
// Destinatarios: los de alert_prefs o, si no hay, env ALERT_RECIPIENTS (CSV).
// Todo por REST con la service key (sin cookies) salvo las fuentes de señales/Seguimiento, que usan
// sus propias queries (lectura anon/RLS, igual que en el dashboard).
// ============================================================================
import { computeSignals, type Signal } from "@/lib/signals";
import { getSeguimientoObjetivos } from "@/lib/objetivos-rollup";
import { getSeguimientoKpis } from "@/lib/objetivos-kpis";
import { cumplimientoPct } from "@/lib/metas";
import { getShareOfSearch } from "@/lib/competitive-queries";
import { getLatestReport } from "@/lib/insights/store";
import { getAdLibrarySnapshot } from "@/lib/ad-library";
import { isNewSince } from "@/lib/ad-library-shared";
import { getTenant } from "@/lib/tenant/current";
import { appUrl, sendEmail } from "@/lib/notify";
import { cleanRecipients, modoDelDia, isFirstBusinessDay, selectDigest, sortItems, FRECUENCIAS, type AlertItem, type AlertPrefs, type Frecuencia } from "@/lib/alerts-shared";

export type { AlertItem, AlertPrefs, Frecuencia } from "@/lib/alerts-shared";

const DASH_LABEL: Record<string, string> = {
  overview: "Seguimiento Objetivos", performance: "Plan de Medios", "competencia-pauta": "Pauta de la competencia",
  redes: "Redes Sociales", web: "Web / Ecommerce", "seo-search": "Optimización SEO", influencia: "Mkt de Influencia",
  "mkt-canal": "Mkt Canal Comercial", "cuadros-basicos": "Cuadros Básicos", "floor-share": "Floor Share",
  mercado: "Resultados Comerciales", "salud-marca": "Salud de Marca", "performance-conversion": "Performance → Conversión",
  funnel: "Inversión de Marketing",
};
const dashHref = (dash: string) => (dash === "competencia-pauta" ? "/performance/competencia" : `/${dash}`);
const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// ── REST (service key) ──────────────────────────────────────────────────────
function cfg() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
async function rest(path: string, init?: RequestInit): Promise<Response | null> {
  const c = cfg();
  if (!c) return null;
  try {
    return await fetch(`${c.url}/rest/v1/${path}`, { ...init, headers: { apikey: c.key, Authorization: `Bearer ${c.key}`, "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  } catch { return null; }
}

// ── Preferencias ────────────────────────────────────────────────────────────
const DEFAULT_PREFS: AlertPrefs = { emailOn: true, frecuencia: "auto", destinatarios: [], reporteOn: true, migrated: false };

export async function getAlertPrefs(): Promise<AlertPrefs> {
  const res = await rest("alert_prefs?id=eq.1&select=email_on,frecuencia,destinatarios,reporte_on");
  if (!res?.ok) return DEFAULT_PREFS;
  const rows = (await res.json().catch(() => [])) as { email_on: boolean; frecuencia: string; destinatarios: string[] | null; reporte_on: boolean }[];
  const d = rows[0];
  if (!d) return { ...DEFAULT_PREFS, migrated: true };
  const f = String(d.frecuencia ?? "auto") as Frecuencia;
  return {
    emailOn: d.email_on !== false,
    frecuencia: FRECUENCIAS.includes(f) ? f : "auto",
    destinatarios: Array.isArray(d.destinatarios) ? d.destinatarios : [],
    reporteOn: d.reporte_on !== false,
    migrated: true,
  };
}

export async function saveAlertPrefs(p: Omit<AlertPrefs, "migrated">, updatedBy?: string | null): Promise<void> {
  const res = await rest("alert_prefs?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: 1, email_on: p.emailOn, frecuencia: p.frecuencia, destinatarios: cleanRecipients(p.destinatarios), reporte_on: p.reporteOn, updated_at: new Date().toISOString(), updated_by: updatedBy ?? null }),
  });
  if (!res) throw new Error("Supabase no configurado");
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(/relation|does not exist|schema cache|42P01|PGRST205/i.test(t) ? "Falta correr la migración 0108_alertas.sql en Supabase." : `No se pudo guardar: ${t.slice(0, 200)}`);
  }
}

/** Destinatarios de env (fallback): ALERT_RECIPIENTS = "a@x.com,b@y.com". */
export function envRecipients(): string[] { return cleanRecipients(process.env.ALERT_RECIPIENTS ?? ""); }
export function resolveRecipients(prefs: AlertPrefs): string[] { return prefs.destinatarios.length ? prefs.destinatarios : envRecipients(); }

// ── Log / dedupe ────────────────────────────────────────────────────────────
/** Claves enviadas por `canal` en los últimos `days` días. null = tabla sin migrar. */
export async function sentKeys(days: number, canal = "email"): Promise<Set<string> | null> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const res = await rest(`alert_log?canal=eq.${canal}&sent_at=gte.${encodeURIComponent(since)}&select=key&limit=5000`);
  if (!res?.ok) return null;
  const rows = (await res.json().catch(() => [])) as { key: string }[];
  return new Set(rows.map((r) => r.key));
}
export async function logSent(keys: string[], canal: string): Promise<void> {
  if (!keys.length) return;
  await rest("alert_log", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(keys.map((key) => ({ key, canal }))) });
}
export async function lastSent(canal: string): Promise<string | null> {
  const res = await rest(`alert_log?canal=eq.${canal}&select=sent_at&order=sent_at.desc&limit=1`);
  if (!res?.ok) return null;
  const rows = (await res.json().catch(() => [])) as { sent_at: string }[];
  return rows[0]?.sent_at ?? null;
}
/** Latido de los crons (para /monitoreo y el watchdog): una fila canal="cron" por corrida. */
export async function logCronRun(nombre: string): Promise<void> {
  await logSent([`run:${nombre}:${new Date().toISOString().slice(0, 10)}`], "cron");
}

// ── Construcción de alertas ────────────────────────────────────────────────
function fromSignal(s: Signal): AlertItem {
  return { key: `sig:${s.key}`, fuente: "senal", dash: s.dash, tipo: s.tipo, prioridad: s.prioridad, titulo: s.titulo, descripcion: s.descripcion, accion: s.acciones?.[0] ?? null, href: dashHref(s.dash) };
}

/** Desvíos de KPIs vs meta del último mes CERRADO con dato (Seguimiento Objetivos). */
async function goalItems(now: Date): Promise<AlertItem[]> {
  const anio = now.getUTCFullYear();
  const lastClosed = now.getUTCMonth() - 1; // índice 0-based del último mes cerrado
  if (lastClosed < 0) return []; // enero: el mes cerrado es del año anterior → lo cubre el reporte
  const kpis = await getSeguimientoKpis(anio, false).catch(() => []);
  const out: AlertItem[] = [];
  for (const k of kpis) {
    let i = -1;
    for (let j = lastClosed; j >= 0; j--) if (k.realM[j] != null) { i = j; break; }
    if (i < 0 || k.metaM[i] == null || !k.metaM[i]) continue;
    const c = cumplimientoPct(k.realM[i], k.metaM[i], k.direccion);
    if (c == null || c >= k.umbralAmarillo) continue;
    const alta = c < k.umbralAmarillo * 0.8;
    out.push({
      key: `kpi:${k.plan}|${k.kpi}|${anio}-${i + 1}`,
      fuente: "objetivo", dash: "overview", tipo: "alerta", prioridad: alta ? "alta" : "media",
      titulo: `${k.kpi} (${k.plan}) al ${Math.round(c)}% de la meta en ${MES[i]}`,
      descripcion: `Por debajo del umbral de alerta (${k.umbralAmarillo}%). Revisá qué palanca de ${k.plan} explica la brecha.`,
      accion: "Abrí el Seguimiento Objetivos y mirá el KPI con más brecha.", href: "/overview",
    });
  }
  return out;
}

/** Anuncios nuevos de la competencia en los últimos 7 días (snapshot de la Ad Library). */
async function adItems(): Promise<AlertItem[]> {
  const snap = await getAdLibrarySnapshot();
  if (!snap) return [];
  const out: AlertItem[] = [];
  const week = Math.floor(Date.now() / (7 * 86_400_000));
  for (const b of snap.brands) {
    if (b.own) continue;
    const nuevos = b.ads.filter((a) => isNewSince(a, 7));
    if (!nuevos.length) continue;
    const fmts = [...new Set(nuevos.map((a) => a.format))].join(", ");
    out.push({
      key: `ads:${b.marca}|w${week}`, fuente: "competencia", dash: "competencia-pauta", tipo: "info",
      prioridad: nuevos.length >= 5 ? "alta" : "media",
      titulo: `${b.marca} lanzó ${nuevos.length} ${nuevos.length === 1 ? "anuncio nuevo" : "anuncios nuevos"} esta semana`,
      descripcion: `Formatos: ${fmts}. Mirá los creativos y el mensaje en Plan de Medios → Pauta de la competencia.`,
      accion: null, href: "/performance/competencia",
    });
  }
  return out;
}

/** Todas las alertas candidatas, ordenadas (alta → baja). Pesado (todas las señales): solo cron/API. */
export async function buildAlertItems(now = new Date()): Promise<AlertItem[]> {
  const [sigs, goals, ads] = await Promise.all([
    computeSignals().catch(() => [] as Signal[]),
    goalItems(now).catch(() => [] as AlertItem[]),
    adItems().catch(() => [] as AlertItem[]),
  ]);
  const items = [...goals, ...ads, ...sigs.filter((s) => s.tipo !== "info" || s.prioridad === "alta").map(fromSignal)];
  const seen = new Set<string>();
  return sortItems(items.filter((x) => (seen.has(x.key) ? false : (seen.add(x.key), true))));
}

// ── Email HTML (Drean · Marketing Dashboard) ───────────────────────────────
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const PRIO_COLOR: Record<string, { bg: string; fg: string; label: string }> = {
  alta: { bg: "#fee2e2", fg: "#b91c1c", label: "Prioridad alta" },
  media: { bg: "#fef3c7", fg: "#92400e", label: "Prioridad media" },
  baja: { bg: "#f1f5f9", fg: "#475569", label: "Info" },
};
const FONT = `-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif`;

function shell(title: string, intro: string, body: string, cta: { href: string; label: string }): string {
  const t = getTenant();
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:${FONT};color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
<tr><td style="background:#0f172a;padding:16px 24px"><span style="font-weight:600;font-size:19px;letter-spacing:-.01em;color:#fff">${esc(t.displayName)}</span><span style="color:#94a3b8;font-size:13px;font-weight:500"> · Marketing Dashboard</span></td></tr>
<tr><td style="padding:22px 24px 6px"><div style="font-size:18px;font-weight:600;letter-spacing:-.01em">${esc(title)}</div><div style="font-size:13.5px;color:#475569;margin-top:6px;line-height:1.5">${intro}</div></td></tr>
<tr><td style="padding:8px 24px 4px">${body}</td></tr>
<tr><td style="padding:14px 24px 24px"><a href="${cta.href}" style="display:inline-block;background:#1e40af;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px">${esc(cta.label)}</a></td></tr>
<tr><td style="padding:14px 24px;border-top:1px solid #f1f5f9;font-size:11.5px;color:#64748b;line-height:1.5">Recibís este email por la configuración de alertas del dashboard. Cambiala en <a href="${appUrl("/alerts")}" style="color:#1e40af">Alertas y reportes</a>.</td></tr>
</table></td></tr></table></body></html>`;
}

function itemHtml(x: AlertItem): string {
  const p = PRIO_COLOR[x.prioridad] ?? PRIO_COLOR.baja!;
  return `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin:0 0 10px">
<div style="font-size:11px;margin-bottom:6px"><span style="background:${p.bg};color:${p.fg};font-weight:600;border-radius:999px;padding:2px 8px">${p.label}</span> <span style="color:#64748b;font-weight:600;margin-left:6px">${esc(DASH_LABEL[x.dash] ?? x.dash)}</span>${x.nueva === false ? ` <span style="color:#64748b;margin-left:6px">· sigue abierta</span>` : ""}</div>
<div style="font-size:14.5px;font-weight:600;line-height:1.35"><a href="${appUrl(x.href)}" style="color:#0f172a;text-decoration:none">${esc(x.titulo)}</a></div>
<div style="font-size:13px;color:#475569;margin-top:4px;line-height:1.5">${esc(x.descripcion.slice(0, 320))}</div>
${x.accion ? `<div style="font-size:12.5px;color:#1e40af;margin-top:6px;font-weight:600">→ ${esc(x.accion)}</div>` : ""}</div>`;
}

export function renderDigestEmail(items: AlertItem[], modo: "semanal" | "diaria" | "prueba"): { subject: string; html: string } {
  const t = getTenant();
  const altas = items.filter((x) => x.prioridad === "alta").length;
  const subject = modo === "diaria"
    ? `${t.displayName} · ${altas} ${altas === 1 ? "alerta nueva" : "alertas nuevas"} de marketing`
    : modo === "prueba" ? `${t.displayName} · Prueba de alertas de marketing`
    : `${t.displayName} · Resumen semanal: ${items.length} ${items.length === 1 ? "punto" : "puntos"} para revisar`;
  const intro = items.length
    ? `${modo === "diaria" ? "Apareció algo importante en los datos." : "Lo más importante de la semana en los datos de marketing."} ${altas ? `<b style="font-weight:600">${altas}</b> de prioridad alta.` : ""}`
    : "No hay alertas para mostrar ahora: los datos están dentro de lo esperado (o todavía no hay suficientes datos).";
  const body = items.map(itemHtml).join("") || `<div style="font-size:13px;color:#475569;padding:6px 0 10px">Sin alertas.</div>`;
  return { subject, html: shell(modo === "diaria" ? "Alertas del día" : modo === "prueba" ? "Así se ve el email de alertas" : "Resumen semanal de alertas", intro, body, { href: appUrl("/overview"), label: "Abrir el dashboard" }) };
}

// ── Envío (cron / prueba) ──────────────────────────────────────────────────
export interface DigestResult { modo: string; enviado: boolean; items: number; destinatarios: number; motivo?: string; preview?: AlertItem[] }

export async function runDigest(opts: { force?: boolean; dry?: boolean; test?: boolean; modo?: "semanal" | "diaria"; to?: string[] } = {}): Promise<DigestResult> {
  const prefs = await getAlertPrefs();
  const frec: Frecuencia = prefs.emailOn ? prefs.frecuencia : "off";
  const modo = opts.test ? "prueba" : (opts.modo ?? (opts.force ? "semanal" : modoDelDia(frec)));
  const base = { modo: modo ?? "off", enviado: false, items: 0, destinatarios: 0 };
  if (!modo) return { ...base, motivo: frec === "off" ? "alertas por email apagadas" : "hoy no toca" };
  if (!opts.test && !opts.force && frec === "off") return { ...base, motivo: "alertas por email apagadas" };

  const all = await buildAlertItems();
  const sent = await sentKeys(modo === "diaria" ? 7 : 6);
  if (modo === "diaria" && !sent && !opts.test && !opts.force) return { ...base, motivo: "sin migración 0108 no se envían alertas diarias (no hay dedupe)" };
  const picked = selectDigest(all, sent, modo);
  if (!picked.length && modo !== "prueba") return { ...base, motivo: modo === "diaria" ? "nada nuevo de prioridad alta" : "sin alertas relevantes" };

  const to = opts.to?.length ? opts.to : resolveRecipients(prefs);
  if (opts.dry) return { ...base, items: picked.length, destinatarios: to.length, motivo: "dry-run", preview: picked };
  if (!to.length) return { ...base, items: picked.length, motivo: "sin destinatarios (configurá la lista en /alerts o ALERT_RECIPIENTS)" };
  const mail = renderDigestEmail(picked, modo);
  const r = await sendEmail(to, mail.subject, mail.html);
  if (r.ok) await logSent(modo === "prueba" ? ["test"] : picked.map((x) => x.key), modo === "prueba" ? "prueba" : "email");
  return { ...base, enviado: r.ok, items: picked.length, destinatarios: to.length, motivo: r.ok ? undefined : r.error };
}

// ── Reporte ejecutivo mensual ──────────────────────────────────────────────
const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v)}%`);
// = SEMAFORO_COLOR (verde ≥100, amarillo ≥90, rojo) — solo estado.
const semaforo = (v: number | null | undefined) => (v == null ? "#94a3b8" : v >= 100 ? "#16a34a" : v >= 90 ? "#d97706" : "#dc2626");

export async function buildExecutiveReport(now = new Date()): Promise<{ subject: string; html: string; resumen: Record<string, unknown> }> {
  const t = getTenant();
  const ar = new Date(now.getTime() - 3 * 3_600_000);
  const ref = new Date(Date.UTC(ar.getUTCFullYear(), ar.getUTCMonth() - 1, 1)); // mes cerrado anterior
  const anio = ref.getUTCFullYear(), mi = ref.getUTCMonth();
  const mesLbl = `${MES[mi]} ${anio}`;

  const [seg, kpis, items, sos, diag] = await Promise.all([
    getSeguimientoObjetivos(anio).catch(() => null),
    getSeguimientoKpis(anio, false).catch(() => []),
    buildAlertItems(now).catch(() => [] as AlertItem[]),
    getShareOfSearch().catch(() => []),
    getLatestReport("overview").catch(() => null),
  ]);

  // 1 · Objetivos (cumplimiento del mes reportado + YTD)
  let objHtml = `<div style="font-size:13px;color:#475569">Todavía no hay objetivos con metas en el Mapa Estratégico.</div>`;
  if (seg?.disponible) {
    const rows = seg.objetivos.map((o) => { const c = o.cumplSerie[mi] ?? null; return `<tr><td style="padding:7px 0;font-size:13.5px">${esc(o.nombre)}</td><td style="padding:7px 0;text-align:right;font-size:13.5px;font-weight:600;color:${semaforo(c)}">${pct(c)}</td><td style="padding:7px 0 7px 12px;text-align:right;font-size:12.5px;color:#475569">YTD ${pct(o.cumplYtd)}</td></tr>`; }).join("");
    const sm = seg.saludMarca.cumplSerie[mi] ?? null;
    objHtml = `<div style="font-size:13px;color:#475569;margin-bottom:6px">Salud de Marca (cumplimiento ponderado de los objetivos) · <b style="font-weight:600;color:${semaforo(sm)}">${pct(sm)}</b> en ${mesLbl} (YTD ${pct(seg.saludMarca.cumplYtd)})</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f1f5f9">${rows}</table>`;
  }

  // 2 · KPIs con más brecha
  const kpiRows: { kpi: string; plan: string; c: number }[] = [];
  for (const k of kpis) {
    const c = cumplimientoPct(k.realM[mi], k.metaM[mi], k.direccion);
    if (c != null) kpiRows.push({ kpi: k.kpi, plan: k.plan, c });
  }
  kpiRows.sort((a, b) => a.c - b.c);
  const kpiHtml = kpiRows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${kpiRows.slice(0, 8).map((k) => `<tr><td style="padding:6px 0;font-size:13px">${esc(k.kpi)} <span style="color:#64748b">· ${esc(k.plan)}</span></td><td style="padding:6px 0;text-align:right;font-size:13px;font-weight:600;color:${semaforo(k.c)}">${pct(k.c)} de la meta</td></tr>`).join("")}</table>`
    : `<div style="font-size:13px;color:#475569">Sin KPIs con meta y dato en ${mesLbl}.</div>`;

  // 3 · Share of search de la marca (promedio de las categorías, último mes con dato ≤ mes reportado)
  let mercadoHtml = "";
  let sosCur: number | null = null;
  const refYm = `${anio}-${String(mi + 1).padStart(2, "0")}`;
  const own = sos.filter((r) => r.marca?.toLowerCase() === t.ownBrand.label.toLowerCase() && r.mes.slice(0, 7) <= refYm);
  const meses = [...new Set(own.map((r) => r.mes.slice(0, 7)))].sort();
  const avgFor = (ym: string) => { const xs = own.filter((r) => r.mes.slice(0, 7) === ym).map((r) => r.share_pct); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
  const lastM = meses[meses.length - 1], prevM = meses[meses.length - 2];
  if (lastM) {
    sosCur = avgFor(lastM);
    const prevV = prevM ? avgFor(prevM) : null;
    if (sosCur != null) {
      const d = prevV != null ? sosCur - prevV : null;
      const cats = [...new Set(own.filter((r) => r.mes.slice(0, 7) === lastM).map((r) => `${r.categoria} ${r.share_pct.toFixed(1)}%`))].join(" · ");
      mercadoHtml = `<div style="font-size:13.5px">Share of search de ${esc(t.ownBrand.label)} (${MES[Number(lastM.slice(5, 7)) - 1]}): <b style="font-weight:600">${sosCur.toFixed(1)}%</b> promedio${d != null ? ` <span style="color:${d >= 0 ? "#16a34a" : "#dc2626"};font-weight:600">(${d >= 0 ? "+" : ""}${d.toFixed(1)} pp vs el mes anterior)</span>` : ""}.</div><div style="font-size:12px;color:#64748b;margin-top:3px">${esc(cats)}</div>`;
    }
  }

  // 4 · Señales principales
  const top = items.filter((x) => x.prioridad !== "baja").slice(0, 5);
  const sigHtml = top.length ? top.map(itemHtml).join("") : `<div style="font-size:13px;color:#475569">Sin alertas relevantes.</div>`;

  // 5 · Diagnóstico IA guardado del Seguimiento (si es reciente)
  let diagHtml = "";
  if (diag?.createdAt && Date.now() - new Date(diag.createdAt).getTime() < 40 * 86_400_000) {
    const txt = String(diag.insights?.diagnostico ?? "").trim();
    if (txt) diagHtml = `<div style="font-size:13.5px;line-height:1.55;color:#0f172a;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px">${esc(txt.slice(0, 900))}</div><div style="font-size:11.5px;color:#64748b;margin-top:4px">Diagnóstico IA del ${new Date(diag.createdAt).toLocaleDateString("es-AR")}.</div>`;
  }

  const sec = (title: string, h: string) => (h ? `<div style="margin:18px 0 8px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#64748b">${title}</div>${h}` : "");
  const body = sec("Objetivos", objHtml) + sec("KPIs con más brecha", kpiHtml) + sec("Mercado", mercadoHtml) + sec("Lo que hay que mirar", sigHtml) + sec("Diagnóstico", diagHtml);
  const intro = `Resumen de <b style="font-weight:600">${esc(t.displayName)}</b> para <b style="font-weight:600">${mesLbl}</b>: cumplimiento de objetivos, KPIs contra meta, share of search y las alertas principales.`;
  return {
    subject: `${t.displayName} · Reporte ejecutivo de marketing · ${mesLbl}`,
    html: shell(`Reporte ejecutivo · ${mesLbl}`, intro, body, { href: appUrl("/overview"), label: "Ver el Seguimiento completo" }),
    resumen: { mes: mesLbl, objetivos: seg?.objetivos.length ?? 0, kpis: kpiRows.length, alertas: top.length, shareOfSearch: sosCur, diagnostico: Boolean(diagHtml) },
  };
}

export async function runExecutiveReport(opts: { force?: boolean; dry?: boolean; test?: boolean; to?: string[] } = {}): Promise<{ enviado: boolean; motivo?: string; resumen?: Record<string, unknown> }> {
  const prefs = await getAlertPrefs();
  if (!prefs.reporteOn && !opts.force && !opts.test) return { enviado: false, motivo: "apagado en preferencias" };
  if (!opts.force && !opts.test && !isFirstBusinessDay()) return { enviado: false, motivo: "no es el primer día hábil del mes" };
  // Dedupe mensual (una vez por mes aunque el cron reintente).
  const monthKey = `reporte:${new Date().toISOString().slice(0, 7)}`;
  if (!opts.force && !opts.test && !opts.dry) { const s = await sentKeys(20, "reporte"); if (s?.has(monthKey)) return { enviado: false, motivo: "ya enviado este mes" }; }
  const rep = await buildExecutiveReport();
  const to = opts.to?.length ? opts.to : resolveRecipients(prefs);
  if (opts.dry) return { enviado: false, motivo: "dry-run", resumen: { ...rep.resumen, destinatarios: to.length } };
  if (!to.length) return { enviado: false, motivo: "sin destinatarios (configurá la lista en /alerts o ALERT_RECIPIENTS)", resumen: rep.resumen };
  const r = await sendEmail(to, rep.subject, rep.html);
  if (r.ok && !opts.test) await logSent([monthKey], "reporte"); // la prueba no cuenta como el envío del mes
  return { enviado: r.ok, motivo: r.ok ? undefined : r.error, resumen: rep.resumen };
}
