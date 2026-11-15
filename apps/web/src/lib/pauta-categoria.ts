// Campañas del lanzamiento del lavarropas «Mickey» (Teaser / Reveal): cuentan como LAVADO en todos los medios
// (pedido del user 15-nov-2026). Lo usan los syncs de Meta, DV360 y TikTok al clasificar por nombre.
export const esLanzamientoLavado = (nombre: string | null | undefined): boolean => /teaser|reveal|mickey/i.test(nombre ?? "");
