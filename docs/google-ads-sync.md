# Google Ads sync (OMD · nivel creativo)

> Estado: **conector construido, PENDIENTE de credenciales para validar.**
> Nada de esto se muestra en el dashboard hasta que la ruta de diagnóstico
> devuelva datos reales. No confiamos en ningún número sin validar primero.

## Por qué existe

Hoy la inversión de Google Ads (Demand Gen + Search) entra **sólo vía GA4**
(`ga4_google_ads_daily`), que a nivel campaña devuelve únicamente
**costo, impresiones, clicks y CPC**. GA4 **no expone** cuartiles de video, VTR,
reach ni creativos. Por eso "de Demand Gen se obtiene muy poca info".

La **Google Ads API** sí expone, a nivel anuncio, el mismo embudo que ya tenemos
de Meta:

| Métrica Google Ads API | Columna en `google_ads_creatives` |
|---|---|
| `metrics.video_views` | `video_views` |
| `metrics.video_view_rate` | `video_view_rate` (VTR) |
| `metrics.video_quartile_p25_rate` … `p100_rate` | `vtr_p25/50/75/100` |
| `metrics.impressions / clicks / cost_micros` | `impressions / clicks / cost` |
| `metrics.interactions` | `interactions` |
| `campaign.advertising_channel_type` | `campaign_type` (DEMAND_GEN / SEARCH / VIDEO) |

Los **thumbnails** de los assets se completan en un pase posterior (requiere
consultar el recurso `asset`); por eso `thumbnail_url` arranca nulo.

## Arquitectura (idéntica al patrón de GA4)

```
GitHub Actions (google-ads-sync.yml)
  └─ GET /api/cron/google-ads-sync?days=30   (Authorization: Bearer CRON_SECRET)
       ├─ OAuth refresh_token → access_token   (mismas GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN)
       ├─ GAQL sobre ad_group_ad por cada cuenta OMD (searchStream)
       └─ upsert a google_ads_creatives (on_conflict fecha,ad_id)
```

Cuentas OMD consultadas (mismas del allowlist de GA4, sin el ecommerce inhouse):
Refrigeración `2703756419`, Lavado `1597165780`, Cocción `5791135678`,
Search `1257010507`.

## Lo que falta para activarlo (ACCESO — lo gestiona OMD/Drean, no el dashboard)

Se necesitan **dos** secrets nuevos en GitHub Actions + Vercel:

1. **`GOOGLE_ADS_DEVELOPER_TOKEN`** — token de desarrollador de la Google Ads API.
   - Se genera desde un **manager account (MCC)** en *Herramientas → Configuración → API Center*.
   - Requiere aprobación de Google: primero da **Test Access** (sólo cuentas de test),
     hay que solicitar **Basic Access** para consultar cuentas productivas.
   - Puede salir del MCC propio de Drean (ej. Brandlive) — no hace falta que sea el de OMD.

2. **Scope `adwords` en el refresh token** — el `GOOGLE_REFRESH_TOKEN` actual se generó
   para GA4 (`analytics.readonly`). Hay que **regenerarlo** incluyendo también
   `https://www.googleapis.com/auth/adwords`, con un usuario Google que tenga acceso
   de lectura a las 4 cuentas de OMD.
   - **Pedido a OMD:** que agreguen ese usuario Google (lectura) a las cuentas
     Refrigeración / Lavado / Cocción / Search, **o** que vinculen esas cuentas a un
     MCC nuestro. Sin este acceso, el token ve el dev token pero no las cuentas.

3. (Opcional) **`GOOGLE_ADS_LOGIN_CUSTOMER_ID`** — si las cuentas se consultan a través
   de un MCC, poner acá el ID del MCC (ej. el de OMD `2013657015`). Se manda en el
   header `login-customer-id`.

## Cómo validar (en orden, sin escribir nada)

1. **¿El token ve cuentas?**
   `GET /api/diag/google-ads-access` → debe listar customers accesibles.
   Si falla acá: falta dev token, Basic Access, o el scope `adwords`.

2. **¿Hay data real de video en una cuenta?**
   `GET /api/diag/google-ads-access?customer=2703756419&days=7` → 20 filas crudas
   con impresiones y cuartiles. Acá confirmamos que la profundidad existe.

3. **Dry-run del ingester (sin escribir):**
   Actions → *Google Ads sync* → Run workflow con `dry = 1`. Devuelve muestra +
   totales por cuenta. Se comparan esos totales contra lo que OMD reporta.

4. **Recién ahí, ingesta real:** correr el workflow sin `dry`, y luego integrar en
   `/performance` reemplazando las filas pobres de GA4 por esta fuente profunda.

## Próximos pasos (post-validación)

- Reemplazar en `/performance` la fuente de Demand Gen/Search: de `ga4_google_ads_daily`
  (pobre) a `google_ads_creatives` (profundo), con VTR y cuartiles reales.
- Pase de enriquecimiento de `thumbnail_url` (consulta al recurso `asset` / video de YouTube).
- Piezas Google Ads a nivel creativo en la grilla, igual que las piezas Meta.
