// Mkt Canal: validación de las filas de `mkt_canal_acciones` que arma la IA al leer un reporte de un retailer
// (puro, client-safe). La misma función valida lo que devuelve la IA y lo que el usuario confirma en la vista previa.

export const PLATAFORMAS = ["Meta", "Google", "YouTube", "TikTok", "Email", "On-site", "Evidencia"] as const;
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const NUMS = ["impresiones", "clics", "sesiones", "conversiones", "ingresos", "entregados", "aperturas", "inversion"] as const;

export interface FilaCanal {
  cliente: string;
  accion: string;
  mes: string; // YYYY-MM
  periodo: string; // "Mayo 2026"
  plataforma: string;
  impresiones: number;
  clics: number;
  sesiones: number | null;
  conversiones: number | null;
  ingresos: number | null;
  entregados: number | null;
  aperturas: number | null;
  inversion: number | null;
  evidencia_url: string | null;
}

/** "1.234.567" / "1,234,567" / "$ 12.500,50" / 1234 → número; vacío o basura → null. */
export function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v !== "string") return null;
  let s = v.replace(/[^\d.,-]/g, "");
  if (!s || s.startsWith("-")) return null;
  const lastC = s.lastIndexOf(","), lastP = s.lastIndexOf(".");
  // decimal = el último separador si lo siguen 1-2 dígitos; el resto son miles
  const dec = Math.max(lastC, lastP);
  if (dec >= 0 && s.length - dec - 1 <= 2 && s.length - dec - 1 > 0) s = s.slice(0, dec).replace(/[.,]/g, "") + "." + s.slice(dec + 1);
  else s = s.replace(/[.,]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const plataformaDe = (p: unknown) => {
  const s = String(p ?? "").trim().toLowerCase();
  if (/meta|facebook|instagram/.test(s)) return "Meta";
  if (/youtube/.test(s)) return "YouTube";
  if (/google|search|pmax|display/.test(s)) return "Google";
  if (/tiktok/.test(s)) return "TikTok";
  if (/mail|newsletter/.test(s)) return "Email";
  if (/on.?site|banner|home|web|sitio/.test(s)) return "On-site";
  if (/evidencia/.test(s)) return "Evidencia";
  return null;
};

/** Valida y normaliza. Devuelve las filas válidas y un error legible por cada fila descartada.
 *  `parcial` (vista previa): una fila con números pero sin cliente/acción/mes/plataforma NO se descarta: vuelve con el
 *  campo vacío para que el usuario lo complete (el guardado vuelve a validar sin `parcial`). */
export function sanearFilas(raw: unknown, parcial = false, hoy = new Date()): { filas: FilaCanal[]; errores: string[] } {
  const anio = hoy.getFullYear();
  const filas: FilaCanal[] = [];
  const errores: string[] = [];
  const arr = Array.isArray(raw) ? raw.slice(0, 200) : [];
  const vistas = new Set<string>();
  arr.forEach((r, i) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const cliente = String(o.cliente ?? "").trim().slice(0, 60);
    const accion = String(o.accion ?? "").trim().slice(0, 120);
    const mes = String(o.mes ?? "").trim().slice(0, 7);
    const plataforma = plataformaDe(o.plataforma);
    // Año fuera de [año anterior, año siguiente] = casi seguro mal leído (pasó: reportes sin año → 2023).
    const m0 = /^(20\d\d)-(0[1-9]|1[0-2])$/.exec(mes);
    const m = m0 && Math.abs(Number(m0[1]) - anio) <= 1 ? m0 : null;
    const completa = !!(cliente && accion && m && plataforma);
    if (!completa) {
      errores.push(`Fila ${i + 1}: ${parcial ? "completá" : "falta"} ${!cliente ? "el cliente" : !accion ? "la acción" : !m ? (m0 ? `el año (${m0[1]} parece mal leído)` : "el mes (AAAA-MM)") : "una plataforma válida"}.`);
      if (!parcial) return;
    }
    const k = `${cliente}|${accion}|${mes}|${plataforma}`;
    if (completa && vistas.has(k)) { errores.push(`Fila ${i + 1}: repite ${accion} · ${mes} · ${plataforma} (dejá una sola).`); return; }
    vistas.add(k);
    const n = Object.fromEntries(NUMS.map((k) => [k, num(o[k])])) as Record<(typeof NUMS)[number], number | null>;
    const url = String(o.evidencia_url ?? "").trim();
    filas.push({
      cliente, accion, mes: m ? mes : "", plataforma: plataforma ?? "",
      periodo: m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : "",
      ...n,
      impresiones: Math.round(n.impresiones ?? 0),
      clics: Math.round(n.clics ?? 0),
      evidencia_url: /^https:\/\//.test(url) ? url.slice(0, 500) : null,
    });
  });
  return { filas, errores };
}

export const claveFila = (f: Pick<FilaCanal, "cliente" | "accion" | "mes" | "plataforma">) => `${f.cliente}|${f.accion}|${f.mes}|${f.plataforma}`;

/** Lo que trae el reporte pisa lo guardado; lo que el reporte no trae (null) conserva lo anterior. */
export function mergeConAnterior(nueva: FilaCanal, antes: Partial<FilaCanal> | undefined): FilaCanal {
  if (!antes) return nueva;
  const out = { ...nueva };
  for (const k of ["sesiones", "conversiones", "ingresos", "entregados", "aperturas", "inversion", "evidencia_url"] as const) {
    if (out[k] == null && antes[k] != null) (out as Record<string, unknown>)[k] = antes[k];
  }
  return out;
}
