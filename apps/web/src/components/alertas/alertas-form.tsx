"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FREC_LABEL, type Frecuencia } from "@/lib/alerts-shared";

// Preferencias de alertas por email (portado de BIP, sep-2026). Guarda en alert_prefs vía /api/alertas.
const REAL = "#1e40af";
const LBL = "mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground";

export function AlertasForm({ initial, migrated, emailReady, envRecipients, lastEmail, lastReport }: {
  initial: { emailOn: boolean; frecuencia: Frecuencia; destinatarios: string[]; reporteOn: boolean };
  migrated: boolean; emailReady: boolean; envRecipients: string[]; lastEmail: string; lastReport: string;
}) {
  const router = useRouter();
  const [emailOn, setEmailOn] = useState(initial.emailOn);
  const [frec, setFrec] = useState<Frecuencia>(initial.frecuencia === "off" ? "auto" : initial.frecuencia);
  const [dest, setDest] = useState(initial.destinatarios.join(", "));
  const [reporteOn, setReporteOn] = useState(initial.reporteOn);
  const [busy, setBusy] = useState<"" | "save" | "alertas" | "reporte">("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy("save"); setMsg(null);
    try {
      const r = await fetch("/api/alertas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailOn, frecuencia: frec, destinatarios: dest, reporteOn }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No se pudo guardar");
      setMsg({ ok: true, text: "Listo, guardado." });
      router.refresh();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" }); } finally { setBusy(""); }
  }
  async function test(tipo: "alertas" | "reporte") {
    setBusy(tipo); setMsg(null);
    try {
      const r = await fetch("/api/alertas/prueba", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No se pudo enviar");
      setMsg({ ok: true, text: `Enviado a ${(d.to as string[]).join(", ")}. Revisá la bandeja (y spam la primera vez).` });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" }); } finally { setBusy(""); }
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Emails de alertas y reporte</h3>
        <span className="text-[11px] text-muted-foreground">Último envío de alertas: {lastEmail} · último reporte: {lastReport}</span>
      </div>
      {!migrated && (
        <p className="rounded-md border px-3 py-2 text-xs" style={{ borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" }}>
          Las preferencias todavía no se pueden guardar: falta correr la migración <code>0108_alertas.sql</code> en el SQL Editor de Supabase. Mientras tanto se usa la configuración por defecto y las alertas diarias no se envían (no hay dedupe).
        </p>
      )}
      {!emailReady && (
        <p className="rounded-md border px-3 py-2 text-xs" style={{ borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" }}>
          El envío de emails no está configurado: falta <code>RESEND_API_KEY</code> (y <code>NOTIFY_FROM</code> con un dominio verificado en Resend) en las variables de entorno de Vercel.
        </p>
      )}

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={emailOn} onChange={(e) => setEmailOn(e.target.checked)} /> Recibir alertas por email
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <span className={LBL}>Frecuencia</span>
          <select className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" value={frec} disabled={!emailOn} onChange={(e) => setFrec(e.target.value as Frecuencia)}>
            {(["auto", "semanal", "diaria"] as Frecuencia[]).map((f) => <option key={f} value={f}>{FREC_LABEL[f]}</option>)}
          </select>
        </div>
        <div>
          <span className={LBL}>Destinatarios</span>
          <input className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" value={dest} onChange={(e) => setDest(e.target.value)}
            placeholder={envRecipients.length ? `Vacío = ${envRecipients.join(", ")}` : "emails separados por coma"} />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Emails separados por coma (hasta 20). {envRecipients.length ? "Vacío = la lista por defecto (ALERT_RECIPIENTS)." : "Vacío = sin destinatarios por defecto (ALERT_RECIPIENTS no está configurado)."}
          </span>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={reporteOn} onChange={(e) => setReporteOn(e.target.checked)} /> Recibir el reporte ejecutivo el primer día hábil de cada mes
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={!!busy || !migrated} className="rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: REAL }}>{busy === "save" ? "Guardando…" : "Guardar"}</button>
        <button onClick={() => test("alertas")} disabled={!!busy || !emailReady} className="rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50">{busy === "alertas" ? "Enviando…" : "Enviar una prueba ahora"}</button>
        <button onClick={() => test("reporte")} disabled={!!busy || !emailReady} className="rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50">{busy === "reporte" ? "Armando…" : "Probar el reporte ejecutivo"}</button>
      </div>
      {msg && <p className="text-xs font-medium" style={{ color: msg.ok ? "#16a34a" : "#dc2626" }}>{msg.text}</p>}
    </div>
  );
}
