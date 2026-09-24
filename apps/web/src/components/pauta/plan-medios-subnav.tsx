import Link from "next/link";
import type { Route } from "next";

// Pestañas de Plan de Medios (mismo renglón y estilo que los tabs del Tablero, ámbar = activa):
// Impacto Campaña · Eficiencia Medios · Diagnóstico e Inteligencia (vistas de /performance, ?tab=) ·
// Pauta Competencia · Simulador de Presupuesto (rutas propias). El sidebar y `isPathAllowed` matchean
// por prefijo → quien ve /performance ve las sub-rutas.
export const PLAN_MEDIOS_TABS = [
  { href: "/performance?tab=impacto", label: "Impacto Campaña" },
  { href: "/performance?tab=eficiencia", label: "Eficiencia Medios" },
  { href: "/performance?tab=diagnostico", label: "Diagnóstico e Inteligencia" },
  { href: "/performance/competencia", label: "Pauta Competencia" },
  { href: "/performance/simulador", label: "Simulador de Presupuesto" },
] as const;

export function PlanMediosSubnav({ current }: { current: "/performance/simulador" | "/performance/competencia" }) {
  return (
    <nav aria-label="Vistas del Plan de Medios" className="flex flex-wrap gap-1 border-b">
      {PLAN_MEDIOS_TABS.map((t) => {
        const on = t.href === current;
        return (
          <Link
            key={t.href}
            href={t.href as Route}
            aria-current={on ? "page" : undefined}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${on ? "border-amber-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
