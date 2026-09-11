# Sistema de Alertas — Plan de Medios (Pauta) · best practice

> Objetivo: pasar del insight **estático** a **alertas de desvío en tiempo real** que se
> le mandan al cliente. Detecta plata que se está quemando o campañas que no performan,
> **según el formato y el objetivo de cada pieza** — no con umbrales planos. Diseñado para
> replicarse en BIP (multi-cliente): los umbrales **auto-escalan** por cliente.

## Principio rector (leer primero)
1. **La alerta no es "VTR < X".** Es: *¿cada pieza entrega lo que su FORMATO + OBJETIVO
   deberían entregar, a un costo por RESULTADO REAL eficiente?*
2. **El benchmark apunta a lo mejor, no al promedio.** Umbral objetivo =
   **`max( estándar de industria del formato , p75 de las MEJORES piezas del cliente en ese bucket )`**.
   Sube solo cuando mejorás; nunca se conforma con lo malo. (Si la mayoría de las campañas
   vino mal, el promedio es malo y no puede ser la vara.)
3. **Las líneas CRÍTICAS usan la física del formato**, no un percentil: un formato *forzado*
   (bumper/non-skippable) DEBE completar ~100%; si completa 5%, es crítico (perdiste ~95%),
   aunque "el promedio" ande peor.
4. **Todo se computa desde la data que existe** (spend, días activos, embudo de video, skips).
   No se usa ningún "presupuesto mensual" que no tenemos cargado de forma confiable.

## Fuentes de datos (tablas + campos reales)
- `pauta_performance` (plan OMD por medio/categoría/objetivo/mes): alcance(+plan), frecuencia(+plan),
  impresiones(+plan), clics(+plan), views(+plan), inversion(+plan), ctr(+plan), tipo_compra.
- `meta_paid_creatives` (por pieza; `plataforma` = meta/programmatic/youtube/tiktok):
  spend, impresiones, alcance, frecuencia, clicks, ctr, cpm, cpc, views_total, views_completed,
  video_p25..p100, **video_thruplay**, vtr_p25..p100, dias_activos, objective, rol, tipo_compra.
- `dv360_creatives` (`canal` = YouTube/Programmatic/Marketplace): impresiones, clicks,
  **starts, q25, q50, q75, q100, skips**, revenue_usd. → embudo de video + skips = **formato inferible**.
- `google_ads_creatives` (`campaign_type` = SEARCH / DEMAND_GEN): impressions, clicks, cost,
  video_views, video_view_rate, vtr_p25..p100. (Google Ads NO tiene YouTube — eso va por DV360.)

## Paso 1 — Clasificación automática de cada pieza
- **Etapa / objetivo**: Awareness/Reach · Video/Consideración · Tráfico · Conversión
  (de `objective`/`rol`/`tipo_compra`).
- **Formato de video inferido** (de la propia data, sin campo de formato):
  - **Forzado** (bumper / non-skippable): `skips/(starts+skips) ≈ 0` **y** `q100/starts ≥ 90%`.
  - **Skippable**: `skips/(starts+skips) > 5%`.
  - **Feed/social (Meta)**: sin skips expuestos → se usa **ThruPlay** + la curva `p25→p100`.

## Paso 2 — KPI correcto por bucket + benchmark

### VIDEO — métrica madre = **CPCV (costo por vista COMPLETA)**
Traduce "gasté $10MM y se vio el 8%" en plata perdida. NO usar VTR crudo como corte.
- **Completación esperada según formato:**
  - *Forzado* (skip≈0): completación **≥ 90%**. 🔴 **crítico si < 85%** → formato roto / mal
    taggeado / tráfico inválido. (Evidencia real: piezas de YouTube con **skip 0% y completación
    4-5%**, con **CPCV 10× peor** — $0,009-0,011 vs $0,001 de las que completan 97-98%.)
  - *Skippable* (skip>5%): completación 55-70% es normal. El KPI real es **CPCV** + la **curva**.
- **Curva de retención / hook**: `q25/starts` (o `p25` en Meta). Caída fuerte antes del 25% =
  hook débil (ej. TikTok con 93,9% de abandono antes del 25%). 🟡 alerta si `q25/starts` bajo p10
  del bucket.
- **Alerta CPCV**: 🟠 CPCV de la pieza **> 3× la mediana de CPCV de su MISMO bucket
  (formato+medio+mes)**; 🔴 **> 8×**. Auto-escala, sin presupuesto.

### META video → **costo por ThruPlay** + retención p25→p100
Meta no expone placement limpio → formato se aproxima por objetivo + curva.
- Referencia real Meta: ThruPlay rate mediana 2% / p75 13,6% / máx 98% → **target ≥ 15%**,
  🟠 < 8%, 🔴 < 3%. (El VTR@50/@100 de Meta viene incompleto → para Meta usar ThruPlay.)

### AWARENESS / REACH (compra CPM)
- KPIs: **CPM** (eficiencia) + **alcance vs plan** + **frecuencia** (saturación = plata en la
  misma gente).
- Referencia real Meta: CPM mejor $262 (p25) / mediana $932 / p95 $2,05M-equiv alto → **target ≤
  $300**, 🟠 > $500, 🔀 > $1.000. (CPM por medio: Meta ~$750, TikTok ~$325, YouTube ~$1.256 —
  el umbral va por medio.)
- **Frecuencia**: 🟡 > 4 (saturación) · 🟠 > 6. (Real: mediana 1,6, máx 9,0.)
- **Alcance**: 🟠 < 80% del plan.

### TRÁFICO (compra CPC)
- KPIs: **CTR** + **CPC** (+ calidad de landing si se cruza con GA4: bounce/tiempo).
- CTR por medio (la clave — varían 30-60×): Search ~3%, Demand Gen ~6,5%, Mercado Ads ~1,4%,
  social/awareness 0,1-0,4%. → **target por medio**; para tráfico digital real **≥ 1%**,
  🟠 < 0,6%, 🔴 < 0,3%.
- CPC: 🟠 > 1,5× la mediana del medio/mes.

### CONVERSIÓN (ecommerce / build)
- KPIs: **CPA** / **ROAS** / tasa de conversión. 🔴 ROAS < meta; 🟠 CPA > 1,5× promedio.
  (Vive en `/performance-conversion` con `pauta-conversion-queries`.)

## Paso 3 — Presupuesto / pieza anómala (ya validado con la data)
1. 🔴 **Ritmo de gasto acelerado (pacing)** — gasto acumulado del mes > (inversión plan del medio
   × días transcurridos/días del mes) × 1,3.  *(usa inversion_plan de OMD donde exista)*
2. 🔴 **Burst anómalo de una pieza** — la pieza es **> 8% del gasto REAL del medio ese mes** (p95)
   **Y** estuvo activa **≤ 5 días**. (Detecta el $11,9M en 3 días; no molesta al 22%/27días.)
   *Share y días salen de la misma tabla de piezas — sin presupuesto.*
3. 🔴 **Burn rate desmedido** — **$/día de la pieza > 8× la mediana** de $/día de las piezas del
   medio ese mes. (Real: peor $3,97M/día vs mediana ~$10K.)
4. 🔴 **Gasto sin resultados** — invirtió > umbral pero clics ≈ views ≈ alcance ≈ 0 (mal config).
5. 🟠 **Sobre-ejecución** > plan × 1,05 · 🟡 **Sub-ejecución** < plan × 0,70 (mes cerrado).

## Paso 4 — Transversal
- 🟠 **Campaña bajo lo mejor** — el KPI madre de su bucket < el target (max industria / p75 propio).
- 🟡 **Desvío fuerte vs plan** — cualquier KPI real se aleja > 30% del plan en la dirección mala.

## Valores de referencia REALES (de la data de Drean, para anclar)
| Métrica | Contexto | Mejor | Mediana | Peor |
|---|---|---|---|---|
| CPCV YouTube | forzado vs skippable | $0,001 | ~$0,002 | $0,011 (compl 4-5%) |
| Completación YT | forzado / skippable | 97-98% / 60-70% | 69% | 4-5% (🔴) |
| ThruPlay Meta | rate | 98% | 2% (p75 13,6%) | 0% |
| CPM Meta | $/1000 impr | $262 | $932 | $3.263 |
| CTR | por medio | Search 3% / DG 6,5% | social 0,1% | 0% |
| Gasto por pieza Meta | | — | $0,23M | $11,9M |
| Burn rate pieza | $/día | — | ~$10K | $3,97M/día |
| Share pieza del mes | | — | 0,6% (p95 7,8%) | 22,4% |

## Motor (a construir)
- **Evaluación**: un cron (cada X h) corre las reglas sobre la data más fresca → produce la lista
  de alertas activas {pieza/medio, regla, severidad, valores, mensaje}.
- **Superficie**: panel de **Alertas** en `/performance` (reemplaza el insight estático) + guarda
  histórico.
- **Envío al cliente**: digest de alertas por **WhatsApp** (Evolution API, ver
  `docs/whatsapp-evolution-railway.md`) y/o email.
- **Config por cliente/medio**: los targets (industria + p75 propio) y los múltiplos (3×/8×, 1,3
  pacing, 8% share, ≤5 días) quedan como parámetros → auto-calibran en BIP.

## Replicación a BIP
El motor es agnóstico de origen: en Drean lee `pauta_performance` + `*_creatives`; en BIP lee las
conexiones del cliente (Meta/DV360/Google por Nango). Las reglas, buckets y el principio de
benchmark (max industria / p75 propio) son los mismos → auto-escalan por cliente sin tocar código.
