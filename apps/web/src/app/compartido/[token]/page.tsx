import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveShareToken } from "@/lib/tablero-share-server";
import { getDashboardConfig, getDatasetsFor } from "@/lib/tableros-server";
import { listAnotaciones } from "@/lib/anotaciones";
import { getTenant } from "@/lib/tenant/current";
import { DashboardRuntime } from "@/components/viz-builder/runtime";

// Vista PÚBLICA de solo lectura de un tablero de Mis tableros (link firmado con vencimiento; ver
// lib/tablero-share.ts). Sin sidebar, sin copiloto, sin edición; con la fecha de los datos. Link vencido o
// revocado → 404 genérico (no se distingue, para no filtrar nada). El middleware deja pasar /compartido.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const metadata: Metadata = { title: "Tablero compartido", robots: { index: false, follow: false } };

export default async function Compartido({ params }: { params: { token: string } }) {
  const p = await resolveShareToken(decodeURIComponent(params.token));
  if (!p) notFound();
  const cfg = await getDashboardConfig(p.s).catch(() => null);
  if (!cfg || !cfg.widgets.length) notFound();
  // Sin restricción de fuentes: quien creó el link podía ver el tablero completo.
  const [datasets, notas] = await Promise.all([getDatasetsFor(cfg, null), listAnotaciones({ tablero: p.s }).catch(() => ({ notas: [] }))]);
  const marca = getTenant().displayName;
  const hoy = new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  const vence = new Date(p.e * 1000).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  return (
    <div className="bip-viz" style={{ maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--faint)" }}>{marca} · Vista de solo lectura</div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900" style={{ margin: "4px 0 2px" }}>{cfg.title || "Tablero"}</h1>
          {cfg.description && <p className="sub" style={{ margin: 0 }}>{cfg.description}</p>}
        </div>
        <span className="hint" style={{ margin: 0 }}>Datos al {hoy} · link válido hasta el {vence}</span>
      </div>
      <div style={{ marginTop: 16 }}>
        <DashboardRuntime config={cfg} datasets={datasets} mode="view" notes={notas.notas} />
      </div>
    </div>
  );
}
