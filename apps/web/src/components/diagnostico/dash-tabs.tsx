"use client";
// ============================================================================
// MENÚ ESTÁNDAR de los tableros (un solo renglón de pestañas, sin barras arriba/abajo):
//   título → "Cómo leer" → <DashTabBar …/> → contenido.
// <DashTabs> envuelve la página y guarda la vista (tablero | diagnóstico). <DashTabBar> es el renglón
// de pestañas: las vistas propias del tablero (links/botones) + "Diagnóstico e Inteligencia" (que
// absorbe los viejos "Insights": `diagExtra`). Estilo = el de Plan de Medios (subrayado ámbar).
// En la vista diagnóstico se oculta por CSS TODO lo que está DESPUÉS del renglón (el título y el
// "Cómo leer" quedan), sin desmontar el tablero (no pierde filtros). URL: ?vista=diagnostico.
// ============================================================================
import Link from "next/link";
import type { Route } from "next";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { DashDiagnostico } from "./dash-diagnostico";

type Vista = "tablero" | "diagnostico";
const Ctx = createContext<{ vista: Vista; setVista: (v: Vista) => void } | null>(null);

export function DashTabs({ dash, className, children, diagExtra, startDiag = false }: {
  dash: string;
  className?: string;
  children: ReactNode;
  /** Contenido extra de la pestaña Diagnóstico (ej. los ex "Insights" del tablero). */
  diagExtra?: ReactNode;
  /** Abrir directo en Diagnóstico (ej. links viejos ?tab=insights). */
  startDiag?: boolean;
}) {
  const params = useSearchParams();
  const [vista, setVista] = useState<Vista>(startDiag || params?.get("vista") === "diagnostico" ? "diagnostico" : "tablero");
  const [diagMounted, setDiagMounted] = useState(vista === "diagnostico");

  useEffect(() => {
    if (vista === "diagnostico") setDiagMounted(true);
    const url = new URL(window.location.href);
    if (vista === "diagnostico") url.searchParams.set("vista", "diagnostico");
    else url.searchParams.delete("vista");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [vista]);

  return (
    <Ctx.Provider value={{ vista, setVista }}>
      <div className={`dash-tabs ${className ?? ""}`} data-vista={vista}>
        {children}
        {diagMounted && (
          <div data-dash-keep data-dash-diag className="space-y-4">
            {diagExtra}
            <DashDiagnostico dash={dash} embedded />
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export interface DashTabItem { key: string; label: string; href?: string; badge?: number | string }

const cls = (on: boolean) =>
  `relative whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${on ? "border-amber-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`;
function Badge({ v, on }: { v: number | string; on: boolean }) {
  return <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${on ? "bg-foreground text-background" : "bg-muted text-foreground"}`}>{v}</span>;
}

/** Renglón único de pestañas. `items` = vistas propias (sin href = botón "Tablero"); `after` = herramientas
 *  que van después de Diagnóstico (ej. Pauta Competencia / Simulador). `active` = key de la vista actual. */
export function DashTabBar({ items = [{ key: "tablero", label: "Tablero" }], active, after = [], diagBadge }: {
  items?: DashTabItem[]; active?: string; after?: DashTabItem[]; diagBadge?: number | string;
}) {
  const ctx = useContext(Ctx);
  const diag = ctx?.vista === "diagnostico";
  const cur = active ?? items[0]?.key;
  const render = (t: DashTabItem) => {
    const on = !diag && t.key === cur;
    return t.href ? (
      <Link key={t.key} href={t.href as Route} scroll={false} onClick={() => ctx?.setVista("tablero")} className={cls(on)}>
        {t.label}{t.badge != null && <Badge v={t.badge} on={on} />}
      </Link>
    ) : (
      <button key={t.key} type="button" onClick={() => ctx?.setVista("tablero")} className={cls(on)}>
        {t.label}{t.badge != null && <Badge v={t.badge} on={on} />}
      </button>
    );
  };
  return (
    <nav data-dash-bar data-dash-keep aria-label="Vistas del tablero" className="flex gap-1 overflow-x-auto border-b">
      {items.map(render)}
      {ctx && (
        <button type="button" onClick={() => ctx.setVista("diagnostico")} className={cls(diag)}>
          Diagnóstico e Inteligencia{diagBadge != null && <Badge v={diagBadge} on={diag} />}
        </button>
      )}
      {after.map(render)}
    </nav>
  );
}
