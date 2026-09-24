// Señales de la VISIÓN ESTRATÉGICA (Seguimiento de Objetivos). La palanca = el KPI cuya
// brecha, ponderada por su peso en cada objetivo y por el peso estratégico del objetivo, más
// resta a la Salud de Marca. Además: objetivos fuera de rumbo, cobertura baja, KPIs que se
// alejan de la meta, metas laxas y KPIs sin meta. Puro: recibe el rollup ya calculado.
import type { SeguimientoObjetivos } from "./model";
import { cumplimientoPct } from "./model";
import { type Signal, sortSignals, sum, fPct, r2 } from "./types";

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
    titulo: `${i === 0 ? "Mayor palanca" : "Palanca"}: llevar "${p.kpi}" a su meta suma +${p.puntosSalud.toFixed(1)} pts de Salud de Marca`,
    descripcion: `${p.kpi} (${p.plan}) cumple ${fPct(p.cumplYtd, 0)} YTD y pesa ${fPct(p.pesoGlobal, 1)} de la Salud de Marca vía ${p.objetivos.join(", ")}.`,
    acciones: [`Priorizar las acciones del plan ${p.plan} que mueven ${p.kpi}`, "Revisar en su tablero la causa de la brecha (costo, volumen o calidad)"],
    datos: { ...p },
    impacto: { metrica: "Puntos de Salud de Marca", valor: p.puntosSalud, unidad: "pts" },
  }));

  // ── 2. Objetivos fuera de rumbo (YTD < 80%) y cobertura baja ──
  for (const o of seg.objetivos) {
    if (o.cumplYtd != null && o.cumplYtd < 80) {
      const peor = [...o.aportes].filter((a) => a.cumpl != null).sort((a, b) => (100 - b.cumpl!) * b.peso - (100 - a.cumpl!) * a.peso)[0];
      S({
        key: `overview_objective_off_${o.id}`, tipo: "alerta", prioridad: o.cumplYtd < 60 ? "alta" : "media",
        titulo: `Objetivo "${o.nombre}" en ${fPct(o.cumplYtd, 0)} de cumplimiento YTD`,
        descripcion: `Peso estratégico ${fPct(o.pesoEstrategico, 0)}. Mes: ${o.cumplMes == null ? "s/d" : fPct(o.cumplMes, 0)}.${peor ? ` El KPI que más lo frena: ${peor.kpi} (${fPct(peor.cumpl!, 0)}, peso ${peor.peso}%).` : ""}`,
        acciones: peor ? [`Atacar primero ${peor.kpi}`, "Revisar si la meta del objetivo es realista con el presupuesto actual"] : ["Revisar los KPIs del objetivo"],
        datos: { objetivo: o.nombre, cumplYtd: r2(o.cumplYtd), cumplMes: o.cumplMes == null ? null : r2(o.cumplMes), aportes: o.aportes },
      });
    }
    if (o.cobertura < 60) S({
      key: `overview_objective_coverage_${o.id}`, tipo: "info", prioridad: "media",
      titulo: `"${o.nombre}" se mide solo con el ${fPct(o.cobertura, 0)} de su peso`,
      descripcion: `KPIs sin dato: ${o.aportes.filter((a) => a.cumpl == null).map((a) => a.kpi).join(", ") || "—"}. El cumplimiento puede estar sesgado.`,
      acciones: ["Conectar la fuente o cargar metas de los KPIs faltantes"],
      datos: { objetivo: o.nombre, cobertura: r2(o.cobertura) },
    });
  }

  // ── 3. KPIs: se alejan de la meta (3 meses seguidos de caída del cumplimiento), metas laxas, sin meta ──
  for (const k of seg.kpis) {
    const serie = k.realM.map((r, i) => (r != null && k.metaM[i] != null ? cumplimientoPct(r, k.metaM[i]!, k.direccion) : null));
    const pts = serie.map((v, i) => ({ v, i })).filter((x) => x.v != null) as { v: number; i: number }[];
    const last3 = pts.slice(-3) as [{ v: number; i: number }, { v: number; i: number }, { v: number; i: number }];
    if (last3.length === 3 && last3[0].v > last3[1].v && last3[1].v > last3[2].v && last3[2].v < 100 && last3[0].v - last3[2].v >= 10) S({
      key: `overview_kpi_diverging_${k.plan}_${k.kpi}`, tipo: "alerta", prioridad: "media",
      titulo: `"${k.kpi}" se aleja de la meta 3 meses seguidos (${last3.map((x) => `${MES[x.i]} ${fPct(x.v, 0)}`).join(" → ")})`,
      descripcion: `${k.plan}. La tendencia anticipa incumplimiento del cierre si no se corrige.`,
      acciones: [`Revisar en ${k.plan} qué cambió en esos meses (inversión, contenido, estacionalidad)`],
      datos: { kpi: k.kpi, plan: k.plan, cumplimiento: last3.map((x) => ({ mes: MES[x.i], cumpl: r2(x.v) })) },
    });
    const lastReal = [...k.realM].map((v, i) => ({ v, i })).filter((x) => x.v != null).pop();
    if (lastReal) {
      const meta = k.metaM[lastReal.i];
      if (meta == null) S({
        key: `overview_kpi_no_meta_${k.plan}_${k.kpi}`, tipo: "info", prioridad: "baja",
        titulo: `"${k.kpi}" tiene dato real en ${MES[lastReal.i]} pero no tiene meta cargada`,
        descripcion: `${k.plan}. Sin meta no suma al cumplimiento de los objetivos.`,
        acciones: ["Cargar la meta mensual en el tablero del plan"],
        datos: { kpi: k.kpi, plan: k.plan },
      });
      else {
        const c = cumplimientoPct(lastReal.v!, meta, k.direccion);
        const ytdOver = pts.length >= 3 && pts.slice(-3).every((x) => x.v >= 130);
        if (c != null && ytdOver) S({
          key: `overview_kpi_meta_lax_${k.plan}_${k.kpi}`, tipo: "info", prioridad: "baja",
          titulo: `"${k.kpi}" supera la meta ≥ 30% hace 3 meses — recalibrar`,
          descripcion: `${k.plan}: ${MES[lastReal.i]} al ${fPct(c, 0)} de la meta. O la meta quedó baja o hay sobre-inversión que podría ir a un KPI con brecha.`,
          acciones: ["Subir la meta o reasignar recursos a la mayor palanca"],
          datos: { kpi: k.kpi, plan: k.plan, cumplimiento: pts.slice(-3).map((x) => ({ mes: MES[x.i], cumpl: r2(x.v) })) },
        });
      }
    }
  }

  // ── 4. Salud de Marca: mes vs YTD ──
  const sm = seg.saludMarca;
  if (sm.cumplMes != null && sm.cumplYtd != null && Math.abs(sm.cumplMes - sm.cumplYtd) >= 10) S({
    key: "overview_salud_trend", tipo: sm.cumplMes < sm.cumplYtd ? "alerta" : "info", prioridad: sm.cumplMes < sm.cumplYtd ? "media" : "baja",
    titulo: `Salud de Marca: ${seg.refMes} ${fPct(sm.cumplMes, 0)} vs ${fPct(sm.cumplYtd, 0)} YTD`,
    descripcion: sm.cumplMes < sm.cumplYtd ? "El último mes rinde por debajo del acumulado: el año se está desacelerando." : "El último mes rinde por encima del acumulado: el plan está ganando tracción.",
    acciones: sm.cumplMes < sm.cumplYtd ? ["Atacar las palancas de mayor peso este mes"] : ["Sostener el mix actual"],
    datos: { cumplMes: r2(sm.cumplMes), cumplYtd: r2(sm.cumplYtd), refMes: seg.refMes },
  });

  return sortSignals(out);
}
