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
}

// URL pública de una imagen de Drive (archivo "anyone with link").
// lh3 es el CDN de Google para hotlink de imágenes públicas.
export function driveImageUrl(fileId: string): string {
  return `https://lh3.googleusercontent.com/d/${fileId}=w1200`;
}

// Semilla inicial: un modelo hero por categoría (packshot real del Drive).
// Se amplía con los SKUs que se prioricen — misma estructura.
export const PRODUCTO_CATALOG: Record<CategoriaProducto, ModeloProducto[]> = {
  // heladeras: los flagships (DSP472/DSP480/DSP610/DTP469) no tienen carpeta
  // "Alta" con packshot limpio (sus 1000x1000 son interiores/detalle). Pendiente
  // de que se indique el packshot limpio de cada uno.
  heladeras: [],
  cocinas: [
    // Packshots limpios (front sobre blanco) — Alta / 1000x1000.
    { sku: "CD7609EI", nombre: "Cocina CD7609 76cm Inox", tipo: "Multigás", driveFileId: "1JLrqq0lQe0pUQdLMWXy_4op8fmduOKIJ" },
    { sku: "CD5617AI0", nombre: "Cocina CD5617 56cm Inox", tipo: "Multigás", driveFileId: "1wekEuk7dqoIuTRMjqNI3LOEkYu8zfQbP" },
  ],
  lavarropas: [
    // Lavasecarropas (carga frontal) — packshot limpio de la carpeta Alta.
    { sku: "LSCDR1208SG0", nombre: "Lavasecarropas LSCDR1208 12/8kg Grafito", tipo: "Lavaseca carga frontal", driveFileId: "1vQmkSwPx-I9HIoQJCBJbz68BoNKlB2xi" },
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
