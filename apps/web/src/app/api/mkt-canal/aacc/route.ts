import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { isPathAllowed } from "@/lib/dashboard-access";
import { getAllowedPaths, puedeEditarActual } from "@/lib/usuarios-server";
import { usuarioPresupuesto } from "@/lib/presupuesto-server";
import { armarEmail, armarEml, CATEGORIAS_AACC, MESES_AACC, parseEmails, type Acuerdo } from "@/lib/aacc-core";
import {
  AaccError, calcularMes, getAaccDatos, guardarAcuerdos, guardarDestinatarios, guardarMensual, guardarReal,
} from "@/lib/aacc-server";

// AACC de Mkt Canal.
//   GET  ?anio=                         → datos de la pestaña (acuerdos, resumen por mes, provisiones, liquidado, destinatarios)
//   GET  ?anio=&mes=&eml=1              → borrador .eml de la última provisión mensual guardada (Outlook lo abre listo para enviar)
//   POST {accion:"calcular", anio, mes} → provisión del mes con la facturación a hoy (no guarda)
//   POST {accion:"generar", anio, mes}  → calcula, GUARDA la foto mensual y devuelve el mail
//   POST {accion:"real", anio, mes}     → calcula con el mes cerrado y guarda la provisión real (mkt_canal_aacc)
//   POST {accion:"acuerdos"|"destinatarios", …}   (lo liquidado sale de Inversión de Marketing, no se carga acá)
// Ver: sesión + acceso a /mkt-canal. Escribir: «Edita Marketing» o editor del presupuesto (bgt_editores).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

async function sesion() {
  const { data: { user } } = await getServerSupabase().auth.getUser();
  if (!user?.email) return { error: NextResponse.json({ error: "no autenticado" }, { status: 401 }) };
  if (!isPathAllowed("/mkt-canal", await getAllowedPaths())) return { error: NextResponse.json({ error: "Sin acceso a Mkt Canal." }, { status: 403 }) };
  return { email: user.email.toLowerCase() };
}
async function puedeEditar() {
  const u = await usuarioPresupuesto().catch(() => null);
  return !!u?.editor || (await puedeEditarActual("marketing"));
}
const errorResp = (e: unknown) =>
  NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: e instanceof AaccError ? e.status : 500 });
const anioOk = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n >= 2024 && n <= 2100 ? n : null; };
const mesOk = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 11 ? n : null; };

export async function GET(req: Request) {
  const s = await sesion();
  if ("error" in s) return s.error;
  const sp = new URL(req.url).searchParams;
  const anio = anioOk(sp.get("anio") ?? new Date().getFullYear());
  if (anio == null) return NextResponse.json({ error: "Año inválido." }, { status: 400 });
  try {
    const datos = await getAaccDatos(anio);
    if (sp.get("eml") === "1") {
      const mes = mesOk(sp.get("mes"));
      if (mes == null) return NextResponse.json({ error: "Mes inválido." }, { status: 400 });
      const key = `${anio}-${String(mes + 1).padStart(2, "0")}`;
      const filas = datos.mensual.filter((m) => m.mes === key).map((m) => ({ cliente: m.cliente, razon_social: m.razon_social, acuerdo: m.acuerdo ?? "", categorias: m.categorias ?? "", facturacion: m.facturacion == null ? null : Number(m.facturacion), aacc: m.aacc, aviso: null }));
      if (!filas.length) return NextResponse.json({ error: "Todavía no se generó la provisión de ese mes." }, { status: 404 });
      const email = armarEmail({ anio, mes, filas, resumen: datos.resumen });
      const eml = armarEml({ para: datos.destinatarios.para, cc: datos.destinatarios.cc, email });
      return new NextResponse(eml, { headers: { "Content-Type": "message/rfc822", "Content-Disposition": `attachment; filename="Provision AACC ${MESES_AACC[mes]} ${anio}.eml"` } });
    }
    return NextResponse.json({ ...datos, editor: await puedeEditar() });
  } catch (e) { return errorResp(e); }
}

function limpiarAcuerdo(a: Partial<Acuerdo>): Acuerdo | string {
  const cliente = String(a.cliente ?? "").trim().slice(0, 80);
  if (!cliente) return "Hay un acuerdo sin nombre de cliente.";
  const tipo = a.tipo === "pct" ? "pct" : "fijo";
  const pct = tipo === "pct" ? Number(a.pct) : null;
  if (tipo === "pct" && !(pct! > 0 && pct! <= 100)) return `${cliente}: el % tiene que estar entre 0 y 100.`;
  const montos = Array.from({ length: 12 }, (_, i) => Math.max(0, Math.round(Number(a.montos?.[i] ?? 0) || 0)));
  return {
    anio: 0, cliente, orden: 0, tipo, pct,
    razon_social: String(a.razon_social ?? "").trim().slice(0, 120) || cliente,
    cliente_sap: tipo === "pct" ? String(a.cliente_sap ?? "").trim().slice(0, 120) || null : null,
    proveedor: String(a.proveedor ?? "").trim().slice(0, 120) || null,
    categorias: (a.categorias ?? []).filter((c): c is Acuerdo["categorias"][number] => (CATEGORIAS_AACC as readonly string[]).includes(c)),
    montos: tipo === "fijo" ? montos : Array(12).fill(0),
  };
}

export async function POST(req: Request) {
  const s = await sesion();
  if ("error" in s) return s.error;
  if (!(await puedeEditar())) return NextResponse.json({ error: "No tenés permiso para editar esto. Pedíselo al administrador." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const anio = anioOk(b.anio), mes = mesOk(b.mes);
  if (anio == null) return NextResponse.json({ error: "Año inválido." }, { status: 400 });
  try {
    switch (b.accion) {
      case "calcular":
      case "generar":
      case "real": {
        if (mes == null) return NextResponse.json({ error: "Mes inválido." }, { status: 400 });
        const { filas, sinImporte } = await calcularMes(anio, mes);
        if (b.accion === "calcular") return NextResponse.json({ filas, sinImporte });
        if (filas.some((f) => f.aviso && f.facturacion == null)) return NextResponse.json({ error: "Hay acuerdos por % sin facturación en $: no se guardó nada.", filas, sinImporte }, { status: 409 });
        if (b.accion === "real") {
          const ahora = new Date();
          if (anio > ahora.getFullYear() || (anio === ahora.getFullYear() && mes >= ahora.getMonth())) return NextResponse.json({ error: "La provisión real es de un mes ya cerrado." }, { status: 400 });
          await guardarReal(anio, mes, filas);
          return NextResponse.json({ ok: true, filas });
        }
        await guardarMensual(anio, mes, filas, s.email);
        const datos = await getAaccDatos(anio);
        return NextResponse.json({ ok: true, filas, email: armarEmail({ anio, mes, filas, resumen: datos.resumen }), destinatarios: datos.destinatarios });
      }
      case "acuerdos": {
        const lista = Array.isArray(b.acuerdos) ? (b.acuerdos as Partial<Acuerdo>[]).slice(0, 100) : [];
        const limpios: Acuerdo[] = [];
        for (const a of lista) { const r = limpiarAcuerdo(a); if (typeof r === "string") return NextResponse.json({ error: r }, { status: 400 }); limpios.push(r); }
        if (new Set(limpios.map((a) => a.cliente)).size !== limpios.length) return NextResponse.json({ error: "Hay dos acuerdos con el mismo cliente." }, { status: 400 });
        await guardarAcuerdos(anio, limpios, s.email);
        return NextResponse.json({ ok: true });
      }
      case "destinatarios": {
        const d = b.destinatarios as { para?: string; cc?: string } | undefined;
        const para = parseEmails(String(d?.para ?? "")), cc = parseEmails(String(d?.cc ?? ""));
        const fuera = [...para, ...cc].filter((e) => !e.endsWith("@mabe.com.ar"));
        if (fuera.length) return NextResponse.json({ error: `Solo direcciones @mabe.com.ar (${fuera.join(", ")}).` }, { status: 400 });
        await guardarDestinatarios({ para, cc });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "acción desconocida" }, { status: 400 });
    }
  } catch (e) { return errorResp(e); }
}
