// Engagement en % con decimales según la escala: FB orgánico da valores reales de 0,00x% (interacciones
// sobre seguidores de Páginas de millones) que con 2 decimales se veían como "0.00%" (sep-2026).
export function fmtEng(v: number | null | undefined): string {
  const n = v ?? 0;
  if (n === 0) return "0%";
  const a = Math.abs(n);
  return `${n.toFixed(a >= 0.1 ? 2 : a >= 0.001 ? 3 : 4)}%`;
}
