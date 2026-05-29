"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { MultiDropdown } from "@/components/multi-dropdown";

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
    mes: string[];
    campania: string[];
    rol: string[];
    sistema: string[];
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

  const pushParams = (params: URLSearchParams) => {
    startTransition(() => {
      const url = `${pathname}?${params.toString()}`;
      (router.replace as unknown as (href: string, opts?: { scroll?: boolean }) => void)(url, {
        scroll: false,
      });
    });
  };

  const setSingle = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    pushParams(params);
  };

  const setMulti = (key: string, values: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    for (const v of values) params.append(key, v);
    pushParams(params);
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
      <MultiDropdown
        label="Mes"
        placeholder="Todos"
        selected={current.mes}
        options={options.meses.map((m) => ({ value: m, label: formatMonthLabel(m) }))}
        onChange={(vs) => setMulti("mes", vs)}
      />
      <SingleSelect
        label="Medio"
        value={current.medio ?? ""}
        onChange={(v) => setSingle("medio", v)}
        options={[{ value: "", label: "Todos" }, ...MEDIOS.map((m) => ({ value: m, label: m }))]}
      />
      <MultiDropdown
        label="Categoría"
        placeholder="Todas"
        selected={current.campania}
        options={options.campanias.map((c) => ({ value: c, label: c }))}
        onChange={(vs) => setMulti("campania", vs)}
      />
      <MultiDropdown
        label="Rol"
        placeholder="Todos"
        selected={current.rol}
        options={options.roles.map((r) => ({ value: r, label: r }))}
        onChange={(vs) => setMulti("rol", vs)}
      />
      <MultiDropdown
        label="Plataforma"
        placeholder="Todas"
        selected={current.sistema}
        options={options.sistemas.map((s) => ({ value: s, label: s }))}
        onChange={(vs) => setMulti("sistema", vs)}
      />
      {pending && (
        <span className="ml-auto text-xs text-muted-foreground">Actualizando…</span>
      )}
    </div>
  );
}

function SingleSelect({
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
        className="h-9 min-w-[140px] rounded-md border border-input bg-background px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
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

