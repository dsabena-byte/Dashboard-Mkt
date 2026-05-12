export default function CompetitorsPage() {
  return (
    <div className="space-y-2">
      <h2 className="text-2xl font-semibold tracking-tight">Competencia</h2>
      <p className="text-sm text-muted-foreground">
        Tráfico web (Apify) + métricas sociales del scraper existente.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Placeholder — <code>competitor_web</code> (Apify, fase 2)
        </div>
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Placeholder — <code>social_metrics</code> + <code>social_competitor</code>
        </div>
      </div>
    </div>
  );
}
