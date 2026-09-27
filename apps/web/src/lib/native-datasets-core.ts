// ============================================================================
// Datasets VIRTUALES de solo lectura sobre las fuentes nativas del dashboard (Plan de Medios, Web,
// Redes IG, Seguimiento) para "Mis tableros" y "Armame el tablero" (motor lib/viz). PURO y
// client-safe: recibe filas ya leídas y devuelve { id, name, columns, rows } como si fuera una
// planilla. El server (lib/native-datasets.ts) lee SOLO fuentes baratas/precalculadas.
// Portado de BIP (sep-2026) y adaptado a Drean:
//  · Mes = primer día del mes en ISO ("2026-03-01") → el motor lo toma como fecha.
//  · Plan de Medios = buildPautaMediosMensual (MISMO gap-fill que /performance y el Seguimiento:
//    Meta por API, OMD solo para medios sin API, PMax fuera, UGC dentro, solo meses cerrados).
//  · Alcance = suma por medio (no dedup cross-media, igual que el dash).
//  · "Inversión de medios con impresiones" = base de CPM/CPC (filas OMD con inversión y sin performance
//    inflarían el costo por mil; misma regla `invConImpr` que las señales).
//  · Redes = Instagram (el objetivo de Redes se mide solo con IG; FB reach no es confiable).
// Imports SOLO relativos (se compila suelto en los tests).
// ============================================================================
import type { Dataset } from "./viz/types";
import type { PautaMesMedios } from "./pauta-medios-model";

export const NATIVE_PREFIX = "nat:";
export const isNativeId = (id: string | null | undefined): boolean => typeof id === "string" && id.startsWith(NATIVE_PREFIX);

export type NativeKey = "pauta" | "pauta-medios" | "web" | "redes" | "seguimiento";
/** `dash` = ruta del dashboard de origen: el dataset se ofrece solo si el usuario puede ver esa ruta. */
export interface NativeDef { key: NativeKey; id: string; name: string; dash: string; descripcion: string }

export const NATIVE_DEFS: NativeDef[] = [
  { key: "pauta", id: "nat:pauta", name: "Plan de Medios · por mes", dash: "/performance", descripcion: "Inversión, impresiones, alcance, clicks y video por mes (mismo modelo que Plan de Medios)." },
  { key: "pauta-medios", id: "nat:pauta-medios", name: "Plan de Medios · por medio y mes", dash: "/performance", descripcion: "Inversión y resultados de cada medio por mes (Meta, YouTube, TikTok, OOH…)." },
  { key: "web", id: "nat:web", name: "Web · por mes", dash: "/web", descripcion: "Usuarios, sesiones, vistas, duración y conversiones de GA4 por mes." },
  { key: "redes", id: "nat:redes", name: "Redes · Instagram por mes", dash: "/redes", descripcion: "Alcance e interacciones orgánicas de Instagram por mes." },
  { key: "seguimiento", id: "nat:seguimiento", name: "Seguimiento · real vs meta", dash: "/overview", descripcion: "Cada KPI del Seguimiento Objetivos por mes: real, meta y cumplimiento." },
];
export const nativeDef = (id: string): NativeDef | undefined => NATIVE_DEFS.find((d) => d.id === id);

const p2 = (n: number) => String(n).padStart(2, "0");
const mesIso = (anio: number, mesIdx: number) => `${anio}-${p2(mesIdx + 1)}-01`;
const OFFLINE_RE = /\b(tv|television|televisi[oó]n|ooh|dooh|radio|cine|v[ií]a p[úu]blica|gr[aá]fica|revista|diario|prensa|out of home)\b/i;
export const tipoMedio = (medio: string) => (OFFLINE_RE.test(medio) ? "Offline" : "Online");

// ── Plan de Medios ──────────────────────────────────────────────────────────
export interface PautaYear { anio: number; meses: (PautaMesMedios | null)[] }

export function pautaMensual(years: PautaYear[]): Dataset {
  const d = nativeDef("nat:pauta")!;
  const rows: unknown[][] = [];
  for (const { anio, meses } of [...years].sort((a, b) => a.anio - b.anio)) {
    for (const m of meses) {
      if (!m) continue;
      const t = m.tot;
      if (!t.inv && !t.impr && !t.clic) continue;
      let invOff = 0, invConImpr = 0;
      for (const [medio, v] of Object.entries(m.medios)) { if (OFFLINE_RE.test(medio)) invOff += v.inv; if (v.impr > 0) invConImpr += v.inv; }
      rows.push([mesIso(anio, m.mesIdx), round(t.inv), t.impr, t.alc || null, t.clic, t.v50, t.vbase, round(invOff), round(invConImpr)]);
    }
  }
  return { id: d.id, name: d.name, columns: ["Mes", "Inversión", "Impresiones", "Alcance", "Clicks", "Reproducciones a la mitad del video", "Impresiones de video", "Inversión offline", "Inversión de medios con impresiones"], rows };
}

export function pautaPorMedio(years: PautaYear[]): Dataset {
  const d = nativeDef("nat:pauta-medios")!;
  const rows: unknown[][] = [];
  for (const { anio, meses } of [...years].sort((a, b) => a.anio - b.anio)) {
    for (const m of meses) {
      if (!m) continue;
      for (const medio of Object.keys(m.medios).sort()) {
        const v = m.medios[medio]!;
        if (!v.inv && !v.impr && !v.clic) continue;
        const fuente = v.fuente === "api" ? "API" : v.fuente === "omd" ? "OMD" : "OMD + API";
        rows.push([mesIso(anio, m.mesIdx), medio, tipoMedio(medio), round(v.inv), v.impr, v.alc || null, v.clic, fuente]);
      }
    }
  }
  return { id: d.id, name: d.name, columns: ["Mes", "Medio", "Tipo de medio", "Inversión", "Impresiones", "Alcance", "Clicks", "Fuente del dato"], rows };
}

// ── Web (vistas mensuales GA4) ───────────────────────────────────────────────
export interface WebMonthLike { mes: string; sesiones: number | null; pageviews: number | null; avg_session_duration: number | null }
export interface WebUsersLike { mes: string; total_users: number | null }
export interface WebChanLike { mes: string; conversiones: number | null }

export function webMensual(monthly: WebMonthLike[], users: WebUsersLike[], chan: WebChanLike[]): Dataset {
  const d = nativeDef("nat:web")!;
  const key = (m: string) => `${String(m).slice(0, 7)}-01`;
  const u = new Map(users.map((r) => [key(r.mes), r.total_users]));
  const conv = new Map<string, number>();
  for (const c of chan) conv.set(key(c.mes), (conv.get(key(c.mes)) ?? 0) + (Number(c.conversiones) || 0));
  const rows = monthly
    .filter((m) => /^\d{4}-\d{2}/.test(String(m.mes)))
    .map((m) => {
      const k = key(m.mes);
      const ses = Number(m.sesiones) || 0;
      const cv = conv.has(k) ? conv.get(k)! : null;
      return [k, u.get(k) ?? null, ses, Number(m.pageviews) || 0, m.avg_session_duration == null ? null : Math.round(Number(m.avg_session_duration) * 10) / 10,
        cv, cv != null && ses > 0 ? Math.round((cv / ses) * 10000) / 100 : null];
    })
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return { id: d.id, name: d.name, columns: ["Mes", "Usuarios", "Sesiones", "Vistas de página", "Duración media de sesión (s)", "Conversiones", "Tasa de conversión (%)"], rows };
}

// ── Redes (Instagram, posts de meta_posts agregados por mes; mismo cálculo que el dash de Redes) ──
export interface IgPostLike { fecha_post: string; reach: number | null; engagement: number | null; reactions: number | null; clicks: number | null; media_type?: string | null }

export function redesIgMensual(posts: IgPostLike[]): Dataset {
  const d = nativeDef("nat:redes")!;
  const by = new Map<string, { alc: number; eng: number; likes: number; guard: number; n: number; stories: number }>();
  for (const p of posts) {
    if (!/^\d{4}-\d{2}/.test(String(p.fecha_post))) continue;
    const k = `${p.fecha_post.slice(0, 7)}-01`;
    const m = by.get(k) ?? { alc: 0, eng: 0, likes: 0, guard: 0, n: 0, stories: 0 };
    m.alc += Number(p.reach) || 0;
    m.eng += Number(p.engagement) || 0;
    m.likes += Number(p.reactions) || 0;
    m.guard += Number(p.clicks) || 0; // guardados = columna clicks (mismo mapeo que el dash de IG)
    m.n++;
    if (String(p.media_type ?? "").toUpperCase() === "STORY") m.stories++;
    by.set(k, m);
  }
  const rows = [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, m]) => [
    k, "Instagram", m.alc, m.eng, m.likes, Math.max(0, m.eng - m.likes - m.guard), m.guard, m.n, m.stories,
    m.alc > 0 ? Math.round((m.eng / m.alc) * 10000) / 100 : null,
  ]);
  return { id: d.id, name: d.name, columns: ["Mes", "Red", "Alcance", "Interacciones", "Me gusta", "Comentarios", "Guardados", "Publicaciones", "Historias", "Engagement rate (%)"], rows };
}

// ── Seguimiento (real vs meta por KPI y mes) ─────────────────────────────────
export interface KpiSegLike { plan: string; kpi: string; unit: string; tipo: "sum" | "rate"; realM: (number | null)[]; metaM: (number | null)[]; direccion: "up" | "down" }
export function seguimientoTabla(anio: number, kpis: KpiSegLike[]): Dataset {
  const d = nativeDef("nat:seguimiento")!;
  const rows: unknown[][] = [];
  for (const k of kpis) {
    for (let i = 0; i < 12; i++) {
      const real = k.realM[i] ?? null, meta = k.metaM[i] ?? null;
      if (real == null && meta == null) continue;
      const cumpl = real != null && meta != null && meta !== 0 && real !== 0
        ? Math.round((k.direccion === "down" ? meta / real : real / meta) * 1000) / 10 : null;
      rows.push([mesIso(anio, i), k.plan, k.kpi, real, meta, cumpl, k.unit || "", k.tipo === "sum" ? "Volumen" : "Tasa"]);
    }
  }
  return { id: d.id, name: d.name, columns: ["Mes", "Plan", "KPI", "Real", "Meta", "Cumplimiento (%)", "Unidad", "Tipo de KPI"], rows };
}

function round(v: number): number { return Math.round(v * 100) / 100; }
