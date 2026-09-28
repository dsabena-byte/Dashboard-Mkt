import "server-only";
import { getSeguimientoKpis } from "./objetivos-kpis";
import { getMapaConfig } from "./mapa-server";
import { getIndicesMacro } from "./moneda-server";
import { resolverContexto } from "./moneda";
import { CATEGORIA_PESOS } from "./categorias";
import { validarMapaConDatos, serie24, porMesA24, type ResultadoCandidato, type ValidacionPorResultado } from "./mapa-validacion";

// Validación de los pesos del Mapa contra el RESULTADO de negocio (portado de BIP, sep-2026). Solo
// lectura, se pide A DEMANDA (botón en /mapa-estrategico → /api/mapa-estrategico/validacion): usa el
// Seguimiento (año en curso + historia del anterior), que es pesado para correr en cada render.
// Resultado de Drean = share de mercado GfK de Drean (valor, segmento Total, mensual):
//   · "general" = Σ categoría × CATEGORIA_PESOS (Lav 62 / Refri 35 / Cocc 3) en los meses con las 3.
//   · "Lavado" (la serie más larga).
// La facturación (facturacion_mensual) todavía tiene < 13 meses → no alcanza para validar.

export interface ValidacionMapaData { anio: number; resultados: ValidacionPorResultado[]; objetivos: { id: string; nombre: string; color: string }[]; nota: string | null }

type ShareRow = { mes: string; categoria: string; value_share: number | null };

async function shareDrean(): Promise<ShareRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(`${url}/rest/v1/mercado_share?marca=eq.DREAN&agregacion=eq.mensual&segmento=eq.Total&select=mes,categoria,value_share&order=mes.asc&limit=2000`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store",
    });
    return res.ok ? ((await res.json()) as ShareRow[]) : [];
  } catch { return []; }
}

export async function getValidacionMapa(): Promise<ValidacionMapaData | null> {
  const anio = new Date().getUTCFullYear();
  const hoy = new Date().toISOString().slice(0, 7);
  const [mapa, kpis, indices, share] = await Promise.all([
    getMapaConfig(),
    getSeguimientoKpis(anio).catch(() => []),
    getIndicesMacro().catch(() => []),
    shareDrean(),
  ]);
  if (!mapa || !mapa.objetivos.length) return null;
  const { ctx } = resolverContexto("constantes", indices);
  const kh = kpis.map((k) => ({ plan: k.plan, kpi: k.kpi, unit: k.unit, direccion: k.direccion, realM: k.realM, histM: k.histM }));

  // Share Drean por mes y categoría (ignora meses futuros: mercado_share trae filas con mes > hoy).
  const byCat = new Map<string, Map<string, number>>();
  for (const r of share) {
    const mes = String(r.mes).slice(0, 7);
    if (mes > hoy || r.value_share == null) continue;
    const m = byCat.get(r.categoria) ?? new Map<string, number>();
    m.set(mes, Number(r.value_share));
    byCat.set(r.categoria, m);
  }
  const cats = ["Lavado", "Refrigeración", "Cocción"];
  const meses = [...new Set([...byCat.values()].flatMap((m) => [...m.keys()]))].sort();
  const general = meses
    .filter((mes) => cats.every((c) => byCat.get(c)?.has(mes)))
    .map((mes) => {
      const wT = cats.reduce((a, c) => a + (CATEGORIA_PESOS[c] ?? 0), 0) || 1;
      return { mes, valor: cats.reduce((a, c) => a + (byCat.get(c)!.get(mes)! * (CATEGORIA_PESOS[c] ?? 0)), 0) / wT };
    });
  const lav = [...(byCat.get("Lavado") ?? new Map<string, number>()).entries()].map(([mes, valor]) => ({ mes, valor }));

  const cands: ResultadoCandidato[] = [
    { id: "share-general", nombre: "Share de mercado Drean (valor, general)", serie24: porMesA24(general, anio), nota: "GfK mensual, segmento Total; general = Σ categoría × peso (Lav 62 · Refri 35 · Cocc 3)" },
    { id: "share-lavado", nombre: "Share de mercado Drean · Lavado (valor)", serie24: porMesA24(lav, anio), nota: "GfK mensual, segmento Total" },
  ];
  const resultados = validarMapaConDatos(mapa, kh, anio, cands, ctx);
  return {
    anio,
    objetivos: mapa.objetivos.map((o) => ({ id: o.id, nombre: o.nombre, color: o.color })),
    resultados,
    nota: ctx.moneda === "constantes" ? null : "Sin serie de inflación cargada (tabla indices_macro): la Inversión se compara sin ajustar por inflación.",
  };
}

export { serie24 };
