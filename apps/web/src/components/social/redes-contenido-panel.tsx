import { DIAS, FRANJAS, type BestTimes, type FormatoRow } from "@/lib/redes-contenido";
import { LearnButton } from "@/components/knowledge/learn-button";

// Formatos y horarios del contenido PROPIO (server component). Solo posts maduros (IG 7+ días, FB 60+
// días), orgánicos (FB pautado afuera) y sin Stories. Índice 100 = mediana de la cuenta; el horario se
// controla por formato (ER del post ÷ mediana de su red y formato). Paleta sobria: rampa azul
// monocromática para el mapa de calor (no es semáforo).

const nf = (v: number, d = 0) => v.toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d });
const heat = (idx: number | null) => {
  if (idx == null) return "transparent";
  const t = Math.max(0, Math.min(1, (idx - 60) / 100)); // 60 → claro, 160+ → azul pleno
  return `rgba(30, 64, 175, ${0.08 + t * 0.8})`;
};

export function RedesContenidoPanel({ formatos, horarios }: { formatos: FormatoRow[]; horarios: BestTimes }) {
  if (!formatos.length && !horarios.n) return null;
  const mejor = horarios.mejor;
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="flex items-center gap-1.5 text-base font-semibold tracking-tight">Formatos y horarios propios <LearnButton k="formatos_horarios" /></h3>
      <p className="text-xs text-muted-foreground">
        Medianas de posts orgánicos MADUROS (Instagram 7+ días, Facebook 60+ días: el alcance es lifetime y madura), sin Stories y sin
        posts pautados. Índice 100 = mediana de la cuenta en esa red.
      </p>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="border-b">
              <tr className="text-left text-[9px] uppercase tracking-wide text-muted-foreground">
                <th className="px-1 py-1.5">Red · formato</th>
                <th className="px-1 py-1.5 text-right">Posts (maduros)</th>
                <th className="px-1 py-1.5 text-right">Alcance med.</th>
                <th className="px-1 py-1.5 text-right">ER med.</th>
                <th className="px-1 py-1.5 text-right">Índice ER</th>
                <th className="px-1 py-1.5 text-right">Índice alcance</th>
                <th className="px-1 py-1.5 text-right">Guardados</th>
              </tr>
            </thead>
            <tbody>
              {formatos.map((f) => (
                <tr key={`${f.red}|${f.formato}`} className="border-b last:border-0">
                  <td className="px-1 py-1.5 font-medium">
                    {f.red === "IG" ? "Instagram" : "Facebook"} · {f.formato}
                    {f.muestraChica && <span className="ml-1 text-[9px] text-muted-foreground">(muestra chica)</span>}
                  </td>
                  <td className="px-1 py-1.5 text-right tabular-nums text-muted-foreground">{f.n} ({f.nMaduros})</td>
                  <td className="px-1 py-1.5 text-right tabular-nums">{nf(f.alcanceMed)}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums">{nf(f.erMed, 2)}%</td>
                  <td className="px-1 py-1.5 text-right tabular-nums font-semibold text-[#1e40af]">{f.indiceEr != null ? nf(f.indiceEr) : "—"}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums">{f.indiceAlcance != null ? nf(f.indiceAlcance) : "—"}</td>
                  <td className="px-1 py-1.5 text-right tabular-nums text-muted-foreground">{f.guardadosMed != null ? `${nf(f.guardadosMed, 2)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-muted-foreground">
            ER = interacciones ÷ alcance del post (IG: interacciones totales; FB: reacciones + comentarios/compartidos + clicks). Guardados = guardados ÷ alcance (solo IG).
          </p>
        </div>
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Mejor día y franja (hora AR)</div>
          {horarios.suficiente ? (
            <>
              <table className="w-full table-fixed text-[10px]">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="w-12" />
                    {FRANJAS.map((f) => <th key={f.key} className="py-1 font-medium">{f.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {DIAS.map((d, dia) => (
                    <tr key={d}>
                      <td className="pr-1 text-right text-muted-foreground">{d}</td>
                      {FRANJAS.map((_, franja) => {
                        const c = horarios.cells.find((x) => x.dia === dia && x.franja === franja);
                        const show = c && c.n > 0 && c.indice != null;
                        return (
                          <td key={franja} className="p-0.5">
                            <div className="flex h-7 flex-col items-center justify-center rounded" style={{ background: show ? heat(c!.indice) : "hsl(var(--muted))", color: show && (c!.indice ?? 0) >= 120 ? "#fff" : "#0f172a" }} title={show ? `${c!.n} posts` : "sin posts"}>
                              {show ? <span className="tabular-nums">{nf(c!.indice!)}{c!.n < 3 ? "*" : ""}</span> : <span className="text-muted-foreground/50">·</span>}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {mejor
                  ? <>Mejor celda con base: <strong className="text-[#0f172a]">{DIAS[mejor.dia]} {FRANJAS[mejor.franja]?.label}</strong> (índice {nf(mejor.indice ?? 0)}, {mejor.n} posts). </>
                  : "Ninguna celda con 3+ posts. "}
                Índice por post = su ER ÷ mediana de su red y formato (100 = típico). * = menos de 3 posts. Base: {horarios.n} posts.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Hacen falta al menos 20 posts maduros con alcance (hay {horarios.n}).</p>
          )}
        </div>
      </div>
    </section>
  );
}
