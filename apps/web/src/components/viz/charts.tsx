"use client";
import { useEffect, useRef, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import type { Result, Widget, NumFormat } from "@/lib/viz";
import { fmtValue } from "@/lib/viz/format";
import { AXIS, GRID, INK, LABEL, META_FILL, META_LINE, META_STROKE, REAL, Y_W, paletteOf, tooltipLabelStyle, tooltipStyle } from "./theme";

// Gráficos cartesianos (barras, líneas, área, combo), torta/dona, dispersión y cascada.
// Clic en una barra/porción/punto → onSelect(clave de x) para el filtro cruzado.

type Row = { __key: string; __label: string; __target?: number | null; [k: string]: string | number | null | undefined };
type SeriesDef = { key: string; name: string; color: string; format: NumFormat; mark: "bar" | "line"; axis: "left" | "right"; meta?: boolean };
export interface ChartProps { r: Result; w: Widget; height: number; selected?: string | null; onSelect?: (key: string, label: string) => void }

const MAX_SERIES = 12;

/** Filas anchas para recharts: una fila por x, una columna por serie (serie de color o medida). */
function wide(r: Result, w: Widget): { rows: Row[]; series: SeriesDef[] } {
  const pal = paletteOf(w.opts.palette, r.dims[1] ? r.seriesKeys.length : r.measures.length);
  const byX = new Map<string, Row>();
  for (const x of r.xKeys) byX.set(x.key, { __key: x.key, __label: x.label });
  const series: SeriesDef[] = [];
  const fmt0 = (w.opts.format && w.opts.format !== "auto" ? w.opts.format : r.measures[0]?.format) ?? "auto";
  if (r.dims[1]) {
    const sk = r.seriesKeys.slice(0, MAX_SERIES);
    const idx = new Map(sk.map((s, i) => [s.key, i]));
    sk.forEach((s, i) => series.push({ key: `s${i}`, name: s.label, color: pal[i % pal.length]!, format: fmt0, mark: "bar", axis: "left" }));
    for (const row of r.rows) { const i = idx.get(row.keys[1]!); const tr = byX.get(row.keys[0]!); if (i == null || !tr) continue; tr[`s${i}`] = row.values[0]; }
  } else {
    const anyRight = r.measures.some((m) => m.axis === "right");
    r.measures.forEach((m, i) => {
      const combo = w.type === "combo";
      const mark = m.mark ?? (combo && i > 0 ? "line" : "bar");
      const axis = m.axis ?? (combo && i > 0 && !anyRight && r.measures[0]!.format !== m.format ? "right" : "left");
      const color = combo ? (mark === "line" ? (i === 1 ? INK : pal[(i + 1) % pal.length]!) : pal[i % pal.length]!) : pal[i % pal.length]!;
      series.push({ key: `m${i}`, name: m.label, color: m.asMeta ? META_LINE : color, format: i === 0 ? fmt0 : m.format, mark, axis, meta: m.asMeta });
    });
    for (const row of r.rows) {
      const tr = byX.get(row.keys[0]!); if (!tr) continue;
      row.values.forEach((v, i) => { tr[`m${i}`] = v; });
      if (r.hasTarget) tr.__target = row.target ?? null;
    }
  }
  return { rows: [...byX.values()], series };
}

const tick = (f: NumFormat) => (v: unknown) => fmtValue(Number(v), f);
const tipFmt = (series: SeriesDef[], targetFmt: NumFormat) => (v: unknown, _n: unknown, item: unknown) => {
  const dk = (item as { dataKey?: string })?.dataKey;
  const s = series.find((x) => x.key === dk);
  return fmtValue(v == null ? null : Number(v), s?.format ?? targetFmt, false);
};
const payloadKey = (d: unknown): Row | undefined => (d as { payload?: Row })?.payload;

/** Ancho real del contenedor (para decidir densidad de etiquetas). */
function useWidth(initial: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((es) => { const x = es[0]?.contentRect.width; if (x) setCw(x); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, cw };
}

export function CartesianChart(props: ChartProps) {
  const { ref, cw } = useWidth(props.w.w * 300);
  return <div ref={ref} style={{ width: "100%" }}><CartesianInner {...props} cw={cw} /></div>;
}

function CartesianInner({ r, w, height, selected, onSelect, cw }: ChartProps & { cw: number }) {
  const { rows, series } = wide(r, w);
  const horizontal = w.type === "bar" && w.opts.orientation === "h";
  const stack = w.opts.stack ?? "none";
  const stacked = stack !== "none" && series.length > 1;
  const nX = rows.length;
  // Etiquetas de valor solo si entran (aunque estén activadas).
  const perGroup = stacked ? 1 : Math.max(1, series.filter((x) => x.mark === "bar").length + (r.hasTarget ? 1 : 0));
  const room = (cw - 80) / Math.max(1, nX) / (w.type === "line" || w.type === "area" ? 1 : perGroup);
  const showLabels = (w.opts.labels ?? (nX <= 16 && series.length <= 2 && !stacked)) && (w.opts.orientation === "h" && w.type === "bar" ? true : room >= 32);
  const legend = w.opts.legend ?? (series.length > 1 || r.hasTarget);
  const fmtL = series.find((s) => s.axis === "left")?.format ?? "auto";
  const fmtR = series.find((s) => s.axis === "right")?.format ?? "auto";
  const hasRight = series.some((s) => s.axis === "right");
  const targetFmt = series[0]?.format ?? "auto";
  const dim = (k: string) => (selected && k !== selected ? 0.35 : 1);
  const click = (d: unknown) => { const p = payloadKey(d); if (p && onSelect) onSelect(p.__key, p.__label); };
  const tip = <Tooltip formatter={tipFmt(series, targetFmt)} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: "rgba(100,116,139,.06)" }} />;
  const leg = legend ? <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span style={{ color: "#16202e" }}>{String(v)}</span>} /> : null;
  const labelFmt = (f: NumFormat) => (v: unknown) => (v == null || v === 0 ? "" : fmtValue(Number(v), f));

  if (horizontal) {
    const maxLen = Math.max(...rows.map((x) => x.__label.length), 4);
    const yW = Math.min(180, Math.max(60, maxLen * 6.4 + 10));
    const h = Math.min(900, Math.max(height, nX * (stacked || series.length === 1 ? 26 : 16 * series.length + 8) + 50));
    return (
      <ResponsiveContainer width="100%" height={h}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: showLabels ? 48 : 16, left: 4, bottom: 4 }} stackOffset={stack === "percent" ? "expand" : undefined} barCategoryGap="22%">
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
          <XAxis type="number" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} tickFormatter={stack === "percent" ? (v) => `${Math.round(Number(v) * 100)}%` : tick(fmtL)} />
          <YAxis type="category" dataKey="__label" stroke={AXIS} fontSize={11} width={yW} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
          {tip}{leg}
          {r.hasTarget && !r.dims[1] && <Bar dataKey="__target" name={r.targetLabel ?? "Meta"} fill={META_FILL} stroke={META_STROKE} strokeWidth={1} radius={[0, 3, 3, 0]} />}
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.meta ? META_FILL : s.color} stroke={s.meta ? META_STROKE : undefined} strokeWidth={s.meta ? 1 : 0} stackId={stacked ? "a" : undefined} radius={stacked ? 0 : [0, 3, 3, 0]} onClick={click} style={{ cursor: onSelect ? "pointer" : undefined }}>
              {rows.map((row) => <Cell key={row.__key} fillOpacity={dim(row.__key)} />)}
              {showLabels && <LabelList dataKey={s.key} position="right" fontSize={10} fill={LABEL} formatter={labelFmt(s.format)} />}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Densidad de etiquetas del eje X según el ancho del widget (≈300px por columna de la grilla).
  const avail = cw - 80;
  const maxLen = Math.max(...rows.map((x) => x.__label.length), 1);
  const fits = nX * (maxLen * 6.3 + 10) <= avail;
  const angled = !fits;
  const step = angled && nX * 17 > avail ? Math.ceil((nX * 17) / avail) - 1 : 0;
  const xAxis = <XAxis dataKey="__label" stroke={AXIS} fontSize={10.5} tickLine={false} axisLine={{ stroke: GRID }} interval={step} angle={angled ? -35 : 0} textAnchor={angled ? "end" : "middle"} height={angled ? Math.min(70, 18 + maxLen * 4.2) : 24} />;
  const yLeft = <YAxis yAxisId="l" width={Y_W} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} tickFormatter={stack === "percent" ? (v) => `${Math.round(Number(v) * 100)}%` : tick(fmtL)} />;
  const yRight = hasRight ? <YAxis yAxisId="r" orientation="right" width={Y_W} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} tickFormatter={tick(fmtR)} /> : null;
  const margin = { top: showLabels ? 20 : 10, right: hasRight ? 4 : 12, left: 0, bottom: 4 };
  const dot = nX > 40 ? false : { r: 2.5, strokeWidth: 1, stroke: "#fff" };

  if (w.type === "line" || w.type === "area") {
    const C = w.type === "area" ? AreaChart : LineChart;
    return (
      <ResponsiveContainer width="100%" height={height}>
        <C data={rows} margin={margin} stackOffset={stack === "percent" ? "expand" : undefined} onClick={(e: unknown) => { const i = (e as { activeTooltipIndex?: number | string })?.activeTooltipIndex; const row = i != null ? rows[Number(i)] : undefined; if (row && onSelect) onSelect(row.__key, row.__label); }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          {xAxis}{yLeft}{yRight}{tip}{leg}
          {r.hasTarget && !r.dims[1] && <Line yAxisId="l" type="monotone" dataKey="__target" name={r.targetLabel ?? "Meta"} stroke={META_LINE} strokeWidth={1.75} strokeDasharray="5 4" dot={false} connectNulls />}
          {series.map((s, i) => w.type === "area" ? (
            <Area key={s.key} yAxisId={s.axis === "right" ? "r" : "l"} type={w.opts.smooth === false ? "linear" : "monotone"} dataKey={s.key} name={s.name} stroke={s.color} fill={s.color} fillOpacity={stacked ? 0.55 : 0.14} strokeWidth={2} stackId={stacked ? "a" : undefined} connectNulls dot={false} />
          ) : (
            <Line key={s.key} yAxisId={s.axis === "right" ? "r" : "l"} type={w.opts.smooth === false ? "linear" : "monotone"} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={s.meta ? 1.75 : i === 0 ? 2.5 : 2} strokeDasharray={s.meta ? "5 4" : undefined} dot={dot && !s.meta ? { ...dot, r: i === 0 ? 3 : 2.5, fill: s.color } : false} activeDot={{ r: 5 }} connectNulls>
              {showLabels && i === 0 && <LabelList dataKey={s.key} position="top" offset={9} fontSize={9.5} fontWeight={600} fill={s.color} formatter={labelFmt(s.format)} />}
            </Line>
          ))}
        </C>
      </ResponsiveContainer>
    );
  }

  // bar vertical / combo
  const Chart = w.type === "combo" ? ComposedChart : BarChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={rows} margin={margin} barGap={2} stackOffset={stack === "percent" ? "expand" : undefined}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        {xAxis}{yLeft}{yRight}{tip}{leg}
        {r.hasTarget && !r.dims[1] && <Bar yAxisId="l" dataKey="__target" name={r.targetLabel ?? "Meta"} fill={META_FILL} stroke={META_STROKE} strokeWidth={1.25} radius={[3, 3, 0, 0]} maxBarSize={44} />}
        {series.map((s, i) => s.mark === "line" && w.type === "combo" ? (
          <Line key={s.key} yAxisId={s.axis === "right" ? "r" : "l"} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={{ r: 2.5, fill: s.color }} connectNulls>
            {showLabels && <LabelList dataKey={s.key} position="top" offset={8} fontSize={9.5} fill={s.color} formatter={labelFmt(s.format)} />}
          </Line>
        ) : (
          <Bar key={s.key} yAxisId={s.axis === "right" ? "r" : "l"} dataKey={s.key} name={s.name} fill={s.meta ? META_FILL : s.color} stroke={s.meta ? META_STROKE : undefined} strokeWidth={s.meta ? 1.25 : 0} stackId={stacked ? "a" : undefined} radius={stacked && i < series.length - 1 ? 0 : [3, 3, 0, 0]} maxBarSize={44} onClick={click} style={{ cursor: onSelect ? "pointer" : undefined }}>
            {rows.map((row) => <Cell key={row.__key} fillOpacity={dim(row.__key)} />)}
            {showLabels && <LabelList dataKey={s.key} position="top" fontSize={9.5} fill={LABEL} formatter={labelFmt(s.format)} />}
          </Bar>
        ))}
      </Chart>
    </ResponsiveContainer>
  );
}

export function PieDonut({ r, w, height, selected, onSelect }: ChartProps) {
  const fmt = (w.opts.format && w.opts.format !== "auto" ? w.opts.format : r.measures[0]?.format) ?? "auto";
  const data = r.rows.map((row) => ({ key: row.keys[0], name: row.labels[0], value: row.values[0] ?? 0 })).filter((d) => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  const pal = paletteOf(w.opts.palette ?? "mixta", data.length);
  const donut = w.type === "donut";
  const legendOn = w.opts.legend ?? true;
  const outer = Math.max(50, Math.min((height - (legendOn ? 44 : 10)) / 2 - 28, 100));
  return (
    <div style={{ position: "relative" }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cy={legendOn ? "46%" : "50%"} innerRadius={donut ? outer * 0.6 : 0} outerRadius={outer} paddingAngle={donut ? 1.5 : 0.5} stroke="#fff" strokeWidth={1.5}
            label={w.opts.labels === false || data.length > 9 ? false : (p: { percent?: number }) => `${Math.round((p.percent ?? 0) * 100)}%`} labelLine={false}
            onClick={(d: unknown) => { const p = d as { key?: string; name?: string; payload?: { key: string; name: string } }; const k = p.payload?.key ?? p.key; if (k && onSelect) onSelect(k, p.payload?.name ?? p.name ?? k); }} style={{ cursor: onSelect ? "pointer" : undefined }}>
            {data.map((d, i) => <Cell key={d.key} fill={d.key === "__otros" ? "#cbd5e1" : pal[i % pal.length]} fillOpacity={selected && selected !== d.key ? 0.35 : 1} />)}
          </Pie>
          <Tooltip formatter={(v) => `${fmtValue(Number(v), fmt, false)} · ${total ? Math.round((Number(v) / total) * 1000) / 10 : 0}%`.replace(".", ",")} contentStyle={tooltipStyle} />
          {legendOn && <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="bottom" formatter={(v) => <span style={{ color: "#16202e" }}>{String(v)}</span>} />}
        </PieChart>
      </ResponsiveContainer>
      {donut && (
        <div style={{ position: "absolute", top: 5, bottom: legendOn ? 36 : 5, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <span style={{ fontSize: 10, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 600 }}>Total</span>
          <span style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{fmtValue(total, fmt)}</span>
        </div>
      )}
    </div>
  );
}

export function ScatterView({ r, w, height, onSelect }: ChartProps) {
  const [mx, my, mz] = r.measures;
  if (!mx || !my) return null;
  const groups = new Map<string, { key: string; label: string; x: number | null; y: number | null; z: number | null }[]>();
  for (const row of r.rows) {
    const g = r.dims[1] ? row.labels[1] : "";
    const arr = groups.get(g!) ?? [];
    arr.push({ key: row.keys[0]!, label: row.labels[0]!, x: row.values[0]!, y: row.values[1]!, z: mz ? row.values[2]! : null });
    groups.set(g!, arr);
  }
  const pal = paletteOf(w.opts.palette, groups.size);
  const Tip = ({ active, payload }: { active?: boolean; payload?: { payload: { label: string; x: number; y: number; z: number | null } }[] }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0]!.payload;
    return (
      <div style={{ ...tooltipStyle, padding: "8px 10px" }}>
        <b style={{ fontSize: 12 }}>{p.label}</b>
        <div>{mx.label}: {fmtValue(p.x, mx.format, false)}</div>
        <div>{my.label}: {fmtValue(p.y, my.format, false)}</div>
        {mz && <div>{mz.label}: {fmtValue(p.z, mz.format, false)}</div>}
      </div>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 10, right: 16, left: 0, bottom: 18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis type="number" dataKey="x" name={mx.label} stroke={AXIS} fontSize={11} tickLine={false} tickFormatter={tick(mx.format)} label={{ value: mx.label, position: "insideBottom", offset: -10, fontSize: 11, fill: AXIS }} />
        <YAxis type="number" dataKey="y" name={my.label} width={Y_W} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} tickFormatter={tick(my.format)} />
        {mz ? <ZAxis type="number" dataKey="z" range={[40, 600]} /> : <ZAxis range={[60, 60]} />}
        <Tooltip content={<Tip />} cursor={{ strokeDasharray: "3 3" }} />
        {groups.size > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {[...groups.entries()].map(([g, pts], i) => (
          <Scatter key={g || "all"} name={g || "Puntos"} data={pts} fill={pal[i % pal.length]} fillOpacity={0.75} onClick={(d: unknown) => { const p = d as { payload?: { key: string; label: string }; key?: string; label?: string }; const k = p.payload?.key ?? p.key; if (k && onSelect) onSelect(k, p.payload?.label ?? p.label ?? k); }} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function WaterfallView({ r, w, height, onSelect }: ChartProps) {
  const fmt = (w.opts.format && w.opts.format !== "auto" ? w.opts.format : r.measures[0]?.format) ?? "auto";
  let acc = 0;
  const data = r.rows.map((row) => {
    const v = row.values[0] ?? 0;
    const start = acc; acc += v;
    return { __key: row.keys[0], __label: row.labels[0], base: Math.min(start, acc), delta: Math.abs(v), v, up: v >= 0 };
  });
  data.push({ __key: "__total", __label: "Total", base: 0, delta: Math.abs(acc), v: acc, up: acc >= 0 });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="__label" stroke={AXIS} fontSize={10.5} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
        <YAxis width={Y_W} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} tickFormatter={tick(fmt)} />
        <Tooltip formatter={(_v, _n, item) => fmtValue((item as { payload?: { v: number } })?.payload?.v ?? null, fmt, false)} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
        <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="delta" name={r.measures[0]?.label} stackId="w" radius={[3, 3, 0, 0]} onClick={(d: unknown) => { const p = payloadKey(d); if (p && p.__key !== "__total" && onSelect) onSelect(p.__key, p.__label); }}>
          {data.map((d) => <Cell key={d.__key} fill={d.__key === "__total" ? INK : d.up ? REAL : META_LINE} />)}
          <LabelList dataKey="v" position="top" fontSize={9.5} fill={LABEL} formatter={(v: unknown) => fmtValue(Number(v), fmt)} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
