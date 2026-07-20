import { getHealth } from "@/lib/monitoreo-queries";
import { BADGE, fmtDate, fmtAge, fmtCadencia } from "@/lib/monitoreo-config";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function MonitoreoPage() {
  const rows = await getHealth();
  const alertas = rows.filter((r) => r.estado === "critico" || r.estado === "atrasado");

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Monitoreo de procesos</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Estado de los procesos automáticos que alimentan los dashboards: fuente, tipo de conexión, periodicidad y
          última actualización real. El semáforo se calcula por antigüedad vs periodicidad esperada. Un watchdog revisa
          esto cada 6h, reintenta los syncs que fallan y abre una alerta (GitHub Issue) ante un desvío.
        </p>
      </header>

      {alertas.length > 0 ? (
        <div className="rounded-xl border border-l-[5px] border-l-red-500 bg-red-50/50 p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-red-700">
            ⚠ {alertas.length} proceso{alertas.length > 1 ? "s" : ""} con desvío
          </div>
          <ul className="space-y-1 text-xs text-red-900">
            {alertas.map((r) => (
              <li key={r.proc.id}>
                <span className="font-semibold">{r.proc.proceso}</span> — {BADGE[r.estado].label.toLowerCase()} ({fmtAge(r.ageH)}, esperado {fmtCadencia(r.proc.cadenciaH)})
                {r.proc.conexion === "Apps Script" && " · requiere correr/activar el Apps Script"}
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
                <tr key={r.proc.id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${BADGE[r.estado].cls}`}>
                      <span className={`inline-block h-1.5 w-1.5 rounded-full ${BADGE[r.estado].dot}`} />
                      {BADGE[r.estado].label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">{r.proc.proceso}</div>
                    {r.proc.nota && <div className="mt-0.5 text-[10px] text-muted-foreground">{r.proc.nota}</div>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.proc.fuente}</td>
                  <td className="px-3 py-2">
                    <span className="text-foreground">{r.proc.conexion}</span>
                    <div className="text-[10px] text-muted-foreground">{r.proc.detalle}</div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtCadencia(r.proc.cadenciaH)}</td>
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
