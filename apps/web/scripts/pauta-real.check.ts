// Chequeo de SOLO LECTURA contra la DB real (REST, service key del entorno): pacing del mes en curso,
// fatiga creativa y datos del MMM, con las MISMAS funciones puras que usa el tablero.
// Correr: cd apps/web && npx tsx scripts/pauta-real.check.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { computePacing, bgtVigentePorMes, BGT_PAUTA_CUENTA } from "../src/lib/pauta-pacing";
import { fatigaPiezas } from "../src/lib/pauta-fatiga";
import { dv360LineItemCategoria } from "../src/lib/dv360-data";
import { buildPautaMediosMensual } from "../src/lib/pauta-medios-model";
import { simMonthsFromPauta, buildSimModel } from "../src/lib/simulador";
import { construirDatosMmm, inputMmm } from "../src/lib/mmm-datos";
import { ajustarMmm } from "../src/lib/stats/mmm";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
async function rest<T = any>(q: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL}/rest/v1/${q}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`${q}: ${r.status}`);
    const rows = (await r.json()) as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}
const MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const lbl = (f: string) => `${MES[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}`;
const M = (v: number | null | undefined) => (v == null ? "—" : `$${(v / 1e6).toFixed(2)}M`);

async function main() {
  const anio = 2026;
  const [pauta, metaPaid, dv360, reach, gads, fx, plan, bgt, ecom, fetched] = await Promise.all([
    rest("pauta_performance?select=mes,medio,categoria,objetivo,impresiones,alcance,clics,inversion"),
    rest("meta_paid_creatives?select=ad_id,creative_id,mes,plataforma,ad_name,categoria,thumbnail_url,image_url,instagram_permalink_url,permalink_url,impresiones,alcance,clicks,spend,video_p25,video_p50,video_p75"),
    rest("dv360_creatives?select=mes,canal,categoria,rol,creative,impresiones,clicks,starts,q50,revenue_usd"),
    rest("dv360_reach?select=mes,canal,line_item,impresiones,reach"),
    rest("ga4_google_ads_daily?select=fecha,campaign_name,campaign_type,cost,impressions,clicks&campaign_name=not.ilike.inhouse*"),
    rest("fx_rates?select=mes,usd_ars"),
    rest(`kpi_meta_valores?select=mes,valor&plan=eq.${encodeURIComponent("Pauta Mkt")}&kpi=eq.${encodeURIComponent("Inversión")}&categoria=eq.__general__&anio=eq.${anio}`),
    rest(`bgt_marketing?select=presupuesto,mes,ars&cuenta=eq.${encodeURIComponent(BGT_PAUTA_CUENTA)}&anio=eq.${anio}`),
    rest(`ga4_ads_cost_daily?utm_campaign=ilike.inhouse*&fecha=gte.${anio}-01-01&select=fecha,cost`),
    rest("meta_paid_creatives?select=fetched_at&order=fetched_at.desc&limit=1"),
  ]);
  const fxRates = Object.fromEntries(fx.map((r: any) => [r.mes, Number(r.usd_ars)]));
  const canalDe = (t: string | null) => { const s = (t ?? "").toLowerCase(); return s.includes("demand") ? "Google Demand Gen" : s.includes("search") ? "Google Search" : s.includes("performance") ? "Google PMax" : `Google ${t}`; };
  const gagg = new Map<string, any>();
  for (const r of gads) { const k = `${lbl(r.fecha)}|${canalDe(r.campaign_type)}`; const a = gagg.get(k) ?? { mes: lbl(r.fecha), canal: canalDe(r.campaign_type), costo: 0, impresiones: 0, clicks: 0 }; a.costo += Number(r.cost) || 0; a.impresiones += Number(r.impressions) || 0; a.clicks += Number(r.clicks) || 0; gagg.set(k, a); }
  const planArr: (number | null)[] = Array.from({ length: 12 }, () => null);
  for (const r of plan) planArr[r.mes - 1] = Number(r.valor);
  const ecomArr: (number | null)[] = Array.from({ length: 12 }, () => null);
  for (const r of ecom) { const i = Number(r.fecha.slice(5, 7)) - 1; ecomArr[i] = (ecomArr[i] ?? 0) + (Number(r.cost) || 0); }
  const dvReach = reach.map((r: any) => ({ ...r, categoria: dv360LineItemCategoria(r.line_item) }));
  const asOf = new Date(fetched[0].fetched_at);
  console.log("asOf (última sync Meta):", asOf.toISOString());

  const p = computePacing({ pauta, metaPaid, dv360, dv360Reach: dvReach, googleAdsOmd: [...gagg.values()], fxRates, anio, asOf, plan: planArr, bgt: bgtVigentePorMes(bgt, anio), extra: [{ medio: "Ecommerce", valores: ecomArr }] });
  if (!p) { console.log("sin pacing"); } else {
    console.log(`\nPACING ${p.mes}: día ${p.diasTranscurridos.toFixed(2)}/${p.diasMes} · gastado ${M(p.gastado)} (API+ecom ${M(p.gastadoApi)} · OMD cargado ${M(p.cargadoManual)})`);
    console.log(`  rango a cierre: piso ${M(p.rango.piso)} · central ${M(p.rango.central)} · techo ${M(p.rango.techo)}`);
    console.log(`  plan ${M(p.plan)} (a la fecha ${M(p.planALaFecha)}) · desvío central ${p.desvioPct?.toFixed(1)}% · estado ${p.estado} · BGT ${p.bgt ? `${p.bgt.version} ${M(p.bgt.valor)}` : "—"} · ref 3m ${M(p.referencia)}`);
    console.log(`  pendientes OMD: ${p.pendientes.join(", ") || "—"}`);
    for (const m of p.porMedio) console.log(`   ${m.tipo.padEnd(9)} ${m.medio.padEnd(20)} gastado ${M(m.gastado).padStart(9)} proy ${M(m.proyeccion).padStart(9)} ref ${M(m.referencia).padStart(9)} max ${M(m.maximo)}`);
  }
  // ── MMM-lite: mismas series que el Simulador ──
  const gNoPmax = [...gagg.values()].filter((r: any) => !/pmax/i.test(r.canal));
  const b = { pauta, metaPaid, dv360, dv360Reach: dvReach, googleAdsOmd: gNoPmax, fxRates };
  const sim = simMonthsFromPauta(buildPautaMediosMensual({ ...b, anio: 2025, currentMonth: 13 }), buildPautaMediosMensual({ ...b, anio, currentMonth: 9 }));
  const users = await rest("ga4_monthly_users?select=mes,total_users");
  const purch = await rest("ga4_purchases_daily?select=fecha,purchases&fecha=gte.2025-01-01");
  const tr: Record<string, number> = {}; for (const r of purch) tr[r.fecha.slice(0, 7)] = (tr[r.fecha.slice(0, 7)] ?? 0) + (Number(r.purchases) || 0);
  const ecoInv: Record<string, number> = {}; ecomArr.forEach((v, i) => { if (v) ecoInv[`${anio}-${String(i + 1).padStart(2, "0")}`] = v; });
  const datos = construirDatosMmm({ meses: sim, extra: [{ medio: "Ecommerce", porMes: ecoInv }], mesEnCurso: "2026-09", kpis: [
    { key: "usuarios", label: "Usuarios web", unidad: "", porMes: Object.fromEntries(users.map((r: any) => [r.mes.slice(0, 7), r.total_users])) },
    { key: "transacciones", label: "Transacciones", unidad: "", porMes: tr },
  ] });
  console.log(`\nMMM: meses ${datos.meses.join(",")} · medios ${datos.medios.map((m) => m.nombre).join(", ")}`);
  for (const k of datos.kpis) { const i = inputMmm(datos, k.key); const r = i ? ajustarMmm(i.input, { bootstrap: 20 }) : null; console.log(`  ${k.label}: ${r ? (r.ok ? `OK confianza ${r.confianza}` : r.motivo) : "sin input"}`); }
  const sm = buildSimModel(sim);
  console.log(`SIMULADOR: ${sm.channels.length} medios · meses hoy ${sm.mesesLabel.join(",")} · curvas: ${sm.channels.map((c) => `${c.canal}:${c.curves.impresiones?.method ?? "-"}(${c.mesesConDato})`).join(" ")}`);

  const f = fatigaPiezas({ metaPaid, dv360, dv360Reach: dvReach, mesEnCurso: "2026-09", fxRates });
  console.log(`\nFATIGA: evaluadas ${f.evaluadas} (último mes) · sin serie ${f.sinSerie} · con serie ${f.piezas.length}`);
  for (const x of f.piezas) console.log(`  [${x.estado}] ${x.fuente} ${x.canal} · ${x.nombre.slice(0, 50)} · ${x.motivo}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
