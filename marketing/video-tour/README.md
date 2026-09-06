# BIP · Recorrido de la plataforma (video tour)

Video de **~117 s** que muestra cómo se ve la plataforma dashboard por dashboard, **sin exponer
la marca Drean ni data real/sensible**. Marca ficticia **"Novara"** + competidores inventados
(Vanté, Kova, Areté, Belmar, Aurex); todos los números son **ilustrativos** (pill "Datos
ilustrativos" en el topbar). Rebrand BIP (navy `#0a4da0` + cyan `#12a6f4`, Poppins + Inter).

**Réplica FIEL del sistema visual real** de cada dashboard: se relevó el código real de cada
`page.tsx`/componente y se replicaron los mismos cards, tablas y gráficos (MetaKpiCard con filas
Mes/Acum-YTD + semáforo + barra de avance, scorecard con desvío del mes/YTD + sparkline real-vs-meta,
tabla maestra por medio con celdas semáforo, ranking de marcas, sentimiento stacked, donut de tipo
de contenido, combo dual-axis de engagement, KpiObjCard de Trade, cuatrimestres Real-vs-BGT,
comparador A/B, etc.). Semáforo `#16a34a/#d97706/#dc2626`; real azul `#1e40af`, meta gris `#94a3b8`.

Sirve para demos comerciales, web y redes: es el "walkthrough" del **producto** que acompaña al
video **estratégico** (`marketing/video-demo/`, que explica el *modelo*).

## Qué muestra (11 escenas)
1. **Intro** — "Un recorrido por la plataforma".
2. **Mapa Estratégico** — la tesis: cada KPI aporta —con un peso— a un objetivo (líneas de conexión
   ponderadas KPI→objetivo). *"Si cumplís las metas de los KPIs, cumplís los objetivos."*
3. **Seguimiento de Objetivos** — banner **Salud de Marca** (Σ peso×cumplimiento) + 4 cards de
   objetivo con **Aporte de KPIs (peso × cumpl)** + scorecard (KPI · Mes real/meta/desv · YTD · spark).
4. **Plan de Medios** — 6 MetaKpiCards (Inversión/Alcance/Frecuencia/Impresiones/VTR/Clicks) +
   tabla maestra por medio (Inversión/Impres/Alcance/Frec/VTR/CPM efect, celdas semáforo, Total).
5. **Redes · Instagram orgánico** — 3 MetaKpiCards + fila engagement + alcance real-vs-meta +
   combo dual-axis (barras apiladas Likes/Coment/Guardados + línea eng%) + demografía.
6. **Redes · Competitivo** — benchmark de marcas + ranking engagement + engagement por pilar +
   sentimiento stacked por marca + donut tipo de contenido + análisis cualitativo.
7. **Web / Ecommerce** — 6 KPIs (3 MetaKpiCards + 5 KpiCards) + evolución real-vs-meta + detalle
   por canal + performance por categoría + audiencia (dispositivos).
8. **Trade Marketing** — Floor Share (4 KpiObjCards + ranking de marcas + performance por cliente
   con Δpp) + Cuadros Básicos (cumplimiento por categoría).
9. **Copiloto IA** — drawer "Preguntá a tus datos": el insight **cruza 3 dashboards**
   (Pauta YouTube → VTR → Intención de Compra → Facturación).
10. **Inversión** — cuatrimestres Real vs BGT (desvío + Inv/Fact) + comparador A/B (KPIs + barras
    con %desvío + acumulado).
11. **Cierre** — "Todo tu marketing, conectado al resultado." + CTA.

## Cómo funciona (igual que `video-demo`)
NO es un screen recording. Es una **animación HTML determinística**:
- `index.html` — chrome del dashboard (sidebar + topbar) + CSS de todos los componentes + fuentes
  embebidas (base64).
- `app.js` — motor de escenas; **todo el estado sale de `window.__seek(t)`** (sin reloj real). Datos
  ficticios hardcodeados acá; builders de componentes (`metaCard`, `objCard`, `kobj`, `vbars`,
  `vstack`, `donut`, `lineSvg`, `spark`, `hbar`…). Tiempos en segundos reales (`SPEED = 1`).
- `render.mjs` — Chromium (Playwright) avanza `__seek` frame a frame y pipea a ffmpeg (libx264).

## Re-render
```bash
cd marketing/video-tour
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers      # Chromium pre-instalado
export PATH="$HOME/bin:$PATH"                          # ffmpeg con libx264 (imageio-ffmpeg)
node render.mjs                                        # -> export/tour-plataforma.mp4
node render.mjs --stills 11,24,38,48,57,68,81,95,106   # PNGs de revisión por escena
```
Salida versionada: `export/tour-plataforma.mp4` (1920×1080, 30 fps).

## Cambiar datos / marca
Todo es ilustrativo y vive en `app.js` (arrays por escena: `SEG_OBJ`, `SEG_SC`, `MED_MEDIA`,
`R_BENCH`, `M_OBJ`/`M_KPI`/`M_LINK`, etc.) y la marca ficticia en `shell()` (topbar "Novara").
Para otra demo se cambian esos valores; **no tocar el motor** (`scene()`, `window.__seek`, helpers
de cursor/animación). Para replicar un dashboard nuevo, agregar una `scene(...)` con su builder.
