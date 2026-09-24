"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// "Sumar planilla" de Mis tableros (Drean). Dos caminos:
//   · Archivo de la compu (Excel/CSV) → siempre disponible (POST /api/tableros/datasets).
//   · Google Sheets por link → solo si el token OAuth de Google de Drean (GOOGLE_REFRESH_TOKEN,
//     el del cron de GA4) tiene scope de Sheets/Drive. Si no, se muestra el estado "no_scope"
//     con qué hacer (ver CLAUDE.md → Mis tableros).
// BIP tenía además Excel en OneDrive/SharePoint (OAuth por tenant) → no aplica a Drean.
type Opt = "archivo" | "google";
type GStatus = { state: "ok" | "no_scope" | "no_env" | "error"; detail?: string } | null;

export function SheetAdder({ onCreated, onFile }: {
  onCreated?: (d: { id: string; name: string; rows: number }) => void;
  onFile?: (f: File) => void;
}) {
  const router = useRouter();
  const [opt, setOpt] = useState<Opt | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [g, setG] = useState<GStatus>(null);

  useEffect(() => {
    if (opt !== "google" || g) return;
    fetch("/api/tableros/datasets/google-sheet").then((r) => r.json()).then((d) => setG(d as GStatus)).catch(() => setG({ state: "error", detail: "No se pudo consultar el estado de Google." }));
  }, [opt, g]);

  async function upload(file: File) {
    if (onFile) { onFile(file); return; }
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/tableros/datasets", { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudo subir");
      setMsg({ ok: true, text: `Listo: ${d.name} (${d.rows} filas).` });
      if (onCreated) onCreated({ id: d.id, name: d.name, rows: d.rows }); else router.refresh();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" }); } finally { setBusy(false); }
  }

  async function linkSheet() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/tableros/datasets/google-sheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "No se pudo leer la planilla");
      setMsg({ ok: true, text: `Listo: ${d.name} (${d.rows} filas).` });
      setUrl("");
      if (onCreated) onCreated({ id: d.id, name: d.name, rows: d.rows }); else router.refresh();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" }); } finally { setBusy(false); }
  }

  const OPTS: { id: Opt; title: string; desc: string }[] = [
    { id: "archivo", title: "Archivo de tu computadora", desc: "Excel (.xlsx/.xls) o CSV. Para actualizarlo, subís la versión nueva." },
    { id: "google", title: "Google Sheets", desc: "Pegás el link de la planilla (primera hoja). Se lee con la cuenta Google del dashboard." },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <b style={{ fontSize: 14 }}>Sumar una planilla</b>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
        {OPTS.map((o) => (
          <button key={o.id} type="button" className={`sh-opt${opt === o.id ? " on" : ""}`} aria-pressed={opt === o.id} onClick={() => { setOpt(o.id); setMsg(null); }}>
            <b>{o.title}</b><span>{o.desc}</span>
          </button>
        ))}
      </div>

      {opt === "archivo" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label className="btn" style={{ cursor: busy ? "default" : "pointer", padding: "8px 14px", fontSize: 13 }}>
            {busy ? "Subiendo…" : "Elegir archivo"}
            <input type="file" accept=".xlsx,.xls,.csv" hidden disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
          </label>
          <span className="hint" style={{ margin: 0 }}>La primera fila tiene que ser la de encabezados. Se lee la primera hoja.</span>
        </div>
      )}

      {opt === "google" && (
        !g ? <span className="hint" style={{ margin: 0 }}>Verificando acceso a Google…</span>
          : g.state === "ok" ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input className="input" style={{ minWidth: 0, flex: "1 1 320px" }} value={url} onChange={(e) => { setUrl(e.target.value); setMsg(null); }} placeholder="https://docs.google.com/spreadsheets/d/…" />
              <button className="btn" onClick={linkSheet} disabled={busy || !url.trim()} style={{ padding: "8px 14px", fontSize: 13 }}>{busy ? "Leyendo…" : "Sumar Google Sheet"}</button>
              <span className="hint" style={{ margin: 0, width: "100%" }}>La planilla tiene que estar compartida con la cuenta Google del dashboard (la misma de GA4). Es una copia: para actualizarla, volvé a sumarla.</span>
            </div>
          ) : (
            <div className="hint" style={{ margin: 0, background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
              {g.state === "no_scope" && <>La cuenta Google del dashboard está conectada <b>solo para GA4</b> (sin permiso de lectura de Sheets/Drive). Hasta que se regenere el token con el scope <code>spreadsheets.readonly</code>, usá <b>Archivo de tu computadora</b> (descargá la planilla como .xlsx).</>}
              {g.state === "no_env" && <>Google no está configurado en este entorno. Usá <b>Archivo de tu computadora</b>.</>}
              {g.state === "error" && <>No se pudo verificar el acceso a Google{g.detail ? ` (${g.detail})` : ""}. Usá <b>Archivo de tu computadora</b>.</>}
            </div>
          )
      )}

      {msg && <p className="hint" style={{ margin: 0, color: msg.ok ? "var(--good)" : "var(--err)" }}>{msg.text}</p>}
    </div>
  );
}
