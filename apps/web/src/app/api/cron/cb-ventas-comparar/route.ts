import { NextResponse } from "next/server";
import { calcularPorcentajes, filtrarCompras, mapasClasificacion, mesEnCursoDe } from "@/lib/cb-ventas/metrics";
import { leerCuadroBasico, leerVentas, svc } from "@/lib/cb-ventas/server";
import type { CuadroBasicoItem, VentaRow, VentasFile } from "@/lib/cb-ventas/types";

// Compara CB Ventas de la app vieja (ventas.json del Vercel Blob privado, CBV_OLD_BLOB_TOKEN) contra /cb-ventas:
// mismas ventas fila a fila y mismo % CB / Infaltables / Estratégicos por vendedor (con el MISMO cuadro básico).
// La respuesta va a un log público de Actions → vendedores anonimizados (V1…Vn) y solo números.
// Auth: Authorization: Bearer CRON_SECRET.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

async function ventasViejas(): Promise<VentasFile> {
  const token = process.env.CBV_OLD_BLOB_TOKEN;
  if (!token) throw new Error("Falta CBV_OLD_BLOB_TOKEN");
  const auth = { authorization: `Bearer ${token}` };
  const l = await fetch(`https://blob.vercel-storage.com?prefix=ventas.json`, { headers: auth });
  if (!l.ok) throw new Error(`Blob list ${l.status}`);
  const b = ((await l.json()) as { blobs?: { pathname: string; url: string }[] }).blobs?.find((x) => x.pathname === "ventas.json");
  if (!b) throw new Error("No está ventas.json en el blob viejo");
  const g = await fetch(b.url, { headers: auth });
  if (!g.ok) throw new Error(`Blob get ${g.status}`);
  return (await g.json()) as VentasFile;
}

const clave = (r: VentaRow) => [r.cliente, r.sku, r.tipo, r.mes, r.unidades, r.canal === "FOB" ? "FOB" : ""].join("|");

function multiset(rows: VentaRow[]) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(clave(r), (m.get(clave(r)) ?? 0) + 1);
  return m;
}

function porVendedor(items: CuadroBasicoItem[], v: VentasFile, vendedorPorCliente: Map<string, string>, vendedores: string[]) {
  const ctx = { hayFiltroMes: false, mesEnCurso: mesEnCursoDe(v.generatedAt) };
  const fila = (its: CuadroBasicoItem[], compras: VentaRow[]) => {
    const p = calcularPorcentajes(its, compras, ctx);
    return [p.cumplidosCB, p.totalCB, p.cumplidosInf, p.totalInf, p.cumplidosEst, p.totalEst];
  };
  return {
    total: fila(items, v.rows),
    vendedores: vendedores.map((vd) =>
      fila(items.filter((i) => vendedorPorCliente.get(i.cliente) === vd), filtrarCompras(v.rows, { vendedor: vd, vendedorPorCliente }))),
  };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const s = svc();
    const [vieja, nueva, { cuadroBasico, clasificacion }] = await Promise.all([ventasViejas(), leerVentas(s), leerCuadroBasico(s)]);
    const { vendedorPorCliente } = mapasClasificacion(clasificacion);
    const vendedores = [...new Set(vendedorPorCliente.values())].filter(Boolean).sort();

    const mv = multiset(vieja.rows), mn = multiset(nueva.rows);
    let soloVieja = 0, soloNueva = 0;
    for (const [k, n] of mv) soloVieja += Math.max(0, n - (mn.get(k) ?? 0));
    for (const [k, n] of mn) soloNueva += Math.max(0, n - (mv.get(k) ?? 0));

    const a = porVendedor(cuadroBasico, vieja, vendedorPorCliente, vendedores);
    const b = porVendedor(cuadroBasico, nueva, vendedorPorCliente, vendedores);
    const iguales = (x: number[], y: number[]) => x.every((n, i) => n === y[i]);
    const difs = vendedores
      .map((_, i) => ({ v: `V${i + 1}`, vieja: a.vendedores[i]!, nueva: b.vendedores[i]! }))
      .filter((d) => !iguales(d.vieja, d.nueva));

    return NextResponse.json({
      ok: true,
      columnas: "[cumplidos CB, total CB, cumplidos Inf, total Inf, cumplidos Est, total Est]",
      ventas: {
        vieja: { filas: vieja.rows.length, generada: vieja.generatedAt },
        nueva: { filas: nueva.rows.length, generada: nueva.generatedAt },
        filasSoloEnVieja: soloVieja,
        filasSoloEnNueva: soloNueva,
      },
      total: { vieja: a.total, nueva: b.total, iguales: iguales(a.total, b.total) },
      vendedores: { comparados: vendedores.length, iguales: vendedores.length - difs.length, diferencias: difs },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
