"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings2, ChevronDown, Check, Loader2 } from "lucide-react";
import {
  CAT_GENERAL,
  cumplimientoPct,
  defaultConfig,
  SEMAFORO_COLOR,
  semaforoDe,
  type Agregacion,
  type Direccion,
  type Frecuencia,
  type MetaConfig,
  type MetaValor,
  type Referencia,
} from "@/lib/metas";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export interface KpiSpec {
  nombre: string;
  /** Categorías de negocio para desglosar la meta (ej: Lavado/Refrigeración/Cocción). */
  categorias?: string[];
  /** Unidad sugerida al crear la config ('%', '$', 'u', 'pts', 'x'). */
  unidad?: string;
  /** Valor real del mes en curso, para el semáforo. */
  actual?: number | null;
}

interface Props {
  plan: string;
  kpis: KpiSpec[];
  anio?: number;
  mes?: number; // 1-12, mes en curso
  titulo?: string;
  subtitulo?: string;
  /** Si true, no hace router.refresh() al guardar (para contextos sin server
   * components que dependan de la meta, ej. dentro del editor del Mapa: el refresh
   * remontaría el editor cliente y haría flash). */
  skipRefresh?: boolean;
  /** Peso de cada categoría (categoría → peso). Si viene, el KPI se carga SOLO por
   * categoría y el valor "General" se CALCULA como Σ (categoría × peso) (read-only),
   * en vez de cargarse a mano. El tab General va último. */
  catPesos?: Record<string, number>;
}

const keyCfg = (kpi: string, cat: string) => `${kpi}|${cat}`;
const keyVal = (kpi: string, cat: string, mes: number) => `${kpi}|${cat}|${mes}`;

function fmt(n: number | null | undefined, unidad?: string | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  let s: string;
  if (abs >= 1_000_000) s = `${(n / 1_000_000).toFixed(1)}M`;
  else if (abs >= 10_000) s = `${(n / 1_000).toFixed(0)}K`;
  else s = n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
  return unidad === "%" ? `${s}%` : unidad === "$" ? `$${s}` : s;
}

export function MetaPanel({ plan, kpis, anio, mes, titulo, subtitulo, skipRefresh, catPesos }: Props) {
  const now = new Date();
  const year = anio ?? now.getFullYear();
  const month = mes ?? now.getMonth() + 1;

  const [cfgMap, setCfgMap] = useState<Record<string, MetaConfig>>({});
  const [valMap, setValMap] = useState<Record<string, number | null>>({});
  const [touchedCfg, setTouchedCfg] = useState<Set<string>>(new Set());
  const [touchedVal, setTouchedVal] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [catTab, setCatTab] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/metas?plan=${encodeURIComponent(plan)}`, { cache: "no-store" });
        const data = res.ok ? ((await res.json()) as { config: MetaConfig[]; valores: MetaValor[] }) : { config: [], valores: [] };
        if (!alive) return;
        const cm: Record<string, MetaConfig> = {};
        for (const c of data.config) cm[keyCfg(c.kpi, c.categoria)] = c;
        const vm: Record<string, number | null> = {};
        for (const v of data.valores) if (v.anio === year) vm[keyVal(v.kpi, v.categoria, v.mes)] = v.valor;
        setCfgMap(cm);
        setValMap(vm);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [plan, year]);

  const getCfg = (kpi: string, cat: string, unidad?: string): MetaConfig => {
    const c = cfgMap[keyCfg(kpi, cat)];
    if (c) return c;
    const d = defaultConfig(plan, kpi, cat);
    if (unidad) d.unidad = unidad;
    return d;
  };

  const setCfg = (kpi: string, cat: string, patch: Partial<MetaConfig>, unidad?: string) => {
    const key = keyCfg(kpi, cat);
    setCfgMap((prev) => ({ ...prev, [key]: { ...getCfg(kpi, cat, unidad), ...patch } }));
    setTouchedCfg((prev) => new Set(prev).add(key));
  };

  const setVal = (kpi: string, cat: string, m: number, raw: string) => {
    const key = keyVal(kpi, cat, m);
    const num = raw.trim() === "" ? null : Number(raw);
    setValMap((prev) => ({ ...prev, [key]: num == null || Number.isNaN(num) ? null : num }));
    setTouchedVal((prev) => new Set(prev).add(key));
    // Asegura que exista config (para que el semáforo tenga umbrales) al cargar un valor.
    const ckey = keyCfg(kpi, cat);
    if (!cfgMap[ckey]) setCfg(kpi, cat, {});
  };

  // Modo por categoría (catPesos): el "General" NO se carga a mano, se calcula como
  // Σ (valor de categoría × peso normalizado de la categoría). Read-only.
  const catPesoNorm: Record<string, number> | null = (() => {
    if (!catPesos) return null;
    const t = Object.values(catPesos).reduce((a, b) => a + b, 0) || 1;
    const out: Record<string, number> = {};
    for (const [c, w] of Object.entries(catPesos)) out[c] = w / t;
    return out;
  })();
  const computedGeneral = (kpi: string, m: number): number | null => {
    if (!catPesoNorm) return null;
    let sum = 0, any = false;
    for (const [cat, w] of Object.entries(catPesoNorm)) {
      const v = valMap[keyVal(kpi, cat, m)];
      if (v != null) { sum += v * w; any = true; }
    }
    return any ? sum : null;
  };

  const dirty = touchedCfg.size > 0 || touchedVal.size > 0;
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true); // arranca colapsado para no ocupar espacio

  async function save() {
    setSaving(true);
    try {
      const config: MetaConfig[] = [...touchedCfg].map((k) => cfgMap[k]).filter(Boolean) as MetaConfig[];
      const valores: MetaValor[] = [...touchedVal].map((k) => {
        const [kpi, cat, m] = k.split("|");
        return { plan, kpi: kpi!, categoria: cat!, anio: year, mes: Number(m), valor: valMap[k] ?? null };
      });
      // Toda config referida por un valor pero no tocada aún: mándala también.
      const cfgKeys = new Set(config.map((c) => keyCfg(c.kpi, c.categoria)));
      for (const v of valores) {
        const ck = keyCfg(v.kpi, v.categoria);
        if (!cfgKeys.has(ck)) { config.push(getCfg(v.kpi, v.categoria)); cfgKeys.add(ck); }
      }
      const res = await fetch("/api/metas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, valores }),
      });
      if (res.ok) {
        setTouchedCfg(new Set());
        setTouchedVal(new Set());
        setSavedAt(Date.now());
        // Re-renderiza los server components (gráficos/cards) para que tomen la meta nueva.
        // En el editor del Mapa (skipRefresh) NO: el refresh remontaría el editor cliente.
        if (!skipRefresh) router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className={`flex flex-wrap items-center justify-between gap-2 ${collapsed ? "" : "mb-3"}`}>
        <button type="button" onClick={() => setCollapsed((c) => !c)} className="flex flex-1 items-start gap-2 text-left">
          <ChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition ${collapsed ? "-rotate-90" : ""}`} />
          <div>
            <h3 className="text-sm font-semibold tracking-tight">{titulo ?? "Metas del mes"}</h3>
            {!collapsed && (
              <p className="text-[11px] text-muted-foreground">
                {subtitulo ?? `Cargá la meta mensual de cada KPI. El semáforo compara el valor real de ${MESES[month - 1]} vs la meta.`}
              </p>
            )}
          </div>
        </button>
        {!collapsed && (
          <div className="flex items-center gap-2">
            {savedAt && !dirty && <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600"><Check className="h-3.5 w-3.5" />Guardado</span>}
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Guardar
            </button>
          </div>
        )}
      </div>

      {collapsed ? null : loading ? (
        <div className="py-8 text-center text-xs text-muted-foreground">Cargando metas…</div>
      ) : (
        <div className="divide-y">
          {kpis.map((k) => {
            const cfg = getCfg(k.nombre, CAT_GENERAL, k.unidad);
            const metaMes = catPesos ? computedGeneral(k.nombre, month) : (valMap[keyVal(k.nombre, CAT_GENERAL, month)] ?? null);
            const cumpl = cumplimientoPct(k.actual, metaMes, cfg.direccion);
            const sem = semaforoDe(cumpl, cfg);
            const isOpen = open === k.nombre;
            const cats = k.categorias ?? [];
            const activeCat = catTab[k.nombre] ?? CAT_GENERAL;

            return (
              <div key={k.nombre} className="py-2.5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEMAFORO_COLOR[sem] }} title={sem} />
                  <span className="min-w-[140px] flex-1 text-sm font-medium">{k.nombre}</span>

                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    Meta {MESES[month - 1]}
                    {catPesos ? (
                      <span className="w-24 rounded-md border border-transparent bg-muted/50 px-2 py-1 text-right text-xs font-medium tabular-nums" title="Calculado desde las categorías">
                        {fmt(metaMes, cfg.unidad)}
                      </span>
                    ) : (
                      <input
                        type="number"
                        inputMode="decimal"
                        value={metaMes ?? ""}
                        onChange={(e) => setVal(k.nombre, CAT_GENERAL, month, e.target.value)}
                        className="w-24 rounded-md border bg-background px-2 py-1 text-right text-xs tabular-nums"
                        placeholder="—"
                      />
                    )}
                    {cfg.unidad && <span className="text-muted-foreground/70">{cfg.unidad}</span>}
                  </label>

                  <div className="text-right text-[11px] text-muted-foreground">
                    <div>Real: <span className="font-medium text-foreground tabular-nums">{fmt(k.actual, cfg.unidad)}</span></div>
                    <div>Cumpl.: <span className="font-medium tabular-nums" style={{ color: SEMAFORO_COLOR[sem] }}>{cumpl == null ? "—" : `${Math.round(cumpl)}%`}</span></div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : k.nombre)}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    Configurar
                    <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-3 space-y-3 rounded-md border bg-muted/30 p-3">
                    {cats.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(catPesos ? [...cats, CAT_GENERAL] : [CAT_GENERAL, ...cats]).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCatTab((p) => ({ ...p, [k.nombre]: c }))}
                            className={`rounded-full px-2.5 py-0.5 text-[11px] ${activeCat === c ? "bg-primary text-primary-foreground" : "border text-muted-foreground hover:bg-muted"}`}
                          >
                            {c === CAT_GENERAL ? "General" : c}
                          </button>
                        ))}
                      </div>
                    )}

                    <ConfigRow
                      cfg={getCfg(k.nombre, activeCat, k.unidad)}
                      onChange={(patch) => setCfg(k.nombre, activeCat, patch, k.unidad)}
                    />

                    {(() => {
                      const computedTab = catPesos != null && activeCat === CAT_GENERAL; // General calculado, read-only
                      return (
                        <div>
                          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Meta mensual {year}{activeCat !== CAT_GENERAL ? ` · ${activeCat}` : computedTab ? " · General (calculado)" : ""}
                          </div>
                          {computedTab && (
                            <p className="mb-1.5 text-[10px] text-muted-foreground/80">= Σ (categoría × peso): {Object.entries(catPesos!).map(([c, w]) => `${c} ${w}%`).join(" · ")}. Se carga por categoría, no acá.</p>
                          )}
                          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
                            {MESES.map((mLabel, i) => {
                              const m = i + 1;
                              if (computedTab) {
                                return (
                                  <div key={m} className="flex flex-col gap-0.5">
                                    <span className={`text-center text-[9px] uppercase ${m === month ? "font-bold text-foreground" : "text-muted-foreground"}`}>{mLabel}</span>
                                    <span className="w-full rounded border border-transparent bg-muted/50 px-1 py-1 text-center text-[11px] font-medium tabular-nums" title="Calculado desde las categorías">
                                      {(() => { const g = computedGeneral(k.nombre, m); return g == null ? "—" : Number.isInteger(g) ? String(g) : g.toFixed(1); })()}
                                    </span>
                                  </div>
                                );
                              }
                              const v = valMap[keyVal(k.nombre, activeCat, m)] ?? null;
                              return (
                                <label key={m} className="flex flex-col gap-0.5">
                                  <span className={`text-center text-[9px] uppercase ${m === month ? "font-bold text-foreground" : "text-muted-foreground"}`}>{mLabel}</span>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    value={v ?? ""}
                                    onChange={(e) => setVal(k.nombre, activeCat, m, e.target.value)}
                                    className={`w-full rounded border bg-background px-1 py-1 text-center text-[11px] tabular-nums ${m === month ? "border-primary/60" : ""}`}
                                    placeholder="—"
                                  />
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Sel<T extends string>({ label, value, opts, onChange }: { label: string; value: T; opts: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-md border bg-background px-2 py-1 text-[11px] text-foreground"
      >
        {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}

function ConfigRow({ cfg, onChange }: { cfg: MetaConfig; onChange: (patch: Partial<MetaConfig>) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-2.5">
      <Sel<Direccion>
        label="Dirección"
        value={cfg.direccion}
        opts={[{ v: "up", l: "Mejor mayor ↑" }, { v: "down", l: "Mejor menor ↓" }]}
        onChange={(v) => onChange({ direccion: v })}
      />
      <Sel<Referencia>
        label="Se compara vs"
        value={cfg.referencia}
        opts={[{ v: "interno", l: "Dato interno" }, { v: "mercado", l: "Mercado" }, { v: "periodo", l: "Período anterior" }]}
        onChange={(v) => onChange({ referencia: v })}
      />
      <Sel<Agregacion>
        label="Agregación"
        value={cfg.agregacion}
        opts={[{ v: "mensual", l: "Mensual" }, { v: "U3M", l: "U3M" }, { v: "U4M", l: "U4M" }, { v: "MAT", l: "MAT" }, { v: "YTD", l: "YTD" }]}
        onChange={(v) => onChange({ agregacion: v })}
      />
      <Sel<Frecuencia>
        label="Frecuencia"
        value={cfg.frecuencia}
        opts={[{ v: "mensual", l: "Mensual" }, { v: "semanal", l: "Semanal" }, { v: "trimestral", l: "Trimestral" }]}
        onChange={(v) => onChange({ frecuencia: v })}
      />
      <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
        Unidad
        <input
          value={cfg.unidad ?? ""}
          onChange={(e) => onChange({ unidad: e.target.value || null })}
          placeholder="%, $, u"
          className="w-16 rounded-md border bg-background px-2 py-1 text-[11px] text-foreground"
        />
      </label>
      <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
        Umbral verde ≥
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={cfg.umbralVerde}
            onChange={(e) => onChange({ umbralVerde: Number(e.target.value) })}
            className="w-16 rounded-md border bg-background px-2 py-1 text-right text-[11px] text-foreground tabular-nums"
          />
          <span className="text-muted-foreground/70">%</span>
        </div>
      </label>
      <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
        Umbral amarillo ≥
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={cfg.umbralAmarillo}
            onChange={(e) => onChange({ umbralAmarillo: Number(e.target.value) })}
            className="w-16 rounded-md border bg-background px-2 py-1 text-right text-[11px] text-foreground tabular-nums"
          />
          <span className="text-muted-foreground/70">%</span>
        </div>
      </label>
    </div>
  );
}
