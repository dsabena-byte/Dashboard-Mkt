import "server-only";

// Lectura server-side de la config del Mapa Estratégico (tabla mapa_estrategico).
// Usa REST con la service key. Fallback: null si no existe / tabla vacía.

import type { Objetivo, Plan } from "./mapa-estrategico-config";

export interface MapaConfig {
  objetivos: Objetivo[];
  planes: Plan[];
}

export async function getMapaConfig(): Promise<MapaConfig | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(`${url}/rest/v1/mapa_estrategico?id=eq.1&select=objetivos,planes`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ objetivos: Objetivo[]; planes: Plan[] }>;
    const row = rows[0];
    if (!row || !Array.isArray(row.objetivos) || row.objetivos.length === 0) return null;
    return { objetivos: row.objetivos, planes: row.planes ?? [] };
  } catch {
    return null;
  }
}
