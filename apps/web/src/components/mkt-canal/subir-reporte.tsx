"use client";
import { useState } from "react";
import { PLATAFORMAS, NUMS, claveFila, type FilaCanal } from "@/lib/mkt-canal-core";

// Subir el reporte de un retailer: la IA lo lee, el usuario revisa/corrige la tabla y recién ahí se guarda
// en mkt_canal_acciones (lo que lee el tablero de abajo).
const btnPri = "rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
const inp = "w-full rounded border bg-background px-1.5 py-1 text-xs";
const COLS: { k: keyof FilaCanal; label: string; w: string }[] = [
  { k: "cliente", label: "Cliente", w: "w-24" }, { k: "accion", label: "Acción", w: "w-32" }, { k: "mes", label: "Mes", w: "w-20" },
  { k: "plataforma", label: "Plataforma", w: "w-24" }, { k: "impresiones", label: "Impresiones", w: "w-24" }, { k: "clics", label: "Clics", w: "w-20" },
  { k: "conversiones", label: "Conv.", w: "w-16" }, { k: "ingresos", label: "Ingresos $", w: "w-24" }, { k: "entregados", label: "Mails entreg.", w: "w-20" },
  { k: "aperturas", label: "Aperturas", w: "w-20" }, { k: "inversion", label: "Inversión $", w: "w-24" },
];
const fmt = (v: unknown) => (typeof v === "number" ? v.toLocaleString("es-AR") : v == null ? "—" : String(v));

export function SubirReporte() {
  const [abierto, setAbierto] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cliente, setCliente] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [filas, setFilas] = useState<FilaCanal[] | null>(null);
  const [antes, setAntes] = useState<Record<string, FilaCanal>>({});
  const [notas, setNotas] = useState("");
  const [errores, setErrores] = useState<string[]>([]);

  async function leer() {
    if (!archivo) return;
    setOcupado(true); setMsg(null); setFilas(null); setErrores([]);
    try {
      const fd = new FormData();
      fd.append("archivo", archivo);
      if (cliente.trim()) fd.append("cliente", cliente.trim());
      const r = await fetch("/api/mkt-canal", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "No se pudo leer el archivo.");
      setFilas(d.filas); setAntes(d.antes ?? {}); setNotas(d.notas ?? ""); setErrores(d.errores ?? []);
      if (!d.filas.length) setMsg({ ok: false, t: "La IA no encontró datos para cargar en este archivo." });
    } catch (e) { setMsg({ ok: false, t: e instanceof Error ? e.message : "Error" }); }
    finally { setOcupado(false); }
  }

  async function guardar() {
    if (!filas?.length) return;
    setOcupado(true); setMsg(null);
    try {
      const r = await fetch("/api/mkt-canal", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filas }) });
      const d = await r.json();
      if (!r.ok) { setErrores(d.errores ?? []); throw new Error(d.error ?? "No se pudo guardar."); }
      setMsg({ ok: true, t: `Listo: ${d.nuevas} filas nuevas y ${d.actualizadas} actualizadas. El tablero ya las muestra.` });
      setFilas(null); setArchivo(null);
      document.querySelector<HTMLIFrameElement>('iframe[title="Mkt Canal Dashboard"]')?.contentWindow?.location.reload();
    } catch (e) { setMsg({ ok: false, t: e instanceof Error ? e.message : "Error" }); }
    finally { setOcupado(false); }
  }

  const set = (i: number, k: keyof FilaCanal, v: string) =>
    setFilas((fs) => fs!.map((f, j) => (j !== i ? f : { ...f, [k]: (NUMS as readonly string[]).includes(k) ? (v === "" ? null : Number(v)) : v })));

  return (
    <details className="rounded-xl border bg-card p-3" open={abierto} onToggle={(e) => setAbierto((e.target as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-sm font-medium">Subir el reporte de un retailer</summary>
      <div className="mt-3 space-y-3 text-xs">
        <p className="text-muted-foreground">
          Subí el PDF, la captura o el Excel que te mandó el retailer. La IA lo lee y te muestra lo que entendió; revisá los números,
          corregí lo que haga falta y tocá <strong>Guardar</strong>. Si una acción ya estaba cargada, se actualiza (no se duplica) y lo que el
          reporte no trae, como la inversión, queda como estaba.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv" onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); setFilas(null); setMsg(null); }} />
          <input className="w-40 rounded border bg-background px-2 py-1" placeholder="Retailer (opcional)" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          <button type="button" className={btnPri} disabled={!archivo || ocupado} onClick={leer}>{ocupado && !filas ? "Leyendo… (hasta 1 min)" : "Leer archivo"}</button>
        </div>
        {msg && <p className={msg.ok ? "text-green-700" : "text-red-600"}>{msg.t}</p>}
        {errores.length > 0 && <ul className="list-disc pl-5 text-amber-700">{errores.map((e) => <li key={e}>{e}</li>)}</ul>}
        {notas && <p className="rounded bg-muted p-2"><strong>Nota de la IA:</strong> {notas}</p>}
        {filas && filas.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead><tr>{COLS.map((c) => <th key={c.k} className="px-1 py-1 text-left font-medium text-muted-foreground">{c.label}</th>)}<th /></tr></thead>
                <tbody>
                  {filas.map((f, i) => {
                    const a = antes[claveFila(f)];
                    return (
                      <tr key={i} className="align-top">
                        {COLS.map((c) => (
                          <td key={c.k} className={`px-1 py-0.5 ${c.w}`}>
                            {c.k === "plataforma" ? (
                              <select className={inp} value={f.plataforma} onChange={(e) => set(i, "plataforma", e.target.value)}>{PLATAFORMAS.map((p) => <option key={p}>{p}</option>)}</select>
                            ) : (
                              <input className={inp} type={(NUMS as readonly string[]).includes(c.k) ? "number" : "text"} value={(f[c.k] as string | number | null) ?? ""} onChange={(e) => set(i, c.k, e.target.value)} />
                            )}
                            {a && a[c.k] !== f[c.k] && (NUMS as readonly string[]).includes(c.k) && <div className="text-[10px] text-muted-foreground">antes: {fmt(a[c.k])}</div>}
                          </td>
                        ))}
                        <td className="px-1"><button type="button" className="text-red-600 hover:underline" onClick={() => setFilas((fs) => fs!.filter((_, j) => j !== i))}>Quitar</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground">{filas.filter((f) => antes[claveFila(f)]).length} de {filas.length} filas ya existían y se van a actualizar.</p>
            <button type="button" className={btnPri} disabled={ocupado} onClick={guardar}>{ocupado ? "Guardando…" : `Guardar ${filas.length} filas`}</button>
          </>
        )}
      </div>
    </details>
  );
}
