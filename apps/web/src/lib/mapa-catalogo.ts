// Catálogo de Planes (dashboards ya armados) y sus KPIs (indicadores que la
// plataforma ya recolecta). Los nombres coinciden EXACTAMENTE con el menú de
// "Planes de Acción" del sidebar (de ahí vienen). Los planes que en el menú
// tienen sub-planes (Plan de Medios, Trade Mkt) se ofrecen agrupados por `grupo`,
// así al agregar se elige el sub-plan (Pauta Mkt, Cuadros Básicos, etc.).
//
// El Mapa solo permite AGREGAR desde acá — no se inventan a mano. La config
// existente del usuario (nombres + pesos) se preserva; el catálogo solo alimenta
// el selector de "agregar".

export interface CatPlan {
  nombre: string; // idéntico al ítem del menú
  href: string; // dashboard de origen
  grupo?: string; // agrupador del menú (Plan de Medios / Trade Mkt) si es sub-plan
  kpis: string[]; // indicadores disponibles
}

export const CATALOGO_PLANES: CatPlan[] = [
  // Plan de Medios (agrupador → sub-planes)
  {
    nombre: "Pauta Mkt",
    href: "/performance",
    grupo: "Plan de Medios",
    kpis: ["Alcance / Cobertura", "VTR (view-through)", "Share of Voice", "Impresiones", "Frecuencia", "CPM", "Inversión"],
  },
  {
    nombre: "Pauta Ecommerce",
    href: "/performance-conversion",
    grupo: "Plan de Medios",
    kpis: ["ROAS", "Conversiones", "CPA", "Ingresos", "Inversión"],
  },
  // Planes directos
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
    nombre: "Mkt Canal Comercial",
    href: "/mkt-canal",
    kpis: ["Acciones ejecutadas", "Inversión en canal", "Sell-in"],
  },
  {
    nombre: "Web / Ecommerce",
    href: "/web",
    kpis: ["Tráfico web (usuarios)", "Sesiones", "Tasa de conversión", "Ingresos ecommerce", "Pageviews"],
  },
  {
    nombre: "Optimización SEO",
    href: "/seo-search",
    kpis: ["Share of Search", "Tráfico orgánico", "Posición media", "Visibilidad SEO"],
  },
  {
    nombre: "Resultados Comerciales",
    href: "/mercado",
    kpis: [
      "Value Share · High", "Value Share · Mid", "Value Share · Low", "Value Share · Total",
      "Unit Share · High", "Unit Share · Mid", "Unit Share · Low", "Unit Share · Total",
      "Índice de precio · High", "Índice de precio · Mid", "Índice de precio · Low", "Índice de precio · General",
    ],
  },
  // Trade Mkt (agrupador → sub-planes)
  {
    nombre: "Cuadros Básicos",
    href: "/cuadros-basicos",
    grupo: "Trade Mkt",
    kpis: ["% Cumplimiento CB", "Infaltables", "Estratégicos"],
  },
  {
    nombre: "Floor Share",
    href: "/floor-share",
    grupo: "Trade Mkt",
    kpis: ["Floor Share Lavado", "Floor Share Refrigeración", "Floor Share Cocción", "Floor Share (exhibición)"],
  },
];
