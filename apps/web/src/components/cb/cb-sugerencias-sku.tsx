"use client";

// Pestaña "Sugerencias de SKUs" de /cuadros-basicos: SKUs para SUMAR al CB del cliente (o tipología) que ya están
// exhibidos en sus tiendas y suben el % CB. Misma estructura que "Sugerencias de tiendas" (cómo funciona → tarjetas →
// tabla con detalle al hacer clic). Datos calculados en el server (lib/cb-sugerencias-sku-server.ts).
import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import type { GrupoSku } from "@/lib/cb-sugerencias-sku";

const pctCell = (p: number) =>
  p >= 80 ? "bg-emerald-50 text-emerald-700 font-semibold" : p >= 70 ? "bg-amber-50 text-amber-700 font-semibold" : "bg-rose-50 text-rose-600 font-semibold";
const f1 = (x: number) => `${x.toFixed(1)}%`;
const n0 = (x: number) => x.toLocaleString("es-AR");

/** Cómo queda el grupo sumando todas sus sugerencias. */
const nuevo = (g: GrupoSku) => {
  const r = g.real + g.sugerencias.reduce((a, s) => a + s.tiendasExh, 0);
  const t = g.target + g.sugerencias.length * g.tiendas;
  return { r, t, pct: t ? (r / t) * 100 : 0 };
};

function StatCard({ label, value, hint, pill }: { label: string; value: string; hint?: string; pill?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-bold text-rose-500">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">{hint}</div>}
      {pill && (
        <div className="mt-3 flex items-center justify-end border-t pt-2 text-[11px]">
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold tabular-nums text-emerald-700">{pill}</span>
        </div>
      )}
    </div>
  );
}

function Detalle({ g }: { g: GrupoSku }) {
  return (
    <div className="space-y-2 bg-slate-50 p-4">
      <div className="text-xs font-semibold">🔍 SKUs para sumar al CB — {g.grupo}</div>
      <table className="w-full rounded-lg border bg-white text-xs">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="px-3 py-1.5">#</th>
            <th className="px-3">SKU</th>
            <th className="px-3">Categoría · segmento</th>
            <th className="px-3 text-right">Exhibido en</th>
            <th className="px-3 text-right">% CB sumando solo este</th>
            <th className="px-3 text-right">% CB acumulado</th>
          </tr>
        </thead>
        <tbody>
          {g.sugerencias.map((s, i) => (
            <tr key={s.sku} className="border-b last:border-0 align-top">
              <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
              <td className="px-3 py-1.5"><div className="font-semibold">{s.sku}</div><div className="text-muted-foreground">{s.descripcion}</div></td>
              <td className="px-3 py-1.5">{s.categoria}<div className="text-muted-foreground">{s.segmento || "—"}</div></td>
              <td className="px-3 py-1.5 text-right tabular-nums">{s.tiendasExh}/{s.tiendas} tiendas</td>
              <td className="px-3 py-1.5 text-right tabular-nums">{f1(s.pct)} <span className="text-emerald-700">+{(s.pct - g.pct).toFixed(1)} pp</span></td>
              <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{f1(s.acumPct)} <span className="text-emerald-700">+{(s.acumPct - g.pct).toFixed(1)} pp</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {g.homologosExcluidos.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          No se sugieren porque ya están en el CB como homólogos (según el catálogo de CB Ventas):{" "}
          {g.homologosExcluidos.map((h) => `${h.sku} (de ${h.de})`).join(" · ")}
        </p>
      )}
    </div>
  );
}

function Fila({ g, i, abierto, onClick }: { g: GrupoSku; i: number; abierto: boolean; onClick?: () => void }) {
  const nv = nuevo(g);
  return (
    <tr onClick={onClick} className={`border-b last:border-0 ${onClick ? "cursor-pointer hover:bg-slate-50" : ""}`}>
      <td className="px-3 py-1.5 text-muted-foreground">
        {onClick && <span className="mr-1 inline-block w-3 text-[10px]">{abierto ? "▼" : "▶"}</span>}{i + 1}
      </td>
      <td className="px-3 py-1.5 font-medium">{g.grupo}</td>
      <td className="px-3 py-1.5 text-right tabular-nums">{g.tiendas}</td>
      <td className={`px-2 py-1.5 text-right tabular-nums ${pctCell(g.pct)}`}>{f1(g.pct)}</td>
      <td className="border-r border-border px-2 py-1.5 text-right tabular-nums text-muted-foreground">{n0(g.real)}/{n0(g.target)}</td>
      <td className="border-r border-border px-2 py-1.5 text-right tabular-nums font-semibold">{g.sugerencias.length || "—"}</td>
      {g.sugerencias.length ? (
        <>
          <td className={`px-2 py-1.5 text-right tabular-nums ${pctCell(nv.pct)}`}>{f1(nv.pct)}</td>
          <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">+{(nv.pct - g.pct).toFixed(1)} pp</td>
        </>
      ) : <td colSpan={2} className="px-2 py-1.5 text-right text-muted-foreground">—</td>}
    </tr>
  );
}

function Tabla({ titulo, nota, grupos, expandible }: { titulo: string; nota: string; grupos: GrupoSku[]; expandible: boolean }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-bold">{titulo}</h3>
        <span className="text-[11px] text-muted-foreground">{nota}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-[#0a1849] text-white">
            <tr>
              <th rowSpan={2} className="border-r border-white/10 px-3 py-2 text-left align-bottom">#</th>
              <th rowSpan={2} className="border-r border-white/10 px-3 py-2 text-left align-bottom">Cliente / tipología</th>
              <th rowSpan={2} className="border-r border-white/10 px-3 py-2 text-right align-bottom">Tiendas</th>
              <th colSpan={2} className="border-r border-white/10 px-3 py-1 text-center text-[11px] uppercase">% CB actual</th>
              <th rowSpan={2} className="border-r border-white/10 px-3 py-2 text-right align-bottom">SKUs a sumar</th>
              <th colSpan={2} className="px-3 py-1 text-center text-[11px] uppercase">% CB sumándolos</th>
            </tr>
            <tr className="text-[10px] uppercase opacity-80">
              <th className="px-2 py-1 text-right">%</th>
              <th className="border-r border-white/10 px-2 py-1 text-right">ok/tot</th>
              <th className="px-2 py-1 text-right">%</th>
              <th className="px-2 py-1 text-right">mejora</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g, i) => (
              <Fragment key={g.grupo}>
                <Fila g={g} i={i} abierto={abierto === g.grupo} onClick={expandible ? () => setAbierto(abierto === g.grupo ? null : g.grupo) : undefined} />
                {abierto === g.grupo && (
                  <tr className="border-b"><td colSpan={8} className="p-0"><Detalle g={g} /></td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CbSugerenciasSku({ porCliente, porTipologia, semanas, desde, hasta, minSemanas }: {
  porCliente: GrupoSku[]; porTipologia: GrupoSku[]; semanas: number[]; desde: number | null; hasta: number | null; minSemanas: number;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<"cliente" | "tipologia">("cliente");
  const grupos = modo === "cliente" ? porCliente : porTipologia;
  const nSem = desde != null && hasta != null ? semanas.filter((s) => s >= desde && s <= hasta).length : 0;
  const periodo = (d: number, h: number) => router.push(`/cuadros-basicos?tab=sku&desde=${d}&hasta=${h}` as never);

  if (!semanas.length) {
    return (
      <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-900">
        Todavía no hay exhibición cargada. Subí los archivos semanales de exhibición (ReportExhibitions) en <b>Cargar datos</b>: se reconocen solos.
        Hace falta al menos {minSemanas} semanas (un mes).
      </div>
    );
  }

  const conSug = grupos.filter((g) => g.sugerencias.length).sort((a, b) => (nuevo(b).pct - b.pct) - (nuevo(a).pct - a.pct));
  const sinSug = grupos.filter((g) => !g.sugerencias.length);
  const R = grupos.reduce((a, g) => a + g.real, 0), T = grupos.reduce((a, g) => a + g.target, 0);
  const tiendas = grupos.reduce((a, g) => a + g.tiendas, 0);
  const base = T ? (R / T) * 100 : 0;
  const nR = grupos.reduce((a, g) => a + nuevo(g).r, 0), nT = grupos.reduce((a, g) => a + nuevo(g).t, 0);
  const global = nT ? (nR / nT) * 100 : 0;
  const totSkus = conSug.reduce((a, g) => a + g.sugerencias.length, 0);
  const etiqueta = modo === "cliente" ? "clientes" : "tipologías";

  return (
    <div className="space-y-4">
      <header className="rounded-xl border bg-sky-50 p-4 text-xs text-sky-900">
        <strong>¿Cómo funciona?</strong> Se analiza la <code>exhibición de SKUs por tienda</code> (archivos semanales) contra el CB de Trade de
        cada {modo === "cliente" ? "cliente" : "tipología"}. Un SKU que <strong>no está en su CB</strong> (ni es homólogo de uno que está, según el catálogo de CB Ventas) pero ya está exhibido en
        más tiendas que su % actual <strong>sube el indicador si se agrega al CB</strong> (no reemplaza a ninguno). Exhibido = apareció sin
        «Retirada» en al menos la mitad de las semanas relevadas; el % CB es el de la última semana del período.{" "}
        <strong>Click en cualquier {modo === "cliente" ? "cliente" : "tipología"}</strong> para ver qué SKUs sumar.
      </header>

      <section className="flex flex-wrap items-end gap-3 text-xs">
        <label className="flex flex-col gap-1">Desde
          <select className="rounded border bg-white px-2 py-1" value={desde ?? ""} onChange={(e) => periodo(Number(e.target.value), hasta!)}>
            {semanas.filter((s) => s <= (hasta ?? 99)).map((s) => <option key={s} value={s}>Sem {s}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">Hasta
          <select className="rounded border bg-white px-2 py-1" value={hasta ?? ""} onChange={(e) => periodo(Math.min(desde!, Number(e.target.value)), Number(e.target.value))}>
            {semanas.map((s) => <option key={s} value={s}>Sem {s}</option>)}
          </select>
        </label>
        <div className="flex overflow-hidden rounded-md border">
          {(["cliente", "tipologia"] as const).map((m) => (
            <button key={m} onClick={() => setModo(m)} className={`px-3 py-1.5 ${modo === m ? "bg-blue-700 text-white" : "bg-white hover:bg-muted"}`}>
              {m === "cliente" ? "Por cliente" : "Por tipología"}
            </button>
          ))}
        </div>
        {nSem < minSemanas && (
          <span className="rounded bg-amber-50 px-2 py-1 text-amber-900">
            El período tiene {nSem} semana{nSem !== 1 ? "s" : ""}: para una sugerencia firme hace falta al menos {minSemanas}.
          </span>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl bg-[#0a1849] p-5 text-white">
          <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Baseline · % CB actual</div>
          <div className="mt-2 text-4xl font-bold text-rose-300">{f1(base)}</div>
          <div className="mt-2 text-[11px] opacity-80">{tiendas} tiendas del CB con exhibición · sem {desde}–{hasta}</div>
        </div>
        <StatCard label={`${etiqueta} analizados`} value={String(grupos.length)} hint={`${n0(R)} / ${n0(T)} posiciones cumplidas`} />
        <StatCard label="✅ Con SKUs para sumar" value={String(conSug.length)} hint={`${totSkus} SKUs sugeridos en total`} />
        <StatCard label="🎯 % CB nuevo global" value={f1(global)} hint={`Sumando los SKUs sugeridos a cada CB`} pill={`+${(global - base).toFixed(1)} pp vs baseline`} />
        <StatCard label="➖ Sin SKUs que sumen" value={String(sinSug.length)} hint="Ningún SKU fuera del CB supera su %" />
      </section>

      <Tabla titulo={`✅ ${etiqueta[0]!.toUpperCase()}${etiqueta.slice(1)} con SKUs para sumar al CB`} nota="ordenados por mejora · click para detalle" grupos={conSug} expandible />
      {sinSug.length > 0 && (
        <Tabla titulo={`➖ ${etiqueta[0]!.toUpperCase()}${etiqueta.slice(1)} sin SKUs que suban el %`} nota="ningún SKU exhibido fuera del CB supera su % actual" grupos={sinSug} expandible={false} />
      )}
    </div>
  );
}
