import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getModulo, modulosByIds, dashLinks, ETAPA_LABEL, ETAPA_NUM, NIVEL_LABEL, FUNNEL_LABEL, PLATAFORMA_LABEL,
} from "@/lib/guia";
import { KPI_KNOW } from "@/lib/knowledge";
import { LearnButton } from "@/components/knowledge/learn-button";
import { MdLite, MdInline } from "../_components/md-lite";

// Detalle de un módulo del Método BIP: secciones, paso a paso, checklist, referencias y el
// bloque "En la plataforma" con los tableros de Drean donde se aplica.
export function generateMetadata({ params }: { params: { id: string } }) {
  const m = getModulo(params.id);
  return { title: m ? `${m.titulo} · Método BIP` : "Método BIP" };
}

const K = "mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400";
const CHIP = "rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800";
const BOX = "mb-5 rounded-2xl border bg-card px-5 py-4";

export default function ModuloPage({ params }: { params: { id: string } }) {
  const m = getModulo(params.id);
  if (!m) notFound();
  const relacionados = modulosByIds(m.relacionados);
  const dashes = dashLinks(m.dashSlugs);
  const kpis = m.kpiKeys.filter((k) => KPI_KNOW[k]);

  return (
    <div>
      <div className="mb-2.5 text-[12.5px] text-slate-400">
        <Link href="/guia" className="font-semibold text-[#1e40af] hover:underline">
          Método BIP
        </Link>{" "}
        <span aria-hidden="true">/</span> {NIVEL_LABEL[m.nivel]}
      </div>
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        <Link href={{ pathname: "/guia", query: { etapa: m.etapa } }} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#1e40af]">
          {ETAPA_NUM[m.etapa]} · {ETAPA_LABEL[m.etapa]}
        </Link>
        <Link href={{ pathname: "/guia", query: { nivel: m.nivel } }} className={CHIP}>
          {NIVEL_LABEL[m.nivel]}
        </Link>
        {m.plataforma && (
          <Link href={{ pathname: "/guia", query: { plataforma: m.plataforma } }} className={CHIP}>
            {PLATAFORMA_LABEL[m.plataforma]}
          </Link>
        )}
        {m.funnel.map((f) => (
          <Link key={f} href={{ pathname: "/guia", query: { funnel: f } }} className={CHIP}>
            {FUNNEL_LABEL[f]}
          </Link>
        ))}
      </div>
      <h2 className="max-w-[820px] text-2xl font-semibold tracking-tight text-slate-900">{m.titulo}</h2>
      <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-slate-500">{m.resumen}</p>

      <div className="mt-6 grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
        <article className="min-w-0 max-w-[780px]">
          {m.secciones.map((s, i) => (
            <section key={i} className="mb-6">
              <h3 className="mb-2 text-[17px] font-semibold text-slate-900">{s.titulo}</h3>
              <MdLite text={s.cuerpo} />
            </section>
          ))}

          {m.pasos && m.pasos.length > 0 && (
            <section className={BOX}>
              <h3 className="mb-3 text-[15px] font-semibold text-slate-900">Paso a paso</h3>
              <ol className="m-0 flex list-none flex-col gap-3 p-0">
                {m.pasos.map((p, i) => (
                  <li key={i} className="grid grid-cols-[26px_minmax(0,1fr)] gap-2.5">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-50 text-xs font-semibold text-[#1e40af]">{i + 1}</span>
                    <div>
                      <b className="mb-0.5 block text-sm font-semibold text-slate-900">{p.titulo}</b>
                      <span className="text-[13.5px] leading-normal text-slate-500">
                        <MdInline text={p.detalle} />
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {m.benchmarks && m.benchmarks.length > 0 && (
            <section className={BOX}>
              <h3 className="mb-3 text-[15px] font-semibold text-slate-900">Referencias</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b text-left text-[10.5px] uppercase tracking-wider text-slate-400">
                      <th className="pb-2 pr-2 font-semibold">Métrica</th>
                      <th className="pb-2 pr-2 font-semibold">Referencia</th>
                      <th className="pb-2 pr-2 font-semibold">Criterio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.benchmarks.map((b, i) => (
                      <tr key={i} className="border-b border-slate-100 align-top">
                        <td className="py-2 pr-2 font-semibold text-slate-900">{b.metrica}</td>
                        <td className="py-2 pr-2 font-semibold text-[#1e40af] sm:whitespace-nowrap">{b.valor}</td>
                        <td className="py-2 pr-2 leading-snug text-slate-500">{b.nota}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2.5 text-xs text-slate-400">
                Referencias orientativas. La vara es la mejor entre la referencia de industria y el percentil 75 de tus propias piezas o
                meses: contrastalas siempre con tu historia.
              </p>
            </section>
          )}

          {m.checklist && m.checklist.length > 0 && (
            <section className={BOX}>
              <h3 className="mb-3 text-[15px] font-semibold text-slate-900">Checklist</h3>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {m.checklist.map((c, i) => (
                  <li key={i} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2 text-[13.5px] leading-normal text-slate-500">
                    <span className="mt-[3px] h-[13px] w-[13px] rounded border-[1.5px] border-slate-400" />
                    <span>
                      <MdInline text={c} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        <aside className="flex flex-col gap-3.5 xl:sticky xl:top-5">
          <div className="rounded-xl border border-l-[3px] border-l-[#1e40af] bg-slate-50 px-4 py-3.5">
            <div className={K}>En la plataforma</div>
            <p className="mb-3 text-[13.4px] leading-normal text-slate-600">
              <MdInline text={m.enBip} />
            </p>
            {dashes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {dashes.map((d) => (
                  <Link
                    key={d.href}
                    href={{ pathname: d.href }}
                    className="rounded-lg border border-blue-200 bg-card px-2.5 py-1 text-[12.5px] font-semibold text-[#1e40af] hover:border-[#1e40af]"
                  >
                    {d.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {kpis.length > 0 && (
            <div>
              <div className={K}>Métricas</div>
              <div className="flex flex-wrap gap-1.5">
                {kpis.map((k) => (
                  <LearnButton key={k} k={k} variant="chip" />
                ))}
              </div>
            </div>
          )}

          {relacionados.length > 0 && (
            <div>
              <div className={K}>Seguí con</div>
              <div className="flex flex-col gap-2">
                {relacionados.map((r) => (
                  <Link key={r.id} href={`/guia/${r.id}`} className="block rounded-lg border bg-card px-3 py-2 hover:border-[#1e40af]">
                    <b className="block text-[13.2px] font-semibold leading-snug text-slate-900">{r.titulo}</b>
                    <small className="text-[11.5px] text-slate-400">
                      {NIVEL_LABEL[r.nivel]} · {ETAPA_LABEL[r.etapa]}
                    </small>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
