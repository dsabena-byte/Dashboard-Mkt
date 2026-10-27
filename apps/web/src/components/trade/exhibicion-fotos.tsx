"use client";

// Fotos de las exhibiciones especiales (activaciones WOW), copiadas de Drive al bucket del tablero: miniaturas +
// visor a pantalla completa (flechas, Esc). Se usa en la ficha del mapa y en el tablero al filtrar una tienda.
import { useEffect, useState } from "react";

export function FotosGaleria({ fotos, chica = false }: { fotos: string[]; chica?: boolean }) {
  const [i, setI] = useState<number | null>(null);
  useEffect(() => {
    if (i == null) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setI(null);
      if (e.key === "ArrowRight") setI((x) => (x == null ? x : (x + 1) % fotos.length));
      if (e.key === "ArrowLeft") setI((x) => (x == null ? x : (x - 1 + fotos.length) % fotos.length));
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [i, fotos.length]);
  if (!fotos.length) return null;
  return (
    <>
      <div className={`grid gap-1.5 ${chica ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"}`}>
        {fotos.map((f, n) => (
          <button key={f} onClick={() => setI(n)} className="overflow-hidden rounded border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f} alt={`Foto ${n + 1} de la exhibición`} loading="lazy" className={`w-full object-cover ${chica ? "h-16" : "h-36"}`} />
          </button>
        ))}
      </div>
      {i != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setI(null)} role="dialog" aria-label="Foto de la exhibición">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fotos[i]} alt={`Foto ${i + 1} de ${fotos.length}`} className="max-h-full max-w-full rounded object-contain" onClick={(e) => e.stopPropagation()} />
          {fotos.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setI((i - 1 + fotos.length) % fotos.length); }} className="absolute left-3 rounded-full bg-white/90 px-3 py-1.5 text-lg" aria-label="Anterior">‹</button>
              <button onClick={(e) => { e.stopPropagation(); setI((i + 1) % fotos.length); }} className="absolute right-3 rounded-full bg-white/90 px-3 py-1.5 text-lg" aria-label="Siguiente">›</button>
            </>
          )}
          <span className="absolute bottom-3 rounded bg-black/60 px-2 py-0.5 text-xs text-white">{i + 1} / {fotos.length} · Esc para cerrar</span>
        </div>
      )}
    </>
  );
}

export type ExhibicionTienda = { id: number; tienda: string; anio: number | null; exhibidor: string | null; fotos: string[]; link: string | null };

/** Bloque del tablero cuando se filtra una tienda: una tarjeta por exhibición con sus fotos. */
export function ExhibicionesTienda({ items }: { items: ExhibicionTienda[] }) {
  if (!items.length) return null;
  return (
    <section className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-bold">🖼️ Exhibición especial</h3>
      <div className="space-y-4">
        {items.map((e) => (
          <div key={e.id}>
            <div className="mb-1.5 text-xs">
              <span className="font-semibold">{e.tienda}</span>
              {e.anio ? <span className="text-muted-foreground"> · {e.anio}</span> : null}
              {e.exhibidor ? <span className="text-muted-foreground"> · {e.exhibidor}</span> : null}
            </div>
            {e.fotos.length ? <FotosGaleria fotos={e.fotos} /> : (
              <p className="text-xs text-muted-foreground">
                Sin fotos copiadas{e.link?.startsWith("http") ? <> · <a href={e.link} target="_blank" rel="noreferrer" className="text-blue-700 underline">ver en Drive</a></> : null}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
