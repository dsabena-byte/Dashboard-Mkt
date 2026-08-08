"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";
import type { ShareRow, TrendRow, DemandaRow } from "@/lib/competitive-queries";
import { marcasDeCategoria, type Categoria } from "@/lib/competitive-config";

// Colores del set competitivo. Drean resaltado; el resto en paleta distinguible.
const COLOR: Record<string, string> = {
  Drean: "#2b4dff", Whirlpool: "#0ea5e9", Electrolux: "#14b8a6", Samsung: "#6366f1",
  LG: "#e11d48", BGH: "#f59e0b", Gafa: "#84cc16", Philco: "#a855f7", Hisense: "#64748b", Midea: "#ec4899",
  Escorial: "#d97706", Florencia: "#db2777", Orbis: "#0891b2",
};
const colorOf = (b: string) => COLOR[b] ?? "#94a3b8";
const CATS: Array<{ key: string; label: string; emoji: string }> = [
  { key: "lavarropas", label: "Lavarropas", emoji: "🧺" },
  { key: "heladeras", label: "Heladeras", emoji: "❄️" },
  { key: "cocinas", label: "Cocinas", emoji: "🔥" },
];

const mesCorto = (m: string) => {
  const [y, mm] = m.split("-");
  return `${["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][Number(mm)]} ${y?.slice(2)}`;
};
const fmtNum = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(Math.round(n)));

const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 };

export function SeoSearchClient({
  share,
  trends,
  demanda,
}: {
  share: ShareRow[];
  trends: TrendRow[];
  demanda: DemandaRow[];
}) {
  const [cat, setCat] = useState("lavarropas");

  // Marcas que compiten en la categoría seleccionada (por config, no todas).
  const brands = useMemo(() => marcasDeCategoria(cat as Categoria), [cat]);
  const meses = useMemo(() => [...new Set(share.map((r) => r.mes))].sort(), [share]);
  const ultMes = meses[meses.length - 1] ?? "";

  // Snapshot del último mes (ordenado por share desc).
  const snapshot = useMemo(
    () =>
      share
        .filter((r) => r.categoria === cat && r.mes === ultMes)
        .sort((a, b) => b.share_pct - a.share_pct),
    [share, cat, ultMes],
  );

  // Evolución: share por marca a lo largo de los meses (para el área 100%).
  const evolucion = useMemo(() => {
    const rows = share.filter((r) => r.categoria === cat);
    return meses.map((m) => {
      const o: Record<string, number | string> = { mes: mesCorto(m) };
      for (const b of brands) {
        o[b] = rows.find((r) => r.mes === m && r.marca === b)?.share_pct ?? 0;
      }
      return o;
    });
  }, [share, cat, meses, brands]);

  // Trends (interés 0-100) por marca, serie semanal.
  const trendSeries = useMemo(() => {
    const rows = trends.filter((r) => r.categoria === cat);
    const fechas = [...new Set(rows.map((r) => r.fecha))].sort();
    return fechas.map((f) => {
      const o: Record<string, number | string> = { fecha: f.slice(5) };
      for (const b of brands) o[b] = rows.find((r) => r.fecha === f && r.marca === b)?.interes ?? 0;
      return o;
    });
  }, [trends, cat, brands]);

  // KPIs: demanda total de marcas de la categoría (último mes) + Drean.
  const kpis = useMemo(() => {
    const total = snapshot.reduce((s, r) => s + r.vol, 0);
    const drean = snapshot.find((r) => r.marca === "Drean");
    const rank = snapshot.findIndex((r) => r.marca === "Drean") + 1;
    const gen = demanda.filter((r) => r.categoria === cat).slice(-1)[0]?.search_volume ?? null;
    return { total, dreanShare: drean?.share_pct ?? 0, dreanVol: drean?.vol ?? 0, rank, gen };
  }, [snapshot, demanda, cat]);

  // Crecimiento de demanda por marca: volumen del último mes vs 12 meses atrás
  // (YoY). Ideal para ver quién acelera (Hisense/Midea) o cae.
  const crecimiento = useMemo(() => {
    const primerMes = meses[0];
    const rows = share.filter((r) => r.categoria === cat);
    return brands
      .map((b) => {
        const volUlt = rows.find((r) => r.mes === ultMes && r.marca === b)?.vol ?? 0;
        const volIni = rows.find((r) => r.mes === primerMes && r.marca === b)?.vol ?? 0;
        const g = volIni > 0 ? ((volUlt - volIni) / volIni) * 100 : volUlt > 0 ? 100 : 0;
        return { marca: b, growth: g, volUlt, volIni };
      })
      .sort((a, b) => b.growth - a.growth);
  }, [share, cat, ultMes, meses, brands]);

  const dreanGrowth = crecimiento.find((c) => c.marca === "Drean")?.growth ?? 0;

  return (
    <div className="space-y-6">
      {/* Tabs de categoría */}
      <div className="flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              cat === c.key ? "border-transparent bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
            }`}
          >
            {c.emoji} {c.label}
          </button>
        ))}
        <span className="ml-auto self-center text-[11px] text-muted-foreground">
          Último dato: {ultMes ? mesCorto(ultMes) : "—"} · fuente: DataForSEO (búsquedas AR)
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Share of Search · Drean" value={`${kpis.dreanShare.toFixed(1)}%`} sub={`Ranking #${kpis.rank} de ${brands.length}`} accent />
        <Kpi label="Búsquedas Drean / mes" value={fmtNum(kpis.dreanVol)} sub={`${dreanGrowth >= 0 ? "▲" : "▼"} ${dreanGrowth.toFixed(0)}% YoY`} />
        <Kpi label="Demanda genérica" value={kpis.gen != null ? fmtNum(kpis.gen) : "—"} sub={`"${cat}" (mes)`} />
        <Kpi label="Demanda total marcas" value={fmtNum(kpis.total)} sub="suma del set (mes)" />
      </div>

      {/* Share of Search — snapshot */}
      <Card title="Share of Search — último mes" subtitle="Participación de cada marca en las búsquedas de la categoría (predice market share). Drean resaltado.">
        <ResponsiveContainer width="100%" height={Math.max(240, snapshot.length * 30)}>
          <BarChart data={snapshot} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
            <XAxis type="number" tickFormatter={(v) => `${v}%`} fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <YAxis type="category" dataKey="marca" width={78} fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={tooltipStyle} />
            <Bar dataKey="share_pct" radius={[0, 4, 4, 0]}>
              {snapshot.map((r) => (
                <Cell key={r.marca} fill={colorOf(r.marca)} fillOpacity={r.marca === "Drean" ? 1 : 0.75} />
              ))}
              <LabelList dataKey="share_pct" position="right" fontSize={10} formatter={(v: number) => `${v.toFixed(1)}%`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Crecimiento de demanda (YoY) */}
      <Card title="Crecimiento de demanda — YoY" subtitle="Variación del volumen de búsqueda del último mes vs 12 meses atrás. Positivo = la marca acelera (clave para Hisense/Midea); negativo = pierde demanda.">
        <ResponsiveContainer width="100%" height={Math.max(240, crecimiento.length * 30)}>
          <BarChart data={crecimiento} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
            <XAxis type="number" tickFormatter={(v) => `${v}%`} fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <YAxis type="category" dataKey="marca" width={78} fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <Tooltip formatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`} contentStyle={tooltipStyle} />
            <Bar dataKey="growth" radius={[0, 4, 4, 0]}>
              {crecimiento.map((d) => (
                <Cell key={d.marca} fill={d.growth >= 0 ? "#10b981" : "#e11d48"} fillOpacity={d.marca === "Drean" ? 1 : 0.7} />
              ))}
              <LabelList dataKey="growth" position="right" fontSize={10} formatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Share of Search — evolución (área 100%) */}
      <Card title="Share of Search — evolución 12 meses" subtitle="Cómo se mueven las bandas de share mes a mes. Ideal para ver marcas que ganan/pierden terreno (Hisense/Midea en la rampa).">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={evolucion} margin={{ top: 8, right: 12, left: 0, bottom: 4 }} stackOffset="expand">
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="mes" fontSize={10} stroke="hsl(var(--muted-foreground))" />
            <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} fontSize={10} stroke="hsl(var(--muted-foreground))" />
            <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {brands.map((b) => (
              <Area key={b} type="monotone" dataKey={b} stackId="s" stroke={colorOf(b)} fill={colorOf(b)} fillOpacity={b === "Drean" ? 0.95 : 0.6} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Google Trends — interés */}
      <Card title="Interés de búsqueda (Google Trends)" subtitle="Índice 0-100, serie semanal. Complementa el volumen absoluto con la forma/estacionalidad.">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendSeries} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="fecha" fontSize={10} stroke="hsl(var(--muted-foreground))" interval={5} />
            <YAxis fontSize={10} stroke="hsl(var(--muted-foreground))" domain={[0, 100]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {brands.map((b) => (
              <Line key={b} type="monotone" dataKey={b} stroke={colorOf(b)} strokeWidth={b === "Drean" ? 2.5 : 1} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "bg-primary/5" : "bg-card"}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${accent ? "text-primary" : ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle && <p className="mb-3 mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
      {children}
    </div>
  );
}
