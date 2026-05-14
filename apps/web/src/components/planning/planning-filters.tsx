"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

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

function MultiDropdown({
  label,
  placeholder,
  selected,
  options,
  onChange,
}: {
  label: string;
  placeholder: string;
  selected: string[];
  options: { value: string; label: string }[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v));
    else onChange([...selected, v]);
  };

  const triggerText =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
        : `${selected.length} seleccionados`;

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 min-w-[160px] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm hover:bg-secondary/40 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <span className={selected.length === 0 ? "text-muted-foreground" : ""}>
            {triggerText}
          </span>
          <svg
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div className="absolute left-0 top-full z-30 mt-1 max-h-72 w-max min-w-full overflow-y-auto rounded-md border border-input bg-card p-1 shadow-lg">
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
              >
                Limpiar selección
              </button>
            )}
            {options.map((o) => {
              const isSel = selected.includes(o.value);
              return (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-secondary"
                >
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggle(o.value)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span>{o.label}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
