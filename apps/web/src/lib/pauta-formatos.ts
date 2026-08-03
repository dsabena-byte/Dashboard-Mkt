// Formatos de imagen para adaptación de piezas de pauta. Ratios que el reframe
// generativo (outpainting) resuelve bien: 1:1, 4:5, 9:16, 1.91:1. Cubren Meta
// (imagen) y Demand Gen. Los banners/display (300x250, 728x90, etc.) y CTV se
// dejan afuera: son piezas de diseño, no un reframe.
export interface FormatoPauta {
  key: string;
  label: string;
  ratio: string;
  width: number;
  height: number;
  usos: string; // dónde se usa (para el usuario)
}

export const FORMATOS_IMG_PAUTA: FormatoPauta[] = [
  { key: "1x1", label: "Cuadrada 1:1", ratio: "1:1", width: 1080, height: 1080, usos: "Meta feed · Demand Gen" },
  { key: "4x5", label: "Vertical 4:5", ratio: "4:5", width: 1080, height: 1350, usos: "Meta feed · Demand Gen" },
  { key: "9x16", label: "Story / Reel 9:16", ratio: "9:16", width: 1080, height: 1920, usos: "Meta Stories/Reels · Demand Gen · TikTok" },
  { key: "1.91x1", label: "Horizontal 1.91:1", ratio: "1.91:1", width: 1200, height: 628, usos: "Meta horizontal · Demand Gen" },
];

// Formatos de VIDEO para reframe generativo (Luma Ray reframe en fal). El modelo
// extiende el encuadre a otro ratio sin deformar el foco. Ratios NATIVOS del modelo
// (enum: 3:4, 4:3, 1:1, 9:16, 16:9, 21:9). Elegimos los 3 que cubren la pauta:
//   - 9:16 → Meta Stories/Reels, TikTok, Demand Gen vertical
//   - 1:1  → Meta feed, Demand Gen
//   - 16:9 → YouTube/DV360, Mercado, HBO, EXTE, Demand Gen horizontal
// 4:5 y 1.91:1 quedan afuera: el reframe de Luma no los hace (necesitan crop).
export interface FormatoVideoPauta {
  key: string;
  label: string;
  aspectRatio: "9:16" | "1:1" | "16:9"; // valor que espera fal (aspect_ratio)
  usos: string;
}

export const FORMATOS_VIDEO_PAUTA: FormatoVideoPauta[] = [
  { key: "9x16", label: "Vertical 9:16", aspectRatio: "9:16", usos: "Meta Stories/Reels · TikTok · Demand Gen" },
  { key: "1x1", label: "Cuadrada 1:1", aspectRatio: "1:1", usos: "Meta feed · Demand Gen" },
  { key: "16x9", label: "Horizontal 16:9", aspectRatio: "16:9", usos: "YouTube/DV360 · Mercado · HBO · Demand Gen" },
];
