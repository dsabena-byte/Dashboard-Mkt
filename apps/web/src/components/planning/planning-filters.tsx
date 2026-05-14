"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

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

  const toggleMulti = (key: string, value: string, current: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    for (const v of next) params.append(key, v);
    pushParams(params);
  };

  const clearMulti = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    pushParams(params);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <MultiChips
        label="Mes"
        selected={current.mes}
        options={options.meses.map((m) => ({ value: m, label: formatMonthLabel(m) }))}
        onToggle={(v) => toggleMulti("mes", v, current.mes)}
        onClear={() => clearMulti("mes")}
      />
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <SingleSelect
          label="Medio"
          value={current.medio ?? ""}
          onChange={(v) => setSingle("medio", v)}
          options={[{ value: "", label: "Todos" }, ...MEDIOS.map((m) => ({ value: m, label: m }))]}
        />
        <MultiChips
          label="Categoría"
          selected={current.campania}
          options={options.campanias.map((c) => ({ value: c, label: c }))}
          onToggle={(v) => toggleMulti("campania", v, current.campania)}
          onClear={() => clearMulti("campania")}
        />
        <MultiChips
          label="Rol"
          selected={current.rol}
          options={options.roles.map((r) => ({ value: r, label: r }))}
          onToggle={(v) => toggleMulti("rol", v, current.rol)}
          onClear={() => clearMulti("rol")}
        />
        <MultiChips
          label="Plataforma"
          selected={current.sistema}
          options={options.sistemas.map((s) => ({ value: s, label: s }))}
          onToggle={(v) => toggleMulti("sistema", v, current.sistema)}
          onClear={() => clearMulti("sistema")}
        />
      </div>
      {pending && (
        <span className="text-xs text-muted-foreground">Actualizando…</span>
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

function MultiChips({
  label,
  selected,
  options,
  onToggle,
  onClear,
}: {
  label: string;
  selected: string[];
  options: { value: string; label: string }[];
  onToggle: (v: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const allActive = selected.length === 0;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onClear}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            allActive
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-background text-muted-foreground hover:bg-secondary"
          }`}
        >
          Todos
        </button>
        {(open ? options : options.filter((o) => selected.includes(o.value) || open)).map((o) => {
          const isSel = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(o.value)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                isSel
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-secondary"
              }`}
            >
              {o.label}
            </button>
          );
        })}
        {!open && options.some((o) => !selected.includes(o.value)) && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full border border-dashed border-input bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
          >
            + más
          </button>
        )}
        {open && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-dashed border-input bg-background px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
          >
            cerrar
          </button>
        )}
      </div>
    </div>
  );
}
