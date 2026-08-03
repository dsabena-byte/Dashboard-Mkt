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
