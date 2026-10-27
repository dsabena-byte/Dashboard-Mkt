import "server-only";
import { cache } from "react";

// Sugerencias de tiendas para sumar al programa CB, calculadas desde las tablas tr_* (0138). Port de las vistas
// vw_cb_baseline_medidas / vw_cb_suggestions / vw_cb_suggestions_detail del proyecto CB, con el mismo criterio:
// tiendas del último U3 que NO se miden en el CB → se les aplica el catálogo de su cliente (cadena → cliente en
// tr_cadenas; sin cliente = SMALL RETAILERS) y se mide presencia (existencia > 0, por modelo u homólogo).
// El CATÁLOGO + homólogos se sigue leyendo de cb_homologos del proyecto CB (lo migra el frente de CB Ventas);
// cuando exista el catálogo nuevo, cambiar `leerHomologos`.

import { getCbSupabase } from "./supabase-cb";
import { trAll, trEstado } from "./trade-db";
import { calcularSugerencias, type CbMin, type Ex, type Hom } from "./trade-sugerencias-core";

export async function leerHomologos(): Promise<Hom[]> {
  const sb = getCbSupabase();
  const out: Hom[] = [];
  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await sb.from("cb_homologos").select("cliente,categoria,cuadro_basico,modelo,sku").order("id").range(from, from + 999);
    if (error) throw new Error(`cb_homologos: ${error.message}`);
    out.push(...((data ?? []) as Hom[]));
    if ((data ?? []).length < 1000) break;
  }
  return out;
}

/** null = no hay datos en tr_* (seguir con las vistas del proyecto CB). */
export const getSugerenciasTr = cache(async () => {
  const est = await trEstado();
  if (est.cb == null) return null;
  const [cb, ex, hom, cad] = await Promise.all([
    trAll<CbMin>(`tr_cb_semanal?select=semana,tienda,target_cb,real_cb,target_inf,real_inf&anio=eq.${est.cb}`),
    trAll<Ex>("tr_existencias?select=numero_tienda,tienda,cadena,sku,existencia"),
    leerHomologos(),
    trAll<{ clave: string; alias: string[]; cliente: string | null }>("tr_cadenas?select=clave,alias,cliente"),
  ]);
  const cadenaCliente = new Map<string, string>();
  for (const c of cad) if (c.cliente) for (const k of [c.clave, ...(c.alias ?? [])]) cadenaCliente.set(k, c.cliente);
  return calcularSugerencias(cb, ex, hom, cadenaCliente);
});
