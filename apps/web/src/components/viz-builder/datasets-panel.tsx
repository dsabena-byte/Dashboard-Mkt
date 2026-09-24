"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SheetAdder } from "./sheet-adder";

// Planillas cargadas en Mis tableros: lista, quitar y sumar nuevas (archivo o Google Sheets).
type Ds = { id: string; name: string; row_count: number; source?: unknown; updated_at?: string | null };

export function DatasetsPanel({ datasets }: { datasets: Ds[] }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(datasets.length === 0);

  async function remove(d: Ds) {
    if (!confirm(`¿Quitar la planilla “${d.name}”?`)) return;
    setErr(null);
    const res = await fetch("/api/tableros/datasets", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d.id }) });
    if (res.ok) router.refresh(); else setErr((await res.json().catch(() => ({}))).error ?? "No se pudo quitar");
  }
  const src = (s: unknown) => ((s as { type?: string } | null)?.type === "google_sheet" ? "Google Sheets" : "Archivo");

  return (
    <div className="card" style={{ margin: 0, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }}>Planillas</span>
        <button className="vz-link" onClick={() => setAdding((a) => !a)}>{adding ? "Cerrar" : "+ Sumar planilla"}</button>
      </div>
      {err && <div className="err" style={{ margin: "0 14px 10px" }}>{err}</div>}
      {adding && <div style={{ padding: "0 14px 14px" }}><SheetAdder /></div>}
      {datasets.map((d) => (
        <div key={d.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 14px", borderTop: "1px solid var(--line-2)", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{d.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{d.row_count.toLocaleString("es-AR")} filas · {src(d.source)}{d.updated_at ? ` · ${new Date(d.updated_at).toLocaleDateString("es-AR")}` : ""}</div>
          </div>
          <a className="vz-link" href={`/tableros?dataset=${d.id}`}>Crear tablero</a>
          <button className="vz-link" style={{ color: "var(--err)" }} onClick={() => remove(d)}>Quitar</button>
        </div>
      ))}
      {!datasets.length && <div className="hint" style={{ padding: "10px 14px", borderTop: "1px solid var(--line-2)", margin: 0 }}>Todavía no hay planillas.</div>}
    </div>
  );
}
