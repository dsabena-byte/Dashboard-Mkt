"use client";

import { useMemo, useState } from "react";
import { ArgentinaMap } from "./argentina-map";
import type { RegionRow } from "@/lib/competitive-queries";

const CATS = [
  { key: "lavarropas", label: "Lavarropas" },
  { key: "heladeras", label: "Heladeras" },
  { key: "cocinas", label: "Cocinas" },
];

export function RegionSection({ rows }: { rows: RegionRow[] }) {
  const [cat, setCat] = useState("lavarropas");
  const marcas = useMemo(
    () => ["Genérico", ...[...new Set(rows.filter((r) => r.marca !== "Genérico").map((r) => r.marca))].sort()],
    [rows],
  );
  const [marca, setMarca] = useState("Genérico");

  const { values, ranking } = useMemo(() => {
    const sel = rows.filter((r) => r.categoria === cat && r.marca === marca);
    const values: Record<string, number> = {};
    for (const r of sel) if (r.interes != null) values[r.provincia] = r.interes;
    const ranking = Object.entries(values).sort((a, b) => b[1] - a[1]);
    return { values, ranking };
  }, [rows, cat, marca]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-xs text-muted-foreground">
        Sin data por provincia todavía. Corré el sync de regiones para poblar el mapa.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold">Búsqueda por provincia</h2>
        <select
          value={marca}
          onChange={(e) => setMarca(e.target.value)}
          className="ml-auto rounded-md border bg-card px-3 py-1.5 text-sm"
        >
          {marcas.map((m) => (
            <option key={m} value={m}>{m === "Genérico" ? "Demanda genérica" : m}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {CATS.map((c) => (
            <button key={c.key} onClick={() => setCat(c.key)} className={`rounded-full border px-3 py-1 text-xs font-medium ${cat === c.key ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Interés de búsqueda (índice 0-100 de Google Trends) por provincia para <strong>{marca === "Genérico" ? "la categoría" : marca}</strong> en {cat}. Más oscuro = más búsquedas.
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="rounded-xl border bg-card p-4">
          <ArgentinaMap values={values} />
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">Ranking de provincias</h3>
          <div className="max-h-[440px] space-y-1 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ranking.map(([prov, v]) => (
              <div key={prov} className="flex items-center gap-2 text-xs">
                <span className="w-28 shrink-0 truncate">{prov}</span>
                <div className="h-2 flex-1 rounded bg-muted">
                  <div className="h-2 rounded bg-primary" style={{ width: `${v}%` }} />
                </div>
                <span className="w-7 shrink-0 text-right tabular-nums text-muted-foreground">{v}</span>
              </div>
            ))}
            {ranking.length === 0 && <div className="py-4 text-center text-muted-foreground">Sin data.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
