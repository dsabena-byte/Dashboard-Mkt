import "server-only";
import { getFbOrganicSummary } from "@/lib/meta-fb-queries";
import { getIgOrganicSummary } from "@/lib/meta-ig-queries";
import { getTopAndBottomPostsLastNDays } from "@/lib/insights-queries";
import { getServerSupabase } from "@/lib/supabase-server";
import type { ChatTool } from "./types";

// ============================================================================
// Tools del dashboard Análisis de Redes. Envuelven las query functions que ya
// existen (tenant-scopeadas vía getTenant). Devuelven data TRIMEADA para no
// gastar tokens de más. Agregar un dashboard nuevo = un archivo como este.
// ============================================================================

function rangeArg(args: Record<string, unknown>): { from: string; to: string } | undefined {
  const from = typeof args.from === "string" ? args.from : undefined;
  const to = typeof args.to === "string" ? args.to : undefined;
  return from && to ? { from, to } : undefined;
}

export const redesTools: ChatTool[] = [
  {
    name: "get_fb_organic",
    description:
      "Métricas orgánicas de Facebook (Página Drean): alcance (personas únicas), engagement, video views, reacciones, fans, evolución mensual (alcance vs engagement) y top posts. Usar para preguntas de FB orgánico y para graficar su evolución. Excluye posts pagos/boosteados. Rango de fechas opcional (YYYY-MM-DD).",
    parameters: {
      type: "object",
      properties: {
        from: { type: "string", description: "Fecha desde YYYY-MM-DD (opcional)" },
        to: { type: "string", description: "Fecha hasta YYYY-MM-DD (opcional)" },
      },
    },
    run: async (args) => {
      const s = await getFbOrganicSummary(rangeArg(args));
      return {
        rango: s.rangeLabel,
        totales: {
          alcance: s.totals.impressions_unique,
          engagement: s.totals.post_engagements,
          reacciones: s.totals.reactions_total,
          video_views: s.totals.video_views,
          fans: s.totals.fans_total,
        },
        evolucion_mensual: s.monthlyData,
        top_posts: s.topPosts.slice(0, 5).map((p) => ({
          fecha: p.fecha_post?.slice(0, 10),
          tipo: p.media_type,
          alcance: p.reach,
          engagement: p.engagement,
          reacciones: p.reactions,
          mensaje: p.message?.slice(0, 80) ?? null,
          thumbnail: p.thumbnail_url ?? null,
          url: p.permalink ?? null,
        })),
      };
    },
  },
  {
    name: "get_ig_organic",
    description:
      "Métricas orgánicas de Instagram (@dreanargentina): alcance, engagement, reacciones, comentarios, guardados, video views, cantidad de posts, evolución mensual y top posts. Requiere rango de fechas (YYYY-MM-DD).",
    parameters: {
      type: "object",
      required: ["from", "to"],
      properties: {
        from: { type: "string", description: "Fecha desde YYYY-MM-DD" },
        to: { type: "string", description: "Fecha hasta YYYY-MM-DD" },
      },
    },
    run: async (args) => {
      const r = rangeArg(args);
      if (!r) return { error: "get_ig_organic requiere 'from' y 'to'" };
      const s = await getIgOrganicSummary(r);
      return {
        rango: s.rangeLabel,
        totales: {
          alcance: s.totalReach,
          engagement: s.totalEngagement,
          reacciones: s.totalReactions,
          comentarios: s.totalComments,
          guardados: s.totalSaves,
          video_views: s.totalVideoViews,
          posts: s.postCount,
        },
        evolucion_mensual: s.monthlyData,
        top_posts: s.topPosts.slice(0, 5).map((p) => ({
          fecha: p.fecha_post?.slice(0, 10),
          tipo: p.media_type,
          alcance: p.reach,
          engagement: p.engagement,
          mensaje: p.message?.slice(0, 80) ?? null,
          thumbnail: p.thumbnail_url ?? null,
          url: p.permalink ?? null,
        })),
      };
    },
  },
  {
    name: "get_engagement_semanal",
    description:
      "Evolución SEMANAL del engagement orgánico (agrupa los posts por semana, lunes) por plataforma: Instagram (@dreanargentina) y/o Facebook (Página Drean). Devuelve engagement, alcance, cantidad de posts y engagement rate por semana. Usar para pedidos de 'evolución semanal' del engagement. Requiere rango from/to (YYYY-MM-DD).",
    parameters: {
      type: "object",
      required: ["from", "to"],
      properties: {
        from: { type: "string", description: "Fecha desde YYYY-MM-DD" },
        to: { type: "string", description: "Fecha hasta YYYY-MM-DD" },
        plataforma: {
          type: "string",
          enum: ["instagram", "facebook", "ambas"],
          description: "Plataforma (default instagram)",
        },
      },
    },
    run: async (args) => {
      const r = rangeArg(args);
      if (!r) return { error: "get_engagement_semanal requiere 'from' y 'to'" };
      const plataformas =
        args.plataforma === "facebook"
          ? ["facebook"]
          : args.plataforma === "ambas"
            ? ["instagram", "facebook"]
            : ["instagram"];
      const sb = getServerSupabase();
      const { data, error } = await sb
        .from("meta_posts")
        .select("platform, fecha_post, engagement, reach")
        .in("platform", plataformas)
        .gte("fecha_post", `${r.from}T00:00:00Z`)
        .lte("fecha_post", `${r.to}T23:59:59Z`)
        .limit(5000)
        .returns<Array<{ platform: string; fecha_post: string; engagement: number | null; reach: number | null }>>();
      if (error) return { error: error.message };
      // Agrupar por semana (lunes) en UTC.
      const wk = new Map<string, { semana: string; engagement: number; alcance: number; posts: number }>();
      for (const p of data ?? []) {
        const d = new Date(p.fecha_post);
        const dow = (d.getUTCDay() + 6) % 7; // 0 = lunes
        const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow));
        const key = monday.toISOString().slice(0, 10);
        const m = wk.get(key) ?? { semana: key, engagement: 0, alcance: 0, posts: 0 };
        m.engagement += p.engagement ?? 0;
        m.alcance += p.reach ?? 0;
        m.posts += 1;
        wk.set(key, m);
      }
      const evolucion_semanal = [...wk.values()]
        .sort((a, b) => a.semana.localeCompare(b.semana))
        .map((x) => ({ ...x, eng_rate: x.alcance > 0 ? Number(((x.engagement / x.alcance) * 100).toFixed(2)) : null }));
      return { plataforma: plataformas.join("+"), rango: `${r.from} a ${r.to}`, semanas: evolucion_semanal.length, evolucion_semanal };
    },
  },
  {
    name: "get_top_posts",
    description:
      "Mejores y peores posts (por engagement rate) de los últimos N días, separados por plataforma (Instagram y Facebook). Útil para '¿qué post rindió mejor?' o comparar contenidos.",
    parameters: {
      type: "object",
      properties: {
        dias: { type: "number", description: "Días hacia atrás (default 30)" },
        cantidad: { type: "number", description: "Cuántos por plataforma (default 5)" },
      },
    },
    run: async (args) => {
      const dias = typeof args.dias === "number" ? args.dias : 30;
      const cantidad = typeof args.cantidad === "number" ? args.cantidad : 5;
      const r = await getTopAndBottomPostsLastNDays(dias, cantidad);
      type TopPost = (typeof r)["instagram"]["top"][number];
      // Trimeado: sin thumbnails, permalinks ni ids (ensucian la respuesta del chat).
      const trim = (p: TopPost) => ({
        fecha: p.fecha_post?.slice(0, 10),
        tipo: p.media_type,
        alcance: p.reach,
        engagement: p.engagement,
        reacciones: p.reactions,
        video_views: p.video_views,
        eng_rate: p.eng_rate,
        mensaje: p.message?.slice(0, 60) ?? null,
        thumbnail: p.thumbnail_url ?? null,
        url: p.permalink ?? null,
      });
      return {
        instagram: { top: r.instagram.top.map(trim), bottom: r.instagram.bottom.map(trim) },
        facebook: { top: r.facebook.top.map(trim), bottom: r.facebook.bottom.map(trim) },
      };
    },
  },
];
