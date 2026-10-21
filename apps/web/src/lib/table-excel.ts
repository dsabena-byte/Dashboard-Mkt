// Helpers puros (client-safe) del botón "Excel" de las tablas (components/table-excel-export.tsx).

// Texto de celda en formato es-AR → número para Excel. "$ 235.832.840" → 235832840; "0.58%" / "11%" →
// 0.0058 / 0.11 con formato %; "1.8" (frecuencia, punto decimal) → 1.8; "—" / texto → null.
export function valorCelda(s: string): { n: number; z?: string } | null {
  let t = s.replace(/ /g, " ").trim();
  if (!t) return null;
  const pct = t.endsWith("%");
  t = t.replace(/^\$\s*|^USD\s*|%$|\s*x$/gi, "").replace(/\s/g, "");
  const neg = /^\(.*\)$/.test(t) || t.startsWith("-") || t.startsWith("−");
  t = t.replace(/^[(\-−+]|\)$/g, "");
  if (!/^\d[\d.,]*$/.test(t)) return null;
  let num: number;
  if (t.includes(",")) num = Number(t.replace(/\./g, "").replace(",", "."));          // es-AR: 1.234,5
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) num = Number(t.replace(/\./g, ""));           // 235.832.840
  else num = Number(t);                                                                  // 1.8 · 0.58 · 1234
  if (!Number.isFinite(num)) return null;
  if (neg) num = -num;
  return pct ? { n: num / 100, z: "0.0%" } : { n: num };
}

// Nombre del archivo: el último título (h1–h4 o rótulo de sección) que aparece ANTES de la tabla.
export function tituloDeTabla(t: Element): string {
  const cands = Array.from(t.ownerDocument.querySelectorAll("h1,h2,h3,h4,[data-table-title],.text-sm.font-medium"));
  let best = "";
  for (const h of cands) {
    if (h.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING) {
      const txt = (h.textContent ?? "").trim();
      if (txt) best = txt;
    }
  }
  return best || t.ownerDocument.title || "tabla";
}
