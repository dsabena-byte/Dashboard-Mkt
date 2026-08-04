// Costos ESTIMADOS por operación de IA (fal.ai), en USD. Fuente única de verdad:
// actualizá estos números si cambian los precios de fal. Última revisión: ago-2026.
//
// Referencia (fal.ai pricing):
//  - Imagen producto/packshot: fal-ai/nano-banana/edit ......... US$0.039 / imagen
//  - Imagen genérica/creativa: fal-ai/ideogram/v3 (balanced) ... US$0.06  / imagen
//  - Retoque:                  fal-ai/flux-pro/kontext .......... US$0.04  / imagen
//  - Video Kling:              kling 2.1 master (5s) ............ US$1.40  (1ros 5s; +0.28/s)
//  - Video Veo:                veo3 image-to-video (~8s) ........ ~US$3.20 (US$0.40/s c/audio)
//  - Video UGC Seedance:       seedance 2.0 fast (~10s) ......... ~US$2.42 (US$0.242/s)
export const COSTOS_IA = {
  imagenProducto: 0.039,
  imagenCreativa: 0.06,
  retoque: 0.04,
  videoKling: 1.40,
  videoVeo: 3.20,
  videoSeedance: 2.42,
} as const;

// Formato compacto en dólares (ej. "US$0.04", "US$1.40").
export function fmtUSD(n: number): string {
  return `US$${n.toFixed(2)}`;
}
