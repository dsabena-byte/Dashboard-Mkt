# Facebook — deprecación del Reach orgánico (Meta, jun-2026)

Estado: **reach en transición** (rollover de Meta). No está eliminado: Meta retiró las
métricas viejas el **15-jun-2026** y prende el reemplazo **a fin de junio 2026**. El sync
quedó **auto-reparable** para capturar la métrica nueva apenas se active, sin recodear.

## Qué pasó (validado contra la API, no asumido)

- El gráfico "Análisis de Redes → Facebook orgánico → Evolución mensual" mostraba junio
  con alcance casi en 0. **No era performance baja:** todos los posts publicados desde el
  **15-jun-2026** tienen `reach = 0` (corte seco). Coincide exacto con la deprecación de Meta.
- Meta deprecó **85 métricas** (post / video / página), la **mayoría de Reach**, el
  **2026-06-15**, en **todas las versiones** de la Graph API. La API responde
  `(#100) The value must be a valid insights metric`.
- El reemplazo — **Page Viewer Metric** (reach) y **Media Views / Media Viewers / Unique
  Views** — Meta lo lanza **a fin de junio 2026**. Al 26-jun **todavía no está activo**.
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
