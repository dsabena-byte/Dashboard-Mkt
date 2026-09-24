"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FUNCS, NUM_FORMATS, ROWS_FIELD, compile, prepare, resolveName, rowVal, computeMeasure, fmtValue, uid,
  type BlendDef, type CalcDef, type Dataset, type DatasetSettings, type Field, type FieldOverride, type Prepared,
} from "@/lib/viz";

// Panel "Campos" del editor: dimensiones y medidas con íconos de tipo, búsqueda, arrastrar a
// los estantes, renombrar/tipo/rol/formato, campos calculados (editor con validación en vivo)
// y cruce con otra planilla (lookup por clave).

export const box: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 8, padding: "6px 8px", fontSize: 12.5, background: "#fff", color: "var(--ink)", fontFamily: "inherit", width: "100%", minWidth: 0 };
export const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--faint)", margin: "0 0 4px", display: "block" };

export function TypeBadge({ f }: { f: Pick<Field, "type" | "role" | "source" | "aggregate"> | "rows" }) {
  const t = f === "rows" ? "#" : f.source === "calc" ? "ƒx" : f.type === "date" ? "📅" : f.type === "number" ? "#" : f.type === "boolean" ? "S/N" : "Abc";
  const meas = f === "rows" || f.role === "measure";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 24, height: 18, borderRadius: 5, fontSize: t === "📅" ? 10 : 9.5, fontWeight: 600, background: meas ? "rgba(20,184,166,.13)" : "rgba(30,64,175,.1)", color: meas ? "#0f766e" : "#1e40af", flex: "0 0 auto", padding: "0 3px" }}>{t}</span>
  );
}

export const DRAG_MIME = "application/x-bip-field";

function FieldRow({ f, onPick, settings, onSettings, onEditCalc }: { f: Field; onPick: (id: string) => void; settings: DatasetSettings; onSettings: (s: DatasetSettings) => void; onEditCalc: (c: CalcDef) => void }) {
  const [open, setOpen] = useState(false);
  const ov = settings.fields?.[f.id] ?? {};
  const setOv = (patch: FieldOverride) => onSettings({ ...settings, fields: { ...(settings.fields ?? {}), [f.id]: { ...ov, ...patch } } });
  return (
    <div>
      <div draggable onDragStart={(e) => { e.dataTransfer.setData(DRAG_MIME, f.id); e.dataTransfer.setData("text/plain", f.id); e.dataTransfer.effectAllowed = "copy"; }}
        style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 6px", borderRadius: 7, cursor: "grab", fontSize: 12.5, color: f.error ? "var(--err)" : "var(--ink)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--line-2)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
        <TypeBadge f={f} />
        <span onClick={() => onPick(f.id)} title={f.error ? f.error : "Clic para sumar · arrastrá a un estante"} style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.label}</span>
        <button onClick={() => setOpen((o) => !o)} title="Opciones del campo" style={{ border: 0, background: "none", color: "var(--faint)", cursor: "pointer", fontSize: 14, padding: "0 2px" }}>⋯</button>
      </div>
      {open && (
        <div style={{ margin: "2px 0 8px 30px", display: "flex", flexDirection: "column", gap: 6, padding: 8, border: "1px solid var(--line)", borderRadius: 8, background: "var(--panel-2)" }}>
          {f.source === "calc" ? (
            <>
              {f.error && <span style={{ fontSize: 11.5, color: "var(--err)" }}>{f.error}</span>}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="vz-link" onClick={() => f.calc && onEditCalc(f.calc)}>Editar fórmula</button>
                <button className="vz-link" style={{ color: "var(--err)" }} onClick={() => { if (confirm(`¿Eliminar el campo “${f.label}”?`)) onSettings({ ...settings, calcs: (settings.calcs ?? []).filter((c) => c.id !== f.id) }); }}>Eliminar</button>
              </div>
            </>
          ) : (
            <>
              <input style={box} value={ov.label ?? f.label} onChange={(e) => setOv({ label: e.target.value })} placeholder="Nombre" />
              <div style={{ display: "flex", gap: 6 }}>
                <select style={box} value={ov.type ?? ""} onChange={(e) => setOv({ type: (e.target.value || undefined) as FieldOverride["type"] })} title="Tipo">
                  <option value="">Tipo: auto ({f.type === "date" ? "fecha" : f.type === "number" ? "número" : f.type === "boolean" ? "sí/no" : "texto"})</option>
                  <option value="date">Fecha</option><option value="number">Número</option><option value="text">Texto</option><option value="boolean">Sí/No</option>
                </select>
                <select style={box} value={ov.role ?? ""} onChange={(e) => setOv({ role: (e.target.value || undefined) as FieldOverride["role"] })} title="Rol">
                  <option value="">Rol: auto</option><option value="dimension">Dimensión</option><option value="measure">Medida</option>
                </select>
              </div>
              {f.type === "number" && (
                <select style={box} value={ov.format ?? ""} onChange={(e) => setOv({ format: (e.target.value || undefined) as FieldOverride["format"] })}>
                  <option value="">Formato: auto</option>
                  {NUM_FORMATS.filter((x) => x.v !== "auto").map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
                </select>
              )}
              <label style={{ display: "flex", gap: 6, fontSize: 12, alignItems: "center" }}><input type="checkbox" checked={!!ov.hidden} onChange={(e) => setOv({ hidden: e.target.checked || undefined })} />Ocultar de la lista</label>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function FieldsPanel({ P, settings, onSettings, onPick, datasetsList, currentDs, onDataset, loadDataset, datasets }: {
  P: Prepared | undefined; settings: DatasetSettings; onSettings: (s: DatasetSettings) => void; onPick: (id: string) => void;
  datasetsList: { id: string; name: string }[]; currentDs: string; onDataset: (id: string) => void;
  loadDataset: (id: string) => Promise<Dataset | null>; datasets: Record<string, Dataset>;
}) {
  const [q, setQ] = useState("");
  const [calc, setCalc] = useState<CalcDef | null>(null);
  const [blend, setBlend] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const fields = (P?.fields ?? []).filter((f) => (showHidden || !f.hidden) && (!q || f.label.toLowerCase().includes(q.toLowerCase())));
  const dims = fields.filter((f) => f.role === "dimension");
  const meas = fields.filter((f) => f.role === "measure");
  const hiddenCount = (P?.fields ?? []).filter((f) => f.hidden).length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
      <div>
        <span style={lbl}>Planilla</span>
        <select style={box} value={currentDs} onChange={(e) => onDataset(e.target.value)}>
          {datasetsList.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <input style={box} placeholder="Buscar campo…" value={q} onChange={(e) => setQ(e.target.value)} />
      {!P ? <p className="hint" style={{ margin: 0 }}>Cargando planilla…</p> : (
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <span style={lbl}>Dimensiones</span>
            {dims.map((f) => <FieldRow key={f.id} f={f} onPick={onPick} settings={settings} onSettings={onSettings} onEditCalc={setCalc} />)}
            {!dims.length && <span className="hint" style={{ fontSize: 12 }}>—</span>}
          </div>
          <div>
            <span style={lbl}>Medidas</span>
            {meas.map((f) => <FieldRow key={f.id} f={f} onPick={onPick} settings={settings} onSettings={onSettings} onEditCalc={setCalc} />)}
            <div draggable onDragStart={(e) => { e.dataTransfer.setData(DRAG_MIME, ROWS_FIELD); e.dataTransfer.setData("text/plain", ROWS_FIELD); }} onClick={() => onPick(ROWS_FIELD)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 6px", fontSize: 12.5, cursor: "grab", color: "var(--muted)" }}>
              <TypeBadge f="rows" /><span>Cantidad de filas</span>
            </div>
          </div>
          {hiddenCount > 0 && <button className="vz-link" style={{ alignSelf: "flex-start", color: "var(--muted)" }} onClick={() => setShowHidden((s) => !s)}>{showHidden ? "Esconder ocultos" : `Ver ${hiddenCount} oculto(s)`}</button>}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
        <button className="vz-link" style={{ textAlign: "left" }} onClick={() => setCalc({ id: uid("calc"), name: "", expr: "" })} disabled={!P}>+ Campo calculado</button>
        <button className="vz-link" style={{ textAlign: "left" }} onClick={() => setBlend(true)} disabled={!P || datasetsList.length < 2}>+ Cruzar con otra planilla</button>
      </div>
      {calc && P && <CalcEditor P={P} settings={settings} initial={calc} onSave={(c) => { const exists = (settings.calcs ?? []).some((x) => x.id === c.id); onSettings({ ...settings, calcs: exists ? (settings.calcs ?? []).map((x) => (x.id === c.id ? c : x)) : [...(settings.calcs ?? []), c] }); setCalc(null); }} onClose={() => setCalc(null)} />}
      {blend && P && <BlendEditor P={P} currentDs={currentDs} datasetsList={datasetsList} loadDataset={loadDataset} datasets={datasets} onSave={(b) => { onSettings({ ...settings, blends: [...(settings.blends ?? []), b] }); setBlend(false); }} onClose={() => setBlend(false)} />}
    </div>
  );
}

// ── Modal genérico ──
export function Modal({ title, onClose, children, width = 640 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.38)", zIndex: 1200, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 12px", overflowY: "auto" }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: width, padding: 20, boxShadow: "0 20px 60px -20px rgba(15,23,42,.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" style={{ border: 0, background: "none", fontSize: 20, cursor: "pointer", color: "var(--muted)" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CalcEditor({ P, settings, initial, onSave, onClose }: { P: Prepared; settings: DatasetSettings; initial: CalcDef; onSave: (c: CalcDef) => void; onClose: () => void }) {
  const [name, setName] = useState(initial.name);
  const [expr, setExpr] = useState(initial.expr);
  const [format, setFormat] = useState(initial.format ?? "auto");
  const [debounced, setDebounced] = useState(initial.expr);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const t = setTimeout(() => setDebounced(expr), 350); return () => clearTimeout(t); }, [expr]);

  // Validación sintáctica inmediata + vista previa de valores (con el cálculo aplicado).
  const check = useMemo(() => {
    if (!debounced.trim()) return { ok: false, msg: "" };
    try {
      const c = compile(debounced, (n) => resolveName(P, n));
      return { ok: true, msg: c.aggregate ? "Fórmula válida · agregada (se calcula después de agrupar, ej. un ratio)" : "Fórmula válida · por fila", agg: c.aggregate };
    } catch (e) { return { ok: false, msg: e instanceof Error ? e.message : "Error" }; }
  }, [debounced, P]);
  const preview = useMemo(() => {
    if (!check.ok) return null;
    const tmp: CalcDef = { id: "__preview", name: "__preview", expr: debounced };
    const PP = prepare(P.ds, { ...settings, calcs: [...(settings.calcs ?? []).filter((c) => c.id !== initial.id), tmp] });
    const f = PP.byId.get("__preview");
    if (!f) return null;
    if (f.error) return { err: f.error };
    if (f.aggregate) { const all = Array.from({ length: PP.n }, (_, i) => i); return { vals: [`Total: ${fmtValue(computeMeasure(PP, { field: f.id, agg: "sum" }, all), format === "auto" ? f.format : format, false)}`] }; }
    const vals: string[] = [];
    for (let i = 0; i < PP.n && vals.length < 5; i++) { const v = rowVal(PP, f.id, i); vals.push(v == null ? "—" : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "number" ? fmtValue(v, format === "auto" ? f.format : format, false) : String(v)); }
    return { vals };
  }, [check.ok, debounced, P, settings, initial.id, format]);

  function insert(t: string) {
    const el = ta.current;
    if (!el) { setExpr((e) => e + t); return; }
    const s = el.selectionStart ?? expr.length, e = el.selectionEnd ?? expr.length;
    const next = expr.slice(0, s) + t + expr.slice(e);
    setExpr(next);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = s + t.length; });
  }
  const others = P.fields.filter((f) => f.id !== initial.id && !f.error);
  return (
    <Modal title={initial.name ? `Editar “${initial.name}”` : "Nuevo campo calculado"} onClose={onClose} width={760}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div><span style={lbl}>Nombre</span><input style={box} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. ROAS, Desvío %, Canal agrupado" autoFocus /></div>
          <div>
            <span style={lbl}>Fórmula</span>
            <textarea ref={ta} value={expr} onChange={(e) => setExpr(e.target.value)} rows={5} spellCheck={false} placeholder='Ej. SUM([Ventas]) / SUM([Inversión])  ·  IF([Canal] = "Online", "Digital", "Tradicional")'
              style={{ ...box, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12.5, resize: "vertical" }} />
            <div style={{ minHeight: 18, fontSize: 12, marginTop: 4, color: check.ok ? "var(--good)" : "var(--err)" }}>{check.msg}</div>
          </div>
          {preview && (
            <div style={{ fontSize: 12, color: "var(--muted)", background: "var(--panel-2)", borderRadius: 8, padding: "8px 10px" }}>
              {"err" in preview && preview.err ? <span style={{ color: "var(--err)" }}>{preview.err}</span> : <>Vista previa: {(preview.vals ?? []).join(" · ")}</>}
            </div>
          )}
          <div><span style={lbl}>Formato</span>
            <select style={{ ...box, width: 220 }} value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
              {NUM_FORMATS.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
            </select>
          </div>
          <p className="hint" style={{ margin: 0, fontSize: 12 }}>Los campos van entre corchetes. Operadores: + − × / ( ), comparaciones (= &lt;&gt; &lt; &gt;), AND / OR / NOT, &amp; para unir textos. Con SUM/AVG/… el cálculo se hace después de agrupar (ideal para ratios).</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn ghost" onClick={onClose} style={{ padding: "7px 14px" }}>Cancelar</button>
            <button className="btn" disabled={!check.ok || !name.trim()} onClick={() => onSave({ id: initial.id, name: name.trim(), expr, format: format === "auto" ? undefined : format })} style={{ padding: "7px 14px" }}>Guardar campo</button>
          </div>
        </div>
        <div style={{ borderLeft: "1px solid var(--line)", paddingLeft: 12, display: "flex", flexDirection: "column", gap: 10, maxHeight: 460, overflowY: "auto" }}>
          <div>
            <span style={lbl}>Campos</span>
            {others.map((f) => <button key={f.id} className="vz-link" style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--ink)", fontWeight: 500, textAlign: "left" }} onClick={() => insert(`[${f.label}]`)}><TypeBadge f={f} />{f.label}</button>)}
          </div>
          <div>
            <span style={lbl}>Funciones</span>
            {FUNCS.map((fn) => <button key={fn.name} className="vz-link" title={fn.desc} style={{ display: "block", color: "var(--ink)", fontWeight: 500, textAlign: "left", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5 }} onClick={() => insert(fn.name === "AND" || fn.name === "OR" ? ` ${fn.name} ` : fn.name === "NOT" ? "NOT " : `${fn.name}(`)}>{fn.sig}</button>)}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function BlendEditor({ P, currentDs, datasetsList, loadDataset, datasets, onSave, onClose }: { P: Prepared; currentDs: string; datasetsList: { id: string; name: string }[]; loadDataset: (id: string) => Promise<Dataset | null>; datasets: Record<string, Dataset>; onSave: (b: BlendDef) => void; onClose: () => void }) {
  const others = datasetsList.filter((d) => d.id !== currentDs);
  const [ds, setDs] = useState(others[0]?.id ?? "");
  const [local, setLocal] = useState(P.fields.find((f) => f.role === "dimension" && f.type === "text")?.id ?? "");
  const [remoteKey, setRemoteKey] = useState("0");
  const [cols, setCols] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const remote = datasets[ds];
  useEffect(() => { if (ds && !datasets[ds]) { setLoading(true); loadDataset(ds).finally(() => setLoading(false)); } }, [ds, datasets, loadDataset]);
  return (
    <Modal title="Cruzar con otra planilla" onClose={onClose}>
      <p className="hint" style={{ marginTop: 0 }}>Trae columnas de otra planilla usando una clave en común (como un BUSCARV). Ej.: sumar el responsable o la meta de cada canal.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><span style={lbl}>Otra planilla</span><select style={box} value={ds} onChange={(e) => { setDs(e.target.value); setCols([]); }}>{others.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div />
        <div><span style={lbl}>Clave en esta planilla</span><select style={box} value={local} onChange={(e) => setLocal(e.target.value)}>{P.fields.filter((f) => f.role === "dimension" && !f.aggregate).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></div>
        <div><span style={lbl}>Clave en la otra</span><select style={box} value={remoteKey} onChange={(e) => setRemoteKey(e.target.value)} disabled={!remote}>{(remote?.columns ?? []).map((c, i) => <option key={i} value={String(i)}>{String(c)}</option>)}</select></div>
      </div>
      <div style={{ marginTop: 12 }}>
        <span style={lbl}>Columnas a traer</span>
        {loading && <p className="hint">Cargando…</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(remote?.columns ?? []).map((c, i) => String(i) === remoteKey ? null : (
            <label key={i} style={{ display: "flex", gap: 5, fontSize: 12.5, alignItems: "center", border: "1px solid var(--line)", borderRadius: 8, padding: "4px 8px" }}>
              <input type="checkbox" checked={cols.includes(String(i))} onChange={() => setCols((cs) => (cs.includes(String(i)) ? cs.filter((x) => x !== String(i)) : [...cs, String(i)]))} />{String(c)}
            </label>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button className="btn ghost" onClick={onClose} style={{ padding: "7px 14px" }}>Cancelar</button>
        <button className="btn" disabled={!remote || !local || !cols.length} onClick={() => onSave({ id: uid("b").replace("b_", ""), datasetId: ds, localKey: local, remoteKey, fields: cols })} style={{ padding: "7px 14px" }}>Cruzar</button>
      </div>
    </Modal>
  );
}
