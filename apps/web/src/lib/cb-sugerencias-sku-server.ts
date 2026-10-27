import "server-only";
// Lectura de "Sugerencias de SKUs" (pestaña de /cuadros-basicos): exhibición del período (tr_exhibicion_sku), el CB de
// la última semana del período por tienda (tr_cb_semanal) y la tipología de cada cadena (tr_cadenas.cliente → razón
// social de CB Ventas → vt_clientes.tipologia; si la cadena no tiene cliente SAP, por la razón social del reporte).
import { trAll } from "@/lib/trade-db";
import { calcularSugerenciasSku, claveTienda, type CbSkuRow, type ExhSkuRow, type GrupoSku } from "@/lib/cb-sugerencias-sku";

export const MIN_SEMANAS = 4; // un mes
export type SugerenciasSku = {
  semanas: number[]; desde: number | null; hasta: number | null; anio: number;
  porCliente: GrupoSku[]; porTipologia: GrupoSku[]; error: string | null;
};

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export async function getSugerenciasSku(desdeQ?: number, hastaQ?: number): Promise<SugerenciasSku> {
  const anio = new Date().getFullYear();
  const vacio = { anio, semanas: [], desde: null, hasta: null, porCliente: [], porTipologia: [] };
  let cargado: Array<{ semana: number }>;
  try {
    cargado = await trAll<{ semana: number }>(`vw_tr_cargado?select=semana&tipo=eq.exh&anio=eq.${anio}`, "semana");
  } catch {
    return { ...vacio, error: "Falta la migración 0144 (tabla de exhibición de SKUs)." };
  }
  const semanas = [...new Set(cargado.map((c) => c.semana))].sort((a, b) => a - b);
  if (!semanas.length) return { ...vacio, semanas, error: null };
  // Período por defecto = las últimas 4 semanas cargadas.
  const hasta = hastaQ && semanas.includes(hastaQ) ? hastaQ : semanas[semanas.length - 1]!;
  const desde = desdeQ && desdeQ <= hasta ? desdeQ : semanas.filter((s) => s <= hasta).slice(-MIN_SEMANAS)[0]!;

  const [exh, cb, cadenas, clientes] = await Promise.all([
    trAll<ExhSkuRow & { formato: string | null }>(
      `tr_exhibicion_sku?select=id,semana,tienda,sku,division,categoria,subcategoria,descripcion,estatus_pdv,formato&anio=eq.${anio}&semana=gte.${desde}&semana=lte.${hasta}`),
    trAll<CbSkuRow>(`tr_cb_semanal?select=id,semana,tienda,cliente,sku,target_cb,real_cb&anio=eq.${anio}&semana=gte.${desde}&semana=lte.${hasta}`),
    trAll<{ clave: string; nombre: string | null; cliente: string | null; alias: string[] | null }>("tr_cadenas?select=clave,nombre,cliente,alias", "clave"),
    trAll<{ cliente: string; tipologia: string | null }>("vt_clientes?select=cliente,tipologia", "cliente").catch(() => []),
  ]);

  const tipoDeCliente = new Map(clientes.map((c) => [norm(c.cliente), c.tipologia ?? ""]));
  const sapDeCadena = new Map<string, string>();
  for (const c of cadenas) if (c.cliente) for (const k of [c.clave, c.nombre, ...(c.alias ?? [])]) if (k) sapDeCadena.set(norm(k), c.cliente);
  const formatoDeTienda = new Map(exh.map((r) => [claveTienda(r.tienda), r.formato]));
  const tipologia = (tienda: string, cliente: string | null) => {
    const sap = sapDeCadena.get(norm(cliente));
    return (sap && tipoDeCliente.get(norm(sap))) || tipoDeCliente.get(norm(formatoDeTienda.get(claveTienda(tienda)))) || "Sin tipología";
  };

  return {
    anio, semanas, desde, hasta, error: null,
    porCliente: calcularSugerenciasSku(exh, cb, (_t, c) => c || "Sin cliente"),
    porTipologia: calcularSugerenciasSku(exh, cb, tipologia),
  };
}
