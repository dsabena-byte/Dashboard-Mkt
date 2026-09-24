"use client";
import { useMemo, useState } from "react";
import type { CondRule, NumFormat, Result, Widget } from "@/lib/viz";
import { fmtValue } from "@/lib/viz/format";
import { SEMAFORO_COLOR, blueScale, semaforo } from "./theme";

// Tabla (agregada o detalle) ordenable, paginada, con fila de totales y formato condicional
// (barras de datos / escala de color / semáforo), y tabla dinámica (pivot) con subtotales.

const th: React.CSSProperties = { padding: "7px 9px", fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".03em", color: "var(--muted)", textAlign: "left", borderBottom: "1px solid var(--line)", background: "var(--panel-2)", position: "sticky", top: 0, zIndex: 1, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" };
const td: React.CSSProperties = { padding: "6px 9px", fontSize: 12.5, borderBottom: "1px solid var(--line-2)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

function condStyle(rule: CondRule | undefined, v: number | null, max: number, min: number): { style: React.CSSProperties; dot?: string } {
  if (!rule || v == null) return { style: {} };
  if (rule.kind === "bars") {
    const pct = max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0;
    return { style: { backgroundImage: `linear-gradient(90deg, rgba(30,64,175,.16) ${pct}%, transparent ${pct}%)` } };
  }
  if (rule.kind === "scale") {
    const t = max > min ? (v - min) / (max - min) : 0.5;
    return { style: { background: blueScale(0.08 + t * 0.75), color: t > 0.6 ? "#fff" : undefined } };
  }
  const dir = rule.dir ?? "up";
  const g = rule.green ?? 100, y = rule.yellow ?? 90;
  const sem = dir === "up" ? (v >= g ? "verde" : v >= y ? "amarillo" : "rojo") : (v <= g ? "verde" : v <= y ? "amarillo" : "rojo");
  return { style: { color: SEMAFORO_COLOR[sem], fontWeight: 600 }, dot: SEMAFORO_COLOR[sem] };
}

function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const b: React.CSSProperties = { border: "1px solid var(--line)", background: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 12, cursor: "pointer" };
  return (
    <div data-noprint="1" style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", padding: "8px 2px 0", fontSize: 12, color: "var(--muted)" }}>
      <span>{total.toLocaleString("es-AR")} filas</span>
      <button style={b} disabled={page === 0} onClick={() => onPage(page - 1)}>‹</button>
      <span>{page + 1} / {pages}</span>
      <button style={b} disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>›</button>
    </div>
  );
}

export function TableView({ r, w, height, selected, onSelect, print }: { r: Result; w: Widget; height: number; selected?: string | null; onSelect?: (k: string, l: string) => void; print?: boolean }) {
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = print ? 10_000 : w.opts.pageSize ?? 15;

  // Columnas: dimensiones + medidas (+ meta)
  type Col = { label: string; num: boolean; format: NumFormat; rule?: CondRule };
  const cols = useMemo((): Col[] => {
    const c: Col[] = [];
    if (r.detail) return r.detail.header.map((h) => ({ label: h.label, num: h.type === "number", format: h.format }));
    for (const d of r.dims) c.push({ label: d.label, num: false, format: "auto" });
    r.measures.forEach((m, i) => c.push({ label: m.label, num: true, format: i === 0 && w.opts.format && w.opts.format !== "auto" ? w.opts.format : m.format, rule: w.opts.cond?.find((x) => x.measure === m.id) }));
    if (r.hasTarget) c.push({ label: r.targetLabel ?? "Meta", num: true, format: r.measures[0]?.format ?? "auto" });
    return c;
  }, [r, w.opts.cond, w.opts.format]);

  const data = useMemo(() => {
    if (r.detail) return r.detail.rows.map((row, i) => ({ key: String(i), label: "", cells: row as (string | number | null)[] }));
    return r.rows.map((row) => ({ key: row.keys[0], label: row.labels[0], cells: [...row.labels, ...row.values, ...(r.hasTarget ? [row.target ?? null] : [])] as (string | number | null)[] }));
  }, [r]);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const { col, dir } = sort;
    return [...data].sort((a, b) => {
      const x = a.cells[col], y = b.cells[col];
      if (x == null) return 1; if (y == null) return -1;
      if (typeof x === "number" && typeof y === "number") return dir * (x - y);
      return dir * String(x).localeCompare(String(y), "es", { numeric: true });
    });
  }, [data, sort]);

  const stats = useMemo(() => cols.map((_, ci) => {
    let mx = -Infinity, mn = Infinity;
    for (const row of data) { const v = row.cells[ci]; if (typeof v === "number") { if (v > mx) mx = v; if (v < mn) mn = v; } }
    return { mx, mn };
  }), [cols, data]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pg = Math.min(page, pages - 1);
  const view = sorted.slice(pg * pageSize, pg * pageSize + pageSize);
  const showTotals = !r.detail && (w.opts.totals ?? true) && r.rows.length > 1;

  return (
    <div>
      <div style={{ overflow: "auto", maxHeight: print ? undefined : height + 60, border: "1px solid var(--line)", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{cols.map((c, i) => (
            <th key={i} style={{ ...th, textAlign: c.num ? "right" : "left" }} onClick={() => setSort((s) => (s?.col === i ? { col: i, dir: s.dir === 1 ? -1 : 1 } : { col: i, dir: c.num ? -1 : 1 }))}>
              {c.label}{sort?.col === i ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
            </th>
          ))}</tr></thead>
          <tbody>
            {view.map((row) => (
              <tr key={row.key} onClick={() => !r.detail && onSelect?.(row.key!, row.label!)} style={{ cursor: !r.detail && onSelect ? "pointer" : undefined, background: selected && selected === row.key ? "var(--navy-soft)" : undefined, opacity: selected && selected !== row.key ? 0.55 : 1 }}>
                {row.cells.map((v, ci) => {
                  const c = cols[ci];
                  const cs = c!.num ? condStyle(c!.rule, typeof v === "number" ? v : null, stats[ci]!.mx, stats[ci]!.mn) : { style: {} };
                  return (
                    <td key={ci} style={{ ...td, textAlign: c!.num ? "right" : "left", ...cs.style }}>
                      {cs.dot && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: cs.dot, marginRight: 6, verticalAlign: "middle" }} />}
                      {v == null ? "—" : typeof v === "number" ? fmtValue(v, c!.format, false) : String(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {showTotals && (
            <tfoot><tr>{cols.map((c, ci) => {
              const mi = ci - r.dims.length;
              const v = c.num && mi >= 0 && mi < r.measures.length ? r.totals[mi] : null;
              return <td key={ci} style={{ ...td, fontWeight: 600, background: "var(--panel-2)", borderTop: "1px solid var(--line)", textAlign: c.num ? "right" : "left" }}>{ci === 0 ? "Total" : v == null ? "" : fmtValue(v, c.format, false)}</td>;
            })}</tr></tfoot>
          )}
        </table>
      </div>
      {!print && <Pager page={pg} pages={pages} total={r.detail ? r.detail.total : sorted.length} onPage={setPage} />}
      {r.detail && r.detail.total > r.detail.rows.length && <p className="hint" style={{ margin: "6px 0 0", fontSize: 11.5 }}>Se muestran las primeras {r.detail.rows.length.toLocaleString("es-AR")} filas de {r.detail.total.toLocaleString("es-AR")}.</p>}
    </div>
  );
}

export function PivotView({ r, w, height, print }: { r: Result; w: Widget; height: number; print?: boolean }) {
  const p = r.pivot;
  if (!p) return null;
  const ms = r.measures;
  const fmtOf = (i: number) => (i === 0 && w.opts.format && w.opts.format !== "auto" ? w.opts.format : ms[i]?.format ?? "auto");
  const cols = [...p.colKeys.map((c) => c.label), ...(p.colKeys.length ? ["Total"] : [])];
  const multi = ms.length > 1;
  const R = p.rowDims.length;
  // Escala de color opcional sobre la 1ª medida (celdas hoja)
  const heat = w.opts.cond?.some((c) => c.kind === "scale");
  let mx = -Infinity, mn = Infinity;
  if (heat) for (const row of p.rows) if (row.leaf) row.cells.slice(0, p.colKeys.length).forEach((c) => { const v = c[0]; if (v != null) { if (v > mx) mx = v; if (v < mn) mn = v; } });
  return (
    <div style={{ overflow: "auto", maxHeight: print ? undefined : height + 80, border: "1px solid var(--line)", borderRadius: 10 }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ ...th, cursor: "default" }} rowSpan={multi ? 2 : 1}>{p.rowDims.map((d) => d.label).join(" › ") || " "}</th>
            {(cols.length ? cols : ["Total"]).map((c, i) => <th key={i} colSpan={ms.length} style={{ ...th, cursor: "default", textAlign: multi ? "center" : "right" }}>{c}</th>)}
          </tr>
          {multi && <tr>{(cols.length ? cols : ["Total"]).flatMap((c) => ms.map((m) => <th key={`${c}-${m.id}`} style={{ ...th, cursor: "default", textAlign: "right", top: 29 }}>{m.label}</th>))}</tr>}
        </thead>
        <tbody>
          {p.rows.map((row, i) => (
            <tr key={i} style={{ background: row.leaf ? undefined : "var(--panel-2)" }}>
              <td style={{ ...td, paddingLeft: 9 + (row.leaf ? (R - 1) : row.level) * 16, fontWeight: row.leaf ? 400 : 600 }}>{row.labels[row.labels.length - 1]}</td>
              {row.cells.flatMap((c, ci) => c.map((v, mi) => {
                const isTot = ci === row.cells.length - 1 && p.colKeys.length > 0;
                const hs = heat && row.leaf && !isTot && mi === 0 && v != null ? { background: blueScale(0.08 + (mx > mn ? (v - mn) / (mx - mn) : 0.5) * 0.75), color: mx > mn && (v - mn) / (mx - mn) > 0.6 ? "#fff" : undefined } : {};
                return <td key={`${ci}-${mi}`} style={{ ...td, textAlign: "right", fontWeight: row.leaf && !isTot ? 400 : 600, ...hs }}>{fmtValue(v, fmtOf(mi), false)}</td>;
              }))}
            </tr>
          ))}
          <tr style={{ background: "var(--panel-2)" }}>
            <td style={{ ...td, fontWeight: 600, borderTop: "1px solid var(--line)" }}>Total general</td>
            {p.grand.flatMap((c, ci) => c.map((v, mi) => <td key={`${ci}-${mi}`} style={{ ...td, textAlign: "right", fontWeight: 600, borderTop: "1px solid var(--line)" }}>{fmtValue(v, fmtOf(mi), false)}</td>))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export { semaforo };
