// Config por empresa (tenant) — FASE 0 de la arquitectura multi-empresa.
//
// Objetivo: consolidar en un solo lugar lo que hoy está hardcodeado y duplicado
// (marca propia, competidores, colores, categorías, dashboards habilitados).
// En Fase 0 vive en código con UNA entrada = Drean, y NO cambia ningún
// comportamiento: las constantes existentes pasan a derivarse de acá con los
// mismos valores. En Fase 1 esta config se mueve a una tabla del control plane
// y `getTenant()` la resuelve por empresa (subdominio/sesión).
//
// IMPORTANTE: este módulo NO importa "server-only" — tiene que poder usarse
// también desde componentes de cliente (mapas de color/label).

/** Identidad de una marca: clave estable usada en la data + label y color visibles. */
export interface BrandIdentity {
  /** Clave estable con la que aparece en la data (p. ej. el handle social). */
  key: string;
  /** Nombre visible. */
  label: string;
  /** Color institucional (hex). */
  color: string;
}

/** Cuenta social (marca propia o competidora) con su handle por red. */
export interface SocialAccount extends BrandIdentity {
  /** Handle de la cuenta (coincide con `key` cuando la data usa el handle). */
  handle: string;
}

/** Competidor para SEO/Search y competitivo (por categoría). */
export interface Competitor {
  nombre: string;
  slug: string;
  dominio?: string;
}

export interface TenantConfig {
  /** Slug del tenant, usado para routing/resolución (Fase 1). */
  id: string;
  /** Nombre visible de la empresa. */
  displayName: string;
  /** Marca propia. */
  ownBrand: BrandIdentity;
  /** Cuentas sociales: la propia + competidoras, con label y color. */
  socialAccounts: SocialAccount[];
  /** Categorías en las que compite la empresa (1..N). */
  categorias: string[];
  /** Dashboards habilitados (rutas del app). */
  dashboards: string[];
  /**
   * Competidores por categoría (SEO/Search y competitivo). Opcional en Fase 0;
   * hoy sigue viviendo en `competitive-config.ts` y se migra acá en Fase 1.
   */
  competidoresPorCategoria?: Record<string, Competitor[]>;
}

/**
 * Tenant Drean — valores tomados 1:1 de las constantes actuales
 * (`social-queries.ts`, `social-posts-queries.ts`, `competitive-config.ts`),
 * para que derivar de acá no cambie nada.
 */
export const DREAN: TenantConfig = {
  id: "drean",
  displayName: "Drean",
  ownBrand: { key: "dreanargentina", label: "Drean", color: "#dc2626" },
  socialAccounts: [
    { key: "dreanargentina", handle: "dreanargentina", label: "Drean", color: "#dc2626" },
    { key: "philco.arg", handle: "philco.arg", label: "Philco", color: "#f97316" },
    { key: "gafaargentina", handle: "gafaargentina", label: "Gafa", color: "#0ea5e9" },
    { key: "whirlpoolarg", handle: "whirlpoolarg", label: "Whirlpool", color: "#7c3aed" },
    { key: "electroluxar", handle: "electroluxar", label: "Electrolux", color: "#64748b" },
  ],
  categorias: ["lavarropas", "heladeras", "cocinas"],
  dashboards: [
    "/performance",
    "/performance-conversion",
    "/influencia",
    "/web",
    "/redes",
    "/seo-search",
  ],
};

/** Registro de tenants conocidos (Fase 0: solo Drean). */
export const TENANTS: Record<string, TenantConfig> = {
  [DREAN.id]: DREAN,
};
