"use client";
import type { NumFormat, Result, Widget } from "@/lib/viz";
import { fmtValue, fmtDelta } from "@/lib/viz/format";
import { META_STROKE, REAL, SEMAFORO_COLOR, SEM_BG, blueScale, paletteOf, semaforo } from "./theme";

// KPI (look MetaKpiCard de BIP), avance vs meta (gauge), mapa de calor, embudo y bloque de texto.

const fmt0 = (r: Result, w: Widget): NumFormat => (w.opts.format && w.opts.format !== "auto" ? w.opts.format : r.measures[0]?.format) ?? "auto";

function Spark({ pts, height = 34 }: { pts: (number | null)[]; height?: number }) {
  const vals = pts.map((v) => (v == null ? null : v));
  const nums = vals.filter((v): v is number => v != null);
  if (nums.length < 2) return null;
  const mn = Math.min(...nums), mx = Math.max(...nums);
  const W = 100, H = height;
  const x = (i: number) => (i / (vals.length - 1)) * W;
  const y = (v: number) => (mx === mn ? H / 2 : H - 3 - ((v - mn) / (mx - mn)) * (H - 6));
  let d = ""; vals.forEach((v, i) => { if (v == null) return; d += `${d ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`; });
  const last = vals.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: H, display: "block" }} aria-hidden>
      <path d={`${d}L${W},${H}L0,${H}Z`} fill="rgba(30,64,175,.07)" stroke="none" />
      <path d={d} fill="none" stroke={REAL} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      {vals[last] != null && <circle cx={x(last)} cy={y(vals[last] as number)} r={2.2} fill={REAL} />}
    </svg>
  );
}

export function KpiView({ r, w }: { r: Result; w: Widget }) {
  const k = r.kpi;
  const f = fmt0(r, w);
  if (!k) return null;
  const dir = w.opts.direction ?? "up";
  const good = k.deltaPct == null ? null : dir === "up" ? k.deltaPct >= 0 : k.deltaPct <= 0;
  const sem = semaforo(k.cumpl, w.opts.green ?? 100, w.opts.yellow ?? 90);
  const desvio = k.value != null && k.target != null && k.target !== 0 ? ((k.value - k.target) / Math.abs(k.target)) * 100 : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-.025em", color: "var(--ink)", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{fmtValue(k.value, f)}</span>
        {k.periodLabel && <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>{k.periodLabel}</span>}
      </div>
      {k.prev != null && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
          <span style={{ borderRadius: 6, padding: "2px 6px", fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: good == null ? "var(--muted)" : good ? SEMAFORO_COLOR.verde : SEMAFORO_COLOR.rojo, background: good == null ? "var(--line-2)" : good ? SEM_BG.verde : SEM_BG.rojo }}>{fmtDelta(k.deltaPct)}</span>
          <span>vs {k.prevLabel} ({fmtValue(k.prev, f)})</span>
        </div>
      )}
      {k.target != null && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 12 }}>
              <span style={{ height: 8, width: 8, borderRadius: "50%", background: SEMAFORO_COLOR[sem], display: "inline-block", alignSelf: "center" }} />
              <span style={{ color: "var(--muted)" }}>{r.targetLabel ?? "Meta"}</span>
              <span style={{ fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{fmtValue(k.target, f)}</span>
            </div>
            <span style={{ borderRadius: 6, padding: "2px 6px", fontSize: 11, fontWeight: 600, color: SEMAFORO_COLOR[sem], background: SEM_BG[sem] }}>{desvio == null ? "—" : `${desvio >= 0 ? "▲" : "▼"} ${Math.abs(desvio).toFixed(0)}%`}</span>
          </div>
          <div style={{ marginTop: 6, height: 6, borderRadius: 999, background: "var(--line-2)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, k.cumpl ?? 0))}%`, background: SEMAFORO_COLOR[sem], borderRadius: 999 }} />
          </div>
        </div>
      )}
      {(w.opts.spark ?? true) && k.spark.length > 1 && <Spark pts={k.spark.map((s) => s.value)} />}
    </div>
  );
}

export function GaugeView({ r, w, height }: { r: Result; w: Widget; height: number }) {
  const k = r.kpi;
  if (!k) return null;
  const f = fmt0(r, w);
  if (k.target == null) return <Msg h={height}>Definí una meta (columna o valor fijo) para ver el avance.</Msg>;
  const c = k.cumpl ?? 0;
  const sem = semaforo(k.cumpl, w.opts.green ?? 100, w.opts.yellow ?? 90);
  const frac = Math.max(0, Math.min(1, c / 100));
  const R = 70, cx = 90, cy = 84;
  const pt = (t: number) => [cx - R * Math.cos(Math.PI * t), cy - R * Math.sin(Math.PI * t)];
  const [x1, y1] = pt(frac);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox="0 0 180 96" style={{ width: "100%", maxWidth: 260, height: Math.min(height, 140) }}>
        <path d={`M${cx - R},${cy} A${R},${R} 0 0 1 ${cx + R},${cy}`} fill="none" stroke="#eef3f9" strokeWidth={14} strokeLinecap="round" />
        {frac > 0 && <path d={`M${cx - R},${cy} A${R},${R} 0 0 1 ${x1!.toFixed(2)},${y1!.toFixed(2)}`} fill="none" stroke={SEMAFORO_COLOR[sem]} strokeWidth={14} strokeLinecap="round" />}
        <text x={cx} y={cy - 16} textAnchor="middle" fontSize={22} fontWeight={600} fill="#0f172a">{Math.round(c)}%</text>
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize={9.5} fill="#57697f">de la meta</text>
      </svg>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: -4 }}>
        <b style={{ color: "var(--ink)" }}>{fmtValue(k.value, f)}</b> de {fmtValue(k.target, f)}{k.periodLabel ? ` · ${k.periodLabel}` : ""}
      </div>
    </div>
  );
}

export function HeatmapView({ r, w, selected, onSelect }: { r: Result; w: Widget; selected?: string | null; onSelect?: (k: string, l: string) => void }) {
  const f = fmt0(r, w);
  const xs = r.xKeys.slice(0, 40), ys = r.seriesKeys.slice(0, 40);
  if (!r.dims[1]) return <Msg h={120}>El mapa de calor necesita dos dimensiones (Eje y Color/Serie).</Msg>;
  const cell = new Map<string, number | null>();
  let mn = Infinity, mx = -Infinity;
  for (const row of r.rows) { const v = row.values[0]; cell.set(row.keys[0] + "\u0001" + row.keys[1], v!); if (v != null) { if (v < mn) mn = v; if (v > mx) mx = v; } }
  const c: React.CSSProperties = { padding: "6px 6px", fontSize: 11, textAlign: "center", fontVariantNumeric: "tabular-nums", border: "2px solid #fff", borderRadius: 4, minWidth: 44 };
  return (
    <div style={{ overflow: "auto" }}>
      <table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%" }}>
        <thead><tr><th style={{ position: "sticky", left: 0, background: "#fff" }} />{xs.map((x) => <th key={x.key} style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)", padding: "4px 4px", whiteSpace: "nowrap" }}>{x.label}</th>)}</tr></thead>
        <tbody>
          {ys.map((y) => (
            <tr key={y.key}>
              <th style={{ position: "sticky", left: 0, background: "#fff", fontSize: 11.5, fontWeight: 500, textAlign: "left", padding: "4px 8px 4px 0", whiteSpace: "nowrap", color: "var(--ink)" }}>{y.label}</th>
              {xs.map((x) => {
                const v = cell.get(x.key + "\u0001" + y.key) ?? null;
                const t = v == null || mx === mn ? 0.5 : (v - mn) / (mx - mn);
                return (
                  <td key={x.key} title={`${y.label} · ${x.label}: ${fmtValue(v, f, false)}`} onClick={() => onSelect?.(x.key, x.label)}
                    style={{ ...c, background: v == null ? "var(--line-2)" : blueScale(0.06 + t * 0.9), color: v != null && t > 0.55 ? "#fff" : "var(--ink)", cursor: onSelect ? "pointer" : undefined, opacity: selected && selected !== x.key ? 0.4 : 1 }}>
                    {v == null ? "" : fmtValue(v, f)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FunnelView({ r, w, selected, onSelect }: { r: Result; w: Widget; selected?: string | null; onSelect?: (k: string, l: string) => void }) {
  const f = fmt0(r, w);
  const rows = r.rows.filter((x) => x.values[0] != null);
  const max = Math.max(...rows.map((x) => x.values[0] ?? 0), 0);
  const first = rows[0]?.values[0] ?? null;
  // Rampa monótona (oscuro → claro) para que se lea como embudo.
  const colorAt = (i: number) => (w.opts.palette && w.opts.palette !== "azul" ? paletteOf(w.opts.palette, rows.length)[i % 8] : blueScale(1 - (i / Math.max(1, rows.length - 1)) * 0.55));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((row, i) => {
        const v = row.values[0] ?? 0;
        const prev = i > 0 ? rows[i - 1]!.values[0] : null;
        const pct = max > 0 ? (v / max) * 100 : 0;
        return (
          <div key={row.keys[0]} onClick={() => onSelect?.(row.keys[0]!, row.labels[0]!)} style={{ display: "grid", gridTemplateColumns: "minmax(80px, 150px) 1fr 110px", alignItems: "center", gap: 10, cursor: onSelect ? "pointer" : undefined, opacity: selected && selected !== row.keys[0] ? 0.45 : 1 }}>
            <span style={{ fontSize: 12, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.labels[0]}</span>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ width: `${Math.max(pct, 2)}%`, background: colorAt(i), height: 26, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", minWidth: 36 }}>{fmtValue(v, f)}</div>
            </div>
            <span style={{ fontSize: 11, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
              {i === 0 ? "100%" : `${first ? ((v / first) * 100).toFixed(1).replace(".", ",") : "—"}% · ${prev ? `${((v / prev) * 100).toFixed(1).replace(".", ",")}% paso` : ""}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Markdown mínimo y seguro (sin HTML): # títulos, **negrita**, *itálica*, listas con "- ".
function inline(s: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    out.push(t.startsWith("**") ? <b key={`${key}-${i++}`}>{t.slice(2, -2)}</b> : <i key={`${key}-${i++}`}>{t.slice(1, -1)}</i>);
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
export function TextBlock({ text }: { text: string }) {
  const lines = (text || "").split("\n");
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (k: number) => { if (list.length) { out.push(<ul key={`ul${k}`} style={{ margin: "4px 0 8px", paddingLeft: 18, fontSize: 13.5, color: "var(--ink)" }}>{list.map((l, j) => <li key={j}>{inline(l, `li${k}-${j}`)}</li>)}</ul>); list = []; } };
  lines.forEach((ln, k) => {
    const t = ln.trimEnd();
    if (/^\s*[-•]\s+/.test(t)) { list.push(t.replace(/^\s*[-•]\s+/, "")); return; }
    flush(k);
    if (!t.trim()) return;
    if (t.startsWith("### ")) out.push(<h4 key={k} style={{ margin: "6px 0 4px", fontSize: 13.5, fontWeight: 600 }}>{inline(t.slice(4), `h${k}`)}</h4>);
    else if (t.startsWith("## ")) out.push(<h3 key={k} style={{ margin: "4px 0 6px", fontSize: 16, fontWeight: 600, letterSpacing: "-.02em" }}>{inline(t.slice(3), `h${k}`)}</h3>);
    else if (t.startsWith("# ")) out.push(<h2 key={k} style={{ margin: "2px 0 8px", fontSize: 20, fontWeight: 600, letterSpacing: "-.025em" }}>{inline(t.slice(2), `h${k}`)}</h2>);
    else out.push(<p key={k} style={{ margin: "0 0 8px", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55 }}>{inline(t, `p${k}`)}</p>);
  });
  flush(lines.length);
  return <div>{out}</div>;
}

export function Msg({ h, children }: { h: number; children: React.ReactNode }) {
  return <div style={{ display: "flex", minHeight: Math.min(h, 160), alignItems: "center", justifyContent: "center", textAlign: "center", fontSize: 12.5, color: "var(--muted)", padding: "0 12px" }}>{children}</div>;
}
export { META_STROKE };
