// Paleta y helpers de marcas para Floor Share. Sin "use client" para que
// pueda importarse desde server components (la page) y client components
// (los charts) sin que Next.js lo trate como un proxy de cliente.

export const BRAND_COLORS_FS: Record<string, string> = {
  Drean: "#2b4dff",
  Whirlpool: "#fb923c",
  Electrolux: "#22c55e",
  Philco: "#ec4899",
  Gafa: "#a78bfa",
  Samsung: "#1428a0",
  LG: "#a50034",
  Mabe: "#dc2626",
  Patrick: "#0ea5e9",
  Bgh: "#facc15",
  BGH: "#facc15",
  Otros: "#94a3b8",
};

export function colorForBrand(name: string): string {
  return BRAND_COLORS_FS[name] ?? "#64748b";
}
