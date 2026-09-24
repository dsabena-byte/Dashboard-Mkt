"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { detectMapping, missingFields, parseSalud, SALUD_FIELDS, type Mapping } from "@/lib/research-core";
import { buildKantarOverlay, CAT_LABEL, guessCat, KANTAR_SHEET_WAVES, type CatKey, type KantarSheetConfig, type KantarTables } from "@/lib/kantar-sheet-core";

// Kantar por planilla (opcional): planilla → mapeo de columnas (auto-detectado, research-core de
// BIP) → categorías → vista previa de qué celdas se pisan → guardar. Sin config, /salud-marca
// sigue con los valores fijos del código. Consideración no aplica (el modelo de Drean no la usa).

type Full = { id: string; name: string; columns: string[]; rows: unknown[][] };
type Ds = { id: string; name: string; row_count: number };
const FIELDS = SALUD_FIELDS.filter((f) => f.key !== "consideracion");

export function KantarSetup({ config, updatedAt, datasets, base }: { config: KantarSheetConfig | null; updatedAt: string | null; datasets: Ds[]; base: KantarTables }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(config?.datasetId ?? "");
  const [full, setFull] = useState<Full | null>(null);
  const [mapping, setMapping] = useState<Mapping>(config?.mapping ?? {});
  const [catMap, setCatMap] = useState<Record<string, CatKey | "">>(config?.catMap ?? {});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!pick || !open) { setFull(null); return; }
    let alive = true;
    setMsg(null);
    fetch(`/api/tableros/dataset?id=${encodeURIComponent(pick)}`).then(async (r) => {
      const d = await r.json();
      if (!alive) return;
      if (!r.ok) { setMsg({ ok: false, text: d.error ?? "No se pudo leer la planilla." }); setFull(null); return; }
      setFull(d as Full);
      if (!(config && config.datasetId === pick)) { const m = detectMapping("salud", (d as Full).columns); delete m.consideracion; setMapping(m); setCatMap({}); }
    }).catch(() => alive && setMsg({ ok: false, text: "No se pudo leer la planilla." }));
    return () => { alive = false; };
  }, [pick, open, config]);

  const cats = useMemo(() => (full ? parseSalud(full.columns, full.rows, mapping).categorias : []), [full, mapping]);
  const effCat = (c: string): CatKey | "" => (c in catMap ? catMap[c]! : guessCat(c));
  const preview = useMemo(() => {
    if (!full) return null;
    const cm: Record<string, CatKey | ""> = {};
    for (const c of cats) cm[c] = effCat(c);
    return buildKantarOverlay(full.columns, full.rows, { datasetId: full.id, mapping, catMap: cm }, base).report;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, mapping, catMap, cats, base]);
  const faltan = missingFields("salud", mapping);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const cm: Record<string, CatKey | ""> = {};
      for (const c of cats) cm[c] = effCat(c);
      const res = await fetch("/api/tableros/kantar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ datasetId: pick, mapping, catMap: cm }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudo guardar");
      setOpen(false); setMsg({ ok: true, text: "Guardado. /salud-marca ya usa la planilla." }); router.refresh();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" }); } finally { setBusy(false); }
  }
  async function quitar() {
    if (!confirm("¿Dejar de usar la planilla? /salud-marca vuelve a los valores fijos del tablero.")) return;
    setBusy(true);
    try { await fetch("/api/tableros/kantar", { method: "DELETE" }); router.refresh(); } finally { setBusy(false); }
  }

  const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--faint)" };
  const sel: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 8, padding: "7px 9px", fontSize: 13, background: "#fff", color: "var(--ink)", width: "100%", minWidth: 0 };
  const plantilla = <a href="/api/tableros/kantar/plantilla" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--navy)" }}>Descargar plantilla (Excel)</a>;
  const dsName = datasets.find((d) => d.id === config?.datasetId)?.name;

  return (
    <div id="kantar" className="card" style={{ margin: 0 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 340px", minWidth: 0 }}>
          <b>Kantar por planilla (Salud de Marca)</b> <span style={{ fontSize: 11, color: "var(--faint)" }}>opcional</span>
          <div className="hint" style={{ margin: "2px 0 0" }}>
            {config
              ? <>/salud-marca usa los valores fijos <b>+ la planilla “{dsName ?? "—"}”</b>{updatedAt ? ` (desde el ${new Date(updatedAt).toLocaleDateString("es-AR")})` : ""}: pisa solo las celdas que la planilla trae.</>
              : <>Hoy /salud-marca usa los valores Kantar fijos del tablero. Si cargás una planilla por ola × marca × categoría, sus valores pisan esas celdas (olas {KANTAR_SHEET_WAVES.join(", ")}).</>}
          </div>
        </div>
        {!open && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {plantilla}
            {config ? <><button className="btn ghost" style={{ padding: "7px 14px", fontSize: 13 }} onClick={() => setOpen(true)} disabled={busy}>Cambiar</button><button className="btn ghost" style={{ padding: "7px 14px", fontSize: 13 }} onClick={quitar} disabled={busy}>Quitar</button></>
              : <button className="btn" style={{ padding: "7px 14px", fontSize: 13 }} onClick={() => setOpen(true)} disabled={!datasets.length} title={datasets.length ? "" : "Primero sumá la planilla en Planillas"}>Conectar planilla</button>}
          </div>
        )}
      </div>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14, borderTop: "1px solid var(--line-2)", paddingTop: 14 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 3, flex: "0 1 420px" }}>
              <span style={lbl}>Planilla</span>
              <select style={sel} value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Elegí una planilla…</option>
                {datasets.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.row_count} filas</option>)}
              </select>
            </label>
            {plantilla}
            <button className="vz-link" onClick={() => { setOpen(false); setMsg(null); }}>Cerrar</button>
          </div>

          {full && preview && (
            <>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
                {FIELDS.map((f) => (
                  <label key={f.key} style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }} title={f.hint}>
                    <span style={{ ...lbl, color: f.required && mapping[f.key] == null ? "var(--err)" : "var(--faint)" }}>{f.label}{f.required ? " *" : ""}</span>
                    <select style={sel} value={mapping[f.key] ?? ""} onChange={(e) => setMapping((m) => { const n = { ...m }; if (e.target.value === "") delete n[f.key]; else n[f.key] = Number(e.target.value); return n; })}>
                      <option value="">{f.required ? "Elegí la columna…" : "— no está —"}</option>
                      {full.columns.map((c, i) => <option key={i} value={i}>{c || `Columna ${i + 1}`}</option>)}
                    </select>
                  </label>
                ))}
              </div>
              {cats.length > 0 && (
                <div>
                  <span style={lbl}>Categorías de la planilla → Drean</span>
                  <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", marginTop: 4 }}>
                    {cats.map((c) => (
                      <label key={c} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5 }}>
                        <span style={{ flex: "0 0 45%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c}>{c}</span>
                        <select style={sel} value={effCat(c)} onChange={(e) => setCatMap((m) => ({ ...m, [c]: e.target.value as CatKey | "" }))}>
                          <option value="">(ignorar)</option>
                          {(Object.keys(CAT_LABEL) as CatKey[]).map((k) => <option key={k} value={k}>{CAT_LABEL[k]}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="hint" style={{ margin: 0 }}>
                Vista previa: pisa <b style={{ color: "var(--ink)" }}>{preview.celdas}</b> valores en {preview.filas} filas · olas {preview.olasAplicadas.join(", ") || "—"}
                {preview.olasIgnoradas.length > 0 && <> · <span style={{ color: "#92400e" }}>olas no aplicadas: {preview.olasIgnoradas.join(", ")}</span></>}
                {preview.catsIgnoradas.length > 0 && <> · categorías ignoradas: {preview.catsIgnoradas.join(", ")}</>}
                {preview.marcasNuevas.length > 0 && <> · marcas fuera del selector (no se muestran): {preview.marcasNuevas.slice(0, 6).join(", ")}</>}
                {preview.descartadas > 0 && <> · {preview.descartadas} filas sin usar ({preview.motivos.join("; ")})</>}
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button className="btn" style={{ padding: "8px 16px", fontSize: 13 }} onClick={save} disabled={busy || faltan.length > 0 || preview.celdas === 0}>{busy ? "Guardando…" : "Guardar"}</button>
                {faltan.length > 0 && <span className="hint" style={{ margin: 0 }}>Falta: {faltan.join(", ")}.</span>}
              </div>
            </>
          )}
        </div>
      )}
      {msg && <p className="hint" style={{ margin: "8px 0 0", color: msg.ok ? "var(--good)" : "var(--err)" }}>{msg.text}</p>}
    </div>
  );
}
