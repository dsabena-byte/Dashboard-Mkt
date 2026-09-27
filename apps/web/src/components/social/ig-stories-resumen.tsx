import type { StoriesResumen } from "@/lib/ig-stories";
import { LearnButton } from "@/components/knowledge/learn-button";

// Resumen de Stories de Instagram (server component, sin estado). Las Stories se capturan cada 6 h
// mientras están vivas (ig-sync) y se acumulan por máximo → el alcance es un PISO. Barras = mediana de
// alcance por Story de cada mes (azul de datos). Tasas de salida/respuesta solo si hay dato (desde sep-2026).

const DATA = "#1e40af";
const nf = (v: number, d = 0) => v.toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d });

export function IgStoriesResumen({ data }: { data: StoriesResumen | null }) {
  if (!data || !data.total) return null;
  const meses = data.porMes.slice(-8);
  const max = Math.max(...meses.map((m) => m.alcanceMediana), 1);
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-base font-semibold tracking-tight">Stories de Instagram <LearnButton k="stories_ig" /></h3>
          <p className="text-xs text-muted-foreground">
            {nf(data.total)} Stories capturadas desde {data.desde ? `${data.desde.slice(8, 10)}/${data.desde.slice(5, 7)}` : "—"}. Se leen cada 6 h mientras están
            vivas (24 h) y se guarda el máximo visto: el alcance es un piso. No entran en el ER por pieza ni en los formatos.
          </p>
        </div>
        <div className="flex gap-5 text-right">
          <div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: DATA }}>{nf(data.alcanceMediana)}</div>
            <div className="text-[11px] text-muted-foreground">alcance mediano por Story</div>
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-[#0f172a]">{data.tasaSalida != null ? `${nf(data.tasaSalida, 1)}%` : "—"}</div>
            <div className="text-[11px] text-muted-foreground">tasa de salida</div>
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-[#0f172a]">{data.tasaRespuesta != null ? `${nf(data.tasaRespuesta, 2)}%` : "—"}</div>
            <div className="text-[11px] text-muted-foreground">respuestas ÷ alcance</div>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-8">
        {meses.map((m) => (
          <div key={m.key} className="flex flex-col items-center gap-1">
            <div className="text-[10px] font-semibold tabular-nums text-muted-foreground">{nf(m.alcanceMediana)}</div>
            <div className="flex h-20 w-full items-end rounded bg-muted/50">
              <div className="w-full rounded" style={{ height: `${Math.max(4, (m.alcanceMediana / max) * 100)}%`, background: DATA }} />
            </div>
            <div className="text-[10px] text-muted-foreground">{m.mes}</div>
            <div className="text-[9px] text-muted-foreground/70">{m.stories} st.</div>
          </div>
        ))}
      </div>
      {data.conNavegacion === 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Tasa de salida y de respuesta: se empiezan a medir con las Stories capturadas desde esta versión (navegación y respuestas por separado).
        </p>
      )}
    </section>
  );
}
