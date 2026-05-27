import { KpiCard } from "@/components/kpi-card";

export const dynamic = "force-dynamic";

export default function PerformancePautaPage() {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Performance Pauta</h2>
        <p className="text-sm text-muted-foreground">
          Resultados reales de campañas digitales por categoría. Funnel: Awareness → Consideración → Conversión.
        </p>
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {["Todas", "Lavado", "Refrigeración", "Cocción", "Brand", "Promoción"].map((cat) => (
          <span
            key={cat}
            className="cursor-pointer rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary"
          >
            {cat}
          </span>
        ))}
      </div>

      {/* UPPER FUNNEL — Awareness */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Upper Funnel · Awareness
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard title="Alcance total" value="—" hint="Usuarios únicos alcanzados" />
          <KpiCard title="Impresiones" value="—" hint="Total del período" />
          <KpiCard title="Frecuencia" value="—" hint="Promedio ponderado" />
          <KpiCard title="CPM promedio" value="—" hint="Costo por mil impresiones" />
          <KpiCard title="Inversión total" value="—" hint="ARS ejecutado" />
        </div>
      </section>

      {/* MID FUNNEL — Consideración */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Mid Funnel · Consideración
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard title="Clicks totales" value="—" hint="Total del período" />
          <KpiCard title="Video Views" value="—" hint="Total del período" />
          <KpiCard title="CTR promedio" value="—" hint="Click-through rate" />
          <KpiCard title="CPC" value="—" hint="Costo por click" />
          <KpiCard title="Inversión total" value="—" hint="ARS ejecutado" />
        </div>
      </section>

      {/* Desglose por plataforma */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Desglose por plataforma
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { name: "Meta (IG + FB)", color: "#E1306C" },
            { name: "TikTok", color: "#000000" },
            { name: "YouTube", color: "#FF0000" },
            { name: "Programmatic (DV360)", color: "#4285F4" },
            { name: "Google Search", color: "#34A853" },
            { name: "Google Demand Gen", color: "#FBBC05" },
          ].map((p) => (
            <div key={p.name} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-xs font-semibold">{p.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Inversión</div>
                  <div className="font-semibold">—</div>
                </div>
                <div>
                  <div className="text-muted-foreground">CPM / CPC</div>
                  <div className="font-semibold">—</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Impresiones</div>
                  <div className="font-semibold">—</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Alcance</div>
                  <div className="font-semibold">—</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Real vs Planificado */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Real vs Planificado
        </h3>
        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b bg-muted/40">
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Plataforma</th>
                  <th className="px-3 py-2">Etapa</th>
                  <th className="px-3 py-2 text-right">Inversión Plan</th>
                  <th className="px-3 py-2 text-right">Inversión Real</th>
                  <th className="px-3 py-2 text-right">Impresiones</th>
                  <th className="px-3 py-2 text-right">Alcance</th>
                  <th className="px-3 py-2 text-right">CPM Real</th>
                  <th className="px-3 py-2 text-right">CPC Real</th>
                  <th className="px-3 py-2 text-right">CTR</th>
                  <th className="px-3 py-2 text-right">Var %</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                    Sin datos. Conectá la fuente de datos (Google Sheet o PDF parser) para cargar métricas.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Info */}
      <div className="rounded-lg border bg-amber-50 p-4 text-xs text-amber-900">
        <strong>Fuente de datos pendiente.</strong> Esta página necesita los reportes de performance de OMD.
        Opciones: (1) Google Sheet donde OMD cargue los datos, (2) Upload de PDFs procesados por IA.
      </div>
    </div>
  );
}
