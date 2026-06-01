"use client";

import { useRouter } from "next/navigation";

interface CbFiltersBarProps {
  current: {
    semana?: number;
    division?: string;
    cliente?: string;
    tienda?: string;
  };
  options: {
    semanas: number[];
    divisiones: string[];
    clientes: string[];
    tiendas: string[];
  };
}

export function CbFiltersBar({ current, options }: CbFiltersBarProps) {
  const router = useRouter();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`?${params.toString()}` as never);
  }

  function clear() {
    router.push(window.location.pathname as never);
  }

  return (
    <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
      <Field label="Semana">
        <select
          className="w-full rounded border bg-background px-2 py-1.5 text-sm"
          value={current.semana ?? ""}
          onChange={(e) => setParam("semana", e.target.value)}
        >
          <option value="">Todas</option>
          {options.semanas.map((s) => (
            <option key={s} value={s}>Sem {s}</option>
          ))}
        </select>
      </Field>

      <Field label="División">
        <select
          className="w-full rounded border bg-background px-2 py-1.5 text-sm"
          value={current.division ?? ""}
          onChange={(e) => setParam("division", e.target.value)}
        >
          <option value="">Todas</option>
          {options.divisiones.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </Field>

      <Field label="Cliente / Cadena">
        <select
          className="w-full rounded border bg-background px-2 py-1.5 text-sm"
          value={current.cliente ?? ""}
          onChange={(e) => setParam("cliente", e.target.value)}
        >
          <option value="">Todos</option>
          {options.clientes.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Field>

      <Field label="Tienda">
        <select
          className="w-full rounded border bg-background px-2 py-1.5 text-sm"
          value={current.tienda ?? ""}
          onChange={(e) => setParam("tienda", e.target.value)}
        >
          <option value="">Todas</option>
          {options.tiendas.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </Field>

      <div className="flex items-end">
        <button
          onClick={clear}
          className="rounded-md bg-rose-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-rose-600"
        >
          ⟲ Limpiar
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
