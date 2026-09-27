import type { CierreMes, ProyKpi } from "@/lib/web-forecast";
import type { ChequeoConsent } from "@/lib/web-consent";
import { SELLO_LABEL, type CalidadDato, type EcomFunnel, type AiTraffic, type LandingDrop } from "@/lib/web-calidad";
import type { IaMes } from "@/lib/web-calidad-shared";
import { SEMAFORO_COLOR } from "@/lib/metas";
import { LearnButton } from "@/components/knowledge/learn-button";
import { GuiameButton } from "@/components/copiloto/guiame-button";

// ============================================================================
// Web (portado de BIP, sep-2026): cierre proyectado del mes, chequeo indirecto de consent,
// sello de calidad del dato de GA4, embudo de ecommerce, tráfico desde asistentes de IA y
// landings en caída. Server components SIN estado (el <details> nativo pliega el detalle).
// Paleta sobria: real en azul (#1e40af), comparación / proyección en gris pizarra; verde/ámbar/rojo
// (SEMAFORO_COLOR) SOLO para estado.
// ============================================================================

const DATA = "#1e40af";
const SLATE = "#94a3b8";
const nf = (v: number, d = 0) => v.toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d });
const fP = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "—" : `${nf(v, d)}%`);
const fD = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : ""}${nf(v, 0)}%`);
const fMon = (v: number) => (Math.abs(v) >= 1e6 ? `$${nf(v / 1e6, 1)}M` : `$${nf(v, 0)}`);
const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MES_C = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const mesLbl = (ym: string) => `${MES_C[Number(ym.slice(5, 7)) - 1] ?? ym} ${ym.slice(2, 4)}`;
const TH = "px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b";
const THR = `${TH} text-right`;
const TD = "px-2 py-1.5 text-xs border-b tabular-nums";
const TDR = `${TD} text-right`;

// ── Cierre proyectado ────────────────────────────────────────────────────────
const ESTADO: Record<ProyKpi["estado"], { txt: string; color: string }> = {
  sobre: { txt: "Por encima de la meta", color: SEMAFORO_COLOR.verde },
  en_linea: { txt: "En línea con la meta", color: SEMAFORO_COLOR.amarillo },
  debajo: { txt: "Por debajo de la meta", color: SEMAFORO_COLOR.rojo },
  sin_meta: { txt: "Sin meta cargada", color: SEMAFORO_COLOR["sin-meta"] },
};

function Barra({ k, fmt }: { k: ProyKpi; fmt: (v: number) => string }) {
  const max = Math.max(k.p90 ?? k.cierre, k.meta ?? 0, k.cierre, 1) * 1.05;
  const x = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div className="relative mt-2.5 h-[26px]">
      <div className="absolute inset-x-0 top-2 bottom-2 rounded-md bg-muted" />
      {k.p10 != null && k.p90 != null && <div title="Rango probable (p10–p90)" className="absolute top-2 bottom-2 rounded-md" style={{ left: x(k.p10), width: `calc(${x(k.p90)} - ${x(k.p10)})`, background: "#e2e8f0", border: `1px dashed ${SLATE}` }} />}
      <div title={`Real a la fecha: ${fmt(k.real)}`} className="absolute left-0 top-2 bottom-2 rounded-md" style={{ width: x(k.real), background: DATA }} />
      <div title={`Cierre proyectado: ${fmt(k.cierre)}`} className="absolute top-1 bottom-1 w-[3px] rounded-sm" style={{ left: x(k.cierre), background: "#0f172a" }} />
      {k.meta != null && <div title={`Meta: ${fmt(k.meta)}`} className="absolute top-0 bottom-0 w-[2px]" style={{ left: x(k.meta), background: "#64748b" }} />}
    </div>
  );
}

function KpiCierre({ titulo, k, fmt, preliminar }: { titulo: string; k: ProyKpi; fmt: (v: number) => string; preliminar: boolean }) {
  const e = ESTADO[k.estado];
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight tabular-nums">{fmt(k.cierre)}</span>
        <span className="text-xs text-muted-foreground">cierre proyectado{k.p10 != null && k.p90 != null ? ` · rango ${fmt(k.p10)} a ${fmt(k.p90)}` : preliminar ? " · preliminar" : ""}</span>
      </div>
      <Barra k={k} fmt={fmt} />
      <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span><span style={{ color: DATA }}>■</span> Real a la fecha {fmt(k.real)}</span>
        {k.meta != null && <span>Meta del mes {fmt(k.meta)}{k.pctMeta != null ? ` · ${nf(k.pctMeta, 0)}%` : ""}</span>}
      </div>
      <div className="mt-2 text-xs font-semibold" style={{ color: e.color }}>● {e.txt}</div>
      {k.meta != null && k.necesarioDia != null && k.estado !== "sobre" && (
        <div className="mt-0.5 text-xs">Para llegar: <b>{fmt(k.necesarioDia)}/día</b> en lo que queda del mes (hoy el ritmo es {fmt(k.ritmoDia)}/día).</div>
      )}
    </div>
  );
}

export function CierreMesSection({ c }: { c: CierreMes }) {
  const mesTxt = MES[Number(c.mes.slice(5, 7)) - 1] ?? c.mes;
  return (
    <section className="rounded-lg border bg-card p-6">
      <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">Cierre proyectado de {mesTxt} <LearnButton k="cierre_mes_web" /></h3>
      <p className="text-xs text-muted-foreground">
        Con {c.diasConDato} de {c.diasMes} días (dato GA4 hasta {c.hasta.slice(8, 10)}/{c.hasta.slice(5, 7)}) y {c.diasRestantes} por delante. Método: {c.metodo}.
        {c.preliminar ? " Preliminar: pocos días del mes o poca historia, sin rango." : " El rango (p10–p90) sale de cómo se equivocó este mismo método en las semanas previas (bootstrap por bloques de 7 días)."}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <KpiCierre titulo="Transacciones" k={c.tx} fmt={(v) => nf(v, 0)} preliminar={c.preliminar} />
        <KpiCierre titulo="Total Ingresos" k={c.ingresos} fmt={fMon} preliminar={c.preliminar} />
      </div>
    </section>
  );
}

// ── Consent (chequeo indirecto) ──────────────────────────────────────────────
const CONSENT_COLOR: Record<ChequeoConsent["estado"], string> = { ok: SEMAFORO_COLOR.verde, perdida_media: SEMAFORO_COLOR.amarillo, perdida_alta: SEMAFORO_COLOR.rojo, caida: SEMAFORO_COLOR.rojo, sin_datos: SEMAFORO_COLOR["sin-meta"] };

export function ConsentCheckSection({ c, criterio, todas }: { c: ChequeoConsent; criterio: string; todas: Record<string, number> }) {
  if (c.estado === "sin_datos") return null;
  const color = CONSENT_COLOR[c.estado];
  const ult = c.meses.filter((m) => m.ratio != null).slice(-6);
  return (
    <details className="rounded-lg border bg-card px-4 py-3" style={{ borderLeft: `4px solid ${color}` }} open={c.estado !== "ok"}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Medición y consentimiento</span>
        <LearnButton k="consent" />
        <span className="text-sm font-semibold" style={{ color }}>● {c.titulo}</span>
      </summary>
      <p className="mt-2 text-xs">{c.detalle}</p>
      {c.acciones.length > 0 && <ul className="mt-1.5 list-disc pl-5 text-xs">{c.acciones.map((a) => <li key={a}>{a}</li>)}</ul>}
      {c.acciones.length > 0 && <div className="mt-2"><GuiameButton item={{ tipo: "alerta", titulo: c.titulo, dash: "web", dato: c.detalle, queHacer: c.acciones }} /></div>}
      {ult.length > 0 && (
        <div className="mt-2.5 overflow-x-auto">
          <table className="border-collapse">
            <thead><tr><th className={TH}>Mes</th><th className={THR}>Clicks Google Ads</th><th className={THR}>Sesiones GA4 (google / cpc)</th><th className={THR}>% registrado</th><th className={THR}>Todas las google / cpc</th></tr></thead>
            <tbody>{ult.map((m) => (
              <tr key={m.mes}><td className={TD}>{mesLbl(m.mes)}</td><td className={TDR}>{nf(m.clicks)}</td><td className={TDR}>{nf(m.sesiones)}</td><td className={`${TDR} font-semibold`}>{nf((m.ratio ?? 0) * 100, 0)}%</td><td className={`${TDR} text-muted-foreground`}>{nf(todas[m.mes] ?? 0)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Cómo se calcula: Google Analytics (GA4) no dice cuánta gente rechaza las cookies, así que comparamos las visitas que Analytics atribuye a los anuncios de Google con los clics que informa Google Ads el mismo mes (meses cerrados). {criterio}. Si la medición está sana, Analytics ve entre el 75% y el 100% de los clics.
      </p>
    </details>
  );
}

// ── Calidad del dato + embudo + IA + landings ───────────────────────────────
const SELLO_COLOR: Record<CalidadDato["sello"], string> = { confiable: SEMAFORO_COLOR.verde, advertencias: SEMAFORO_COLOR.amarillo, incompleto: SEMAFORO_COLOR.rojo };
const CHECK_COLOR = { ok: SEMAFORO_COLOR.verde, aviso: SEMAFORO_COLOR.amarillo, falla: SEMAFORO_COLOR.rojo, na: SEMAFORO_COLOR["sin-meta"] } as const;
const CHECK_TXT = { ok: "OK", aviso: "Revisar", falla: "Falta", na: "No aplica" } as const;
const DEVICE: Record<string, string> = { mobile: "Mobile", desktop: "Desktop", tablet: "Tablet" };

export function CalidadDatoBanner({ q, periodo }: { q: CalidadDato; periodo: string }) {
  const color = SELLO_COLOR[q.sello];
  const visibles = q.checks.filter((c) => c.estado !== "na");
  return (
    <details className="rounded-lg border bg-card px-4 py-3" style={{ borderLeft: `4px solid ${color}` }}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Calidad del dato (GA4)</span>
        <LearnButton k="calidad_ga4" />
        <span className="text-sm font-semibold" style={{ color }}>● {SELLO_LABEL[q.sello]}</span>
        <span className="text-xs text-muted-foreground">
          {q.fallas ? `${q.fallas} punto${q.fallas > 1 ? "s" : ""} a corregir` : ""}{q.fallas && q.avisos ? " · " : ""}{q.avisos ? `${q.avisos} a revisar` : ""}{!q.fallas && !q.avisos ? "tracking completo y sin muestreo" : ""} · {periodo} · ver detalle
        </span>
      </summary>
      <table className="mt-2.5 w-full border-collapse">
        <tbody>{visibles.map((c) => (
          <tr key={c.key} className="align-top">
            <td className={`${TD} w-20 whitespace-nowrap font-semibold`} style={{ color: CHECK_COLOR[c.estado] }}>● {CHECK_TXT[c.estado]}</td>
            <td className={`${TD} w-[28%] font-medium`}>{c.label}</td>
            <td className={`${TD} text-muted-foreground`}>{c.detalle}{c.arreglo && c.estado !== "ok" ? <><br /><span className="text-foreground">Cómo arreglarlo: {c.arreglo}</span></> : null}</td>
          </tr>
        ))}</tbody>
      </table>
    </details>
  );
}

function FunnelBars({ f }: { f: EcomFunnel }) {
  const max = Math.max(...f.steps.map((s) => Math.max(s.usuarios, s.usuariosPrev)), 1);
  return (
    <div className="mt-3 flex flex-col gap-3">
      {f.steps.map((s, i) => (
        <div key={s.key}>
          <div className="mb-1 flex justify-between gap-2.5 text-xs">
            <span className="font-semibold">{i + 1}. {s.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {nf(s.usuarios)} usuarios{i > 0 ? <> · <b className="text-foreground">{fP(s.tasa)}</b> del paso anterior{s.tasaPrev != null ? ` (antes ${fP(s.tasaPrev)})` : ""}</> : null}
            </span>
          </div>
          <div className="relative h-3.5 overflow-hidden rounded bg-slate-100">
            <div title="Período anterior" className="absolute inset-y-0 left-0" style={{ width: `${(s.usuariosPrev / max) * 100}%`, background: "#cbd5e1" }} />
            <div title="Período actual" className="absolute left-0 top-[3px] bottom-[3px] rounded-sm" style={{ width: `${Math.max(s.usuarios ? 1 : 0, (s.usuarios / max) * 100)}%`, background: DATA }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function IaSerie({ meses }: { meses: IaMes[] }) {
  const ms = meses.slice(-12);
  const max = Math.max(...ms.map((m) => m.sesiones), 1);
  if (ms.length < 2) return null;
  return (
    <div className="mt-3">
      <div className="flex h-24 items-end gap-1 border-b">
        {ms.map((m) => (
          <div key={m.mes} title={`${mesLbl(m.mes)}: ${nf(m.sesiones)} sesiones${m.sesionesSitio ? ` (${fP((m.sesiones / m.sesionesSitio) * 100, 2)} del sitio)` : ""} · ${nf(m.transacciones)} compras`} className="flex h-full flex-1 flex-col items-center justify-end">
            <span className="mb-0.5 text-[9px] font-semibold tabular-nums">{nf(m.sesiones)}</span>
            <div className="w-[70%] max-w-[28px] rounded-t" style={{ height: `${Math.max(2, (m.sesiones / max) * 75)}%`, background: DATA }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">{ms.map((m) => <span key={m.mes} className="flex-1 text-center text-[9px] text-muted-foreground">{mesLbl(m.mes)}</span>)}</div>
    </div>
  );
}

export function WebQuickWinsSection({ funnel, ai, iaMensual, drops, sitioDelta, periodo }: { funnel: EcomFunnel | null; ai: AiTraffic | null; iaMensual: IaMes[]; drops: LandingDrop[]; sitioDelta: number | null; periodo: string }) {
  const ultIa = iaMensual.filter((m) => m.mes < new Date().toISOString().slice(0, 7)).slice(-1)[0] ?? null;
  return (
    <>
      {funnel && (
        <section className="rounded-lg border bg-card p-6">
          <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">Embudo de ecommerce <LearnButton k="embudo_ecommerce" /></h3>
          <p className="text-xs text-muted-foreground">Usuarios que llegan a cada paso en {periodo} (azul) vs los 28 días previos (gris). La tasa es el % que pasa desde el paso anterior.</p>
          <FunnelBars f={funnel} />
          <div className="mt-3 flex flex-wrap gap-5 text-xs">
            <span>Conversión punta a punta: <b>{fP(funnel.total, 2)}</b>{funnel.totalPrev != null ? <span className="text-muted-foreground"> (antes {fP(funnel.totalPrev, 2)})</span> : null}</span>
            {funnel.mayorCaida && <span>Paso que más empeoró: <b>{funnel.mayorCaida.label}</b> ({nf(funnel.mayorCaida.deltaPp, 1)} pp · ≈{nf(funnel.mayorCaida.comprasPerdidas)} compras menos)</span>}
          </div>
          {funnel.pasosFaltantes.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Sin datos en: {funnel.pasosFaltantes.join(", ")} — falta el tracking de ese paso (ver Calidad del dato).</p>}
          {funnel.porDispositivo.length > 1 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead><tr><th className={TH}>Dispositivo</th>{funnel.steps.map((s) => <th key={s.key} className={THR}>{s.label}</th>)}<th className={THR}>Conversión</th></tr></thead>
                <tbody>{funnel.porDispositivo.map((d) => (
                  <tr key={d.device}><td className={`${TD} font-medium`}>{DEVICE[d.device] ?? d.device}</td>{d.usuarios.map((u, i) => <td key={i} className={TDR}>{nf(u)}</td>)}<td className={`${TDR} font-semibold`}>{fP(d.total, 2)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">Fuente: eventos view_item, add_to_cart, begin_checkout y purchase de GA4 (usuarios por dispositivo sumados).</p>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">Tráfico desde asistentes de IA <LearnButton k="trafico_ia" /></h3>
          <p className="text-xs text-muted-foreground">Sesiones que llegan desde ChatGPT, Gemini, Perplexity, Copilot, Claude y otros (fuente de la sesión en GA4).</p>
          {ai ? (
            <>
              <div className="mt-3 flex flex-wrap gap-6">
                <div><div className="text-2xl font-bold tabular-nums">{nf(ai.sesiones)}</div><div className="text-[11px] text-muted-foreground">sesiones en {periodo} · {fP(ai.share, 2)} del sitio · {fD(ai.delta)} vs 28 días previos</div></div>
                <div><div className="text-2xl font-bold tabular-nums">{fP(ai.conv, 2)}</div><div className="text-[11px] text-muted-foreground">conversión ({ai.ecommerce ? "compras" : "eventos clave"}) · sitio {fP(ai.convSitio, 2)}</div></div>
              </div>
              <table className="mt-2 w-full border-collapse">
                <thead><tr><th className={TH}>Asistente</th><th className={THR}>Sesiones</th><th className={THR}>Anterior</th><th className={THR}>Conversión</th></tr></thead>
                <tbody>{ai.porAsistente.map((a) => (
                  <tr key={a.asistente}><td className={`${TD} font-medium`}>{a.asistente}</td><td className={TDR}>{nf(a.sesiones)}</td><td className={`${TDR} text-muted-foreground`}>{nf(a.sesionesPrev)}</td><td className={TDR}>{fP(a.conv, 2)}</td></tr>
                ))}</tbody>
              </table>
            </>
          ) : ultIa ? (
            <div className="mt-3 text-xs"><b className="text-2xl font-bold tabular-nums">{nf(ultIa.sesiones)}</b> <span className="text-muted-foreground">sesiones en {mesLbl(ultIa.mes)}{ultIa.sesionesSitio ? ` · ${fP((ultIa.sesiones / ultIa.sesionesSitio) * 100, 2)} del sitio` : ""} · {nf(ultIa.transacciones)} compras ({fMon(ultIa.ingresos)})</span></div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">Todavía no llegan visitas desde asistentes de IA.</p>
          )}
          {iaMensual.length >= 2 && <IaSerie meses={iaMensual} />}
          <p className="mt-2 text-[11px] text-muted-foreground">Serie mensual: web_traffic (utm_source de la sesión) · compras: ga4_purchases_daily. Cómo te nombran esos asistentes: tablero SEO → Visibilidad en IA.</p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">Páginas de entrada en caída <LearnButton k="landings_caida" /></h3>
          <p className="text-xs text-muted-foreground">Landings que perdieron ≥30% de sesiones vs los 28 días previos y cayeron bastante más que el sitio ({fD(sitioDelta)}).</p>
          {!drops.length ? (
            <p className="mt-3 text-xs text-muted-foreground">{sitioDelta == null ? "Sin datos del período anterior todavía." : "Ninguna página de entrada relevante cayó más que el sitio."}</p>
          ) : (
            <table className="mt-3 w-full table-fixed border-collapse">
              <thead><tr><th className={`${TH} w-[50%]`}>Landing</th><th className={THR}>Antes</th><th className={THR}>Ahora</th><th className={THR}>Δ</th></tr></thead>
              <tbody>{drops.map((d) => (
                <tr key={d.path}><td className={`${TD} truncate font-mono text-[11px]`} title={d.path}>{d.path}</td><td className={`${TDR} text-muted-foreground`}>{nf(d.sesionesPrev)}</td><td className={TDR}>{nf(d.sesiones)}</td><td className={`${TDR} font-semibold`}>{fD(d.delta)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}

/** Aviso cuando el snapshot todavía no existe (migración / primer cron). */
export function WebCalidadPendiente({ status }: { status: "no_table" | "empty" }) {
  return (
    <div className="rounded-lg border border-dashed bg-card p-4 text-xs text-muted-foreground">
      <b className="text-foreground">Calidad del dato, embudo y tráfico desde IA:</b>{" "}
      {status === "no_table"
        ? <>falta correr la migración <code>0117_web_calidad_seo_audit.sql</code> en el SQL Editor de Supabase y después el workflow <b>Web categoría agg</b> (GitHub → Actions → Run workflow).</>
        : <>todavía no corrió el cron. GitHub → Actions → <b>Web categoría agg</b> → Run workflow (corre solo 1x/día).</>}
    </div>
  );
}
