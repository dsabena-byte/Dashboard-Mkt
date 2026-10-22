// Plan anual de Mkt Canal (pestaña "Plan anual" de /mkt-canal): inversión en publicidad de cada cliente (retailer) y en
// eventos (grupos de compra y otros), mes a mes, en $. Puro y client-safe; se guarda en plan_medios_anual.config.canal.
const N = 12;

export interface LineaCanal { nombre: string; valores: number[] }
export interface CanalConfig { clientes: LineaCanal[]; eventos: LineaCanal[] }

/** Eventos identificados por el equipo (orden del user). Se pueden agregar más líneas. */
export const EVENTOS_BASE = [
  "Red Acero", "Red Interior", "Red Integrados", "Red Futura Oct", "Cetrogar", "Casa FOA Rosario", "Casa FOA Bs As", "Para Ti",
  "Deli&Wine", "Premios Deco", "Premios Puro Diseño", "Otros eventos", "Armados eventos grupo compra", "Armados otros eventos",
];

const linea = (nombre: string): LineaCanal => ({ nombre, valores: Array(N).fill(0) });
export function canalDefault(clientes: string[] = []): CanalConfig {
  return { clientes: clientes.map(linea), eventos: EVENTOS_BASE.map(linea) };
}

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1e13, Math.max(0, n)) : 0; };
const lineas = (v: unknown): LineaCanal[] => (Array.isArray(v) ? v : []).slice(0, 80).map((l0) => {
  const l = (l0 ?? {}) as Partial<LineaCanal>;
  return { nombre: String(l.nombre ?? "").trim().slice(0, 60), valores: Array.from({ length: N }, (_, i) => num(Array.isArray(l.valores) ? l.valores[i] : 0)) };
}).filter((l) => l.nombre);
export function sanearCanal(raw: unknown): CanalConfig {
  if (!raw || typeof raw !== "object") return canalDefault();
  const r = raw as Partial<CanalConfig>;
  return { clientes: lineas(r.clientes), eventos: lineas(r.eventos) };
}

export const totalMes = (ls: LineaCanal[]) => Array.from({ length: N }, (_, i) => ls.reduce((t, l) => t + (l.valores[i] ?? 0), 0));
export const totalLinea = (l: LineaCanal) => l.valores.reduce((t, v) => t + v, 0);

const MES3 = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
/** Aplanado para el historial de cambios (difPlan). */
export function canalPlano(c: CanalConfig): Record<string, number> {
  const o: Record<string, number> = {};
  for (const [tipo, ls] of [["Cliente", c.clientes], ["Evento", c.eventos]] as const)
    for (const l of ls) l.valores.forEach((v, i) => { o[`Mkt Canal · ${tipo} ${l.nombre} ${MES3[i]}`] = v; });
  return o;
}
