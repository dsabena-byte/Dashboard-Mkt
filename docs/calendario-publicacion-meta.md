# Generador de Contenido · Calendario + publicación IG/FB

Estado de la funcionalidad de **calendario de contenidos, adaptación de piezas y
publicación (orgánica) a Instagram/Facebook**. Entrada en el dash:
**sidebar → "Generador de Contenido"** → `/contenido` (redirige a `/contenido/calendario`).

## Tabs de `/contenido/calendario`
1. **Generación de Contenidos RRSS** (`canal="rrss"`) — genera piezas (imagen/video) con IA,
   las diseña (logo + texto, editor WYSIWYG) y las programa. **Grilla mensual** con las piezas
   por día (puntos por estado); al tocar un día se listan sus piezas.
2. **Generación de Contenidos UGC** (`canal="ugc"`) — generador de videos UGC (persona hablando).
3. **Biblioteca UGC** — piezas UGC guardadas.
4. **Adaptación de piezas** — reframe generativo (IA) de una pieza a los ratios que pide la pauta.

## Flujo de una pieza RRSS
`Generar` (imagen/video IA) → `Diseñar` (logo+texto) → `Biblioteca` → **`Distribuir`**
(fecha, hora y redes IG/FB/TikTok → **Agendar**, o **Publicar ahora**).

## Base de datos
Todo vive en una tabla: **`contenido_calendario`** (migraciones 0075/0076/0077/0079/0082/0089/0090).
Campos clave: `fecha`, `hora`, `redes jsonb` (destino), `estado` (pendiente|generado|aprobado|publicado),
`aprobado`, `imagen_url`/`imagen_final_url`/`video_url`, `caption`/`hashtags`, `publicado_ig_id`,
`publicado_fb_id`, `publish_error`, `canal` (rrss|ugc), `diseno jsonb`. (`social_posts` es otra cosa:
analítica del scraper, no publicación.)

## Publicación a Meta
- **Librería:** `lib/meta-publish.ts` (Graph API v22). Publica imagen/reel IG e imagen/video FB
  (espera contenedor IG `FINISHED`), y `borrarPublicacion`. Requiere `META_SYSTEM_USER_TOKEN` → Page token.
- **Manual:** `api/contenido/calendario/publicar` (POST · "Publicar ahora"), `.../retirar` (borrar),
  `.../route.ts` (CRUD: crear/actualizar/eliminar piezas programadas).
- **Automática (cron):** `api/cron/publicar-contenido` publica las piezas **aprobadas** cuya
  `fecha/hora` ya llegó y aún no se publicaron. **ACTIVA**: `.github/workflows/publicar-contenido.yml`
  corre cada 30 min (`schedule: */30`). Gated por `CRON_SECRET`. Soporta `?dry=1`.

## Permisos de Meta (validado sep-2026)
Token **system user** de la app "Dashboard-mkt", **válido y sin vencimiento** (`expires_at:0`).
Página **Drean** (`257587170945975`) con **IG Business @dreanargentina** (`17841404990509161`) vinculado;
se obtiene Page token (tasks MANAGE/CREATE_CONTENT/…). Scopes **concedidos**:

| Scope | Para | Estado |
|---|---|---|
| `pages_manage_posts` | Publicar/gestionar/borrar en FB | ✅ |
| `pages_read_engagement` | Obtener Page token / leer Página | ✅ |
| `instagram_basic` | Acceso básico IG | ✅ |
| `instagram_content_publish` | **Publicar** en IG | ✅ |
| `instagram_manage_insights` | Insights IG | ✅ |
| `read_insights`, `pages_show_list`, `ads_read`, `business_management`, `pages_read_user_content` | varios | ✅ |
| **`instagram_manage_contents`** | **Borrar posteos de IG por API** | ❌ **FALTA** |

**Conclusión:** publicar automático a **IG + FB funciona**. La única limitación es **borrar de
Instagram por API** (falta `instagram_manage_contents`) — hoy la app avisa "borralo a mano desde
Instagram"; Facebook sí se puede borrar. Para habilitar el borrado de IG hay que pedir ese scope
por **App Review** de la app en el Business Manager y re-asignar el token del system user con el
permiso. Es **opcional**.

> **Seguridad:** el diag `api/diag/meta-publish-access` devuelve un **Page access token real** en su
> respuesta — tratar esa salida como sensible (no compartir/pegar en público) y rotar el token si se
> expuso. Nunca commitear tokens.

## Diagnóstico
- `api/diag/meta-publish-access` (login) — verifica scopes/Page token/IG vinculado (NO publica).
- `api/diag/meta-publish-test?go=1` — publica una prueba real a IG/FB (sin `go`, dry-run).

## Adaptación de piezas a formatos de pauta (`lib/pauta-formatos.ts`)
Reframe generativo (outpainting IA, fal) que **extiende el encuadre** al ratio destino sin deformar el foco.

- **Imagen** (`FORMATOS_IMG_PAUTA`): **1:1** (1080×1080), **4:5** (1080×1350), **9:16** (1080×1920),
  **1.91:1** (1200×628) → Meta feed/Stories/Reels/horizontal · Demand Gen · TikTok.
- **Video** (`FORMATOS_VIDEO_PAUTA`, Luma Ray reframe): **9:16**, **1:1**, **16:9** →
  Meta feed/Stories/Reels · Demand Gen · YouTube/DV360 · Mercado · TikTok.

## Pendientes / gotchas
- Borrado de IG por API: falta `instagram_manage_contents` (ver arriba).
- TikTok: agendable, pero **sin auto-post** (no implementado en `meta-publish`).
- Las URLs de imagen de fal **caducan** → por eso se espeja a `imagen_final_url` (bucket permanente)
  antes de publicar. Confirmar que se guarde siempre.
