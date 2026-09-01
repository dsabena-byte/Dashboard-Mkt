# Facebook — deprecación del Reach orgánico (Meta, jun-2026)

Estado: **RESUELTO — reach reconectado** (2026-06-26). Meta retiró las métricas viejas el
**15-jun-2026** y activó el reemplazo. Validado contra la API de la cuenta: la métrica nueva
funciona y el sync ya la captura.

| Métrica vieja | Métrica NUEVA (activa, validada) | Sample |
|---|---|---|
| `post_impressions_unique` (Post Reach) | **`post_total_media_view_unique`** (singular) | 121 ✅ |
| `page_impressions_unique` (Page Reach) | **`page_total_media_view_unique`** (singular) → `reach_organic` | OK ✅ |

⚠️ **OJO con el nombre: es SINGULAR** (`..._media_view_unique`), no plural. El plural
(`post_total_media_views_unique`) da 400.

**Pendiente operativo:** correr el sync con rango amplio (`?days=200`) **una vez** para
traer el **backfill de todo 2026** (Meta lo rellena desde el 1-ene-2026) y que los meses
del hueco (junio) queden completos con la métrica nueva.

## Qué pasó (validado contra la API, no asumido)

- El gráfico "Análisis de Redes → Facebook orgánico → Evolución mensual" mostraba junio
  con alcance casi en 0. **No era performance baja:** todos los posts publicados desde el
  **15-jun-2026** tienen `reach = 0` (corte seco). Coincide exacto con la deprecación de Meta.
- Meta deprecó **85 métricas** (post / video / página), la **mayoría de Reach**, el
  **2026-06-15**, en **todas las versiones** de la Graph API. La API responde
  `(#100) The value must be a valid insights metric`.
- El reemplazo — **Total Unique Media Views** (post y página) — Meta lo lanza **a fin de
  junio 2026**. Al 26-jun **todavía no está activo** en esta cuenta. Nombres de campo
  (a validar contra la API cuando se prendan):
  - **Page Reach** `page_impressions_unique` → **`page_total_media_view_unique`** (Page Unique Media Views / Page Viewers).
  - **Post Reach** `post_impressions_unique` → **`post_total_media_views_unique`** (Post Unique Media Views / Media Viewers).
- 🔑 **Backfill**: Meta **rellena el reach desde el 1-ene-2026** con la métrica nueva. O sea,
  apenas se active, se recupera **todo 2026 — incluido el hueco de junio**. No se pierde nada.
  → Al activarse, correr el sync con rango amplio (`?days=180`) para traer el backfill.
- El reach **sigue disponible en Meta Business Suite** (la UI). El dato existe; falta que
  abran la métrica nueva en la API.
- **Instagram NO se rompió**: usa nombres unificados (`reach`, `views`, `total_interactions`)
  que siguen vivos. La deprecación es cross-platform pero por etapas → eventualmente puede
  pegarle a IG; ahí se aplica el mismo patrón.

### Sondeo real (campos del JSON del cron `meta-fb-sync`)

Probado contra la cuenta (Page Drean `257587170945975`), v22.0 / v23.0 / v25.0:

| Métrica (post) | Resultado |
|---|---|
| `post_impressions`, `post_impressions_unique` (reach viejo), `_organic`, `_organic_unique`, `_paid` | ❌ 400 invalid |
| `reach`, `impressions`, `views`, `total_interactions`, `saved`, `shares`, `likes`, `comments` (unificados IG) | ❌ 400 invalid |
| `post_clicks`, `post_video_views` | ✅ works (sample 0) |
| `post_reactions_by_type_total`, `post_activity_by_action_type` | ✅ works ({like:n,...}) |

| Métrica (página) | Resultado |
|---|---|
| `views`, `page_views`, `page_impressions(_unique)`, `reach`, `content_views`, `total_interactions`, `accounts_engaged` | ❌ 400 invalid |
| `page_post_engagements`, `page_follows`, `page_views_total`, `page_daily_follows`, `page_actions_post_reactions_total` | ✅ works |

| Cross-versión | Resultado |
|---|---|
| `v23.0/views`, `v25.0/views` | ❌ 400 invalid |
| `v23.0/page_views_total`, `v25.0/page_views_total` (control) | ✅ works (sample 380) |

Conclusión: vía `/{id}/insights?metric=…` **no hay ningún nombre de reach vivo** (viejo ni
unificado), en ninguna versión. El control confirma que token/cuenta/versión funcionan.

## Solución aplicada (robusta)

1. **No perder data** — `meta-fb-sync` hace upsert **no destructivo**: nunca pisa un valor
   histórico de reach/impresiones con 0. Todo lo pre-15-jun queda intacto.
2. **Self-healing** — el sync **sondea** los nombres candidatos del reemplazo en cada
   corrida (`reach`, `views`, `media_views`, `media_viewers`, `unique_views`, `post_reach`,
   `post_unique_views`, …) y reporta cuál acepta la cuenta en `post_metric_diagnostics` /
   `page_metric_probe`. El mapeo de la fila lee esos nombres con fallback:
   ```
   reach:       ins.reach ?? ins.media_viewers ?? ins.unique_views ?? ins.post_reach ?? ins.post_unique_views ?? ins.post_impressions_unique ?? histórico
   impresiones: ins.views ?? ins.media_views ?? ins.post_impressions ?? histórico
   ```
   → el día que Meta active la métrica nueva, el reach **se llena solo**, sin recodear.
3. **Dashboard honesto** — el gráfico usa **Engagement** como métrica principal (barras,
   viva todos los meses) y el **reach** como línea histórica punteada que corta el 15-jun.
   Nota visible explicando la transición.

## Cómo verificar / reconectar cuando Meta active la métrica

1. Correr el workflow **`meta-fb-sync`** (Actions → Run workflow). En el JSON de respuesta,
   mirar **`post_metric_diagnostics`** y **`page_metric_probe`**.
2. Si alguno de los candidatos de reach/views aparece con **`works:true`** (con `sample`
   numérico) → la métrica nueva ya está activa. El sync **ya la captura** (está en el mapeo).
   - Si el nombre real es **otro** (no está en la lista), agregarlo en dos lugares de
     `apps/web/src/app/api/cron/meta-fb-sync/route.ts`: el array `postMetricTests` (sondeo)
     y el `??`-chain de `reach`/`impressions` en `postRows`.
3. Reactivar el reach en el gráfico: en `apps/web/src/lib/meta-fb-queries.ts`, sacar/ajustar
   el corte `REACH_DISCONTINUED_MONTH = "2026-06"` (hoy nulea el reach desde junio para no
   mostrar el hueco parcial). Una vez que vuelva data real, mostrar reach de nuevo.
4. (Opcional) volver el reach a métrica principal del gráfico en `fb-monthly-chart.tsx`
   (hoy Engagement = barras, reach = línea histórica).

## Pregunta abierta: ¿junio es bajo por acumulación o genuino? (sin resolver)

Junio rinde ~714 reach/post vs ~1.954 de mayo. **No está validado** si es porque la
métrica lifetime todavía acumula (junio recién termina) o porque junio genuinamente
alcanzó menos. La serie `period=day` **no sirve** para verlo: la métrica nueva devuelve
`day=0` siempre (solo expone `lifetime`). La ÚNICA forma de saberlo es **comparar el
lifetime en el tiempo**.

**Baseline al 2026-06-26 (re-comparar en ~5 días):**
```
06-02:1121  06-04:1088  06-08:881  06-09:878  06-10:1196  06-11:794  06-12:1019
06-13:807   06-15:679   06-17:583  06-18:502  06-19:480   06-20:503  06-22:572
06-23:737   06-24:174   06-25:122
```
Si en ~5 días los posts del **2-13 jun** (ya maduros) **crecieron** → acumulación real.
Si quedaron **iguales** → junio genuinamente más bajo (contenido/algoritmo), no acumulación.

## FB vs IG: el "junio bajo" era volumen de Stories, no un bug (resuelto)

Sospecha: FB junio (17 posts / 12K reach) << IG junio (59 posts / 43K), con el mismo
posteo. Validado con el desglose por `media_type` (junio 2026):

| Formato | FB | IG |
|---|---|---|
| Feed (album/photo/FEED) | 13 | 12 |
| Video / Reels | 4 | 4 |
| **Stories** | **0** | **43** |
| Total | 17 | 59 |

**FB e IG postean lo mismo de feed+reels.** Toda la diferencia son las **43 Stories de IG**,
que **Meta NO expone para Páginas de FB** por API (el endpoint de FB Page Stories no devuelve
`id` — ya estaba deshabilitado). No es un bug ni faltan Reels: FB no puede capturar sus
Stories. Por eso el total de FB se ve más bajo que IG (IG suma Stories, FB no). El dashboard
lo aclara en la nota del gráfico de FB.

## Actualización dic-2026: la META de Redes se mide solo con Instagram + fix del posteo pago

Dado que el reach de FB quedó estructuralmente roto (métrica de reemplazo que **no separa
pago de orgánico**), la **meta/objetivo estratégico del plan Redes se mide solo con Instagram**.
El dashboard **sigue mostrando todo** (IG orgánico, FB orgánico, el combinado IG+FB y el
competitivo) — no se sacó ninguna sección. Solo el `MetaPanel` usa valores **IG del mes en
curso** (`igOrganic.monthlyData` + seguidores IG) para el semáforo.

### ⚠️ El reach de FB se ensucia por DOS lados (los dos ya tapados — no destapar)

Validado con la DB (sep-2026), por si vuelve a aparecer un pico:

**1. Post pago/boosteado (nivel post).** Meta mete el pago dentro del reach del post y no lo
separa. Firma: reach fuera de escala con engagement casi nulo. `isPaidOutlier`
(reach>20k && reac/reach<1%) lo excluye, y `getFbOrganicSummary` devuelve
`topPosts: organicPosts` → no contamina ninguna vista.

**2. Tabla `meta_fb_monthly_reach` (reach mensual de Página) ROTA.** La métrica nueva devuelve
basura. Data real:

| mes | pageReach (tabla) | suma orgánica posts | veredicto |
|---|---|---|---|
| 2026-08 | 144.014 | 5.204 | inflado por pauta (boost 11-ago) |
| 2026-07 | 10.448.270 | 28.494 | roto (millones) |
| 2026-06 | 5.824.349 | 33.273 | roto |
| 2026-05 | 10.108.259 | 41.943 | roto |
| 2026-04 | 7.951.428 | 33.101 | roto |
| 2026-03 | 8.268 | 22.227 | OK (page ≤ Σ posts) |
| 2026-02 | 6.293 | 6.681 | OK |
| 2026-01 | 6.603 | 11.594 | OK |

El corte viejo `REACH_SANE_MAX=2M` tapaba los de millones **pero no ago (144k)**. **Regla
definitiva** en `monthlyData`: `pageReach` solo se usa si `pageReach ≤ organicSum*1.1`
(la reach única de la Página no puede superar la suma de reach de los posts orgánicos por
dedup). Si la supera → pauta o dato roto → se usa la suma orgánica (ya sin pago).

### La ventana del sync (`days`) — por qué agosto salía en 5K

El reach de un post (`post_total_media_view_unique`) es **lifetime**: sigue sumando por semanas.
El workflow `meta-fb-sync.yml` refresca solo los posts de los últimos `days` y estaba en **3**
(default puesto al crear el workflow, no una decisión afinada). Efecto: cada post se congelaba
con el reach inmaduro a los ~3 días. Validado con `updated_at`:

- Posts de **jun/jul**: todos con `updated_at = 2026-08-03` (un backfill amplio manual de ese
  día) → capturados ya maduros → jul suma 28K, jun 33K.
- Posts de **agosto**: frozen 2-3 días después de `fecha_post`, nunca re-refrescados → suma 5K.

No es que agosto rindiera menos; es que se contó inmaduro. **Fix:** `days` subido a **50** en el
schedule (el reach se estabiliza a los ~30 días — posts de junio con 38-62 días ≈ julio con
4-32 días, ~1.850 vs ~1.900; no crece después → 50 da margen). Costo bajo: ~30 posts × (1
insights + 1 HEAD idempotente) por corrida. **OJO:** en runs por schedule `inputs.days` viene
vacío → cae al fallback del shell (`${DAYS_INPUT:-50}`), NO al `default` del dispatch → tocar los
dos. Backfill puntual: Actions → "Meta FB sync" → Run workflow → days=90/200.

Además se cerró un bug del filtro de pago: `isPaidOutlier` (reach >20k con engagement <1%)
excluía el boosteo del **gráfico mensual** pero **no de `topPosts`** (la lista que expone el
query). Por eso los KPI cards que sumaban desde `topPosts` (Engagement combinado, Video views)
salían inflados. Caso real 11-ago-2026: reach 188.724, 67.124 video views, 23 reacciones.
**Fix:** `getFbOrganicSummary` ahora devuelve `topPosts: organicPosts` (filtrado en la fuente),
así el pago no contamina ninguna vista, totales ni "top posts".

## Archivos tocados
- `apps/web/src/app/api/cron/meta-fb-sync/route.ts` — sondeo de métricas, upsert no
  destructivo, mapeo self-healing.
- `apps/web/src/lib/meta-fb-queries.ts` — corte del reach del gráfico desde `2026-06`.
- `apps/web/src/components/social/fb-monthly-chart.tsx` — Engagement principal + reach histórico.
- `apps/web/src/components/social/fb-organic-section.tsx` — nota de la transición.

## Referencias (oficiales / proveedores)
- Meta — Page Insights API Updates (2025-08-15): https://developers.facebook.com/blog/post/2025/08/15/page-insights-api-updates/
- Meta — Graph API v25.0 changelog: https://developers.facebook.com/docs/graph-api/changelog/version25.0/
- Sprinklr — Facebook Reach Metrics Deprecation
- Sprout Social — Facebook Metric Deprecations June 2026
</content>
