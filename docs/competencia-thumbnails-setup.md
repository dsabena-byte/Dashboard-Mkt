# Miniaturas de posts de competencia (thumbnails)

Cómo se muestran las **imágenes de los posts de competencia** en `/redes`.
Los posts propios de Drean ya muestran miniatura (API de Meta); esto lo suma
para la competencia, que viene del scraper (n8n + Apify).

## Cómo funciona (end-to-end)

```
Apify (displayUrl) ─► scraper n8n: guarda la URL en el Sheet (col IMAGE_URL)
                        │
                        ▼
   sync n8n ─► social_posts.thumbnail_url  (URL cruda del CDN de IG/FB)
                        │
                        ▼
   Vercel cron rehost-thumbs (cada 3 h) ─► baja la imagen ─► Supabase Storage
   (bucket meta-thumbs, key competencia/{id}.jpg) ─► pisa thumbnail_url con la
   URL permanente
                        │
                        ▼
   Dashboard /redes ─► muestra la miniatura en las tarjetas de competencia
```

**Por qué el re-host:** las URLs del CDN de IG/FB caducan en 1-2 días. El cron
las copia a nuestro Storage para que no se rompan.

## Lo que YA está hecho (repo)

- ✅ Columna `social_posts.thumbnail_url` (migración `0080`, ya corrida).
- ✅ El dashboard muestra la miniatura si existe (fallback sin foto si no hay).
- ✅ **Cron de re-host** `GET /api/cron/rehost-thumbs` + workflow
  `.github/workflows/rehost-thumbs.yml` (cada 3 h). Usa el bucket `meta-thumbs`
  que ya existe. Requiere el secret `CRON_SECRET` en GitHub (ya está, es el mismo
  que usa `publicar-contenido`).
- ✅ **Workflows de n8n del repo actualizados** para capturar la imagen:
  `scraper-social-drean.json` (Tag IG/FB/TikTok + Parse Response + Append) y los
  syncs `social-posts-sync.json` / `scraper-social-supabase.json` (mapean
  `IMAGE_URL → thumbnail_url`).

## Lo que falta hacer en tu n8n (una vez)

Tu flow **en vivo** no se actualiza solo con el repo. Tenés dos opciones:

### Opción rápida — editar los nodos a mano (no perdés credenciales)

En tu flow **"Scrapper Pro — Drean (Social)"**:

1. **Nodo `Tag Instagram`** → antes de `platform: 'INSTAGRAM'` agregá:
   ```js
   image: d.displayUrl || (Array.isArray(d.images) ? d.images[0] : '') || '',
   ```
2. **Nodo `Tag Facebook`** → antes de `platform: 'FACEBOOK'`:
   ```js
   image: d.thumbnailUrl || d.image || (Array.isArray(d.media) && d.media[0] ? (d.media[0].thumbnail || (d.media[0].photo_image && d.media[0].photo_image.uri)) : '') || '',
   ```
3. **Nodo `Tag TikTok`** → antes de `platform: 'TIKTOK'`:
   ```js
   image: (d.videoMeta && (d.videoMeta.coverUrl || d.videoMeta.originCover)) || (Array.isArray(d.covers) ? d.covers[0] : '') || '',
   ```
4. **Nodo `Parse Response`** → dentro del `results.push({ ... })`, al lado de `url,` agregá:
   ```js
   image: post.image || '',
   ```
5. **Nodo `Append row in sheet`** → agregá la columna **`IMAGE_URL`** mapeada a
   `={{ $json.image }}`.
6. **En el Google Sheet**, agregá el header **`IMAGE_URL`** (una columna nueva al
   final de la fila de títulos).

En tu flow de **sync a Supabase** (`social-posts-sync` / "Normalize rows"):

7. Al lado de `content_type:` agregá:
   ```js
   thumbnail_url: (r['IMAGE_URL'] || '').toString().trim() || null,
   ```

### Opción prolija — re-importar

Importá los JSON actualizados del repo (`n8n-workflows/…`) y reconectá las
credenciales (Apify, Google Sheets, Anthropic) como la primera vez.

## Notas

- Los campos de imagen de Facebook/TikTok varían según el actor de Apify. Si en
  el primer run la columna `IMAGE_URL` sale vacía para FB o TikTok, revisá qué
  campo trae la imagen en el output de Apify y ajustá esa línea.
- El re-host corre cada 3 h: las miniaturas nuevas pueden tardar hasta ~3 h en
  volverse permanentes. Mientras tanto, igual se ven (con la URL cruda).
- Para forzar un re-host manual: en GitHub → Actions → "Re-hostear miniaturas de
  competencia" → Run workflow. Con `dry=1` sólo lista, no re-hostea.
