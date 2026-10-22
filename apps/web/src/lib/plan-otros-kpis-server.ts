import "server-only";
// Historia real del año base para proyectar las metas de Web, Redes y SEO del Plan anual (lib/plan-otros-kpis.ts).
// Mismas fuentes que muestran los tableros; solo meses CERRADOS. Usa getServerSupabase → se llama en request.
import { sbAdmin } from "@/lib/supabase-admin";
import { getAllMonthlyUsers, getWebMonthlyKpis } from "@/lib/web-queries";
import { getEcommerceMensual } from "@/lib/ecommerce-queries";
import { getPautaInversionTotalMensual, normCat } from "@/lib/objetivos-kpis";
import { getIgOrganicSummary } from "@/lib/meta-ig-queries";
import { getFbOrganicSummary } from "@/lib/meta-fb-queries";
import { getSocialFollowers, OWN_BRAND } from "@/lib/social-posts-queries";
import { getMercadoSeries } from "@/lib/mercado-kpis-server";
import { MERCADO_KPIS } from "@/lib/mercado-kpis";
import { CATS_PLAN, type HistOtros } from "@/lib/plan-otros-kpis";

const safe = async <T,>(p: Promise<T>, fb: T): Promise<T> => { try { return await p; } catch (e) { console.error("[plan-otros]", e); return fb; } };
const f12 = () => Array.from({ length: 12 }, () => null as number | null);

export async function getHistOtros(anioPlan: number): Promise<HistOtros> {
  const now = new Date();
  const anioBase = Math.min(anioPlan - 1, now.getUTCFullYear());
  const cerrados = anioBase < now.getUTCFullYear() ? 12 : now.getUTCMonth(); // meses 0..cerrados-1
  const c = (s: (number | null)[]) => s.map((v, i) => (i < cerrados && v != null && Number.isFinite(v) ? v : null));
  const rango = { from: `${anioBase}-01-01`, to: `${anioBase}-12-31` };

  const rest = async <T,>(q: string): Promise<T[]> => { const r = await sbAdmin(q, { method: "GET" }); return r.ok ? ((await r.json()) as T[]) : []; };
  const [users, web, ecom, inv, ig, fb, fol, merc, sentRows, webCat, igCat] = await Promise.all([
    safe(getAllMonthlyUsers(), []),
    safe(getWebMonthlyKpis(rango), []),
    safe(getEcommerceMensual(anioBase), { transacciones: f12(), ingresos: f12(), invConversion: f12(), diario: [] }),
    safe(getPautaInversionTotalMensual(anioBase), f12()),
    safe(getIgOrganicSummary(rango), null),
    safe(getFbOrganicSummary(rango), null),
    safe(getSocialFollowers(), []),
    safe(getMercadoSeries(anioBase), null),
    safe(sbAdmin(`social_posts?marca=eq.${encodeURIComponent(OWN_BRAND)}&fecha=gte.${rango.from}&fecha=lte.${rango.to}&positivo=not.is.null&select=fecha,positivo,negativo,neutro&limit=5000`, { method: "GET" })
      .then(async (r) => (r.ok ? ((await r.json()) as { fecha: string; positivo: number | null; negativo: number | null; neutro: number | null }[]) : [])), []),
    // Mismas fuentes por categoría que el Seguimiento (usuarios web y alcance IG).
    safe(rest<{ mes: string; categoria: string | null; usuarios: number | null }>(`web_monthly_by_category?mes=gte.${rango.from}&mes=lte.${rango.to}&select=mes,categoria,usuarios&limit=10000`), []),
    safe(rest<{ fecha_post: string; categoria: string | null; reach: number | null }>(`meta_posts?platform=eq.instagram&fecha_post=gte.${rango.from}&fecha_post=lt.${anioBase + 1}-01-01&select=fecha_post,categoria,reach&limit=10000`), []),
  ]);

  const series: Record<string, (number | null)[]> = {};
  const porMes = <T,>(rows: T[], mes: (r: T) => string, v: (r: T) => number | null) => {
    const a = f12();
    for (const r of rows) { const m = mes(r); if (m.slice(0, 4) === String(anioBase)) { const i = Number(m.slice(5, 7)) - 1; const x = v(r); if (i >= 0 && i < 12 && x != null) a[i] = x; } }
    return c(a);
  };
  series["Web / Ecommerce|Tráfico web (usuarios)"] = porMes(users, (r) => r.mes, (r) => r.total_users);
  series["Web / Ecommerce|Sesiones"] = porMes(users, (r) => r.mes, (r) => r.sesiones ?? null);
  series["Web / Ecommerce|Avg Sesión (segundos)"] = porMes(web, (r) => r.fecha, (r) => r.avg_session_duration);
  series["Web / Ecommerce|Tasa de conversión"] = porMes(web, (r) => r.fecha, (r) => (r.sesiones > 0 ? (r.conversiones / r.sesiones) * 100 : null));
  series["Web / Ecommerce|Transacciones"] = c(ecom.transacciones);
  series["Web / Ecommerce|Total Ingresos"] = c(ecom.ingresos);
  // ROAS = ingresos ÷ inversión total de medios (Pauta Mkt + conversión ecommerce), igual que /web.
  series["Web / Ecommerce|ROAS"] = c(ecom.ingresos.map((v, i) => { const d = (inv[i] ?? 0) + (ecom.invConversion[i] ?? 0); return v != null && d > 0 ? v / d : null; }));

  series["Web / Ecommerce|Inversión conversión"] = c(ecom.invConversion);
  series["Redes Sociales|Alcance orgánico"] = c((ig?.monthlyData ?? []).map((m) => m.alcance));
  series["Redes Sociales|Interacciones"] = c((ig?.monthlyData ?? []).map((m) => m.engagement));
  const sent = Array.from({ length: 12 }, () => [] as number[]);
  for (const r of sentRows) {
    if (!(r.positivo || r.negativo || r.neutro)) continue; // mismo filtro que computeKpis (data sucia del scraper)
    const i = Number(r.fecha.slice(5, 7)) - 1;
    if (i >= 0 && i < 12) sent[i]!.push(Number(r.positivo));
  }
  series["Redes Sociales|Sentiment"] = c(sent.map((xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)));
  series["Facebook|Alcance orgánico"] = c((fb?.monthlyData ?? []).map((m) => m.alcance));
  series["Facebook|Engagement rate"] = c((fb?.monthlyData ?? []).map((m) => (m.alcance && m.engagement != null ? (m.engagement / m.alcance) * 100 : null)));
  for (const k of MERCADO_KPIS) series[`Mercado y competencia|${k.key}`] = c(merc?.series[k.key]?.realM ?? f12());

  // Participación por categoría de los últimos 6 meses cerrados (suma de la fuente por categoría ÷ total).
  const desde = Math.max(0, cerrados - 6);
  const share = <T,>(rows: T[], fecha: (r: T) => string, cat: (r: T) => string | null, v: (r: T) => number | null) => {
    const acc: Record<string, number> = {};
    for (const r of rows) {
      const f = fecha(r) ?? "", i = Number(f.slice(5, 7)) - 1, k = normCat(cat(r));
      if (f.slice(0, 4) !== String(anioBase) || i < desde || i >= cerrados || !k) continue;
      acc[k] = (acc[k] ?? 0) + (v(r) ?? 0);
    }
    const tot = CATS_PLAN.reduce((t, k) => t + (acc[k] ?? 0), 0);
    return tot > 0 ? Object.fromEntries(CATS_PLAN.map((k) => [k, (acc[k] ?? 0) / tot])) : null;
  };
  const shares: Record<string, Record<string, number>> = {};
  const sw = share(webCat, (r) => r.mes, (r) => r.categoria, (r) => r.usuarios);
  const si = share(igCat, (r) => r.fecha_post, (r) => r.categoria, (r) => r.reach);
  if (sw) shares["Web / Ecommerce|Tráfico web (usuarios)"] = sw;
  if (si) shares["Redes Sociales|Alcance orgánico"] = si;
  const seriesCat: Record<string, Record<string, (number | null)[]>> = {};
  for (const k of MERCADO_KPIS) {
    const rc = merc?.series[k.key]?.realCatM;
    if (rc) seriesCat[`Mercado y competencia|${k.key}`] = Object.fromEntries(Object.entries(rc).map(([cat, v]) => [cat, c(v)]));
  }
  // Mezcla típica de interacciones IG: mediana de cada tipo en los últimos 6 meses cerrados (un sorteo no la tuerce).
  const med = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y), m = a.length >> 1; return a.length ? (a.length % 2 ? a[m]! : (a[m - 1]! + a[m]!) / 2) : 0; };
  const md = (ig?.monthlyData ?? []).slice(desde, cerrados);
  const mix = { likes: med(md.map((m) => m.likes ?? 0)), comentarios: med(md.map((m) => m.comentarios ?? 0)), guardados: med(md.map((m) => m.guardados ?? 0)) };
  const mixTot = mix.likes + mix.comentarios + mix.guardados;

  // Seguidores IG: último dato + ritmo mensual entre el primer y el último relevamiento (≥2 meses).
  const igFol = fol.filter((f) => f.marca === OWN_BRAND && f.red_social === "INSTAGRAM").sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ini = igFol[0], fin = igFol.at(-1);
  const meses = ini && fin ? (Date.parse(fin.fecha) - Date.parse(ini.fecha)) / (30.44 * 864e5) : 0;
  return {
    anioBase,
    series,
    shares,
    seriesCat,
    igMix: mixTot > 0 ? { likes: mix.likes / mixTot, comentarios: mix.comentarios / mixTot, guardados: mix.guardados / mixTot } : null,
    seguidores: { ultimo: fin?.followers ?? null, fecha: fin?.fecha ?? null, porMes: ini && fin && meses >= 2 ? (fin.followers - ini.followers) / meses : 0 },
  };
}
