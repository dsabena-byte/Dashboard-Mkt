// Cálculo PURO de las Sugerencias de tiendas (port de vw_cb_baseline_medidas / vw_cb_suggestions / _detail del
// proyecto CB). Test: scripts/trade-carga.test.ts. Lo usa lib/trade-sugerencias.ts.
import { normClave } from "./trade-carga-core";
import type { CbBaselineMedidas, CbSuggestion, CbSuggestionDetail } from "./cb-queries";

export interface Hom { cliente: string | null; categoria: string | null; cuadro_basico: string | null; modelo: string; sku: string }
export interface Ex { numero_tienda: string | null; tienda: string | null; cadena: string | null; sku: string | null; existencia: number }
export interface CbMin { semana: number; tienda: string; target_cb: number; real_cb: number; target_inf: number; real_inf: number }

const up = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();
const numDe = (t: string) => t.match(/^(\d+)\s*-/)?.[1] ?? null;
const r1 = (x: number) => Math.round(x * 10) / 10;
// PostgreSQL compara texto con collation; para max() de nombres alcanza el orden de JS.
const maxStr = (a: string | null, b: string | null) => (a == null ? b : b == null ? a : a > b ? a : b);

export function calcularSugerencias(cb: CbMin[], ex: Ex[], hom: Hom[], cadenaCliente: Map<string, string>) {
  const semanas = [...new Set(cb.map((r) => r.semana))].sort((a, b) => b - a).slice(0, 3);
  const ult3 = new Set(semanas);
  const cb3 = cb.filter((r) => ult3.has(r.semana));
  const sum = (k: keyof CbMin) => cb3.reduce((s, r) => s + (r[k] as number), 0);
  const baseline: CbBaselineMedidas = {
    cb_pct_avg: sum("target_cb") ? r1((100 * sum("real_cb")) / sum("target_cb")) : null,
    infalt_pct_avg: sum("target_inf") ? r1((100 * sum("real_inf")) / sum("target_inf")) : null,
    tiendas_medidas: new Set(cb3.map((r) => r.tienda)).size,
    cb_ok_total: sum("real_cb"), cb_target_total: sum("target_cb"), infalt_ok_total: sum("real_inf"), infalt_target_total: sum("target_inf"),
  };

  const catalogo = new Map<string, { categoria: string; cuadro: string; modelo: string }[]>();
  const vistos = new Set<string>();
  for (const h of hom) {
    const k = `${up(h.cliente)}|${up(h.categoria)}|${up(h.cuadro_basico)}|${h.modelo}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    const l = catalogo.get(up(h.cliente)) ?? []; l.push({ categoria: up(h.categoria), cuadro: up(h.cuadro_basico), modelo: h.modelo }); catalogo.set(up(h.cliente), l);
  }
  const homPorSku = new Map<string, Hom[]>();
  for (const h of hom) homPorSku.set(h.sku, [...(homPorSku.get(h.sku) ?? []), h]);

  const tiendasRep = new Map<string, { tienda: string | null; cadena: string | null }>();
  for (const r of ex) {
    if (!r.numero_tienda) continue;
    const t = tiendasRep.get(r.numero_tienda) ?? { tienda: null, cadena: null };
    t.tienda = maxStr(t.tienda, r.tienda); t.cadena = maxStr(t.cadena, r.cadena);
    tiendasRep.set(r.numero_tienda, t);
  }

  const calc = (medidas: Set<string>) => {
    const noMedidas = [...tiendasRep].filter(([n]) => !medidas.has(n)).map(([n, t]) => ({
      numero: n, ...t, cliente: up(cadenaCliente.get(normClave(t.cadena)) ?? "SMALL RETAILERS"),
    }));
    const nm = new Set(noMedidas.map((x) => x.numero));
    // presentes: (numero|cliente|modelo) → skus encontrados
    const pres = new Map<string, Set<string>>();
    for (const r of ex) {
      if (!r.numero_tienda || !nm.has(r.numero_tienda) || !(r.existencia > 0) || !r.sku) continue;
      for (const h of homPorSku.get(r.sku) ?? []) {
        const k = `${r.numero_tienda}|${up(h.cliente)}|${h.modelo}`;
        pres.set(k, (pres.get(k) ?? new Set()).add(r.sku));
      }
    }
    return { noMedidas, pres };
  };

  // Resumen: medidas = TODAS las semanas del CB (como vw_cb_suggestions).
  const todas = calc(new Set(cb.map((r) => numDe(r.tienda)).filter((x): x is string => !!x)));
  const suggestions: CbSuggestion[] = [];
  for (const t of todas.noMedidas) {
    const cat = catalogo.get(t.cliente) ?? [];
    if (!cat.length) continue;
    let ct = 0, co = 0, it = 0, io = 0, et = 0, eo = 0;
    for (const c of cat) {
      const p = todas.pres.has(`${t.numero}|${t.cliente}|${c.modelo}`) ? 1 : 0;
      ct++; co += p;
      if (c.cuadro === "INFALTABLE") { it++; io += p; }
      if (c.cuadro === "ESTRATEGICO") { et++; eo += p; }
    }
    suggestions.push({
      numero_tienda: t.numero, tienda: t.tienda ?? "", cadena: t.cadena ?? "",
      cb_target: ct, cb_ok: co, cb_pct: r1((100 * co) / ct),
      infalt_target: it, infalt_ok: io, infalt_pct: it ? r1((100 * io) / it) : null,
      estrat_target: et, estrat_ok: eo, estrat_pct: et ? r1((100 * eo) / et) : null,
    });
  }

  // Detalle: medidas = últimas 3 semanas (como vw_cb_suggestions_detail).
  const ult = calc(new Set(cb3.map((r) => numDe(r.tienda)).filter((x): x is string => !!x)));
  const details: CbSuggestionDetail[] = [];
  for (const t of ult.noMedidas) {
    for (const c of catalogo.get(t.cliente) ?? []) {
      const skus = ult.pres.get(`${t.numero}|${t.cliente}|${c.modelo}`);
      details.push({
        numero_tienda: t.numero, cuadro_basico: c.cuadro, categoria: c.categoria, modelo: c.modelo,
        presente: skus ? 1 : 0, found_sku: !skus ? null : skus.has(c.modelo) ? c.modelo : [...skus].sort()[0] ?? null,
      });
    }
  }
  return { baseline, suggestions, details };
}

