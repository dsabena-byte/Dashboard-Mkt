"use client";
import { useCallback, useEffect, useState } from "react";
import { GRUPOS, estadoDe, type EstadoUsuario, type FilaImport, type Grupo, type UsuarioRow } from "@/lib/usuarios-core";

// Pantalla /usuarios: lista, alta/edición, invitación, reseteo de clave, desactivar e importar CSV. Todo por /api/usuarios.

const inputCls = "w-full rounded-md border bg-card px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
const selectCls = "rounded-lg border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
const btnPri = "rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
const btn = "rounded border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50";
const ESTADO: Record<EstadoUsuario, { label: string; cls: string }> = {
  activo: { label: "Activo", cls: "bg-emerald-50 text-emerald-800" },
  invitado: { label: "Invitado, sin entrar", cls: "bg-amber-50 text-amber-800" },
  desactivado: { label: "Desactivado", cls: "bg-slate-100 text-slate-600" },
};
const labelGrupo = (g: string) => GRUPOS.find((x) => x.id === g)?.label ?? g;
const fecha = (s: string | null) => (s ? new Date(s).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");

async function api<T>(body?: unknown): Promise<{ ok: boolean; data: T & { error?: string } }> {
  try {
    const res = await fetch("/api/usuarios", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok && !data.error) data.error = `El servidor respondió ${res.status}.`;
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "No hay conexión con el servidor. Recargá la página." } as T & { error?: string } };
  }
}

interface Form { email: string; nombre: string; grupos: Grupo[]; es_editor: boolean; es_admin: boolean; vendedor: string; gerencia: string; nuevo: boolean }
const VACIO: Form = { email: "", nombre: "", grupos: [], es_editor: false, es_admin: false, vendedor: "", gerencia: "", nuevo: true };

export function UsuariosAdmin({ yo }: { yo: string }) {
  const [usuarios, setUsuarios] = useState<UsuarioRow[] | null>(null);
  const [legacy, setLegacy] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; txt: string } | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [fGrupo, setFGrupo] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [importar, setImportar] = useState(false);

  const cargar = useCallback(async () => {
    const r = await api<{ legacy: boolean; usuarios: UsuarioRow[] }>();
    if (!r.ok) { setAviso({ ok: false, txt: r.data.error ?? "No se pudo cargar." }); return; }
    setLegacy(r.data.legacy);
    setUsuarios(r.data.usuarios);
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const accion = async (body: Record<string, unknown>, okTxt: string) => {
    setOcupado(true);
    const r = await api<{ ok: boolean }>(body);
    setOcupado(false);
    setAviso(r.ok ? { ok: true, txt: okTxt } : { ok: false, txt: r.data.error ?? "No se pudo." });
    if (r.ok) await cargar();
    return r.ok;
  };

  if (legacy) {
    return <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Todavía no está creada la tabla de usuarios: hay que correr la migración <b>0136_usuarios.sql</b> en el SQL Editor de Supabase. Mientras tanto entran los emails @mabe.com.ar y las cuentas que ya existían, y todos ven todos los tableros.</div>;
  }
  if (!usuarios) return <div className="text-sm text-muted-foreground">{aviso?.txt ?? "Cargando…"}</div>;

  const lista = usuarios.filter((u) => (!fGrupo || (fGrupo === "sin" ? u.grupos.length === 0 : u.grupos.includes(fGrupo))) && (!fEstado || estadoDe(u) === fEstado));

  return (
    <div className="space-y-4">
      {aviso && <div className={`rounded-lg border p-3 text-sm ${aviso.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{aviso.txt}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnPri} onClick={() => { setForm({ ...VACIO }); setImportar(false); }}>Agregar usuario</button>
        <button type="button" className={btn} onClick={() => { setImportar(!importar); setForm(null); }}>Importar usuarios</button>
        <span className="ml-auto text-xs text-muted-foreground">Filtrar:</span>
        <select className={selectCls} value={fGrupo} onChange={(e) => setFGrupo(e.target.value)} aria-label="Filtrar por grupo">
          <option value="">Todos los grupos</option>
          {GRUPOS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          <option value="sin">Sin grupo</option>
        </select>
        <select className={selectCls} value={fEstado} onChange={(e) => setFEstado(e.target.value)} aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          {(Object.keys(ESTADO) as EstadoUsuario[]).map((k) => <option key={k} value={k}>{ESTADO[k].label}</option>)}
        </select>
      </div>

      {form && <Editor form={form} setForm={setForm} yo={yo} ocupado={ocupado} onGuardar={async (f) => {
        const ok = await accion({ accion: "guardar", ...f }, f.nuevo ? `Listo, ${f.email} quedó agregado. Para que entre, tocá «Enviar invitación».` : "Cambios guardados.");
        if (ok) setForm(null);
      }} />}

      {importar && <Importar onListo={async (n) => { setImportar(false); setAviso({ ok: true, txt: `Se importaron ${n} usuarios. No se mandó ninguna invitación: asignales el grupo y mandala desde la lista.` }); await cargar(); }} />}

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="px-3 py-2">Nombre</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Grupos</th><th className="px-3 py-2">Permisos</th><th className="px-3 py-2">Vendedor / gerencia</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Último acceso</th><th className="px-3 py-2">Acciones</th></tr>
          </thead>
          <tbody>
            {lista.map((u) => {
              const est = estadoDe(u);
              return (
                <tr key={u.email} className="border-t align-top">
                  <td className="px-3 py-2">{u.nombre ?? "—"}</td>
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2">{u.grupos.length ? u.grupos.map((g) => <span key={g} className="mr-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-900">{labelGrupo(g)}</span>) : <span className="text-xs text-muted-foreground">Sin grupo</span>}</td>
                  <td className="px-3 py-2 text-xs">{[u.es_admin && "Admin", u.es_editor && "Editor"].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-2 text-xs">{[u.vendedor, u.gerencia].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${ESTADO[est].cls}`}>{ESTADO[est].label}</span></td>
                  <td className="px-3 py-2 text-xs">{fecha(u.ultimo_acceso)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" title="Editar" aria-label={`Editar ${u.email}`} className="px-1 text-base text-primary hover:opacity-70" onClick={() => { setForm({ email: u.email, nombre: u.nombre ?? "", grupos: u.grupos as Grupo[], es_editor: u.es_editor, es_admin: u.es_admin, vendedor: u.vendedor ?? "", gerencia: u.gerencia ?? "", nuevo: false }); setImportar(false); }}>✎</button>
                      {u.activo && <button type="button" className={btn} disabled={ocupado} onClick={() => void accion({ accion: est === "invitado" ? "invitar" : "resetear", email: u.email }, `Le mandamos el mail a ${u.email}.`)}>{est === "invitado" ? "Enviar invitación" : "Resetear clave"}</button>}
                      {u.email !== yo && <button type="button" className={btn} disabled={ocupado} onClick={() => { if (u.activo && !confirm(`¿Desactivar a ${u.email}? No va a poder entrar más hasta que lo reactives.`)) return; void accion({ accion: "activo", email: u.email, activo: !u.activo }, u.activo ? "Usuario desactivado." : "Usuario reactivado."); }}>{u.activo ? "Desactivar" : "Reactivar"}</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!lista.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">No hay usuarios con ese filtro.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">Cada cambio queda registrado (quién, cuándo, antes y después). Las invitaciones nunca salen solas: se mandan desde acá.</p>
    </div>
  );
}

function Editor({ form, setForm, yo, ocupado, onGuardar }: { form: Form; setForm: (f: Form | null) => void; yo: string; ocupado: boolean; onGuardar: (f: Form) => void }) {
  const set = (p: Partial<Form>) => setForm({ ...form, ...p });
  const toggle = (g: Grupo) => set({ grupos: form.grupos.includes(g) ? form.grupos.filter((x) => x !== g) : [...form.grupos, g] });
  const ventas = form.grupos.includes("ventas");
  return (
    <form className="space-y-3 rounded-xl border bg-card p-4 shadow-sm" onSubmit={(e) => { e.preventDefault(); onGuardar(form); }}>
      <div className="text-sm font-semibold">{form.nuevo ? "Agregar usuario" : `Editar ${form.email}`}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">Email<input className={inputCls} type="email" required disabled={!form.nuevo} value={form.email} onChange={(e) => set({ email: e.target.value.trim().toLowerCase() })} /></label>
        <label className="text-xs">Nombre<input className={inputCls} value={form.nombre} onChange={(e) => set({ nombre: e.target.value })} /></label>
      </div>
      <div className="text-xs">
        Grupos
        <div className="mt-1 flex flex-wrap gap-3">
          {GRUPOS.map((g) => <label key={g.id} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={form.grupos.includes(g.id)} onChange={() => toggle(g.id)} />{g.label}</label>)}
        </div>
      </div>
      {ventas && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs">Vendedor (ve solo sus clientes)<input className={inputCls} value={form.vendedor} onChange={(e) => set({ vendedor: e.target.value })} /></label>
          <label className="text-xs">Gerencia<input className={inputCls} value={form.gerencia} onChange={(e) => set({ gerencia: e.target.value })} /></label>
        </div>
      )}
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1"><input type="checkbox" checked={form.es_editor} onChange={(e) => set({ es_editor: e.target.checked })} />Editor (puede cambiar los maestros de Trade y Ventas)</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={form.es_admin} disabled={form.email === yo} onChange={(e) => set({ es_admin: e.target.checked })} />Administrador (maneja esta pantalla)</label>
      </div>
      {!form.grupos.length && !form.es_admin && <p className="text-xs text-amber-800">Sin grupo no ve ningún tablero.</p>}
      <div className="flex gap-2">
        <button type="submit" className={btnPri} disabled={ocupado}>Guardar</button>
        <button type="button" className={btn} onClick={() => setForm(null)}>Cancelar</button>
      </div>
    </form>
  );
}

function Importar({ onListo }: { onListo: (n: number) => void }) {
  const [csv, setCsv] = useState("");
  const [prev, setPrev] = useState<{ nuevos: FilaImport[]; existentes: string[]; errores: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const enviar = async (confirmar: boolean) => {
    setOcupado(true);
    const r = await api<{ nuevos: FilaImport[]; existentes: string[]; errores: string[]; importados: number }>({ accion: "importar", csv, confirmar });
    setOcupado(false);
    if (!r.ok) { setError(r.data.error ?? "No se pudo."); return; }
    setError(null);
    if (confirmar) onListo(r.data.importados); else setPrev(r.data);
  };
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-sm font-semibold">Importar usuarios</div>
      <p className="text-xs text-muted-foreground">Pegá o subí un CSV con las columnas <b>email;nombre;rol;vendedor</b> (el formato del usuarios.csv viejo). Rol VENDEDOR entra al grupo Ventas con su vendedor; el resto queda sin grupo para que lo asignes. Los que ya están no se tocan y no se manda ninguna invitación.</p>
      <input type="file" accept=".csv,text/csv,text/plain" className="text-xs" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setCsv(await f.text()); setPrev(null); } }} />
      <textarea className={`${inputCls} h-32 font-mono text-xs`} value={csv} onChange={(e) => { setCsv(e.target.value); setPrev(null); }} placeholder="email;nombre;rol;vendedor" />
      {error && <p className="text-xs text-amber-800">{error}</p>}
      {prev && (
        <div className="space-y-1 text-xs">
          <p><b>{prev.nuevos.length}</b> nuevos · {prev.existentes.length} ya estaban (no se tocan){prev.errores.length ? ` · ${prev.errores.length} filas con error` : ""}.</p>
          {prev.errores.slice(0, 10).map((x) => <p key={x} className="text-amber-800">{x}</p>)}
          <ul className="max-h-40 overflow-y-auto">{prev.nuevos.slice(0, 200).map((f) => <li key={f.email}>{f.email} · {f.nombre ?? "sin nombre"} · {f.grupos.length ? `Ventas (${f.vendedor ?? "sin vendedor"})` : "sin grupo"}</li>)}</ul>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" className={btn} disabled={ocupado || !csv.trim()} onClick={() => void enviar(false)}>Ver vista previa</button>
        <button type="button" className={btnPri} disabled={ocupado || !prev?.nuevos.length} onClick={() => void enviar(true)}>Importar {prev?.nuevos.length ?? 0}</button>
      </div>
    </div>
  );
}
