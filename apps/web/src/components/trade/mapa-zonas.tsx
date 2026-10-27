"use client";

// Mapa de Argentina de CB Trade / Floor Share. Cada tienda con dirección geocodificada (master de tiendas, `zona` =
// "N - tienda@id|lat|lon|provincia") es un punto propio; las que no tienen dirección quedan agrupadas en una burbuja por
// ZONA del maestro (CABA, AMBA Norte/Sur/Oeste, Rosario…) en su ciudad de referencia. Cada provincia toma el color de lo suyo. Zoom con rueda/botones y arrastre; el panel
// suma SOLO lo que entra en la vista (Σ cumplidos ÷ Σ objetivo, no promedio de porcentajes).
import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { AR_PROVINCES } from "@/lib/argentina-provinces";
import { FotosGaleria } from "@/components/trade/exhibicion-fotos";

/** `binaria` = sí/no por tienda (ej. exhibición especial): el % de la vista = tiendas con ÷ tiendas con dato. */
export type MapaMetrica = { label: string; obj: number; binaria?: boolean; porCuenta?: boolean; grupo?: string; corto?: string };
// `grupo` = bloque (CB Sell In · CB Trade · Floor Share · Exhibición): se muestra separado; `corto` = nombre dentro del bloque.
// `porCuenta` = el dato es del cliente (CB Sell In): cada tienda muestra el de su cliente y los totales cuentan una vez por cliente.
/** `detalle` = líneas extra de la ficha (ej. exhibición especial con link a las fotos). */
export type MapaPunto = { zona: string; tiendas: number; vals: Array<[number, number]>; cuenta?: string | null; detalle?: Array<{ label: string; valor: string; href?: string; fotos?: string[] }> };

// Ciudad de referencia de cada zona (lat, lon) y su provincia en el mapa.
const ZONAS: Record<string, { lat: number; lon: number; prov: string }> = {
  "caba": { lat: -34.60, lon: -58.40, prov: "Capital Federal" },
  "amba norte": { lat: -34.46, lon: -58.66, prov: "Buenos Aires" },
  "amba oeste": { lat: -34.66, lon: -58.78, prov: "Buenos Aires" },
  "amba sur": { lat: -34.82, lon: -58.36, prov: "Buenos Aires" },
  "mar del plata": { lat: -38.00, lon: -57.55, prov: "Buenos Aires" },
  "san nicolas": { lat: -33.33, lon: -60.22, prov: "Buenos Aires" },
  "cordoba": { lat: -31.42, lon: -64.18, prov: "Cordoba" },
  "rio cuarto": { lat: -33.12, lon: -64.35, prov: "Cordoba" },
  "santa fe": { lat: -31.63, lon: -60.70, prov: "Santa Fe" },
  "rosario": { lat: -32.95, lon: -60.65, prov: "Santa Fe" },
  "entre rios": { lat: -31.73, lon: -60.53, prov: "Entre Rios" },
  "tucuman": { lat: -26.82, lon: -65.22, prov: "Tucuman" },
  "salta": { lat: -24.79, lon: -65.41, prov: "Salta" },
  "jujuy": { lat: -24.19, lon: -65.30, prov: "Jujuy" },
  "mendoza": { lat: -32.89, lon: -68.83, prov: "Mendoza" },
  "lujan de cuyo": { lat: -33.04, lon: -68.88, prov: "Mendoza" },
};
const canon = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const PROV = new Map(AR_PROVINCES.map((p) => [canon(p.name), p.name]));
const provMapa = (s: string) => (canon(s).includes("autonoma") ? "Capital Federal" : PROV.get(canon(s)) ?? "");
/** Punto propio de una tienda geocodificada ("N - tienda@id|lat|lon|provincia") o null (= zona). */
function tiendaGeo(z: string) {
  const i = z.lastIndexOf("@"); if (i < 0) return null;
  const [, lat, lon, prov] = z.slice(i + 1).split("|");
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) ? { label: z.slice(0, i), lat: Number(lat), lon: Number(lon), prov: provMapa(prov ?? "") } : null;
}
// Proyección de los paths de lib/argentina-provinces (lineal; ajustada con los bordes de 8 provincias, error < 3 px).
const px = (lon: number) => 26.08 * lon + 1918.77;
const py = (lat: number) => -33.34 * lat - 728.1;

type Caja = { x: number; y: number; w: number; h: number };
const FULL: Caja = { x: 0, y: 0, w: 520, h: 1107 };
const ZONAS_CAJA: Caja = { x: 110, y: 20, w: 400, h: 540 }; // de Jujuy a Mar del Plata: donde hay tiendas
const VISTAS: Array<{ label: string; v: Caja }> = [
  { label: "Inicio", v: ZONAS_CAJA },
  { label: "País", v: FULL },
  { label: "AMBA", v: { x: 380, y: 410, w: 50, h: 60 } },
  { label: "Centro", v: { x: 230, y: 280, w: 230, h: 300 } },
  { label: "NOA", v: { x: 150, y: 30, w: 180, h: 230 } },
  { label: "Cuyo", v: { x: 80, y: 340, w: 150, h: 180 } },
];

// Semáforo de la app vieja: verde hasta −2 pp del objetivo, amarillo hasta −6, rojo debajo.
const color = (v: number | null, obj: number) => (v == null ? "#94a3b8" : v - obj >= -2 ? "#16a34a" : v - obj >= -6 ? "#d97706" : "#dc2626");
const tinte = (v: number | null, obj: number) => (v == null ? "#f1f5f9" : v - obj >= -2 ? "#dcfce7" : v - obj >= -6 ? "#fef3c7" : "#fee2e2");
const fmt = (v: number | null, x: MapaMetrica) => (v == null ? "—" : x.binaria ? (v > 0 ? "Sí" : "No") : `${v.toFixed(0)}%`);
const pct = ([n, d]: [number, number]) => (d > 0 ? (n / d) * 100 : null);
const suma = (xs: Array<[number, number]>): [number, number] => xs.reduce<[number, number]>((a, [n, d]) => [a[0] + n, a[1] + d], [0, 0]);
/** Suma de la métrica i sobre los puntos; si es por cliente, cada cliente cuenta una sola vez. */
const sumaMetrica = (ps: Array<Pick<MapaPunto, "vals" | "cuenta">>, i: number, x: MapaMetrica): [number, number] => {
  if (!x.porCuenta) return suma(ps.map((p) => p.vals[i]!));
  const vistos = new Map<string, [number, number]>();
  for (const p of ps) if (p.cuenta && (p.vals[i]?.[1] ?? 0) > 0) vistos.set(p.cuenta, p.vals[i]!);
  return suma([...vistos.values()]);
};

export function MapaZonas({ titulo, puntos, metricas, nota, inicial = 0 }: {
  titulo: string; puntos: MapaPunto[]; metricas: MapaMetrica[]; nota?: string | null; inicial?: number;
}) {
  // Vista = centro + ancho; el alto sale de la proporción REAL del recuadro (así lo que se ve = lo que suma el panel).
  const [cam, setCam] = useState({ cx: ZONAS_CAJA.x + ZONAS_CAJA.w / 2, cy: ZONAS_CAJA.y + ZONAS_CAJA.h / 2, w: 0 });
  const [asp, setAsp] = useState(1.5);
  const [m, setM] = useState(inicial);
  const [sel, setSel] = useState<string | null>(null);
  const [todas, setTodas] = useState(false); // ficha: todas las métricas de un punto
  const [hover, setHover] = useState<string | null>(null);
  // Orden de la tabla: columna (-1 = tienda/zona, si no índice de métrica) y sentido; clic en el mismo encabezado lo invierte.
  const [ord, setOrd] = useState<{ col: number; asc: boolean }>({ col: inicial, asc: true });
  const ordenar = (col: number) => {
    setOrd((o) => (o.col === col ? { col, asc: !o.asc } : { col, asc: true }));
    if (col >= 0) setM(col);
  };
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; cam: typeof cam } | null>(null);
  const encuadrar = (c: Caja, a = asp) => ({ cx: c.x + c.w / 2, cy: c.y + c.h / 2, w: Math.max(c.w, c.h * a) });
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => { const r = e!.contentRect; if (r.width && r.height) setAsp(r.width / r.height); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const w = cam.w || encuadrar(ZONAS_CAJA).w, h = w / asp;
  const vb: Caja = { x: cam.cx - w / 2, y: cam.cy - h / 2, w, h };

  const ubicados = useMemo(() => puntos.flatMap((p) => {
    const t = tiendaGeo(p.zona);
    if (t) return [{ ...p, ...t, tienda: true, x: px(t.lon), y: py(t.lat) }];
    const z = ZONAS[canon(p.zona)];
    return z ? [{ ...p, ...z, label: `Zona ${p.zona} (sin dirección)`, tienda: false, x: px(z.lon), y: py(z.lat) }] : [];
  }), [puntos]);
  const sinUbicar = puntos.filter((p) => !tiendaGeo(p.zona) && !ZONAS[canon(p.zona)]).reduce((s, p) => s + p.tiendas, 0);
  const nTiendas = ubicados.filter((p) => p.tienda).length;
  const porProv = useMemo(() => {
    const out = new Map<string, typeof ubicados>();
    for (const p of ubicados) out.set(p.prov, [...(out.get(p.prov) ?? []), p]);
    return new Map([...out].map(([k, v]) => [k, pct(sumaMetrica(v, m, metricas[m]!))]));
  }, [ubicados, m, metricas]);

  const enVistaTodos = ubicados.filter((p) => p.x >= vb.x && p.x <= vb.x + vb.w && p.y >= vb.y && p.y <= vb.y + vb.h);
  const escala = Math.min(1, vb.w / FULL.w); // las burbujas no crecen al hacer zoom
  const maxT = Math.max(1, ...ubicados.map((p) => p.tiendas));

  const aSvg = (x: number, y: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: vb.x + ((x - r.left) / r.width) * vb.w, y: vb.y + ((y - r.top) / r.height) * vb.h };
  };
  // Zoom manteniendo fijo el punto (px, py) del mapa.
  const zoom = (f: number, px0 = cam.cx, py0 = cam.cy) => {
    const nw = Math.min(1200, Math.max(20, w * f));
    setCam({ cx: px0 - (px0 - cam.cx) * (nw / w), cy: py0 - (py0 - cam.cy) * (nw / w), w: nw });
  };
  const onWheel = (e: WheelEvent<SVGSVGElement>) => { const p = aSvg(e.clientX, e.clientY); zoom(e.deltaY > 0 ? 1.25 : 0.8, p.x, p.y); };
  const onDown = (e: PointerEvent<SVGSVGElement>) => { drag.current = { x: e.clientX, y: e.clientY, cam: { ...cam, w } }; (e.target as Element).setPointerCapture?.(e.pointerId); };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current; if (!d) return;
    const r = svgRef.current!.getBoundingClientRect();
    setCam({ ...d.cam, cx: d.cam.cx - ((e.clientX - d.x) / r.width) * vb.w, cy: d.cam.cy - ((e.clientY - d.y) / r.height) * vb.h });
  };
  const setVista = (c: Caja) => setCam(encuadrar(c));

  const metrica = metricas[m]!;
  const inicio = (i: number) => i === 0 || metricas[i - 1]!.grupo !== metricas[i]!.grupo;
  const corto = (x: MapaMetrica) => (x.grupo ? x.corto ?? x.label : x.label);
  const cabGrupo = (i: number, cols: number, cls: string) => inicio(i) && metricas[i]!.grupo ? <tr key={`g${i}`}><td colSpan={cols} className={cls}>{metricas[i]!.grupo}</td></tr> : null;
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">🗺️ {titulo}</h3>
        <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap text-xs">
          {metricas.map((x, i) => (
            <span key={x.label} className={`flex items-center gap-1 ${inicio(i) && i > 0 ? "ml-1 border-l pl-2" : ""}`}>
              {inicio(i) && x.grupo ? <span className="font-semibold text-muted-foreground">{x.grupo}</span> : null}
              <button onClick={() => setM(i)} className={`rounded-full border px-2.5 py-1 ${i === m ? "border-blue-700 bg-blue-700 text-white" : "hover:bg-muted"}`}>{x.grupo ? x.corto ?? x.label : x.label}</button>
            </span>
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="relative">
          <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
            <button onClick={() => zoom(0.6)} className="rounded border bg-white px-2 text-sm shadow-sm" aria-label="Acercar">+</button>
            <button onClick={() => zoom(1.6)} className="rounded border bg-white px-2 text-sm shadow-sm" aria-label="Alejar">−</button>
          </div>
          <div className="absolute right-2 top-2 z-10 flex flex-wrap justify-end gap-1">
            {VISTAS.map((v) => <button key={v.label} onClick={() => setVista(v.v)} className="rounded border bg-white px-2 py-0.5 text-[11px] shadow-sm hover:bg-muted">{v.label}</button>)}
          </div>
          <svg
            ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet"
            className="block h-[520px] w-full cursor-grab touch-none select-none rounded-lg bg-slate-50 active:cursor-grabbing"
            onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => (drag.current = null)} onPointerLeave={() => (drag.current = null)}
            role="img" aria-label={`Mapa de ${titulo}`}
          >
            {AR_PROVINCES.map((p) => (
              <path key={p.name} d={p.path} fill={tinte(porProv.get(p.name) ?? null, metrica.obj)} stroke="#cbd5e1" strokeWidth={0.6 * escala} />
            ))}
            {ubicados.map((p) => {
              const v = pct(p.vals[m]!);
              const r = (p.tienda ? 3.5 : 4 + 14 * Math.sqrt(p.tiendas / maxT)) * escala;
              return (
                <g key={p.zona} onMouseEnter={() => setHover(p.zona)} onMouseLeave={() => setHover(null)} onClick={() => setSel(p.zona)} className="cursor-pointer">
                  <circle cx={p.x} cy={p.y} r={r} fill={color(v, metrica.obj)} fillOpacity={0.75} stroke="#fff" strokeWidth={1.2 * escala} />
                  {(hover === p.zona || (p.tienda ? escala < 0.06 : escala < 0.45)) && (
                    <text x={p.x + r + 2 * escala} y={p.y + 3 * escala} fontSize={9 * escala} fontWeight={600} fill="#0f172a">
                      {p.label} · {fmt(v, metrica)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Rueda del mouse o +/− para hacer zoom, arrastrá para moverte. Punto = tienda ({nTiendas} con dirección); burbuja grande = tiendas sin dirección agrupadas por zona. Color = vs objetivo.
            {sinUbicar > 0 ? ` ${sinUbicar} tiendas sin zona cargada no aparecen en el mapa.` : ""} Tocá un punto para ver su ficha.{nota ? ` ${nota}` : ""}
          </p>
        </div>
        <div className="space-y-2 text-xs">
          {(() => {
            const p = ubicados.find((u) => u.zona === sel);
            if (!p) return null;
            return (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="font-semibold">{p.label}</div>
                  <button onClick={() => setSel(null)} className="text-muted-foreground hover:text-foreground" aria-label="Cerrar ficha">✕</button>
                </div>
                <table className="w-full">
                  <tbody>
                    {metricas.map((x, i) => {
                      const v = pct(p.vals[i]!);
                      const g = cabGrupo(i, 3, "whitespace-nowrap pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground");
                      if (x.binaria) return [g,
                        <tr key={x.label} className="whitespace-nowrap border-t border-blue-100">
                          <td className="py-0.5">{corto(x)}</td>
                          <td colSpan={2} className="text-right font-semibold" style={{ color: v == null ? undefined : color(v, x.obj) }}>{v == null ? "sin dato" : v > 0 ? "Sí" : "No"}</td>
                        </tr>];
                      return [g,
                        <tr key={x.label} className="whitespace-nowrap border-t border-blue-100">
                          <td className="py-0.5">{corto(x)}</td>
                          <td className="text-right font-semibold tabular-nums" style={{ color: color(v, x.obj) }}>{v == null ? "sin dato" : `${v.toFixed(0)}%`}</td>
                          <td className="w-12 text-right text-muted-foreground tabular-nums">obj {x.obj}%</td>
                        </tr>];
                    })}
                  </tbody>
                </table>
                {p.detalle?.map((d, i) => (
                  <div key={i} className="mt-1.5 border-t border-blue-100 pt-1.5">
                    <span className="text-muted-foreground">{d.label}: </span>
                    {d.href ? <a href={d.href} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline">{d.valor}</a> : d.valor}
                    {d.fotos?.length ? <div className="mt-1"><FotosGaleria fotos={d.fotos} chica /></div> : null}
                  </div>
                ))}
              </div>
            );
          })()}
          {/* Todas las variables a la vez sobre lo que entra en la vista (pedido del user); tocar una pinta el mapa con ella. */}
          <div className="rounded-lg border p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">En la vista · {enVistaTodos.reduce((s, p) => s + p.tiendas, 0)} tiendas</div>
            <table className="mt-1 w-full">
              <tbody>
                {metricas.map((x, i) => {
                  const con = enVistaTodos.filter((p) => (p.vals[i]?.[1] ?? 0) > 0);
                  const v = pct(sumaMetrica(con, i, x));
                  return [cabGrupo(i, 3, "whitespace-nowrap pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"),
                    <tr key={x.label} onClick={() => setM(i)} className={`cursor-pointer whitespace-nowrap border-t ${i === m ? "bg-blue-50" : "hover:bg-muted"}`}>
                      <td className="py-1">{corto(x)}</td>
                      <td className="text-right text-base font-bold tabular-nums" style={{ color: color(v, x.obj) }}>{v == null ? "—" : `${v.toFixed(1)}%`}</td>
                      <td className="pl-2 text-right text-[11px] text-muted-foreground">{x.binaria ? `${con.filter((p) => p.vals[i]![0] > 0).length}/${con.length}` : x.porCuenta ? `${new Set(con.map((p) => p.cuenta)).size} cl. · obj ${x.obj}%` : `obj ${x.obj}%`}</td>
                    </tr>];
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th />
              {metricas.map((x, i) => inicio(i) ? (
                <th key={`g${i}`} colSpan={metricas.filter((y) => y.grupo === x.grupo).length}
                  className={`whitespace-nowrap px-2 pt-1 text-center text-[10px] font-semibold uppercase tracking-wide ${i > 0 ? "border-l" : ""}`}>{x.grupo ?? ""}</th>
              ) : null)}
            </tr>
            <tr className="border-b text-left text-muted-foreground">
              <th onClick={() => ordenar(-1)} className={`cursor-pointer whitespace-nowrap py-1.5 pr-2 ${ord.col === -1 ? "text-blue-700" : ""}`}>
                Tienda / zona · {enVistaTodos.length} en la vista{ord.col === -1 ? (ord.asc ? " ▲" : " ▼") : ""}
              </th>
              {metricas.map((x, i) => (
                <th key={x.label} onClick={() => ordenar(i)} className={`cursor-pointer whitespace-nowrap px-2 text-right ${inicio(i) && i > 0 ? "border-l" : ""} ${i === ord.col ? "text-blue-700" : ""}`}>
                  {corto(x)}{i === ord.col ? (ord.asc ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...enVistaTodos].sort((a, b) => {
              if (ord.col < 0) return (ord.asc ? 1 : -1) * a.label.localeCompare(b.label, "es", { numeric: true });
              const va = pct(a.vals[ord.col]!), vb = pct(b.vals[ord.col]!);
              if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1; // sin dato siempre al final
              return ord.asc ? va - vb : vb - va;
            }).slice(0, todas ? undefined : 30).map((p) => (
              <tr key={p.zona} className={`cursor-pointer border-b ${hover === p.zona || sel === p.zona ? "bg-muted" : ""}`} onMouseEnter={() => setHover(p.zona)} onMouseLeave={() => setHover(null)} onClick={() => setSel(p.zona)}>
                <td className="whitespace-nowrap py-1 pr-2">{p.label}</td>
                {metricas.map((x, i) => {
                  const v = pct(p.vals[i]!);
                  return <td key={x.label} className={`px-2 text-right font-semibold tabular-nums ${inicio(i) && i > 0 ? "border-l" : ""}`} style={{ color: v == null ? "#94a3b8" : color(v, x.obj) }}>{fmt(v, x)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {enVistaTodos.length > 30 && (
          <button onClick={() => setTodas(!todas)} className="mt-2 text-xs font-semibold text-blue-700 hover:underline">
            {todas ? "Ver menos" : `Ver todas (${enVistaTodos.length})`}
          </button>
        )}
      </div>
    </section>
  );
}
