// Regla de negocio de Pauta Mkt (compartida por /performance y el Seguimiento): un medio con API
// conectada se mide SIEMPRE con la API (plataforma = fuente de verdad); las filas de OMD
// (`pauta_performance`) solo cuentan para medios SIN API (OOH, TV, DOOH, TikTok, Mercado Ads, Geo).
// Motivo: OMD cargaba una fila de Meta que subcontaba (ago-2026: OMD $13,4M vs API $62,7M).
// Si algún día OMD carga otro medio con API (ej. Google), sumarlo acá — aplica a los dos lados.
// TikTok es distinto: su API (app de BIP) escribe directo las filas mensuales de `pauta_performance` (cron tiktok-sync),
// así que NO va en API_MEDIOS: la fila de TikTok ya ES el dato de la API.
// Módulo puro (sin server-only): lo importan componentes cliente y server.
export const API_MEDIOS = new Set(["Meta"]);
export const esMedioApi = (medio: string) => API_MEDIOS.has(medio);
