# Sistema de insights automáticos

Análisis programático del orgánico Drean (y eventualmente pauta, web, floor
share, cb) que detecta señales de alerta/oportunidad y genera recomendaciones
accionables. Las señales quedan persistidas en `insights_log` y se renderizan
en un panel por dashboard.

## Estado actual

| Categoría | Estado | Cron | Render |
|---|---|---|---|
| `organico_drean` | ✅ Fase A (reglas, sin LLM) | `/api/cron/organic-insights` 1x/día | `/redes` panel arriba |
| `pauta` | ⏳ pendiente | — | — |
| `web` | ⏳ pendiente | — | — |
| `floor_share` | ⏳ pendiente | — | — |
| `cb` | ⏳ pendiente | — | — |

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│ GitHub Actions (1x/día 07:00 UTC)               │
│ .github/workflows/organic-insights.yml          │
└──────────────┬──────────────────────────────────┘
               │ curl GET con CRON_SECRET
               ▼
┌─────────────────────────────────────────────────┐
│ Next.js endpoint                                │
│ /api/cron/organic-insights/route.ts             │
│  1. Fetch meta_posts últimos 60d                │
│  2. Split en current (30d) + previous (30d)     │
│  3. computeOrganicInsights() — lib              │
│  4. Upsert a insights_log                       │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ Supabase: insights_log                          │
│ UNIQUE (categoria, signal_key) → idempotente    │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│ /redes page (server component)                  │
│  getInsightsByCategoria('organico_drean', 12)   │
│  → <InsightsPanel insights={...} />             │
└─────────────────────────────────────────────────┘
```

## Reglas de detección (Fase A — heurísticas)

Implementadas en `apps/web/src/lib/organic-insights.ts`. Cada regla compara el
período actual (últimos 30d) vs el anterior (30-60d atrás) por
`platform × media_kind`, donde `media_kind ∈ {feed, reel, story}`.

| Regla | Cuándo dispara | Prioridad |
|---|---|---|
| `reach_per_post_drop` | Alcance per-post cae > 15% | media (>30% → alta) |
| `eng_rate_drop` | Engagement rate cae > 15% | media (>30% → alta) |
| `reach_opportunity` | Alcance per-post sube > 25% | media (>50% → alta) |
| `volume_change` | # posts cambia > 50% | baja (informativo) |
| `top_post_30d` | Mejor post del período actual | media |
| `bottom_post_30d` | Peor post (con reach >= 1000) | baja |

Cada señal devuelve `{titulo, descripcion, acciones[], datos}`. Las **acciones**
son strings con recomendaciones concretas — ej:
- "Revisar formato/hook de los top reels de 30d previos y replicar"
- "Doblar apuesta en este formato"
- "Validar si el horario de publicación cambió"

## Idempotencia

Cada señal tiene un `signal_key` estable (ej. `instagram_reel_reach_per_post_drop`).
El upsert por `(categoria, signal_key)` significa que si la misma señal vuelve a
emitirse al día siguiente:

- Se actualiza la fila con el delta del día corriente
- `fecha_generado` se actualiza
- `estado` vuelve a `nuevo` (incluso si el usuario lo había marcado como `visto`)

Si una señal **deja de emitirse** (porque mejoró), la fila vieja queda en
`insights_log` pero el panel solo muestra las que están en `estado != 'cerrado'`.
TODO: agregar un "soft delete" automático de señales que no se emitieron en N días.

## Tabla `insights_log` — esquema

Ver `supabase/migrations/0040_insights_log.sql`.

```sql
create table insights_log (
  id             uuid primary key,
  fecha_generado timestamptz,
  categoria      text,           -- 'organico_drean' | 'pauta' | ...
  signal_key     text,
  prioridad      text,           -- 'alta' | 'media' | 'baja'
  tipo           text,           -- 'alerta' | 'oportunidad' | 'info'
  titulo         text,
  descripcion    text,
  acciones       jsonb,          -- array de strings
  datos          jsonb,
  estado         text,           -- 'nuevo' | 'visto' | 'cerrado'
  updated_at     timestamptz,
  unique (categoria, signal_key)
);
```

## Disparar manualmente

GitHub → Actions → **"Organic insights (1x/día)"** → Run workflow.

Tarda ~5-10 segundos. El resultado queda en `insights_log` y aparece en
`/redes` al refrescar.

## Verificar que está corriendo

```sql
select categoria, count(*) as señales,
       max(fecha_generado) as ultima_corrida
from insights_log
group by categoria;
```

Si `ultima_corrida` es de hace > 2 días → algo se rompió en el cron (revisar GH
Actions).

## Próximos pasos

### Fase B — LLM-augmented

Reemplazar las descripciones y acciones por texto generado por GPT-4o-mini.
La regla seguiría detectando la señal, pero el LLM:

1. Le da contexto de mercado / industria
2. Genera acciones más específicas basadas en el delta exacto
3. Conecta señales relacionadas (ej. "el reach cayó Y%, pero también
   posteaste más feed que reels — probá invertir el mix")

Costo estimado: ~$0.02 por corrida × 365 días = $7/año.

### Fase C — Notificaciones

Email semanal con un resumen de las top 5 señales de alta prioridad de la
semana. Usaría Resend o similar.

### Fase D — Otras categorías

- `pauta`: alertas de CPM/CPC anómalo, bajo cumplimiento de plan
- `web`: caídas/picos de canal, conversion rate
- `floor_share`: tiendas con caídas grandes, marcas que ganan terreno
- `cb`: cumplimiento por cliente vs objetivo, cadenas que caen consistentemente
