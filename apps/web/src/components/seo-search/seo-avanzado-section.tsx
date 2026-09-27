import { loadSeoAvanzado } from "@/lib/seo-avanzado-server";
import { COMPONENTE_LABEL, lecturaIndice, type ComponenteDigital } from "@/lib/marca-indices";
import { fTasaIc, LLMO_MIN_N, LLMO_WINDOW_DAYS } from "@/lib/llmo-stats";
import { TIPO_FUENTE_LABEL } from "@/lib/llmo-fuentes";
import { CAUSA_TXT } from "@/lib/sc-deep";
import { SEVERIDAD_LABEL, CWV_UMBRAL, estadoMetrica, shortUrl, type Severidad } from "@/lib/seo-audit-core";
import { CTR_FUENTE, TRAMOS } from "@/lib/ctr-curve";
import { SEMAFORO_COLOR } from "@/lib/metas";

// ============================================================================
// SEO / GEO avanzado (portado de BIP, sep-2026). Server components que leen UNA vez por request
// (loadSeoAvanzado, React cache): Salud digital + ESoS, Visibilidad en IA con margen de error y
// fuentes citadas, evolución por keyword, Search Console a fondo y auditoría técnica + CWV.
// Paleta sobria: Drean en azul #1e40af, resto en tinta/gris; verde/ámbar/rojo SOLO estado.
// ============================================================================

const OWN = "#1e40af";
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const ymLbl = (ym: string) => `${MES[Number(ym.slice(5, 7)) - 1] ?? ym}-${ym.slice(2, 4)}`;
const nf = (v: number, d = 0) => v.toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d });
const f1 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : nf(v, 1));
const sgn = (v: number | null | undefined, suf = "") => (v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${nf(v, 1)}${suf}`);
const col = (v: number | null | undefined) => (v == null || v === 0 ? "#64748b" : v > 0 ? SEMAFORO_COLOR.verde : SEMAFORO_COLOR.rojo);
const pathOf = (u: string) => { try { const x = new URL(u); const p = x.pathname + x.search; return p.length > 60 ? `${p.slice(0, 59)}…` : p || "/"; } catch { return u.slice(0, 60); } };
const TH = "px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b";
const THR = `${TH} text-right`;
const TD = "px-2 py-1.5 text-xs border-b tabular-nums";
const TDR = `${TD} text-right`;

function Card({ t, v, sub, color = OWN }: { t: string; v: string; sub?: React.ReactNode; color?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight tabular-nums" style={{ color }}>{v}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
function Head({ t, sub }: { t: string; sub: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-tight">{t}</h2>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

// ── 1. Salud digital de marca + ESoS ─────────────────────────────────────────
export async function MarcaDigitalSection() {
  const a = await loadSeoAvanzado();
  const d = a.salud;
  const comps: ComponenteDigital[] = ["sos", "soe", "ia", "serp"];
  const fmtVal = (c: ComponenteDigital, v: number | undefined) => (v == null ? "—" : c === "serp" ? f1(v) : `${f1(v)}%`);
  return (
    <section className="space-y-3 border-t pt-6">
      <Head t="Salud digital de marca y ESoS" sub="Cómo está Drean frente al set en lo que se mide todos los meses sin encuesta (búsquedas, conversación en redes, IA y Google), y si el share of search anticipa suba o baja de share de mercado." />
      {d?.ultimo && d.own ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card t={`Índice digital · ${ymLbl(d.ultimo.mes)}`} v={f1(d.own.indice)} sub={<>{lecturaIndice(d.own)} · vs mes anterior <b style={{ color: col(d.prev ? d.own.indice - d.prev.indice : null) }}>{sgn(d.prev ? d.own.indice - d.prev.indice : null)}</b></>} />
            <Card t="Posición en el set" v={d.rank ? `#${d.rank}` : "—"} color="#0f172a" sub={<>de {d.ultimo.marcas.length} marcas · 1º: {d.ultimo.marcas[0]?.marca ?? "—"}</>} />
            {comps.filter((c) => d.ultimo!.componentes.includes(c)).slice(0, 2).map((c) => (
              <Card key={c} t={COMPONENTE_LABEL[c]} v={fmtVal(c, d.own!.valores[c])} color="#0f172a" sub={d.own!.z[c] == null ? "sin dato propio este mes" : <>vs el set <b style={{ color: col(d.own!.z[c]) }}>{sgn(d.own!.z[c], " σ")}</b>{c === "serp" ? " (menor es mejor)" : ""}</>} />
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card p-4">
            <div className="mb-2 text-sm font-semibold">Todas las marcas · {ymLbl(d.ultimo.mes)}</div>
            <table className="w-full min-w-[560px] border-collapse">
              <thead><tr><th className={TH}>#</th><th className={TH}>Marca</th><th className={THR}>Índice</th>{d.ultimo.componentes.map((c) => <th key={c} className={THR}>{COMPONENTE_LABEL[c]}</th>)}</tr></thead>
              <tbody>{d.ultimo.marcas.map((m, i) => (
                <tr key={m.marca} style={{ color: m.own ? OWN : undefined, fontWeight: m.own ? 600 : 400 }}>
                  <td className={TD}>{i + 1}</td><td className={TD}>{m.marca}</td><td className={TDR}>{f1(m.indice)}</td>
                  {d.ultimo!.componentes.map((c) => <td key={c} className={TDR}>{fmtVal(c, m.valores[c])}</td>)}
                </tr>
              ))}</tbody>
            </table>
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground">Metodología</summary>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Componentes por marca y mes: <b>Share of Search</b> (vw_share_of_search, promedio de categorías), <b>Share of engagement</b> (likes + comentarios en social_posts ÷ los del set), <b>Visibilidad en IA</b> (share de menciones en seo_llmo) e <b>Índice de posición SEO</b> (seo_index_history, invertido: menor es mejor). Cada componente se estandariza contra el set (z = (valor − promedio) ÷ desvío, ≥3 marcas) y el índice es <b>50 + 10 × promedio de los z</b> (escala T: 50 = promedio del set, ±10 = ±1 desvío), pesos iguales, mínimo 2 componentes. Mes de referencia: entre los 3 últimos, el que tiene más componentes. Es un índice relativo al set competitivo y conductual, no una encuesta.
              </p>
            </details>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed bg-card p-4 text-xs text-muted-foreground">Sin datos suficientes para el índice (hacen falta ≥3 marcas con ≥2 componentes en el mismo mes).</div>
      )}

      {a.esos.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card p-4">
          <div className="text-sm font-semibold">Share of Search vs share de mercado (ESoS) · por categoría</div>
          <p className="mb-2 mt-0.5 text-[11px] text-muted-foreground">ESoS = share of search de Drean (promedio móvil 6 meses) − share de mercado GfK (año móvil, unidades, segmento Total). Positivo sostenido (≥ +0,5 pp, 3+ meses) → el share tiende a subir; negativo → a bajar (Binet / IPA). Solo meses cerrados.</p>
          <table className="w-full min-w-[620px] border-collapse">
            <thead><tr><th className={TH}>Categoría</th><th className={THR}>Mes</th><th className={THR}>SoS (prom. 6m)</th><th className={THR}>Share GfK</th><th className={THR}>ESoS</th><th className={THR}>Ratio</th><th className={TH}>Lectura</th></tr></thead>
            <tbody>{a.esos.map((e) => {
              const u = e.res.ultimo;
              const lect = e.res.lectura === "sube" ? { t: "El share tiende a subir", c: SEMAFORO_COLOR.verde } : e.res.lectura === "baja" ? { t: "El share tiende a bajar", c: SEMAFORO_COLOR.rojo } : { t: "Sin señal clara", c: "#64748b" };
              return (
                <tr key={e.categoria}>
                  <td className={`${TD} font-medium`}>{e.label}</td>
                  <td className={TDR}>{u ? ymLbl(u.mes) : "—"}</td>
                  <td className={TDR}>{u ? `${f1(u.sosMa)}%` : "—"}</td>
                  <td className={TDR}>{u ? `${f1(u.som)}%` : "—"}</td>
                  <td className={`${TDR} font-semibold`} style={{ color: lect.c }}>{u ? `${sgn(u.esos)} pp` : "—"}</td>
                  <td className={TDR}>{u?.ratio != null ? nf(u.ratio, 2) : "—"}</td>
                  <td className={TD}><span style={{ color: lect.c }}>● {lect.t}</span> <span className="text-muted-foreground">· {e.res.racha} {e.res.racha === 1 ? "mes" : "meses"} {u && (u.esos ?? 0) >= 0 ? "arriba" : "abajo"}</span></td>
                </tr>
              );
            })}</tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {a.esos.some((e) => e.res.lag)
              ? a.esos.filter((e) => e.res.lag).map((e) => `${e.label}: rezago propio ~${e.res.lag!.lag} meses (r = ${nf(e.res.lag!.r, 2)}, ${e.res.lag!.n} pares)`).join(" · ") + ". Es asociación, no causalidad probada."
              : `Todavía no hay historia para estimar el rezago propio (${Math.max(...a.esos.map((e) => e.res.mesesAlineados))} meses en común; hacen falta 18). Referencia de industria: el share of search anticipa al share de mercado en meses.`}
          </p>
        </div>
      )}
    </section>
  );
}

// ── 2. Visibilidad en IA con margen de error + fuentes ───────────────────────
export async function LlmoIcSection() {
  const a = await loadSeoAvanzado();
  if (!a.llmo.length) return null;
  const nMax = Math.max(...a.llmo.flatMap((c) => c.marcas.map((m) => m.s.n)));
  return (
    <section className="space-y-3 border-t pt-6">
      <Head t="Visibilidad en IA · con margen de error" sub={<>Tasa de mención = % de respuestas del asistente (con búsqueda web, Argentina) que nombran a la marca, con su intervalo de confianza de Wilson al 95%. Con pocas respuestas el margen es enorme: mirar si los rangos se solapan antes de leer una diferencia.</>} />
      {nMax < LLMO_MIN_N && (
        <div className="rounded-lg border-l-4 bg-card px-4 py-2 text-xs" style={{ borderLeftColor: SEMAFORO_COLOR.amarillo }}>
          <b>Dato insuficiente:</b> la última medición tiene {nMax} respuestas por categoría (hacen falta ≥{LLMO_MIN_N} y margen ≤ ±20 pp). Desde sep-2026 el sync corre <b>semanal</b> con 12 prompts por categoría y acumula {LLMO_WINDOW_DAYS} días de respuestas (n ≈ 48){a.muestrasDisponibles ? "" : " — falta correr la migración 0118_seo_llmo_muestra.sql para acumular"}.
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-3">
        {a.llmo.map((c) => (
          <div key={c.categoria} className="rounded-xl border bg-card p-4">
            <div className="text-sm font-semibold">{c.label} <span className="font-normal text-muted-foreground">· {ymLbl(c.mes)} · n = {c.marcas[0]?.s.n ?? 0}</span></div>
            <div className="mt-2 space-y-1.5">
              {c.marcas.slice(0, 8).map((m) => (
                <div key={m.marca}>
                  <div className="flex justify-between text-[11px]" style={{ color: m.own ? OWN : undefined, fontWeight: m.own ? 600 : 400 }}>
                    <span>{m.marca}</span><span className="tabular-nums">{fTasaIc(m.s)}</span>
                  </div>
                  <div className="relative h-2 rounded bg-slate-100">
                    <div className="absolute inset-y-0 rounded" title={`IC 95%: ${nf(m.s.lo, 0)}–${nf(m.s.hi, 0)}%`} style={{ left: `${m.s.lo}%`, width: `${Math.max(1, m.s.hi - m.s.lo)}%`, background: m.own ? "#93c5fd" : "#cbd5e1" }} />
                    <div className="absolute inset-y-0 w-[3px] rounded" style={{ left: `calc(${m.s.tasa}% - 1px)`, background: m.own ? OWN : "#0f172a" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {a.fuentes.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {a.fuentes.map((f) => (
            <div key={f.categoria} className="overflow-x-auto rounded-xl border bg-card p-4">
              <div className="text-sm font-semibold">Fuentes que cita la IA · {f.categoria}</div>
              <p className="mb-2 mt-0.5 text-[11px] text-muted-foreground">{f.respuestasConFuentes} de {f.respuestas} respuestas citaron URLs · citas a drean.com.ar: <b>{f.citationSharePropio != null ? `${nf(f.citationSharePropio, 1)}%` : "—"}</b> · {f.porTipo.slice(0, 4).map((t) => `${TIPO_FUENTE_LABEL[t.tipo]} ${nf(t.pct, 0)}%`).join(" · ")}</p>
              <table className="w-full border-collapse">
                <thead><tr><th className={TH}>Dominio</th><th className={TH}>Tipo</th><th className={THR}>Citas</th><th className={THR}>Solo competencia</th></tr></thead>
                <tbody>{f.top.slice(0, 8).map((x) => (
                  <tr key={x.dominio}><td className={TD}>{x.dominio}</td><td className={`${TD} text-muted-foreground`}>{TIPO_FUENTE_LABEL[x.tipo]}</td><td className={TDR}>{x.citas}</td><td className={TDR}>{x.soloCompetidores}</td></tr>
                ))}</tbody>
              </table>
              {f.faltantes.length > 0 && <p className="mt-2 text-[11px]"><b>Fuentes que te faltan</b> (citadas cuando la IA nombra competidores y no a Drean): {f.faltantes.slice(0, 6).map((x) => x.dominio).join(", ")}.</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Fuentes citadas por la IA: se completan con el próximo sync semanal{a.muestrasDisponibles ? "" : " (requiere la migración 0118_seo_llmo_muestra.sql)"}.</p>
      )}
    </section>
  );
}

// ── 3. Evolución por keyword (seo_rankings) ──────────────────────────────────
export async function KwEvolucionSection() {
  const a = await loadSeoAvanzado();
  const k = a.kwEvol;
  if (!k) return null;
  const Tabla = ({ rows, titulo }: { rows: typeof k.ganadoras; titulo: string }) => (
    <div className="overflow-x-auto rounded-xl border bg-card p-4">
      <div className="mb-2 text-sm font-semibold">{titulo}</div>
      {rows.length ? (
        <table className="w-full border-collapse">
          <thead><tr><th className={TH}>Keyword</th><th className={TH}>Cat.</th><th className={THR}>Vol./mes</th><th className={THR}>Antes</th><th className={THR}>Ahora</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={`${r.categoria}|${r.keyword}`}><td className={TD} title={r.url ?? ""}>{r.keyword}</td><td className={`${TD} text-muted-foreground`}>{r.categoria}</td><td className={TDR}>{nf(r.volumen)}</td><td className={TDR}>{r.posDesde ?? "—"}</td><td className={`${TDR} font-semibold`}>{r.posHasta ?? "—"}</td></tr>
          ))}</tbody>
        </table>
      ) : <p className="text-xs text-muted-foreground">Sin cambios de ≥3 posiciones.</p>}
    </div>
  );
  const ult = k.visibilidad[k.visibilidad.length - 1], pri = k.visibilidad[0];
  return (
    <section className="space-y-3 border-t pt-6">
      <Head t="Evolución por keyword · drean.com.ar" sub={<>Fotos de la SERP (seo_rankings) del {k.desde} al {k.hasta} ({k.semanas} fotos). “—” = no aparece en el top-100. Ganadoras/perdedoras: cambio de ≥3 posiciones o entrada/salida del top-10, ponderado por volumen.</>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card t="Entraron al top-10" v={nf(k.entraronTop10)} color={SEMAFORO_COLOR.verde} />
        <Card t="Salieron del top-10" v={nf(k.salieronTop10)} color={SEMAFORO_COLOR.rojo} />
        <Card t="Keywords en top-3" v={ult ? nf(ult.top3) : "—"} color="#0f172a" sub={pri && ult ? `antes ${nf(pri.top3)}` : undefined} />
        <Card t="Keywords en top-10" v={ult ? nf(ult.top10) : "—"} color="#0f172a" sub={pri && ult ? `antes ${nf(pri.top10)} · rankea en ${nf(ult.rankeadas)}` : undefined} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Tabla rows={k.ganadoras} titulo="Ganadoras" />
        <Tabla rows={k.perdedoras} titulo="Perdedoras" />
      </div>
    </section>
  );
}

// ── 4. Search Console a fondo ────────────────────────────────────────────────
export async function ScAvanzadoSection() {
  const a = await loadSeoAvanzado();
  const s = a.scDeep;
  if (!s) return null;
  const curva = a.curve
    ? `curva PROPIA de CTR (Search Console, búsquedas sin marca; tramos ${TRAMOS.filter((_, i) => a.curve!.fuente[i] === "propia").map((t) => t.label).join(", ")})`
    : `curva de referencia ${CTR_FUENTE} (rango con/sin Resumen IA); con más impresiones sin marca se calibra la propia`;
  return (
    <section className="space-y-3 border-t pt-6">
      <Head t="Search Console a fondo" sub={<>Canibalización, contenido que decae y mobile vs desktop sobre los datos propios de Google. CTR esperado: {curva}.</>} />
      {a.scImpresionesMes != null && a.scImpresionesMes < 20000 && (
        <div className="rounded-lg border-l-4 bg-card px-4 py-2 text-xs" style={{ borderLeftColor: SEMAFORO_COLOR.amarillo }}>
          <b>La propiedad {a.scSite} ve muy poco:</b> {nf(a.scImpresionesMes)} impresiones en el último mes cerrado, mientras GA4 registra decenas de miles de sesiones orgánicas por mes. Probablemente el tráfico del sitio vive en otra propiedad (ej. <code>sc-domain:drean.com.ar</code> o la versión sin www): dar acceso a la cuenta del token en esa propiedad y volver a correr <b>Search Console sync</b>.
        </div>
      )}
      {!s.disponible && <p className="text-[11px] text-muted-foreground">Decaimiento y dispositivos se completan con el próximo <b>Search Console sync</b> (el snapshot actual es anterior a esta versión).</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-xl border bg-card p-4">
          <div className="text-sm font-semibold">Canibalización</div>
          <p className="mb-2 mt-0.5 text-[11px] text-muted-foreground">Búsquedas (sin marca, ≥200 impresiones en 90 días, posición media 3-20) donde 2+ URLs propias se reparten las impresiones (la 2ª con ≥15%).</p>
          {s.canibalizacion.length ? (
            <table className="w-full border-collapse">
              <thead><tr><th className={TH}>Búsqueda</th><th className={THR}>Impr.</th><th className={THR}>Pos.</th><th className={TH}>URLs (share)</th><th className={THR}>+Clicks/mes</th></tr></thead>
              <tbody>{s.canibalizacion.slice(0, 8).map((c) => (
                <tr key={c.query}><td className={TD}>{c.query}</td><td className={TDR}>{nf(c.impresiones)}</td><td className={TDR}>{nf(c.posicionMedia, 1)}</td><td className={`${TD} text-[10px] text-muted-foreground`}>{c.urls.slice(0, 3).map((u) => `${pathOf(u.page)} ${nf(u.share, 0)}%`).join(" · ")}</td><td className={TDR}>{nf(c.clicksGanables)}</td></tr>
              ))}</tbody>
            </table>
          ) : <p className="text-xs text-muted-foreground">Sin búsquedas canibalizadas con esos umbrales.</p>}
        </div>
        <div className="overflow-x-auto rounded-xl border bg-card p-4">
          <div className="text-sm font-semibold">Contenido que decae</div>
          <p className="mb-2 mt-0.5 text-[11px] text-muted-foreground">Páginas con −20% de clics vs los 90 días previos y −30% vs el mismo período del año anterior (−35% si no hay interanual), con la causa probable.</p>
          {s.decaimiento.length ? (
            <table className="w-full border-collapse">
              <thead><tr><th className={TH}>Página</th><th className={THR}>Clicks</th><th className={THR}>Antes</th><th className={THR}>Δ</th><th className={TH}>Causa</th></tr></thead>
              <tbody>{s.decaimiento.slice(0, 8).map((p) => (
                <tr key={p.page}><td className={TD} title={p.page}>{pathOf(p.page)}</td><td className={TDR}>{nf(p.clicks)}</td><td className={`${TDR} text-muted-foreground`}>{nf(p.clicksPrev)}</td><td className={`${TDR} font-semibold`}>{sgn(p.d90 * 100, "%")}</td><td className={TD} title={CAUSA_TXT[p.causa].accion}>{CAUSA_TXT[p.causa].titulo}</td></tr>
              ))}</tbody>
            </table>
          ) : <p className="text-xs text-muted-foreground">{s.disponible ? "Ninguna página con caída sostenida." : "Pendiente del próximo sync."}</p>}
        </div>
      </div>
      {s.dispositivos.filas.length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card p-4">
          <div className="text-sm font-semibold">Mobile vs desktop <span className="font-normal text-muted-foreground">· 90 días</span></div>
          {s.dispositivos.hallazgo && <p className="mt-1 text-xs" style={{ color: SEMAFORO_COLOR.amarillo }}>● {s.dispositivos.hallazgo.texto}</p>}
          <table className="mt-2 w-full border-collapse">
            <thead><tr><th className={TH}>Dispositivo</th><th className={THR}>Clicks</th><th className={THR}>% clicks</th><th className={THR}>CTR</th><th className={THR}>Esperado</th><th className={THR}>Posición</th><th className={THR}>Δ clicks</th></tr></thead>
            <tbody>{s.dispositivos.filas.map((f) => (
              <tr key={f.device}><td className={`${TD} font-medium`}>{f.label}</td><td className={TDR}>{nf(f.clicks)}</td><td className={TDR}>{nf(f.shareClicks, 0)}%</td><td className={TDR}>{nf(f.ctr, 2)}%</td><td className={`${TDR} text-muted-foreground`}>{nf(f.ctrEsperado, 1)}%</td><td className={TDR}>{nf(f.position, 1)}</td><td className={TDR}>{f.dClicks != null ? sgn(f.dClicks * 100, "%") : "—"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── 5. Auditoría técnica + Core Web Vitals ───────────────────────────────────
const SEV_COLOR: Record<Severidad, string> = { error: SEMAFORO_COLOR.rojo, warning: SEMAFORO_COLOR.amarillo, notice: "#64748b" };
const CWV_COLOR = { bueno: SEMAFORO_COLOR.verde, mejorable: SEMAFORO_COLOR.amarillo, malo: SEMAFORO_COLOR.rojo } as const;

export async function AuditoriaSection() {
  const a = await loadSeoAvanzado();
  const st = a.audit;
  const head = <Head t="Auditoría técnica SEO / GEO + Core Web Vitals" sub="drean.com.ar: indexación, bots de IA en robots.txt, sitemap, títulos/descripciones/H1/canonical/schema, contenido que depende de JavaScript y velocidad real (CrUX / PageSpeed Insights). Se repite cada lunes." />;
  if (st.status !== "ok") {
    return (
      <section className="space-y-3 border-t pt-6">
        {head}
        <div className="rounded-xl border border-dashed bg-card p-4 text-xs text-muted-foreground">
          {st.status === "no_table"
            ? <>Falta correr la migración <code>0117_web_calidad_seo_audit.sql</code> en el SQL Editor de Supabase y después el workflow <b>SEO auditoría técnica</b> (GitHub → Actions → Run workflow).</>
            : <>Todavía no corrió la auditoría: GitHub → Actions → <b>SEO auditoría técnica + Core Web Vitals</b> → Run workflow.</>}
        </div>
      </section>
    );
  }
  const d = st.data;
  if (!d.ok) return <section className="space-y-3 border-t pt-6">{head}<div className="rounded-xl border border-dashed bg-card p-4 text-xs text-muted-foreground">No pudimos auditar el sitio: {d.error}</div></section>;
  const issues = d.issues ?? [];
  const cnt = (s: Severidad) => issues.filter((i) => i.severidad === s).length;
  const iaBloq = (d.bots ?? []).filter((b) => b.tipo === "ia_busqueda" && !b.permitido);
  return (
    <section className="space-y-3 border-t pt-6">
      {head}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card t="Salud técnica" v={d.salud != null ? `${d.salud}/100` : "—"} color="#0f172a" sub={`${d.paginas?.length ?? 0} páginas auditadas (${(d.fuentePaginas ?? []).join(" + ") || "home"}) · ${d.updatedAt.slice(0, 10)}`} />
        <Card t="Errores" v={nf(cnt("error"))} color={cnt("error") ? SEMAFORO_COLOR.rojo : SEMAFORO_COLOR.verde} sub={`${cnt("warning")} advertencias · ${cnt("notice")} avisos`} />
        <Card t="Bots de IA (búsqueda)" v={iaBloq.length ? `${iaBloq.length} bloqueados` : "Permitidos"} color={iaBloq.length ? SEMAFORO_COLOR.rojo : SEMAFORO_COLOR.verde} sub={iaBloq.length ? iaBloq.map((b) => b.ua).join(", ") : "OAI-SearchBot, Claude-SearchBot, PerplexityBot"} />
        <Card t="Sitemap" v={d.sitemap ? (d.sitemap.status < 400 && d.sitemap.tipo !== "invalido" ? `${nf(d.sitemap.urls)} URLs` : `Error ${d.sitemap.status}`) : "No encontrado"} color="#0f172a" sub={d.sitemap ? pathOf(d.sitemap.url) : undefined} />
      </div>
      {!d.psiKey && (
        <div className="rounded-lg border-l-4 bg-card px-4 py-2 text-xs" style={{ borderLeftColor: SEMAFORO_COLOR.amarillo }}>
          <b>Falta la clave de Google (GOOGLE_PSI_KEY)</b>: sin ella no hay datos de usuarios reales de Chrome (CrUX) y PageSpeed Insights usa una cuota compartida{d.psiCuota ? " que esta vez se agotó (429)" : ""}. Crear una API key en Google Cloud con “PageSpeed Insights API” y “Chrome UX Report API” habilitadas y cargarla en Vercel como <code>GOOGLE_PSI_KEY</code>.
        </div>
      )}
      {(d.cwv ?? []).length > 0 && (
        <div className="overflow-x-auto rounded-xl border bg-card p-4">
          <div className="text-sm font-semibold">Core Web Vitals <span className="font-normal text-muted-foreground">· p75 mobile · bueno: LCP ≤ {CWV_UMBRAL.lcp[0] / 1000} s · INP ≤ {CWV_UMBRAL.inp[0]} ms · CLS ≤ {CWV_UMBRAL.cls[0]}</span></div>
          <table className="mt-2 w-full border-collapse">
            <thead><tr><th className={TH}>URL</th><th className={TH}>Fuente</th><th className={THR}>LCP</th><th className={THR}>INP</th><th className={THR}>CLS</th><th className={THR}>Lighthouse</th></tr></thead>
            <tbody>{(d.cwv ?? []).map((c) => {
              const cell = (m: "lcp" | "inp" | "cls", v: number | null, txt: string) => { const e = estadoMetrica(m, v); return <td className={TDR} style={{ color: e ? CWV_COLOR[e] : undefined, fontWeight: e && e !== "bueno" ? 600 : 400 }}>{v == null ? "—" : txt}</td>; };
              return (
                <tr key={c.url + c.fuente}><td className={TD} title={c.url}>{shortUrl(c.url)}</td><td className={`${TD} text-muted-foreground`}>{c.fuente === "url" ? "usuarios reales" : c.fuente === "origen" ? "sitio completo" : "laboratorio"}</td>
                  {cell("lcp", c.lcpMs, c.lcpMs != null ? `${nf(c.lcpMs / 1000, 1)} s` : "")}{cell("inp", c.inpMs, c.inpMs != null ? `${nf(c.inpMs)} ms` : "")}{cell("cls", c.cls, c.cls != null ? nf(c.cls, 2) : "")}
                  <td className={TDR}>{c.perfScore ?? "—"}</td></tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-2 text-sm font-semibold">Problemas encontrados <span className="font-normal text-muted-foreground">· ordenados por severidad y clics afectados</span></div>
        {issues.length ? (
          <div className="space-y-1.5">
            {issues.slice(0, 20).map((i) => (
              <details key={i.check} className="rounded-md border px-3 py-2">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold" style={{ color: SEV_COLOR[i.severidad] }}>● {SEVERIDAD_LABEL[i.severidad]}</span>
                  <span className="font-medium">{i.titulo}</span>
                  <span className="text-muted-foreground">· {i.paginasAfectadas ? `${i.paginasAfectadas} página${i.paginasAfectadas === 1 ? "" : "s"} (${nf(i.pctPaginas, 0)}%)` : "todo el sitio"}{i.clicksAfectados ? ` · ${nf(i.clicksAfectados)} clics SC` : ""}</span>
                </summary>
                <p className="mt-1.5 text-xs text-muted-foreground">{i.porQue}</p>
                <ul className="mt-1 list-disc pl-5 text-xs">{i.como.map((c) => <li key={c}>{c}</li>)}</ul>
                {i.urls.length > 0 && <p className="mt-1 text-[11px] text-muted-foreground">{i.urls.slice(0, 5).map((u) => `${u.url ? shortUrl(u.url) : "Sitio"}: ${u.detalle}`).join(" · ")}</p>}
                <a href={i.recurso.href} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] underline" style={{ color: OWN }}>{i.recurso.titulo}</a>
              </details>
            ))}
          </div>
        ) : <p className="text-xs text-muted-foreground">Sin problemas técnicos en las páginas auditadas.</p>}
      </div>
    </section>
  );
}
