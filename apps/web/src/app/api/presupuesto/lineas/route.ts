import { NextResponse } from "next/server";
import { agregarAlCatalogo, borrarLinea, crearLineas, editarLinea, listCatalogo, listLineas, listVersiones } from "@/lib/presupuesto-server";
import { claveDuplicado, normalizarCuentas, parseFecha, validarLinea, type ItemCatalogo, type LineaIn } from "@/lib/presupuesto-core";
import { conUsuario, puedeVersion } from "../_auth";

// Renglones: POST {lineas, force?} alta (una o varias, ej. pegado desde Excel) · PATCH {id, patch} · DELETE {id}.
// REAL = cualquiera con acceso a /funnel; BGT/4+8/8+4 = editores. Todo queda en el historial.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const MAX = 2000;

function limpiar(l: Partial<LineaIn>): Partial<LineaIn> {
  const t = (v: unknown) => { const s = String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 500); return s || null; };
  return {
    ...(l.version !== undefined && { version: String(l.version).trim() }),
    ...(l.mes !== undefined && { mes: Number(l.mes) }),
    ...(l.ceco !== undefined && { ceco: t(l.ceco) ?? "" }),
    ...(l.cuenta !== undefined && { cuenta: t(l.cuenta) ?? "" }),
    ...(l.nombre_cta !== undefined && { nombre_cta: t(l.nombre_cta) ?? "" }),
    ...(l.concepto !== undefined && { concepto: t(l.concepto) ?? "" }),
    ...(l.nro_proveedor !== undefined && { nro_proveedor: t(l.nro_proveedor) }),
    ...(l.proveedor !== undefined && { proveedor: t(l.proveedor) }),
    ...(l.detalle !== undefined && { detalle: t(l.detalle) }),
    ...(l.solped !== undefined && { solped: t(l.solped) }),
    ...(l.oc !== undefined && { oc: t(l.oc) }),
    ...(l.nro_recepcion !== undefined && { nro_recepcion: t(l.nro_recepcion) }),
    ...(l.nro_doc_contable !== undefined && { nro_doc_contable: t(l.nro_doc_contable) }),
    ...(l.fecha_contabilizacion !== undefined && { fecha_contabilizacion: l.fecha_contabilizacion ? parseFecha(l.fecha_contabilizacion) : null }),
    ...(l.factura !== undefined && { factura: t(l.factura) }),
    ...(l.provision !== undefined && { provision: l.provision === "SI" || l.provision === "NO" ? l.provision : null }),
    ...(l.ars !== undefined && { ars: Number(l.ars) }),
  };
}

export async function POST(req: Request) {
  return conUsuario(async (u) => {
    const b = (await req.json().catch(() => ({}))) as { lineas?: Partial<LineaIn>[]; force?: boolean };
    const entrada = (b.lineas ?? []).slice(0, MAX + 1);
    if (!entrada.length) return NextResponse.json({ error: "No hay renglones para guardar." }, { status: 400 });
    if (entrada.length > MAX) return NextResponse.json({ error: `Máximo ${MAX} renglones por vez.` }, { status: 400 });
    const [versiones, catalogo] = await Promise.all([listVersiones(), listCatalogo()]);
    const permitida = puedeVersion(u);
    let lineas: LineaIn[] = [];
    const errores: { fila: number; error: string }[] = [];
    entrada.forEach((raw, i) => {
      const l = limpiar(raw);
      const e = validarLinea(l, versiones);
      const v = versiones.find((x) => x.nombre === l.version);
      if (e) errores.push({ fila: i + 1, error: e });
      else if (v && !permitida(v)) errores.push({ fila: i + 1, error: `Tu usuario no puede cargar en ${v.nombre}.` });
      else lineas.push({ ceco: "", cuenta: "", nombre_cta: "", concepto: "", nro_proveedor: null, proveedor: null, detalle: null, solped: null, oc: null, nro_recepcion: null, nro_doc_contable: null, fecha_contabilizacion: null, factura: null, provision: null, ...l } as LineaIn);
    });
    if (errores.length) return NextResponse.json({ error: "Hay renglones con errores.", errores }, { status: 400 });
    lineas = normalizarCuentas(lineas, catalogo);

    if (!b.force) {
      const existentes = new Map<string, string>();
      for (const v of new Set(lineas.map((l) => l.version))) for (const l of await listLineas(v)) { const k = claveDuplicado(l); if (k) existentes.set(k, l.detalle ?? l.factura ?? ""); }
      const vistos = new Set<string>();
      const duplicados = lineas.flatMap((l, i) => {
        const k = claveDuplicado(l);
        if (!k) return [];
        const dup = existentes.has(k) || vistos.has(k);
        vistos.add(k);
        return dup ? [{ fila: i + 1, factura: l.factura, proveedor: l.proveedor ?? l.nro_proveedor, ars: l.ars }] : [];
      });
      if (duplicados.length) return NextResponse.json({ error: "Posibles duplicados (misma factura, proveedor y monto).", duplicados }, { status: 409 });
    }
    const creadas = await crearLineas(lineas, u.email);
    // Proveedores nuevos quedan en el catálogo para la próxima carga.
    const nuevos: ItemCatalogo[] = lineas.filter((l) => l.nro_proveedor).map((l) => ({ tipo: "proveedor", clave: l.nro_proveedor!, nombre: l.proveedor ?? "" }));
    await agregarAlCatalogo(nuevos).catch(() => undefined);
    return NextResponse.json({ creadas });
  });
}

export async function PATCH(req: Request) {
  return conUsuario(async (u) => {
    const b = (await req.json().catch(() => ({}))) as { id?: string; patch?: Partial<LineaIn> };
    if (!b.id || !b.patch) return NextResponse.json({ error: "pedido inválido" }, { status: 400 });
    const patch = limpiar(b.patch);
    if (patch.ars !== undefined && (!Number.isFinite(patch.ars) || patch.ars === 0)) return NextResponse.json({ error: "Cargá el monto en pesos." }, { status: 400 });
    if (patch.mes !== undefined && !(patch.mes >= 1 && patch.mes <= 12)) return NextResponse.json({ error: "Mes inválido." }, { status: 400 });
    const linea = await editarLinea(b.id, patch, u.email, puedeVersion(u));
    return NextResponse.json({ linea });
  });
}

export async function DELETE(req: Request) {
  return conUsuario(async (u) => {
    const b = (await req.json().catch(() => ({}))) as { id?: string };
    if (!b.id) return NextResponse.json({ error: "pedido inválido" }, { status: 400 });
    await borrarLinea(b.id, u.email, puedeVersion(u));
    return NextResponse.json({ ok: true });
  });
}
