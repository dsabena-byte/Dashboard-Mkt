"use client";

import { useRouter } from "next/navigation";
import { MultiDropdown } from "@/components/multi-dropdown";

interface Props {
  current: {
    meses?: string[];
    semanas?: number[];
    categorias?: string[];
    clientes?: string[];
    tiendas?: string[];
  };
  options: {
    meses: string[];
    semanas: number[];
    categorias: string[];
    clientes: string[];
    tiendas: { value: string; label: string }[];
  };
}

export function FloorShareFilters({ current, options }: Props) {
  const router = useRouter();

  function update(key: string, values: string[]) {
    const params = new URLSearchParams(window.location.search);
    params.delete(key);
    for (const v of values) params.append(key, v);
    router.push(`?${params.toString()}` as never);
  }

  function clearAll() {
    router.push(window.location.pathname as never);
  }

  const hasAny =
    (current.meses?.length ?? 0) > 0 ||
    (current.semanas?.length ?? 0) > 0 ||
    (current.categorias?.length ?? 0) > 0 ||
    (current.clientes?.length ?? 0) > 0 ||
    (current.tiendas?.length ?? 0) > 0;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
      <MultiDropdown
        label="Mes"
        placeholder="Todos"
        selected={current.meses ?? []}
        options={options.meses.map((m) => ({ value: m, label: m }))}
        onChange={(v) => update("meses", v)}
      />
      <MultiDropdown
        label="Semana"
        placeholder="Todas"
        selected={(current.semanas ?? []).map(String)}
        options={options.semanas.map((s) => ({ value: String(s), label: `Sem ${s}` }))}
        onChange={(v) => update("semanas", v)}
      />
      <MultiDropdown
        label="Categoría"
        placeholder="Todas"
        selected={current.categorias ?? []}
        options={options.categorias.map((c) => ({ value: c, label: c }))}
        onChange={(v) => update("categorias", v)}
      />
      <MultiDropdown
        label="Cliente / Cadena"
        placeholder="Todos"
        selected={current.clientes ?? []}
        options={options.clientes.map((c) => ({ value: c, label: c }))}
        onChange={(v) => update("clientes", v)}
      />
      <MultiDropdown
        label="Tienda"
        placeholder="Todas"
        selected={current.tiendas ?? []}
        options={options.tiendas}
        onChange={(v) => update("tiendas", v)}
      />
      <div className="ml-auto">
        <button
          onClick={clearAll}
          disabled={!hasAny}
          className="rounded-md border bg-rose-500 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-rose-600 disabled:opacity-50 disabled:hover:bg-rose-500"
        >
          ⟲ Limpiar filtros
        </button>
      </div>
    </div>
  );
}
