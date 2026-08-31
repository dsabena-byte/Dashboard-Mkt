// Catálogo de Planes (dashboards ya armados) y sus KPIs (indicadores que la
// plataforma ya recolecta). El Mapa Estratégico solo permite AGREGAR planes y
// KPIs desde acá — no se inventan a mano. La configuración existente del usuario
// (nombres + pesos) se preserva; el catálogo solo alimenta el selector de "agregar".
//
// Los nombres de plan coinciden con los del seed del mapa, para que un plan ya
// cargado matchee su catálogo por nombre y ofrezca sus KPIs faltantes.

export interface CatPlan {
  nombre: string;
  href: string; // dashboard de origen
  kpis: string[]; // indicadores disponibles
}

export const CATALOGO_PLANES: CatPlan[] = [
  {
    nombre: "Pauta en Medios",
    href: "/performance",
    kpis: ["Alcance / Cobertura", "VTR (view-through)", "Share of Voice", "Impresiones", "Frecuencia", "CPM", "Inversión"],
  },
  {
    nombre: "Pauta Ecommerce",
    href: "/performance-conversion",
    kpis: ["ROAS", "Conversiones", "CPA", "Ingresos", "Inversión"],
  },
  {
    nombre: "Redes Sociales",
    href: "/redes",
    kpis: ["Alcance orgánico", "Engagement rate", "Sentiment", "Seguidores", "Interacciones"],
  },
  {
    nombre: "Mkt de Influencia",
    href: "/influencia",
    kpis: ["Alcance de creadores", "Afinidad / Engagement", "Menciones / EMV", "Piezas publicadas"],
  },
  {
    nombre: "Mkt de Canal",
    href: "/mkt-canal",
    kpis: ["Acciones ejecutadas", "Inversión en canal", "Sell-in"],
  },
  {
    nombre: "Web / Ecommerce",
    href: "/web",
    kpis: ["Tráfico web (usuarios)", "Sesiones", "Tasa de conversión", "Ingresos ecommerce", "Pageviews"],
  },
  {
    nombre: "SEO / Search",
    href: "/seo-search",
    kpis: ["Share of Search", "Tráfico orgánico", "Posición media", "Visibilidad SEO"],
  },
  {
    nombre: "Trade (CB · Floor · Canal)",
    href: "/cuadros-basicos",
    kpis: ["% Cumplimiento CB", "Infaltables", "Estratégicos", "Floor Share (exhibición)", "Sell-out en PDV"],
  },
];
