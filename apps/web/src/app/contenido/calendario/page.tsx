"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CATEGORIAS } from "@/lib/contenido-shared";
import { getModelos, getModelo } from "@/lib/producto-catalog";
import { getDiferenciales } from "@/lib/diferenciales";
import { UGC_PERFILES, UGC_PILARES, UGC_FORMATOS, UGC_ESCENARIOS, UGC_CTAS, UGC_DURACIONES, UGC_EDADES, UGC_VESTIMENTAS } from "@/lib/ugc-opciones";
import { BibliotecaUgc } from "@/components/contenido/biblioteca-ugc";

const PILARES = ["Liderazgo marca/porfolio", "Calidad superior", "Respaldo Posventa", "Elegir bien", "Experiencia uso"];
const FORMATOS = [{ v: "imagen", l: "Imagen (post)" }, { v: "carrusel", l: "Carrusel" }];
const ASPECTOS = [{ v: "vertical", l: "Feed vertical 3:4" }, { v: "feed", l: "Cuadrado 1:1" }, { v: "story", l: "Story/Reel 9:16" }];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const ESTADO_COLOR: Record<string, string> = { pendiente: "#94a3b8", generado: "#f59e0b", aprobado: "#10b981", publicado: "#2563eb" };
const ESTADO_LABEL: Record<string, string> = { pendiente: "Pendiente", generado: "Generado", aprobado: "Aprobado ✓", publicado: "Publicado" };

interface Cal {
  id: string;
  fecha: string;
  hora: string | null;
  pilar: string | null;
  categoria: string | null;
  modelo: string | null;
  formato: string | null;
  aspecto: string | null;
  detalles: string | null;
  imagen_url: string | null;
  video_url: string | null;
  caption: string | null;
  hashtags: string[] | null;
  mensaje_clave: string | null;
  bajada: string | null;
  estado: string;
  aprobado: boolean;
  con_placa?: boolean;
  tipo_contenido?: string;
  subtipo?: string;
  idea?: string;
  imagen_final_url?: string | null;
  redes?: string[] | null;
  publicado_ig_id?: string | null;
  publicado_fb_id?: string | null;
  canal?: string;
  perfil?: string;
  guion?: string | null;
  persona_url?: string | null;
  notas?: string | null;
  edad?: string | null;
  vestimenta?: string | null;
}

// Multi-select de diferenciales del producto elegido (se guarda en `notas`,
// coma-separado). Si hay elegidos, la generación se enfoca sólo en esos.
function AtributosSelect({ sku, value, onChange }: { sku: string | null | undefined; value: string; onChange: (v: string) => void }) {
  const ds = getDiferenciales(sku);
  if (!sku || ds.length === 0) return null;
  const sel = new Set((value || "").split(",").map((s) => s.trim()).filter(Boolean));
  const toggle = (attr: string) => {
    const next = new Set(sel);
    if (next.has(attr)) next.delete(attr); else next.add(attr);
    onChange(Array.from(next).join(","));
  };
  return (
    <div className="flex flex-wrap gap-1.5 rounded border bg-secondary/30 p-2">
      <span className="w-full text-[10px] font-semibold uppercase text-muted-foreground">Diferenciales a destacar (opcional · si no elegís, usa los que apliquen)</span>
      {ds.map((d) => (
        <button key={d.atributo} type="button" onClick={() => toggle(d.atributo)} title={d.detalle}
          className={`rounded-full border px-2 py-0.5 text-[10px] ${sel.has(d.atributo) ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
          {d.atributo}
        </button>
      ))}
    </div>
  );
}

function catLabel(v: string | null): string { return CATEGORIAS.find((c) => c.v === v)?.l ?? v ?? ""; }
function falErr(raw: string): string {
  if (/exhausted balance|user is locked|top up|402|insufficient/i.test(raw)) return "Sin créditos en fal.ai — recargá el saldo en fal.ai/dashboard/billing y volvé a intentar.";
  return raw;
}

function wrapCanvas(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// Compone la imagen FINAL (con la placa grabada si con_placa) y devuelve un PNG.
// Sirve para publicar: la placa queda embebida y la URL es permanente.
// Proporciones de la placa (relativas al ANCHO de la imagen). Se usan tanto en
// el canvas (imagen publicada) como en la preview (vía cqw), para que lo que se
// ve sea EXACTAMENTE lo que se publica.
const PLACA_TITULO_R = 0.056;
const PLACA_BAJADA_R = 0.038;
const PLACA_PAD_R = 0.055;

async function componerFinal(imagenUrl: string, titulo: string, bajada: string, conPlaca: boolean): Promise<Blob> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("load")); img.src = imagenUrl; });
  const canvas = document.createElement("canvas");
  const W = (canvas.width = img.naturalWidth);
  const H = (canvas.height = img.naturalHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ctx");
  ctx.drawImage(img, 0, 0);
  if (conPlaca && (titulo.trim() || bajada.trim())) {
    const gradH = H * 0.4;
    const grad = ctx.createLinearGradient(0, H - gradH, 0, H);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, H - gradH, W, gradH);
    const pad = Math.round(W * PLACA_PAD_R);
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = W * 0.02;
    try { await document.fonts.load(`800 ${Math.round(W * 0.065)}px Manrope`); await document.fonts.load(`600 ${Math.round(W * 0.036)}px Manrope`); } catch { /* fallback */ }
    let yBottom = H - pad;
    if (bajada.trim()) {
      const fsB = Math.round(W * PLACA_BAJADA_R);
      ctx.font = `600 ${fsB}px "Manrope", Arial, sans-serif`;
      const bl = wrapCanvas(ctx, bajada, W - pad * 2);
      let y = yBottom - (bl.length - 1) * fsB * 1.25;
      for (const l of bl) { ctx.fillText(l, pad, y); y += fsB * 1.25; }
      yBottom -= bl.length * fsB * 1.25 + fsB * 0.4;
    }
    if (titulo.trim()) {
      const fsT = Math.round(W * PLACA_TITULO_R);
      ctx.font = `800 ${fsT}px "Manrope", Arial, sans-serif`;
      const tl = wrapCanvas(ctx, titulo, W - pad * 2);
      let y = yBottom - (tl.length - 1) * fsT * 1.12;
      for (const l of tl) { ctx.fillText(l, pad, y); y += fsT * 1.12; }
    }
  }
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("toBlob");
  return blob;
}

// Sube un blob a Supabase (URL firmada) y devuelve la URL pública.
async function subirBlob(id: string, blob: Blob, filename: string): Promise<string> {
  const r1 = await fetch("/api/contenido/calendario/upload-url", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, kind: "imagen", filename }),
  });
  const j1 = (await r1.json()) as { ok?: boolean; uploadUrl?: string; publicUrl?: string; error?: string };
  if (!j1.ok || !j1.uploadUrl || !j1.publicUrl) throw new Error(j1.error ?? "no upload url");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const put = await fetch(j1.uploadUrl, {
    method: "PUT",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "image/png", "x-upsert": "true" },
    body: blob,
  });
  if (!put.ok) throw new Error(`put ${put.status}`);
  return j1.publicUrl;
}
function pad(n: number) { return String(n).padStart(2, "0"); }
function ymd(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

export default function CalendarioPage() {
  const now = new Date();
  const [y, setY] = useState(now.getFullYear());
  const [m, setM] = useState(now.getMonth());
  const [items, setItems] = useState<Cal[]>([]);
  const [sel, setSel] = useState<string>(ymd(now.getFullYear(), now.getMonth(), now.getDate()));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [canal, setCanal] = useState<"rrss" | "ugc" | "biblioteca">("rrss");
  const [ugcActiveId, setUgcActiveId] = useState<string | null>(null); // borrador UGC en edición

  const load = useCallback(async () => {
    if (canal === "biblioteca") return; // la Biblioteca (tab) carga su propia data
    setLoading(true);
    setErr(null);
    try {
      // UGC ya no usa calendario: se traen TODAS las piezas ugc (sin filtro de mes).
      // RRSS sigue por mes (desde/hasta) para la grilla.
      const url = canal === "ugc"
        ? `/api/contenido/calendario?canal=ugc`
        : `/api/contenido/calendario?desde=${ymd(y, m, 1)}&hasta=${ymd(y, m, new Date(y, m + 1, 0).getDate())}&canal=rrss`;
      const r = await fetch(url);
      const j = await r.json();
      if (j.ok) setItems(j.items as Cal[]);
      else setErr(j.error ?? "No se pudo leer el calendario.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [y, m, canal]);

  useEffect(() => { load(); }, [load]);

  // Deep-link a una pestaña por hash (#ugc / #biblioteca / #rrss) — para links
  // externos y el botón "volver" de la Biblioteca. Escucha cambios de hash.
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash;
      if (h === "#ugc") setCanal("ugc");
      else if (h === "#biblioteca") setCanal("biblioteca");
      else if (h === "#rrss") setCanal("rrss");
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const byDay = useMemo(() => {
    const map: Record<string, Cal[]> = {};
    for (const it of items) (map[it.fecha] ??= []).push(it);
    return map;
  }, [items]);

  // Grilla del mes (semanas empezando en lunes).
  const grid = useMemo(() => {
    const firstWeekday = (new Date(y, m, 1).getDay() + 6) % 7; // lun=0
    const days = new Date(y, m + 1, 0).getDate();
    const cells: Array<{ fecha: string; d: number } | null> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push({ fecha: ymd(y, m, d), d });
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [y, m]);

  function prevMonth() { if (m === 0) { setY(y - 1); setM(11); } else setM(m - 1); }
  function nextMonth() { if (m === 11) { setY(y + 1); setM(0); } else setM(m + 1); }

  async function addEntry() {
    setErr(null);
    try {
      // UGC: sin calendario, la pieza se crea con la fecha de HOY (solo referencia).
      const hoy = ymd(now.getFullYear(), now.getMonth(), now.getDate());
      const body = canal === "ugc"
        ? { fecha: hoy, canal: "ugc", perfil: "usuario", tipo_contenido: "ugc", aspecto: "story", estado: "pendiente" }
        : { fecha: sel, canal: "rrss", pilar: PILARES[0], categoria: "porfolio", formato: "imagen", aspecto: "vertical", estado: "pendiente" };
      const r = await fetch("/api/contenido/calendario", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.ok) {
        const newId = (j.item as { id?: string } | undefined)?.id;
        if (canal === "ugc" && newId) setUgcActiveId(newId); // que la nueva pieza sea el formulario activo
        load();
      }
      else setErr(`No se pudo agregar: ${j.error ?? "error"}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const selItems = byDay[sel] ?? [];
  // UGC: un solo formulario a la vez. Borradores = piezas NO pasadas a la
  // Biblioteca (aprobado != true), más nuevas primero. El "activo" es el que se
  // muestra; los que se pasan a la Biblioteca (aprobado=true) salen de acá.
  const ugcDrafts = useMemo(() => items.filter((i) => !i.aprobado).reverse(), [items]);
  const ugcActive = useMemo(() => ugcDrafts.find((i) => i.id === ugcActiveId) ?? ugcDrafts[0] ?? null, [ugcDrafts, ugcActiveId]);

  const tabCls = (active: boolean) =>
    `-mb-px border-b-2 px-4 py-2 text-sm font-medium ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1 border-b">
        <button onClick={() => setCanal("rrss")} className={tabCls(canal === "rrss")}>Generación de Contenidos RRSS</button>
        <button onClick={() => setCanal("ugc")} className={tabCls(canal === "ugc")}>Generación de Contenidos UGC</button>
        <button onClick={() => setCanal("biblioteca")} className={tabCls(canal === "biblioteca")}>Biblioteca UGC</button>
      </div>
      {canal === "biblioteca" ? (
        <BibliotecaUgc />
      ) : (
      <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{canal === "ugc" ? "Generador UGC (persona hablando)" : "Calendario de contenido RRSS"}</h2>
          <p className="text-sm text-muted-foreground">{canal === "ugc" ? "Generá videos UGC nativos (guion → video) con perfiles, escenarios y configuraciones. Lo generado se guarda en la Biblioteca UGC. La marca va en el copy, no hablada." : "Planificá el mes, generá cada pieza, revisá y aprobá. La publicación automática en IG/FB es la próxima etapa."}</p>
        </div>
      </header>

      <details className="rounded-xl border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">¿Cómo funciona? (plataformas, modos, proceso)</summary>
        <div className="mt-3 space-y-3 text-muted-foreground">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide">Plataformas / herramientas</div>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Imágenes:</strong> fal.ai — <strong>Nano Banana</strong> (Gemini 2.5 Flash Image) usa el packshot real del producto; <strong>Ideogram v3</strong> para genéricos y contenido creativo.</li>
              <li><strong>Video:</strong> fal.ai — <strong>Kling</strong> / <strong>Veo</strong> (image-to-video, anima la pieza; ~5–8s).</li>
              <li><strong>Copy y concepto:</strong> OpenAI <strong>gpt-4o-mini</strong> (escena, caption, hashtags, título + bajada de la placa).</li>
              <li><strong>Datos:</strong> Supabase — top posts por pilar (insumo del brief), catálogo de modelos (Drive), calendario y <strong>storage</strong> del contenido propio.</li>
              <li><strong>Tipografía de placa:</strong> <strong>Manrope</strong> (marca).</li>
            </ul>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide">Modos de contenido</div>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>Producto:</strong> estética premium fija; producto real (Nano Banana) o el lineup Drean.</li>
              <li><strong>Creativo / editorial:</strong> sale de la cocina — efemérides, trending, beneficio, disruptivo; estética flexible pero on-brand.</li>
              <li><strong>Contenido propio:</strong> subís tus imágenes/videos externos y conviven con lo generado.</li>
            </ul>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide">Proceso</div>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Planificás el mes: agregás piezas a cada día (o subís contenido propio).</li>
              <li><strong>Generar</strong> → imagen + copy + placa (opcional: video).</li>
              <li>Revisás/editás título, bajada, caption y la placa (con/sin graph).</li>
              <li><strong>Aprobás</strong> ✓ las que están OK.</li>
              <li><em>Próxima etapa:</em> las aprobadas se publican solas en IG/FB (falta destrabar permisos de Meta).</li>
            </ol>
          </div>
          <p className="text-xs">Nota: la generación con IA usa <strong>créditos prepagos de fal.ai</strong> (imágenes = centavos; video = más caro por clip).</p>
        </div>
      </details>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-900">
          <strong>Error:</strong> {err}
          {/relation|does not exist|contenido_calendario/i.test(err) && (
            <div className="mt-1">Parece que falta crear la tabla <code>contenido_calendario</code> en Supabase (correr la migración 0075 / el SQL).</div>
          )}
        </div>
      )}

      {canal === "ugc" ? (
        /* GENERADOR UGC — UN solo formulario a la vez. Generás, revisás y decidís:
           "Pasar a Biblioteca" (queda en el stock) o "Descartar". */
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={addEntry} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">+ Nuevo UGC</button>
            {ugcDrafts.length > 1 && (
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                Borrador:
                <select value={ugcActive?.id ?? ""} onChange={(e) => setUgcActiveId(e.target.value)} className="rounded border px-2 py-1 text-xs">
                  {ugcDrafts.map((d, i) => <option key={d.id} value={d.id}>#{ugcDrafts.length - i} · {getModelo(d.modelo ?? "")?.nombreCorto ?? d.idea ?? "sin producto"}</option>)}
                </select>
              </label>
            )}
            {loading && <span className="text-xs text-muted-foreground">cargando…</span>}
            <span className="ml-auto text-[11px] text-muted-foreground">Cuando el video quede bien, pasalo a la Biblioteca ✓</span>
          </div>
          {ugcActive ? (
            <UgcEntryCard key={ugcActive.id} entry={ugcActive} onChange={load} />
          ) : (
            <p className="rounded-lg border bg-card p-6 text-center text-xs text-muted-foreground">Tocá &quot;+ Nuevo UGC&quot; para generar un video.</p>
          )}
        </section>
      ) : (
      <>
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="rounded border px-2 py-1 text-sm hover:bg-secondary">‹</button>
        <div className="min-w-[10rem] text-center text-sm font-medium">{MESES[m]} {y}</div>
        <button onClick={nextMonth} className="rounded border px-2 py-1 text-sm hover:bg-secondary">›</button>
        {loading && <span className="text-xs text-muted-foreground">cargando…</span>}
      </div>

      {/* Grilla del mes */}
      <div className="rounded-xl border bg-card p-2">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-muted-foreground">
          {DIAS.map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((cell, i) => {
            if (!cell) return <div key={i} className="min-h-[64px] rounded bg-muted/20" />;
            const dayItems = byDay[cell.fecha] ?? [];
            const isSel = cell.fecha === sel;
            return (
              <button
                key={i}
                onClick={() => setSel(cell.fecha)}
                className={`min-h-[64px] rounded border p-1 text-left transition-colors hover:bg-muted/40 ${isSel ? "border-primary ring-1 ring-primary" : ""}`}
              >
                <div className="text-[11px] font-medium">{cell.d}</div>
                <div className="mt-0.5 space-y-0.5">
                  {dayItems.slice(0, 3).map((it) => (
                    <div key={it.id} className="flex items-center gap-1 rounded bg-muted/40 p-0.5" title={`${it.pilar ?? ""} · ${catLabel(it.categoria)} · ${ESTADO_LABEL[it.estado] ?? it.estado}`}>
                      {it.imagen_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.imagen_url} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
                      ) : (
                        <span className="h-7 w-7 shrink-0 rounded" style={{ backgroundColor: `${ESTADO_COLOR[it.estado] ?? "#94a3b8"}33` }} />
                      )}
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="truncate text-[9px] font-medium">{it.mensaje_clave || catLabel(it.categoria) || "(sin generar)"}</div>
                        <div className="truncate text-[8px] text-muted-foreground">{catLabel(it.categoria)} · {it.pilar ?? ""}</div>
                      </div>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: ESTADO_COLOR[it.estado] ?? "#94a3b8" }} />
                    </div>
                  ))}
                  {dayItems.length > 3 && <div className="text-[8px] text-muted-foreground">+{dayItems.length - 3} más</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel del día seleccionado */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Piezas del {sel}</h3>
          <button onClick={addEntry} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">+ Agregar pieza</button>
        </div>
        {selItems.length === 0 ? (
          <p className="rounded-lg border bg-card p-6 text-center text-xs text-muted-foreground">Sin piezas para este día. Agregá una con el botón de arriba.</p>
        ) : (
          <div className="space-y-3">
            {selItems.map((it) => <EntryCard key={it.id} entry={it} onChange={load} />)}
          </div>
        )}
      </section>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        {Object.entries(ESTADO_LABEL).map(([k, l]) => (
          <span key={k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: ESTADO_COLOR[k] }} /> {l}</span>
        ))}
      </div>
      </>
      )}
      </>
      )}
    </div>
  );
}

function EntryCard({ entry, onChange }: { entry: Cal; onChange: () => void }) {
  const [e, setE] = useState<Cal>(entry);
  const [busy, setBusy] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [videoModelo, setVideoModelo] = useState("kling");
  const [videoPrompt, setVideoPrompt] = useState("");
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoErr, setVideoErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pubBusy, setPubBusy] = useState(false);

  async function publicarPrueba(red: "instagram" | "facebook") {
    if (!e.imagen_url && !e.video_url) return;
    const nombre = red === "instagram" ? "Instagram" : "Facebook";
    if (!confirm(`¿Publicar esta pieza AHORA en ${nombre}? (se publica en la cuenta real de Drean)`)) return;
    setPubBusy(true);
    try {
      // Si es imagen, componemos la placa (título+bajada) EN ESTE MOMENTO y la
      // subimos, para publicar exactamente lo que se ve. Así no dependemos de que
      // la imagen final se haya guardado al aprobar (que puede fallar).
      let imageUrl: string | undefined;
      if (e.imagen_url && !e.video_url) {
        try {
          const blob = await componerFinal(e.imagen_url, e.mensaje_clave ?? "", e.bajada ?? "", e.con_placa ?? true);
          imageUrl = await subirBlob(e.id, blob, "final.png");
          save({ imagen_final_url: imageUrl }); // best-effort: persiste si la columna existe
        } catch { /* si la composición falla, se publica la imagen cruda */ }
      }
      const r = await fetch("/api/contenido/calendario/publicar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: e.id, red, imageUrl }),
      });
      const j = (await r.json()) as { ok?: boolean; id?: string; error?: string };
      if (j.ok) {
        const col = red === "instagram" ? "publicado_ig_id" : "publicado_fb_id";
        setE((prev) => ({ ...prev, [col]: j.id }));
        alert(`✅ ¡Publicado en ${nombre}! Revisá la cuenta. (id: ${j.id})`);
      } else alert(`Error al publicar: ${falErr(j.error ?? "?")}`);
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPubBusy(false);
    }
  }

  // Instagram no permite borrar por API con los permisos actuales. Recordamos
  // cómo hacerlo a mano y, si ya lo borró, permitimos resetear para republicar.
  function avisoRetirarIG() {
    const yaLoBorre = confirm(
      "Instagram se retira a mano (la API no lo permite con los permisos actuales).\n\n" +
      "Abrí el post en la app de Instagram → ⋯ → Eliminar.\n\n" +
      "¿Ya lo borraste? Aceptar = liberar el botón para poder republicar."
    );
    if (yaLoBorre) setE((prev) => ({ ...prev, publicado_ig_id: null }));
  }

  async function retirarPublicacion(red: "instagram" | "facebook") {
    const col = red === "instagram" ? "publicado_ig_id" : "publicado_fb_id";
    const postId = e[col];
    const nombre = red === "instagram" ? "Instagram" : "Facebook";
    if (!postId) return;
    if (!confirm(`¿Retirar (borrar) esta publicación de ${nombre}? Se elimina de la cuenta real de Drean.`)) return;
    setPubBusy(true);
    try {
      const r = await fetch("/api/contenido/calendario/retirar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: e.id, red, postId }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (j.ok) {
        setE((prev) => ({ ...prev, [col]: null }));
        alert(`🗑️ Publicación retirada de ${nombre}.`);
      } else {
        const err = j.error ?? "?";
        if (red === "instagram" && /#10|insufficient permission/i.test(err)) {
          alert("Instagram no permite borrar publicaciones por API con los permisos actuales (haría falta el permiso instagram_manage_contents, que requiere otra aprobación de Meta).\n\nPor ahora borralo a mano: abrí el post en la app de Instagram → ⋯ → Eliminar.\n\n(En Facebook el botón Retirar sí funciona.)");
        } else alert(`No se pudo retirar: ${err}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPubBusy(false);
    }
  }
  const modelos = useMemo(() => getModelos(e.categoria ?? "porfolio"), [e.categoria]);
  const esCreativo = (e.tipo_contenido ?? "producto") === "creativo";

  useEffect(() => { setE(entry); }, [entry]);

  async function save(patch: Partial<Cal>) {
    setBusy((b) => (b === null ? "save" : b));
    try {
      const r = await fetch("/api/contenido/calendario", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: e.id, ...patch }),
      });
      const j = await r.json();
      if (j.ok) { setE(j.item as Cal); onChange(); }
    } finally { setBusy((b) => (b === "save" ? null : b)); }
  }

  async function generar() {
    setBusy("gen");
    try {
      const r = await fetch("/api/contenido/calendario/generar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: e.id }),
      });
      const j = await r.json();
      if (j.ok) { setE(j.item as Cal); onChange(); }
      else alert(`Error al generar: ${falErr(j.error ?? "?")}`);
    } finally { setBusy(null); }
  }

  async function borrar() {
    if (!confirm("¿Borrar esta pieza?")) return;
    setBusy("del");
    await fetch(`/api/contenido/calendario?id=${e.id}`, { method: "DELETE" });
    onChange();
  }

  async function subir(kind: "imagen" | "video", file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      // 1) URL firmada de subida (para subir directo a Supabase, sin límite de Vercel).
      const r1 = await fetch("/api/contenido/calendario/upload-url", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: e.id, kind, filename: file.name }),
      });
      const j1 = (await r1.json()) as { ok?: boolean; uploadUrl?: string; publicUrl?: string; col?: string; esVideo?: boolean; error?: string };
      if (!j1.ok || !j1.uploadUrl) { alert(`Error al subir: ${j1.error ?? "?"}`); return; }

      // 2) Subida DIRECTA del archivo a Supabase Storage.
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
      const put = await fetch(j1.uploadUrl, {
        method: "PUT",
        headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" },
        body: file,
      });
      if (!put.ok) { alert(`Error al subir el archivo (${put.status}): ${(await put.text()).slice(0, 200)}`); return; }

      // 3) Guardar la URL pública en la entrada.
      const patch: Record<string, unknown> = { id: e.id, [j1.col ?? "imagen_url"]: j1.publicUrl };
      if (!j1.esVideo) patch.estado = "generado";
      const r3 = await fetch("/api/contenido/calendario", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const j3 = (await r3.json()) as { ok?: boolean; item?: Cal; error?: string };
      if (j3.ok && j3.item) { setE(j3.item); onChange(); }
      else alert(`Subió pero no se guardó: ${j3.error ?? "?"}`);
    } catch (err) {
      alert(`Error al subir: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  }

  async function aprobarPieza() {
    const nuevo = !e.aprobado;
    // 1) Aprobar/desaprobar (siempre funciona).
    await save({ aprobado: nuevo, estado: nuevo ? "aprobado" : "generado" });
    // 2) Al aprobar, componer la imagen final (placa grabada) y hostearla permanente
    //    para poder publicarla en IG/FB (las URLs de fal caducan). Best-effort.
    if (nuevo && e.imagen_url) {
      setBusy("save");
      try {
        const blob = await componerFinal(e.imagen_url, e.mensaje_clave ?? "", e.bajada ?? "", e.con_placa ?? true);
        const finalUrl = await subirBlob(e.id, blob, "final.png");
        await save({ imagen_final_url: finalUrl });
      } catch { /* si falla, la pieza queda aprobada igual (sin imagen final) */ }
      finally { setBusy(null); }
    }
  }

  function toggleRed(red: string) {
    const cur = e.redes ?? [];
    const next = cur.includes(red) ? cur.filter((x) => x !== red) : [...cur, red];
    setE({ ...e, redes: next });
    save({ redes: next });
  }

  async function generarVideo() {
    if (!e.imagen_url) return;
    setVideoBusy(true);
    setVideoErr(null);
    try {
      const r = await fetch("/api/generar-video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: e.imagen_url, modelo: videoModelo, prompt: videoPrompt.trim() || undefined, aspecto: e.aspecto ?? "vertical" }),
      });
      const j = (await r.json()) as { ok?: boolean; video_url?: string; error?: string };
      if (j.ok && j.video_url) await save({ video_url: j.video_url });
      else setVideoErr(falErr(j.error ?? "No se pudo generar el video."));
    } catch (err) {
      setVideoErr(err instanceof Error ? err.message : String(err));
    } finally {
      setVideoBusy(false);
    }
  }

  const field = "rounded border px-2 py-1 text-xs";

  return (
    <>
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: ESTADO_COLOR[e.estado] ?? "#94a3b8" }}>{ESTADO_LABEL[e.estado] ?? e.estado}</span>
        <input type="time" value={e.hora?.slice(0, 5) ?? ""} onChange={(ev) => setE({ ...e, hora: ev.target.value })} onBlur={() => save({ hora: e.hora })} className={field} />
        <button onClick={borrar} disabled={busy === "gen" || busy === "del"} className="ml-auto rounded border px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50">Borrar</button>
      </div>

      {/* Parámetros */}
      <div className="mb-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
        <select value={e.tipo_contenido ?? "producto"} onChange={(ev) => { const t = ev.target.value; setE({ ...e, tipo_contenido: t }); save({ tipo_contenido: t }); }} className={field}>
          <option value="producto">Producto</option>
          <option value="creativo">Creativo/editorial</option>
        </select>
        {esCreativo ? (
          <select value={e.subtipo ?? "beneficio"} onChange={(ev) => { const s = ev.target.value; setE({ ...e, subtipo: s }); save({ subtipo: s }); }} className={field}>
            <option value="efemeride">Efeméride</option>
            <option value="trending">Trending</option>
            <option value="beneficio">Beneficio</option>
            <option value="disruptivo">Disruptivo</option>
          </select>
        ) : (
          <>
            <select value={e.pilar ?? ""} onChange={(ev) => setE({ ...e, pilar: ev.target.value })} onBlur={() => save({ pilar: e.pilar })} className={field}>
              {PILARES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={e.categoria ?? "porfolio"} onChange={(ev) => { const c = ev.target.value; setE({ ...e, categoria: c, modelo: null }); save({ categoria: c, modelo: null }); }} className={field}>
              {CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
            <select value={e.modelo ?? ""} onChange={(ev) => setE({ ...e, modelo: ev.target.value || null })} onBlur={() => save({ modelo: e.modelo })} className={field} disabled={modelos.length === 0}>
              <option value="">{modelos.length === 0 ? "— sin modelo —" : "— genérico —"}</option>
              {modelos.map((mm) => <option key={mm.sku} value={mm.sku}>{mm.nombreCorto ?? mm.nombre}</option>)}
            </select>
          </>
        )}
        <select value={e.aspecto ?? "vertical"} onChange={(ev) => setE({ ...e, aspecto: ev.target.value })} onBlur={() => save({ aspecto: e.aspecto })} className={field}>
          {ASPECTOS.map((a) => <option key={a.v} value={a.v}>{a.l}</option>)}
        </select>
        <select value={e.formato ?? "imagen"} onChange={(ev) => setE({ ...e, formato: ev.target.value })} onBlur={() => save({ formato: e.formato })} className={field}>
          {FORMATOS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
        </select>
      </div>
      {(e.tipo_contenido ?? "producto") === "creativo" && (
        <input value={e.idea ?? ""} onChange={(ev) => setE({ ...e, idea: ev.target.value })} onBlur={() => save({ idea: e.idea })} placeholder="Idea / tema: efeméride, trending, concepto… (ej. Día del Padre, lavarropas de nubes)" className={`${field} mb-2 w-full`} />
      )}
      <div className="mb-2">
        <AtributosSelect sku={e.modelo} value={e.notas ?? ""} onChange={(v) => { setE({ ...e, notas: v }); save({ notas: v }); }} />
      </div>
      <input value={e.detalles ?? ""} onChange={(ev) => setE({ ...e, detalles: ev.target.value })} onBlur={() => save({ detalles: e.detalles })} placeholder="Detalles (opcional): puertas cerradas, vista frontal…" className={`${field} mb-2 w-full`} />

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={generar} disabled={busy === "gen" || busy === "del"} className="rounded border px-3 py-1.5 text-xs font-medium hover:bg-secondary disabled:opacity-50">
          {busy === "gen" ? "Generando… (~1 min)" : e.imagen_url ? "Regenerar" : "Generar"}
        </button>
        <span className="text-[11px] text-muted-foreground">o subí contenido propio:</span>
        <label className={`cursor-pointer rounded border px-3 py-1.5 text-xs font-medium hover:bg-secondary ${uploading ? "opacity-50" : ""}`}>
          {uploading ? "Subiendo…" : "⬆ Imagen"}
          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(ev) => { subir("imagen", ev.target.files?.[0] ?? null); ev.target.value = ""; }} />
        </label>
        <label className={`cursor-pointer rounded border px-3 py-1.5 text-xs font-medium hover:bg-secondary ${uploading ? "opacity-50" : ""}`}>
          {uploading ? "Subiendo…" : "⬆ Video"}
          <input type="file" accept="video/*" className="hidden" disabled={uploading} onChange={(ev) => { subir("video", ev.target.files?.[0] ?? null); ev.target.value = ""; }} />
        </label>
      </div>

      {/* Contenido generado */}
      {e.imagen_url && (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <div className="relative inline-block h-min max-w-full shrink-0 self-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={e.imagen_url} alt="pieza" onClick={() => setZoom(true)} title="Click para agrandar" className="block max-h-64 w-auto max-w-full cursor-zoom-in rounded border object-contain" />
            {(e.con_placa ?? true) && (e.mensaje_clave?.trim() || e.bajada?.trim()) && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b bg-gradient-to-t from-black/75 via-black/25 to-transparent px-4 pb-4 pt-10" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
                {e.mensaje_clave?.trim() && <div className="text-lg font-extrabold leading-tight text-white [text-shadow:_0_1px_4px_rgb(0_0_0_/_60%)]">{e.mensaje_clave}</div>}
                {e.bajada?.trim() && <div className="mt-0.5 text-xs font-medium leading-snug text-white/90 [text-shadow:_0_1px_4px_rgb(0_0_0_/_60%)]">{e.bajada}</div>}
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <label className="block text-[10px] font-semibold uppercase text-muted-foreground">Título placa</label>
              <input value={e.mensaje_clave ?? ""} onChange={(ev) => setE({ ...e, mensaje_clave: ev.target.value })} onBlur={() => save({ mensaje_clave: e.mensaje_clave })} className={`${field} w-full`} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase text-muted-foreground">Bajada</label>
              <input value={e.bajada ?? ""} onChange={(ev) => setE({ ...e, bajada: ev.target.value })} onBlur={() => save({ bajada: e.bajada })} className={`${field} w-full`} />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase text-muted-foreground">Caption</label>
              <textarea value={e.caption ?? ""} onChange={(ev) => setE({ ...e, caption: ev.target.value })} onBlur={() => save({ caption: e.caption })} rows={3} className={`${field} w-full`} />
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <input type="checkbox" checked={e.con_placa ?? true} onChange={(ev) => { setE({ ...e, con_placa: ev.target.checked }); save({ con_placa: ev.target.checked }); }} />
              Publicar/mostrar <strong className="font-semibold">con placa</strong> (título + bajada sobre la imagen)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Publicar en:</span>
              <label className="flex items-center gap-1 text-[11px]">
                <input type="checkbox" checked={(e.redes ?? []).includes("instagram")} onChange={() => toggleRed("instagram")} /> Instagram
              </label>
              <label className="flex items-center gap-1 text-[11px]">
                <input type="checkbox" checked={(e.redes ?? []).includes("facebook")} onChange={() => toggleRed("facebook")} /> Facebook
              </label>
            </div>
            <button
              onClick={aprobarPieza}
              disabled={busy === "gen" || busy === "del" || busy === "save"}
              className={`rounded px-3 py-1.5 text-xs font-medium ${e.aprobado ? "bg-emerald-600 text-white" : "border hover:bg-secondary"}`}
            >
              {busy === "save" ? "Preparando…" : e.aprobado ? "✓ Aprobado (click para desaprobar)" : "Aprobar y preparar para publicar"}
            </button>

            {/* Video */}
            <div className="space-y-1 border-t pt-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Video (≤6s)</span>
                <select value={videoModelo} onChange={(ev) => setVideoModelo(ev.target.value)} className={field}>
                  <option value="kling">Kling (5s)</option>
                  <option value="veo">Veo (~8s)</option>
                </select>
                <input value={videoPrompt} onChange={(ev) => setVideoPrompt(ev.target.value)} placeholder="movimiento (opcional)" className={`${field} min-w-[8rem] flex-1`} />
                <button onClick={generarVideo} disabled={videoBusy} className="rounded border px-3 py-1 text-xs font-medium hover:bg-secondary disabled:opacity-50">
                  {videoBusy ? "Generando… (~1-3 min)" : e.video_url ? "Regenerar video" : "Generar video"}
                </button>
              </div>
              {videoErr && <p className="text-[10px] text-red-700">{videoErr}</p>}
              {e.video_url && (
                <div className="space-y-1">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video src={e.video_url} controls loop className="max-h-56 w-auto max-w-full rounded border" />
                  <a href={e.video_url} target="_blank" rel="noopener" className="inline-block rounded border px-2 py-0.5 text-[10px] font-medium hover:bg-secondary">Abrir / descargar video</a>
                </div>
              )}
            </div>

            {/* Publicar prueba (manual, publica en la cuenta real ahora) */}
            <div className="flex flex-wrap items-center gap-2 border-t pt-2">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Publicar prueba</span>
              {e.publicado_ig_id ? (
                // IG no se puede borrar por API (falta instagram_manage_contents). Se
                // retira a mano desde la app; el botón sólo recuerda cómo y resetea.
                <button onClick={avisoRetirarIG} disabled={pubBusy} className="rounded border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50">✓ En Instagram · retirar a mano</button>
              ) : (
                <button onClick={() => publicarPrueba("instagram")} disabled={pubBusy} className="rounded border px-3 py-1 text-xs font-medium hover:bg-secondary disabled:opacity-50">▶ Instagram</button>
              )}
              {e.publicado_fb_id ? (
                <button onClick={() => retirarPublicacion("facebook")} disabled={pubBusy} className="rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">✕ Retirar de Facebook</button>
              ) : (
                <button onClick={() => publicarPrueba("facebook")} disabled={pubBusy} className="rounded border px-3 py-1 text-xs font-medium hover:bg-secondary disabled:opacity-50">▶ Facebook</button>
              )}
              {pubBusy && <span className="text-[10px] text-muted-foreground">procesando…</span>}
            </div>
          </div>
        </div>
      )}
    </div>
    {zoom && e.imagen_url && (
      <div onClick={() => setZoom(false)} className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/85 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={e.imagen_url} alt="pieza ampliada" className="max-h-[95vh] max-w-[95vw] object-contain" />
      </div>
    )}
    </>
  );
}

// ---- Pieza UGC (video nativo Seedance): guion → video, en el calendario ----
// Escenario se guarda en `categoria`; el copy (con links) en `caption`.
function UgcEntryCard({ entry, onChange }: { entry: Cal; onChange: () => void }) {
  const [e, setE] = useState<Cal>(entry);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dur, setDur] = useState("10");
  const [ctaKey, setCtaKey] = useState("ninguno");
  const [ctaLibre, setCtaLibre] = useState("");
  const [videoMsg, setVideoMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => { setE(entry); }, [entry]);

  async function save(patch: Partial<Cal>) {
    setBusy((b) => (b === null ? "save" : b));
    try {
      const r = await fetch("/api/contenido/calendario", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: e.id, ...patch }) });
      const j = await r.json();
      if (j.ok) { setE(j.item as Cal); onChange(); }
    } finally { setBusy((b) => (b === "save" ? null : b)); }
  }
  async function borrar() {
    if (!confirm("¿Descartar este borrador? Se elimina (no pasa a la Biblioteca).")) return;
    setBusy("del");
    await fetch(`/api/contenido/calendario?id=${e.id}`, { method: "DELETE" });
    onChange();
  }
  async function call(url: string, body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json()) as Record<string, unknown>;
    if (!j.ok) { setError(falErr(String(j.error ?? "?"))); return null; }
    return j;
  }
  async function genGuion() {
    setBusy("guion"); setError(null);
    try {
      const atributos = (e.notas ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      const cta = ctaLibre.trim() || (UGC_CTAS.find((c) => c.key === ctaKey)?.texto ?? "");
      const j = await call("/api/ugc/guion", { perfil: e.perfil ?? "usuario", tema: e.idea ?? "", pilar: e.pilar ?? undefined, formato: e.formato ?? undefined, detalles: e.detalles ?? "", modelo: e.modelo ?? undefined, duracion: Number(dur), atributos, cta });
      if (j) { setE((p) => ({ ...p, guion: j.guion as string })); await save({ guion: j.guion as string, estado: "generado" }); }
    } finally { setBusy(null); }
  }
  async function genVideo() {
    if (!e.guion?.trim()) return;
    setBusy("video"); setError(null); setVideoMsg("Encolando el video…");
    try {
      const j = await call("/api/ugc/video", { guion: e.guion, genero: e.subtipo || "mujer", escenario: e.categoria || undefined, duracion: Number(dur), edad: e.edad || undefined, vestimenta: e.vestimenta || undefined, perfil: e.perfil || undefined });
      if (!j) return;
      const statusUrl = j.status_url as string;
      const responseUrl = j.response_url as string;
      const qs = `status_url=${encodeURIComponent(statusUrl)}&response_url=${encodeURIComponent(responseUrl)}`;
      // El render puede tardar varios minutos: pooleamos el estado (usando las
      // URLs que devolvió fal, no reconstruidas).
      let terminal = false;
      for (let i = 0; i < 150; i++) {
        await new Promise((r) => setTimeout(r, 8000));
        setVideoMsg(`Renderizando video… (${Math.round((i + 1) * 8 / 60)} min)`);
        const sr = await fetch(`/api/ugc/video/status?${qs}`);
        const sj = (await sr.json()) as { ok?: boolean; status?: string; video_url?: string | null };
        if (sj.video_url) { setE((p) => ({ ...p, video_url: sj.video_url! })); await save({ video_url: sj.video_url, estado: "generado" }); terminal = true; break; }
        if (sj.status === "FAILED") { setError("El video falló al renderizar. Reintentá (a veces es un fallo puntual del render)."); terminal = true; break; }
      }
      if (!terminal) setError("El video está tardando más de lo normal. Reintentá en un rato.");
    } finally { setBusy(null); setVideoMsg(null); }
  }
  // Talking-head CON el producto real en la escena (Seedance 2.0 reference).
  // El packshot se mantiene fiel; el actor habla el guion. Escribe en video_url.
  async function genVideoProducto() {
    if (!e.guion?.trim()) return;
    if (!e.modelo) { setError("Elegí un producto (modelo) para meterlo en la escena."); return; }
    setBusy("producto"); setError(null); setVideoMsg("Encolando video con el producto en escena…");
    try {
      const j = await call("/api/ugc/video-producto", { sku: e.modelo, guion: e.guion, genero: e.subtipo || "mujer", escenario: e.categoria || undefined, duracion: Number(dur), edad: e.edad || undefined, vestimenta: e.vestimenta || undefined, perfil: e.perfil || undefined });
      if (!j) return;
      const qs = `status_url=${encodeURIComponent(j.status_url as string)}&response_url=${encodeURIComponent(j.response_url as string)}`;
      let terminal = false;
      for (let i = 0; i < 150; i++) {
        await new Promise((r) => setTimeout(r, 8000));
        setVideoMsg(`Renderizando video con producto… (${Math.round((i + 1) * 8 / 60)} min)`);
        const sr = await fetch(`/api/ugc/video/status?${qs}`);
        const sj = (await sr.json()) as { ok?: boolean; status?: string; video_url?: string | null };
        if (sj.video_url) { setE((p) => ({ ...p, video_url: sj.video_url! })); await save({ video_url: sj.video_url, estado: "generado" }); terminal = true; break; }
        if (sj.status === "FAILED") { setError("El video con producto falló al renderizar. Reintentá (a veces es un fallo puntual)."); terminal = true; break; }
      }
      if (!terminal) setError("El video está tardando más de lo normal. Reintentá en un rato.");
    } finally { setBusy(null); setVideoMsg(null); }
  }
  // Preview BARATO de la escena como imagen fija, antes de gastar en video.
  async function genPreviewEscena() {
    setBusy("preview"); setError(null); setPreviewUrl(null); setVideoMsg("Generando preview de la escena (imagen)…");
    try {
      const j = await call("/api/ugc/preview-escena", { genero: e.subtipo || "mujer", escenario: e.categoria || undefined, edad: e.edad || undefined, vestimenta: e.vestimenta || undefined, perfil: e.perfil || undefined });
      if (j?.image_url) setPreviewUrl(j.image_url as string);
    } finally { setBusy(null); setVideoMsg(null); }
  }
  const field = "rounded border px-2 py-1 text-xs";
  // Sólo bloqueamos las acciones durante una GENERACIÓN, no durante el autosave
  // (así no hace falta tocar el botón dos veces).
  const genBusy = busy === "guion" || busy === "video" || busy === "producto" || busy === "preview";
  const perfilSel = UGC_PERFILES.find((p) => p.key === (e.perfil ?? "usuario"))!;

  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: ESTADO_COLOR[e.estado] ?? "#94a3b8" }}>{ESTADO_LABEL[e.estado] ?? e.estado}</span>
        <input type="time" value={e.hora?.slice(0, 5) ?? ""} onChange={(ev) => setE({ ...e, hora: ev.target.value })} onBlur={() => save({ hora: e.hora })} className={field} />
        <div className="ml-auto flex gap-1">
          <button onClick={borrar} disabled={busy === "del"} className="rounded border px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50">Descartar</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={e.perfil ?? "usuario"} onChange={(ev) => { setE({ ...e, perfil: ev.target.value }); save({ perfil: ev.target.value }); }} className={field}>
          {UGC_PERFILES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <span className="text-[11px] text-muted-foreground">{perfilSel.nota}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">Producto</span>
        <select value={e.modelo ?? ""} onChange={(ev) => { const mm = getModelo(ev.target.value); setE({ ...e, modelo: ev.target.value, idea: mm?.nombre ?? e.idea }); save({ modelo: ev.target.value, idea: mm?.nombre ?? e.idea }); }} className={field}>
          <option value="">Elegí del catálogo…</option>
          {([["heladeras", "Heladeras"], ["cocinas", "Cocinas"], ["lavarropas", "Lavarropas"]] as const).map(([cat, lbl]) => (
            <optgroup key={cat} label={lbl}>
              {getModelos(cat).map((m) => <option key={m.sku} value={m.sku}>{m.nombreCorto ?? m.nombre}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <input value={e.idea ?? ""} onChange={(ev) => setE({ ...e, idea: ev.target.value })} onBlur={() => save({ idea: e.idea })} placeholder="Producto / tema (o escribilo a mano)" className={`${field} w-full`} />
      <AtributosSelect sku={e.modelo} value={e.notas ?? ""} onChange={(v) => { setE({ ...e, notas: v }); save({ notas: v }); }} />
      <div className="flex flex-wrap items-center gap-2">
        <select value={e.pilar ?? ""} onChange={(ev) => { setE({ ...e, pilar: ev.target.value }); save({ pilar: ev.target.value }); }} className={field} title="Pilar de contenido">
          <option value="">Pilar…</option>
          {UGC_PILARES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <select value={e.formato ?? ""} onChange={(ev) => { setE({ ...e, formato: ev.target.value }); save({ formato: ev.target.value }); }} className={field} title="Formato del video">
          <option value="">Formato…</option>
          {UGC_FORMATOS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <select value={dur} onChange={(ev) => setDur(ev.target.value)} className={field} title="Duración del video (define el largo del guion)">
          {UGC_DURACIONES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
        <select value={e.subtipo ?? ""} onChange={(ev) => { setE({ ...e, subtipo: ev.target.value }); save({ subtipo: ev.target.value }); }} className={field} title="Género de la persona">
          <option value="">Género…</option>
          <option value="mujer">Mujer</option>
          <option value="hombre">Hombre</option>
        </select>
        <select value={e.edad ?? ""} onChange={(ev) => { setE({ ...e, edad: ev.target.value }); save({ edad: ev.target.value }); }} className={field} title="Rango de edad de la persona">
          <option value="">Edad…</option>
          {UGC_EDADES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
        </select>
      </div>
      <input value={e.detalles ?? ""} onChange={(ev) => setE({ ...e, detalles: ev.target.value })} onBlur={() => save({ detalles: e.detalles })} placeholder="Detalles / contexto (opcional)" className={`${field} w-full`} />

      {/* Escenario/toma (variedad): chips rápidos + texto libre. Se guarda en `categoria`. */}
      <div className="space-y-1 rounded border bg-secondary/30 p-2">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
          Escenario / toma{e.perfil === "personal" ? " · institucional (Personal Drean)" : ""}
        </span>
        <div className="flex flex-wrap gap-1">
          {/* Personal Drean = vocero de marca → escenas institucionales; el resto, hogar. */}
          {UGC_ESCENARIOS.filter((s) => (e.perfil === "personal" ? s.tipo === "institucional" : s.tipo !== "institucional")).map((s) => (
            <button key={s.key} type="button" onClick={() => { setE({ ...e, categoria: s.key }); save({ categoria: s.key }); }}
              className={`rounded-full border px-2 py-0.5 text-[10px] ${e.categoria === s.key ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>{s.label}</button>
          ))}
        </div>
        <input value={e.categoria ?? ""} onChange={(ev) => setE({ ...e, categoria: ev.target.value })} onBlur={() => save({ categoria: e.categoria })} placeholder="…o escribí una escena libre (ej: en el balcón tomando mate)" className={`${field} w-full`} />
      </div>

      {/* Estilo de ropa: chips rápidos + texto libre. Se guarda en `vestimenta`. */}
      <div className="space-y-1 rounded border bg-secondary/30 p-2">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">Estilo de ropa</span>
        <div className="flex flex-wrap gap-1">
          {UGC_VESTIMENTAS.map((v) => (
            <button key={v.key} type="button" onClick={() => { setE({ ...e, vestimenta: v.key }); save({ vestimenta: v.key }); }}
              className={`rounded-full border px-2 py-0.5 text-[10px] ${e.vestimenta === v.key ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>{v.label}</button>
          ))}
        </div>
        <input value={e.vestimenta ?? ""} onChange={(ev) => setE({ ...e, vestimenta: ev.target.value })} onBlur={() => save({ vestimenta: e.vestimenta })} placeholder="…o describí la ropa (ej: remera azul y campera de jean)" className={`${field} w-full`} />
      </div>

      {/* CTA de cierre del guion (la marca no se dice; se manda al copy/link). */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">CTA</span>
        <select value={ctaKey} onChange={(ev) => setCtaKey(ev.target.value)} className={field} title="Call-to-action con el que cierra el guion">
          {UGC_CTAS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <input value={ctaLibre} onChange={(ev) => setCtaLibre(ev.target.value)} placeholder="…o CTA libre (pisa el de arriba)" className={`${field} flex-1 min-w-[180px]`} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={genGuion} disabled={genBusy} className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">{busy === "guion" ? "Generando…" : "1 · Guion"}</button>
        <button onClick={genVideo} disabled={genBusy || !e.guion?.trim()} className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">{busy === "video" ? "Generando…" : "2 · Video"}</button>
        <button onClick={genVideoProducto} disabled={genBusy || !e.guion?.trim() || !e.modelo} title={e.modelo ? "Talking-head con el producto Drean real en la escena (Seedance 2.0 reference, mantiene el producto fiel)" : "Elegí un producto (modelo) primero"} className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50">{busy === "producto" ? "Generando… (producto)" : "2b · Video + producto"}</button>
        <button onClick={genPreviewEscena} disabled={genBusy} title="Genera una imagen fija de la escena (barato) para verla antes de gastar en video" className="rounded border px-3 py-1 text-xs font-medium hover:bg-secondary disabled:opacity-50">{busy === "preview" ? "Generando…" : "👁 Ver escena"}</button>
        {videoMsg && <span className="text-[11px] text-muted-foreground">{videoMsg}</span>}
      </div>

      <textarea value={e.guion ?? ""} onChange={(ev) => setE({ ...e, guion: ev.target.value })} onBlur={() => save({ guion: e.guion })} rows={3} placeholder="El guion aparece acá y lo podés editar. La marca no se nombra; cierra con el CTA al copy." className={`${field} w-full resize-y`} />

      {/* Indicador de largo: avisa si el guion entra natural en la duración elegida
          (para no gastar en un video donde la persona habla apurada). */}
      {(() => {
        const words = (e.guion ?? "").trim().split(/\s+/).filter(Boolean).length;
        if (!words) return null;
        const seg = Number(dur) || 15;
        const hasCta = !!(ctaLibre.trim() || (ctaKey !== "ninguno" && (UGC_CTAS.find((c) => c.key === ctaKey)?.texto ?? "")));
        let maxPal = Math.round(seg * 2.4);
        if (hasCta) maxPal -= 4;
        maxPal = Math.max(13, maxPal);
        const estSeg = Math.round(words / 2.4);
        const over = words > Math.round(maxPal * 1.35);
        const tight = !over && words > maxPal;
        const cls = over ? "font-medium text-rose-600" : tight ? "text-amber-600" : "text-emerald-600";
        const msg = over ? " · demasiado largo: va a hablar apurado (acortá o subí la duración)" : tight ? " · un poco largo, puede ir algo rápido" : " · entra bien ✓";
        return <div className={`text-[10px] ${cls}`}>{words} palabras · ~{estSeg}s hablados · máx ~{maxPal} para {seg}s{msg}</div>;
      })()}

      {/* Copy del posteo (con los links a la web del producto). Lo completás vos. */}
      <div className="space-y-1">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">Copy del posteo (links a la web)</span>
        <textarea value={e.caption ?? ""} onChange={(ev) => setE({ ...e, caption: ev.target.value })} onBlur={() => save({ caption: e.caption })} rows={3} placeholder="Escribí el copy y pegá el link al producto (ej: Más info 👉 drean.com.ar/…)" className={`${field} w-full resize-y`} />
      </div>

      {error && <p className="rounded border border-red-300 bg-red-50 p-2 text-[11px] text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-3">
        {previewUrl && (
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">👁 Preview escena (imagen)</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="preview escena" className="max-h-72 w-auto rounded border" />
            <span className="block text-[10px] text-muted-foreground">Aproximación (otro modelo que el video). Sirve para validar escena/uniforme.</span>
          </div>
        )}
        {e.video_url && (
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">Talking-head</span>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={e.video_url} controls loop className="max-h-72 w-auto rounded border" />
            <a href={e.video_url} target="_blank" rel="noopener" className="inline-block rounded border px-2 py-0.5 text-[10px] font-medium hover:bg-secondary">Abrir / descargar</a>
          </div>
        )}
      </div>

      {e.video_url && (
        <button onClick={() => save({ aprobado: !e.aprobado, estado: e.aprobado ? "generado" : "aprobado" })} disabled={busy === "save"} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
          {e.aprobado ? "En Biblioteca ✓ (quitar)" : "✓ Pasar a la Biblioteca"}
        </button>
      )}
    </div>
  );
}
