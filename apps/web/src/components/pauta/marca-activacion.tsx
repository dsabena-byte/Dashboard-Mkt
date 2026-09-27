// Marca vs activación (Binet & Field / IPA; portado de BIP, sep-2026). Barra 100% de la inversión
// real vs la referencia 60:40. Paleta sobria: marca = azul dato, activación = azul claro, mixto =
// gris pizarra; el semáforo (verde/ámbar) SOLO en la lectura. Sin hooks → server o client.
import { TOLERANCIA_PTS, type SplitMarcaActivacion } from "@/lib/marca-activacion";
import { LearnButton } from "@/components/knowledge/learn-button";

const MARCA = "#1e40af", ACT = "#93c5fd", MIX = "#cbd5e1";
const r0 = (v: number) => Math.round(v);

function Barra({ marca, act, mix, label }: { marca: number; act: number; mix?: number; label: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-muted-foreground">{label}</div>
      <div className="flex h-[22px] overflow-hidden rounded-md border text-[11px] font-semibold">
        <div className="flex items-center pl-1.5 text-white" style={{ width: `${marca}%`, background: MARCA }}>{marca >= 12 ? `Marca ${r0(marca)}%` : ""}</div>
        {mix != null && mix > 0 && <div className="flex items-center justify-center font-medium text-slate-700" style={{ width: `${mix}%`, background: MIX }}>{mix >= 10 ? `Mixto ${r0(mix)}%` : ""}</div>}
        <div className="flex items-center justify-end pr-1.5 text-slate-900" style={{ width: `${act}%`, background: ACT }}>{act >= 12 ? `Activación ${r0(act)}%` : ""}</div>
      </div>
    </div>
  );
}

export function MarcaActivacionSection({ s, money }: { s: SplitMarcaActivacion; money: (v: number) => string }) {
  const enLinea = s.lectura === "en línea con la referencia";
  const pm = (v: number) => (v / s.total) * 100;
  return (
    <div className="mb-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold">Marca vs activación <LearnButton k="marca_activacion" /></div>
      <p className="mb-3 mt-0.5 text-[11px] text-muted-foreground">
        Cuánto de la inversión construye demanda futura (marca: alcance, video, TV/OOH/DOOH) y cuánto captura la demanda de hoy
        (activación: ecommerce, conversión). Se clasifica por el rol de comunicación; Consideración (tráfico, TrueView, Demand Gen,
        Search) sirve a los dos y se reparte 50/50. Respeta los filtros de arriba.
      </p>
      <div className="grid items-start gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2.5">
          <Barra label={`Inversión del período (${money(s.total)})`} marca={pm(s.marca)} mix={pm(s.mixto)} act={pm(s.activacion)} />
          <Barra label={`Referencia · ${s.referencia.fuente}`} marca={s.referencia.marca} act={s.referencia.activacion} />
        </div>
        <div className="rounded-md border p-3">
          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${enLinea ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{s.lectura}</span>
          <div className="mt-1.5 text-2xl font-semibold tabular-nums">{r0(s.pctMarca)}:{r0(s.pctActivacion)}</div>
          <div className="text-[11px] text-muted-foreground">marca:activación{s.pctMixto > 0 ? ` (lo mixto, ${r0(s.pctMixto)}%, se reparte 50/50)` : ""}</div>
          <p className="mt-2 text-[12px]">{s.texto}</p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {s.items.map((it) => <span key={it.nombre} title={it.motivo}><b className="text-foreground">{it.nombre}</b> {money(it.inversion)} · {it.rol === "activacion" ? "activación" : it.rol}</span>)}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground/80">La referencia es un promedio de cientos de casos (IPA): varía por categoría y por etapa de la marca. Se considera &ldquo;en línea&rdquo; dentro de ±{TOLERANCIA_PTS} pts.</p>
    </div>
  );
}
