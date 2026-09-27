"use client";
import { useEffect, useRef, useState } from "react";
import { LearnButton } from "@/components/knowledge/learn-button";

// "Compartir" de un tablero de Mis tableros (portado de BIP): link de SOLO LECTURA con vencimiento
// (7/30/90 días; crear otro invalida el anterior; se puede revocar) + envío programado por mail del link
// (semanal los lunes / mensual el día 1; cron /api/cron/tableros-envio). API: /api/tableros/compartir.
// OJO: no importar lib/tablero-share (usa node:crypto) desde acá.

type Estado = {
  link: { url: string | null; exp: number } | null;
  envio: { frecuencia: "semanal" | "mensual"; destinatarios: string[]; ultimo?: string | null } | null;
  dominios: string[]; emailReady: boolean; enabled: boolean;
};
const fecha = (exp: number) => new Date(exp * 1000).toLocaleDateString("es-AR");
const box: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 8, padding: "6px 9px", fontSize: 13, background: "#fff", fontFamily: "inherit" };

export function ShareTablero({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [st, setSt] = useState<Estado | null>(null);
  const [err0, setErr0] = useState<string | null>(null);
  const [dias, setDias] = useState(30);
  const [frec, setFrec] = useState<"semanal" | "mensual">("semanal");
  const [dest, setDest] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const r = await fetch(`/api/tableros/compartir?slug=${encodeURIComponent(slug)}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErr0(d.error ?? "No se pudo leer el estado"); return; }
    setSt(d as Estado);
    if (d.envio) { setFrec(d.envio.frecuencia); setDest(d.envio.destinatarios.join(", ")); }
  }
  useEffect(() => { if (open && !st) void load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  async function call(method: "POST" | "DELETE", body: Record<string, unknown>, okText: string) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/tableros/compartir", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, ...body }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "No se pudo");
      setMsg({ ok: true, t: okText + (d.rejected?.length ? ` (no incluimos: ${d.rejected.join(", ")})` : "") });
      await load();
    } catch (e) { setMsg({ ok: false, t: e instanceof Error ? e.message : "Error" }); }
    setBusy(false);
  }
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* sin permiso: queda el input para copiar a mano */ }
  }

  const url = st?.link?.url ?? null;
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button type="button" className="vz-pill" onClick={() => setOpen((o) => !o)} style={{ color: "var(--navy)", fontWeight: 600 }}>Compartir</button>
      {open && (
        <div className="vz-pop" style={{ minWidth: 320, maxWidth: 380, right: 0, left: "auto" }}>
          {err0 ? <div className="hint" style={{ margin: 0, color: "var(--err)" }}>{err0}</div> : !st ? <div className="hint" style={{ margin: 0 }}>Cargando…</div> : !st.enabled ? <div className="hint" style={{ margin: 0 }}>Los links compartidos no están habilitados en este entorno.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <b style={{ fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 6 }}>Link de solo lectura <LearnButton k="compartir_tablero" /></b>
                <p className="hint" style={{ margin: "2px 0 6px", fontSize: 12 }}>Para el directorio o la agencia: quien tenga el link ve este tablero y los datos que lo alimentan, sin iniciar sesión ni poder editar.</p>
                {url ? (
                  <>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input readOnly value={url} style={{ ...box, flex: 1, minWidth: 0, fontSize: 11.5 }} onFocus={(e) => e.currentTarget.select()} />
                      <button type="button" className="btn" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => copy(url)}>{copied ? "Copiado" : "Copiar"}</button>
                    </div>
                    <div className="hint" style={{ margin: "4px 0 0", fontSize: 11.5 }}>Vence el {fecha(st.link!.exp)} · <button type="button" className="vz-link" style={{ color: "var(--err)", fontSize: 11.5 }} disabled={busy} onClick={() => call("DELETE", { what: "link" }, "Link desactivado.")}>Dejar de compartir</button></div>
                  </>
                ) : null}
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
                  <select value={dias} onChange={(e) => setDias(Number(e.target.value))} style={box}>
                    {[7, 30, 90].map((d) => <option key={d} value={d}>Vence en {d} días</option>)}
                  </select>
                  <button type="button" className="btn" style={{ padding: "5px 10px", fontSize: 12 }} disabled={busy} onClick={() => call("POST", { action: "link", dias }, url ? "Link nuevo listo (el anterior dejó de andar)." : "Link listo.")}>{url ? "Generar otro" : "Crear link"}</button>
                </div>
              </div>
              <div style={{ borderTop: "1px solid var(--line-2)", paddingTop: 10 }}>
                <b style={{ fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 6 }}>Envío programado por mail <LearnButton k="compartir_tablero" /></b>
                <p className="hint" style={{ margin: "2px 0 6px", fontSize: 12 }}>Llega un mail con el link actualizado (semanal: los lunes · mensual: el día 1). Solo casillas de {st.dominios.length ? st.dominios.map((d) => `@${d}`).join(", ") : "los dominios del equipo"}.</p>
                {!st.emailReady && <p className="hint" style={{ margin: "0 0 6px", fontSize: 11.5, color: "#92400e" }}>El envío de emails no está configurado (falta RESEND_API_KEY en Vercel): se guarda pero no sale.</p>}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <select value={frec} onChange={(e) => setFrec(e.target.value as "semanal" | "mensual")} style={box}>
                    <option value="semanal">Semanal (lunes)</option><option value="mensual">Mensual (día 1)</option>
                  </select>
                  <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="emails separados por coma" style={box} />
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button type="button" className="btn" style={{ padding: "5px 10px", fontSize: 12 }} disabled={busy || !dest.trim()} onClick={() => call("POST", { action: "envio", frecuencia: frec, destinatarios: dest }, "Envío programado.")}>{st.envio ? "Guardar cambios" : "Programar"}</button>
                    {st.envio && <button type="button" className="vz-link" style={{ color: "var(--err)", fontSize: 12 }} disabled={busy} onClick={() => call("DELETE", { what: "envio" }, "Envío desactivado.")}>Desactivar</button>}
                  </div>
                  {st.envio?.ultimo && <span className="hint" style={{ margin: 0, fontSize: 11.5 }}>Último envío: {new Date(st.envio.ultimo).toLocaleDateString("es-AR")}</span>}
                </div>
              </div>
              {msg && <div className="hint" style={{ margin: 0, fontSize: 12, color: msg.ok ? "var(--good)" : "var(--err)" }}>{msg.t}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
