-- 0116 · Temas de contenido de la competencia (/redes) — sep-2026. Idempotente.
-- `tema` = etiqueta corta (1-3 palabras) que asigna gpt-4o-mini en /api/cron/competencia-ig (parte
-- temas, lotes de 60, reusando los temas ya usados = clustering guiado). Sin esta columna el cron salta
-- la parte de temas y el tablero no muestra "Temas por marca" (todo lo demás sigue igual).
-- NOTA: el split orgánico/pago de FB (post_media_view × is_from_ads) y la navegación de Stories se
-- guardan en meta_posts.raw (jsonb ya existente) → no requieren columnas nuevas.
alter table public.social_posts add column if not exists tema text;
alter table public.social_posts add column if not exists tema_at timestamptz;
create index if not exists idx_social_posts_tema_null on public.social_posts (fecha desc) where tema is null;
