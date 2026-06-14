import type { BuildupRow } from "@/lib/social-posts-queries";

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

// Tabla de construcción: por cada fila (pilar o categoría) muestra cómo se va
// construyendo alcance / views / interacción, con una barra de share de alcance.
function BuildupTable({ title, rows, emptyHint }: { title: string; rows: BuildupRow[]; emptyHint: string }) {
  const totAlcance = rows.reduce((s, r) => s + r.alcance, 0);
  const tot = rows.reduce(
    (a, r) => ({ alcance: a.alcance + r.alcance, views: a.views + r.views, interaccion: a.interaccion + r.interaccion, posts: a.posts + r.posts }),
    { alcance: 0, views: 0, interaccion: 0, posts: 0 },
  );
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">{emptyHint}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b">
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-1.5">{title.includes("pilar") ? "Pilar" : "Categoría"}</th>
                <th className="px-2 py-1.5 text-right">Alcance</th>
                <th className="px-2 py-1.5 text-right">Views</th>
                <th className="px-2 py-1.5 text-right">Interacción</th>
                <th className="px-2 py-1.5 text-right">Posts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = totAlcance > 0 ? (r.alcance / totAlcance) * 100 : 0;
                return (
                  <tr key={r.label} className="border-b last:border-0">
                    <td className="px-2 py-1.5">
                      <div className="font-medium">{r.label}</div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-muted">
                        <div className="h-full rounded bg-foreground/70" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold">
                      {fmtK(r.alcance)}
                      <span className="ml-1 text-[9px] font-normal text-muted-foreground">{pct.toFixed(0)}%</span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmtK(r.views)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{fmtK(r.interaccion)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{r.posts}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 font-semibold">
                <td className="px-2 py-1.5">Total</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtK(tot.alcance)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtK(tot.views)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtK(tot.interaccion)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{tot.posts}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function OrganicBuildupPanel({ byPilar, byCategoria }: { byPilar: BuildupRow[]; byCategoria: BuildupRow[] }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-base font-semibold tracking-tight">Construcción del orgánico — alcance, views e interacción</h3>
        <p className="text-xs text-muted-foreground">
          Cómo se construye cada métrica desde los posteos orgánicos (IG + FB), por pilar de contenido y por categoría, en el período seleccionado.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <BuildupTable title="Por pilar de contenido" rows={byPilar} emptyHint="Sin posteos con pilar clasificado." />
        <BuildupTable title="Por categoría" rows={byCategoria} emptyHint="Sin posteos con categoría clasificada." />
      </div>
    </section>
  );
}
