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
  heladeras: [
    { sku: "DSP610IORSS0", nombre: "Heladera No Frost DSP610 Inox", tipo: "No Frost", driveFileId: "1I6UHm6-ZUeLNodwDim3EBA2A7eiCY-7k" },
  ],
  cocinas: [
    { sku: "CD7609EI", nombre: "Cocina CD7609 76cm Inox", tipo: "Multigás", driveFileId: "1JLrqq0lQe0pUQdLMWXy_4op8fmduOKIJ" },
  ],
  lavarropas: [],
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
