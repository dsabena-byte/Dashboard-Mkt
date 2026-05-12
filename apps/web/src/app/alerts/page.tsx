export default function AlertsPage() {
  return (
    <div className="space-y-2">
      <h2 className="text-2xl font-semibold tracking-tight">Alertas</h2>
      <p className="text-sm text-muted-foreground">
        Reglas de alerta sobre desvíos vs planning y log de disparos.
      </p>
      <div className="mt-6 rounded-lg border bg-card p-12 text-center text-sm text-muted-foreground">
        Placeholder — CRUD sobre <code>alerts_config</code>, log de <code>alerts_log</code>.
      </div>
    </div>
  );
}
