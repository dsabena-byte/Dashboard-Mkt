import "server-only";
import { getFbOrganicSummary } from "@/lib/meta-fb-queries";
import { getIgOrganicSummary } from "@/lib/meta-ig-queries";
import { getTopAndBottomPostsLastNDays, type TopPostRow } from "@/lib/insights-queries";
import { getServerSupabase } from "@/lib/supabase-server";
import {
  getSocialPosts,
  getSocialFollowers,
  enrichEngagement,
  computeBrandStats,
  computeSentimentByBrand,
  computeContentTypeSlices,
  BRAND_LABELS,
  OWN_BRAND,
} from "@/lib/social-posts-queries";
import { registrarCard } from "./cards";
import { clip, fmtN, hoyAR, rd, topN, oneOf } from "./util";
import type { ChatTool, ToolCtx } from "./types";

// ============================================================================
// Redes Sociales (/redes): orgánico IG/FB de Drean + competitivo (social_posts).
// Los posts devuelven un `ref` → render_posts arma la tarjeta server-side.
// ============================================================================

function rangeArg(args: Record<string, unknown>): { from: string; to: string } | undefined {
  const from = typeof args.from === "string" ? args.from : undefined;
  const to = typeof args.to === "string" ? args.to : undefined;
  return from && to ? { from, to } : undefined;
}
function defaultYtd(): { from: string; to: string } {
  const hoy = hoyAR();
  return { from: `${hoy.slice(0, 4)}-01-01`, to: hoy };
}
const RANGO_PROPS = {
  from: { type: "string", description: "Fecha desde YYYY-MM-DD (default: 1-ene del año en curso)" },
  to: { type: "string", description: "Fecha hasta YYYY-MM-DD (default: hoy)" },
};

export function redesTools(ctx: ToolCtx): ChatTool[] {
  const card = (red: string, p: { fecha_post?: string | null; media_type?: string | null; message?: string | null; thumbnail_url?: string | null; permalink?: string | null; reach?: number; engagement?: number; eng_rate?: number }) =>
    registrarCard(ctx, "p", {
      red,
      titulo: clip(p.message, 90) || "(sin texto)",
      fecha: p.fecha_post?.slice(0, 10) ?? null,
      formato: p.media_type ?? null,
      thumbnail: p.thumbnail_url ?? null,
      url: p.permalink ?? null,
      metricas: [
        { label: "alcance", valor: fmtN(p.reach) },
        { label: "interacciones", valor: fmtN(p.engagement) },
        ...(p.eng_rate != null ? [{ label: "ER", valor: `${rd(p.eng_rate, 2)?.toLocaleString("es-AR")}%` }] : []),
      ],
    });

  return [
    {
      name: "get_fb_organic",
      description:
        "Facebook orgánico (Página Drean): alcance (personas únicas, métrica nueva de Meta, excluye posts pagos/boosteados), engagement, video views, reacciones, fans, evolución mensual y top posts (con ref para render_posts). OJO: el alcance de FB es poco confiable (Meta deprecó el reach orgánico); el objetivo estratégico de Redes se mide con Instagram.",
      parameters: { type: "object", properties: RANGO_PROPS },
      run: async (args) => {
        const s = await getFbOrganicSummary(rangeArg(args) ?? defaultYtd());
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
            ref: card("Facebook", p),
            fecha: p.fecha_post?.slice(0, 10),
            tipo: p.media_type,
            alcance: p.reach,
            engagement: p.engagement,
            reacciones: p.reactions,
            mensaje: clip(p.message, 80),
          })),
        };
      },
    },
    {
      name: "get_ig_organic",
      description:
        "Instagram orgánico (@dreanargentina): alcance, interacciones (likes+comentarios+guardados), reacciones, comentarios, guardados, video views, cantidad de posts, evolución mensual, split seguidores/no seguidores y top posts (con ref para render_posts). Es la fuente del objetivo estratégico de Redes.",
      parameters: { type: "object", properties: RANGO_PROPS },
      run: async (args) => {
        const s = await getIgOrganicSummary(rangeArg(args) ?? defaultYtd());
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
          ...(s.postCount >= 200
            ? { aviso: "La fuente toma como máximo los 200 posts de más engagement del rango: totales y evolución mensual pueden estar subestimados. Para series mensuales completas usá get_cruce_mensual (ig_alcance, ig_interacciones, ig_posts) o acotá el rango." }
            : {}),
          evolucion_mensual: s.monthlyData,
          top_posts: s.topPosts.slice(0, 5).map((p) => ({
            ref: card("Instagram", p),
            fecha: p.fecha_post?.slice(0, 10),
            tipo: p.media_type,
            pilar: p.pilar_contenido,
            alcance: p.reach,
            engagement: p.engagement,
            mensaje: clip(p.message, 80),
          })),
          provincias_top: s.demoProvince.slice(0, 6).map((d) => ({ provincia: d.category, pct: rd(d.pct, 1) })),
        };
      },
    },
    {
      name: "get_engagement_semanal",
      description:
        "Evolución SEMANAL del engagement orgánico (posts agrupados por semana, lunes) por plataforma: Instagram y/o Facebook. Devuelve engagement, alcance, posts y engagement rate por semana. Requiere from/to (YYYY-MM-DD).",
      parameters: {
        type: "object",
        required: ["from", "to"],
        properties: {
          from: { type: "string", description: "Fecha desde YYYY-MM-DD" },
          to: { type: "string", description: "Fecha hasta YYYY-MM-DD" },
          plataforma: { type: "string", enum: ["instagram", "facebook", "ambas"], description: "Plataforma (default instagram)" },
        },
      },
      run: async (args) => {
        const r = rangeArg(args);
        if (!r) return { error: "get_engagement_semanal requiere 'from' y 'to'" };
        const plataformas = args.plataforma === "facebook" ? ["facebook"] : args.plataforma === "ambas" ? ["instagram", "facebook"] : ["instagram"];
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
        const wk = new Map<string, { semana: string; engagement: number; alcance: number; posts: number }>();
        for (const p of data ?? []) {
          const d = new Date(p.fecha_post);
          const dow = (d.getUTCDay() + 6) % 7;
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
        "Mejores y peores posts orgánicos (por engagement rate) de los últimos N días, por plataforma (Instagram y Facebook). Cada post trae un `ref` para mostrarlo con render_posts.",
      parameters: {
        type: "object",
        properties: {
          dias: { type: "number", description: "Días hacia atrás (default 30)" },
          cantidad: { type: "number", description: "Cuántos por plataforma (default 5, máx 10)" },
        },
      },
      run: async (args) => {
        const dias = topN(args.dias, 30, 365);
        const cantidad = topN(args.cantidad, 5, 10);
        const r = await getTopAndBottomPostsLastNDays(dias, cantidad);
        const trim = (red: string) => (p: TopPostRow) => ({
          ref: card(red, p),
          fecha: p.fecha_post?.slice(0, 10),
          tipo: p.media_type,
          alcance: p.reach,
          engagement: p.engagement,
          reacciones: p.reactions,
          video_views: p.video_views,
          eng_rate: p.eng_rate,
          mensaje: clip(p.message, 60),
        });
        return {
          instagram: { top: r.instagram.top.map(trim("Instagram")), bottom: r.instagram.bottom.map(trim("Instagram")) },
          facebook: { top: r.facebook.top.map(trim("Facebook")), bottom: r.facebook.bottom.map(trim("Facebook")) },
        };
      },
    },
    {
      name: "get_redes_competencia",
      description:
        "Benchmark competitivo de redes (posts scrapeados de Drean y competidores en IG/FB/TikTok): por marca posts, posts/semana, engagement promedio, likes, comentarios, views, seguidores y sentimiento de comentarios (positivo/negativo/neutro); mix de formatos. Sirve para share of engagement y frecuencia de posteo vs competencia.",
      parameters: {
        type: "object",
        properties: {
          ...RANGO_PROPS,
          red: { type: "string", enum: ["all", "INSTAGRAM", "FACEBOOK", "TIKTOK"], description: "default all" },
        },
      },
      run: async (args) => {
        const r = rangeArg(args) ?? defaultYtd();
        const red = oneOf(args.red, ["all", "INSTAGRAM", "FACEBOOK", "TIKTOK"] as const, "all");
        const [raw, followers] = await Promise.all([getSocialPosts({ red, from: r.from, to: r.to }), getSocialFollowers().catch(() => [])]);
        const posts = enrichEngagement(raw, followers);
        const stats = computeBrandStats(posts, followers, red);
        const totEng = stats.reduce((a, s) => a + s.total_likes + s.total_comentarios, 0);
        const sent = new Map(computeSentimentByBrand(posts).map((s) => [s.key, s]));
        return {
          rango: `${r.from} a ${r.to}`,
          red,
          marca_propia: BRAND_LABELS[OWN_BRAND] ?? OWN_BRAND,
          marcas: stats.map((s) => ({
            marca: BRAND_LABELS[s.marca] ?? s.marca,
            posts: s.posts,
            posts_semana: rd(s.posts_per_week, 1),
            engagement_prom_pct: rd(s.engagement_promedio, 2),
            likes: s.total_likes,
            comentarios: s.total_comentarios,
            share_of_engagement_pct: totEng ? rd(((s.total_likes + s.total_comentarios) / totEng) * 100, 1) : null,
            views_prom: Math.round(s.views_promedio),
            seguidores: s.followers,
            sentimiento: sent.get(s.marca) ? { pos: rd(sent.get(s.marca)!.positivo, 1), neg: rd(sent.get(s.marca)!.negativo, 1), neu: rd(sent.get(s.marca)!.neutro, 1) } : null,
          })),
          formatos: computeContentTypeSlices(posts.filter((p) => p.marca === OWN_BRAND)).slice(0, 8),
        };
      },
    },
  ];
}
