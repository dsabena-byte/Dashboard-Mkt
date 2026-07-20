import { maxUpdatedAt } from "@/lib/freshness-queries";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// ============================================================================
// Monitoreo de procesos de alimentación de datos.
// Cada proceso declara: fuente, tipo de conexión, periodicidad esperada y la
// tabla + columna timestamp con la que se mide la última actualización real.
// El estado (semáforo) se deriva de la antigüedad vs la periodicidad esperada.
// ============================================================================

type Conn = "GitHub Action" | "Apps Script" | "n8n" | "Carga manual";

interface Proc {
  proceso: string;
  fuente: string;
  conexion: Conn;
  detalle: string; // endpoint / mecanismo
  cadenciaH: number; // periodicidad esperada, en horas
  tabla: string;
  db?: "principal" | "cb";
  col?: string;
  nota?: string;
}

const PROCS: Proc[] = [
  { proceso: "Tráfico Web (GA4)", fuente: "Google Analytics 4", conexion: "GitHub Action", detalle: "/api/cron/ga4-web-traffic · cada 6h", cadenciaH: 6, tabla: "web_traffic", col: "created_at" },
  { proceso: "BGT Inversión", fuente: "SharePoint", conexion: "GitHub Action", detalle: "/api/cron/bgt-sync · cada 6h", cadenciaH: 6, tabla: "bgt_marketing" },
  { proceso: "Meta Ads (paid)", fuente: "Meta Ads API", conexion: "GitHub Action", detalle: "/api/cron/meta-paid-sync · 1x/día", cadenciaH: 24, tabla: "meta_paid_creatives", col: "fetched_at" },
  { proceso: "Insights orgánicos", fuente: "OpenAI / redes", conexion: "GitHub Action", detalle: "/api/cron/organic-insights · 1x/día", cadenciaH: 24, tabla: "insights_log" },
  { proceso: "UGC comentarios", fuente: "Meta Graph API", conexion: "GitHub Action", detalle: "/api/cron/ugc-comments-* · 1x/día", cadenciaH: 24, tabla: "ugc_comments", col: "fetched_at" },
  { proceso: "DV360 piezas", fuente: "DV360 (reporte por email)", conexion: "Apps Script", detalle: "Gmail → Supabase · trigger diario 9am", cadenciaH: 24, tabla: "dv360_creatives", nota: "Alimenta la tabla 'Por Medio'. Depende del trigger de Apps Script." },
  { proceso: "DV360 reach", fuente: "DV360 (reporte por email)", conexion: "Apps Script", detalle: "Gmail → Supabase · trigger diario 9am", cadenciaH: 24, tabla: "dv360_reach" },
  { proceso: "Floor Share", fuente: "Relevamiento góndola", conexion: "Apps Script", detalle: "Drive → Supabase CB · semanal", cadenciaH: 168, tabla: "floor_share", db: "cb" },
  { proceso: "Cuadros Básicos", fuente: "Cuadro Básico (Drive)", conexion: "Apps Script", detalle: "Drive → Supabase CB · semanal", cadenciaH: 168, tabla: "cuadro_basico_semanal", db: "cb" },
  { proceso: "Planning Pauta", fuente: "OMD Sheet/Drive", conexion: "Apps Script", detalle: "Drive → Supabase · semanal", cadenciaH: 168, tabla: "planning_media", col: "created_at" },
  { proceso: "Mercado (GFK)", fuente: "GFK (export manual)", conexion: "Carga manual", detalle: "Seed SQL · trimestral", cadenciaH: 2160, tabla: "mercado_share" },
];

type Estado = "ok" | "atrasado" | "critico" | "sindato";

function estadoDe(date: string | null, cadenciaH: number): { estado: Estado; ageH: number | null } {
  if (!date) return { estado: "sindato", ageH: null };
  const ageMs = Date.now() - new Date(date).getTime();
  const ageH = ageMs / 3_600_000;
  if (ageH <= cadenciaH * 1.5) return { estado: "ok", ageH };
  if (ageH <= cadenciaH * 3) return { estado: "atrasado", ageH };
  return { estado: "critico", ageH };
}

const BADGE: Record<Estado, { label: string; cls: string; dot: string }> = {
  ok: { label: "OK", cls: "text-emerald-700 bg-emerald-50", dot: "bg-emerald-500" },
  atrasado: { label: "Atrasado", cls: "text-amber-700 bg-amber-50", dot: "bg-amber-500" },
  critico: { label: "Crítico", cls: "text-red-700 bg-red-50", dot: "bg-red-500" },
  sindato: { label: "Sin dato", cls: "text-muted-foreground bg-muted", dot: "bg-muted-foreground/40" },
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtAge(ageH: number | null): string {
  if (ageH == null) return "";
  if (ageH < 1) return "hace <1h";
  if (ageH < 48) return `hace ${Math.round(ageH)}h`;
  return `hace ${Math.round(ageH / 24)}d`;
}
function fmtCadencia(h: number): string {
  if (h < 24) return `cada ${h}h`;
  if (h < 168) return `1x/día`;
  if (h < 720) return `semanal`;
  return `trimestral`;
}

export default async function MonitoreoPage() {
  const dates = await Promise.all(PROCS.map((p) => maxUpdatedAt(p.tabla, p.db ?? "principal", p.col ?? "updated_at").catch(() => null)));
  const rows = PROCS.map((p, i) => ({ p, date: dates[i]!, ...estadoDe(dates[i]!, p.cadenciaH) }));

  const alertas = rows.filter((r) => r.estado === "critico" || r.estado === "atrasado");

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Monitoreo de procesos</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Estado de los procesos automáticos que alimentan los dashboards: fuente, tipo de conexión, periodicidad y
          última actualización real. El semáforo se calcula por antigüedad vs periodicidad esperada.
        </p>
      </header>

      {/* Panel de alertas */}
      {alertas.length > 0 ? (
        <div className="rounded-xl border border-l-[5px] border-l-red-500 bg-red-50/50 p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-red-700">
            ⚠ {alertas.length} proceso{alertas.length > 1 ? "s" : ""} con desvío
          </div>
          <ul className="space-y-1 text-xs text-red-900">
            {alertas.map((r) => (
              <li key={r.p.proceso}>
                <span className="font-semibold">{r.p.proceso}</span> — {BADGE[r.estado].label.toLowerCase()} ({fmtAge(r.ageH)}, esperado {fmtCadencia(r.p.cadenciaH)})
                {r.p.conexion === "Apps Script" && " · requiere correr/activar el Apps Script"}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-xl border border-l-[5px] border-l-emerald-500 bg-emerald-50/50 p-4 text-xs font-medium text-emerald-800">
          ✓ Todos los procesos dentro de su periodicidad esperada.
        </div>
      )}

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Proceso</th>
                <th className="px-3 py-2 text-left">Fuente</th>
                <th className="px-3 py-2 text-left">Conexión</th>
                <th className="px-3 py-2 text-left">Periodicidad</th>
                <th className="px-3 py-2 text-right">Última actualización</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.p.proceso} className="border-t align-top">
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${BADGE[r.estado].cls}`}>
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${BADGE[r.estado].dot}`} />
                      {BADGE[r.estado].label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">{r.p.proceso}</div>
                    {r.p.nota && <div className="mt-0.5 text-[10px] text-muted-foreground">{r.p.nota}</div>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.p.fuente}</td>
                  <td className="px-3 py-2">
                    <span className="text-foreground">{r.p.conexion}</span>
                    <div className="text-[10px] text-muted-foreground">{r.p.detalle}</div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtCadencia(r.p.cadenciaH)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <div className="text-foreground">{fmtDate(r.date)}</div>
                    <div className="text-[10px] text-muted-foreground">{fmtAge(r.ageH)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] text-muted-foreground">
        <strong>Conexiones:</strong> <b>GitHub Action</b> = cron en el repo (Actions), reintentable automáticamente ·{" "}
        <b>Apps Script</b> = Google (Gmail/Drive → Supabase), corre en tu cuenta · <b>Carga manual</b> = seed SQL.
        Los procesos “Sin dato” pueden no exponer columna de timestamp (monitoreo a afinar), no implican falla.
      </p>
    </div>
  );
}
