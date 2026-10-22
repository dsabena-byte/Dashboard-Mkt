"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlanOtros, type AreaPlan } from "@/components/pauta/plan-otros";
import type { HistOtros, OtrosConfig } from "@/lib/plan-otros-kpis";

// Estado + guardado de la pestaña "Plan anual" de Redes / Web / SEO. El calendario y la ambición se guardan en el
// Plan de Medios del año (PATCH /api/plan-medios); las metas se recalculan en el server desde lo guardado.
export function PlanOtrosTab({ area, anio, inicial, hist, invPlan, editor, email, metasActuales }: {
  area: AreaPlan; anio: number; inicial: OtrosConfig; hist: HistOtros; invPlan: number[];
  editor: boolean; email: string | null; metasActuales: Record<string, (number | null)[]>;
}) {
  const router = useRouter();
  const [otros, setOtros] = useState(inicial);
  const [base, setBase] = useState(JSON.stringify(inicial));
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const sucio = JSON.stringify(otros) !== base;

  async function enviar(method: "PATCH" | "POST", plan?: string) {
    setOcupado(true); setMsg(null);
    try {
      const res = await fetch("/api/plan-medios", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(method === "PATCH" ? { anio, otros } : { anio, plan }) });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setMsg({ ok: false, t: d.error ?? "No se pudo." }); return; }
      if (method === "PATCH") { setBase(JSON.stringify(otros)); setMsg({ ok: true, t: "Plan guardado." }); }
      else setMsg({ ok: true, t: `Metas ${anio} de ${plan} cargadas. Se ajustan en el panel de metas del tablero.` });
      router.refresh();
    } finally { setOcupado(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-sm">
        <div className="flex-1">
          <b>Plan anual {anio}</b>
          {sucio && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">cambios sin guardar</span>}
          {!editor && <div className="text-xs text-amber-800">Solo lectura: lo editan los editores del presupuesto{email ? ` (entraste como ${email}, que no está en la lista)` : ""}.</div>}
        </div>
        {editor && <>
          <button type="button" disabled={!sucio || ocupado} onClick={() => { setOtros(JSON.parse(base) as OtrosConfig); setMsg(null); }} className="rounded-md border px-3 py-1.5 text-xs disabled:opacity-50">Descartar cambios</button>
          <button type="button" disabled={!sucio || ocupado} onClick={() => void enviar("PATCH")} className="rounded-md bg-[#1e40af] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{ocupado ? "Guardando…" : "Guardar"}</button>
        </>}
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.t}</p>}
      <PlanOtros area={area} anio={anio} otros={otros} onChange={setOtros} hist={hist} invPlan={invPlan} ro={!editor}
        puedeMetas={!sucio} ocupado={ocupado} onMetas={(p) => void enviar("POST", p)} metasActuales={metasActuales} />
    </div>
  );
}
