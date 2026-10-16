import { NextResponse } from "next/server";
import { guardarTcs, importarPlanilla, resumenVersion } from "@/lib/presupuesto-server";
import { armarCatalogo, normalizarCuentas, parsePlanilla, parsePresupuesto, parseTcPlantilla, tipoDeVersion, totalesPorVersion } from "@/lib/presupuesto-core";
import { conUsuario, soloEditor } from "../_auth";

// Importación (solo editores), en dos pasos: sin `confirmar` devuelve la vista previa (totales por versión,
// errores) sin escribir nada; con `confirmar=1` guarda. tipo=planilla → hoja "Planilla carga BGT - Facturas"
// (+ catálogo de "Menu Desplegable"); reemplaza SOLO las versiones que trae. tipo=tc → plantilla de tipos de cambio.
// tipo=presupuesto + version (BGT/4+8/8+4 año) → reemplaza TODO ese presupuesto con la planilla (nunca el REAL).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BYTES = 10 * 1024 * 1024;

async function hojas(file: File): Promise<Record<string, unknown[][]>> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer", cellDates: true, cellFormula: false });
  return Object.fromEntries(wb.SheetNames.map((n) => [n, XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n]!, { header: 1, blankrows: false, raw: true })]));
}

export async function POST(req: Request) {
  return conUsuario(async (u) => {
    const deny = soloEditor(u);
    if (deny) return deny;
    const fd = await req.formData().catch(() => null);
    const file = fd?.get("archivo");
    const tipo = String(fd?.get("tipo") ?? "");
    const confirmar = fd?.get("confirmar") === "1";
    if (!(file instanceof File)) return NextResponse.json({ error: "Elegí el archivo Excel." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "El archivo pesa más de 10 MB." }, { status: 400 });
    const sh = await hojas(file);
    const nombres = Object.keys(sh);

    if (tipo === "tc") {
      const hoja = nombres.find((n) => /tipo de cambio/i.test(n)) ?? nombres[0];
      const { tcs, errores } = parseTcPlantilla(hoja ? sh[hoja]! : []);
      if (!confirmar) return NextResponse.json({ vistaPrevia: true, tcs, errores });
      if (errores.length) return NextResponse.json({ error: "Corregí los errores antes de guardar.", errores }, { status: 400 });
      const n = await guardarTcs(tcs, u.email);
      return NextResponse.json({ ok: true, cambios: n });
    }

    if (tipo === "presupuesto") {
      const version = String(fd?.get("version") ?? "").trim();
      const tv = tipoDeVersion(version);
      if (!tv || !["BGT", "4+8", "8+4"].includes(tv.tipo)) return NextResponse.json({ error: "Elegí el presupuesto (BGT, 4+8 u 8+4 y el año)." }, { status: 400 });
      const hoja = nombres[0];
      const r = parsePresupuesto(hoja ? sh[hoja]! : [], version);
      const porMes = Array<number>(12).fill(0);
      for (const l of r.lineas) porMes[l.mes - 1]! += l.ars;
      const total = porMes.reduce((a, b) => a + b, 0);
      if (!confirmar) return NextResponse.json({ vistaPrevia: true, version, total, porMes, renglones: r.lineas.length, antes: await resumenVersion(version), errores: r.errores, otrasVersiones: r.otrasVersiones });
      if (r.errores.length) return NextResponse.json({ error: "Corregí los errores de la planilla antes de guardar.", errores: r.errores }, { status: 400 });
      if (!r.lineas.length) return NextResponse.json({ error: "La planilla no tiene montos." }, { status: 400 });
      const res = await importarPlanilla(r.lineas, [], u.email, true);
      return NextResponse.json({ ok: true, ...res });
    }

    if (tipo !== "planilla") return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    const hoja = nombres.find((n) => /planilla carga/i.test(n)) ?? nombres.find((n) => /factura/i.test(n));
    if (!hoja) return NextResponse.json({ error: `No encontré la hoja "Planilla carga BGT - Facturas" (hojas: ${nombres.join(", ")}).` }, { status: 400 });
    const r = parsePlanilla(sh[hoja]!);
    const menu = nombres.find((n) => /menu desplegable/i.test(n));
    const catalogo = armarCatalogo(menu ? sh[menu]! : null, r.lineas);
    r.lineas = normalizarCuentas(r.lineas, catalogo);
    const totales = totalesPorVersion(r.lineas);
    const renglones: Record<string, number> = {};
    for (const l of r.lineas) renglones[l.version] = (renglones[l.version] ?? 0) + 1;
    if (!confirmar) {
      return NextResponse.json({ vistaPrevia: true, hoja, totales, renglones, errores: r.errores, omitidas: r.omitidas, catalogo: catalogo.length });
    }
    if (!r.lineas.length) return NextResponse.json({ error: "La planilla no tiene renglones." }, { status: 400 });
    const res = await importarPlanilla(r.lineas, catalogo, u.email);
    return NextResponse.json({ ok: true, ...res, errores: r.errores });
  });
}
