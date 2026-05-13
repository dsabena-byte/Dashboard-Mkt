"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril",
  "Mayo", "Junio", "Julio", "Agosto",
  "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatMonthLabel(fecha: string): string {
  const [year, month] = fecha.split("-");
  const idx = parseInt(month ?? "1", 10) - 1;
  return `${MONTH_NAMES[idx] ?? month} ${year}`;
}

interface PlanningFiltersProps {
  current: {
    mes: string;
    campania: string | null;
    rol: string | null;
    sistema: string | null;
    medio: string | null;
  };
  options: {
    meses: string[];
    campanias: string[];
    roles: string[];
    sistemas: string[];
  };
}

const MEDIOS = ["Digital", "TV Cable", "OOH", "Costos"];

export function PlanningFilters({ current, options }: PlanningFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      const url = `${pathname}?${params.toString()}`;
      (router.replace as unknown as (href: string, opts?: { scroll?: boolean }) => void)(url, {
        scroll: false,
      });
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
      <FilterSelect
        label="Mes"
        value={current.mes}
        onChange={(v) => setParam("mes", v)}
        options={options.meses.map((m) => ({ value: m, label: formatMonthLabel(m) }))}
      />
      <FilterSelect
        label="Medio"
        value={current.medio ?? ""}
        onChange={(v) => setParam("medio", v)}
        options={[{ value: "", label: "Todos" }, ...MEDIOS.map((m) => ({ value: m, label: m }))]}
      />
      <FilterSelect
        label="Categoría"
        value={current.campania ?? ""}
        onChange={(v) => setParam("campania", v)}
        options={[
          { value: "", label: "Todas" },
          ...options.campanias.map((c) => ({ value: c, label: c })),
        ]}
      />
      <FilterSelect
        label="Rol"
        value={current.rol ?? ""}
        onChange={(v) => setParam("rol", v)}
        options={[
          { value: "", label: "Todos" },
          ...options.roles.map((r) => ({ value: r, label: r })),
        ]}
      />
      <FilterSelect
        label="Plataforma"
        value={current.sistema ?? ""}
        onChange={(v) => setParam("sistema", v)}
        options={[
          { value: "", label: "Todas" },
          ...options.sistemas.map((s) => ({ value: s, label: s })),
        ]}
      />
      {pending && (
        <span className="ml-auto text-xs text-muted-foreground">Actualizando…</span>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
