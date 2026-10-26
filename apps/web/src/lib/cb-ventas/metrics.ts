// Copia LITERAL de cuadros-basicos/lib/sellin-metrics.ts: mismas fórmulas = mismos números que /ventas. No tocar sin test.
import type {
  ClasificacionCliente,
  CuadroBasicoItem,
  Tipologia,
  VentaRow,
} from "./types";
import { matchesCB } from "./match";

// ============================================================================
// Métricas de cumplimiento de CB Sell-in (dashboard /ventas).
//
// Estas funciones VIVÍAN dentro de components/Dashboard.tsx. Se extrajeron acá
// sin cambiar el comportamiento para que el copiloto de datos (/api/chat) use
// EXACTAMENTE las mismas fórmulas que la pantalla — si divergen, el chat
// contestaría números que no coinciden con el dashboard.
// ============================================================================

export const OBJETIVO_SELLIN = 80;

/** Mes fiscal "en curso" según cuándo se generó el archivo de ventas. */
export function mesEnCursoDe(generatedAt: string): number {
  return new Date(generatedAt).getMonth() + 1;
}

/**
 * Ventana de FACTURACIÓN a MES CERRADO por tipología: Small Retailers mira los
 * últimos 3 meses cerrados; el resto (Top 10, Grandes Cuentas Resto,
 * Hipermercados) mira los últimos 2.
 */
export function ventanaFC(tip: Tipologia, mesEnCurso: number): Set<number> {
  const n = tip === "SMALL RETAILERS" ? 3 : 2;
  const s = new Set<number>();
  for (let k = 1; k <= n; k++) {
    const m = mesEnCurso - k;
    if (m >= 1) s.add(m);
  }
  return s;
}

export type VentanaCtx = {
  /** true si el usuario eligió meses: el filtro ya acotó las compras. */
  hayFiltroMes: boolean;
  mesEnCurso: number;
};

export function enVentana(c: VentaRow, tip: Tipologia, ctx: VentanaCtx): boolean {
  if (ctx.hayFiltroMes) return true;    // el filtro de MES ya acotó las compras
  if (c.tipo === "BO") return true;     // BO acumulado, como estaba
  return ventanaFC(tip, ctx.mesEnCurso).has(c.mes); // FC: solo meses cerrados
}

/**
 * FC y BO se filtran por mes con semánticas distintas:
 *   - FC: por mes EXACTO. Una factura de marzo solo cuenta en marzo.
 *   - BO: ACUMULADO hasta el último mes seleccionado. Una BO de enero sigue
 *     pendiente en marzo si no se facturó antes.
 */
export function filtrarCompras(
  rows: VentaRow[],
  opts: { meses?: number[]; vendedor?: string | null; vendedorPorCliente?: Map<string, string> },
): VentaRow[] {
  const mesesSel = new Set(opts.meses ?? []);
  const maxMesSel = mesesSel.size > 0 ? Math.max(...mesesSel) : null;
  const vendedor = opts.vendedor ?? null;
  const vendedorPorCliente = opts.vendedorPorCliente ?? null;
  return rows.filter((c) => {
    if (mesesSel.size > 0) {
      if (c.tipo === "FC") {
        if (!mesesSel.has(c.mes)) return false;
      } else if (maxMesSel !== null && c.mes > maxMesSel) {
        return false;
      }
    }
    if (vendedor) {
      // El vendedor "oficial" sale de la clasificación del cliente (todos
      // los filtros del dashboard —vendedor, gerencia, tipología— se
      // resuelven por cliente). Si no hay map (uso legacy), caemos al
      // campo c.vendedor que viene del Excel.
      const v = vendedorPorCliente ? vendedorPorCliente.get(c.cliente) : c.vendedor;
      if (v !== vendedor) return false;
    }
    return true;
  });
}

export type PorcentajesCB = {
  pctCB: number;
  pctInf: number;
  pctEst: number;
  totalCB: number;
  cumplidosCB: number;
  totalInf: number;
  cumplidosInf: number;
  totalEst: number;
  cumplidosEst: number;
  /** Items del CB NO cumplidos (para desplegar los SKUs a recuperar). */
  itemsFaltantes: CuadroBasicoItem[];
};

/**
 * "Cumplido" = la suma de unidades (FC + BO) del par (cliente, sku), dentro de
 * la ventana a mes cerrado de la tipología, es > 0.
 */
export function calcularPorcentajes(
  items: CuadroBasicoItem[],
  compras: VentaRow[],
  ctx: VentanaCtx,
): PorcentajesCB {
  const cumplido = (item: CuadroBasicoItem) => {
    let total = 0;
    for (const c of compras) {
      if (matchesCB(c, item) && enVentana(c, item.tipologia, ctx)) total += c.unidades;
    }
    return total > 0;
  };
  const totalCB = items.length;
  const cumplidosCB = items.filter(cumplido).length;
  const inf = items.filter((i) => i.tipo === "INFALTABLE");
  const est = items.filter((i) => i.tipo === "ESTRATEGICO");
  const cumplidosInf = inf.filter(cumplido).length;
  const cumplidosEst = est.filter(cumplido).length;
  return {
    pctCB: totalCB > 0 ? Math.round((cumplidosCB / totalCB) * 100) : 0,
    pctInf: inf.length > 0 ? Math.round((cumplidosInf / inf.length) * 100) : 0,
    pctEst: est.length > 0 ? Math.round((cumplidosEst / est.length) * 100) : 0,
    totalCB,
    cumplidosCB,
    totalInf: inf.length,
    cumplidosInf,
    totalEst: est.length,
    cumplidosEst,
    itemsFaltantes: items.filter((i) => !cumplido(i)),
  };
}

/** cliente → vendedor y vendedor → gerente, desde la clasificación. */
export function mapasClasificacion(clasificacion: ClasificacionCliente[]) {
  const vendedorPorCliente = new Map<string, string>();
  const gerentePorVendedor = new Map<string, string>();
  for (const c of clasificacion) {
    vendedorPorCliente.set(c.cliente, c.vendedor);
    gerentePorVendedor.set(c.vendedor, c.gerente);
  }
  return { vendedorPorCliente, gerentePorVendedor };
}

export type PuntoEvolucion = {
  mes: number;
  mesLabel: string;
  pctCB: number;
  pctInf: number;
  pctEst: number;
  totalCB: number;
  cumplidosCB: number;
};

export const MESES_LABEL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/**
 * Evolución mensual del cumplimiento — la serie del gráfico "Evolución mensual"
 * de /ventas. FC y BO se cuentan con semánticas distintas, las MISMAS que usan
 * los KPIs, para que el punto del mes M coincida con el card al filtrar ese
 * período:
 *   - FC: ventana móvil de 2 meses (mes M y el anterior M-1). Para Enero solo
 *     Enero. Refleja la facturación reciente.
 *   - BO: ACUMULADO hasta M (todo BO con mes ≤ M, sin límite inferior). Un back
 *     order pendiente de un mes previo sigue representando demanda cubierta al
 *     cierre.
 * Los BO con entrega futura (mes > mes actual) cuentan como del mes actual;
 * sino el último punto subreporta contra los KPIs, que sí los incluyen.
 *
 * Solo devuelve meses hasta el mes en curso — nunca meses sin data.
 */
export function evolucionMensualCB(
  items: CuadroBasicoItem[],
  ventasRows: VentaRow[],
  opts: { generatedAt: string; vendedor?: string | null; vendedorPorCliente?: Map<string, string> },
): PuntoEvolucion[] {
  const mesActual = mesEnCursoDe(opts.generatedAt);
  const vendedor = opts.vendedor ?? null;
  const vendedorPorCliente = opts.vendedorPorCliente ?? null;
  const out: PuntoEvolucion[] = [];

  for (let mes = 1; mes <= mesActual; mes++) {
    const mesDesde = Math.max(1, mes - 1);
    const comprasVentana = ventasRows.filter((c) => {
      const mesEfectivo = Math.min(c.mes, mesActual);
      if (c.tipo === "FC") {
        if (mesEfectivo > mes || mesEfectivo < mesDesde) return false;
      } else if (mesEfectivo > mes) {
        return false;
      }
      if (vendedor) {
        // Mismo criterio que filtrarCompras: el vendedor se resuelve por
        // cliente desde la clasificación (fallback a c.vendedor si no se
        // pasó el map).
        const v = vendedorPorCliente ? vendedorPorCliente.get(c.cliente) : c.vendedor;
        if (v !== vendedor) return false;
      }
      return true;
    });
    const cumplido = (item: CuadroBasicoItem) => {
      let total = 0;
      for (const c of comprasVentana) {
        if (matchesCB(c, item)) total += c.unidades;
      }
      return total > 0;
    };
    const totalCB = items.length;
    const cumplidosCB = items.filter(cumplido).length;
    const inf = items.filter((i) => i.tipo === "INFALTABLE");
    const est = items.filter((i) => i.tipo === "ESTRATEGICO");
    out.push({
      mes,
      mesLabel: MESES_LABEL[mes - 1]!,
      pctCB: totalCB > 0 ? Math.round((cumplidosCB / totalCB) * 100) : 0,
      pctInf: inf.length > 0 ? Math.round((inf.filter(cumplido).length / inf.length) * 100) : 0,
      pctEst: est.length > 0 ? Math.round((est.filter(cumplido).length / est.length) * 100) : 0,
      totalCB,
      cumplidosCB,
    });
  }
  return out;
}
