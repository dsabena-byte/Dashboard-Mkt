# BIP · Mapa de replicación de Drean → BIP (funcionalidad completa + gaps + potenciales)

> Objetivo: BIP replica el **100% de la funcionalidad de los dashboards de Drean** (decisión del user),
> **excluyendo generación/publicación de contenido** (`/contenido`, calendario, `meta-publish`) y
> **Mercado/GfK** (sacado del modelo de planes a propósito). Relevado archivo por archivo (dic-2026)
> en Drean (`apps/web/src/app/`) y BIP (`bip-platform/app/(app)/`). No re-litigar sin leer esto.
> Detalle del sentimiento de comentarios (Meta) + App Review: `docs/meta-app-review-plan.md`.

## A. Inventario Drean (17 dashboards + copiloto) — fuente nav `apps/web/src/components/sidebar.tsx`
1. **/mapa-estrategico** — editor objetivos→KPIs→pesos + mix por categoría (fuente de verdad del modelo). Tabla `mapa_estrategico`.
2. **/overview** (Seguimiento Objetivos) — cumplimiento real vs meta por objetivo/KPI, General + 3 categorías (Lav/Refri/Cocc), desvío mes/YTD. Agrega TODAS las fuentes.
3. **/performance** (Plan de Medios) — pauta: inversión/alcance/impr/frec/clicks/VTR real vs meta, por medio y categoría. Meta API + DV360 + Google Ads + OMD manual + planning.
4. **/performance-conversion** — pauta→conversión ecommerce (GA4): transacciones/ingresos/CPA/ROAS, PMax/shopping.
5. **/redes** (Redes Sociales) — IG+FB orgánico (alcance/engagement/followers/video), competitivo, **sentimiento UGC**, top posts, metas.
6. **/influencia** (Mkt de Influencia) — influencers/UGC: inversión vs plan, alcance, CTR, CPM + **análisis cualitativo UGC (sentimiento de comentarios)**.
7. **/mkt-canal** — acciones digitales en retailers (iframe estático, datos `mkt_canal_acciones`).
8. **/web** (Web/Ecommerce) — GA4: sesiones/usuarios/conv/bounce/canales/categoría + demografía + top productos + competitivo web + trends.
9. **/seo-search** (Optimización SEO) — Share of Search, Google Trends, SERP, índice SEO, LLMO (DataForSEO).
10. **/cuadros-basicos** (Trade) — % cumplimiento CB por tienda/semana + sugerencias (proyecto CB → mirror).
11. **/floor-share** (Trade) — % exhibición Drean vs piso, por categoría/marca vs objetivos.
12. **/mercado** (Resultados Comerciales) — GfK value/unit share + índice de precio. **[EXCLUIDO del modelo BIP]**.
13. **/salud-marca** — Kantar: TOM/SOM/Intención/Poder + score SM por categoría/ola.
14. **/funnel** (Inversión de Marketing) — ejecución de presupuesto (cuatrimestres Real vs BGT) + comparador A/B. Tabla `bgt_marketing` (SharePoint).
15. **/monitoreo** — frescura de los procesos de sync (semáforo) + watchdog.
16. **/alerts** — **placeholder** (sin construir en Drean).
17. **/campaigns** — **placeholder** (sin construir en Drean).
+ **Copiloto IA / chat de datos** — transversal, cubre 12 dashboards (ver §E).

## B. Inventario BIP hoy — fuente nav `bip-platform/lib/plan.ts`
**Dashboards nativos reales (5):** `/mapa-estrategico`, `/overview` (**sin capa de categorías**), `/performance` (**solo Meta Ads** + Google Ads gated), `/redes` (IG+FB orgánico), `/web` (GA4).
**Por builder (planilla del cliente, NO nativos):** `/tablero/inversion`, `/tablero/resultados`, `/tablero/trade`.
**Placeholder "en construcción" (`soon:true`):** `/influencia`, `/seo-search`.
**Plataforma (no existen en Drean):** `/dashboard` (home), `/consultor` (CRM interno staff), `/cuenta/*` (billing MP, conexiones Nango, add-ons, equipo).

## C. GAP de replicación (Drean tiene / BIP no) — sin contenido ni GfK
| Feature | Estado BIP | Fuente que necesita | Complejidad |
|---|---|---|---|
| **Copiloto IA / chat de datos** | **No existe** (0 archivos) | OpenAI + envolver queries de cada dash | **Grande** (transversal, prometido en todos los planes) |
| **Alertas + reportes automáticos** (email/WhatsApp) | No existe (Drean solo placeholder) | motor propio + envío | **Grande** (feature nueva, sin base) |
| **Mkt de Influencia / UGC + sentimiento** | Placeholder `soon` | Meta paid UGC + LLM (reusa Meta ya conectado) | **Medio** (ver meta-app-review-plan) |
| **Optimización SEO / Share of Search** | Placeholder `soon` | DataForSEO | **Medio-grande** |
| **Performance → Conversión** | No existe | GA4 + pauta conversión (PMax) | **Medio** |
| **Salud de Marca (Kantar)** | No existe | carga manual tipo Kantar | **Medio** |
| **Seguimiento por categoría** (Lav/Refri/Cocc) | overview "sin categorías" | mix del Mapa + shares | **Medio** |
| **Capa de Competencia** (redes/web/SEO) | gating sí, **data no** | SimilarWeb + scraping/API + DataForSEO | **Grande** (diferencial de Optimize) |
| **Trade nativo** (CB + Floor Share) | hoy por builder genérico | datos CB/Floor (no-API) | **Grande** (fuente compleja) |
| **Inversión nativa (funnel BGT)** | hoy por builder | BGT (SharePoint) | **Medio-grande** |
| **Resultados Comerciales** | por builder | facturación del cliente | **Chico-medio** (builder OK para MVP) |
| **Dash de Monitoreo** (frescura/watchdog) | parcial (`sync-runs` sí, vista no) | `getHealth` sobre `sync_runs` | **Chico-medio** |
| **mkt-canal** (retailers) | no existe | `mkt_canal_acciones` | **Medio** |

## D. Funciones potenciales NUEVAS (no existen en ninguno de los dos)
1. **Motor de Alertas + reportes automáticos con IA** (email/WhatsApp) — prometido, inexistente. **Grande.**
2. **CRM / nurturing de leads** — existe solo en BIP (`/consultor`); scoring/nurturing saliente pendiente. Nuevo vs Drean.
3. **Contenido guía por KPI/objetivo** (plataforma de conocimiento/expertise ROQUÉ). **Medio.**
4. **Historia multi-año por tier** cableada a los rangos de fetch (`historyStartYear` definido, sin conectar). **Chico-medio.**
5. **Benchmark competitivo self-serve** (el cliente configura competidores → data automática; `competitors` ya se capturan en `tenant_profile`). **Grande.**
6. **Campañas detalladas por plataforma** (drill-down, `ads_performance`). **Medio.**
7. **Alertas de anomalías con IA sobre series** (no solo umbral vs meta). **Medio.**

## E. Copiloto IA (el gap más grande y transversal)
- **Drean:** motor genérico `api/chat/route.ts` (OpenAI gpt-4o-mini, function-calling, devuelve `{text, charts}`), registro por dashboard `lib/chat/registry.ts`, montaje por URL `components/global-data-chat.tsx`. Cubre **12 dashboards** (`tools-*.ts`). Extender = escribir `tools-<dash>.ts` + registrar; el motor no se toca.
- **BIP: NO lo tiene** (0 archivos). Prometido en todos los planes. Portarlo = motor + un `tools-*` por cada dash de BIP.

## F. Builder de tableros custom (BIP) — NO confundir con replicación nativa
El cliente **sube su planilla y mapea columnas → gráficos** (`lib/sheet-engine.ts`, `components/dash-builder/*`, rutas `/tablero/[slug]`). Hoy resuelve **Inversión / Resultados / Trade** como tableros armados por el cliente, **no** como réplicas nativas de Drean. Paridad nativa (ej. Floor Share con ranking/objetivos, funnel BGT cuatrimestral) es trabajo aparte (ver §C).

## G. Cruce con el App Review de Meta (qué features hay que tener visibles)
Los permisos de Meta se demuestran con features visibles (ver `docs/meta-app-review-plan.md`):
- **Orgánico (Redes)** → `pages_show_list, pages_read_engagement, read_insights, instagram_basic, instagram_manage_insights, business_management` — **ya visibles en /redes de BIP**.
- **Pauta (Plan de Medios)** → `ads_read` — **ya visible en /performance de BIP**.
- **Sentimiento de comentarios (IG+FB)** → `instagram_manage_comments` + `pages_read_user_content` — **falta construir**: portar `/influencia` (UGC) o una vista de comentarios+sentimiento a BIP, con lectura de **texto** por Graph API con el token del tenant. **Además falta agregar esos 2 scopes en la integración Meta de Nango** (hoy solo están los 7 de lectura). Correción: el sentimiento de comentarios en Drean vive en **/influencia** (no /contenido).

## Resumen ejecutivo
- **BIP replica hoy 5 dashboards** (Mapa, Seguimiento sin categorías, Plan de Medios solo-Meta, Redes, Web).
- **Prioritario y prometido en todos los planes pero inexistente:** Copiloto IA + Alertas/reportes.
- **Para el App Review de Meta** hace falta la vista de **sentimiento de comentarios** (Influencia/UGC) portada a BIP + los 2 scopes en Nango.
- **Excluidos:** todo `/contenido` (generación) y Mercado/GfK.
