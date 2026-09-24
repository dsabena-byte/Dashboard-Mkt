"use client";
// Tabs arriba de cada tablero: "Tablero" | (sub-vistas opcionales) | "Diagnóstico e inteligencia".
// Mismo estilo que el selector de Plan de Medios. El contenido del tablero queda MONTADO (solo se
// oculta por CSS: `.dash-tabs[data-vista=…]` en globals.css) → no se pierden filtros ni se re-renderiza.
// El diagnóstico se monta recién la primera vez que se abre el tab (no pide nada antes).
// La vista se refleja en la URL (?vista=diagnostico) para poder linkearla.
import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { DashDiagnostico } from "./dash-diagnostico";

type NavItem = { href: string; label: string };
const ACTIVE = "#1e40af";

export function DashTabs({
  dash,
  className,
  nav,
  children,
}: {
  dash: string;
  className?: string;
  /** Sub-vistas del tablero (rutas). La primera es este tablero; las demás se navegan con Link. */
  nav?: readonly NavItem[];
  children: ReactNode;
}) {
  const params = useSearchParams();
  const [vista, setVista] = useState<"tablero" | "diagnostico">(params?.get("vista") === "diagnostico" ? "diagnostico" : "tablero");
  const [diagMounted, setDiagMounted] = useState(vista === "diagnostico");

  useEffect(() => {
    if (vista === "diagnostico") setDiagMounted(true);
    const url = new URL(window.location.href);
    if (vista === "diagnostico") url.searchParams.set("vista", "diagnostico");
    else url.searchParams.delete("vista");
    window.history.replaceState(window.history.state, "", url.toString());
  }, [vista]);

  const btn = (on: boolean) =>
    `rounded-md px-3 py-1.5 font-medium transition-colors ${on ? "text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`;
  const [first, ...rest] = nav ?? [];

  return (
    <div className={`dash-tabs ${className ?? ""}`} data-vista={vista}>
      <nav data-dash-keep aria-label="Vistas del tablero" className={`${className ? "" : "mb-4 "}flex w-fit max-w-full flex-wrap items-center gap-1 rounded-lg border bg-card p-1 text-sm`}>
        <button type="button" onClick={() => setVista("tablero")} className={btn(vista === "tablero")} style={vista === "tablero" ? { background: ACTIVE } : undefined}>
          {first?.label ?? "Tablero"}
        </button>
        {rest.map((t) => (
          <Link key={t.href} href={t.href as Route} className={btn(false)}>
            {t.label}
          </Link>
        ))}
        <button type="button" onClick={() => setVista("diagnostico")} className={btn(vista === "diagnostico")} style={vista === "diagnostico" ? { background: ACTIVE } : undefined}>
          Diagnóstico e inteligencia
        </button>
      </nav>
      {children}
      {diagMounted && (
        <div data-dash-keep data-dash-diag>
          <DashDiagnostico dash={dash} embedded />
        </div>
      )}
    </div>
  );
}
