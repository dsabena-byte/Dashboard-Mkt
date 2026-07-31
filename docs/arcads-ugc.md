# UGC "pro" con Arcads

Opción **paralela** al video UGC barato (Seedance por fal.ai). Mismo guion, pero
renderizado con modelos top (Veo 3.1 / Sora 2 / Kling) vía la API externa de
Arcads. No reemplaza nada: el botón "2 · Video (barato)" sigue igual.

## Cómo activarlo

1. Crear cuenta en Arcads (https://arcads.ai) con un plan que incluya **Public API**.
2. En **Settings → Public API → Generate credentials**, copiar el **Client ID** y el
   **Client Secret** (el secret se muestra una sola vez).
3. Cargar en **Vercel → Project → Settings → Environment Variables**:
   - `ARCADS_CLIENT_ID` y `ARCADS_CLIENT_SECRET` (o `ARCADS_API_KEY` si tu cuenta
     entrega una sola key).
   - Opcional: `ARCADS_PRODUCT_ID` (UUID de un "product" existente; si no se setea
     se crea uno automáticamente).
   - Opcional: `ARCADS_BASE_URL` (default `https://external-api.arcads.ai`).
4. Redeploy. En **Contenido → Calendario → UGC**, aparece la fila **"Pro · Arcads"**:
   elegís modelo y tocás **Video PRO**. El video se muestra inline con link para
   abrir/descargar (todavía **no persiste** en la base — es modo test).

## Cómo funciona (API)

- **Auth:** HTTP Basic. `Client ID:Client Secret` (o `API key:`) → header
  `Authorization: Basic base64(...)`.
- **Generar:** `POST /v2/videos/generate` con `{ model, productId, prompt,
  aspectRatio: "9:16", duration, audioEnabled }`. Devuelve `201 { id, creditsCharged }`.
- **Poll:** modelos de video (`veo31`/`sora2`/`kling-*`/`grok-video`) →
  `GET /v1/videos/{id}`; assets (`seedance-2.0`) → `GET /v1/assets/{id}`. Se poolea
  hasta `generated`/`completed` (o `failed`).
- **Product:** `/v2/videos/generate` exige un `productId`; se crea con
  `POST /v1/products` si no hay `ARCADS_PRODUCT_ID`.

Código: `apps/web/src/lib/arcads.ts` (transporte), `apps/web/src/lib/ugc.ts`
(`generarVideoUgcArcadsSubmit` / `getVideoUgcArcadsStatus`), rutas
`apps/web/src/app/api/ugc/arcads/*`.

## Notas / pendientes

- **Red del entorno de dev:** el sandbox de Claude Code bloquea
  `external-api.arcads.ai`, así que la integración sólo se puede probar en Vercel
  (producción), no localmente.
- **Flujo de actores nominados:** Arcads también tiene el flujo `POST /v1/scripts`
  (elegir un actor real de su biblioteca + voz + diálogo). Está sub-documentado
  públicamente; se puede agregar como extensión una vez que veamos el schema real
  con credenciales.
- **Persistencia:** hoy el video pro se muestra inline (test). Para guardarlo en el
  calendario haría falta una columna `video_pro_url` en `contenido_calendario`.
- **Costos:** cada render devuelve `creditsCharged`; se muestra al lado del video.
