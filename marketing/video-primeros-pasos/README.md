# Video "Primeros pasos en BIP" · 63 s · 16:9

Explica el **primer momento de verdad** del cliente (cualquier plan, incluida la prueba), alineado al producto:
`lib/access-requirements.ts` (accesos por fuente), `/empezar` (marca → modelo de impacto → conectar →
"Tus próximos pasos") y `/ayuda`. Marca ficticia **"Aurora"** y números ilustrativos (pill "Datos ilustrativos").

Misma técnica y estilo que `marketing/video-demo` (el video de la web): animación HTML determinística
(`window.__seek(t)`), render cuadro a cuadro con Chromium → ffmpeg libx264. Acá los tiempos de `app.js`
están en **segundos reales** (`SPEED = 1`).

| # | Escena | Rango (s) |
|---|---|---|
| 1 | Intro "Tus primeros minutos en BIP, bien hechos." | 0 – 4,5 |
| 2 | Paso 1 · Accesos por fuente (Meta, Instagram profesional, GA4 Lector, Google Ads Solo lectura, TikTok BC, planillas) | 4,5 – 14 |
| 3 | Paso 2 · Crear cuenta (email o Google; mail de bienvenida con los requisitos) | 14 – 21 |
| 4 | Paso 3 · Modelo de impacto (Redes / Publicidad / Web) | 21 – 28 |
| 5 | Paso 4 · Conectar en una secuencia (Facebook Login for Business: Página + IG + cuenta de anuncios) | 28 – 38 |
| 6 | Paso 5 · Tableros en minutos (sentimiento en unas horas) | 38 – 46 |
| 7 | Paso 6 · Próximos pasos (Tu mercado → objetivos → metas → semáforo) | 46 – 55 |
| 8 | Ayuda siempre a mano (primeros pasos, accesos, frecuencias, contacto info@roque-in.com) | 55 – 59 |
| 9 | Cierre "Listo: ya decidís con tus datos." + bip-go.com | 59 – 63 |

Render: `node render.mjs` → `export/primeros-pasos.mp4` (1920×1080, 30 fps). Revisión sin encodear:
`node render.mjs --stills 11,25,43`. Necesita playwright (con `NODE_PATH=apps/web/node_modules`) y un ffmpeg con
libx264 (`pip install imageio-ffmpeg` + symlink en `~/bin/ffmpeg`, ver README de video-demo).
Si cambian los requisitos de acceso o el recorrido de `/empezar`, actualizar `REQS` / `OPTS` / `SEQ` / `NX` en `app.js`.
