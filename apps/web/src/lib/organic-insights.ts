import "server-only";

// =============================================================================
// Análisis automático de orgánico Drean (IG + FB)
// -----------------------------------------------------------------------------
// Compara últimos 30 días vs los 30 días previos y emite "señales":
//   alerta      → bajó algo importante > 30%
//   atención    → bajó entre 15% y 30%
//   oportunidad → mejoró > 20%, vale doble down
//   info        → contexto neutro
//
// Cada señal devuelve un { signal_key, prioridad, tipo, titulo, descripcion,
// acciones, datos }. El cron upsertea por signal_key en insights_log.
// =============================================================================

export interface MetaPostMin {
  platform: string;             // 'instagram' | 'facebook'
  post_id: string;
  fecha_post: string;           // timestamptz string
  permalink: string | null;
  message: string | null;
  media_type: string | null;
  reach: number;
  engagement: number;
  reactions: number;
  video_views: number;
}

export interface Insight {
  signal_key: string;
  prioridad: "alta" | "media" | "baja";
  tipo: "alerta" | "oportunidad" | "info";
  titulo: string;
  descripcion: string;
  acciones: string[];
  datos: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Helpers

function classifyMediaType(platform: string, media_type: string | null): "feed" | "reel" | "story" | "other" {
  const m = (media_type ?? "").toLowerCase();
  if (platform === "instagram") {
    if (m === "story") return "story";
    if (m === "reels" || m === "reel" || m === "video") return "reel";
    if (m === "feed" || m === "image" || m === "carousel_album" || m === "sidecar") return "feed";
    return "other";
  }
  if (platform === "facebook") {
    if (m === "story") return "story";
    if (m === "video" || m === "reel" || m === "reels") return "reel";
    if (m === "photo" || m === "album" || m === "status" || m === "link") return "feed";
    return "other";
  }
  return "other";
}

interface Bucket {
  posts: number;
  reach_sum: number;
  eng_sum: number;
  reactions_sum: number;
  reach_per_post: number;
  eng_per_post: number;
  eng_rate: number;             // eng_sum / reach_sum
}

function emptyBucket(): Bucket {
  return { posts: 0, reach_sum: 0, eng_sum: 0, reactions_sum: 0, reach_per_post: 0, eng_per_post: 0, eng_rate: 0 };
}

function aggregate(posts: MetaPostMin[]): Map<string, Bucket> {
  // Key: "platform|kind" — ej. "instagram|reel"
  const map = new Map<string, Bucket>();
  for (const p of posts) {
    const kind = classifyMediaType(p.platform, p.media_type);
    if (kind === "other") continue;
    const key = `${p.platform}|${kind}`;
    const acc = map.get(key) ?? emptyBucket();
    acc.posts += 1;
    acc.reach_sum += p.reach ?? 0;
    acc.eng_sum += p.engagement ?? 0;
    acc.reactions_sum += p.reactions ?? 0;
    map.set(key, acc);
  }
  for (const b of map.values()) {
    b.reach_per_post = b.posts > 0 ? b.reach_sum / b.posts : 0;
    b.eng_per_post = b.posts > 0 ? b.eng_sum / b.posts : 0;
    b.eng_rate = b.reach_sum > 0 ? (b.eng_sum / b.reach_sum) * 100 : 0;
  }
  return map;
}

function pct(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / prev) * 100;
}

function fmtPct(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(0)}%`;
}

const PLATFORM_LABEL: Record<string, string> = { instagram: "Instagram", facebook: "Facebook" };
const KIND_LABEL: Record<string, string> = { feed: "Feed", reel: "Reels", story: "Stories" };

// -----------------------------------------------------------------------------
// Reglas

function ruleReachDropPerPost(platform: string, kind: string, curr: Bucket, prev: Bucket): Insight | null {
  if (curr.posts < 3 || prev.posts < 3) return null;
  const delta = pct(curr.reach_per_post, prev.reach_per_post);
  if (delta >= -15) return null;
  const prioridad = delta < -30 ? "alta" : "media";
  const tipo = "alerta" as const;
  const pl = PLATFORM_LABEL[platform] ?? platform;
  const k = KIND_LABEL[kind] ?? kind;
  return {
    signal_key: `${platform}_${kind}_reach_per_post_drop`,
    prioridad,
    tipo,
    titulo: `${pl} ${k}: alcance por pieza cayó ${fmtPct(delta)} vs 30d previos`,
    descripcion: `En los últimos 30 días publicaste ${curr.posts} ${k.toLowerCase()} con ${Math.round(curr.reach_per_post).toLocaleString()} alcance promedio, vs ${prev.posts} con ${Math.round(prev.reach_per_post).toLocaleString()} en los 30d previos.`,
    acciones: [
      `Revisar formato/hook de los top ${k.toLowerCase()} de los 30d previos y replicar`,
      `Validar si bajó la frecuencia óptima de publicación`,
      `Chequear si el contenido cambió de tipo (educacional vs branding vs promo)`,
    ],
    datos: { curr, prev, delta_pct: delta },
  };
}

function ruleEngagementRateDrop(platform: string, kind: string, curr: Bucket, prev: Bucket): Insight | null {
  if (curr.reach_sum < 1000 || prev.reach_sum < 1000) return null;
  const delta = pct(curr.eng_rate, prev.eng_rate);
  if (delta >= -15) return null;
  const prioridad = delta < -30 ? "alta" : "media";
  const pl = PLATFORM_LABEL[platform] ?? platform;
  const k = KIND_LABEL[kind] ?? kind;
  return {
    signal_key: `${platform}_${kind}_eng_rate_drop`,
    prioridad,
    tipo: "alerta",
    titulo: `${pl} ${k}: engagement rate cayó ${fmtPct(delta)} vs 30d previos`,
    descripcion: `Engagement rate del último período: ${curr.eng_rate.toFixed(2)}% (vs ${prev.eng_rate.toFixed(2)}% en los 30d previos). El alcance se traduce en menos interacciones por persona.`,
    acciones: [
      "Pedir más CTAs en copy (preguntas, polls, swipe-up)",
      "Validar si los hooks de los primeros 3 segundos están funcionando",
      "Revisar comentarios — ¿la audiencia entiende el mensaje?",
    ],
    datos: { curr, prev, delta_pct: delta },
  };
}

function ruleReachOpportunity(platform: string, kind: string, curr: Bucket, prev: Bucket): Insight | null {
  if (curr.posts < 3 || prev.posts < 3) return null;
  const delta = pct(curr.reach_per_post, prev.reach_per_post);
  if (delta < 25) return null;
  const pl = PLATFORM_LABEL[platform] ?? platform;
  const k = KIND_LABEL[kind] ?? kind;
  return {
    signal_key: `${platform}_${kind}_reach_opportunity`,
    prioridad: delta > 50 ? "alta" : "media",
    tipo: "oportunidad",
    titulo: `${pl} ${k}: alcance por pieza mejoró ${fmtPct(delta)}`,
    descripcion: `${curr.posts} piezas en los últimos 30d generaron ${Math.round(curr.reach_per_post).toLocaleString()} alcance promedio (vs ${Math.round(prev.reach_per_post).toLocaleString()} previo). Doblá la apuesta en este formato.`,
    acciones: [
      `Aumentar frecuencia de ${k.toLowerCase()} en ${pl} próxima semana`,
      "Analizar qué tienen en común los top performers (tema, duración, hook)",
      "Considerar invertir paid amplificando los top 1-2 reels",
    ],
    datos: { curr, prev, delta_pct: delta },
  };
}

function ruleVolumeChange(platform: string, kind: string, curr: Bucket, prev: Bucket): Insight | null {
  if (curr.posts < 3 && prev.posts < 3) return null;
  const delta = pct(curr.posts, prev.posts);
  if (Math.abs(delta) < 50) return null;
  const tipo: "info" = "info";
  const pl = PLATFORM_LABEL[platform] ?? platform;
  const k = KIND_LABEL[kind] ?? kind;
  return {
    signal_key: `${platform}_${kind}_volume_change`,
    prioridad: "baja",
    tipo,
    titulo: `${pl} ${k}: volumen ${delta > 0 ? "subió" : "bajó"} ${fmtPct(delta)} (${prev.posts} → ${curr.posts} posts)`,
    descripcion: delta > 0
      ? `Estás publicando ${delta.toFixed(0)}% más. Si el reach per-post no acompaña, podés estar saturando audiencia.`
      : `Estás publicando ${Math.abs(delta).toFixed(0)}% menos. Confirmá si es estrategia o pérdida de cadencia.`,
    acciones: delta > 0
      ? ["Comparar reach per-post antes/después del aumento", "Validar si engagement rate se mantuvo"]
      : ["Confirmar si la baja de frecuencia fue intencional", "Mirar reach per-post — quizás compensa el menor volumen"],
    datos: { curr_posts: curr.posts, prev_posts: prev.posts, delta_pct: delta },
  };
}

function ruleTopPost(period: MetaPostMin[]): Insight | null {
  // El post con mayor engagement rate (filtra los que tienen reach >= 500 para evitar outliers de stories)
  const candidates = period
    .filter((p) => p.reach >= 500 && p.engagement > 0)
    .map((p) => ({ post: p, rate: p.reach > 0 ? (p.engagement / p.reach) * 100 : 0 }))
    .sort((a, b) => b.rate - a.rate);
  if (candidates.length === 0) return null;
  const top = candidates[0]!;
  return {
    signal_key: "top_post_30d",
    prioridad: "media",
    tipo: "info",
    titulo: `Top post 30d: ${top.rate.toFixed(2)}% engagement rate en ${PLATFORM_LABEL[top.post.platform] ?? top.post.platform}`,
    descripcion: `"${(top.post.message ?? "").slice(0, 120)}${(top.post.message?.length ?? 0) > 120 ? "..." : ""}" — ${top.post.reach.toLocaleString()} alcance, ${top.post.engagement.toLocaleString()} engagement.`,
    acciones: [
      "Estudiar formato y tema — ¿se puede replicar el próximo mes?",
      "Mirar si el horario/día fue clave",
      "Considerar amplificar con paid si encaja con campaña actual",
    ],
    datos: { permalink: top.post.permalink, reach: top.post.reach, engagement: top.post.engagement, rate: top.rate },
  };
}

function ruleBottomPost(period: MetaPostMin[]): Insight | null {
  // El post con peor performance entre los que tuvieron reach significativo
  const candidates = period
    .filter((p) => p.reach >= 1000)
    .map((p) => ({ post: p, rate: p.reach > 0 ? (p.engagement / p.reach) * 100 : 0 }))
    .sort((a, b) => a.rate - b.rate);
  if (candidates.length === 0) return null;
  const bottom = candidates[0]!;
  return {
    signal_key: "bottom_post_30d",
    prioridad: "baja",
    tipo: "info",
    titulo: `Post con menor engagement: ${bottom.rate.toFixed(2)}% en ${PLATFORM_LABEL[bottom.post.platform] ?? bottom.post.platform}`,
    descripcion: `"${(bottom.post.message ?? "").slice(0, 120)}${(bottom.post.message?.length ?? 0) > 120 ? "..." : ""}" tuvo ${bottom.post.reach.toLocaleString()} alcance pero solo ${bottom.post.engagement.toLocaleString()} interacciones.`,
    acciones: [
      "Identificar por qué este formato no enganchó",
      "Evitar replicar el patrón (tema, formato o CTA)",
    ],
    datos: { permalink: bottom.post.permalink, reach: bottom.post.reach, engagement: bottom.post.engagement, rate: bottom.rate },
  };
}

// -----------------------------------------------------------------------------
// Entry point

export function computeOrganicInsights(args: {
  currentPeriod: MetaPostMin[];
  previousPeriod: MetaPostMin[];
}): Insight[] {
  const { currentPeriod, previousPeriod } = args;
  const currAgg = aggregate(currentPeriod);
  const prevAgg = aggregate(previousPeriod);

  const insights: Insight[] = [];

  // Por cada combinación platform × kind con data en ambos períodos, evaluamos reglas
  const allKeys = new Set([...currAgg.keys(), ...prevAgg.keys()]);
  for (const key of allKeys) {
    const [platform, kind] = key.split("|");
    if (!platform || !kind) continue;
    const curr = currAgg.get(key) ?? emptyBucket();
    const prev = prevAgg.get(key) ?? emptyBucket();
    const out: (Insight | null)[] = [
      ruleReachDropPerPost(platform, kind, curr, prev),
      ruleEngagementRateDrop(platform, kind, curr, prev),
      ruleReachOpportunity(platform, kind, curr, prev),
      ruleVolumeChange(platform, kind, curr, prev),
    ];
    for (const i of out) if (i) insights.push(i);
  }

  // Top / bottom post del período actual
  const top = ruleTopPost(currentPeriod);
  if (top) insights.push(top);
  const bottom = ruleBottomPost(currentPeriod);
  if (bottom) insights.push(bottom);

  // Ordenamos por prioridad (alta → media → baja) y luego por tipo (alerta antes que oportunidad/info)
  const prioOrder: Record<string, number> = { alta: 0, media: 1, baja: 2 };
  const tipoOrder: Record<string, number> = { alerta: 0, oportunidad: 1, info: 2 };
  insights.sort((a, b) =>
    (prioOrder[a.prioridad] ?? 9) - (prioOrder[b.prioridad] ?? 9) ||
    (tipoOrder[a.tipo] ?? 9) - (tipoOrder[b.tipo] ?? 9)
  );

  return insights;
}
