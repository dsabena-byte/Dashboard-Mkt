"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { box, lbl } from "./fields";

// Lista de tableros de planilla + alta ("Nuevo tablero"), renombrar y borrar.
type Item = { slug: string; title: string; datasetId: string | null; widgets: number; updatedAt: string | null; custom: boolean };

export function TablerosAdmin({ custom, datasets, canEdit, presetDataset, openNew }: {
  custom: Item[]; datasets: { id: string; name: string; row_count: number }[]; canEdit: boolean; presetDataset: string | null; openNew: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(openNew && canEdit);
  const [title, setTitle] = useState("");
  const [ds, setDs] = useState(presetDataset ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const dsName = (id: string | null) => datasets.find((d) => d.id === id)?.name;

  async function create() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/tableros", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", title, datasetId: ds || null }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudo crear");
      router.push(`/tableros/${d.slug}/editar`);
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Error"); setBusy(false); }
  }
  async function rename(slug: string) {
    const res = await fetch("/api/tableros", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, title: newName }) });
    if (res.ok) { setRenaming(null); router.refresh(); } else setErr((await res.json()).error ?? "No se pudo renombrar");
  }
  async function remove(it: Item) {
    const msg = `¿Borrar el tablero “${it.title}”? No se puede deshacer (las planillas no se borran).`;
    if (!confirm(msg)) return;
    const res = await fetch("/api/tableros", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: it.slug }) });
    if (res.ok) router.refresh(); else setErr((await res.json()).error ?? "No se pudo borrar");
  }

  const row = (it: Item) => (
    <div key={it.slug} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", borderTop: "1px solid var(--line-2)", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 260px", minWidth: 0 }}>
        {renaming === it.slug ? (
          <div style={{ display: "flex", gap: 6 }}>
            <input style={{ ...box, maxWidth: 320 }} value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === "Enter") void rename(it.slug); if (e.key === "Escape") setRenaming(null); }} />
            <button className="btn" style={{ padding: "5px 12px", fontSize: 12.5 }} onClick={() => rename(it.slug)} disabled={!newName.trim()}>Guardar</button>
          </div>
        ) : <Link href={`/tableros/${it.slug}`} style={{ fontWeight: 600, fontSize: 14 }}>{it.title}</Link>}
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          {it.widgets ? `${it.widgets} gráficos` : "Sin configurar"}{dsName(it.datasetId) ? ` · ${dsName(it.datasetId)}` : ""}{it.updatedAt ? ` · editado ${new Date(it.updatedAt).toLocaleDateString("es-AR")}` : ""}
        </div>
      </div>
      {canEdit && (
        <div style={{ display: "flex", gap: 10 }}>
          <Link href={`/tableros/${it.slug}/editar`} className="vz-link">Editar</Link>
          <button className="vz-link" onClick={() => { setRenaming(it.slug); setNewName(it.title); }}>Renombrar</button>
          {(it.custom || it.widgets > 0) && <button className="vz-link" style={{ color: "var(--err)" }} onClick={() => remove(it)}>{it.custom ? "Borrar" : "Reiniciar"}</button>}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 920 }}>
      <style>{`.vz-link{border:0;background:none;color:var(--navy);font-weight:600;font-size:12.5px;cursor:pointer;padding:4px 2px;font-family:inherit}`}</style>
      {err && <div className="err" style={{ margin: 0 }}>{err}</div>}
      {canEdit && (
        <div className="card" style={{ margin: 0 }}>
          {!creating ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div><b>Nuevo tablero</b><div className="hint" style={{ margin: 0 }}>Elegí una planilla y te armamos un tablero automático; después lo ajustás o le pedís gráficos a la IA.</div></div>
              <button className="btn" onClick={() => setCreating(true)}>+ Nuevo tablero</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 240px" }}><span style={lbl}>Nombre</span><input style={box} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Ventas por canal" autoFocus /></div>
              <div style={{ flex: "1 1 260px" }}><span style={lbl}>Planilla</span>
                <select style={box} value={ds} onChange={(e) => setDs(e.target.value)}>
                  <option value="">La elijo después</option>
                  {datasets.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.row_count.toLocaleString("es-AR")} filas)</option>)}
                </select>
              </div>
              <button className="btn" disabled={busy || !title.trim()} onClick={create}>{busy ? "Creando…" : "Crear"}</button>
              <button className="vz-link" onClick={() => setCreating(false)}>Cancelar</button>
            </div>
          )}
        </div>
      )}
      <div className="card" style={{ margin: 0, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--muted)" }}>Tableros</div>
        {custom.length ? custom.map(row) : <div style={{ padding: "12px 14px", borderTop: "1px solid var(--line-2)" }} className="hint">Todavía no hay tableros. Creá el primero con “+ Nuevo tablero”.</div>}
      </div>
    </div>
  );
}
