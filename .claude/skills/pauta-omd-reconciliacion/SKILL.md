---
name: pauta-omd-reconciliacion
description: >-
  Runbook para reconciliar la inversión del dashboard de Pauta Mkt (/performance) contra la
  planilla y los reportes mensuales de OMD, y para cargar/corregir los medios que NO vienen por API.
  Usalo cuando el usuario mande un reporte OMD / Control Digital / planilla de medios, pida comparar
  el dash vs OMD, cargar o cuadrar un mes, o revisar por qué la inversión no coincide. Contiene qué
  medio es API vs carga manual, la regla de gap-fill, los fx por mes, OOH fijo, y la verificación
  mes a mes. Para las escrituras a la DB, apoyate en la skill supabase-carga-segura.
---

# Pauta Mkt — reconciliación e ingesta OMD

Objetivo: que **todas las tablas del dash sumen la misma inversión** y que cuadre contra la planilla
OMD (solo inversión en medios; sin fee/comisiones/impuestos).

## Fuente de verdad POR MEDIO (clave)
- **API (siempre gana la API, nunca OMD):**
  - **Meta** → `meta_paid_creatives` (`API_MEDIOS = new Set(["Meta"])` en `performance-client.tsx`:
    Meta se excluye de las agregaciones OMD y entra por gap-fill de la API).
  - **YouTube + Programmatic** → `dv360_creatives` (por `canal`; `revenue_usd × fx` del mes).
  - **Google Search + Demand Gen** → `google_ads_creatives` (campaign_type SEARCH/DEMAND_GEN).
    **Performance Max se EXCLUYE** de Pauta Mkt (va en /performance-conversion).
- **Carga manual en `pauta_performance`** (reportes OMD / Control Digital): medios SIN API →
  **TikTok, Mercado Ads (=Mercado Libre), Geo Mobile (="Medios directos"/Tap Tap)**, y offline
  (**OOH, TV, DOOH, Radio**). Categorías válidas: Brand/Cocción/Lavado/Refrigeración/UGC/Promoción.
  Objetivos: Awareness/Consideración/Build. `tipo_compra` NOT NULL.

## Regla de gap-fill
OMD (todos los objetivos) por medio + ejecución real de API/DV360/Google SOLO para los medios **sin
plan OMD ese mes**. Un medio cuenta como "presente" en el modelo si tiene `impresiones>0` en
`pauta_performance`. OJO: si cargás un medio manual con inversión pero impresiones en 0, puede
quedar fuera del "presente" y gap-fillearse dos veces — cargá también su performance.

## fx ARS/USD por mes (para DV360)
Abril 1390 · Mayo 1402 · Junio 1481,5 · Julio 1488 · Agosto 1512. (Confirmar contra `fx_rates` si
hay un mes nuevo.)

## OOH = dato fijo
OOH gran formato **no cambia**: es el mismo valor mensual (ej. $10M jun / $35,5M jul). **No lo
toques** al recargar otros medios.

## Diferencia OMD (planilla) vs dash
- **Meta y manuales suelen matchear al peso.** Cuando el dash da MENOS que OMD, casi siempre es
  **data faltante de API/DV360 de un mes**, no error de cálculo. Validá:
  - **DV360**: subcuenta meses viejos (el reporte "DV360 Video Drean" entrega el mes parcial). Bajá
    el export ad-hoc del **mes completo** de displayvideo.google.com y recargá `dv360_creatives`
    (delete mes + insert, ver `docs/dv360-sync.md`). Verificá con `updated_at`+volumen por mes.
  - **Google**: si un mes está vacío en `google_ads_creatives`, re-disparar `google-ads-sync.yml`
    con `days≥120` (workflow_dispatch, aditivo).
- **NO cargues DV360/Google a mano en `pauta_performance`** (rompe la regla "medio con API →
  volumen de la API").

## Cargar un mes desde el reporte OMD (proceso)
1. Extraé el reporte con MarkItDown (o leelo) y armá la matriz por medio × categoría.
2. Identificá qué medios son manuales (los de arriba) — los API/DV360 no se cargan acá.
3. Mostrá la **tabla de carga** al usuario ANTES de escribir (skill `supabase-carga-segura`).
4. Cargá inversión + performance (impresiones/alcance/frecuencia/clics/views). Mercado/Geo: si el
   reporte no abre por categoría, repartí proporcional a la inversión.
5. Verificá el total del mes y compará contra la planilla OMD.

## Verificá TODOS los meses, no de a uno
Si el usuario dice "un mes no da", chequeá los demás en la misma pasada — el error suele ser
sistémico (fuente/gap-fill), no de un mes puntual.
