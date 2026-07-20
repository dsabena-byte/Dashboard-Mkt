// Registro de procesos de alimentación de datos y utilidades de estado.
// Fuente única de verdad, usada por el tab /monitoreo, el endpoint
// /api/cron/health y (vía ese endpoint) el watchdog de GitHub Actions.

export type Conn = "GitHub Action" | "Apps Script" | "n8n" | "Carga manual";
export type Estado = "ok" | "atrasado" | "critico" | "sindato";

export interface Proc {
  id: string;
  proceso: string;
  fuente: string;
  conexion: Conn;
  detalle: string; // endpoint / mecanismo
  cadenciaH: number; // periodicidad esperada, en horas
  tabla: string;
  db?: "principal" | "cb";
  col?: string;
  workflow?: string; // archivo del GitHub Action (para el watchdog)
  nota?: string;
}

export const PROCS: Proc[] = [
  { id: "ga4", proceso: "Tráfico Web (GA4)", fuente: "Google Analytics 4", conexion: "GitHub Action", detalle: "/api/cron/ga4-web-traffic · cada 6h", cadenciaH: 6, tabla: "web_traffic", col: "created_at", workflow: "ga4-sync.yml" },
  { id: "bgt", proceso: "BGT Inversión", fuente: "SharePoint", conexion: "GitHub Action", detalle: "/api/cron/bgt-sync · cada 6h", cadenciaH: 6, tabla: "bgt_marketing", workflow: "bgt-sync.yml" },
  { id: "meta_paid", proceso: "Meta Ads (paid)", fuente: "Meta Ads API", conexion: "GitHub Action", detalle: "/api/cron/meta-paid-sync · 1x/día", cadenciaH: 24, tabla: "meta_paid_creatives", col: "fetched_at", workflow: "meta-paid-sync.yml" },
  { id: "insights", proceso: "Insights orgánicos", fuente: "OpenAI / redes", conexion: "GitHub Action", detalle: "/api/cron/organic-insights · 1x/día", cadenciaH: 24, tabla: "insights_log", workflow: "organic-insights.yml" },
  { id: "ugc", proceso: "UGC comentarios", fuente: "Meta Graph API", conexion: "GitHub Action", detalle: "/api/cron/ugc-comments-* · 1x/día", cadenciaH: 24, tabla: "ugc_comments", col: "fetched_at", workflow: "ugc-comments-graph.yml" },
  { id: "dv360", proceso: "DV360 piezas", fuente: "DV360 (reporte por email)", conexion: "Apps Script", detalle: "Gmail → Supabase · trigger diario 9am", cadenciaH: 24, tabla: "dv360_creatives", nota: "Alimenta la tabla 'Por Medio'. Depende del trigger de Apps Script." },
  { id: "dv360_reach", proceso: "DV360 reach", fuente: "DV360 (reporte por email)", conexion: "Apps Script", detalle: "Gmail → Supabase · trigger diario 9am", cadenciaH: 24, tabla: "dv360_reach" },
  { id: "floor", proceso: "Floor Share", fuente: "Relevamiento góndola", conexion: "Apps Script", detalle: "Drive → Supabase CB · semanal", cadenciaH: 168, tabla: "floor_share", db: "cb" },
  { id: "cb", proceso: "Cuadros Básicos", fuente: "Cuadro Básico (Drive)", conexion: "Apps Script", detalle: "Drive → Supabase CB · semanal", cadenciaH: 168, tabla: "cuadro_basico_semanal", db: "cb" },
  { id: "planning", proceso: "Planning Pauta", fuente: "OMD Sheet/Drive", conexion: "Apps Script", detalle: "Drive → Supabase · semanal", cadenciaH: 168, tabla: "planning_media", col: "created_at" },
  { id: "mercado", proceso: "Mercado (GFK)", fuente: "GFK (export manual)", conexion: "Carga manual", detalle: "Seed SQL · trimestral", cadenciaH: 2160, tabla: "mercado_share" },
];

export function estadoDe(date: string | null, cadenciaH: number, nowMs: number): { estado: Estado; ageH: number | null } {
  if (!date) return { estado: "sindato", ageH: null };
  const ageH = (nowMs - new Date(date).getTime()) / 3_600_000;
  if (ageH <= cadenciaH * 1.5) return { estado: "ok", ageH };
  if (ageH <= cadenciaH * 3) return { estado: "atrasado", ageH };
  return { estado: "critico", ageH };
}

export const BADGE: Record<Estado, { label: string; cls: string; dot: string }> = {
  ok: { label: "OK", cls: "text-emerald-700 bg-emerald-50", dot: "bg-emerald-500" },
  atrasado: { label: "Atrasado", cls: "text-amber-700 bg-amber-50", dot: "bg-amber-500" },
  critico: { label: "Crítico", cls: "text-red-700 bg-red-50", dot: "bg-red-500" },
  sindato: { label: "Sin dato", cls: "text-muted-foreground bg-muted", dot: "bg-muted-foreground/40" },
};

export function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function fmtAge(ageH: number | null): string {
  if (ageH == null) return "";
  if (ageH < 1) return "hace <1h";
  if (ageH < 48) return `hace ${Math.round(ageH)}h`;
  return `hace ${Math.round(ageH / 24)}d`;
}
export function fmtCadencia(h: number): string {
  if (h < 24) return `cada ${h}h`;
  if (h < 168) return `1x/día`;
  if (h < 720) return `semanal`;
  return `trimestral`;
}
