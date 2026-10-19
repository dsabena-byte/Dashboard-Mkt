# Pendientes — Drean (Dashboard-Mkt)

> **Fuente ÚNICA de pendientes.** No dejar "PENDIENTE" sueltos en CLAUDE.md ni en docs/: van acá.
> Reglas: (1) al resolver algo, cerrar la fila **en el mismo commit** que lo resuelve (mover a "Cerrados" con fecha y evidencia);
> (2) antes de listarle pendientes al user, **re-verificar cada fila** (DB por REST, código, `git log` con `git fetch --depth=1500`,
> docs del tema) y actualizar "Verificado"; lo que no se pueda verificar se dice "sin verificar", no se afirma;
> (3) si el user cuenta que hizo un paso, anotarlo acá ese mismo turno.

## Abiertos

| # | Qué | Quién | Desde | Verificado | Cómo verificar |
|---|-----|-------|-------|------------|----------------|
| D1 | DV360 **abril (US$463) y mayo (US$1.104)** truncados → bajar CSV mensual completo de DV360 y recargar | User (CSV) + Claude (carga) | sep-2026 | 6-oct: siguen así | `dv360_creatives` suma `revenue_usd` por `mes` |
| D2 | DV360 **ago-26 sospechoso** (US$9.081 vs jul 37.030, sep 26.093) | User (CSV ago) | 24-sep | 6-oct: sigue 9.081 | ídem |
| D3 | Reporte "DV360 Video Drean" (ID 1693465149) entrega meses parciales → ampliar Date Range, o endurecer `syncDv360` (Apps Script, no está en el repo) | User | sep-2026 | sin verificar (fuera del repo) | Apps Script / DV360 Reports |
| D4 | **BGT "8+4 2026" no cargado** → T3 de /funnel sale "no cargada". Se resuelve con D15 (la planilla del 16-oct ya trae el 8+4 2026: 108 renglones, $6.100 M) | User (importar) | sep-2026 | 16-oct: está en la planilla, falta importarla | `bgt_lineas` versión `8+4 2026` |
| D5 | Search Console lee `https://www.drean.com.ar/` (~835 impr/mes) → dar acceso a `sc-domain:drean.com.ar` y re-sync | User | 27-sep | 6-oct: snapshot (29-sep) sigue con el URL-prefix | `search_console_snapshot.data.site` |
| D6 | WhatsApp de alertas: número dedicado + QR + env Vercel `EVO_URL/EVO_API_KEY/EVO_INSTANCE` (migración 0123 YA corrida) | User | 28-sep | 6-oct: `whatsapp_on=false`, sin envíos | `alert_prefs`, `alert_log canal=whatsapp` |
| D7 | Decidir si el mockup **Salud de Marca – metodología** pasa a dashboard real | User (decisión) | dic-2026 | 6-oct: no hay ruta nueva | `app/salud-marca/` |
| D8 | Video tour: re-render (MP4 d7cfd97 muestra Copiloto) + captura de Trade. **Sin actividad desde 7-sep → preguntar si sigue vigente** | User | 7-sep | 6-oct: último commit 7-sep | `git log -- marketing/video-tour` |
| D9 | Plugins de claude.ai no llegan a la sesión: decir en qué cuenta/org están y cuáles quiere | User | 3-oct | 6-oct: `ListPlugins` vacío | `ListPlugins` |
| D10 | Skill "Prompt design": falta link/repo | User | 3-oct | 6-oct: no instalado | `.claude/skills/` |
| D11 | LG: 8/16 avisos de revendedores, sin exclusión | Claude (cuando se pida) | 27-sep | sin verificar | `competitor_ads_snapshot` LG |
| D12 | Guía/🎓 a tabla (editar sin deploy) | Claude (cuando se pida) | sep-2026 | 6-oct: sigue en `lib/guia/*` | código |
| D13 | Borrar `public/bgt-mkt/` (iframe viejo sin uso) | Claude | sep-2026 | 6-oct: sigue el archivo | `apps/web/public/bgt-mkt` |
| D14 | **Monitoreo de precios (BIP):** definir las 12 decisiones abiertas de `docs/investigacion-precios/benchmark-precios-multicategoria-bip.md` para recién ahí diseñar la estructura | User (decisión) | 7-oct | 7-oct: informe mergeado (#824), nada implementado | sección "Decisiones abiertas" del informe |
| D15 | **Presupuesto desde el tablero (0125):** (1) correr `supabase/migrations/0125_presupuesto.sql` en el SQL Editor; (2) /funnel → Cargar datos → Importar planilla (Seguimiento_BGT_2026.xlsx) y revisar los totales; (3) subir la plantilla de tipos de cambio; (4) pasar el email de Julieta para `bgt_editores`; (5) validado → apagar `bgt-sync` y el Excel | User | 16-oct | 16-oct: código en main, nada corrido | `bgt_versiones`/`bgt_lineas`/`bgt_tc` por REST; /funnel dice "Fuente: carga en el tablero" |
| D16 | Presupuesto: grilla para cargar BGT/4+8/8+4 por cuenta × mes + "crear 4+8 / 8+4 / BGT del año siguiente" desde el REAL | Claude | 16-oct | 16-oct: carga de un presupuesto entero por planilla HECHA (pestaña Cargar presupuesto); falta "crear 4+8/8+4/BGT" desde el REAL | `/funnel/carga` |
| D17 | **TikTok Ads por la app de BIP — falta solo config en Vercel (19-oct):** abr–sep cargados desde la API y piezas con portada ya en el tablero (corrido desde el sandbox). Reconexión en BIP con permisos de piezas HECHA (19-oct, cuenta Mabe Argentina). Falta para que corra solo cada día: en Vercel **Dashboard-Mkt** cargar `BIP_NANGO_HOST`, `BIP_NANGO_SECRET_KEY` (copiar de bip-platform), `TIKTOK_NANGO_CONNECTION_ID=cb3c72d1-c381-468a-9f9a-cbd5db6e9554`, `TIKTOK_ADVERTISER_ID=7601141532934225927` + redeploy. Opcional: `0074_tiktok_creatives.sql` (detalle por anuncio×día) | User | 19-oct | 19-oct: token con Mabe + scopes de piezas OK (report, /ad/get/, /file/video/ad/info/) | Actions → TikTok sync → Run (dry=1) |
| D18 | **Mercado GfK incompleto para el diagnóstico (19-oct):** cargar (1) **ago y sep 2026** de las 3 categorías; (2) la fila **"Market"** del export (unidades y facturación del mercado, hoy se descarta en la carga → sin share global, YTD ni tamaño de mercado); (3) **ene–jun 2025 mensual** del Total de Refrigeración y Cocción. Después re-correr `marketing/mercado-2026` | User (exports GfK) + Claude (carga) | 19-oct | 19-oct: base hasta jul-26, solo shares e índice | `mercado_share` por REST: `mes=gte.2026-08-01`; ver `docs/mercado-gfk-carga.md` |

## Cerrados (con evidencia)
- **Tab "OKR Mkt" de /overview** — borrado el 4-sep-2026 (`49830d9`). La memoria lo seguía dando como pendiente.
- **Migraciones 0106–0124** — corridas (6-oct: todas las tablas/columnas responden por REST).
- **Apify ad-library (tope mensual)** — resuelto: snapshots 5-oct sin error.
- **DV360 junio** — completo: US$17.108 (6-oct).
