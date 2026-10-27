"use client";

import { useEffect, useRef, useState } from "react";

export interface MultiDropdownOption {
  value: string;
  label: string;
}

interface MultiDropdownProps {
  label: string;
  placeholder: string;
  selected: string[];
  options: MultiDropdownOption[];
  onChange: (values: string[]) => void;
}

export function MultiDropdown({
  label,
  placeholder,
  selected,
  options,
  onChange,
}: MultiDropdownProps) {
  const [open, setOpen] = useState(false);
  // Borrador local: el tilde se marca al instante y el filtro se aplica UNA vez al cerrar (cada onChange puede
  // recargar el tablero en el servidor; tildar 5 tiendas eran 5 recargas y el tilde tardaba en verse).
  const [draft, setDraft] = useState(selected);
  const ref = useRef<HTMLDivElement>(null);
  const cerrar = () => {
    setOpen(false);
    const a = [...draft].sort().join("\u0000"), b = [...selected].sort().join("\u0000");
    if (a !== b) onChange(draft);
  };
  useEffect(() => { if (!open) setDraft(selected); }, [selected, open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cerrar();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }); // sin deps: el listener tiene que ver el borrador actual

  const toggle = (v: string) => {
    setDraft((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v]));
  };

  const sel = open ? draft : selected;
  const triggerText =
    sel.length === 0
      ? placeholder
      : sel.length === 1
        ? options.find((o) => o.value === sel[0])?.label ?? sel[0]
        : `${sel.length} seleccionados`;

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => (open ? cerrar() : setOpen(true))}
          className="flex h-9 min-w-[160px] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm hover:bg-secondary/40 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <span className={sel.length === 0 ? "text-muted-foreground" : ""}>
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
            {draft.length > 0 && (
              <button
                type="button"
                onClick={() => setDraft([])}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
              >
                Limpiar selección
              </button>
            )}
            {options.map((o) => {
              const isSel = draft.includes(o.value);
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
            <button type="button" onClick={cerrar} className="sticky bottom-0 mt-1 w-full rounded bg-blue-700 px-2 py-1.5 text-xs font-semibold text-white hover:bg-blue-800">
              Aplicar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
