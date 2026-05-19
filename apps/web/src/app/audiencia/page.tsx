import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangeInfo } from "@/components/date-range-info";
import { KpiCard } from "@/components/kpi-card";
import { getDemographicsSummary } from "@/lib/queries";
import { parseDateRange } from "@/lib/dates";
import { formatNumber } from "@/lib/utils";

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

const AGE_ORDER = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+", "unknown"];

function genderLabel(g: string): string {
  switch (g) {
    case "male":
      return "Hombres";
    case "female":
      return "Mujeres";
    case "unknown":
      return "No identificado";
    default:
      return g;
  }
}

function deviceLabel(d: string): string {
  switch (d) {
    case "mobile":
      return "Mobile";
    case "desktop":
      return "Desktop";
    case "tablet":
      return "Tablet";
    case "unknown":
      return "Sin clasificar";
    default:
      return d;
  }
}

interface BarRow {
  label: string;
  sessions: number;
  total_users: number;
}

function HorizontalBars({ rows, accent = "bg-emerald-500" }: { rows: BarRow[]; accent?: string }) {
  if (rows.length === 0) {
    return <div className="text-xs text-muted-foreground">Sin datos en el rango.</div>;
  }
  const max = Math.max(...rows.map((r) => r.sessions), 1);
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label} className="text-xs">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate font-medium">{r.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatNumber(r.sessions)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`${accent} h-full rounded-full`}
              style={{ width: `${(r.sessions / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function AudienciaPage({ searchParams }: PageProps) {
  const range = parseDateRange(searchParams);
  const demo = await getDemographicsSummary(range);

  const ageRows: BarRow[] = [...demo.byAge]
    .sort((a, b) => {
      const ai = AGE_ORDER.indexOf(a.age_bracket);
      const bi = AGE_ORDER.indexOf(b.age_bracket);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    })
    .map((r) => ({ label: r.age_bracket, sessions: r.sessions, total_users: r.total_users }));

  const genderRows: BarRow[] = demo.byGender.map((r) => ({
    label: genderLabel(r.gender),
    sessions: r.sessions,
    total_users: r.total_users,
  }));

  const deviceRows: BarRow[] = demo.byDevice.map((r) => ({
    label: deviceLabel(r.device_category),
    sessions: r.sessions,
    total_users: r.total_users,
  }));

  const regionRows: BarRow[] = demo.byRegion.map((r) => ({
    label: r.region,
    sessions: r.sessions,
    total_users: r.total_users,
  }));

  const cityRows: BarRow[] = demo.byCity.map((r) => ({
    label: r.city ? `${r.city} · ${r.region || "—"}` : r.region,
    sessions: r.sessions,
    total_users: r.total_users,
  }));

  const interestRows: BarRow[] = demo.byInterest.map((r) => ({
    label: r.interest_category,
    sessions: r.sessions,
    total_users: r.total_users,
  }));

  const hasData = demo.totals.sessions > 0;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Audiencia</h2>
          <p className="text-sm text-muted-foreground">
            Demografía, geolocalización e intereses del tráfico web (GA4).
          </p>
        </div>
        <DateRangeInfo range={range} />
      </header>

      {!hasData && (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          No hay datos demográficos en el rango. Verificá que el workflow{" "}
          <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">
            GA4 Demographics Sync
          </code>{" "}
          esté corriendo y que las tablas{" "}
          <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">ga4_demo_*</code>{" "}
          tengan filas en Supabase.
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Sesiones (con demo)" value={formatNumber(demo.totals.sessions)} />
        <KpiCard title="Usuarios" value={formatNumber(demo.totals.users)} />
        <KpiCard
          title="Regiones top"
          value={formatNumber(demo.byRegion.length)}
          hint="con tráfico en el rango"
        />
        <KpiCard
          title="Intereses in-market"
          value={formatNumber(demo.byInterest.length)}
          hint="categorías GA4 detectadas"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Edad</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBars rows={ageRows} accent="bg-emerald-500" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Género</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBars rows={genderRows} accent="bg-sky-500" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dispositivo</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBars rows={deviceRows} accent="bg-violet-500" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top regiones</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBars rows={regionRows} accent="bg-amber-500" />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top ciudades</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBars rows={cityRows} accent="bg-rose-500" />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Categorías de interés (in-market)</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBars rows={interestRows} accent="bg-teal-500" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
