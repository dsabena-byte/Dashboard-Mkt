# Roadmap próximas fases

## Fase 2 — Ingesta de datos (N8N)

**Objetivo**: que el dashboard muestre data real, no placeholders.

- [ ] Workflow N8N: Google Ads → `ads_performance` (daily, últimos 7 días)
- [ ] Workflow N8N: Meta Ads → `ads_performance` (daily)
- [ ] Workflow N8N: GA4 → `web_traffic` (daily)
- [ ] Workflow N8N: Google Sheets (planning) → `planning` (al modificar la hoja)
- [ ] Workflow N8N: Google Sheets (scraping RRSS existente) → `social_metrics` + `social_competitor`
- [ ] Normalización UTM en cada workflow usando `normalizeUtmValue`
- [ ] Logging de errores de ingesta a una tabla `ingestion_log`
- [ ] Exportar cada workflow como JSON a `n8n-workflows/`

**Decisión pendiente**: ¿hosteamos N8N en cloud propio o usamos n8n.cloud?
Si ya tenés instancia self-hosted, usamos esa.

## Fase 3 — Scraping de competencia (Apify)

- [ ] Definir lista de competidores (3-5 a trackear)
- [ ] Configurar actor Apify de SimilarWeb (o similar)
- [ ] Workflow N8N: Apify → `competitor_web` (semanal)
- [ ] Página `/competitors` con charts comparativos

## Fase 4 — Frontend con datos reales

- [ ] Reemplazar placeholders en `/overview` con queries reales a Supabase
- [ ] Charts en `/funnel` con Recharts (funnel chart + tendencia diaria)
- [ ] Tabla en `/campaigns` con filtros por plataforma y rango de fechas
- [ ] `/planning` con tabla pivot: filas = campañas, columnas = días, valor = % cumplimiento
- [ ] Filtros globales (rango de fechas, canal) en URL params
- [ ] React Query para caching cliente

## Fase 5 — Alertas

- [ ] CRUD de `alerts_config` en `/alerts`
- [ ] Cron job (Vercel cron o N8N) que evalúa reglas y popula `alerts_log`
- [ ] Notificaciones: email (Resend), Slack webhook, in-app badge
- [ ] Página `/alerts` con tabs: Reglas | Historial

## Fase 6 — Auth y despliegue productivo

- [ ] Supabase Auth con magic link
- [ ] RLS policies (lectura: usuarios autenticados; escritura: solo service role)
- [ ] Despliegue a Vercel con env vars
- [ ] Dominio custom

## Fase 7 — Mejoras

- [ ] Materialización de vistas si la performance lo pide
- [ ] Export a CSV/Excel desde cada tabla del dashboard
- [ ] Comparación período a período (MoM, YoY)
- [ ] Atribución multi-touch básica (last-click → first-click → linear)

## Decisiones que tenemos que tomar antes de fase 2

1. **N8N**: ¿self-hosted o cloud? URL de acceso, credenciales.
2. **Competidores**: lista concreta (mínimo 3 dominios).
3. **Canales offline**: cuáles vas a cargar (TV, radio, vía pública, otros).
4. **Marca**: nombre real, paleta de colores, logo para personalizar el frontend.
5. **APIs de Google/Meta**: ¿tenés acceso vía API o exportás CSV de Looker/Ads Manager?
