// Catálogo de producto Drean para el generador de contenido.
//
// Los packshots viven en el Drive de la agencia (Mabe), compartidos como
// "cualquiera con el link puede ver". Guardamos el fileId de Drive y armamos
// la URL pública de imagen que fal.ai puede leer directo (sin espejar).
//
// Este módulo NO es "server-only": lo importa tanto la página (para el filtro
// de modelo) como el endpoint (para la URL del packshot).

export type CategoriaProducto = "heladeras" | "cocinas" | "lavarropas";

export interface ModeloProducto {
  sku: string;
  nombre: string;
  tipo?: string;
  driveFileId: string; // packshot 1000x1000 en el Drive de la agencia
  medidas?: string; // alto × ancho × prof real (para la proporción en el prompt)
  descripcion?: string; // rasgos visuales (config de puertas, terminación) en inglés, para que Ideogram lo recree fiel
}

// URL pública de una imagen de Drive (archivo "anyone with link").
// lh3 es el CDN de Google para hotlink de imágenes públicas.
export function driveImageUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}=w1200`;
}

// Semilla inicial: un modelo hero por categoría (packshot real del Drive).
// Se amplía con los SKUs que se prioricen — misma estructura.
export const PRODUCTO_CATALOG: Record<CategoriaProducto, ModeloProducto[]> = {
  heladeras: [
    // DTP469LKRSS0 (12).jpg: front limpio sobre blanco (French Door). En el
    // 1000x1000 de NO FROST. (DSP610/DSP480 no tienen front limpio disponible.)
    // Medidas aprox (a confirmar con ficha): heladera ALTA, ~183cm alto.
    { sku: "DTP469LKRSS0", nombre: "Heladera No Frost DTP469 French Door Inox", tipo: "No Frost", driveFileId: "1TuXh7NCGdPaQyohu90qaA6wqNm9PfjCv", medidas: "approx 183 cm tall × 83 cm wide (a TALL floor-standing refrigerator)", descripcion: "a stainless-steel French-door refrigerator: TWO upper doors side by side plus a bottom freezer drawer (4 doors total), tall, with a small external control panel" },
  ],
  cocinas: [
    // Packshots limpios (front sobre blanco) — Alta / 1000x1000.
    { sku: "CD7609EI", nombre: "Cocina CD7609 76cm Inox", tipo: "Multigás", driveFileId: "1JLrqq0lQe0pUQdLMWXy_4op8fmduOKIJ", medidas: "approx 90 cm tall × 76 cm wide (counter-height freestanding range)", descripcion: "a wide stainless-steel freestanding gas range (76 cm), 5 burners on top, a black glass oven door, control knobs and a small digital display" },
    { sku: "CD5617AI0", nombre: "Cocina CD5617 56cm Inox", tipo: "Multigás", driveFileId: "1wekEuk7dqoIuTRMjqNI3LOEkYu8zfQbP", medidas: "approx 90 cm tall × 56 cm wide (counter-height freestanding range)", descripcion: "a compact stainless-steel freestanding gas range (56 cm), 4 burners on top, a black glass oven door and control knobs" },
  ],
  lavarropas: [
    // Lavasecarropas (carga frontal) — packshot limpio de la carpeta Alta.
    { sku: "LSCDR1208SG0", nombre: "Lavasecarropas LSCDR1208 12/8kg Grafito", tipo: "Lavaseca carga frontal", driveFileId: "1vQmkSwPx-I9HIoQJCBJbz68BoNKlB2xi", medidas: "approx 85 cm tall × 60 cm wide (counter-height front-load washer)", descripcion: "a graphite/dark-grey front-load washer-dryer with a large round chrome-rimmed glass door and a top control panel with a small display" },
  ],
};

export function getModelos(categoria: string): ModeloProducto[] {
  return PRODUCTO_CATALOG[categoria as CategoriaProducto] ?? [];
}

export function getModelo(sku: string | null | undefined): ModeloProducto | null {
  if (!sku) return null;
  for (const arr of Object.values(PRODUCTO_CATALOG)) {
    const m = arr.find((x) => x.sku === sku);
    if (m) return m;
  }
  return null;
}
