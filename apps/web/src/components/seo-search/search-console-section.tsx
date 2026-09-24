import { getSearchConsoleSnapshot, SC_OWN_DOMAIN, type SearchConsoleData, type ScSnapshot } from "@/lib/search-console";
import { analyzeSearchConsole } from "@/lib/signals/model";

// Search Console — el SEO REAL de drean.com.ar (clicks, impresiones, CTR y posición por
// búsqueda y por página; datos propios de Google, no estimaciones). Server component: lee el
// snapshot (search_console_snapshot, lo llena el cron semanal) y analiza con las funciones
// PURAS de lib/signals/model (mismas que las señales cruce_sc_*). Estados claros cuando falta
// la migración, el permiso (scope) del token, la API habilitada o la propiedad del sitio.

const DATA = "#1e40af";
const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const mesLbl = (ym: string) => `${MES[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
const nf = (v: number, d = 0) => v.toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: d });
const fN = (v: number) => (v >= 1e6 ? `${nf(v / 1e6, 1)}M` : v >= 1e4 ? `${nf(v / 1e3, 1)}K` : nf(v));
const pathOf = (u: string | null) => {
  if (!u) return "—";
  try { const p = new URL(u).pathname; return p.length > 48 ? `${p.slice(0, 47)}…` : p; } catch { return u.slice(0, 48); }
};
const TH = "px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b";
const THR = `${TH} text-right`;
const TD = "px-2 py-1.5 text-xs border-b tabular-nums";
const TDR = `${TD} text-right`;

function Estado({ snap }: { snap: ScSnapshot }) {
  let titulo = "Search Console todavía no está conectado";
  let texto: React.ReactNode = null;
  if (snap.status === "no_table") {
    titulo = "Falta la tabla de Search Console";
    texto = <>Correr la migración <code>0107_search_console.sql</code> en el SQL Editor de Supabase y después el workflow <b>Search Console sync</b> (GitHub → Actions → Run workflow).</>;
  } else if (snap.status === "empty") {
    titulo = "Todavía no se corrió el sync de Search Console";
    texto = <>GitHub → Actions → <b>Search Console sync</b> → Run workflow. Corre solo todos los martes.</>;
  } else {
    const d = snap.data;
    if (d.code === "no_scope") {
      titulo = "El token de Google no tiene permiso de Search Console";
      texto = <>El <code>GOOGLE_REFRESH_TOKEN</code> (el mismo de GA4 y Google Ads) se generó sin el scope <code>webmasters.readonly</code>. Hay que regenerarlo en OAuth Playground con los 3 scopes (analytics.readonly + adwords + webmasters.readonly), usando la cuenta de Google que administra {SC_OWN_DOMAIN} en Search Console, reemplazarlo en Vercel y redeployar. Pasos exactos en CLAUDE.md (“KPIs de mercado con metas + Search Console”).</>;
    } else if (d.code === "api_disabled") {
      titulo = "La API de Search Console no está habilitada";
      texto = <>Habilitar <b>Google Search Console API</b> en el proyecto de Google Cloud de la app OAuth (el mismo donde están habilitadas GA4 y Google Ads) y volver a correr el workflow.</>;
    } else if (d.code === "no_site") {
      titulo = `No encontramos ${SC_OWN_DOMAIN} en Search Console`;
      texto = <>{d.error} Dar acceso (al menos lectura) a la cuenta de Google del token en la propiedad de {SC_OWN_DOMAIN} (Search Console → Configuración → Usuarios y permisos).{d.sites?.length ? ` Propiedades visibles: ${d.sites.slice(0, 5).join(", ")}.` : ""}</>;
    } else if (d.code === "no_creds") {
      titulo = "Faltan las credenciales de Google";
      texto = <>No están configuradas <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code> / <code>GOOGLE_REFRESH_TOKEN</code> en Vercel.</>;
    } else {
      titulo = "No pudimos leer Search Console";
      texto = <>Se reintenta en la próxima corrida. ({(d.error ?? "").slice(0, 160)})</>;
    }
  }
  return (
    <div className="rounded-xl border border-dashed bg-card p-4">
      <div className="text-sm font-semibold">{titulo}</div>
      <p className="mt-1 text-xs text-muted-foreground">{texto}</p>
      {snap.status === "ok" && <p className="mt-2 text-[10px] text-muted-foreground/70">Último intento: {new Date(snap.updatedAt).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</p>}
    </div>
  );
}

function Kpi({ label, value, prev, fmt, invert }: { label: string; value: number | null; prev: number | null; fmt: (v: number) => string; invert?: boolean }) {
  const d = value != null && prev != null && prev !== 0 ? ((value - prev) / Math.abs(prev)) * 100 : null;
  const good = d == null ? null : invert ? d < 0 : d > 0;
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{value == null ? "—" : fmt(value)}</div>
      {d != null && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          <span className="font-semibold" style={{ color: good ? "#16a34a" : "#dc2626" }}>{d > 0 ? "+" : ""}{nf(d, 0)}%</span> vs mes anterior
        </div>
      )}
    </div>
  );
}

function Contenido({ d }: { d: SearchConsoleData }) {
  const a = analyzeSearchConsole(d, "drean");
  const cer = (d.monthly ?? []).filter((m) => m.dias >= 20);
  const L = cer[cer.length - 1] ?? null, P = cer[cer.length - 2] ?? null;
  const mon = (d.monthly ?? []).slice(-13);
  const maxC = Math.max(...mon.map((m) => m.clicks), 1);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={`Clicks ${L ? mesLbl(L.mes) : ""}`} value={L?.clicks ?? null} prev={P?.clicks ?? null} fmt={fN} />
        <Kpi label="Impresiones" value={L?.impressions ?? null} prev={P?.impressions ?? null} fmt={fN} />
        <Kpi label="CTR" value={L?.ctr ?? null} prev={P?.ctr ?? null} fmt={(v) => `${nf(v, 2)}%`} />
        <Kpi label="Posición promedio" value={L?.position ?? null} prev={P?.position ?? null} fmt={(v) => nf(v, 1)} invert />
      </div>

      {mon.length >= 2 && (
        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 text-sm font-semibold">Clicks orgánicos por mes <span className="font-normal text-muted-foreground">· el mes en curso es parcial</span></div>
          <div className="flex h-36 items-end gap-1.5 border-b">
            {mon.map((m) => (
              <div key={m.mes} title={`${mesLbl(m.mes)}: ${nf(m.clicks)} clicks · CTR ${nf(m.ctr, 2)}% · pos ${nf(m.position, 1)}`} className="flex h-full flex-1 flex-col items-center justify-end">
                <span className="mb-0.5 text-[10px] font-semibold tabular-nums">{fN(m.clicks)}</span>
                <div className="w-[72%] max-w-[34px] rounded-t" style={{ height: `${Math.max(2, (m.clicks / maxC) * 80)}%`, background: DATA, opacity: m.dias >= 20 ? 1 : 0.45 }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1.5">{mon.map((m) => <span key={m.mes} className="flex-1 text-center text-[10px] text-muted-foreground">{mesLbl(m.mes)}</span>)}</div>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-xl border bg-card p-4">
          <div className="text-sm font-semibold">CTR bajo con buena posición</div>
          <p className="mb-2 mt-0.5 text-[11px] text-muted-foreground">Top-5 en Google pero pocos hacen click: reescribir título y descripción de la página. CTR esperado = curva de industria para esa posición.</p>
          {a.ctrBajo.length ? (
            <table className="w-full border-collapse">
              <thead><tr><th className={TH}>Búsqueda</th><th className={THR}>Pos.</th><th className={THR}>CTR</th><th className={THR}>Esperado</th><th className={THR}>+Clicks</th></tr></thead>
              <tbody>{a.ctrBajo.slice(0, 8).map((r) => (
                <tr key={r.key}><td className={TD} title={r.pagina ?? ""}>{r.key}<div className="text-[10px] text-muted-foreground">{pathOf(r.pagina)}</div></td><td className={TDR}>{nf(r.position, 1)}</td><td className={TDR}>{nf(r.ctr, 1)}%</td><td className={`${TDR} text-muted-foreground`}>{nf(r.ctrEsperado, 0)}%</td><td className={TDR}>{fN(r.clicksExtra)}</td></tr>
              ))}</tbody>
            </table>
          ) : <p className="text-xs text-muted-foreground">Sin casos: las búsquedas top-5 tienen un CTR acorde a su posición.</p>}
        </div>
        <div className="overflow-x-auto rounded-xl border bg-card p-4">
          <div className="text-sm font-semibold">Quick wins: posición 8-20 con impresiones</div>
          <p className="mb-2 mt-0.5 text-[11px] text-muted-foreground">Ya aparece, pero abajo o en la página 2. Llevar esa página al top-3 sumaría estos clicks (3 meses).</p>
          {a.quickWins.length ? (
            <table className="w-full border-collapse">
              <thead><tr><th className={TH}>Búsqueda</th><th className={THR}>Pos.</th><th className={THR}>Impr.</th><th className={THR}>+Clicks</th></tr></thead>
              <tbody>{a.quickWins.slice(0, 8).map((r) => (
                <tr key={r.key}><td className={TD} title={r.pagina ?? ""}>{r.key}<div className="text-[10px] text-muted-foreground">{pathOf(r.pagina)}</div></td><td className={TDR}>{nf(r.position, 1)}</td><td className={TDR}>{fN(r.impressions)}</td><td className={TDR}>{fN(r.clicksExtra)}</td></tr>
              ))}</tbody>
            </table>
          ) : <p className="text-xs text-muted-foreground">Sin búsquedas en posición 8-20 con impresiones relevantes.</p>}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-xl border bg-card p-4">
          <div className="mb-2 text-sm font-semibold">Top búsquedas <span className="font-normal text-muted-foreground">· {d.range?.start} → {d.range?.end}{a.marca ? ` · ${nf(a.marca.shareGenerico, 0)}% de los clicks sin "drean"` : ""}</span></div>
          <table className="w-full border-collapse">
            <thead><tr><th className={TH}>Búsqueda</th><th className={THR}>Clicks</th><th className={THR}>Impr.</th><th className={THR}>CTR</th><th className={THR}>Pos.</th></tr></thead>
            <tbody>{[...(d.queries ?? [])].sort((x, y) => y.clicks - x.clicks).slice(0, 12).map((r) => (
              <tr key={r.key}><td className={TD}>{r.key}</td><td className={TDR}>{fN(r.clicks)}</td><td className={TDR}>{fN(r.impressions)}</td><td className={TDR}>{nf(r.ctr, 1)}%</td><td className={TDR}>{nf(r.position, 1)}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <div className="overflow-x-auto rounded-xl border bg-card p-4">
          <div className="mb-2 text-sm font-semibold">Top páginas</div>
          <table className="w-full border-collapse">
            <thead><tr><th className={TH}>Página</th><th className={THR}>Clicks</th><th className={THR}>Impr.</th><th className={THR}>CTR</th><th className={THR}>Pos.</th></tr></thead>
            <tbody>{(d.pages ?? []).slice(0, 12).map((r) => (
              <tr key={r.key}><td className={TD} title={r.key}>{pathOf(r.key)}</td><td className={TDR}>{fN(r.clicks)}</td><td className={TDR}>{fN(r.impressions)}</td><td className={TDR}>{nf(r.ctr, 1)}%</td><td className={TDR}>{nf(r.position, 1)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export async function SearchConsoleSection() {
  const snap = await getSearchConsoleSnapshot();
  const d = snap.status === "ok" ? snap.data : null;
  return (
    <section id="search-console" className="space-y-3 scroll-mt-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">SEO real · Search Console</h2>
        <p className="text-xs text-muted-foreground">
          Clicks, impresiones, CTR y posición de {SC_OWN_DOMAIN} en Google (datos propios de Search Console, no estimaciones).
          {d?.ok && d.site ? <> Propiedad: <b className="text-foreground">{d.site}</b> · actualizado {new Date(d.updatedAt).toLocaleDateString("es-AR")}</> : null}
        </p>
      </div>
      {d?.ok ? <Contenido d={d} /> : <Estado snap={snap} />}
    </section>
  );
}
