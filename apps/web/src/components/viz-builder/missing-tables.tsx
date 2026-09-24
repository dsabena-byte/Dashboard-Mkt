// Aviso cuando faltan las tablas de Mis tableros (migración 0109 sin correr) o hubo un error de lectura.
export function TablerosNotice({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error ?? "Error");
  const missing = /0109_tableros/.test(msg);
  return (
    <div className="card" style={{ borderColor: missing ? "#fde68a" : "#fecaca", background: missing ? "#fffbeb" : "#fef2f2" }}>
      <b>{missing ? "Mis tableros todavía no está habilitado en la base" : "No se pudo leer Mis tableros"}</b>
      <p className="hint" style={{ margin: "6px 0 0" }}>
        {missing
          ? <>Falta correr la migración <code>supabase/migrations/0109_tableros.sql</code> en el SQL Editor de Supabase (proyecto principal <code>dashboard-mkt</code>). Crea las tablas <code>tableros_datasets</code> y <code>tableros</code>. El resto del dashboard no se ve afectado.</>
          : msg}
      </p>
    </div>
  );
}
