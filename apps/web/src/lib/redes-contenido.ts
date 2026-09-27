// Contenido PROPIO en redes: rendimiento por formato con posts MADUROS y mejor día × franja horaria
// controlando por formato. Portado del SaaS hermano (sep-2026). PURO y client-safe: lo usan /redes, las
// señales y los tests.
//
// Reglas de Drean (CLAUDE.md): IG por pieza SIN Stories (su interacción no se mide igual); IG maduro =
// 7+ días (alcance e interacciones lifetime que maduran la 1ª semana); FB SOLO posts con 60+ días (su
// reach lifetime madura ~50-60 días) y sin posts pautados (isPaidOutlier / split de la API).

const DAY = 86_400_000;
export const MADURACION_DIAS: Record<"IG" | "FB", number> = { IG: 7, FB: 60 };

/** Formato legible. meta_posts trae IG = FEED | REELS | STORY (media_product_type) y FB = photo | video | album | share… */
export function formatoDe(red: "IG" | "FB", mt: string | null | undefined): string {
  const m = (mt ?? "").toUpperCase();
  if (/STORY|STORIES/.test(m)) return "Stories";
  if (/REEL|VIDEO/.test(m)) return red === "IG" ? "Reels" : "Video";
  if (/CAROUSEL|ALBUM|SIDECAR/.test(m)) return "Carrusel";
  if (/FEED/.test(m)) return "Feed (imagen/carrusel)";
  if (/IMAGE|PHOTO/.test(m)) return "Imagen";
  if (red === "FB" && /LINK|SHARE/.test(m)) return "Link";
  if (red === "FB" && /STATUS/.test(m)) return "Texto";
  return m ? "Otro" : "Imagen";
}

export interface ContPost { red: "IG" | "FB"; id: string; ts: number; formato: string; reach: number; eng: number; saves: number; views: number }

/** Fila de meta_posts → post comparable. IG: interacciones = total_interactions (engagement). FB: reacciones + comentarios/compartidos + clicks (criterio del tablero). */
export function contPostFromRow(r: { platform: string; post_id: string; fecha_post: string; media_type: string | null; reach: number | null; engagement: number | null; reactions: number | null; clicks: number | null; video_views: number | null }): ContPost | null {
  const red = r.platform === "facebook" ? "FB" : r.platform === "instagram" ? "IG" : null;
  if (!red) return null;
  const formato = formatoDe(red, r.media_type);
  if (formato === "Stories") return null;
  const ts = Date.parse(r.fecha_post);
  if (!Number.isFinite(ts)) return null;
  const eng = red === "IG" ? (r.engagement ?? 0) : (r.reactions ?? 0) + (r.engagement ?? 0) + (r.clicks ?? 0);
  return { red, id: r.post_id, ts, formato, reach: r.reach ?? 0, eng, saves: red === "IG" ? (r.clicks ?? 0) : 0, views: r.video_views ?? 0 };
}

export const median = (xs: number[]): number => {
  const a = xs.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2;
};
const erOf = (p: ContPost) => (p.reach > 0 ? (p.eng / p.reach) * 100 : 0);
export const maduros = (ps: ContPost[], ref: Date) => ps.filter((p) => p.ts <= ref.getTime() - MADURACION_DIAS[p.red] * DAY);

// ── 1. Rendimiento por formato ───────────────────────────────────────────────
export interface FormatoRow {
  red: "IG" | "FB"; formato: string;
  /** Posts del formato en el período / maduros que entran en las medianas. */
  n: number; nMaduros: number;
  alcanceMed: number; erMed: number;
  /** guardados ÷ alcance, mediana (solo IG). */
  guardadosMed: number | null;
  viewsMed: number | null;
  /** 100 = mediana de la cuenta (misma red, posts maduros). */
  indiceEr: number | null; indiceAlcance: number | null;
  muestraChica: boolean;
}
export function formatBenchmarks(posts: ContPost[], ref: Date): FormatoRow[] {
  const rows: FormatoRow[] = [];
  for (const red of ["IG", "FB"] as const) {
    const all = posts.filter((p) => p.red === red);
    const mat = maduros(all, ref).filter((p) => p.reach > 0);
    if (!mat.length) continue;
    const accEr = median(mat.map(erOf)), accReach = median(mat.map((p) => p.reach));
    for (const formato of [...new Set(all.map((p) => p.formato))]) {
      const ps = all.filter((p) => p.formato === formato);
      const pm = mat.filter((p) => p.formato === formato);
      if (!pm.length) continue;
      const alcanceMed = median(pm.map((p) => p.reach)), erMed = median(pm.map(erOf));
      const vids = pm.filter((p) => p.views > 0);
      rows.push({
        red, formato, n: ps.length, nMaduros: pm.length, alcanceMed, erMed,
        guardadosMed: red === "IG" ? median(pm.map((p) => (p.saves / p.reach) * 100)) : null,
        viewsMed: vids.length ? median(vids.map((p) => p.views)) : null,
        indiceEr: accEr > 0 ? (erMed / accEr) * 100 : null,
        indiceAlcance: accReach > 0 ? (alcanceMed / accReach) * 100 : null,
        muestraChica: pm.length < 5,
      });
    }
  }
  return rows.sort((a, b) => (a.red === b.red ? b.nMaduros - a.nMaduros : a.red === "IG" ? -1 : 1));
}

// ── 2. Mejor día y franja (controlado por formato) ──────────────────────────
export const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const FRANJAS = [
  { key: "madrugada", label: "0–6 h", from: 0, to: 6 },
  { key: "manana", label: "6–12 h", from: 6, to: 12 },
  { key: "tarde", label: "12–18 h", from: 12, to: 18 },
  { key: "noche", label: "18–24 h", from: 18, to: 24 },
] as const;
/** Hora argentina (UTC−3 fijo): día 0 = lunes. */
export function slotDe(ts: number): { dia: number; franja: number } {
  const d = new Date(ts - 3 * 3600_000);
  const h = d.getUTCHours();
  return { dia: (d.getUTCDay() + 6) % 7, franja: FRANJAS.findIndex((f) => h >= f.from && h < f.to) };
}
export interface HeatCell { dia: number; franja: number; n: number; indice: number | null }
export interface BestTimes {
  n: number;
  cells: HeatCell[];
  porDia: { dia: number; n: number; indice: number | null }[];
  porFranja: { franja: number; n: number; indice: number | null }[];
  /** Celda con mejor índice y n ≥ MIN_CELDA (null si no hay base). */
  mejor: HeatCell | null;
  suficiente: boolean;
}
export const MIN_CELDA = 3;
export const MIN_TOTAL_HORARIO = 20;
/**
 * Índice por post = ER del post ÷ mediana de ER de su red y formato (100 = típico): así un día con
 * muchos Reels no "gana" solo por el formato. Índice de una celda = mediana de los índices × 100.
 */
export function bestTimes(posts: ContPost[], ref: Date): BestTimes {
  const mat = maduros(posts, ref).filter((p) => p.reach > 0);
  const medBy = new Map<string, number>();
  for (const k of new Set(mat.map((p) => `${p.red}|${p.formato}`))) medBy.set(k, median(mat.filter((p) => `${p.red}|${p.formato}` === k).map(erOf)));
  const scored = mat.map((p) => { const m = medBy.get(`${p.red}|${p.formato}`) ?? 0; return { ...slotDe(p.ts), s: m > 0 ? erOf(p) / m : null }; })
    .filter((x): x is { dia: number; franja: number; s: number } => x.s != null && x.franja >= 0);
  const idx = (xs: number[]) => (xs.length ? median(xs) * 100 : null);
  const cells: HeatCell[] = [];
  for (let dia = 0; dia < 7; dia++) for (let franja = 0; franja < FRANJAS.length; franja++) {
    const xs = scored.filter((x) => x.dia === dia && x.franja === franja).map((x) => x.s);
    cells.push({ dia, franja, n: xs.length, indice: idx(xs) });
  }
  const porDia = DIAS.map((_, dia) => { const xs = scored.filter((x) => x.dia === dia).map((x) => x.s); return { dia, n: xs.length, indice: idx(xs) }; });
  const porFranja = FRANJAS.map((_, franja) => { const xs = scored.filter((x) => x.franja === franja).map((x) => x.s); return { franja, n: xs.length, indice: idx(xs) }; });
  const cand = cells.filter((c) => c.n >= MIN_CELDA && c.indice != null).sort((a, b) => (b.indice! - a.indice!) || b.n - a.n);
  return { n: scored.length, cells, porDia, porFranja, mejor: cand[0] ?? null, suficiente: scored.length >= MIN_TOTAL_HORARIO };
}
