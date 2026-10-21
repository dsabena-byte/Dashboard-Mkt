// ============================================================================
// Plan de Medios ANUAL (pestaña "Plan anual" de /performance, oct-2026). Reemplaza el Excel del BGT
// 2027: con el BGT mensual + el reparto de cada medio arma medio × mes, objetivo × mes, categoría × mes
// y medio × categoría, y estima los IMPACTOS de cada medio (impresiones, alcance, clicks, views ≥50%)
// con lo que rindió en el año anterior. De ahí salen las metas mensuales del plan "Pauta Mkt".
// PURO y client-safe (imports relativos, test: scripts/plan-medios-anual.test.ts).
//
// Reglas (las del Excel aprobado por el user):
//  · "fijo" (OOH): costo mensual de enero, se ajusta en abr/jul/oct por la inflación acumulada del
//    trimestre anterior (tabla inflacion_mensual).
//  · "olas" (TV/Radio/DOOH): `peso` = % del BGT ANUAL del medio, repartido por los pesos de `olas`.
//  · "curva" (digital): lo que queda del mes se reparte por `peso` relativo.
//  · Categoría: `cat[m]` fija (TV/Radio → Brand; OOH ene–mar → Lavado, abr–dic → Brand) o null = mix
//    del mes.
//  · Impactos: referencia del medio = promedio mensual de sus meses cerrados ("anio") o de los 2 últimos
//    ("recientes", Meta y TikTok: piezas nuevas). La plata del plan se lleva a pesos del mes de
//    referencia con la inflación cargada y pasa por la curva del Simulador (rendimientos decrecientes).
//    Resultado igual todos los meses en la referencia (OOH: 7,5 M contactos fijos) → impacto fijo.
// ============================================================================
import { fitCurve } from "./simulador";
import type { PautaMesMedios } from "./pauta-medios-model";

export const PLAN_CATS = ["Lavado", "Refrigeración", "Cocción", "Brand", "Promo / UGC"] as const;
export const PLAN_ROLES = ["Awareness", "Consideración", "Conversión"] as const;
export type Reparto = "curva" | "olas" | "fijo";
export type RefPeriodo = "anio" | "recientes";
const N = 12;
const z12 = () => Array.from({ length: N }, () => 0);

export interface PlanMedio {
  medio: string;               // mismo nombre que en el Tablero (buildPautaMediosMensual)
  offline: boolean;
  reparto: Reparto;
  peso: number;                // curva: peso relativo · olas: % del BGT anual
  olas: number[];              // 12 pesos de la ola (se normalizan)
  costoEnero: number;          // fijo: $ por mes en enero
  rol: number[];               // % Awareness / Consideración / Conversión
  cat: (string | null)[];      // 12: categoría fija del mes, null = según mix
  ref: RefPeriodo;
}
export interface PlanConfig { anio: number; bgt: number[]; medios: PlanMedio[]; mix: Record<string, number[]> }

const OLAS = [0, 0, 0, 15, 20, 0, 0, 0, 20, 25, 20, 0];
const mixCat = () => Array.from({ length: N }, () => null);
const fija = (c: string) => Array.from({ length: N }, () => c);
const dig = (medio: string, peso: number, rol: number[], ref: RefPeriodo = "anio"): PlanMedio =>
  ({ medio, offline: false, reparto: "curva", peso, olas: z12(), costoEnero: 0, rol, cat: mixCat(), ref });
const ola = (medio: string, peso: number, cat: (string | null)[]): PlanMedio =>
  ({ medio, offline: true, reparto: "olas", peso, olas: [...OLAS], costoEnero: 0, rol: [100, 0, 0], cat, ref: "anio" });

/** El Excel BGT 2027 aprobado (oct-2026), con Mercado Ads 35/45/20 (pedido del user). */
export function planDefault(anio: number): PlanConfig {
  return {
    anio,
    bgt: [50, 70, 130, 160, 215, 200, 270, 375, 425, 495, 310, 70].map((v) => v * 1e6),
    medios: [
      dig("Meta", 20, [45, 55, 0], "recientes"),
      dig("YouTube", 20, [50, 50, 0]),
      dig("Google Demand Gen", 7, [0, 100, 0]),
      dig("Mercado Ads", 6, [35, 45, 20]),
      dig("Streaming", 3, [100, 0, 0]),
      dig("Programmatic", 3, [100, 0, 0]),
      dig("TikTok", 2, [30, 70, 0], "recientes"),
      dig("Diarios Online", 2, [0, 100, 0]),
      dig("Medios directos", 1.5, [0, 100, 0]),
      dig("Geo Mobile", 1, [0, 0, 100]),
      dig("Otros (test & learn)", 4.5, [50, 50, 0]),
      { medio: "OOH", offline: true, reparto: "fijo", peso: 0, olas: z12(), costoEnero: 28e6, rol: [100, 0, 0], cat: [...fija("Lavado").slice(0, 3), ...fija("Brand").slice(3)], ref: "anio" },
      ola("TV", 15, fija("Brand")),
      ola("Radio", 3, fija("Brand")),
      ola("DOOH", 2, mixCat()),
    ],
    mix: {
      Lavado: [30, 30, 30, 45, 45, 45, 45, 45, 40, 40, 30, 30],
      Refrigeración: [45, 45, 45, 15, 15, 15, 15, 15, 25, 25, 45, 45],
      Cocción: [5, 5, 5, 15, 15, 15, 10, 10, 8, 8, 2, 2],
      Brand: [20, 20, 20, 22, 22, 22, 27, 27, 27, 27, 20, 20],
      "Promo / UGC": [0, 0, 0, 3, 3, 3, 3, 3, 0, 0, 3, 3],
    },
  };
}

// ── Saneado (lo que llega del navegador) ────────────────────────────────────
const num = (v: unknown, min = 0, max = 1e13) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0; };
const arr12 = (v: unknown, min = 0, max = 1e13) => Array.from({ length: N }, (_, i) => num(Array.isArray(v) ? v[i] : 0, min, max));
export function sanearPlan(raw: unknown, anio: number): PlanConfig {
  const r = (raw ?? {}) as Partial<PlanConfig>;
  const medios = (Array.isArray(r.medios) ? r.medios : []).slice(0, 40).map((m0) => {
    const m = (m0 ?? {}) as Partial<PlanMedio>;
    return {
      medio: String(m.medio ?? "").trim().slice(0, 60),
      offline: !!m.offline,
      reparto: (["curva", "olas", "fijo"] as const).includes(m.reparto as Reparto) ? (m.reparto as Reparto) : "curva",
      peso: num(m.peso, 0, 1e6),
      olas: arr12(m.olas, 0, 1e6),
      costoEnero: num(m.costoEnero),
      rol: [0, 1, 2].map((i) => num(Array.isArray(m.rol) ? m.rol[i] : 0, 0, 100)),
      cat: Array.from({ length: N }, (_, i) => { const c = Array.isArray(m.cat) ? m.cat[i] : null; return (PLAN_CATS as readonly string[]).includes(c as string) ? (c as string) : null; }),
      ref: m.ref === "recientes" ? "recientes" : "anio",
    } satisfies PlanMedio;
  }).filter((m) => m.medio);
  const mix: Record<string, number[]> = {};
  for (const c of PLAN_CATS) mix[c] = arr12((r.mix as Record<string, unknown> | undefined)?.[c], 0, 100);
  return { anio, bgt: arr12(r.bgt), medios, mix };
}

// ── Inflación ───────────────────────────────────────────────────────────────
/** inflación % por "YYYY-MM". */
export type InflacionMes = Record<string, number>;
const ym = (anio: number, m: number) => { const d = new Date(Date.UTC(anio, m, 1)); return d.toISOString().slice(0, 7); };
/** Π(1+inf) de los meses DESPUÉS de `desde` hasta `hasta` inclusive (YYYY-MM). Cuenta los meses sin dato. */
export function inflAcum(infl: InflacionMes, desde: string, hasta: string): { f: number; faltan: string[] } {
  let f = 1; const faltan: string[] = [];
  const [ya, ma] = desde.split("-").map(Number) as [number, number];
  for (let i = 1; i < 600; i++) {
    const k = ym(ya, ma - 1 + i);
    if (k > hasta) break;
    if (infl[k] == null) faltan.push(k); else f *= 1 + infl[k]! / 100;
  }
  return { f, faltan };
}

// ── Inversión ───────────────────────────────────────────────────────────────
export interface PlanInversion {
  montos: Record<string, number[]>;           // medio → 12 meses
  total: number[];                            // Σ medios por mes
  digitalDisponible: number[];                // BGT − fijos − olas (negativo = no alcanza)
  objetivos: Record<string, number[]>;
  categorias: Record<string, number[]>;
  medioCat: Record<string, Record<string, number>>; // anual
  avisos: string[];
}

export function calcInversion(cfg: PlanConfig, infl: InflacionMes): PlanInversion {
  const avisos: string[] = [];
  const anual = cfg.bgt.reduce((s, v) => s + v, 0);
  const montos: Record<string, number[]> = {};
  const faltan = new Set<string>();
  for (const m of cfg.medios) {
    if (m.reparto === "fijo") {
      let c = m.costoEnero;
      montos[m.medio] = Array.from({ length: N }, (_, i) => {
        if (i > 0 && i % 3 === 0) {
          // ajuste trimestral por la inflación acumulada de los 3 meses anteriores
          const a = inflAcum(infl, ym(cfg.anio, i - 4), ym(cfg.anio, i - 1));
          a.faltan.forEach((k) => faltan.add(k));
          c *= a.f;
        }
        return c;
      });
    } else if (m.reparto === "olas") {
      const so = m.olas.reduce((s, v) => s + v, 0);
      montos[m.medio] = m.olas.map((w) => (so > 0 ? anual * (m.peso / 100) * (w / so) : 0));
    }
  }
  const digitalDisponible = cfg.bgt.map((b, i) => b - Object.values(montos).reduce((s, a) => s + a[i]!, 0));
  const curvas = cfg.medios.filter((m) => m.reparto === "curva");
  const sp = curvas.reduce((s, m) => s + m.peso, 0);
  for (const m of curvas) montos[m.medio] = digitalDisponible.map((d) => (d > 0 && sp > 0 ? (d * m.peso) / sp : 0));
  if (faltan.size) avisos.push(`Falta la inflación de ${[...faltan].sort().join(", ")} (se tomó 0%): cargala en Inversión de Marketing → Cargar datos → Inflación.`);
  digitalDisponible.forEach((d, i) => { if (d < 0) avisos.push(`Mes ${i + 1}: los medios fijos y las olas superan el BGT por $${Math.round(-d).toLocaleString("es-AR")} (no queda plata para digital).`); });
  if (sp <= 0 && curvas.length) avisos.push("Los medios digitales tienen peso 0: no reciben inversión.");

  const total = z12();
  const objetivos = Object.fromEntries(PLAN_ROLES.map((r) => [r, z12()]));
  const categorias = Object.fromEntries(PLAN_CATS.map((c) => [c, z12()]));
  const medioCat: PlanInversion["medioCat"] = {};
  const sumMix = Array.from({ length: N }, (_, i) => PLAN_CATS.reduce((s, c) => s + (cfg.mix[c]?.[i] ?? 0), 0));
  sumMix.forEach((s, i) => { if (Math.abs(s - 100) > 0.5) avisos.push(`Mix por categoría de mes ${i + 1} suma ${s.toFixed(1)}% (se normaliza a 100%).`); });
  for (const m of cfg.medios) {
    const mc = (medioCat[m.medio] = Object.fromEntries(PLAN_CATS.map((c) => [c, 0])));
    const sr = m.rol.reduce((s, v) => s + v, 0);
    if (Math.abs(sr - 100) > 0.5) avisos.push(`${m.medio}: el rol suma ${sr.toFixed(0)}% (se normaliza a 100%).`);
    montos[m.medio]!.forEach((v, i) => {
      total[i] = total[i]! + v;
      PLAN_ROLES.forEach((r, k) => { const o = objetivos[r]!; if (sr > 0) o[i] = o[i]! + (v * m.rol[k]!) / sr; });
      const fijaCat = m.cat[i];
      for (const c of PLAN_CATS) {
        const p = fijaCat ? (c === fijaCat ? 1 : 0) : sumMix[i]! > 0 ? (cfg.mix[c]?.[i] ?? 0) / sumMix[i]! : 0;
        const cc = categorias[c]!; cc[i] = cc[i]! + v * p; mc[c] = (mc[c] ?? 0) + v * p;
      }
    });
  }
  return { montos, total, digitalDisponible, objetivos, categorias, medioCat, avisos };
}

// ── Referencia de rendimiento por medio ─────────────────────────────────────
export interface RefMedio {
  medio: string;
  inv: number; impr: number; alc: number; clic: number; vbase: number; v50: number; // promedio mensual
  mesFin: string;                     // YYYY-MM del último mes de la referencia (nivel de precios)
  meses: string[];
  b: { impr: number; alc: number; clic: number };
  fijo: boolean;                      // resultado igual todos los meses (OOH)
  fuente: string;
  confianza: "alta" | "media" | "baja";
}

/** Referencia de cada medio del plan desde los meses cerrados del Tablero (año anterior al plan). */
export function referencias(meses: (PautaMesMedios | null)[], medios: PlanMedio[]): Record<string, RefMedio | null> {
  const ms = meses.filter((m): m is PautaMesMedios => !!m).sort((a, b) => a.iso.localeCompare(b.iso));
  const out: Record<string, RefMedio | null> = {};
  for (const pm of medios) {
    const hist = ms.map((m) => ({ mes: m.iso.slice(0, 7), e: m.medios[pm.medio] })).filter((x) => x.e && x.e.inv > 0);
    const conImpr = hist.filter((x) => x.e!.impr > 0);
    if (!conImpr.length) { out[pm.medio] = null; continue; }
    const sel = pm.ref === "recientes" ? conImpr.slice(-2) : conImpr;
    const avg = (k: "inv" | "impr" | "alc" | "clic" | "vbase" | "v50") => sel.reduce((s, x) => s + x.e![k], 0) / sel.length;
    const curva = (k: "impr" | "alc" | "clic") => fitCurve(conImpr.map((x) => ({ x: x.e!.inv, y: x.e![k] })));
    const ci = curva("impr"), ca = curva("alc"), cc = curva("clic");
    const fijo = conImpr.length >= 2 && conImpr.every((x) => x.e!.impr === conImpr[0]!.e!.impr);
    out[pm.medio] = {
      medio: pm.medio, inv: avg("inv"), impr: avg("impr"), alc: avg("alc"), clic: avg("clic"), vbase: avg("vbase"), v50: avg("v50"),
      mesFin: sel[sel.length - 1]!.mes, meses: sel.map((x) => x.mes),
      b: { impr: ci?.b ?? 0.8, alc: ca?.b ?? 0.8, clic: cc?.b ?? 0.8 },
      fijo,
      fuente: `${pm.medio} · ${sel.length === 1 ? sel[0]!.mes : `${sel[0]!.mes} a ${sel[sel.length - 1]!.mes}`}`,
      confianza: fijo ? "media" : ci?.confianza ?? "baja",
    };
  }
  // Medios digitales sin historia (ej. "Otros (test & learn)") → promedio de los digitales con dato.
  const digit = medios.filter((m) => !m.offline).map((m) => out[m.medio]).filter((r): r is RefMedio => !!r && !r.fijo);
  for (const pm of medios) {
    if (out[pm.medio] || pm.offline || !digit.length) continue;
    const s = (k: "inv" | "impr" | "alc" | "clic" | "vbase" | "v50") => digit.reduce((t, r) => t + r[k], 0);
    out[pm.medio] = {
      medio: pm.medio, inv: s("inv"), impr: s("impr"), alc: s("alc"), clic: s("clic"), vbase: s("vbase"), v50: s("v50"),
      mesFin: digit.map((r) => r.mesFin).sort().at(-1)!, meses: [], b: { impr: 0.8, alc: 0.8, clic: 0.8 }, fijo: false,
      fuente: "promedio de los medios digitales (sin historia propia)", confianza: "baja",
    };
  }
  return out;
}

// ── Impactos ────────────────────────────────────────────────────────────────
export interface ImpactoMes { impr: number; alc: number; clic: number; vbase: number; v50: number }
export interface PlanImpactos {
  porMedio: Record<string, ImpactoMes[] | null>;    // null = sin medición (TV, Radio…)
  total: ImpactoMes[];
  avisos: string[];
}
const curva = (refV: number, refInv: number, inv: number, b: number) => (inv > 0 && refInv > 0 && refV > 0 ? refV * Math.pow(inv / refInv, b) : 0);

export function calcImpactos(cfg: PlanConfig, inv: PlanInversion, refs: Record<string, RefMedio | null>, infl: InflacionMes): PlanImpactos {
  const avisos: string[] = [];
  const faltan = new Set<string>();
  const porMedio: PlanImpactos["porMedio"] = {};
  const total: ImpactoMes[] = Array.from({ length: N }, () => ({ impr: 0, alc: 0, clic: 0, vbase: 0, v50: 0 }));
  for (const m of cfg.medios) {
    const r = refs[m.medio];
    const plata = inv.montos[m.medio] ?? z12();
    if (!r) { porMedio[m.medio] = null; if (plata.some((v) => v > 0)) avisos.push(`${m.medio}: sin medición de impactos (no hay impresiones en el Tablero); suma solo inversión.`); continue; }
    porMedio[m.medio] = plata.map((v, i) => {
      if (!(v > 0)) return { impr: 0, alc: 0, clic: 0, vbase: 0, v50: 0 };
      if (r.fijo) return { impr: r.impr, alc: r.alc, clic: r.clic, vbase: r.vbase, v50: r.v50 };
      const a = inflAcum(infl, r.mesFin, ym(cfg.anio, i));
      a.faltan.forEach((k) => faltan.add(k));
      const real = v / a.f; // plata del plan en pesos del mes de referencia
      const impr = curva(r.impr, r.inv, real, r.b.impr);
      const vbase = r.impr > 0 ? impr * (r.vbase / r.impr) : 0;
      return { impr, alc: curva(r.alc, r.inv, real, r.b.alc), clic: curva(r.clic, r.inv, real, r.b.clic), vbase, v50: r.vbase > 0 ? vbase * (r.v50 / r.vbase) : 0 };
    });
    porMedio[m.medio]!.forEach((x, i) => { const t = total[i]!; t.impr += x.impr; t.alc += x.alc; t.clic += x.clic; t.vbase += x.vbase; t.v50 += x.v50; });
  }
  if (faltan.size) avisos.push(`Para llevar los costos de ${[...faltan].sort()[0]} en adelante falta la inflación de ${faltan.size} mes(es) (se tomó 0%): los impactos pueden estar sobreestimados.`);
  return { porMedio, total, avisos };
}

// ── Metas "Pauta Mkt" desde el plan ─────────────────────────────────────────
export const PLAN_META_KPIS = ["Inversión", "Alcance único", "Frecuencia", "Impresiones", "VTR (≥50%)", "Clicks"] as const;
export function metasDesdePlan(inv: PlanInversion, imp: PlanImpactos): Record<(typeof PLAN_META_KPIS)[number], (number | null)[]> {
  const r = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    "Inversión": inv.total.map((v) => (v > 0 ? r(v) : null)),
    "Alcance único": imp.total.map((t) => (t.alc > 0 ? r(t.alc) : null)),
    "Frecuencia": imp.total.map((t) => (t.alc > 0 ? r(t.impr / t.alc, 1) : null)),
    "Impresiones": imp.total.map((t) => (t.impr > 0 ? r(t.impr) : null)),
    "VTR (≥50%)": imp.total.map((t) => (t.vbase > 0 ? r((t.v50 / t.vbase) * 100, 1) : null)),
    "Clicks": imp.total.map((t) => (t.clic > 0 ? r(t.clic) : null)),
  };
}

/** Todo junto (lo usan la página, el navegador al editar y la API al aplicar metas). */
export function calcPlan(cfg: PlanConfig, refMeses: (PautaMesMedios | null)[], infl: InflacionMes) {
  const inversion = calcInversion(cfg, infl);
  const refs = referencias(refMeses, cfg.medios);
  const impactos = calcImpactos(cfg, inversion, refs, infl);
  return { inversion, refs, impactos, metas: metasDesdePlan(inversion, impactos) };
}

// ── Historial: qué cambió entre dos versiones del plan (para bgt_auditoria) ──
const MES3 = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
function planano(c: PlanConfig): Record<string, string | number> {
  const o: Record<string, string | number> = {};
  c.bgt.forEach((v, i) => { o[`BGT ${MES3[i]}`] = v; });
  for (const m of c.medios) {
    const p = `${m.medio} ·`;
    o[`${p} reparto`] = m.reparto; o[`${p} peso`] = m.peso; o[`${p} referencia`] = m.ref;
    if (m.reparto === "fijo") o[`${p} costo enero`] = m.costoEnero;
    if (m.reparto === "olas") m.olas.forEach((v, i) => { o[`${p} ola ${MES3[i]}`] = v; });
    PLAN_ROLES.forEach((r, k) => { o[`${p} ${r}`] = m.rol[k]!; });
    m.cat.forEach((v, i) => { o[`${p} categoría ${MES3[i]}`] = v ?? "mix"; });
  }
  for (const c0 of PLAN_CATS) (c.mix[c0] ?? []).forEach((v, i) => { o[`Mix ${c0} ${MES3[i]}`] = v; });
  return o;
}
export function difPlan(a: PlanConfig, b: PlanConfig): { antes: Record<string, string | number | null>; despues: Record<string, string | number | null> } {
  const A = planano(a), B = planano(b);
  const antes: Record<string, string | number | null> = {}, despues: Record<string, string | number | null> = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) if (A[k] !== B[k]) { antes[k] = A[k] ?? null; despues[k] = B[k] ?? null; }
  return { antes, despues };
}
