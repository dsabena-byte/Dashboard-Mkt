import "server-only";
import { cache } from "react";

// Sugerencias de tiendas para sumar al programa CB, calculadas desde las tablas tr_* (0138). Port de las vistas
// vw_cb_baseline_medidas / vw_cb_suggestions / vw_cb_suggestions_detail del proyecto CB, con el mismo criterio:
// tiendas del último U3 que NO se miden en el CB → se les aplica el catálogo de su cliente (cadena → cliente en
// tr_cadenas; sin cliente = SMALL RETAILERS) y se mide presencia (existencia > 0, por modelo u homólogo).
// El CATÁLOGO + homólogos sale de vt_cb_catalogo (CB Ventas, lo vigente hoy). Antes era cb_homologos del proyecto CB viejo:
// verificado 13-nov-2026 que dan las MISMAS 895 combinaciones cliente·categoría·tipo·modelo·sku (solo cambia el nombre
// «GRANDES CUENTAS RESTO (46 CLIENTES)» → «GRANDES CUENTAS RESTO»), así que los números no cambian.

import { trAll, trEstado } from "./trade-db";
import { calcularSugerencias, type CbMin, type Ex, type Hom } from "./trade-sugerencias-core";
import { hoyAR, vigenteEnFecha } from "./cb-ventas/vigencia";

type CatRow = { cliente: string | null; tipologia: string; tipo: string; categoria: string; modelo: string; homologos: string[] | null; vigente_desde?: string | null; vigente_hasta?: string | null };

async function leerHomologos(): Promise<Hom[]> {
  const rows = await trAll<CatRow>("vt_cb_catalogo?select=cliente,tipologia,tipo,categoria,modelo,homologos,vigente_desde,vigente_hasta");
  const hoy = hoyAR();
  return rows
    .filter((r) => vigenteEnFecha({ desde: r.vigente_desde, hasta: r.vigente_hasta }, hoy))
    .flatMap((r) => [r.modelo, ...(r.homologos ?? [])].map((sku) => ({ cliente: r.cliente ?? r.tipologia, categoria: r.categoria, cuadro_basico: r.tipo, modelo: r.modelo, sku }) as Hom));
}

/** null = no hay datos en tr_* (seguir con las vistas del proyecto CB). */
export const getSugerenciasTr = cache(async () => {
  const est = await trEstado();
  if (est.cb == null) return null;
  const [cb, ex, hom, cad, vtc] = await Promise.all([
    trAll<CbMin>(`tr_cb_semanal?select=semana,tienda,target_cb,real_cb,target_inf,real_inf&anio=eq.${est.cb}`),
    trAll<Ex>("tr_existencias?select=numero_tienda,tienda,cadena,sku,existencia"),
    leerHomologos(),
    trAll<{ clave: string; alias: string[]; cliente: string | null }>("tr_cadenas?select=clave,alias,cliente"),
    trAll<{ cliente: string; tipologia: string | null }>("vt_clientes?select=cliente,tipologia", "cliente").catch(() => []),
  ]);
  // El catálogo tiene clientes propios (Top 10 / Hiper) y UN renglón por tipología para Grandes Cuentas
  // Resto y Small Retailers → un cliente sin catálogo propio usa el de su tipología (vt_clientes).
  const claves = new Set(hom.map((h) => (h.cliente ?? "").toUpperCase().trim()));
  const gcr = [...claves].find((k) => k.startsWith("GRANDES CUENTAS RESTO")) ?? "GRANDES CUENTAS RESTO";
  const tipo = new Map(vtc.map((v) => [v.cliente.toUpperCase().trim(), (v.tipologia ?? "").toUpperCase()]));
  const catDe = (cli: string) => {
    const k = cli.toUpperCase().trim();
    return claves.has(k) ? cli : tipo.get(k) === "GRANDES CUENTAS RESTO" ? gcr : "SMALL RETAILERS";
  };
  const cadenaCliente = new Map<string, string>();
  for (const c of cad) if (c.cliente) for (const k of [c.clave, ...(c.alias ?? [])]) cadenaCliente.set(k, catDe(c.cliente));
  return calcularSugerencias(cb, ex, hom, cadenaCliente);
});
