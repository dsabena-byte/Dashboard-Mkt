// Medidor real de navegación: tiempo desde que el usuario hace clic en un ítem
// del menú hasta que la página destino monta en el cliente. Captura TODO lo que
// se vive (cold start de Vercel + queries + render RSC + red + hidratación), a
// diferencia del ⏱ server que solo mide el cómputo de datos en el servidor.
// Usa Date.now() (reloj de pared) para funcionar igual en soft y hard navigation.

const T0 = "navT0";
const HREF = "navHref";

export function markNav(href: string): void {
  try {
    sessionStorage.setItem(T0, String(Date.now()));
    sessionStorage.setItem(HREF, href);
  } catch {
    /* sessionStorage no disponible → sin medición */
  }
}

// Devuelve los ms transcurridos si el último clic apuntaba a matchHref; consume
// la marca (una sola lectura por navegación).
export function readNavDelta(matchHref: string): number | null {
  try {
    const t0 = sessionStorage.getItem(T0);
    const href = sessionStorage.getItem(HREF);
    if (!t0 || href !== matchHref) return null;
    sessionStorage.removeItem(T0);
    sessionStorage.removeItem(HREF);
    const ms = Date.now() - Number(t0);
    return ms >= 0 && ms < 120_000 ? ms : null;
  } catch {
    return null;
  }
}
