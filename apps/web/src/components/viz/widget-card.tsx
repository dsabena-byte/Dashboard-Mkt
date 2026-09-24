"use client";
import type { Result, Widget } from "@/lib/viz";
import { resultToAoa } from "@/lib/viz/export";
import { ExportMenu } from "./export-menu";
import { CartesianChart, PieDonut, ScatterView, WaterfallView } from "./charts";
import { PivotView, TableView } from "./tables";
import { FunnelView, GaugeView, HeatmapView, KpiView, Msg, TextBlock } from "./misc";
import { HEIGHT } from "./theme";

// Cuerpo de un widget según su tipo + estados vacíos/errores.
export function VizBody({ w, r, selected, onSelect, print }: { w: Widget; r: Result | null; selected?: string | null; onSelect?: (k: string, l: string) => void; print?: boolean }) {
  const h = HEIGHT[w.h] ?? HEIGHT.m;
  if (w.type === "text") return <TextBlock text={w.opts.text ?? ""} />;
  if (!r) return <Msg h={h}>Cargando…</Msg>;
  if (r.error) return <Msg h={h}><span style={{ color: "var(--err)" }}>No se pudo calcular: {r.error}</span></Msg>;
  const needsMeasure = !["table", "text"].includes(w.type) && !(w.type === "pivot" && w.q.measures.length);
  if (needsMeasure && !w.q.measures.length && w.type !== "pivot") return <Msg h={h}>Arrastrá una medida a <b>&nbsp;Valores&nbsp;</b> para ver este gráfico.</Msg>;
  if (["bar", "line", "area", "combo", "pie", "donut", "funnel", "waterfall", "heatmap", "scatter"].includes(w.type) && !w.q.x) return <Msg h={h}>Elegí una dimensión para el <b>&nbsp;Eje&nbsp;</b>.</Msg>;
  if (w.type === "pivot" && !w.q.measures.length) return <Msg h={h}>Sumá al menos una medida a <b>&nbsp;Valores&nbsp;</b>.</Msg>;
  if (r.rowCount === 0) return <Msg h={h}>Sin datos para los filtros aplicados.</Msg>;
  switch (w.type) {
    case "kpi": return <KpiView r={r} w={w} />;
    case "gauge": return <GaugeView r={r} w={w} height={h} />;
    case "table": return <TableView r={r} w={w} height={h} selected={selected} onSelect={onSelect} print={print} />;
    case "pivot": return <PivotView r={r} w={w} height={h} print={print} />;
    case "heatmap": return <HeatmapView r={r} w={w} selected={selected} onSelect={onSelect} />;
    case "funnel": return r.rows.length ? <FunnelView r={r} w={w} selected={selected} onSelect={onSelect} /> : <Msg h={h}>Sin datos para los filtros aplicados.</Msg>;
    case "pie": case "donut": return r.rows.length ? <PieDonut r={r} w={w} height={h} selected={selected} onSelect={onSelect} /> : <Msg h={h}>Sin datos para los filtros aplicados.</Msg>;
    case "scatter": return r.measures.length < 2 ? <Msg h={h}>La dispersión necesita 2 medidas (X e Y) y una dimensión de detalle.</Msg> : <ScatterView r={r} w={w} height={h} onSelect={onSelect} />;
    case "waterfall": return <WaterfallView r={r} w={w} height={h} onSelect={onSelect} />;
    default: return r.rows.length ? <CartesianChart r={r} w={w} height={h} selected={selected} onSelect={onSelect} /> : <Msg h={h}>Sin datos para los filtros aplicados.</Msg>;
  }
}

/** Card de widget con título, exportación (PNG + Excel de los datos) y avisos. */
export function WidgetCard({ w, r, selected, onSelect, toolbar, print, dragProps }: {
  w: Widget; r: Result | null; selected?: string | null; onSelect?: (k: string, l: string) => void;
  toolbar?: React.ReactNode; print?: boolean; dragProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const bare = w.type === "text";
  return (
    <div className={`vz-card vz-w${w.w}`} {...dragProps} style={{ position: "relative", minWidth: 0, background: "var(--panel)", border: bare && !toolbar ? "1px solid transparent" : "1px solid var(--line)", borderRadius: 14, padding: bare ? "12px 16px" : 16, breakInside: "avoid", ...(dragProps?.style ?? {}) }}>
      {toolbar}
      {(w.title || w.subtitle) && w.type !== "text" && (
        <div style={{ paddingRight: toolbar ? 0 : 34, marginBottom: 10 }}>
          <div style={{ fontSize: w.type === "kpi" || w.type === "gauge" ? 11 : 14.5, fontWeight: 600, textTransform: w.type === "kpi" || w.type === "gauge" ? "uppercase" : undefined, letterSpacing: w.type === "kpi" || w.type === "gauge" ? ".05em" : "-.015em", color: w.type === "kpi" || w.type === "gauge" ? "var(--muted)" : "var(--ink)" }}>{w.title}</div>
          {w.subtitle && <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 2 }}>{w.subtitle}</div>}
        </div>
      )}
      <VizBody w={w} r={r} selected={selected} onSelect={onSelect} print={print} />
      {r && r.warnings.length > 0 && !print && <p className="hint" style={{ margin: "8px 0 0", fontSize: 11.5, color: "var(--warn)" }}>{r.warnings[0]}</p>}
      {!print && !toolbar && w.type !== "text" && r && !r.error && <ExportMenu name={w.title || "grafico"} data={() => resultToAoa(r, w)} />}
    </div>
  );
}
