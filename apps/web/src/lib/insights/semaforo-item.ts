// Semáforo de los ítems del Diagnóstico IA (evolución / metas): lee del texto la brecha vs meta
// ("Sep real X vs meta Y (+86% vs meta). YTD real … (+3%)") y la pasa a verde/amarillo/rojo con los
// umbrales por defecto de las metas (verde ≥100% de cumplimiento, amarillo ≥90%, rojo debajo).
// Puro / client-safe. Si el texto no trae la brecha, usa el `estado` que devolvió la IA.
import { SEMAFORO_COLOR, type Semaforo } from "@/lib/metas";
import type { InsItem } from "./types";

export interface BrechaItem { label: "Mes" | "YTD"; pct: number; semaforo: Semaforo }

/** KPIs donde menos es mejor (costo, posición, rebote): +X% vs meta es malo. */
const MENOS_ES_MEJOR = /\b(cpm|cpc|cpa|cpv|cpl|costo|índice de posición|indice de posicion|posición promedio|rebote)\b/i;

const UMBRAL_VERDE = 100;
const UMBRAL_AMARILLO = 90;

function semaforoDeBrecha(pct: number, menosEsMejor: boolean): Semaforo {
  const ratio = 1 + pct / 100;
  if (ratio <= 0 && menosEsMejor) return "verde";
  const cumpl = menosEsMejor ? 100 / ratio : ratio * 100;
  if (!Number.isFinite(cumpl)) return "sin-meta";
  return cumpl >= UMBRAL_VERDE ? "verde" : cumpl >= UMBRAL_AMARILLO ? "amarillo" : "rojo";
}

/** Brechas vs meta que trae el texto del ítem (la primera = mes, la que sigue a "YTD"/"acum." = YTD). */
export function brechasDeItem(it: Pick<InsItem, "titulo" | "evidencia">): BrechaItem[] {
  const txt = it.evidencia ?? "";
  if (!/meta/i.test(txt)) return [];
  const menos = MENOS_ES_MEJOR.test(`${it.titulo} ${txt}`);
  const out: BrechaItem[] = [];
  const re = /\(\s*([+\-−]?\d+(?:[.,]\d+)?)\s*%[^)]*\)/g;
  let prevEnd = 0;
  for (let m = re.exec(txt); m; m = re.exec(txt)) {
    const antes = txt.slice(prevEnd, m.index);
    prevEnd = m.index + m[0].length;
    const pct = Number(m[1]!.replace("−", "-").replace(",", "."));
    if (!Number.isFinite(pct)) continue;
    const label: BrechaItem["label"] = /ytd|acum/i.test(antes) ? "YTD" : "Mes";
    if (out.some((b) => b.label === label)) continue;
    out.push({ label, pct, semaforo: semaforoDeBrecha(pct, menos) });
  }
  return out;
}

const ESTADO_IA: Record<NonNullable<InsItem["estado"]>, Semaforo> = { bueno: "verde", regular: "amarillo", malo: "rojo" };

/** Estado general del ítem: el del mes si hay brecha; si no, el YTD; si no, lo que dijo la IA. */
export function semaforoDeItem(it: InsItem): Semaforo {
  const b = brechasDeItem(it);
  const mes = b.find((x) => x.label === "Mes") ?? b[0];
  if (mes) return mes.semaforo;
  return it.estado ? ESTADO_IA[it.estado] : "sin-meta";
}

export const SEMAFORO_TEXTO: Record<Semaforo, string> = { verde: "Bien", amarillo: "Atención", rojo: "Mal", "sin-meta": "Sin meta" };
export { SEMAFORO_COLOR };
