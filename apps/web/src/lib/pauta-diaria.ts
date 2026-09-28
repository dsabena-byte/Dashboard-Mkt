// ============================================================================
// Inversión DIARIA por medio (medios con API) — detección de gasto anómalo. PURO y client-safe.
// Plan de Medios → Eficiencia Medios → "Inversión diaria por medio" + señal `gasto_diario_anomalo`.
//
// Caso que motivó esto: una pauta mal configurada que se gasta el presupuesto del mes en 3 días
// (ago-2026: las campañas "_Diario" de Meta gastaron ~$41,6M — 66% del mes de Meta — en 3 días).
//
// Qué medios tienen dato DIARIO (validado por REST, sep-2026):
//  · Google Search y Demand Gen → google_ads_creatives (una fila por anuncio y día, desde 2026-04-08).
//  · Meta → meta_paid_daily (migración 0124, lo llena el cron meta-paid-sync). Hasta que haya filas,
//    Meta se evalúa con su dato MENSUAL (meta_paid_creatives: gasto del mes a la fecha + días activos
//    por campaña).
//  · DV360 (YouTube / Programmatic) → dv360_creatives es SOLO mensual (columna `mes`): no hay diario.
//
// Reglas (todas relativas a la historia del propio medio, sin supuestos externos):
//  1. PICO: un día que gasta > 3× la mediana de los días CON gasto de los 14 días previos (pide ≥5 días
//     con gasto en la ventana, así un reinicio tras una pausa no cuenta) y más de $150.000.
//  2. RITMO DEL MES: "mes normal" = MEDIANA de los últimos 3 meses CERRADOS con gasto (mediana y no
//     promedio: un mes cortado por un hueco de sync —Google jun-26— o con un burst —Meta ago-26— no mueve
//     la referencia), llevando cada mes a la escala del PLAN de Inversión del mes evaluado (meta "Pauta
//     Mkt": jun 70M → sep 474M; sin plan cargado, sin ajuste). Al día d de un mes de D días "lo esperable"
//     es mes normal × d / D.
//       · urgente (RÁFAGA) si en ≤5 días se gastó ≥50% de un mes normal: al arrancar el mes (lo gastado
//         en el mes) o en cualquier momento (los últimos 5 días con dato, solo medios con dato diario, y
//         siempre que esos 5 días gasten >2× el nivel diario de las 2 semanas anteriores: si el gasto ya
//         venía alto es un nivel nuevo, no una ráfaga);
//       · urgente si en los primeros 10 días lo gastado supera 1,5× lo esperable (y ya es ≥30% de un mes
//         normal); más tarde, eso mismo es "revisar" (un mes más caro de lo normal: plan más grande o
//         gasto de más, no un gasto desbocado);
//       · revisar si supera 1,2× lo esperable (y ya es ≥20% de un mes normal).
//  3. Un pico en los últimos 3 días con dato → revisar; urgente si ese solo día gastó ≥20% de un mes normal.
//  4. CONCENTRACIÓN (dato mensual por campaña, Meta): campañas que estuvieron activas ≤5 días y se
//     llevaron ≥50% del gasto del mes del medio → urgente (≥25% → revisar).
// ============================================================================

export type EstadoGasto = "ok" | "revisar" | "urgente" | "sin_dato";

export interface SerieMedio {
  medio: string;
  /** "diaria" = hay gasto por día; "mensual" = solo el total del mes (a la fecha `asOf`). */
  fuente: "diaria" | "mensual";
  /** YYYY-MM-DD → gasto del día (ARS). */
  dias: Record<string, number>;
  /** YYYY-MM → gasto total del mes (ARS). Fuente de la referencia mensual. */
  meses: Record<string, number>;
  /** Solo "mensual": último día cubierto por el dato del mes en curso (YYYY-MM-DD). */
  asOf?: string | null;
  nota?: string | null;
}

export interface PicoGasto { medio: string; fecha: string; gasto: number; mediana: number; veces: number }

export interface EstadoMedio {
  medio: string;
  fuente: "diaria" | "mensual";
  nota: string | null;
  /** Último día con dato (diaria) o fecha de corte del dato mensual. */
  ultimoDia: string | null;
  gastoUltimo: number | null;
  gastoPrevio: number | null;
  /** Promedio diario de los 14 días previos al último (incluye días en 0). */
  prom14: number | null;
  mes: string;
  diaDelMes: number;
  diasMes: number;
  acumMes: number;
  referenciaMes: number | null;
  refMeses: string[];
  /** true = el mes normal se llevó a la escala del plan de Inversión del mes. */
  refAjustadaPlan: boolean;
  /** Gastado del mes ÷ referencia mensual, en %. */
  pctRef: number | null;
  /** Lo esperable a esta altura del mes (referencia × d / D). */
  esperado: number | null;
  /** Gastado ÷ esperable (1 = al ritmo normal). */
  ritmo: number | null;
  picosRecientes: PicoGasto[];
  /** Ráfaga: ≥50% de un mes normal en ≤5 días (al arrancar el mes o en los últimos 5 días). */
  rafaga: { dias: number; gasto: number; pct: number; inicioMes: boolean } | null;
  estado: EstadoGasto;
  motivos: string[];
}

export interface CampaniaMes { mes: string; campania: string; gasto: number; dias: number | null }
export interface Concentracion {
  medio: string;
  mes: string;
  totalMes: number;
  gastoRapido: number;
  pct: number;
  diasMax: number;
  campanias: { campania: string; gasto: number; dias: number }[];
  estado: EstadoGasto;
  motivo: string;
}

export interface PautaDiariaResultado {
  hoy: string;
  medios: EstadoMedio[];
  picos: PicoGasto[];
  concentracion: Concentracion[];
}

/** Lo que el server (lib/pauta-diaria-server) le pasa a la página. */
export interface PautaDiariaData {
  hoy: string;
  /** Primer día que se puede graficar (hoy − 90). */
  desde: string;
  series: SerieMedio[];
  campanias: { medio: string; filas: CampaniaMes[] }[];
  meta: { diaria: boolean; faltaMigracion: boolean; desde: string | null };
  google: { desde: string | null };
  /** Meta mensual de Inversión (plan "Pauta Mkt", total) por YYYY-MM — escala el "mes normal". */
  plan: Record<string, number>;
}

export const CFG_DIARIA = {
  factorPico: 3,
  ventana: 14,
  minDiasVentana: 5,
  minimoPico: 150_000,
  recientes: 3,
  rapidoPct: 50,
  rapidoDias: 5,
  ritmoUrgente: 1.5,
  diasTempranos: 10,
  rafagaVsPrevio: 2,
  pisoUrgentePct: 30,
  ritmoRevisar: 1.2,
  pisoRevisarPct: 20,
  picoUrgentePct: 20,
  concentracionUrgente: 50,
  concentracionRevisar: 25,
  minimoCampania: 500_000,
};
export type CfgDiaria = typeof CFG_DIARIA;

// ── Fechas (UTC, strings YYYY-MM-DD) ──
const DAY = 86_400_000;
const toMs = (f: string) => Date.parse(`${f}T00:00:00Z`);
export const addDias = (f: string, n: number) => new Date(toMs(f) + n * DAY).toISOString().slice(0, 10);
export const diasDelMes = (mes: string) => { const [y, m] = mes.split("-").map(Number); return new Date(Date.UTC(y!, m!, 0)).getUTCDate(); };
/** Mes YYYY-MM desplazado n meses. */
export const mesMas = (mes: string, n: number) => { const [y, m] = mes.split("-").map(Number); const d = new Date(Date.UTC(y!, m! - 1 + n, 1)); return d.toISOString().slice(0, 7); };

function mediana(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y);
  if (!a.length) return 0;
  const h = Math.floor(a.length / 2);
  return a.length % 2 ? a[h]! : (a[h - 1]! + a[h]!) / 2;
}

// ── Formato (es-AR) para los textos ──
const nf = (d: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d });
export const fARS = (v: number) => { const a = Math.abs(v); return a >= 1e6 ? `$${nf(1).format(v / 1e6)}M` : a >= 1e3 ? `$${nf(0).format(v / 1e3)}K` : `$${nf(0).format(v)}`; };
export const fFecha = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
const fVeces = (v: number) => `${nf(1).format(v)} veces`;

/** Todos los picos de la serie diaria (regla 1). */
export function detectarPicos(medio: string, dias: Record<string, number>, cfg: CfgDiaria = CFG_DIARIA): PicoGasto[] {
  const fechas = Object.keys(dias).sort();
  if (!fechas.length) return [];
  const out: PicoGasto[] = [];
  for (const f of fechas) {
    const g = dias[f] ?? 0;
    if (g <= cfg.minimoPico) continue;
    const prev: number[] = [];
    for (let i = 1; i <= cfg.ventana; i++) { const v = dias[addDias(f, -i)] ?? 0; if (v > 0) prev.push(v); }
    if (prev.length < cfg.minDiasVentana) continue;
    const med = mediana(prev);
    if (med > 0 && g > cfg.factorPico * med) out.push({ medio, fecha: f, gasto: g, mediana: med, veces: g / med });
  }
  return out;
}

/** "Mes normal": mediana de los últimos 3 meses CERRADOS (anteriores a `mes`) con gasto > 0. Si hay plan
 *  mensual de Inversión (meta "Pauta Mkt"), cada mes de referencia se lleva a la escala del plan del mes
 *  evaluado (gasto × plan[mes] ÷ plan[ese mes]): un mes con el doble de plan no es "gasto de más". */
export function referenciaMensual(meses: Record<string, number>, mes: string, plan?: Record<string, number> | null): { valor: number | null; meses: string[]; ajustadaPlan: boolean } {
  const cerrados = Object.keys(meses).filter((m) => m < mes && (meses[m] ?? 0) > 0).sort().slice(-3);
  if (!cerrados.length) return { valor: null, meses: [], ajustadaPlan: false };
  const pAct = plan?.[mes] ?? 0;
  const ajustar = pAct > 0 && cerrados.every((m) => (plan?.[m] ?? 0) > 0);
  return {
    valor: mediana(cerrados.map((m) => (meses[m] ?? 0) * (ajustar ? pAct / plan![m]! : 1))),
    meses: cerrados,
    ajustadaPlan: ajustar,
  };
}

/** Estado de un medio al día `hoy` (reglas 1-3). */
export function evaluarMedio(serie: SerieMedio, hoy: string, cfg: CfgDiaria = CFG_DIARIA, plan?: Record<string, number> | null): EstadoMedio {
  const mes = hoy.slice(0, 7);
  const D = diasDelMes(mes);
  const ref = referenciaMensual(serie.meses, mes, plan);
  let ultimoDia: string | null = null, gastoUltimo: number | null = null, gastoPrevio: number | null = null, prom14: number | null = null;
  let acum = 0, d = 0, ultimos5 = 0;
  let nivelPrevio: number | null = null;
  let picosRecientes: PicoGasto[] = [];
  if (serie.fuente === "diaria") {
    const fechas = Object.keys(serie.dias).filter((f) => f <= hoy && (serie.dias[f] ?? 0) > 0).sort();
    ultimoDia = fechas[fechas.length - 1] ?? null;
    if (ultimoDia) {
      gastoUltimo = serie.dias[ultimoDia] ?? 0;
      gastoPrevio = serie.dias[addDias(ultimoDia, -1)] ?? 0;
      let s = 0; for (let i = 1; i <= 14; i++) s += serie.dias[addDias(ultimoDia, -i)] ?? 0;
      prom14 = s / 14;
      for (let i = 0; i < cfg.rapidoDias; i++) ultimos5 += serie.dias[addDias(ultimoDia, -i)] ?? 0;
      // Nivel diario de las 2 semanas ANTERIORES a esa ventana de 5 días (mediana de los días con gasto):
      // si el gasto ya venía en ese nivel, no es una ráfaga sino un nivel nuevo (lo toma la regla de ritmo).
      const base: number[] = [];
      for (let i = cfg.rapidoDias; i < cfg.rapidoDias + cfg.ventana; i++) { const v = serie.dias[addDias(ultimoDia, -i)] ?? 0; if (v > 0) base.push(v); }
      nivelPrevio = base.length >= cfg.minDiasVentana ? mediana(base) : null;
      if (ultimoDia.slice(0, 7) === mes) {
        d = Number(ultimoDia.slice(8, 10));
        for (const [f, v] of Object.entries(serie.dias)) if (f.slice(0, 7) === mes && f <= ultimoDia) acum += v;
      }
      // "Reciente" = últimos 3 días con dato, y además cerca de hoy (el dato llega con 1-2 días de demora):
      // un pico de un medio que dejó de pautar hace semanas ya no es una alerta.
      const a = addDias(ultimoDia, -(cfg.recientes - 1)), b = addDias(hoy, -(cfg.recientes + 1));
      const desde = a > b ? a : b;
      picosRecientes = detectarPicos(serie.medio, serie.dias, cfg).filter((p) => p.fecha >= desde && p.fecha <= ultimoDia!);
    }
  } else {
    ultimoDia = serie.asOf ?? null;
    acum = serie.meses[mes] ?? 0;
    if (ultimoDia && ultimoDia.slice(0, 7) === mes) d = Number(ultimoDia.slice(8, 10));
    else if (acum > 0) d = Math.min(D, Number(hoy.slice(8, 10)));
  }

  const refV = ref.valor;
  const esperado = refV != null && d > 0 ? (refV * d) / D : null;
  const pctRef = refV ? (acum / refV) * 100 : null;
  const ritmo = esperado ? acum / esperado : null;
  const motivos: string[] = [];
  let estado: EstadoGasto = "ok";
  const sube = (e: EstadoGasto) => { if (e === "urgente" || (e === "revisar" && estado === "ok")) estado = e; };
  let rafaga: EstadoMedio["rafaga"] = null;

  if (refV != null && pctRef != null && d > 0) {
    const pct5 = (ultimos5 / refV) * 100;
    if (d <= cfg.rapidoDias && pctRef >= cfg.rapidoPct) {
      sube("urgente");
      rafaga = { dias: d, gasto: acum, pct: pctRef, inicioMes: true };
      motivos.push(`En solo ${d} ${d === 1 ? "día" : "días"} ya gastó ${fARS(acum)}: el ${nf(0).format(pctRef)}% de lo que gasta en un mes normal (${fARS(refV)}).`);
    } else if (serie.fuente === "diaria" && d > cfg.rapidoDias && pct5 >= cfg.rapidoPct
      && (nivelPrevio == null || ultimos5 / cfg.rapidoDias > cfg.rafagaVsPrevio * nivelPrevio)) {
      sube("urgente");
      rafaga = { dias: cfg.rapidoDias, gasto: ultimos5, pct: pct5, inicioMes: false };
      motivos.push(`En los últimos ${cfg.rapidoDias} días gastó ${fARS(ultimos5)}: el ${nf(0).format(pct5)}% de lo que gasta en un mes normal (${fARS(refV)}).`);
    } else if (ritmo != null && ritmo > cfg.ritmoUrgente && pctRef >= cfg.pisoUrgentePct) {
      // Temprano en el mes es un gasto desbocado → urgente; más tarde es un mes más caro de lo normal
      // (plan más grande o gasto de más) → revisar. Las ráfagas de mitad de mes las toma la regla anterior.
      sube(d <= cfg.diasTempranos ? "urgente" : "revisar");
      motivos.push(`Gasta ${fVeces(ritmo)} más rápido de lo normal: al día ${d} lleva ${fARS(acum)} y lo esperable era ${fARS(esperado!)} (${nf(0).format(pctRef)}% de un mes normal).`);
    } else if (ritmo != null && ritmo > cfg.ritmoRevisar && pctRef >= cfg.pisoRevisarPct) {
      sube("revisar");
      motivos.push(`Va más rápido de lo normal: al día ${d} lleva ${fARS(acum)} y lo esperable era ${fARS(esperado!)}.`);
    }
  }
  for (const p of picosRecientes) {
    const grande = refV != null && (p.gasto / refV) * 100 >= cfg.picoUrgentePct;
    sube(grande ? "urgente" : "revisar");
    motivos.push(`El ${fFecha(p.fecha)} gastó ${fARS(p.gasto)}: ${fVeces(p.veces)} lo de un día normal (${fARS(p.mediana)})${grande ? `, un ${nf(0).format((p.gasto / refV!) * 100)}% de un mes normal en un solo día` : ""}.`);
  }
  if (serie.fuente === "diaria" && !ultimoDia) estado = "sin_dato";
  if (serie.fuente === "mensual" && acum <= 0 && refV == null) estado = "sin_dato";

  return {
    medio: serie.medio, fuente: serie.fuente, nota: serie.nota ?? null, ultimoDia, gastoUltimo, gastoPrevio, prom14,
    mes, diaDelMes: d, diasMes: D, acumMes: acum, referenciaMes: refV, refMeses: ref.meses, refAjustadaPlan: ref.ajustadaPlan, pctRef, esperado, ritmo,
    picosRecientes, rafaga, estado, motivos,
  };
}

/** Regla 4: campañas activas ≤5 días que se llevaron gran parte del gasto mensual del medio. */
export function concentracionMensual(medio: string, campanias: CampaniaMes[], meses: Record<string, number>, cfg: CfgDiaria = CFG_DIARIA): Concentracion[] {
  const porMes = new Map<string, CampaniaMes[]>();
  for (const c of campanias) porMes.set(c.mes, [...(porMes.get(c.mes) ?? []), c]);
  const out: Concentracion[] = [];
  for (const [mes, cs] of [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const total = meses[mes] ?? cs.reduce((a, c) => a + c.gasto, 0);
    if (total <= 0) continue;
    const rap = cs.filter((c) => c.dias != null && c.dias > 0 && c.dias <= cfg.rapidoDias && c.gasto >= cfg.minimoCampania)
      .sort((a, b) => b.gasto - a.gasto);
    if (!rap.length) continue;
    const gastoRapido = rap.reduce((a, c) => a + c.gasto, 0);
    const pct = (gastoRapido / total) * 100;
    const estado: EstadoGasto = pct >= cfg.concentracionUrgente ? "urgente" : pct >= cfg.concentracionRevisar ? "revisar" : "ok";
    const diasMax = Math.max(...rap.map((c) => c.dias ?? 0));
    out.push({
      medio, mes, totalMes: total, gastoRapido, pct, diasMax,
      campanias: rap.map((c) => ({ campania: c.campania, gasto: c.gasto, dias: c.dias ?? 0 })),
      estado,
      motivo: `${rap.length === 1 ? "Una campaña que estuvo activa" : `${rap.length} campañas que estuvieron activas`} ${diasMax} ${diasMax === 1 ? "día" : "días"} o menos ${rap.length === 1 ? "se llevó" : "se llevaron"} ${fARS(gastoRapido)}: el ${nf(0).format(pct)}% de todo lo que gastó ${medio} en el mes (${fARS(total)}).`,
    });
  }
  return out;
}

/** Todo junto: estado por medio + picos (historia) + concentración por campaña. */
export function evaluarPautaDiaria(inp: { series: SerieMedio[]; campanias?: { medio: string; filas: CampaniaMes[] }[]; hoy: string; plan?: Record<string, number> | null }, cfg: CfgDiaria = CFG_DIARIA): PautaDiariaResultado {
  const medios = inp.series.map((s) => evaluarMedio(s, inp.hoy, cfg, inp.plan));
  const picos = inp.series.filter((s) => s.fuente === "diaria").flatMap((s) => detectarPicos(s.medio, s.dias, cfg)).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const concentracion = (inp.campanias ?? []).flatMap((c) => concentracionMensual(c.medio, c.filas, inp.series.find((s) => s.medio === c.medio)?.meses ?? {}, cfg));
  return { hoy: inp.hoy, medios, picos, concentracion };
}

/** Serie continua (con 0 en los días sin gasto) para el gráfico: filas {fecha, [medio]: gasto}. */
export function serieGrafico(series: SerieMedio[], desde: string, hasta: string): Record<string, number | string>[] {
  const out: Record<string, number | string>[] = [];
  const diarias = series.filter((s) => s.fuente === "diaria");
  for (let f = desde; f <= hasta; f = addDias(f, 1)) {
    const row: Record<string, number | string> = { fecha: f };
    for (const s of diarias) row[s.medio] = Math.round(s.dias[f] ?? 0);
    out.push(row);
  }
  return out;
}
