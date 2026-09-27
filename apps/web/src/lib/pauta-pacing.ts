// ============================================================================
// PACING del mes en curso (Plan de Medios) — PURO y client-safe (imports RELATIVOS, sin I/O).
// Portado de BIP (lib/pauta-pacing.ts, #130) y adaptado a las reglas de Drean.
// "¿Vamos a invertir lo que planificamos este mes?": inversión acumulada del mes vs la meta de
// Inversión del mes (plan "Pauta Mkt"), proyección a cierre con RANGO ESPERADO y desvío.
//
// Reglas (Drean):
//  · El mes se arma con `buildPautaMediosMensual` (MISMO gap-fill que el Tablero, el Seguimiento y las
//    señales; NO se duplica): Meta SIEMPRE por la API, OMD solo para medios sin API, DV360 USD→ARS con
//    el fx del mes, UGC incluido, Performance Max EXCLUIDO. Se le pide el mes en curso "como cerrado"
//    (currentMonth = mes+2) solo para leer el acumulado; las metas siguen usando meses cerrados.
//  · Medios con API (fuente "api": Meta, YouTube/Programmatic de DV360, Google Search/Demand Gen) +
//    Ecommerce (Google Ads inhouse, diario) → se PROYECTAN lineal a cierre por los días del dato.
//  · Medios sin API ya cargados por OMD este mes (OOH, TV…) → se toman como están: OMD los informa
//    por mes completo (ya "reservados"), no se extrapolan.
//  · Medios sin API que OMD todavía NO cargó este mes (TikTok, Mercado Ads, Geo, Streaming… llegan
//    con el reporte de cierre) → no se inventan: entran al RANGO con su promedio (central) y su
//    máximo (techo) de los últimos 3 meses cerrados. Piso = solo lo que ya hay.
//  · Estado con tolerancia ±10%: "sobre" si hasta el PISO supera el plan +10%; "sub" si hasta el
//    TECHO queda debajo del plan −10%; si no, en línea (el plan cae dentro del rango esperado).
//  · Días transcurridos = MOMENTO DEL DATO (hora de la última sync de Meta, hora AR), no "hoy".
//    Con menos de 5 días el ritmo es PRELIMINAR (se muestra, no alerta).
// Test: cd apps/web && npx tsx scripts/pauta-pacing.test.ts
// ============================================================================
import { buildPautaMediosMensual, PAUTA_MES_FULL, type PautaMediosInput } from "./pauta-medios-model";

const TZ_AR = "America/Argentina/Buenos_Aires";
export const PACING_TOLERANCIA = 10; // ±% alrededor del plan
export const PACING_DIAS_MIN = 5;    // antes de esto el ritmo es preliminar (no alerta)
const isPmax = (canal: string) => /pmax|performance ?max/i.test(canal);

export type PacingEstado = "en_linea" | "sobre" | "sub" | "sin_plan";
export type PacingTipo = "api" | "manual" | "pendiente";

export interface PacingMedio {
  medio: string;
  tipo: PacingTipo;           // api = se proyecta · manual = OMD ya cargado (como está) · pendiente = OMD todavía no cargó
  gastado: number;
  proyeccion: number;         // a cierre (pendiente = promedio 3 meses)
  referencia: number | null;  // promedio de los últimos 3 meses cerrados (con 0 en los meses sin inversión)
  maximo: number | null;      // máximo mensual de los últimos 3 meses cerrados
  desvioPct: number | null;   // proyección vs referencia
}

export interface PacingMes {
  anio: number;
  mesIdx: number;
  mes: string;                // "Septiembre"
  diasMes: number;
  diasTranscurridos: number;  // con decimales (hora del dato)
  fraccion: number;
  gastado: number;            // acumulado del mes: API + ecommerce + OMD ya cargado
  gastadoApi: number;         // parte que se proyecta (API + ecommerce)
  cargadoManual: number;      // OMD ya cargado (como está)
  rango: { piso: number; central: number; techo: number }; // proyección a cierre
  pendientes: string[];       // medios sin API que OMD todavía no cargó este mes
  plan: number | null;        // meta de Inversión del mes (plan "Pauta Mkt")
  planALaFecha: number | null;
  avancePct: number | null;   // gastado / plan
  desvioPct: number | null;   // central vs plan (o vs referencia si no hay plan)
  referencia: number | null;  // promedio de los últimos 3 meses cerrados (total)
  bgt: { version: string; valor: number } | null; // presupuesto vigente de la cuenta de pauta (referencia)
  base: "plan" | "historico" | null;
  estado: PacingEstado;
  preliminar: boolean;
  tolerancia: number;
  porMedio: PacingMedio[];
}

export interface PacingInput extends Omit<PautaMediosInput, "currentMonth"> {
  /** Momento del dato (última sync de Meta). */
  asOf: Date;
  /** "Hoy": si el dato es de un mes anterior (sync atrasada) no hay pacing del mes en curso. */
  now?: Date;
  /** 12 valores de la meta de Inversión (null = sin meta). */
  plan?: (number | null)[] | null;
  /** Presupuesto vigente por mes (BGT / 4+8 / 8+4) de la cuenta de pauta — solo referencia. */
  bgt?: { versiones: (string | null)[]; valores: (number | null)[] } | null;
  /** Medios digitales con dato diario que el modelo por medio no trae (Ecommerce) → se proyectan. */
  extra?: { medio: string; valores: (number | null)[] }[];
  tolerancia?: number;
}

/** Año, mes (0-11), día y hora decimal del instante en hora de Argentina. */
export function partesAR(d: Date): { anio: number; mes: number; dia: number; hora: number } {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ_AR, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const n = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return { anio: n("year"), mes: n("month") - 1, dia: n("day"), hora: n("hour") + n("minute") / 60 };
}
export const diasDelMes = (anio: number, mesIdx: number) => new Date(Date.UTC(anio, mesIdx + 1, 0)).getUTCDate();
const pct = (a: number, b: number | null) => (b != null && b > 0 ? ((a - b) / b) * 100 : null);
const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

function estadoDe(r: { piso: number; techo: number }, base: number | null, tol: number): PacingEstado {
  if (base == null) return "sin_plan";
  if (r.piso > base * (1 + tol / 100)) return "sobre";
  if (r.techo < base * (1 - tol / 100)) return "sub";
  return "en_linea";
}

export function computePacing(inp: PacingInput): PacingMes | null {
  const tol = inp.tolerancia ?? PACING_TOLERANCIA;
  const ar = partesAR(inp.asOf);
  if (ar.anio !== inp.anio) return null;
  if (inp.now) { const n = partesAR(inp.now); if (n.anio !== ar.anio || n.mes !== ar.mes) return null; }
  const mesIdx = ar.mes;
  const diasMes = diasDelMes(ar.anio, mesIdx);
  // Días de gasto contenidos en el dato: días completos previos + fracción del día del dato.
  const diasTranscurridos = Math.min(diasMes, Math.max(0.5, ar.dia - 1 + ar.hora / 24));
  const fraccion = diasTranscurridos / diasMes;

  const meses = buildPautaMediosMensual({
    pauta: inp.pauta, metaPaid: inp.metaPaid, dv360: inp.dv360, dv360Reach: inp.dv360Reach,
    googleAdsOmd: inp.googleAdsOmd.filter((r) => !isPmax(r.canal)), // PMax fuera de Pauta Mkt
    fxRates: inp.fxRates, anio: inp.anio, currentMonth: mesIdx + 2, // incluye el mes en curso (solo para leerlo)
  });
  const cur = meses[mesIdx] ?? null;
  const cerrados = [mesIdx - 3, mesIdx - 2, mesIdx - 1].filter((i) => i >= 0);
  const extraVal = (medio: string, i: number) => num(inp.extra?.find((e) => e.medio === medio)?.valores[i]) ?? 0;
  const invMedioMes = (medio: string, i: number) => (meses[i]?.medios[medio]?.inv ?? 0) + extraVal(medio, i);
  const invTotalMes = (i: number) => Object.values(meses[i]?.medios ?? {}).reduce((a, e) => a + e.inv, 0) + (inp.extra ?? []).reduce((a, e) => a + (num(e.valores[i]) ?? 0), 0);

  const planV = num(inp.plan?.[mesIdx]);
  const plan = planV ?? null;
  const porMedio: PacingMedio[] = [];
  const refDe = (medio: string) => {
    if (!cerrados.length) return { referencia: null as number | null, maximo: null as number | null };
    const vals = cerrados.map((i) => invMedioMes(medio, i));
    const s = vals.reduce((a, v) => a + v, 0);
    return { referencia: s > 0 ? s / cerrados.length : null, maximo: s > 0 ? Math.max(...vals) : null };
  };
  // 1) Medios presentes este mes.
  for (const [medio, e] of Object.entries(cur?.medios ?? {})) {
    if (!(e.inv > 0)) continue;
    const tipo: PacingTipo = e.fuente === "api" ? "api" : "manual";
    const proy = tipo === "api" ? e.inv / fraccion : e.inv;
    const r = refDe(medio);
    porMedio.push({ medio, tipo, gastado: e.inv, proyeccion: proy, ...r, desvioPct: pct(proy, r.referencia) });
  }
  // 2) Extra (Ecommerce): digital diario → se proyecta.
  for (const e of inp.extra ?? []) {
    const v = num(e.valores[mesIdx]);
    if (v == null) continue;
    const r = refDe(e.medio);
    porMedio.push({ medio: e.medio, tipo: "api", gastado: v, proyeccion: v / fraccion, ...r, desvioPct: pct(v / fraccion, r.referencia) });
  }
  // 3) Medios SIN API (OMD) con inversión en los últimos 3 meses cerrados que este mes todavía no se cargaron.
  const presentes = new Set(porMedio.map((m) => m.medio));
  const candidatos = new Set<string>();
  for (const i of cerrados) for (const [medio, e] of Object.entries(meses[i]?.medios ?? {})) if (e.fuente !== "api" && e.inv > 0) candidatos.add(medio);
  const pendientes: string[] = [];
  let pendCentral = 0, pendMax = 0;
  for (const medio of candidatos) {
    if (presentes.has(medio)) continue;
    const r = refDe(medio);
    if (r.referencia == null) continue;
    pendientes.push(medio);
    pendCentral += r.referencia; pendMax += r.maximo ?? r.referencia;
    porMedio.push({ medio, tipo: "pendiente", gastado: 0, proyeccion: r.referencia, ...r, desvioPct: null });
  }
  if (!porMedio.length && plan == null) return null;

  const gastadoApi = porMedio.filter((m) => m.tipo === "api").reduce((a, m) => a + m.gastado, 0);
  const cargadoManual = porMedio.filter((m) => m.tipo === "manual").reduce((a, m) => a + m.gastado, 0);
  const gastado = gastadoApi + cargadoManual;
  const piso = gastadoApi / fraccion + cargadoManual;
  const rango = { piso, central: piso + pendCentral, techo: piso + pendMax };

  const refTot = cerrados.map(invTotalMes).filter((v) => v > 0);
  const referencia = refTot.length ? refTot.reduce((a, v) => a + v, 0) / refTot.length : null;
  const base: PacingMes["base"] = plan != null ? "plan" : referencia != null ? "historico" : null;
  const baseVal = plan ?? referencia;
  // Plan a la fecha: lo manual ya cargado se "reserva" entero; el resto del plan se reparte lineal.
  const planALaFecha = plan != null ? Math.min(plan, cargadoManual) + Math.max(0, plan - cargadoManual) * fraccion : null;
  const bgtV = num(inp.bgt?.valores[mesIdx]);

  porMedio.sort((a, b) => ({ api: 0, manual: 1, pendiente: 2 }[a.tipo] - { api: 0, manual: 1, pendiente: 2 }[b.tipo]) || b.proyeccion - a.proyeccion);
  return {
    anio: ar.anio, mesIdx, mes: PAUTA_MES_FULL[mesIdx] ?? String(mesIdx + 1),
    diasMes, diasTranscurridos, fraccion,
    gastado, gastadoApi, cargadoManual, rango, pendientes,
    plan, planALaFecha,
    avancePct: plan != null ? (gastado / plan) * 100 : null,
    desvioPct: pct(rango.central, baseVal),
    referencia,
    bgt: bgtV != null && inp.bgt ? { version: inp.bgt.versiones[mesIdx] ?? "BGT", valor: bgtV } : null,
    base,
    estado: estadoDe(rango, baseVal, tol),
    preliminar: diasTranscurridos < PACING_DIAS_MIN,
    tolerancia: tol,
    porMedio,
  };
}

// ── BGT: versión vigente por mes (misma lógica de cuatrimestres que /funnel) ──
// T1 (ene-abr) = "BGT", T2 (may-ago) = "4+8", T3 (sep-dic) = "8+4"; si la versión del cuatrimestre
// todavía no está cargada, cae a la anterior (8+4 → 4+8 → BGT).
export const BGT_PAUTA_CUENTA = "PUBLICIDAD TV"; // concepto "PAUTA ATL" = presupuesto de medios
export function bgtVigentePorMes(rows: { presupuesto: string; mes: string; ars: number }[], anio: number): { versiones: (string | null)[]; valores: (number | null)[] } {
  const MESES_UP = PAUTA_MES_FULL.map((m) => m.toUpperCase());
  const by = new Map<string, number>();
  for (const r of rows) { const k = `${r.presupuesto}|${r.mes}`; by.set(k, (by.get(k) ?? 0) + (Number(r.ars) || 0)); }
  const has = (v: string) => rows.some((r) => r.presupuesto === v);
  const orden = (i: number) => (i < 4 ? ["BGT"] : i < 8 ? ["4+8", "BGT"] : ["8+4", "4+8", "BGT"]).map((v) => `${v} ${anio}`);
  const versiones: (string | null)[] = [], valores: (number | null)[] = [];
  MESES_UP.forEach((mes, i) => {
    const v = orden(i).find((x) => has(x) && by.has(`${x}|${mes}`)) ?? null;
    versiones.push(v); valores.push(v ? by.get(`${v}|${mes}`) ?? null : null);
  });
  return { versiones, valores };
}
