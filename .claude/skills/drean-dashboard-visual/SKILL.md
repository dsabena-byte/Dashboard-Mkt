---
name: drean-dashboard-visual
description: >-
  Sistema visual, metas y TONO para construir, extender o replicar dashboards de Drean, y para armar
  mockups/artifacts que se muestran a la empresa. Usalo al agregar metas a un dashboard, crear o
  replicar un tablero, o hacer un mockup HTML. Fuerza el checklist obligatorio de "Metas por KPI +
  sistema visual" (cablear la meta a los cards y al gráfico, no solo poner el MetaPanel), la paleta
  sobria (datos azul, meta gris pizarra, semáforo solo para estado), y la regla de mockups: replicar
  el estilo REAL del dash, con lenguaje técnico y riguroso, SIN relleno marketinero.
---

# Drean — sistema visual, metas y tono

## Metas por KPI — checklist obligatorio (error recurrente)
Agregar metas NO es solo poner el `MetaPanel`. Si no cableás la meta al gráfico y a los cards, el
usuario guarda y no cambia nada. Validá TODO esto antes de decir que "las metas están listas":
1. **Leé las metas server-side** en el `page.tsx` con `getMetaKpi(plan, kpi, anio)` de
   `lib/metas-server.ts` (trae valores mensuales `[12]` + dirección/umbrales/unidad). `plan` = nombre
   del menú/catálogo (ej "Web / Ecommerce", "Facebook"; FB va separado de IG).
2. **Cards con `MetaKpiCard`**: headline = último mes con dato (no el calendario) + filas **Mes** y
   **Acum. YTD**, cada una con semáforo + barra de avance.
3. **Gráfico con meta**: barras reales + barra de meta gris pizarra (`IgAlcanceChart`) y/o líneas
   real+meta (`SocialEngagementChart`). Etiquetas numéricas en las series reales. Ejes de ancho fijo
   (56px) para alinear meses entre gráficos apilados.
4. **Paleta SOBRIA:** datos reales = **azul `#1e40af`**; meta = **gris pizarra `#cbd5e1`/`#64748b`**;
   líneas = tinta `#0f172a`. El verde/amarillo/rojo (`SEMAFORO_COLOR`) es **SOLO** semáforo/estado,
   nunca decorativo ni color de meta. Interacciones apiladas = rampa azul monocromática.
5. El guardado del `MetaPanel` ya hace `router.refresh()`. El `MetaPanel` arranca colapsado.

Referencia canónica: `IgOrganicSection` + `FbOrganicSection`. Replicá SIEMPRE ese sistema.

## Convenciones que importan
- Cada `page.tsx` con data: `export const dynamic = "force-dynamic"` **y**
  `export const fetchCache = "force-no-store"` (si no, Next cachea los fetch y los paneles salen
  vacíos).
- Frontera server/client: un `"use client"` solo puede importar de módulos `server-only` cosas de
  **tipo** (`import type`). Constantes/funciones puras compartidas van en un módulo client-safe.
  Validá con `pnpm build`, no solo `tsc`.

## Mockups / réplicas para mostrar (tono)
Cuando armes un mockup HTML para mostrar a la empresa:
- **Replicá el estilo REAL del dashboard** (relevá el código/screenshot: fondo blanco, pills navy,
  tablas con desvío ▲verde/▼rojo, proyección en azul ≈, cards del sistema de IG). No inventes un
  estilo propio "sobrio genérico".
- **Tono técnico y riguroso, sin venta.** Nada de frases cancheras ("el vacío entre olas"), ni
  relleno "marketinero", ni claims. El usuario lo valora como documento técnico: contundente a nivel
  metodológico, secuencial de lo general a lo particular, **estadísticamente riguroso** (si hay un
  modelo, mostrá β, error estándar, t, p, R², n — no solo el R²).
- Mostrá la data histórica real cargada; no números ilustrativos si existe el dato real.
- Los artifacts arrancan privados: avisá que para mostrarlos a terceros hay que compartirlos.

## Datos → charts
Antes de dibujar, cargá los valores reales (query Supabase). Un scatter/serie con puntos reales +
recta/ajuste + su métrica de bondad vale mil veces más que uno "ilustrativo".
