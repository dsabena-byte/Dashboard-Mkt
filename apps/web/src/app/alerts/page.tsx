import { getAlertPrefs, lastSent, envRecipients } from "@/lib/alerts";
import { emailEnabled } from "@/lib/notify";
import { AlertasForm } from "@/components/alertas/alertas-form";
import { AlertasPreview } from "@/components/alertas/alertas-preview";

// Alertas y reportes (portado de BIP, sep-2026; reemplaza el placeholder). El render solo lee las
// preferencias y el último envío (REST, instantáneo); "Qué te avisaríamos hoy" se calcula en la API
// al abrir la página. Envíos: crons /api/cron/alertas y /api/cron/reporte-ejecutivo (workflow alertas.yml).
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const CARDS = [
  { t: "En el dashboard", d: "Señales en cada tablero y en el Diagnóstico IA." },
  { t: "Resumen semanal por email", d: "Los lunes: lo nuevo y lo que sigue abierto." },
  { t: "Alertas diarias por email", d: "Solo si aparece algo nuevo de prioridad alta." },
  { t: "Reporte ejecutivo mensual", d: "El primer día hábil: objetivos, KPIs vs meta, share of search, alertas y diagnóstico." },
];

export default async function AlertsPage() {
  const [prefs, lastEmail, lastReport] = await Promise.all([getAlertPrefs(), lastSent("email"), lastSent("reporte")]);
  const fdate = (s: string | null) => (s ? new Date(s).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "todavía no");
  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Alertas y reportes</h2>
        <p className="text-sm text-muted-foreground">
          El dashboard revisa los datos todos los días y avisa lo que merece atención: KPIs por debajo de la meta, cambios fuera de lo normal, oportunidades y anuncios nuevos de la competencia.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((c) => (
          <div key={c.t} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="text-sm font-semibold">{c.t}</div>
            <p className="mt-1 text-xs text-muted-foreground">{c.d}</p>
          </div>
        ))}
      </div>
      <AlertasForm
        initial={{ emailOn: prefs.emailOn, frecuencia: prefs.frecuencia, destinatarios: prefs.destinatarios, reporteOn: prefs.reporteOn }}
        migrated={prefs.migrated}
        emailReady={emailEnabled()}
        envRecipients={envRecipients()}
        lastEmail={fdate(lastEmail)}
        lastReport={fdate(lastReport)}
      />
      <AlertasPreview />
      <p className="text-[11px] text-muted-foreground">Las alertas llegan por email (Resend). Fuentes: motor de señales de cada tablero, desvíos de KPIs del Seguimiento Objetivos (meses cerrados) y la Biblioteca de anuncios de Meta.</p>
    </div>
  );
}
