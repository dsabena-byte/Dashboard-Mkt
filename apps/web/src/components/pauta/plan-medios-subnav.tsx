import Link from "next/link";

// Vistas del Plan de Medios (portado de BIP, sep-2026): Tablero · Simulador · Pauta de la competencia.
// Cada vista es una ruta propia bajo /performance → el ítem "Plan de Medios" del sidebar queda activo
// en las sub-rutas y el control de acceso por prefijo (isPathAllowed) las habilita a quien ve /performance.
export const PLAN_MEDIOS_TABS = [
  { href: "/performance", label: "Tablero" },
  { href: "/performance/simulador", label: "Simulador de presupuesto" },
  { href: "/performance/competencia", label: "Pauta de la competencia" },
] as const;

export function PlanMediosSubnav({ current }: { current: (typeof PLAN_MEDIOS_TABS)[number]["href"] }) {
  return (
    <nav aria-label="Vistas del Plan de Medios" className="mb-4 flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1 text-sm w-fit max-w-full">
      {PLAN_MEDIOS_TABS.map((t) => {
        const on = t.href === current;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${on ? "text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            style={on ? { background: "#1e40af" } : undefined}
          >
            {t.label}
          </Link>
        );
      })}
      <Link href="/performance?vista=diagnostico" className="rounded-md px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        Diagnóstico e inteligencia
      </Link>
    </nav>
  );
}
