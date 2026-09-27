// ============================================================================
// EVOLUCIÓN POR KEYWORD desde `seo_keyword_rank` (migración 0028: el sync SEO escribe una foto
// semanal de la posición de cada dominio por keyword y hasta ahora nadie la leía). PURO y
// client-safe. Por keyword del dominio propio: posición al inicio y al final de la ventana,
// mejor posición, serie semanal, entradas/salidas del top-10 y ganadores/perdedores ponderados
// por volumen. Test: scripts/seo-avanzado.test.ts
// ============================================================================

export interface KwRankRow { fecha: string; categoria: string; keyword: string; dominio: string; marca: string | null; posicion: number | null; url: string | null; volumen: number | null }

/** Posición "ausente" para promediar/comparar (fuera del top relevado). */
export const KW_AUSENTE = 31;

export interface KwEvol {
  categoria: string; keyword: string; volumen: number;
  desde: string; hasta: string;
  posDesde: number | null; posHasta: number | null; mejor: number | null;
  /** positivo = mejoró (subió posiciones). Ausente cuenta como KW_AUSENTE. */
  delta: number;
  serie: { fecha: string; pos: number | null }[];
  estado: "entro_top10" | "salio_top10" | "gano" | "perdio" | "estable" | "nueva" | "perdida";
  url: string | null;
}
export interface KwEvolResumen {
  semanas: number; desde: string | null; hasta: string | null;
  keywords: KwEvol[];
  ganadoras: KwEvol[]; perdedoras: KwEvol[];
  entraronTop10: number; salieronTop10: number;
  /** Índice de visibilidad propio por fecha: Σ volumen×CTR aprox. (top-10) — tendencia, no clics. */
  visibilidad: { fecha: string; top3: number; top10: number; rankeadas: number }[];
}

const pos = (p: number | null) => (p == null ? KW_AUSENTE : Math.min(p, KW_AUSENTE));

/**
 * `rows` = filas del dominio propio (cualquier orden). `minDelta` = cambio mínimo de posiciones para
 * contarla como ganadora/perdedora (ruido semanal de la SERP).
 */
export function evolucionKeywords(rows: KwRankRow[] | null | undefined, opts: { minDelta?: number; top?: number } = {}): KwEvolResumen {
  const minDelta = opts.minDelta ?? 3, top = opts.top ?? 10;
  const rs = (rows ?? []).filter((r) => r.fecha && r.keyword);
  const fechas = [...new Set(rs.map((r) => r.fecha.slice(0, 10)))].sort();
  const vacio: KwEvolResumen = { semanas: fechas.length, desde: fechas[0] ?? null, hasta: fechas[fechas.length - 1] ?? null, keywords: [], ganadoras: [], perdedoras: [], entraronTop10: 0, salieronTop10: 0, visibilidad: [] };
  if (fechas.length < 2) return vacio;
  const by = new Map<string, KwRankRow[]>();
  for (const r of rs) { const k = `${r.categoria}\u0000${r.keyword}`; const a = by.get(k) ?? []; a.push(r); by.set(k, a); }
  const primera = fechas[0]!, ultima = fechas[fechas.length - 1]!;
  const keywords: KwEvol[] = [];
  for (const arr of by.values()) {
    const byF = new Map(arr.map((r) => [r.fecha.slice(0, 10), r]));
    const fs = [...byF.keys()].sort();
    const f0 = fs[0]!, fN = fs[fs.length - 1]!;
    const first = byF.get(f0)!, last = byF.get(fN)!;
    // Keyword que salió del universo antes de la última foto → no se sabe su posición actual.
    const vigente = fN === ultima;
    if (!vigente) continue;
    const pD = first.posicion, pH = last.posicion;
    const delta = pos(pD) - pos(pH);
    const nueva = f0 !== primera;
    const conPos = arr.map((r) => r.posicion).filter((x): x is number => x != null);
    const top10 = (p: number | null) => p != null && p <= 10;
    const estado: KwEvol["estado"] =
      !top10(pD) && top10(pH) && !nueva ? "entro_top10"
        : top10(pD) && !top10(pH) ? "salio_top10"
          : pD != null && pH == null ? "perdida"
            : nueva ? "nueva"
              : delta >= minDelta ? "gano" : delta <= -minDelta ? "perdio" : "estable";
    keywords.push({
      categoria: last.categoria, keyword: last.keyword, volumen: Number(last.volumen ?? first.volumen ?? 0),
      desde: f0, hasta: fN, posDesde: pD, posHasta: pH, mejor: conPos.length ? Math.min(...conPos) : null,
      delta, serie: fechas.map((f) => ({ fecha: f, pos: byF.get(f)?.posicion ?? null })), estado, url: last.url ?? null,
    });
  }
  const peso = (k: KwEvol) => Math.abs(k.delta) * Math.log10(10 + k.volumen);
  const ganadoras = keywords.filter((k) => k.delta >= minDelta || k.estado === "entro_top10").sort((a, b) => peso(b) - peso(a)).slice(0, top);
  const perdedoras = keywords.filter((k) => k.delta <= -minDelta || k.estado === "salio_top10" || k.estado === "perdida").sort((a, b) => peso(b) - peso(a)).slice(0, top);
  const visibilidad = fechas.map((f) => {
    const at = rs.filter((r) => r.fecha.slice(0, 10) === f);
    return { fecha: f, top3: at.filter((r) => r.posicion != null && r.posicion <= 3).length, top10: at.filter((r) => r.posicion != null && r.posicion <= 10).length, rankeadas: at.filter((r) => r.posicion != null).length };
  });
  return {
    semanas: fechas.length, desde: primera, hasta: ultima,
    keywords: keywords.sort((a, b) => b.volumen - a.volumen),
    ganadoras, perdedoras,
    entraronTop10: keywords.filter((k) => k.estado === "entro_top10").length,
    salieronTop10: keywords.filter((k) => k.estado === "salio_top10").length,
    visibilidad,
  };
}
