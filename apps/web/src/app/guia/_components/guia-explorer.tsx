"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ETAPAS, NIVELES, FUNNELS, PLATAFORMAS, ETAPA_LABEL, ETAPA_NUM, ETAPA_BAJADA, NIVEL_LABEL, FUNNEL_LABEL, PLATAFORMA_LABEL,
  type Etapa, type Nivel, type Funnel, type Plataforma,
} from "@/lib/guia/types";

// Explorador del Proceso Estratégico: ciclo (filtra por etapa) + filtros + búsqueda + tarjetas por nivel.
// Recibe solo metadatos livianos (el contenido completo se lee en /guia/[id]).

export interface GuiaCard {
  id: string;
  titulo: string;
  resumen: string;
  nivel: Nivel;
  etapa: Etapa;
  funnel: Funnel[];
  plataforma?: Plataforma;
  buscar: string; // texto normalizado para búsqueda
}

export interface GuiaFiltros { etapa?: Etapa; nivel?: Nivel; funnel?: Funnel; plataforma?: Plataforma; q?: string }

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const CHIP = "rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500";
const CHIP_ET = "rounded-full bg-blue-50 px-2 py-0.5 text-[10.5px] font-semibold text-[#1e40af]";

export function GuiaExplorer({ cards, initial }: { cards: GuiaCard[]; initial: GuiaFiltros }) {
  const [etapa, setEtapa] = useState<Etapa | undefined>(initial.etapa);
  const [nivel, setNivel] = useState<Nivel | undefined>(initial.nivel);
  const [funnel, setFunnel] = useState<Funnel | undefined>(initial.funnel);
  const [plataforma, setPlataforma] = useState<Plataforma | undefined>(initial.plataforma);
  const [q, setQ] = useState(initial.q ?? "");

  // Refleja los filtros en la URL (compartible, sin recargar).
  useEffect(() => {
    const sp = new URLSearchParams();
    if (etapa) sp.set("etapa", etapa);
    if (nivel) sp.set("nivel", nivel);
    if (funnel) sp.set("funnel", funnel);
    if (plataforma) sp.set("plataforma", plataforma);
    if (q.trim()) sp.set("q", q.trim());
    const qs = sp.toString();
    try {
      window.history.replaceState(null, "", qs ? `/guia?${qs}` : "/guia");
    } catch {
      /* sin history */
    }
  }, [etapa, nivel, funnel, plataforma, q]);

  const filtered = useMemo(() => {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    return cards.filter(
      (c) =>
        (!etapa || c.etapa === etapa) &&
        (!nivel || c.nivel === nivel) &&
        (!funnel || c.funnel.includes(funnel)) &&
        (!plataforma || c.plataforma === plataforma) &&
        terms.every((t) => c.buscar.includes(t)),
    );
  }, [cards, etapa, nivel, funnel, plataforma, q]);

  const anyFilter = Boolean(etapa || nivel || funnel || plataforma || q.trim());
  const clear = () => {
    setEtapa(undefined);
    setNivel(undefined);
    setFunnel(undefined);
    setPlataforma(undefined);
    setQ("");
  };

  return (
    <div>
      <div className="mb-2 grid grid-cols-2 gap-2.5 md:grid-cols-4" role="group" aria-label="Etapas del ciclo">
        {ETAPAS.map((e) => {
          const on = etapa === e;
          return (
            <button
              key={e}
              type="button"
              aria-pressed={on}
              onClick={() => setEtapa(on ? undefined : e)}
              className={`flex flex-col gap-0.5 rounded-xl border px-3.5 py-3 text-left transition-colors ${on ? "border-[#1e40af] bg-blue-50" : "bg-card hover:border-slate-300"}`}
            >
              <span className={`text-[11px] font-semibold tracking-wider ${on ? "text-[#1e40af]" : "text-slate-400"}`}>{ETAPA_NUM[e]}</span>
              <span className="text-[15px] font-semibold tracking-tight text-slate-900">{ETAPA_LABEL[e]}</span>
              <span className="text-xs leading-snug text-slate-500">{ETAPA_BAJADA[e]}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-1.5 mt-4 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscá un tema, una métrica o una plataforma"
          aria-label="Buscar en el Proceso Estratégico"
          className="min-w-0 flex-[1_1_260px] rounded-lg border bg-card px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#1e40af] focus:ring-2 focus:ring-blue-100"
        />
        <div className="inline-flex overflow-hidden rounded-lg border bg-card" role="group" aria-label="Nivel">
          <button type="button" onClick={() => setNivel(undefined)} className={`px-3 py-2 text-[12.5px] ${!nivel ? "bg-blue-50 font-semibold text-[#1e40af]" : "text-slate-500"}`}>
            Todos
          </button>
          {NIVELES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNivel(nivel === n ? undefined : n)}
              className={`border-l px-3 py-2 text-[12.5px] ${nivel === n ? "bg-blue-50 font-semibold text-[#1e40af]" : "text-slate-500"}`}
            >
              {NIVEL_LABEL[n]}
            </button>
          ))}
        </div>
        <select
          value={funnel ?? ""}
          onChange={(e) => setFunnel((e.target.value || undefined) as Funnel | undefined)}
          aria-label="Etapa del funnel"
          className="rounded-lg border bg-card px-2.5 py-2 text-[12.5px] text-slate-900"
        >
          <option value="">Todo el funnel</option>
          {FUNNELS.map((f) => (
            <option key={f} value={f}>
              {FUNNEL_LABEL[f]}
            </option>
          ))}
        </select>
        <select
          value={plataforma ?? ""}
          onChange={(e) => setPlataforma((e.target.value || undefined) as Plataforma | undefined)}
          aria-label="Plataforma"
          className="rounded-lg border bg-card px-2.5 py-2 text-[12.5px] text-slate-900"
        >
          <option value="">Todas las plataformas</option>
          {PLATAFORMAS.map((p) => (
            <option key={p} value={p}>
              {PLATAFORMA_LABEL[p]}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400">
        <span>
          {filtered.length} de {cards.length} módulos
        </span>
        {anyFilter && (
          <button type="button" onClick={clear} className="font-semibold text-[#1e40af]">
            Limpiar filtros
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
          No hay módulos con esos filtros.{" "}
          <button type="button" onClick={clear} className="font-semibold text-[#1e40af]">
            Ver todos
          </button>
        </div>
      ) : (
        NIVELES.map((n) => {
          const list = filtered.filter((c) => c.nivel === n);
          if (!list.length) return null;
          return (
            <section key={n} className="mt-6">
              <h2 className="mb-2.5 flex items-baseline gap-2 text-[15px] font-semibold text-slate-900">
                {NIVEL_LABEL[n]} <small className="text-xs font-medium text-slate-400">{list.length}</small>
              </h2>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
                {list.map((c) => (
                  <Link
                    key={c.id}
                    href={`/guia/${c.id}`}
                    className="flex flex-col gap-1.5 rounded-xl border bg-card px-4 py-3.5 transition hover:-translate-y-px hover:border-[#1e40af]"
                  >
                    <h3 className="m-0 text-[14.5px] font-semibold leading-snug text-slate-900">{c.titulo}</h3>
                    <p className="m-0 text-[12.8px] leading-normal text-slate-500">{c.resumen}</p>
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-0.5">
                      <span className={CHIP_ET}>
                        {ETAPA_NUM[c.etapa]} · {ETAPA_LABEL[c.etapa]}
                      </span>
                      {c.plataforma && <span className={CHIP}>{PLATAFORMA_LABEL[c.plataforma]}</span>}
                      {c.funnel
                        .filter((f) => f !== "transversal")
                        .slice(0, 2)
                        .map((f) => (
                          <span key={f} className={CHIP}>
                            {FUNNEL_LABEL[f]}
                          </span>
                        ))}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
