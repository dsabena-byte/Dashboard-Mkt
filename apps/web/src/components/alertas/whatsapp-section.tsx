"use client";
import { useEffect, useState } from "react";
import { cleanPhones, formatPhone, normalizeWhatsAppNumber } from "@/lib/whatsapp-shared";

// Canal WhatsApp de Alertas (Evolution API). Controlado por AlertasForm (se guarda junto con el email).
// Estado de la conexión y "Enviar prueba" por /api/alertas/whatsapp-test (se pide al abrir, no en el render).
const LBL = "mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground";

interface Status { state: string; conectado: boolean; error: string | null; ultimo: { estado: string; tipo: string; at: string } | null }

const ESTADO_TXT: Record<string, string> = {
  enviado: "enviado", desconectado: "no se envió (WhatsApp desconectado)", sin_config: "no se envió (falta configurar el servidor)",
  sin_destinatarios: "no se envió (sin números)", error: "falló el envío",
};

export function WhatsappSection({ on, setOn, numeros, setNumeros, migrated }: {
  on: boolean; setOn: (v: boolean) => void; numeros: string; setNumeros: (v: string) => void; migrated: boolean;
}) {
  const [st, setSt] = useState<Status | null>(null);
  const [stErr, setStErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/alertas/whatsapp-test", { cache: "no-store" })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "No se pudo consultar"); return d as Status; })
      .then((d) => { if (alive) setSt(d); })
      .catch((e) => { if (alive) setStErr(e instanceof Error ? e.message : "Error"); });
    return () => { alive = false; };
  }, []);

  const partes = numeros.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
  const invalidos = partes.filter((x) => !normalizeWhatsAppNumber(x));
  const validos = cleanPhones(numeros);

  async function probar() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/alertas/whatsapp-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ numeros: validos }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No se pudo enviar");
      setMsg({ ok: true, text: `Enviado a ${(d.to as string[]).map(formatPhone).join(", ")}. Revisá WhatsApp.` });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" }); } finally { setBusy(false); }
  }

  const badge = !st
    ? { txt: stErr ? "No se pudo consultar" : "Consultando…", bg: "#f1f5f9", fg: "#475569" }
    : st.conectado ? { txt: "Conectado", bg: "#dcfce7", fg: "#166534" }
    : { txt: "Desconectado", bg: "#fee2e2", fg: "#b91c1c" };

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">WhatsApp</h4>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: badge.bg, color: badge.fg }}>{badge.txt}</span>
      </div>
      <p className="text-xs text-muted-foreground">Las mismas alertas y el reporte del mes, cortitos, directo al celular.</p>

      {st && !st.conectado && (
        <p className="rounded-md border px-3 py-2 text-xs" style={{ borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" }}>
          {st.state === "sin_config"
            ? "WhatsApp todavía no está configurado en el servidor. Pedíselo a tu administrador."
            : "Falta vincular el número de WhatsApp que envía los mensajes: pedíselo a tu administrador."}{" "}
          Mientras tanto no se manda nada por WhatsApp; el email sigue funcionando igual.
        </p>
      )}
      {!migrated && (
        <p className="rounded-md border px-3 py-2 text-xs" style={{ borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" }}>
          Para guardar los números falta correr la migración <code>0123_alertas_whatsapp.sql</code> en el SQL Editor de Supabase. El email sigue funcionando.
        </p>
      )}

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={on} disabled={!migrated} onChange={(e) => setOn(e.target.checked)} /> Recibir alertas y el reporte por WhatsApp
      </label>
      <div>
        <span className={LBL}>Celulares</span>
        <input className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" value={numeros} disabled={!migrated} onChange={(e) => setNumeros(e.target.value)}
          placeholder="11 1234-5678, 351 555-1234" />
        <span className="mt-1 block text-[11px] text-muted-foreground">
          Separados por coma (hasta 20). Con característica, sin 0 ni 15: se completa solo el +54 9.
          {validos.length > 0 && <> Se enviará a: {validos.map(formatPhone).join(", ")}.</>}
        </span>
        {invalidos.length > 0 && <span className="mt-1 block text-[11px] font-medium" style={{ color: "#dc2626" }}>No parecen celulares válidos: {invalidos.join(", ")}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={probar} disabled={busy || !validos.length || !st?.conectado} className="rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50">
          {busy ? "Enviando…" : "Enviar prueba por WhatsApp"}
        </button>
        {st?.ultimo && (
          <span className="text-[11px] text-muted-foreground">
            Último intento automático: {new Date(st.ultimo.at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {ESTADO_TXT[st.ultimo.estado] ?? st.ultimo.estado}
          </span>
        )}
      </div>
      {msg && <p className="text-xs font-medium" style={{ color: msg.ok ? "#16a34a" : "#dc2626" }}>{msg.text}</p>}

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none font-medium text-foreground">¿Cómo se usa?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Tildá la casilla, cargá los celulares y tocá <b>Guardar</b>.</li>
          <li>Llega lo mismo que por email, en versión corta: el resumen de los lunes, las alertas importantes del día y el reporte ejecutivo el primer día hábil del mes. Cada alerta dice qué pasa y qué hacer, con el link al tablero.</li>
          <li>Con <b>Enviar prueba por WhatsApp</b> comprobás que llega (usa los números de la casilla, aunque no hayas guardado).</li>
          <li>Los mensajes salen de un número de WhatsApp propio de la empresa. Si dice “Desconectado”, ese número todavía no está vinculado: lo resuelve tu administrador.</li>
        </ul>
      </details>
    </div>
  );
}
