"use client";

import { usePathname } from "next/navigation";
import { DataChat } from "@/components/data-chat";

// Copiloto global: detecta el dashboard por la URL y monta <DataChat> con las
// sugerencias de ese dashboard. Solo aparece en dashboards habilitados (los que
// tienen tools en lib/chat/registry.ts). Un solo mount para todo el sitio.
const ENABLED: Record<string, string[]> = {
  redes: [
    "¿Cómo viene el alcance orgánico de Facebook este año?",
    "Graficá alcance vs engagement mensual de Facebook",
    "Mostrame los mejores 3 posts de los últimos 30 días",
  ],
  overview: [
    "¿Cómo venimos vs los objetivos de marketing?",
    "¿Cumple el Floor Share por categoría?",
    "Graficá el cumplimiento de CB mensual",
  ],
  "cuadros-basicos": [
    "¿Cuál es el % de cumplimiento CB actual?",
    "Graficá la evolución semanal de CB",
    "¿Qué tiendas convendría sumar al programa?",
  ],
  "floor-share": [
    "¿Cuál es el floor share de Drean por categoría?",
    "¿Cumplimos el objetivo en Cocción?",
    "Graficá el share por marca",
  ],
  web: [
    "¿Cómo vienen las sesiones y conversiones este mes?",
    "¿Cuál es el bounce rate y el conversion rate?",
    "Graficá los usuarios web por mes",
  ],
  "seo-search": [
    "¿Cuál es el Share of Search de Drean?",
    "¿Qué categoría tiene más demanda?",
    "Graficá el interés de trends por marca",
  ],
  performance: [
    "¿Cuánto invertimos en medios y en qué mix?",
    "¿Cómo viene el CTR vs plan?",
    "Graficá la inversión por medio",
  ],
  "performance-conversion": [
    "¿Cuál es el ROAS de la pauta?",
    "¿Cuánto es el CPA y el CPC?",
    "Graficá ingresos vs inversión por mes",
  ],
  influencia: [
    "¿Cuánto invertimos en influencers vs plan?",
    "¿Cuál es el CPM y el CTR de UGC?",
    "Graficá el alcance por mes",
  ],
  mercado: [
    "¿Cuál es el value share de Drean por categoría?",
    "¿Cómo venimos en índice de precio?",
    "Graficá el value share de las marcas",
  ],
  "salud-marca": [
    "¿Cuál es el puntaje de Salud de Marca de Drean?",
    "¿Cómo viene el Top of Mind por categoría?",
    "Graficá SM por categoría",
  ],
};

export function GlobalDataChat() {
  const pathname = usePathname();
  const seg = (pathname || "/").split("/").filter(Boolean)[0] ?? "";
  const suggestions = ENABLED[seg];
  if (!suggestions) return null;
  return <DataChat dashboard={seg} suggestions={suggestions} />;
}
