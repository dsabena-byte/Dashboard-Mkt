// ============================================================================
// Kantar por planilla (OPCIONAL) — núcleo PURO y client-safe.
// /salud-marca usa por defecto los valores Kantar fijos de lib/salud-marca-model.ts. Si se
// configura una planilla (Mis tableros → "Kantar por planilla"), sus valores se SUPERPONEN a
// esas constantes celda por celda (marca × ola × indicador; solo donde la planilla trae dato).
// Sin config → las constantes quedan intactas (mismos números que hoy).
// Parseo/mapeo de columnas = lib/research-core (copiado de BIP: detectMapping + parseSalud).
// Límite: solo olas del eje actual (nov-23…nov-25 + jun) — nov-26 es la ola PROYECTADA y olas
// nuevas requieren extender el eje en el código (se informan como "no aplicadas").
// ============================================================================
import { normTxt, parseSalud, sanitizeConfig, type Mapping, type SaludInd } from "./research-core";
import { SM_WAVES, type KVals } from "./salud-marca-model";

export const KANTAR_CFG_SLUG = "cfg-kantar";
export type CatKey = "lav" | "ref" | "coc";
export const CAT_LABEL: Record<CatKey, string> = { lav: "Lavado", ref: "Refrigeración", coc: "Cocción" };
/** Olas que la planilla puede pisar (las medidas). nov-26 = proyección del modelo, no se pisa. */
export const KANTAR_SHEET_WAVES: string[] = SM_WAVES.filter((w) => w !== "nov-26");

export interface KantarSheetConfig {
  datasetId: string;
  mapping: Mapping;
  /** categoría de la planilla → categoría de Drean ("" = ignorar). Sin columna categoría → "Total". */
  catMap: Record<string, CatKey | "">;
}

export type KantarTables = Record<CatKey, Record<string, Record<string, KVals>>>;
export interface KantarOverlayReport { celdas: number; filas: number; olasAplicadas: string[]; olasIgnoradas: string[]; catsIgnoradas: string[]; marcasNuevas: string[]; descartadas: number; motivos: string[] }

const IND_TO_K: Partial<Record<SaludInd, keyof KVals>> = { tom: "tom", som: "som", intencion: "int", poder: "poder", significancia: "sig", diferenciacion: "dif", saliencia: "sal" };

export function guessCat(s: string): CatKey | "" {
  const t = normTxt(s);
  if (/lav|lavarr|secarr/.test(t)) return "lav";
  if (/refri|helad|freez|frio/.test(t)) return "ref";
  if (/cocc|cocin|horno|anafe/.test(t)) return "coc";
  return "";
}

export function sanitizeKantarConfig(raw: unknown): KantarSheetConfig | null {
  const base = sanitizeConfig({ ...((raw as Record<string, unknown>) ?? {}), kind: "salud" });
  if (!base) return null;
  const cm: Record<string, CatKey | ""> = {};
  const rawCm = ((raw as Record<string, unknown>)?.catMap ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(rawCm).slice(0, 50)) cm[String(k).slice(0, 120)] = v === "lav" || v === "ref" || v === "coc" ? v : "";
  return { datasetId: base.datasetId, mapping: base.mapping, catMap: cm };
}

/** Superposición planilla → tablas Kantar por categoría (solo celdas con dato). */
export function buildKantarOverlay(columns: string[], rows: unknown[][], cfg: KantarSheetConfig, base: KantarTables): { overlay: KantarTables; report: KantarOverlayReport } {
  const p = parseSalud(columns, rows, cfg.mapping);
  const overlay: KantarTables = { lav: {}, ref: {}, coc: {} };
  const olaLabel = new Map(p.olas.map((o) => [o.key, o.label]));
  const olasAplicadas = new Set<string>(), olasIgnoradas = new Set<string>(), catsIgnoradas = new Set<string>(), marcasNuevas = new Set<string>();
  let celdas = 0, filas = 0;
  for (const r of p.rows) {
    const cat = (cfg.catMap[r.categoria] ?? guessCat(r.categoria)) || "";
    if (!cat) { catsIgnoradas.add(r.categoria); continue; }
    const label = (olaLabel.get(r.ola) ?? "").toLowerCase();
    if (!KANTAR_SHEET_WAVES.includes(label)) { olasIgnoradas.add(olaLabel.get(r.ola) ?? r.ola); continue; }
    // Marca: se usa el nombre de las constantes si coincide (Drean, Samsung…); si no, el de la planilla.
    const known = Object.keys(base[cat]).find((b) => normTxt(b) === normTxt(r.marca));
    const brand = known ?? r.marca;
    if (!known) marcasNuevas.add(`${r.marca} (${CAT_LABEL[cat]})`);
    const cell: Partial<KVals> = {};
    for (const [ind, v] of Object.entries(r.v) as [SaludInd, number][]) { const k = IND_TO_K[ind]; if (k && Number.isFinite(v)) { cell[k] = v; celdas++; } }
    if (!Object.keys(cell).length) continue;
    filas++;
    olasAplicadas.add(label);
    const byW = (overlay[cat][brand] ??= {});
    byW[label] = { ...(byW[label] ?? {}), ...cell } as KVals;
  }
  return { overlay, report: { celdas, filas, olasAplicadas: KANTAR_SHEET_WAVES.filter((w) => olasAplicadas.has(w)), olasIgnoradas: [...olasIgnoradas], catsIgnoradas: [...catsIgnoradas], marcasNuevas: [...marcasNuevas], descartadas: p.descartadas, motivos: p.motivos } };
}

const NK: KVals = { tom: null, som: null, int: null, poder: null, sig: null, dif: null, sal: null };

/** base + overlay: pisa solo las celdas que la planilla trae (no borra lo que no trae). */
export function mergeKantar(base: KantarTables, overlay: KantarTables): KantarTables {
  const out = {} as KantarTables;
  for (const cat of ["lav", "ref", "coc"] as CatKey[]) {
    const m: Record<string, Record<string, KVals>> = {};
    for (const [b, ws] of Object.entries(base[cat])) m[b] = { ...ws };
    for (const [b, ws] of Object.entries(overlay[cat])) {
      m[b] ??= {};
      for (const [w, v] of Object.entries(ws)) {
        const cur = m[b][w] ?? NK;
        const nv = { ...cur };
        for (const k of Object.keys(NK) as (keyof KVals)[]) if (v[k] != null) nv[k] = v[k];
        m[b][w] = nv;
      }
    }
    out[cat] = m;
  }
  return out;
}
