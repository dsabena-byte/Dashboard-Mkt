import { NextResponse } from "next/server";
import { decodeCsv, parseCsv, normalizeHeader } from "@/lib/cb-ventas/core";
import { overridesBlobViejo, PATRON_USUARIOS, ultimoCsvDrive } from "@/lib/cb-ventas/fuentes-viejas";
import { svc } from "@/lib/cb-ventas/server";
import { emailValido } from "@/lib/usuarios-core";

// Crea en Supabase Auth de Drean a los usuarios de la app vieja (/ventas) que todavía no tienen cuenta, con el
// MISMO email y la MISMA clave que usan hoy. Cómo validaba la app vieja (cuadros-basicos/lib/users.ts):
//   1) hash bcrypt del blob de claves cambiadas (CBV_OLD_BLOB_TOKEN) → 2) columna password_hash de usuarios.csv (bcrypt)
//   → 3) clave inicial compartida INITIAL_PASSWORD (texto plano en el env de la app vieja → CBV_INITIAL_PASSWORD acá).
// Los bcrypt se pasan como password_hash (Supabase los acepta sin conocer la clave); la inicial se pasa como password.
// Nunca se imprime ni se devuelve una clave ni un hash. Quien ya tiene cuenta NO se toca (ni su clave).
// Fila en `usuarios`: si falta, se crea con grupo ventas (+ vendedor si su rol era "vendedor"); si existe, no se cambia.
// `?dry=1` = solo cuenta. Sin CBV_OLD_BLOB_TOKEN no escribe salvo `?sin_overrides=1` (quien cambió su clave tendría la vieja).
// Auth: Authorization: Bearer CRON_SECRET.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const BCRYPT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = new URL(request.url).searchParams;
  const dry = sp.get("dry") === "1";
  try {
    const f = await ultimoCsvDrive(PATRON_USUARIOS);
    if (!f) return NextResponse.json({ ok: false, error: "No encontré usuarios.csv en Drive." }, { status: 500 });
    const { headers, rows } = parseCsv(decodeCsv(f.bytes));
    const col = (...c: string[]) => headers.findIndex((h) => c.includes(normalizeHeader(h)));
    const iEmail = col("email", "mail"), iNombre = col("nombre", "nombre y apellido", "name"), iRol = col("rol", "role");
    const iVend = col("vendedor"), iHash = col("password_hash", "password hash", "hash");
    const usuarios = rows
      .map((r) => ({
        email: (r[iEmail] ?? "").trim().toLowerCase(),
        nombre: (r[iNombre] ?? "").trim() || null,
        vendedorRol: (r[iRol] ?? "").trim().toLowerCase() === "vendedor",
        vendedor: (r[iVend] ?? "").trim() || null,
        hash: iHash >= 0 ? (r[iHash] ?? "").trim() : "",
      }))
      .filter((u) => emailValido(u.email));

    let overrides: Record<string, { hash: string }> | null;
    try { overrides = await overridesBlobViejo(); } catch (e) {
      return NextResponse.json({ ok: false, error: `No pude leer las claves cambiadas de la app vieja (${e instanceof Error ? e.message : e}). No se creó nada.` }, { status: 500 });
    }
    const inicial = process.env.CBV_INITIAL_PASSWORD ?? "";

    const s = svc();
    const existentes = new Set<string>();
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await s.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);
      data.users.forEach((u) => u.email && existentes.add(u.email.toLowerCase()));
      if (data.users.length < 1000) break;
    }
    const { data: filas, error: eU } = await s.from("usuarios").select("email");
    if (eU) throw new Error(`usuarios: ${eU.message}`);
    const conFila = new Set((filas as { email: string }[]).map((x) => x.email));

    const plan = usuarios.map((u) => {
      const ov = overrides?.[u.email]?.hash;
      const cred = ov && BCRYPT.test(ov) ? { password_hash: ov, origen: "clave_cambiada" }
        : u.hash && BCRYPT.test(u.hash) ? { password_hash: u.hash, origen: "hash_csv" }
        : inicial.length >= 6 ? { password: inicial, origen: "clave_inicial" }
        : null;
      return { u, cred, yaTieneCuenta: existentes.has(u.email), tieneFila: conFila.has(u.email) };
    });
    const cuenta = (fn: (p: (typeof plan)[number]) => boolean) => plan.filter(fn).length;
    const resumen = {
      enCsv: usuarios.length,
      yaConCuenta: cuenta((p) => p.yaTieneCuenta),
      aCrear: cuenta((p) => !p.yaTieneCuenta && !!p.cred),
      sinClaveRecuperable: cuenta((p) => !p.yaTieneCuenta && !p.cred),
      porOrigen: { clave_cambiada: cuenta((p) => !p.yaTieneCuenta && p.cred?.origen === "clave_cambiada"), hash_csv: cuenta((p) => !p.yaTieneCuenta && p.cred?.origen === "hash_csv"), clave_inicial: cuenta((p) => !p.yaTieneCuenta && p.cred?.origen === "clave_inicial") },
      filasUsuariosACrear: cuenta((p) => !p.tieneFila),
      leyoClavesCambiadas: overrides !== null,
    };
    if (dry) return NextResponse.json({ ok: true, dry: true, ...resumen });
    if (overrides === null && sp.get("sin_overrides") !== "1") {
      return NextResponse.json({ ok: false, error: "Falta CBV_OLD_BLOB_TOKEN (claves que la gente cambió en la app vieja). Cargalo o confirmá con ?sin_overrides=1.", ...resumen }, { status: 409 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    let creadas = 0, filasCreadas = 0;
    const fallas: string[] = []; // sin emails: la respuesta puede quedar en logs públicos de Actions
    for (const p of plan) {
      if (!p.yaTieneCuenta && p.cred) {
        const { origen: _o, ...cred } = p.cred;
        const r = await fetch(`${url}/auth/v1/admin/users`, {
          method: "POST",
          headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
          body: JSON.stringify({ email: p.u.email, email_confirm: true, ...cred, user_metadata: { origen: "cb-ventas" } }),
        });
        if (r.ok) creadas++;
        else fallas.push(`alta en Auth: HTTP ${r.status}`);
      }
      if (!p.tieneFila) {
        const { error } = await s.from("usuarios").insert({
          email: p.u.email, nombre: p.u.nombre, grupos: ["ventas"], vendedor: p.u.vendedorRol ? p.u.vendedor : null,
          activo: true, creado_por: "migracion cb-ventas",
        });
        if (error) fallas.push(`usuarios: ${error.message}`);
        else filasCreadas++;
      }
    }
    await s.from("usuarios_auditoria").insert({ actor_email: "migracion cb-ventas", email: null, accion: "importar_cuentas_cb_ventas", antes: null, despues: { ...resumen, creadas, filasCreadas, fallas: fallas.length } });
    return NextResponse.json({ ok: fallas.length === 0, ...resumen, creadas, filasCreadas, fallas });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cb-ventas-cuentas]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
