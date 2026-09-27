import { Suspense } from "react";
import Link from "next/link";
import { maxUpdatedAt } from "@/lib/freshness-queries";
import { DASH_FUENTES, buildSaludDash, fmtEdad } from "@/lib/data-health";
import { fmtDate } from "@/lib/monitoreo-config";
import type { Estado } from "@/lib/monitoreo-config";
import { LearnButton } from "@/components/knowledge/learn-button";

// "Confianza en el dato" (portado de BIP, sep-2026): una línea chica bajo el título de cada tablero
//   ● Datos al día · Meta Ads hace 3 h · DV360 hace 9 h · OMD hace 5 d
// Misma regla de frescura que /monitoreo (ok / atrasado / crítico según la cadencia de cada fuente).
// Server component en su propio Suspense (fallback vacío) → no frena el render del tablero. El
// color es SOLO estado (verde/ámbar/rojo); el detalle completo vive en /monitoreo.

const DOT: Record<Estado, string> = { ok: "bg-emerald-500", atrasado: "bg-amber-500", critico: "bg-red-500", sindato: "bg-slate-300" };
const TXT: Record<Estado, string> = { ok: "text-muted-foreground", atrasado: "text-amber-700", critico: "text-red-700", sindato: "text-muted-foreground" };

export function DataHealth({ dash, className = "" }: { dash: string; className?: string }) {
  if (!DASH_FUENTES[dash]?.length) return null;
  return (
    <Suspense fallback={null}>
      <DataHealthLine dash={dash} className={className} />
    </Suspense>
  );
}

async function DataHealthLine({ dash, className }: { dash: string; className: string }) {
  const fuentes = DASH_FUENTES[dash] ?? [];
  const dates = await Promise.all(fuentes.map((f) => maxUpdatedAt(f.tabla, f.db ?? "principal", f.col, f.filter).catch(() => null)));
  const h = buildSaludDash(fuentes, dates, Date.now());
  if (!h.items.length) return null;
  return (
    <div aria-label="Salud de los datos" className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] ${className}`}>
      <Link href="/monitoreo" className={`inline-flex items-center gap-1.5 font-medium hover:underline ${TXT[h.peor]}`} title="Ver el detalle en Monitoreo">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOT[h.peor]}`} />{h.resumen}
      </Link>
      {h.items.map((it) => (
        <span key={it.label} className={`inline-flex items-center gap-1 ${TXT[it.estado]}`} title={`${it.label}: última actualización ${fmtDate(it.date)} · se espera cada ${it.cadenciaH < 48 ? `${it.cadenciaH} h` : `${Math.round(it.cadenciaH / 24)} d`}`}>
          <span className="text-muted-foreground/40">·</span>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOT[it.estado]}`} />
          {it.label} {fmtEdad(it.ageH)}
        </span>
      ))}
      <LearnButton k="salud_datos" />
    </div>
  );
}
