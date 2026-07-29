# Handoff UGC + Testeo de creativos — 2026-07-29

Estado consolidado del trabajo sobre el **generador UGC** y el **panel de testeo de
creativos**, para retomar sin re-iterar ni repetir pruebas/errores ya resueltos.

> **TL;DR:** El generador UGC produce el **talking-head** (persona hablando, video
> nativo Seedance) y ahora también **insert shots del producto Drean real** (b-roll),
> pensados para **intercalar en edición** (estrategia validada). El panel de
> **testeo de creativos** vive en `/influencia`. Quedan **migraciones por correr en
> Supabase** (ver abajo).

---

## 1. Pendientes ACCIONABLES (correr antes de usar)

Las columnas nuevas del calendario UGC requieren correr estas migraciones en Supabase
(SQL Editor o `supabase db push`). Son idempotentes:

```sql
-- 0083: link pieza UGC <-> anuncio Meta (panel de testeo)
alter table contenido_calendario add column if not exists ad_id text;
create index if not exists idx_contenido_calendario_ad_id on contenido_calendario(ad_id);

-- 0084: casting del video (edad + ropa)
alter table contenido_calendario
  add column if not exists edad text,
  add column if not exists vestimenta text;

-- 0085: insert shot del producto
alter table contenido_calendario add column if not exists insert_url text;
```

Archivos: `supabase/migrations/0083_*.sql`, `0084_*.sql`, `0085_*.sql`.

---

## 2. Arquitectura del generador UGC

- **Lib principal:** `apps/web/src/lib/ugc.ts`
- **Opciones/labels (compartido UI+server):** `apps/web/src/lib/ugc-opciones.ts`
- **Catálogo de producto (packshots reales):** `apps/web/src/lib/producto-catalog.ts`
  (cada modelo tiene `driveFileId`; `driveImageUrl(fileId)` arma la URL pública que
  fal.ai lee directo).
- **Editor UI:** `apps/web/src/app/contenido/calendario/page.tsx` (componente de la
  pieza UGC; tab canal=ugc).
- **Rutas API:** `/api/ugc/guion`, `/api/ugc/video`, `/api/ugc/video/status`,
  `/api/ugc/insert`, `/api/ugc/persona`.

### Flujo (3 botones en el editor)
1. **`1 · Guion`** — OpenAI (gpt-4o-mini) siguiendo el PLAYBOOK UGC Drean. Barato.
2. **`2 · Video`** — Seedance 2.0 `text-to-video` NATIVO (persona + voz + escena en
   un paso). Encuadre **cerrado** (cara y hombros, fondo desenfocado).
3. **`3 · Insert producto`** — b-roll del producto Drean real (sin persona).

### Modelos fal usados
- Guion: OpenAI `gpt-4o-mini`.
- Video talking-head: `bytedance/seedance-2.0/fast/text-to-video` (`generate_audio: true`).
- Retrato persona (no en flujo nativo): `fal-ai/ideogram/v3`.
- Insert frame (producto real en escena): `fal-ai/nano-banana/edit` con
  `image_urls: [packshot]` (mantiene el producto idéntico a la foto).
- Insert video: `bytedance/seedance-2.0/fast/image-to-video` (`generate_audio: false`).

---

## 3. Decisiones y APRENDIZAJES (no repetir)

### 3.1 Largo del guion vs. duración
- El video dura EXACTAMENTE los segundos elegidos y Seedance **mete todo el texto
  adentro**: si sobran palabras, la persona habla apurada.
- GPT **ignora** un "máximo de palabras" pedido de forma blanda. Solución que quedó:
  `maxPalabrasGuion()` (cupo ~2,4 pal/seg, -4 por CTA, piso 13) + **enforcement**
  post-generación (`comprimirGuion`) que SOLO se dispara si el exceso es grande
  (>1,5×) y **conserva el beneficio**; si falla, vuelve el original completo.
- **Ojo (error ya cometido):** un cupo demasiado bajo (10 palabras para 8s) + recorte
  duro a la 1ra oración dejaba guiones "pelados" (solo el hook, ej. "No sabía esto de
  las cocinas…"). Por eso el cupo actual es ~15 para 8s y NO hay recorte duro.
- **Regla de contenido:** para explicar un beneficio, 8s queda justo; 12-15s rinde
  mejor. El editor muestra un **indicador en vivo** (palabras · seg estimados · máx)
  en verde/ámbar/rojo.
- El guion que se usa para el video es **el que está en el textarea** (editable): el
  video lee `e.guion` (contenido actual), no el original generado.

### 3.2 Producto real en la escena — CALLEJONES SIN SALIDA (no reintentar)
Objetivo: que se vea la Drean REAL, no un electrodoméstico genérico.

- ❌ **Persona + producto en UN clip animado con Seedance i2v:** BLOQUEADO por content
  policy de fal — `422 content_policy_violation` / `partner_validation_failed`:
  *"images ... may contain likenesses of real people ... cannot be processed"*.
  **No se puede animar una foto con una persona realista.** No reintentar.
- ❌ **Kling Avatar para la persona+producto:** el avatar necesita un **retrato
  ajustado** (cara+hombros, SIN manos/objetos); se rompe con escena amplia + producto.
- ✅ **Componer la imagen** con el producto real (nano-banana edit + packshot):
  FUNCIONA excelente — el producto sale fiel (incluye badge "DREAN"). El **frame**
  persona+producto sirve como **foto fija** para edición (aunque no se pueda animar).
- ✅ **Insert shot del producto SIN persona:** i2v lo procesa (no hay persona) →
  b-roll fiel con movimiento de cámara. VALIDADO: "muy bueno el movimiento, parece
  real". Es la pieza que faltaba.

### 3.3 La receta PRO (validada) = INTERCALAR
No forzar "todo en un clip". Se arma editando dos piezas:
- **Talking-head** (persona habla) — encuadre **cerrado** (fondo desenfocado) para que
  el ambiente NO compita.
- **Insert shots del producto real** (b-roll fiel).
- **Match de ambientes:** el encuadre cerrado del talking-head resuelve el problema de
  que las cocinas no matcheen (el testimonio no establece un ambiente que compita). Si
  se quiere plano ABIERTO con persona+producto: estrategia 2 = escena maestra →
  quitar la persona (nano-banana edit) → animar (pendiente, ver §6).

### 3.4 Detalles de composición aprendidos
- **Altura del producto:** una cocina/lavarropas "counter-height" debe ir **a nivel de
  la mesada** (no más alta). `placementHint(medidas)` lo fuerza según el catálogo.
- **Movimiento de cámara del insert:** pedir UN movimiento con intención (push-in
  lento tipo hero shot), no "deambular".
- **`frame_only=1`** en el diag: compone solo la imagen (sin gastar el render de
  video) para iterar la composición barato.

### 3.5 Bug de lectura de video de fal (resuelto)
- Seedance i2v devuelve el mp4 con estructura distinta a text-to-video → daba
  `COMPLETED` con `video_url: null`. Se arregló con `extractVideoUrl()` (cubre
  `video.url`, `url`, `videos[]`, `output.*`) y, si no lo encuentra,
  `falQueueVideoStatus` devuelve el `raw` (http+body) para diagnosticar.
  Ver `apps/web/src/lib/fal-client.ts`.

---

## 4. Pilotos en `diag` (sandbox, no productivos)
- `GET /api/diag/ugc-producto` — piloto producto-en-escena. Params: `sku`, `guion`,
  `genero`, `escenario`, `edad`, `vestimenta`, `modo` (`insert` default | `persona`),
  `frame_only=1`, `modelo_video`, `go=1`. Devuelve `frame_url` + `check_url`.
- `GET /api/diag/seedance` — talking-head nativo.
- `GET /api/diag/kling-avatar` — retrato + TTS propio → avatar (pronunciación
  controlada; sirve para talking-head cerrado con voz propia).
- `GET /api/diag/ugc-video` — OmniHuman (foto hablando).
- Dominio de prueba: `https://dashboard-mkt-seven.vercel.app`.

---

## 5. Panel de Testeo de creativos (Fase 1) — `/influencia`
- Componente: `apps/web/src/components/pauta/ugc-testing-panel.tsx`.
- Query: `apps/web/src/lib/ugc-testing-queries.ts`. Data: `meta_paid_creatives`
  (categoria='UGC') + tags del generador vía `ad_id`.
- Qué hace: ranking head-to-head por campaña (hook rate), scorecard (VTR 25/50/75/100,
  retención, CTR, interacción, cualitativo credibilidad/persuasión/percepción) y
  **aprendizajes por dimensión** (perfil/escenario/formato/pilar/género) cuando la
  pieza se linkea a su anuncio (`ad_id`).
- **Es Fase 1 (medir + aprender), NO crea pauta.** Vos lanzás el test chico en Ads
  Manager; el dashboard hace de cerebro.

---

## 6. Próximos pasos (cuando se retome UGC)
1. **Varios inserts por pieza** (distintos ángulos/escenarios) para más material de corte.
2. **Estrategia 2 (plano abierto con match perfecto):** escena maestra persona+producto
   → nano-banana edit "quitar persona, dejar cocina+producto idénticos" → animar.
3. **Creador recurrente:** misma persona/cara en todos los videos (referencia/seed o
   avatar fijo) → "influencer propio Drean".
4. **Fase 2 del A/B testing:** crear/lanzar la pauta desde el dashboard (requiere token
   Meta con `ads_management`; split test nativo `/adstudies` vs A/B casero).
5. Probar otros SKU (heladera "tall", lavarropas top-load) — `placementHint` ya
   contempla los tipos.

---

## 7. PRs de esta tanda (mergeados a main)
- #393 panel de testeo de creativos UGC + casting (edad/ropa) + KPIs en línea.
- #394, #395 fix del largo del guion (enforcement + indicador) y recalibración.
- #396, #397, #400, #401 piloto `diag/ugc-producto` (frame + i2v + insert + altura).
- #398, #399 fix lectura `video_url` de fal (i2v).
- #402 insert shot integrado al generador (estrategia intercalar).
