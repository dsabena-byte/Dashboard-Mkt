import Link from "next/link";
import { DASH_KNOW } from "@/lib/knowledge";
import { MODULO_TITULO } from "@/lib/guia/titulos";
import { ETAPA_LABEL, ETAPA_NUM } from "@/lib/guia/types";

// Franja "Cómo leer este tablero" (Proceso Estratégico) — debajo del título de cada dashboard, colapsable
// con <details> nativo (sin JS, arranca cerrada: no empuja el contenido). Orienta antes de mirar
// un número: etapa del ciclo, cómo leerlo, cómo aplicarlo y a qué módulos ir para profundizar.
// Sin "use client": sirve en server y client components. `slug` = clave de DASH_KNOW (= ruta).
export function HowToRead({ slug }: { slug: string }) {
  const k = DASH_KNOW[slug];
  if (!k) return null;
  const modulos = (k.modulos ?? []).filter((id) => MODULO_TITULO[id]);
  return (
    <details className="group overflow-hidden rounded-xl border border-l-[3px] border-l-[#1e40af] bg-card shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
        <span className="text-base leading-none">🎓</span>
        <span className="min-w-0">Cómo leer este tablero</span>
        <span className="hidden min-w-0 truncate font-normal text-slate-500 sm:inline">· {k.title}</span>
        {k.etapa && (
          <span title="Etapa del ciclo del Proceso Estratégico" className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#1e40af]">
            {ETAPA_NUM[k.etapa]} · {ETAPA_LABEL[k.etapa]}
          </span>
        )}
        <span className="ml-auto shrink-0 text-xs font-normal text-slate-400 group-open:hidden">ver</span>
        <span className="ml-auto hidden shrink-0 text-xs font-normal text-slate-400 group-open:inline">cerrar</span>
      </summary>
      <div className="px-4 pb-4 text-[13px] leading-relaxed text-slate-600 sm:pl-11 [&_b]:font-semibold [&_b]:text-slate-900">
        <p className="mb-2.5 mt-0" dangerouslySetInnerHTML={{ __html: k.intro }} />
        <ul className="m-0 list-disc pl-4">
          {k.bullets.map((b, i) => (
            <li key={i} className="my-1" dangerouslySetInnerHTML={{ __html: b }} />
          ))}
        </ul>
        {k.practicas && k.practicas.length > 0 && (
          <div className="mt-3 border-t pt-3">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cómo aplicarlo en este tablero</div>
            <ul className="m-0 list-disc pl-4">
              {k.practicas.map((p, i) => (
                <li key={i} className="my-1">
                  <b>{p.nombre}.</b> <span dangerouslySetInnerHTML={{ __html: p.detalle }} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5 border-t pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Profundizá</span>
          {modulos.map((id) => (
            <Link key={id} href={`/guia/${id}`} className="text-[13px] font-semibold text-[#1e40af] hover:underline">
              {MODULO_TITULO[id]}
            </Link>
          ))}
          <Link href="/guia" className="text-[13px] font-semibold text-slate-500 hover:text-[#1e40af] hover:underline">
            Proceso Estratégico →
          </Link>
        </div>
      </div>
    </details>
  );
}
