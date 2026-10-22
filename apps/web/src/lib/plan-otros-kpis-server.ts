import "server-only";
// Historia real del año base para proyectar las metas de Web, Redes y SEO del Plan anual (lib/plan-otros-kpis.ts).
// Mismas fuentes que muestran los tableros; solo meses CERRADOS. Usa getServerSupabase → se llama en request.
import { sbAdmin } from "@/lib/supabase-admin";
import { getAllMonthlyUsers, getWebMonthlyKpis } from "@/lib/web-queries";
import { getEcommerceMensual } from "@/lib/ecommerce-queries";
import { getPautaInversionTotalMensual } from "@/lib/objetivos-kpis";
import { getIgOrganicSummary } from "@/lib/meta-ig-queries";
import { getFbOrganicSummary } from "@/lib/meta-fb-queries";
import { getSocialFollowers, OWN_BRAND } from "@/lib/social-posts-queries";
import { getMercadoSeries } from "@/lib/mercado-kpis-server";
import { MERCADO_KPIS } from "@/lib/mercado-kpis";
import type { HistOtros } from "@/lib/plan-otros-kpis";

const safe = async <T,>(p: Promise<T>, fb: T): Promise<T> => { try { return await p; } catch (e) { console.error("[plan-otros]", e); return fb; } };
const f12 = () => Array.from({ length: 12 }, () => null as number | null);

export async function getHistOtros(anioPlan: number): Promise<HistOtros> {
  const now = new Date();
  const anioBase = Math.min(anioPlan - 1, now.getUTCFullYear());
  const cerrados = anioBase < now.getUTCFullYear() ? 12 : now.getUTCMonth(); // meses 0..cerrados-1
  const c = (s: (number | null)[]) => s.map((v, i) => (i < cerrados && v != null && Number.isFinite(v) ? v : null));
  const rango = { from: `${anioBase}-01-01`, to: `${anioBase}-12-31` };

  const [users, web, ecom, inv, ig, fb, fol, merc, sentRows] = await Promise.all([
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

  // Seguidores IG: último dato + ritmo mensual entre el primer y el último relevamiento (≥2 meses).
  const igFol = fol.filter((f) => f.marca === OWN_BRAND && f.red_social === "INSTAGRAM").sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ini = igFol[0], fin = igFol.at(-1);
  const meses = ini && fin ? (Date.parse(fin.fecha) - Date.parse(ini.fecha)) / (30.44 * 864e5) : 0;
  return {
    anioBase,
    series,
    seguidores: { ultimo: fin?.followers ?? null, fecha: fin?.fecha ?? null, porMes: ini && fin && meses >= 2 ? (fin.followers - ini.followers) / meses : 0 },
  };
}
