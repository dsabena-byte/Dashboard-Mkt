# Migración n8n → código (scraping de competencia de Drean)

Fuente de verdad para la paridad. Armado el 28-sep-2026 leyendo los exports de `n8n-workflows/` **y** la
data real que n8n escribió (REST, service key). **Ojo:** el n8n en vivo (n8n.cloud) NO es idéntico a los
exports del repo; donde difieren, manda lo que se ve en la base.

## 1. Qué corre hoy en n8n (reconstruido)

| Workflow (export) | ¿Corre en vivo? | Evidencia en la base | Escribe |
|---|---|---|---|
| `scraper-social-supabase.json` "Social Scraper — Apify + GPT → Supabase" | **Sí, diario** (el export dice trigger manual) | `social_posts`: FB creado 07:00–07:05 UTC, IG 07:10–07:11 UTC, todos los días, posts con 1–2 días de edad | `social_posts` (upsert `on_conflict=url`, `merge-duplicates`) |
| `competitor-web-sync.json` "Competitor Web Traffic Sync" | **Sí, semanal: domingo ~00:01 UTC** (el export dice diario 04:00 y actor tri_angle) | `competitor_web`: 7 filas cada domingo desde may-2026, `raw` con la forma de **radeance/similarweb-scraper** | `competitor_web` (upsert `fecha,competidor,source`) |
| `competitor-categoria-sync.json` / `competitor-categoria-dataforseo.json` | **No** | `competitor_categoria_web` vacía | — |
| `sheets-social-sync.json` / `social-posts-sync.json` / `scraper-social-drean.json` (Sheet) | **No** (viejos) | `social_metrics` / `social_competitor` congeladas en 2026-05-25 (`source=google_sheet`) | — |
| TikTok (en el export social) | **No** | 0 filas TIKTOK en `social_posts` | — |

Seguidores (`social_followers`): n8n **no** los escribe. Hay fotos manuales de may-2026 (IG+FB) y, desde
el 27-sep, IG diario por Business Discovery (`competencia-ig`).

## 2. Mapa campo a campo — `social_posts`

Actores: IG = `apify/instagram-scraper` (`shu8hvrXbJbY3Eb9W`); FB = `facebook-posts-scraper` (el export dice
`facebook-pages-scraper`, pero ese actor no devuelve posts; la misma cuenta corre posts-scraper — BIP).
Marcas: `dreanargentina` (propia), `philco.arg`, `gafaargentina`, `whirlpoolarg`, `electroluxar` (IG + FB; la
propia TAMBIÉN se scrapea). `fromDate` = 2026-01-01 (los posts anteriores se descartan).
Input IG n8n: `directUrls` de los 5 perfiles, `resultsLimit: 500`, `onlyPostsNewerThan: fromDate`,
`scrapeComments:false`, `enhanceUserData:true` (los `latestComments` vienen igual en cada post).
Input FB n8n: `startUrls` de las 5 páginas, `maxPosts: 500`.
LLM: OpenAI **gpt-4o**, temperature 0, json_object, UN prompt para todos los posts (pilar + sentimiento desde
los comentarios + insight). El `insight` NO se guarda.

| Columna | IG (Tag Instagram → Parse) | FB (Tag Facebook → Parse) | Lo que se ve en la base (n8n) |
|---|---|---|---|
| `red_social` | `INSTAGRAM` | `FACEBOOK` | ✔ |
| `url` | `d.url` o `/p/<shortCode>/` | `d.url ‖ postUrl ‖ link` | FB `facebook.com/<Página>/posts/pfbid…` o `/reel/<id>/` |
| `marca` | `inputUrl` (la cuenta pedida; captura collabs) → si no, `ownerUsername` normalizado por prefijo | `pageName ‖ pageAlias ‖ username` por prefijo | ✔ |
| `fecha` | `new Date(timestamp).toISOString().slice(0,10)` (**UTC**) | idem con `time` | ✔ |
| `pilar` | LLM, 5 valores; combinado → primero válido; inválido → Branding | idem | 100% con pilar |
| `positivo/negativo/neutro` | LLM desde `latestComments` (≤20); **null si el post no trae comentarios** | siempre null (Tag Facebook no arma `commentTexts`) | IG 59/92 no null · FB 0 |
| `likes` / `comentarios` | `likesCount` / `commentsCount` | `likes‖likesCount‖reactionsCount` / `comments‖commentsCount` | ✔ |
| `views` | `videoPlayCount ?? videoViewCount` | `videoViewCount ‖ views` | FB solo en videos/reels |
| `engagement` | `(likes+coment.)/followers·100` si followers>0; si no null | idem | **siempre null** (followers=0) |
| `followers` | 0 fijo (el actor no lo trae) | `pageFans‖fans‖followers‖pageFollowers` → 0 con posts-scraper | IG 0 (BD los completa después) · FB 0 |
| `tipo` | `isPinned` → PAUTA, si no ORGÁNICO | `isSponsored` → PAUTA | IG 3/92 PAUTA · FB todo ORGÁNICO |
| `content_type` | `type` con video/reel → VIDEO, sidecar/album → SIDECAR, resto IMAGE | idem (`type ‖ 'photo'`) | ✔ |
| `thumbnail_url` | `displayUrl ‖ images[0]` | `thumbnailUrl ‖ image` | IG sí (luego `rehost-thumbs` la espeja) · **FB null** |
| `copy` | `caption` | `text‖message‖story` | IG sí · **FB null** (el FB en vivo no la guarda) |
| `hashtags`, `sponsored`, `resumen_sentimiento`, `tema` | no se envían | no se envían | `resumen_sentimiento` lo pone el cron `ig-sentiment-analysis`; `tema`/`pilar` de BD los pone `competencia-ig` |

Posts sin análisis del LLM se descartan (no se insertan). El upsert de n8n pisaba TODO con lo del día
(incluido `followers=0` y `engagement=null`); `updated_at` no se tocaba (no hay trigger).

## 3. Mapa — `competitor_web` (validado 56/56 filas ago–sep, 672 campos iguales)

Actor `radeance/similarweb-scraper`, input `{ urls: ["https://<dominio>", …] }`. Dominios: Drean `drean.com.ar`,
Electrolux `tienda.electrolux.com.ar`, Gafa `tienda.gafa.com.ar`, Philco `philco.com.ar`, Philco (Newsan)
`tiendanewsan.com.ar`, Whirlpool `whirlpool.com.ar`, **Samsung `shop.samsung.com`** (no está en el export).
`fecha` = día UTC de la corrida · `visitas_estimadas`=`totalVisits` · `bounce_rate`=`bounceRate` ·
`pages_per_visit`=`pagesPerVisit` · `avg_visit_duration`=`timeOnSite` · `paginas_top`=`monthlyVisitsDateFormat` ·
`paises_top`=`website_traffic_by_country` · `visitantes_unicos`/`fuentes_trafico`/`keywords_top` = null ·
`source`=`apify_similarweb` · `raw`=item completo.

## 4. Qué hace el código (reemplazo)

- **Instagram diario = Business Discovery** (`/api/cron/competencia-ig`, 10:37 UTC): posts, likes, comentarios,
  views, seguidores (→ `social_followers`), copy y miniatura; pilar con gpt-4o-mini para los posts nuevos; con
  `COMPETENCIA_SCRAPER_CODE=1` también trae la **cuenta propia** (n8n la scrapeaba).
- **`/api/cron/competencia-social`** (`lib/competencia-scraper{,-core}.ts`, workflow `competencia-social.yml`):
  - `part=fb` diario 07:05 UTC: posts-scraper de las 5 páginas (`COMPETENCIA_FB_LIMIT`, default 15 por página) +
    gpt-4o con el **prompt literal de n8n** solo para posts nuevos o sin pilar.
  - `part=ig` (Apify, solo comentarios/sentimiento/pin): `COMPETENCIA_IG_COMMENT_POSTS` (default 10) posts por marca
    de los últimos `COMPETENCIA_IG_DIAS` (14), los días `COMPETENCIA_IG_APIFY_DIAS` (default `1` = lunes; `*` diario).
  - `part=web` domingo 00:05 UTC: SimilarWeb → `competitor_web` (mapeo de la sección 3). Solo dominios con visitas.
  - `part=fbfol` domingo: seguidores de las Páginas de FB (`facebook-pages-scraper`) → `social_followers` (nuevo).
  - `?dry=1` devuelve las filas mapeadas sin escribir (funciona con el flag apagado); `?analizar=todos` clasifica
    también los posts de FB ya clasificados (para comparar pilar); `?limit=`, `?posts=`, `?dias=`, `?force=1`.
- **Mismo mapeo que n8n** (ports literales `tagInstagram`/`tagFacebook`/`mapToSocialRows`) pero **escritura sin
  pérdida** (`mergeSocialRow`, mismas reglas que `bd-paridad`): contadores solo suben, followers del post no se
  reemplaza, marca/fecha/pilar/copy/content_type existentes ganan, miniatura espejada se conserva, sentimiento y
  tipo nuevos ganan si vienen, nunca null sobre un valor, `updated_at` = ahora. La url existente (/p/ vs /reel/)
  se respeta → sin duplicados.
- **Apify sin cupo** (402, o 403/429 con "usage/limit/credit"): `ApifyQuotaError` → la corrida saltea las partes
  siguientes, devuelve `apifySinCupo` y el workflow deja un warning. `APIFY_MAX_CHARGE_USD` (default 2) +
  `maxItems` por corrida acotan el gasto.
- **Guarda:** sin `COMPETENCIA_SCRAPER_CODE=1` no escribe nada (responde `desactivado`).
- Monitoreo: `competencia_fb` (social_posts FB, 24 h) y `competencia_web` (competitor_web, 168 h) en `PROCS`.
- Env opcionales: `APIFY_ACTOR_IG`, `APIFY_ACTOR_FB`, `APIFY_ACTOR_FB_PAGE`, `APIFY_ACTOR_SIMILARWEB`,
  `COMPETENCIA_SCRAPER_MODEL` (default gpt-4o, el de n8n), `COMPETENCIA_FROM_DATE` (default 1-ene del año).

## 5. Diferencias conocidas (a propósito o no replicables)

1. **Métricas de posts viejos de IG:** n8n re-scrapeaba hasta 500 posts desde el 1-ene cada día; BD refresca los
   últimos 25 por marca (≈3–4 semanas). Posts más viejos quedan con su último valor (ya maduros). Backfill:
   `competencia-ig?mode=full` (100 posts).
2. **Sentimiento IG** se calcula 1x/semana (lunes) sobre los posts de las últimas 2 semanas, en vez de a las ~24 h
   del post: los comentarios están más maduros; hasta ese lunes el post nuevo queda sin sentimiento (como n8n
   cuando el post no tenía comentarios).
3. **FB:** 15 posts por página por día (n8n pedía 500) → los likes de posts de FB de más de ~2 semanas dejan de
   actualizarse. Subir `COMPETENCIA_FB_LIMIT` si hace falta.
4. **Ganancias** (n8n no las tenía): copy y miniatura de FB, marca de FB por Página pedida si el nombre no matchea,
   seguidores de FB semanales, fila propia de IG por BD, `updated_at` real.
5. **No replicado (no corre en vivo):** TikTok, `competitor_categoria_web` (SimilarWeb/DataForSEO por URL de
   categoría), `social_metrics`/`social_competitor` (planilla), el mail de Resend del flow viejo de Sheets.
6. **No verificable desde el sandbox:** el actor exacto de FB y sus nombres de campo (no hay `APIFY_API_TOKEN` acá) →
   el primer `?part=fb&dry=1` lo confirma (`sampleKeys` en la respuesta). Si `facebook-posts-scraper` no fuera el de
   n8n, cambiar `APIFY_ACTOR_FB` en Vercel.

## 6. Plan de corte

1. Merge + deploy con `COMPETENCIA_SCRAPER_CODE` **sin setear** (el workflow corre pero responde `desactivado`).
2. Dry-run + paridad (después de la corrida de n8n de las 07:10 UTC):
   ```bash
   curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP/api/cron/competencia-social?part=fb&dry=1&analizar=todos" > fb.json
   curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP/api/cron/competencia-social?part=ig&dry=1" > ig.json
   curl -s -H "Authorization: Bearer $CRON_SECRET" "$APP/api/cron/competencia-social?part=web&dry=1" > web.json
   cd apps/web && npx tsx scripts/n8n-paridad.ts fb.json ig.json web.json --detalle
   ```
   Esperado: 0 PÉRDIDAS; `distinto` solo en contadores (momentos distintos) y en pilar (LLM); faltantes = 0 o posts
   fuera de la ventana de 15 por página.
3. Setear `COMPETENCIA_SCRAPER_CODE=1` en Vercel (Production) + redeploy.
4. 1–2 días en paralelo (n8n 07:00, código 07:05; ambos por url, sin duplicados). Re-correr la paridad y mirar
   `/monitoreo` (competencia_fb / competencia_web).
5. Desactivar en n8n.cloud los workflows "Social Scraper — Apify + GPT → Supabase" y "Competitor Web Traffic Sync".
   Rollback: volver a activarlos y borrar `COMPETENCIA_SCRAPER_CODE`.

Tests: `cd apps/web && npx tsx scripts/competencia-scraper.test.ts` (mapeo IG/FB/web, merge sin pérdida, cupo, cadencia).
