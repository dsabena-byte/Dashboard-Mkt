# Crons de sincronización — GitHub Actions

Toda la orquestación de syncs periódicos (Meta, GA4, sentiment) vive en
**`.github/workflows/`**. Antes corrían como Vercel crons (limitados a 1x/día
en plan Hobby y silenciosos cuando fallan); ahora son GitHub Actions que se
ejecutan con la frecuencia que necesitemos y dejan rastro de cada run en la
pestaña **Actions** del repo.

## Workflows activos

| Workflow | Frecuencia (UTC) | Endpoint disparado | Para qué |
|---|---|---|---|
| `ga4-sync.yml` | cada 6h (30, 06:30, 12:30, 18:30) | `/api/cron/ga4-web-traffic?days=3` | Tráfico GA4 → tablas `web_traffic` y `web_landing_daily` |
| `meta-fb-sync.yml` | cada 12h (00:00, 12:00) | `/api/cron/meta-fb-sync?days=3` | Page Drean + posts FB → `meta_page_daily`, `meta_posts` |
| `ig-sync-6h.yml` | cada 6h (00:00, 06:00, 12:00, 18:00) | `/api/cron/ig-sync?days=7` | @dreanargentina IG (incluye Stories antes que caduquen 24h) |
| `meta-paid-sync.yml` | 1x/día (10:30) | `/api/cron/meta-paid-sync` | Paid creatives Meta Ads → `meta_paid_creatives` |
| `ig-sentiment-sync.yml` | 1x/día (08:00) | `/api/cron/ig-sentiment-analysis?batch=5` | Clasificación de comentarios IG (OpenAI) |

Todos aceptan **`workflow_dispatch`** para dispararse manual desde GitHub →
Actions → seleccionar el workflow → "Run workflow".

## Pre-requisito: secret `CRON_SECRET`

Si el endpoint requiere autenticación (Vercel env var `CRON_SECRET` definida),
GitHub Actions debe tener el mismo valor en:

- Repo → Settings → Secrets and variables → **Actions** → tab **Secrets** → New repository secret
- Name: `CRON_SECRET` — Value: el mismo string que en Vercel

Si Vercel **no** tiene `CRON_SECRET`, dejar el secret vacío en GitHub también
(los workflows manejan ambos casos).

## Cómo identificar si un cron falló

1. GitHub repo → pestaña **Actions**
2. Sidebar: nombre del workflow (ej. "GA4 web traffic sync")
3. Lista de runs — ✓ verde OK, ✗ rojo falla
4. Click en un run rojo → logs completos del curl + JSON de respuesta del
   endpoint

Cada workflow termina con `grep -q '"ok":false' out.json` → si la respuesta
del endpoint tiene `"ok":false`, el step falla y queda en rojo.

## Disparar manual (cuando hay que refrescar ya)

1. Repo → Actions → seleccionar workflow
2. Botón **Run workflow** (arriba a la derecha) → "Run workflow" en verde
3. Refrescá la lista; aparece un run en curso

## Migración desde Vercel crons

El archivo `vercel.json` quedó con `"crons": []` para que Vercel deje de
ejecutar los crons paralelos. La configuración previa está en el historial
de git si hay que revertir.

## Qué NO está en GitHub Actions

- **Apify** (scraping competidores web y RRSS) → vive en n8n con sus
  propios schedules.
- **n8n workflows** que mantienen Sheets / Drive sync.

Si esos también empiezan a fallar silenciosamente, hay que monitorearlos en
n8n directamente (UI → Executions) o sumar otro GH Action que dispare sus
webhooks.
