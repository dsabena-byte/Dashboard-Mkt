// WhatsApp (Evolution API) — helpers PUROS y client-safe: normalización de números y armado de
// mensajes (sin HTML, con *negrita* de WhatsApp). La parte server (envío, estado, latido) está en
// lib/whatsapp.ts. Test: cd apps/web && npx tsx scripts/whatsapp.test.ts
import type { AlertItem } from "@/lib/alerts-shared";

/** Largo máximo del mensaje (WhatsApp acepta más, pero en el celular se lee mejor corto). */
export const WA_MAX_CHARS = 1500;
export const WA_MAX_DESTINATARIOS = 20;
export const WA_DEFAULT_APP_URL = "https://dashboard-mkt-seven.vercel.app";

// ── Números ─────────────────────────────────────────────────────────────────

/** Quita el "15" de celular AR que va después de la característica (11 15 1234-5678 → 1112345678). */
function stripAr15(nat: string): string {
  if (nat.length !== 12) return nat;
  if (/^1115\d{8}$/.test(nat)) return "11" + nat.slice(4); // AMBA primero (caso más común)
  for (const L of [3, 4, 2]) if (nat.slice(L, L + 2) === "15") return nat.slice(0, L) + nat.slice(L + 2);
  return nat;
}

/** Número nacional AR (característica + abonado) → formato internacional de celular 549XXXXXXXXXX. */
function arNational(nat: string): string | null {
  let n = nat.replace(/^0+/, "");
  n = stripAr15(n);
  return /^\d{10}$/.test(n) ? `549${n}` : null;
}

/**
 * Normaliza un número a lo que pide Evolution (`number`): solo dígitos, con código de país, sin "+".
 * Argentina (celulares): "11 1234-5678", "011 15 1234-5678", "+54 11 1234 5678", "+54 9 11 1234-5678"
 * → "5491112345678". Otros países: si viene con "+" o "00" se respeta tal cual (8–15 dígitos).
 * Devuelve null si no parece un número válido.
 */
export function normalizeWhatsAppNumber(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const intl = /^(\+|00)/.test(s);
  let d = s.replace(/\D/g, "");
  if (s.startsWith("00")) d = d.replace(/^00/, "");
  if (!d) return null;
  if (d.startsWith("54") && (intl || d.length >= 12)) {
    let rest = d.slice(2);
    if (rest.startsWith("9")) rest = rest.slice(1);
    return arNational(rest);
  }
  if (intl) return /^\d{8,15}$/.test(d) ? d : null; // otro país, con prefijo internacional explícito
  return arNational(d); // sin prefijo = número argentino
}

/** Lista de números (array o texto separado por coma/;/salto de línea) → normalizados, sin repetidos. */
export function cleanPhones(list: unknown): string[] {
  const arr = Array.isArray(list) ? list : String(list ?? "").split(/[,;\n]+/);
  const out: string[] = [];
  for (const x of arr) {
    const n = normalizeWhatsAppNumber(x);
    if (n && !out.includes(n)) out.push(n);
  }
  return out.slice(0, WA_MAX_DESTINATARIOS);
}

/** Para mostrar: 5491112345678 → +54 9 11 1234-5678 (otros países: +dígitos). */
export function formatPhone(n: string): string {
  const m = /^549(11)(\d{4})(\d{4})$/.exec(n) ?? /^549(\d{3})(\d{3})(\d{4})$/.exec(n);
  return m ? `+54 9 ${m[1]} ${m[2]}-${m[3]}` : `+${n}`;
}

// ── Mensajes ────────────────────────────────────────────────────────────────

/** Saca los caracteres de formato de WhatsApp del contenido (para que no rompan la negrita). */
export function waPlain(s: string | null | undefined): string {
  return String(s ?? "").replace(/[*_~`]/g, "").replace(/\s+/g, " ").trim();
}
export function clip(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, Math.max(0, n - 1));
  const sp = cut.lastIndexOf(" ");
  return `${(sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s.,;:]+$/, "")}…`;
}
const joinUrl = (base: string, path: string) => `${(base || WA_DEFAULT_APP_URL).replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

const QUE_HACER_DEFAULT: Record<AlertItem["fuente"], string> = {
  senal: "Abrí el tablero y revisá qué cambió.",
  objetivo: "Abrí el Seguimiento Objetivos y mirá el KPI con más brecha.",
  competencia: "Mirá los anuncios nuevos en Pauta de la competencia.",
  umbral: "Abrí el tablero y revisá qué cambió ese mes.",
};

export interface WaCtx { marca: string; appUrl: string }

/** Una alerta en 3–4 líneas: título en negrita, qué pasa (corto), qué hacer y link. */
function itemLines(x: AlertItem, i: number, descMax: number, ctx: WaCtx, withLink: boolean): string {
  const lines = [`*${i + 1}. ${clip(waPlain(x.titulo), 140)}*${x.prioridad === "alta" ? " (prioridad alta)" : ""}`];
  const desc = waPlain(x.descripcion);
  if (desc && descMax > 0) lines.push(clip(desc, descMax));
  lines.push(`Qué hacer: ${clip(waPlain(x.accion) || QUE_HACER_DEFAULT[x.fuente], 160)}`);
  if (withLink) lines.push(joinUrl(ctx.appUrl, x.href));
  return lines.join("\n");
}

/** Arma el mensaje probando de más detallado a más compacto hasta que entre en `max`. */
function fitItems(head: (shown: number) => string[], items: AlertItem[], foot: string[], ctx: WaCtx, max: number): { text: string; shown: AlertItem[] } {
  const tries: { n: number; desc: number; link: boolean }[] = [
    { n: 5, desc: 180, link: true }, { n: 5, desc: 110, link: true }, { n: 4, desc: 110, link: true },
    { n: 4, desc: 70, link: false }, { n: 3, desc: 70, link: false }, { n: 3, desc: 0, link: false },
  ];
  let last = { text: "", shown: [] as AlertItem[] };
  for (const t of tries) {
    const shown = items.slice(0, t.n);
    const body = shown.map((x, i) => itemLines(x, i, t.desc, ctx, t.link));
    last = { text: [...head(shown.length), ...body, ...foot].join("\n\n"), shown };
    if (last.text.length <= max) return last;
  }
  return { text: clip(last.text, max), shown: last.shown };
}

/** Digest de alertas (semanal / diaria / prueba) para WhatsApp: 3–5 alertas en lenguaje simple. */
export function formatAlertsWhatsApp(items: AlertItem[], modo: "semanal" | "diaria" | "prueba", ctx: WaCtx, max = WA_MAX_CHARS): string {
  return buildAlertsWhatsApp(items, modo, ctx, max).text;
}

/** Igual que formatAlertsWhatsApp, pero además dice qué alertas entraron (para el dedupe del cron). */
export function buildAlertsWhatsApp(items: AlertItem[], modo: "semanal" | "diaria" | "prueba", ctx: WaCtx, max = WA_MAX_CHARS): { text: string; shown: AlertItem[] } {
  const altas = items.filter((x) => x.prioridad === "alta").length;
  const titulo = modo === "diaria" ? "Alertas del día" : modo === "prueba" ? "Prueba de alertas" : "Resumen semanal de alertas";
  const intro = (shown: number) => {
    if (!items.length) return "No hay alertas ahora: los datos están dentro de lo esperado.";
    const base = modo === "diaria" ? `Apareció algo importante en los datos${altas ? ` (${altas} de prioridad alta)` : ""}.` : "Lo más importante de la semana.";
    return items.length > shown ? `${base} Acá van ${shown} de ${items.length}; el resto, en el dashboard.` : base;
  };
  const head = (shown: number) => [`*${waPlain(ctx.marca)} · ${titulo}*`, intro(shown)];
  const foot = [`Ver todo en el dashboard: ${joinUrl(ctx.appUrl, "/alerts")}`];
  if (!items.length) return { text: [...head(0), ...foot].join("\n\n"), shown: [] };
  return fitItems(head, items, foot, ctx, max);
}

export interface ReporteWaData {
  mesLbl: string;
  saludMarca: { mes: number | null; ytd: number | null } | null;
  objetivos: { nombre: string; mes: number | null; ytd: number | null }[];
  kpisBrecha: { kpi: string; plan: string; c: number }[];
  shareOfSearch: number | null;
  alertas: AlertItem[];
}

const pctTxt = (v: number | null | undefined) => (v == null ? "sin dato" : `${Math.round(v)}%`);
/** Estado en palabras (el semáforo del dashboard: ≥100 cumplido, ≥90 cerca, resto con brecha). */
export const estadoTxt = (v: number | null | undefined) => (v == null ? "" : v >= 100 ? "cumplido" : v >= 90 ? "cerca" : "con brecha");

/** Reporte ejecutivo mensual para WhatsApp: scorecard corto + 3 alertas principales. */
export function formatReporteWhatsApp(d: ReporteWaData, ctx: WaCtx, max = WA_MAX_CHARS): string {
  const head: string[] = [`*${waPlain(ctx.marca)} · Reporte ejecutivo de ${d.mesLbl}*`];
  const score: string[] = [];
  if (d.saludMarca) score.push(`*Salud de Marca:* ${pctTxt(d.saludMarca.mes)} de cumplimiento (${estadoTxt(d.saludMarca.mes) || "sin dato"}) · acumulado del año ${pctTxt(d.saludMarca.ytd)}`);
  for (const o of d.objetivos.slice(0, 5)) score.push(`• ${clip(waPlain(o.nombre), 40)}: ${pctTxt(o.mes)}${o.ytd != null ? ` (año ${pctTxt(o.ytd)})` : ""}`);
  if (!score.length) score.push("Todavía no hay objetivos con metas cargadas en el Mapa Estratégico.");
  head.push(score.join("\n"));
  const brecha = d.kpisBrecha.filter((k) => k.c < 100).slice(0, 4);
  head.push(brecha.length
    ? `*KPIs con más brecha*\n${brecha.map((k) => `• ${clip(waPlain(k.kpi), 40)} (${clip(waPlain(k.plan), 24)}): ${Math.round(k.c)}% de la meta`).join("\n")}`
    : "*KPIs:* todos en meta o sin dato este mes.");
  if (d.shareOfSearch != null) head.push(`*Share of search:* ${d.shareOfSearch.toFixed(1).replace(".", ",")}% (promedio de las categorías)`);
  const foot = [`Ver el Seguimiento completo: ${joinUrl(ctx.appUrl, "/overview")}`];
  const top = d.alertas.filter((x) => x.prioridad !== "baja").slice(0, 3);
  if (!top.length) return clip([...head, ...foot].join("\n\n"), max);
  const tries = [{ desc: 110, link: false }, { desc: 0, link: false }];
  let last = "";
  for (const t of tries) {
    for (const n of [3, 2, 1]) {
      const body = [`*Lo que hay que mirar*`, ...top.slice(0, n).map((x, i) => itemLines(x, i, t.desc, ctx, t.link))];
      last = [...head, ...body, ...foot].join("\n\n");
      if (last.length <= max) return last;
    }
  }
  return clip([...head, ...foot].join("\n\n"), max);
}

/** Mensaje corto de prueba ("¿llega?"). */
export function formatTestWhatsApp(ctx: WaCtx): string {
  return [
    `*${waPlain(ctx.marca)} · Prueba de WhatsApp*`,
    "Si leés esto, las alertas y el reporte ejecutivo del dashboard de marketing te van a llegar por acá.",
    `Configuración: ${joinUrl(ctx.appUrl, "/alerts")}`,
  ].join("\n\n");
}
