"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { COND_LABEL, MAX_UMBRALES, UMBRAL_METRICAS, describirUmbral, type Umbral, type UmbralCond } from "@/lib/umbrales";
import { LearnButton } from "@/components/knowledge/learn-button";

// Umbrales propios de alertas (portado de BIP, sep-2026): "avisame si el CPM supera $X o las sesiones caen
// 20%". Se evalúan todos los días sobre el último mes CERRADO (series de Mis tableros) y, si se cumplen, entran
// a "Qué te avisaríamos hoy" y a los emails como prioridad alta. Guarda en /api/alertas/umbrales.
const REAL = "#1e40af";
const LBL = "mb-1 block text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground";
const CONDS: UmbralCond[] = ["mayor", "menor", "cae_pct", "sube_pct"];
const SRC_LBL: Record<string, string> = { pauta: "Plan de Medios", web: "Web", redes: "Redes (Instagram)" };

export function UmbralesForm({ initial, migrated }: { initial: Umbral[]; migrated: boolean }) {
  const router = useRouter();
  const [list, setList] = useState<Umbral[]>(initial);
  const [metrica, setMetrica] = useState(UMBRAL_METRICAS[0]!.id);
  const [cond, setCond] = useState<UmbralCond>("mayor");
  const [valor, setValor] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const pct = cond === "cae_pct" || cond === "sube_pct";
  const unidad = UMBRAL_METRICAS.find((m) => m.id === metrica)?.unidad ?? "";

  async function save(next: Umbral[]) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/alertas/umbrales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ umbrales: next }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "No se pudo guardar");
      setList(d.umbrales ?? next);
      setMsg({ ok: true, text: "Listo, guardado." });
      router.refresh();
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Error" }); } finally { setBusy(false); }
  }
  function add(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(valor.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(v) || v < 0) { setMsg({ ok: false, text: "Poné un número válido." }); return; }
    if (pct && (v < 1 || v > 100)) { setMsg({ ok: false, text: "La variación va de 1% a 100%." }); return; }
    void save([...list, { id: `u${Date.now().toString(36)}`, metrica, cond, valor: v }]);
    setValor("");
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">Tus umbrales <LearnButton k="umbrales" /></h3>
        <p className="text-xs text-muted-foreground">Avisos propios sobre el último mes cerrado (ej. “avisame si el CPM supera $ 3.000” o “si las sesiones caen más de 20% vs el mes anterior”). Usan las mismas series que Mis tableros y llegan como prioridad alta.</p>
      </div>
      {!migrated && (
        <p className="rounded-md border px-3 py-2 text-xs" style={{ borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" }}>
          Los umbrales todavía no se pueden guardar: falta correr la migración <code>0119_anotaciones_umbrales.sql</code> en el SQL Editor de Supabase.
        </p>
      )}
      {list.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {list.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>{describirUmbral(u)}</span>
              <button type="button" className="text-xs font-medium text-red-700 hover:underline disabled:opacity-50" disabled={busy} onClick={() => void save(list.filter((x) => x.id !== u.id))}>Quitar</button>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-muted-foreground">Todavía no definiste umbrales.</p>}
      {migrated && list.length < MAX_UMBRALES && (
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <div>
            <span className={LBL}>Métrica</span>
            <select className="rounded-md border bg-white px-2 py-1.5 text-sm" value={metrica} onChange={(e) => setMetrica(e.target.value)}>
              {["pauta", "web", "redes"].map((f) => (
                <optgroup key={f} label={SRC_LBL[f]}>
                  {UMBRAL_METRICAS.filter((m) => m.fuente === f).map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <span className={LBL}>Condición</span>
            <select className="rounded-md border bg-white px-2 py-1.5 text-sm" value={cond} onChange={(e) => setCond(e.target.value as UmbralCond)}>
              {CONDS.map((c) => <option key={c} value={c}>{COND_LABEL[c]}{c === "cae_pct" || c === "sube_pct" ? " (% vs mes anterior)" : ""}</option>)}
            </select>
          </div>
          <div>
            <span className={LBL}>Valor {pct ? "(%)" : unidad ? `(${unidad})` : ""}</span>
            <input className="w-32 rounded-md border bg-white px-2 py-1.5 text-sm" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={pct ? "20" : "3000"} required />
          </div>
          <button type="submit" disabled={busy || !valor.trim()} className="rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: REAL }}>{busy ? "Guardando…" : "Agregar umbral"}</button>
        </form>
      )}
      {msg && <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}
