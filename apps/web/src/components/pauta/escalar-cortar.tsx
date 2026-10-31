"use client";
import { useMemo, useState } from "react";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { evaluarMedio, type PiezaEval, type PiezaVideo, type Zona, type Cuadrante } from "@/lib/pauta-escalar";
import { LearnButton } from "@/components/knowledge/learn-button";

// Escalar / probar / cortar por pieza de video — tab Eficiencia Medios de /performance. Verde/gris/rojo = estado
// de la pieza (semáforo); en el gráfico 2 los cuadrantes usan el mismo criterio (azul = precisión, ámbar = alcance).

const ZONA: Record<Zona, { label: string; color: string }> = {
  escalar: { label: "Escalar", color: "#15803d" },
  probar: { label: "Mantener", color: "#94a3b8" },
  cortar: { label: "Cortar", color: "#dc2626" },
};
const CUAD: Record<Cuadrante, { label: string; desc: string; color: string }> = {
  eficiente: { label: "Eficiente", desc: "llega barato y rinde", color: "#15803d" },
  alcance: { label: "Alcance", desc: "llega barato, pocos la ven entera", color: "#d97706" },
  precision: { label: "Precisión", desc: "llegar es caro, pero rinde", color: "#1e40af" },
  caro: { label: "Candidata a cortar", desc: "cara para llegar y no rinde", color: "#dc2626" },
};
const nf = (v: number, d = 0) => v.toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d });
const money = (v: number) => (v >= 999_500 ? `$${nf(v / 1e6, 1)}M` : v >= 1e3 ? `$${nf(v / 1e3, 0)}K` : `$${nf(v, v < 10 ? 2 : 0)}`);
/** Marcas 1-2-5 × 10^k dentro del rango (ejes logarítmicos legibles). */
const ticksLog = (vals: number[]) => {
  const xs = vals.filter((v) => v > 0); if (!xs.length) return undefined;
  const lo = Math.min(...xs), hi = Math.max(...xs), out: number[] = [];
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) for (const m of [1, 2, 5]) { const t = m * 10 ** e; if (t >= lo * 0.8 && t <= hi * 1.25) out.push(t); }
  return out.length >= 2 ? out : undefined;
};
const card: React.CSSProperties = { border: "1px solid var(--line, #e2e8f0)", borderRadius: 12, padding: "14px 16px", background: "#fff" };

function Tip({ active, payload }: { active?: boolean; payload?: { payload?: PiezaEval & { curva?: string } }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p || p.curva || !p.nombre) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 12, maxWidth: 280 }}>
      <b>{p.nombre}</b>
      <div>Inversión {money(p.inv)} · {nf(p.completos)} videos completos</div>
      <div>Costo por video completo {p.costo != null ? money(p.costo) : "—"}</div>
      <div style={{ color: ZONA[p.zona].color, fontWeight: 600 }}>{ZONA[p.zona].label}{p.cuadrante ? ` · ${CUAD[p.cuadrante].label}` : ""}</div>
    </div>
  );
}

export function EscalarCortarSection({ porMedio, anio }: { porMedio: Record<string, PiezaVideo[]>; anio: number }) {
  const medios = useMemo(() => Object.entries(porMedio).sort((a, b) => b[1].reduce((s, p) => s + p.inv, 0) - a[1].reduce((s, p) => s + p.inv, 0)).map(([m]) => m), [porMedio]);
  const [medio, setMedio] = useState(medios[0] ?? "");
  const [metas, setMetas] = useState<Record<string, number>>({});
  const [todas, setTodas] = useState(false);
  const ev = useMemo(() => (medio && porMedio[medio] ? evaluarMedio(medio, porMedio[medio]!, metas[medio]) : null), [medio, porMedio, metas]);
  if (!medios.length) return <p style={{ fontSize: 13, color: "var(--muted)" }}>Todavía no hay piezas de video con inversión en {anio}.</p>;
  if (!ev) return null;

  const yMax = ev.meta * 4;
  const clip = (v: number) => Math.min(v, yMax);
  const pts = ev.piezas.filter((p) => p.costo != null).map((p) => ({ ...p, y: clip(p.costo!) }));
  const curvaEsc = ev.curva.filter((c) => Number.isFinite(c.escalar)).map((c) => ({ inv: c.inv, y: clip(c.escalar), curva: "e" }));
  const curvaCor = ev.curva.filter((c) => Number.isFinite(c.cortar)).map((c) => ({ inv: c.inv, y: clip(c.cortar), curva: "c" }));
  const tot = (z: Zona) => { const ps = ev.piezas.filter((p) => p.zona === z); return { n: ps.length, inv: ps.reduce((s, p) => s + p.inv, 0) }; };
  const ordenZ: Record<Zona, number> = { cortar: 0, escalar: 1, probar: 2 };
  const lista = [...ev.piezas].sort((a, b) => ordenZ[a.zona] - ordenZ[b.zona] || b.inv - a.inv);
  const visibles = todas ? lista : lista.slice(0, 15);
  const milTxt = ev.porAlcance ? "mil personas alcanzadas" : "mil impresiones";
  const conMil = pts.filter((p) => p.costoMil != null && p.costoMil > 0);
  const fuera = pts.filter((p) => p.costo! > yMax).length;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <details style={{ ...card, borderLeft: "3px solid #1e40af", padding: "10px 14px" }}>
        <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 600 }}>🎓 Cómo leer esta sección</summary>
        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "#334155", marginTop: 8 }}>
          <p style={{ margin: "0 0 6px" }}><b>Qué se mide.</b> Cada punto es una pieza de video con inversión en {anio}. Su resultado es el <b>video visto completo</b> (al 100%) y su costo = inversión ÷ videos vistos completos. Cuanto más bajo, mejor.</p>
          <p style={{ margin: "0 0 6px" }}><b>Contra qué se compara.</b> Contra la <b>meta</b> de su medio: por defecto, la mediana (la mitad de las piezas del medio cuesta menos y la mitad más). La podés cambiar arriba a la derecha. Cada medio tiene su meta porque un video completo no cuesta lo mismo en Meta que en TikTok o DV360.</p>
          <p style={{ margin: "0 0 4px" }}><b>Cómo se decide.</b></p>
          <ul style={{ margin: "0 0 6px", paddingLeft: 18 }}>
            <li><b style={{ color: ZONA.escalar.color }}>Escalar</b>: cuesta <b>20% o más por debajo</b> de la meta y tiene suficientes videos para estar 90% seguros de que no es casualidad.</li>
            <li><b style={{ color: ZONA.cortar.color }}>Cortar</b>: cuesta <b>20% o más por encima</b> de la meta, también con 90% de seguridad.</li>
            <li><b>Mantener</b>: todo lo demás. O gastó poco y todavía no se puede saber, o rinde parecido a la meta.</li>
          </ul>
          <p style={{ margin: "0 0 6px" }}><b>Por qué importa cuánto gastó.</b> Con meta de $14: una pieza que gastó $200 y logró 10 videos completos ($20 cada uno) queda en <b>mantener</b>, porque con 10 videos el resultado puede ser suerte. Otra que gastó $200.000 y logró 10.000 ($20 cada uno) queda en <b>cortar</b>: con tanto volumen es seguro que cuesta de más. Y una que gastó $200.000 y logró 20.000 ($10 cada uno) queda en <b>escalar</b>.</p>
          <p style={{ margin: 0 }}><b>Qué hacer.</b> La tabla de abajo dice qué hacer con cada pieza, combinando los dos gráficos. Mandásela a la agencia: subir 5–15% a lo que está en verde (15–20% si además llega barato a gente nueva) y sacar plata de lo que está en rojo. Mide eficiencia de marca (que vean el video entero), no ventas.</p>
        </div>
      </details>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {medios.map((m) => (
          <button key={m} onClick={() => { setMedio(m); setTodas(false); }} style={{ padding: "5px 12px", borderRadius: 999, fontSize: 12.5, cursor: "pointer", border: `1px solid ${m === medio ? "#1e40af" : "#cbd5e1"}`, background: m === medio ? "#1e40af" : "#fff", color: m === medio ? "#fff" : "#0f172a" }}>
            {m} <span style={{ opacity: 0.7 }}>({porMedio[m]!.length})</span>
          </button>
        ))}
        <label style={{ marginLeft: "auto", fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
          Meta de costo por video completo ($)
          <input type="number" min={0} step="any" value={Number(ev.meta.toFixed(2))} onChange={(e) => { const v = Number(e.target.value); setMetas((s) => ({ ...s, [medio]: v > 0 ? v : 0 })); }}
            style={{ width: 90, padding: "3px 6px", border: "1px solid #cbd5e1", borderRadius: 6 }} />
          {metas[medio] ? <button onClick={() => setMetas((s) => ({ ...s, [medio]: 0 }))} style={{ fontSize: 11.5, border: 0, background: "none", color: "#1e40af", cursor: "pointer" }}>usar la mediana</button> : <span style={{ fontSize: 11.5, color: "var(--muted)" }}>(mediana del medio)</span>}
        </label>
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
        {(Object.keys(ZONA) as Zona[]).map((z) => { const t = tot(z); return (
          <div key={z} style={{ ...card, borderLeft: `4px solid ${ZONA[z].color}` }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{ZONA[z].label}</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{t.n} <span style={{ fontSize: 13, fontWeight: 400 }}>piezas</span></div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{money(t.inv)} invertidos en {anio}</div>
          </div>
        ); })}
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))" }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".03em" }}>1 · Escalar, mantener o cortar · {medio} · {anio} <LearnButton k="escalar_grafico1" corner={false} /></div>
          <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "2px 0 8px" }}>Hacia la derecha, más plata invertida en la pieza; hacia arriba, más caro cada video completo. Arriba de la curva roja = cortar; debajo de la verde = escalar; entre las dos = mantener. Las curvas se acercan a la meta a medida que sube la inversión: con más plata gastada, menos dudas.</p>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 10, right: 12, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="inv" type="number" scale="log" domain={["auto", "auto"]} ticks={ticksLog(pts.map((p) => p.inv))} tickFormatter={(v) => money(Number(v))} tick={{ fontSize: 10 }} name="Inversión" />
              <YAxis dataKey="y" type="number" domain={[0, yMax]} allowDataOverflow width={56} tickFormatter={(v) => money(Number(v))} tick={{ fontSize: 10 }} name="Costo por video completo" />
              <Tooltip content={<Tip />} />
              <ReferenceLine y={ev.meta} stroke="#64748b" strokeDasharray="4 4" label={{ value: `meta ${money(ev.meta)}`, position: "insideTopLeft", fontSize: 10, fill: "#64748b" }} />
              <Scatter data={curvaCor} line={{ stroke: ZONA.cortar.color, strokeWidth: 1.5 }} shape={() => <g />} isAnimationActive={false} legendType="none" />
              <Scatter data={curvaEsc} line={{ stroke: ZONA.escalar.color, strokeWidth: 1.5 }} shape={() => <g />} isAnimationActive={false} legendType="none" />
              {(Object.keys(ZONA) as Zona[]).map((z) => <Scatter key={z} name={ZONA[z].label} data={pts.filter((p) => p.zona === z)} fill={ZONA[z].color} isAnimationActive={false} />)}
            </ScatterChart>
          </ResponsiveContainer>
          <Leyenda items={(Object.keys(ZONA) as Zona[]).map((z) => ({ color: ZONA[z].color, label: `${ZONA[z].label} ${tot(z).n}` }))} />
          {fuera > 0 && <p style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 0" }}>{fuera} {fuera === 1 ? "pieza cuesta" : "piezas cuestan"} más de {money(yMax)} por video completo: se dibujan en el borde de arriba.</p>}
        </div>

        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".03em" }}>2 · Costo de llegar vs costo por video completo · {medio} · {anio} <LearnButton k="escalar_grafico2" corner={false} /></div>
          <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "2px 0 8px" }}>Hacia la derecha, más caro llegar a la gente (costo por {milTxt}{ev.porAlcance ? ", alcance sumado por mes: aproximado" : "; este medio no da alcance por pieza"}; escala logarítmica); hacia arriba, más caro cada video completo. Burbuja = {ev.porAlcance ? "alcance" : "impresiones"}. Las líneas punteadas son la mediana del medio y la meta.</p>
          {conMil.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart margin={{ top: 10, right: 12, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="costoMil" type="number" scale="log" domain={["auto", "auto"]} ticks={ticksLog(conMil.map((p) => p.costoMil!))} tickFormatter={(v) => money(Number(v))} tick={{ fontSize: 10 }} name={`Costo por ${milTxt}`} />
                <YAxis dataKey="y" type="number" domain={[0, yMax]} allowDataOverflow width={56} tickFormatter={(v) => money(Number(v))} tick={{ fontSize: 10 }} />
                <ZAxis dataKey={ev.porAlcance ? "alcance" : "impr"} range={[30, 600]} />
                <Tooltip content={<Tip />} />
                {ev.medianaMil != null && <ReferenceLine x={ev.medianaMil} stroke="#64748b" strokeDasharray="4 4" label={{ value: `mediana ${money(ev.medianaMil)}`, position: "insideTopRight", fontSize: 10, fill: "#64748b" }} />}
                <ReferenceLine y={ev.meta} stroke="#64748b" strokeDasharray="4 4" />
                {(Object.keys(CUAD) as Cuadrante[]).map((c) => <Scatter key={c} name={CUAD[c].label} data={conMil.filter((p) => p.cuadrante === c)} fill={CUAD[c].color} fillOpacity={0.55} stroke={CUAD[c].color} isAnimationActive={false} />)}
              </ScatterChart>
            </ResponsiveContainer>
          ) : <p style={{ fontSize: 12.5, color: "var(--muted)" }}>Sin datos de impresiones o alcance para este medio.</p>}
          <Leyenda items={(Object.keys(CUAD) as Cuadrante[]).map((c) => ({ color: CUAD[c].color, label: `${CUAD[c].label} (${CUAD[c].desc})` }))} />
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Qué hacer con cada pieza · {medio} · {anio}</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0", color: "var(--muted)" }}>
            <th style={{ padding: "6px 8px" }}>Pieza</th><th style={{ padding: "6px 8px", textAlign: "right" }}>Inversión</th><th style={{ padding: "6px 8px", textAlign: "right" }}>Videos completos</th>
            <th style={{ padding: "6px 8px", textAlign: "right" }}>Costo por video completo</th><th style={{ padding: "6px 8px", textAlign: "right" }}>Costo por {milTxt}</th><th style={{ padding: "6px 8px" }}>Estado</th><th style={{ padding: "6px 8px" }}>Qué hacer</th>
          </tr></thead>
          <tbody>
            {visibles.map((p) => (
              <tr key={p.key} style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                <td style={{ padding: "6px 8px", maxWidth: 260 }}>
                  {p.link ? <a href={p.link} target="_blank" rel="noreferrer" style={{ color: "#1e40af" }}>{p.nombre}</a> : p.nombre}
                  {p.activa != null && <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.activa ? "Activa" : "Pausada"}</div>}
                </td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{money(p.inv)}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{nf(p.completos)}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{p.costo != null ? money(p.costo) : "—"}</td>
                <td style={{ padding: "6px 8px", textAlign: "right" }}>{p.costoMil != null ? money(p.costoMil) : "—"}</td>
                <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}><span style={{ color: ZONA[p.zona].color, fontWeight: 600 }}>● {ZONA[p.zona].label}</span>{p.cuadrante && <div style={{ fontSize: 11, color: "var(--muted)" }}>{CUAD[p.cuadrante].label}</div>}</td>
                <td style={{ padding: "6px 8px" }}>{p.accion}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length > 15 && <button onClick={() => setTodas((v) => !v)} style={{ marginTop: 8, fontSize: 12.5, border: 0, background: "none", color: "#1e40af", cursor: "pointer" }}>{todas ? "Ver menos" : `Ver las ${lista.length} piezas`}</button>}
        <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>
          Mide eficiencia de marca (que vean el video entero), no ventas. Meta y DV360 se miden por mes, así que la lectura es mensual. YouTube (DV360) no trae el nombre de cada pieza y Demand Gen de Google Ads no informa videos vistos: no entran. DV360 se pasa a pesos con el tipo de cambio real del mes. <LearnButton k="escalar_cortar" corner={false} />
        </p>
      </div>
    </div>
  );
}

function Leyenda({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11.5, marginTop: 4 }}>
      {items.map((i) => <span key={i.label} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 9, background: i.color }} />{i.label}</span>)}
    </div>
  );
}
