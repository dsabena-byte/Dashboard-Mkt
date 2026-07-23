# TikTok sync (Ads · nivel creativo)

> Estado: **conector construido, PENDIENTE de credenciales para validar.**
> Los accesos ya fueron solicitados a OMD. Nada se muestra en el dashboard hasta
> que la ruta de diagnóstico devuelva datos reales.

## Por qué existe

Hoy TikTok se carga **a mano** (exports de OMD/Looker) dentro de `meta_paid_creatives`
con `plataforma='tiktok'`, y en el mejor caso con VTR%. No hay API, no hay frescura,
no hay thumbnails ni interacciones automáticas.

La **TikTok Marketing API** (reporting integrado, `data_level=AUCTION_AD`) expone a
nivel anuncio el mismo embudo que ya tenemos de Meta:

| Métrica TikTok API | Columna en `tiktok_creatives` |
|---|---|
| `video_play_actions` | `video_views` |
| `video_watched_2s` / `video_watched_6s` | `video_watched_2s/6s` |
| `video_views_p25` … `p100` | `video_p25/50/75/100` (conteos) |
| `spend / impressions / clicks / reach / frequency` | idem |
| `likes / comments / shares / follows / profile_visits` | idem |

El **thumbnail** (cover del video) no viene en el reporte; se completa en un pase
posterior vía `/file/video/ad/info/`. Por eso `thumbnail_url` arranca nulo.

## Arquitectura (mismo patrón que Google Ads / GA4)

```
GitHub Actions (tiktok-sync.yml)
  └─ GET /api/cron/tiktok-sync?days=30      (Authorization: Bearer CRON_SECRET)
       ├─ TikTok Marketing API /report/integrated/get/ (BASIC · AUCTION_AD · por día)
       │    header Access-Token, paginado
       └─ upsert a tiktok_creatives (on_conflict fecha,ad_id)
```

## Lo que falta para activarlo (ACCESO — ya pedido a OMD)

Cuatro secrets nuevos en GitHub Actions + Vercel:

1. **`TIKTOK_APP_ID`** y **`TIKTOK_APP_SECRET`** — de una app registrada en
   TikTok for Business / Marketing API, con permisos de *Ads Management* + *Reporting*
   (requiere aprobación de TikTok).
2. **`TIKTOK_ACCESS_TOKEN`** — token de larga duración que sale de autorizar la app
   contra la cuenta publicitaria (OMD debe agregarnos al Business Center de Drean).
3. **`TIKTOK_ADVERTISER_ID`** — el/los advertiser_id de Drean (separados por coma si
   son varios).

## Cómo validar (en orden, sin escribir nada)

1. **¿El token ve advertisers?**
   `GET /api/diag/tiktok-access` → lista de advertisers autorizados.
   Si falla acá: falta app aprobada, token, o el acceso de OMD a la cuenta.

2. **¿Hay data real de video?**
   `GET /api/diag/tiktok-access?advertiser=<ID>&days=7` → nombre + moneda de la cuenta
   y 20 filas con spend, impresiones y cuartiles de video.

3. **Dry-run del ingester (sin escribir):**
   Actions → *TikTok sync* → Run workflow con `dry = 1`. Devuelve muestra + totales
   por advertiser. Se comparan contra lo que OMD reporta.

4. **Recién ahí, ingesta real:** correr sin `dry`, y luego integrar en `/performance`
   reemplazando la carga manual por esta fuente automática y profunda.

## Próximos pasos (post-validación)

- Integrar en `/performance` (tabla por medio + piezas TikTok a nivel creativo), en
  reemplazo de la carga manual en `meta_paid_creatives`.
- Pase de enriquecimiento de `thumbnail_url` (cover del video vía `/file/video/ad/info/`).
