# Video "Primeros pasos en BIP" · 108 s · 16:9

Para quien **ya creó su cuenta**: del sign in a ver sus tableros. Foco en las pantallas reales de conexión de Meta y
Google (réplicas de capturas del flujo real con Nango). Marca ficticia **"Aurora Cosmética"**, usuaria "Laura Gómez".

Misma técnica que `marketing/video-demo`: animación HTML determinística (`window.__seek(t)`), render cuadro a cuadro
con Chromium → ffmpeg libx264. Tiempos de `app.js` en **segundos reales** (`SPEED = 1`). Las pantallas con cursor se
arman con `flowScene` (secuencia de pantallas; el cursor mide el botón con `getBoundingClientRect`, clase `.go`).

| # | Escena | Rango (s) |
|---|---|---|
| 1 | Intro "Tus primeros minutos en BIP. Bien simple." | 0 – 4 |
| 2 | Ingresá a BIP (sign in) | 4 – 10 |
| 3 | Contanos de tu marca (sector + marca a medir) | 10 – 17 |
| 4 | Modelo de impacto (Redes / Publicidad / Web) | 17 – 24 |
| 5 | Antes de conectar: qué necesitás (FB+IG, Meta Ads, GA4, Google Ads) | 24 – 35 |
| 6 | Conectá tu Facebook (tarjeta de BIP) | 35 – 40 |
| 7 | Meta: Nango → Continuar como → Negocios → Páginas → Instagram → Revisar acceso → Conectado → Éxito | 40 – 61 |
| 8 | Elegir Página y cuenta de anuncios | 61 – 68 |
| 9 | Google: Nango → Selecciona una cuenta → consentimiento → Éxito | 68 – 82 |
| 10 | GA4 (¿qué sitio medimos?) + Google Ads | 82 – 89 |
| 11 | "Listo, tus datos están conectados" → Ver mis tableros | 89 – 95 |
| 12 | Tus tableros | 95 – 103 |
| 13 | Cierre "Listo. Así de simple." + bip-go.com | 103 – 108 |

Reglas de copy: sin TikTok ni Planillas; decir solo lo que hace BIP ("solo lee tus datos para mostrártelos en tus
tableros"), nunca lo que no hace. El video termina en los tableros (sin objetivos/metas).

Render: `node render.mjs` → `export/primeros-pasos.mp4` (1920×1080, 30 fps). Revisión sin encodear:
`node render.mjs --stills 11,25,43`. Necesita playwright (con `NODE_PATH=apps/web/node_modules`) y un ffmpeg con
libx264 (`pip install imageio-ffmpeg` + symlink en `~/bin/ffmpeg`, ver README de video-demo).
Si cambian los requisitos de acceso o el recorrido de `/empezar`, actualizar `REQS` / `OPTS` / `PERMS` / `PASOS` en `app.js`.
