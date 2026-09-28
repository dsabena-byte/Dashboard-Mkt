// Señales de la VISIÓN ESTRATÉGICA (Seguimiento de Objetivos). La palanca = el KPI cuya
// brecha, ponderada por su peso en cada objetivo y por el peso estratégico del objetivo, más
// resta a la Salud de Marca. Además: objetivos fuera de rumbo, cobertura baja, KPIs que se
// alejan de la meta, metas laxas y KPIs sin meta. Puro: recibe el rollup ya calculado.
import type { SeguimientoObjetivos } from "./model";
import { cumplimientoPct } from "./model";
import { type Signal, sortSignals, sum, fPct, fNum, r2 } from "./types";
import { pronosticoMeta } from "../stats/meta";
import { histParaPronostico } from "../objetivos-pronostico";

const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export interface Palanca { kpi: string; plan: string; cumplYtd: number; brecha: number; pesoGlobal: number; puntosSalud: number; objetivos: string[] }

// Peso efectivo de cada KPI sobre la Salud de Marca y los puntos que sumaría llegar al 100%.
export function palancas(seg: SeguimientoObjetivos): Palanca[] {
  const byKpi = new Map<string, Palanca>();
  const planOf = new Map(seg.kpis.map((k) => [k.kpi, k.plan]));
  const totPeso = sum(seg.objetivos.map((o) => o.pesoEstrategico)) || 1;
  for (const o of seg.objetivos) {
    const conDato = o.aportes.filter((a) => a.cumpl != null);
    const sw = sum(conDato.map((a) => a.peso));
    if (!sw) continue;
    for (const a of conDato) {
      const w = (o.pesoEstrategico / totPeso) * (a.peso / sw);
      const p = byKpi.get(a.kpi) ?? { kpi: a.kpi, plan: planOf.get(a.kpi) ?? "", cumplYtd: a.cumpl!, brecha: 100 - a.cumpl!, pesoGlobal: 0, puntosSalud: 0, objetivos: [] };
      p.pesoGlobal += w * 100;
      p.puntosSalud += w * (100 - a.cumpl!);
      p.objetivos.push(o.nombre);
      byKpi.set(a.kpi, p);
    }
  }
  return [...byKpi.values()].map((p) => ({ ...p, pesoGlobal: r2(p.pesoGlobal), puntosSalud: r2(p.puntosSalud), cumplYtd: r2(p.cumplYtd), brecha: r2(p.brecha) })).sort((a, b) => b.puntosSalud - a.puntosSalud);
}

export function computeOverviewSignals(seg: SeguimientoObjetivos | null | undefined): Signal[] {
  const out: Signal[] = [];
  if (!seg?.disponible) return out;
  const S = (s: Omit<Signal, "dash">) => out.push({ ...s, dash: "overview" });

  // ── 1. Palancas: KPIs que más puntos de Salud de Marca liberan si llegan a la meta ──
  const pal = palancas(seg).filter((p) => p.puntosSalud >= 1);
  pal.slice(0, 3).forEach((p, i) => S({
    key: `overview_lever_${p.kpi}`, tipo: "oportunidad", prioridad: i === 0 || p.puntosSalud >= 5 ? "alta" : "media",
    titulo: `${i === 0 ? "Lo que más suma" : "También suma"}: si "${p.kpi}" llega a su meta, la Salud de Marca sube +${p.puntosSalud.toFixed(1)} puntos`,
    descripcion: `${p.kpi} (${p.plan}) va al ${fPct(p.cumplYtd, 0)} de su meta en lo que va del año y explica el ${fPct(p.pesoGlobal, 1)} de la Salud de Marca, a través de ${p.objetivos.join(", ")}.`,
    acciones: [`Poné primero las acciones de ${p.plan} que mueven "${p.kpi}"`, "En su tablero, fijate por qué no llega: si es por costo, por volumen o por calidad"],
    datos: { ...p },
    impacto: { metrica: "Puntos de Salud de Marca", valor: p.puntosSalud, unidad: "pts" },
  }));

  // ── 2. Objetivos fuera de rumbo (YTD < 80%) y cobertura baja ──
  for (const o of seg.objetivos) {
    if (o.cumplYtd != null && o.cumplYtd < 80) {
      const peor = [...o.aportes].filter((a) => a.cumpl != null).sort((a, b) => (100 - b.cumpl!) * b.peso - (100 - a.cumpl!) * a.peso)[0];
      S({
        key: `overview_objective_off_${o.id}`, tipo: "alerta", prioridad: o.cumplYtd < 60 ? "alta" : "media",
        titulo: `El objetivo "${o.nombre}" va al ${fPct(o.cumplYtd, 0)} de lo planeado en lo que va del año`,
        descripcion: `Este objetivo pesa el ${fPct(o.pesoEstrategico, 0)} de la estrategia. Último mes: ${o.cumplMes == null ? "sin dato" : fPct(o.cumplMes, 0)}.${peor ? ` El indicador que más lo frena: ${peor.kpi} (va al ${fPct(peor.cumpl!, 0)}; pesa ${peor.peso}% en este objetivo).` : ""}`,
        acciones: peor ? [`Arrancá por "${peor.kpi}"`, "Revisá si la meta del objetivo se puede cumplir con el presupuesto que hay"] : ["Revisá los indicadores (KPIs) del objetivo"],
        datos: { objetivo: o.nombre, cumplYtd: r2(o.cumplYtd), cumplMes: o.cumplMes == null ? null : r2(o.cumplMes), aportes: o.aportes },
      });
    }
    if (o.cobertura < 60) S({
      key: `overview_objective_coverage_${o.id}`, tipo: "info", prioridad: "media",
      titulo: `"${o.nombre}" se está midiendo con solo el ${fPct(o.cobertura, 0)} de sus indicadores`,
      descripcion: `Indicadores sin dato: ${o.aportes.filter((a) => a.cumpl == null).map((a) => a.kpi).join(", ") || "—"}. El % de cumplimiento puede no reflejar la realidad.`,
      acciones: ["Cargá las metas de esos indicadores (o pedí que se conecte la fuente de datos que falta)"],
      datos: { objetivo: o.nombre, cobertura: r2(o.cobertura) },
    });
  }

  // ── 3. KPIs: se alejan de la meta (3 meses seguidos de caída del cumplimiento), metas laxas, sin meta ──
  for (const k of seg.kpis) {
    const serie = k.realM.map((r, i) => (r != null && k.metaM[i] != null ? cumplimientoPct(r, k.metaM[i]!, k.direccion) : null));
    const pts = serie.map((v, i) => ({ v, i })).filter((x) => x.v != null) as { v: number; i: number }[];
    const last3 = pts.slice(-3) as [{ v: number; i: number }, { v: number; i: number }, { v: number; i: number }];
    // Pace to goal (lib/stats, portado de BIP): con pronóstico confiable, la señal es la PROBABILIDAD
    // de llegar a la meta anual (reemplaza a "se aleja 3 meses", que solo mira la dirección).
    const pr = k.metaM.some((v) => v != null) ? pronosticoMeta({ realM: k.realM, metaM: k.metaM, histM: histParaPronostico(k.histM), tipo: k.tipo, direccion: k.direccion, seed: `${k.plan}|${k.kpi}` }).resumen : null;
    const conPace = !!pr && pr.suficiente && !pr.cerrado && pr.probabilidad != null;
    if (pr && conPace && pr.probabilidad! < 0.3 && pr.mensual.length >= 3 && pr.cierre && pr.metaAnual != null) {
      const u = (v: number) => (k.unit === "%" ? fPct(v, 2) : k.unit === "$" ? `$${fNum(v)}` : k.unit === "x" ? `${v.toFixed(2)}x` : k.unit === "s" ? `${Math.round(v)}s` : fNum(v));
      const c = pr.cierre, nec = pr.necesarioVsRitmoPct;
      S({
        key: `overview_kpi_off_pace_${k.plan}_${k.kpi}`, tipo: "alerta", prioridad: pr.probabilidad! < 0.1 ? "alta" : "media",
        titulo: `"${k.kpi}": ${Math.round(pr.probabilidad! * 100)}% de probabilidad de llegar a la meta del año`,
        descripcion: `${k.plan}. Si sigue así, el año ${k.tipo === "sum" ? "cierra" : "promedia"} en ${u(c.p50)}${c.p10 != null && c.p90 != null ? ` (entre ${u(c.p10)} y ${u(c.p90)})` : ""} contra una meta de ${u(pr.metaAnual)}.${nec != null && Number.isFinite(nec) && k.direccion === "up" && nec > 0 ? ` Para llegar hace falta +${nec.toFixed(0)}% sobre el ritmo proyectado de los ${pr.mensual.length} meses que quedan.` : ""} Cómo se calculó: ${pr.metodoTexto}, con ${pr.n} meses de datos.`,
        acciones: [`En ${k.plan}, identificá qué mueve "${k.kpi}": más inversión, otro contenido o mejor conversión`, "Si con el presupuesto actual la meta ya no se puede cumplir, ajustala y avisale al equipo"],
        datos: { kpi: k.kpi, plan: k.plan, probabilidad: r2(pr.probabilidad!), cierreP50: r2(c.p50), rango: c.p10 != null && c.p90 != null ? [r2(c.p10), r2(c.p90)] : null, metaAnual: r2(pr.metaAnual), metodo: pr.metodo, meses: pr.n },
      });
    }
    if (!conPace && last3.length === 3 && last3[0].v > last3[1].v && last3[1].v > last3[2].v && last3[2].v < 100 && last3[0].v - last3[2].v >= 10) S({
      key: `overview_kpi_diverging_${k.plan}_${k.kpi}`, tipo: "alerta", prioridad: "media",
      titulo: `"${k.kpi}" se aleja de la meta hace 3 meses seguidos (${last3.map((x) => `${MES[x.i]} ${fPct(x.v, 0)}`).join(" → ")})`,
      descripcion: `${k.plan}. Si no se corrige, lo más probable es no llegar a la meta del año.`,
      acciones: [`En ${k.plan}, fijate qué cambió en esos meses: la inversión, el contenido o la época del año`],
      datos: { kpi: k.kpi, plan: k.plan, cumplimiento: last3.map((x) => ({ mes: MES[x.i], cumpl: r2(x.v) })) },
    });
    const lastReal = [...k.realM].map((v, i) => ({ v, i })).filter((x) => x.v != null).pop();
    if (lastReal) {
      const meta = k.metaM[lastReal.i];
      if (meta == null) S({
        key: `overview_kpi_no_meta_${k.plan}_${k.kpi}`, tipo: "info", prioridad: "baja",
        titulo: `"${k.kpi}" tiene dato de ${MES[lastReal.i]} pero no tiene meta cargada`,
        descripcion: `${k.plan}. Sin meta, no cuenta para el cumplimiento de los objetivos.`,
        acciones: ["Cargá la meta mensual en el tablero de ese plan (botón de metas, arriba del tablero)"],
        datos: { kpi: k.kpi, plan: k.plan },
      });
      else {
        const c = cumplimientoPct(lastReal.v!, meta, k.direccion);
        const ytdOver = pts.length >= 3 && pts.slice(-3).every((x) => x.v >= 130);
        if (c != null && ytdOver) S({
          key: `overview_kpi_meta_lax_${k.plan}_${k.kpi}`, tipo: "info", prioridad: "baja",
          titulo: `"${k.kpi}" supera la meta en 30% o más hace 3 meses: conviene revisar la meta`,
          descripcion: `${k.plan}: ${MES[lastReal.i]} al ${fPct(c, 0)} de la meta. O la meta quedó baja, o se está poniendo más de lo necesario acá y esos recursos podrían ir a un indicador que no llega.`,
          acciones: ["Subí la meta, o reasigná recursos al indicador que más suma a la Salud de Marca"],
          datos: { kpi: k.kpi, plan: k.plan, cumplimiento: pts.slice(-3).map((x) => ({ mes: MES[x.i], cumpl: r2(x.v) })) },
        });
      }
    }
  }

  // ── 4. Salud de Marca: mes vs YTD ──
  const sm = seg.saludMarca;
  if (sm.cumplMes != null && sm.cumplYtd != null && Math.abs(sm.cumplMes - sm.cumplYtd) >= 10) S({
    key: "overview_salud_trend", tipo: sm.cumplMes < sm.cumplYtd ? "alerta" : "info", prioridad: sm.cumplMes < sm.cumplYtd ? "media" : "baja",
    titulo: `Salud de Marca: ${seg.refMes} al ${fPct(sm.cumplMes, 0)} contra ${fPct(sm.cumplYtd, 0)} en lo que va del año`,
    descripcion: sm.cumplMes < sm.cumplYtd ? "El último mes vino peor que el promedio del año: se está frenando." : "El último mes vino mejor que el promedio del año: el plan está tomando impulso.",
    acciones: sm.cumplMes < sm.cumplYtd ? ["Este mes, poné foco en los indicadores que más suman (los de \"Lo que más suma\")"] : ["Mantené la mezcla actual de acciones"],
    datos: { cumplMes: r2(sm.cumplMes), cumplYtd: r2(sm.cumplYtd), refMes: seg.refMes },
  });

  return sortSignals(out);
}
