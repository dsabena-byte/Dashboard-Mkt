// Señal `gasto_diario_anomalo` (Plan de Medios): un medio con API gasta mucho más rápido de lo normal
// (se "come" el presupuesto del mes en pocos días, un día pico, o campañas de pocos días que se llevaron
// la mayor parte del mes). PURO — entrada = resultado de lib/pauta-diaria (evaluarPautaDiaria), lo mismo
// que muestra Eficiencia Medios → "Inversión diaria por medio".
// Prioridad: urgente → alta (entra al aviso diario de /alerts, que solo manda lo NUEVO de prioridad alta);
// revisar → media. Keys estables por medio + mes (ritmo) o + día (pico) para que el aviso no se repita.
import type { Signal } from "./types";
import { fARS, fFecha, type PautaDiariaResultado } from "@/lib/pauta-diaria";

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesLabel = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(0, 4)}`;

const ACCIONES = [
  "Pedile hoy a la agencia que revise el presupuesto diario y las fechas de las campañas de ese medio (que no esté cargado como total en un día, ni con fecha de fin equivocada)",
  "Si el gasto no estaba planeado, que la agencia baje el tope diario o pause la campaña hasta corregirla",
  "Mañana mirá de nuevo el gráfico de inversión diaria para confirmar que volvió a su ritmo normal",
];

export function gastoDiarioSignals(r: PautaDiariaResultado | null | undefined): Signal[] {
  if (!r) return [];
  const out: Signal[] = [];
  for (const m of r.medios) {
    if (m.estado !== "urgente" && m.estado !== "revisar") continue;
    const alta = m.estado === "urgente";
    const pico = m.picosRecientes[m.picosRecientes.length - 1];
    const porRitmo = m.pctRef != null && m.ritmo != null && m.motivos.length > m.picosRecientes.length;
    // Keys por medio + mes (una ráfaga de mitad de mes aparte): el aviso diario de /alerts no se repite cada día.
    const key = m.rafaga && !m.rafaga.inicioMes ? `gasto_diario_anomalo_${slug(m.medio)}_${m.mes}_rafaga`
      : porRitmo ? `gasto_diario_anomalo_${slug(m.medio)}_${m.mes}` : `gasto_diario_anomalo_${slug(m.medio)}_${pico?.fecha ?? m.mes}`;
    const titulo = porRitmo
      ? (m.rafaga
        ? (m.rafaga.inicioMes
          ? `${m.medio}: en ${m.rafaga.dias} ${m.rafaga.dias === 1 ? "día" : "días"} ya se gastó el ${Math.round(m.rafaga.pct)}% de lo que gasta en un mes normal`
          : `${m.medio}: en los últimos ${m.rafaga.dias} días se gastó el ${Math.round(m.rafaga.pct)}% de lo que gasta en un mes normal`)
        : `${m.medio} está gastando ${(m.ritmo ?? 0).toFixed(1).replace(".", ",")} veces más rápido de lo normal este mes`)
      : `${m.medio}: el ${fFecha(pico!.fecha)} gastó ${fARS(pico!.gasto)}, ${pico!.veces.toFixed(1).replace(".", ",")} veces un día normal`;
    out.push({
      key, dash: "performance", tipo: "alerta", prioridad: alta ? "alta" : "media", metrica: "inversion",
      titulo,
      descripcion: `${m.motivos.join(" ")} ${m.fuente === "mensual" ? `(${m.medio} informa el gasto por mes: se compara lo que va del mes, al ${m.ultimoDia ? fFecha(m.ultimoDia) : "último dato"}, contra un mes normal.) ` : ""}Un mes normal = la mediana de ${m.refMeses.map(mesLabel).join(", ") || "los últimos meses"}${m.refAjustadaPlan ? ", llevada a la escala del plan de Inversión de este mes" : ""}. Puede ser algo planeado (un lanzamiento) o una campaña mal configurada que se está gastando el presupuesto antes de tiempo.`.trim(),
      acciones: ACCIONES,
      datos: { medio: m.medio, fuente: m.fuente, mes: m.mes, dia: m.diaDelMes, gastadoMes: Math.round(m.acumMes), mesNormal: m.referenciaMes != null ? Math.round(m.referenciaMes) : null, pctMesNormal: m.pctRef != null ? Math.round(m.pctRef) : null, ritmo: m.ritmo != null ? Math.round(m.ritmo * 100) / 100 : null, picos: m.picosRecientes.map((p) => ({ fecha: p.fecha, gasto: Math.round(p.gasto), diaNormal: Math.round(p.mediana) })) },
      impacto: m.esperado != null ? { metrica: "Gasto por encima de lo normal a la fecha", valor: Math.round(Math.max(0, m.acumMes - m.esperado)), unidad: "ARS" } : undefined,
    });
  }
  // Concentración por campaña (dato mensual): solo el mes en curso (alta si urgente) y el último cerrado (media).
  const mesAct = r.hoy.slice(0, 7);
  const cerrados = r.concentracion.filter((c) => c.mes < mesAct).map((c) => c.mes).sort();
  const ultimoCerrado = cerrados[cerrados.length - 1];
  for (const c of r.concentracion) {
    if (c.estado === "ok" || (c.mes !== mesAct && c.mes !== ultimoCerrado)) continue;
    const enCurso = c.mes === mesAct;
    out.push({
      key: `gasto_diario_anomalo_concentrado_${slug(c.medio)}_${c.mes}`, dash: "performance", tipo: "alerta",
      prioridad: enCurso && c.estado === "urgente" ? "alta" : "media", metrica: "inversion",
      titulo: `${c.medio} ${mesLabel(c.mes)}: el ${Math.round(c.pct)}% del gasto del mes se fue en campañas que duraron ${c.diasMax} ${c.diasMax === 1 ? "día" : "días"} o menos`,
      descripcion: `${c.motivo} Campañas: ${c.campanias.slice(0, 4).map((x) => `"${x.campania}" ${fARS(x.gasto)} en ${x.dias} ${x.dias === 1 ? "día" : "días"}`).join("; ")}. Si no era a propósito, es la firma de una pauta mal configurada (presupuesto total cargado como diario, o fechas equivocadas).`,
      acciones: enCurso ? ACCIONES : ["Preguntale a la agencia si esas campañas cortas estaban planeadas así o fue un error de configuración", "Si fue un error, pedile que lo compense en el plan del mes siguiente y que avise antes de subir campañas de pocos días"],
      datos: { medio: c.medio, mes: c.mes, gastoMes: Math.round(c.totalMes), gastoCampaniasCortas: Math.round(c.gastoRapido), pct: Math.round(c.pct), campanias: c.campanias.slice(0, 6).map((x) => ({ ...x, gasto: Math.round(x.gasto) })) },
      impacto: { metrica: "Gasto en campañas de pocos días", valor: Math.round(c.gastoRapido), unidad: "ARS" },
    });
  }
  return out;
}
