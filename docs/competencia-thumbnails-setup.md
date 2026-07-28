# Miniaturas de posts de competencia (thumbnails)

Cómo sumar la **imagen del post** a las tarjetas de competencia en `/redes`.
Hoy los posts propios de Drean muestran miniatura (vienen de la API de Meta),
pero los de competencia no, porque el scraper no la traía.

## La buena noticia

El scraper de competencia usa **Apify**, y los actores de Apify **ya devuelven
la imagen** de cada post (`displayUrl` en Instagram, thumbnail en Facebook,
cover en TikTok). Sólo hay que **capturarla y guardarla**. No hace falta un
scraper nuevo.

## El problema a resolver: las URLs caducan

Las URLs de imagen del CDN de Instagram/Facebook (`displayUrl` de Apify)
**caducan en horas/días**. Si guardamos la URL cruda, las miniaturas de posts
viejos se rompen. Por eso hay que **re-hostear** la imagen (bajarla y subirla a
un lugar propio: Supabase Storage) apenas se scrapea.

## Arquitectura recomendada

```
Apify (displayUrl) ──► n8n: agrega la URL cruda al Sheet (col IMAGE_URL)
                         │
                         ▼
        n8n "Sheets Social Sync" ──► social_posts.thumbnail_url (URL cruda)
                         │
                         ▼
   Vercel cron re-host ──► baja la imagen ──► Supabase Storage ──► pisa
   thumbnail_url con la URL permanente
```

## Lo que YA está hecho en el repo (dashboard listo)

- ✅ Migración `0080_social_posts_thumbnail.sql`: columna `thumbnail_url` en
  `social_posts`. **Correr en Supabase.**
- ✅ El dashboard (`/redes` → competencia) ya muestra la miniatura **si existe**
  (`thumbnail_url`). Sin miniatura, cae al diseño actual sin foto. O sea: apenas
  empiece a llegar la imagen, aparece sola, sin tocar nada más.

## Lo que falta (cambios en n8n — los hace quien administra el scraper)

### 1. Capturar la imagen en el scraper (`Scrapper Pro — Drean (Social)`)

En los nodos **`Tag Instagram`**, **`Tag Facebook`** y **`Tag TikTok`** (que mapean
el item de Apify al objeto común), agregar un campo `image` tomando:

| Plataforma | Campo de Apify a usar |
|------------|-----------------------|
| Instagram  | `displayUrl` (fallback: `images[0]`) |
| Facebook   | `thumbnailUrl` / `media[0].thumbnail` (según el actor de FB que uses) |
| TikTok     | `videoMeta.coverUrl` (fallback: `covers[0]`) |

En el nodo **`Append row in sheet`**, agregar una columna nueva **`IMAGE_URL`**
mapeada a ese campo `image`.

### 2. Mapear al sync (`Sheets Social Sync`)

En el nodo que arma el upsert a `social_posts`, agregar el mapeo
`IMAGE_URL → thumbnail_url`.

> Con esto ya se ve la miniatura en el dashboard — **pero con URL que caduca**.
> Para que no se rompa, falta el paso 3.

### 3. Re-hostear (recomendado) — a definir

Dos opciones:

- **A) En n8n:** después del scrape, un nodo HTTP baja la imagen y otro la sube a
  Supabase Storage (bucket `competencia-thumbs`), y se guarda esa URL. Todo en el
  workflow.
- **B) En Vercel (cron):** un endpoint `/api/cron/rehost-thumbs` que lee las filas
  de `social_posts` con `thumbnail_url` de un CDN externo (no-Supabase), baja la
  imagen, la sube a Storage y pisa `thumbnail_url`. Corre poco después del scrape
  (ej. 8:30 AM). **Ventaja:** el cambio en n8n es mínimo (sólo pasar la URL cruda);
  el re-host queda en código nuestro. **Este es el camino sugerido.**

La opción B está pendiente de construir (ver con el equipo si arrancamos).

## Resumen para pasarle a OMD / quien maneje n8n

> En el scraper de Apify, capturen la imagen de cada post (`displayUrl` en IG)
> y agréguenla al Sheet como columna `IMAGE_URL`. En el sync a Supabase, mapeen
> `IMAGE_URL → social_posts.thumbnail_url`. La imagen se re-hostea después del
> lado del dashboard para que no caduque.
