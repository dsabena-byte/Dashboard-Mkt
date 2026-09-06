# BIP · Recorrido de la plataforma (video tour)

Video de **64 s** que muestra cómo se ve la plataforma dashboard por dashboard, **sin exponer
la marca Drean ni data real/sensible**. Marca ficticia **"Novara"** + competidores inventados
(Vanté, Kova, Areté, Belmar); todos los números son **ilustrativos** (pill "Datos ilustrativos"
en el topbar para dejarlo explícito). Rebrand BIP (navy `#0a4da0` + cyan `#12a6f4`, Poppins + Inter).

Sirve para demos comerciales, web y redes: es el "walkthrough" del producto que acompaña al
video estratégico (`marketing/video-demo/`, que explica el *modelo*; este muestra el *producto*).

## Qué muestra (8 escenas)
1. **Intro** — "Un recorrido por la plataforma".
2. **Seguimiento de Objetivos** — 4 hero-cards (Top of Mind, Share of Mind, Intención de Compra,
   Facturación US$) verde-heavy + scorecard KPIs por plan con desvío y sparklines real vs meta.
3. **Plan de Medios** — KPI row (Inversión/Alcance/Frecuencia/VTR) + inversión por medio (barras)
   + eficiencia CPM (línea real vs meta).
4. **Redes Sociales** — KPI row + benchmark de marcas vs competencia + sentimiento por marca (stacked).
5. **Web / Ecommerce** — KPI row (Usuarios/Transacciones/Ingresos/ROAS) + tráfico YoY (línea) +
   fuentes de tráfico (barras).
6. **Trade Marketing** — KPI row + Floor Share por categoría + cobertura por cliente (tabla).
7. **Copiloto IA** — "Preguntá a tus datos" (chat) + insights automáticos.
8. **Cierre** — "Todo tu marketing, conectado al resultado." + CTA "Agendá una demo".

## Cómo funciona (igual que `video-demo`)
NO es un screen recording. Es una **animación HTML determinística**:
- `index.html` — chrome del dashboard (sidebar + topbar) + CSS + fuentes embebidas (base64).
- `app.js` — motor de escenas; **todo el estado sale de `window.__seek(t)`** (sin reloj real).
  Datos ficticios hardcodeados acá. Ritmo: `DUR = 64` (escala base 30 s estirada por `SPEED`).
- `render.mjs` — Chromium (Playwright) avanza `__seek` frame a frame y pipea a ffmpeg (libx264).

## Re-render
```bash
cd marketing/video-tour
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers      # Chromium pre-instalado
export PATH="$HOME/bin:$PATH"                          # ffmpeg con libx264 (imageio-ffmpeg)
node render.mjs                                        # -> export/tour-plataforma.mp4
node render.mjs --stills 9,17,26,34,43,52,60           # PNGs de revisión por escena
```
Salida versionada: `export/tour-plataforma.mp4` (1920×1080, 30 fps, ~4 MB).

## Cambiar datos / marca
Todo es ilustrativo y vive en `app.js` (arrays por escena: KPI values, `BENCH`, `SENT`, `SCROWS`,
floor share, etc.) y la marca ficticia en `shell()` (topbar "Novara"). Para otra demo se cambian
esos valores; **no tocar el motor** (`scene()`, `window.__seek`, helpers de cursor/animación).
