---
name: config-claude-fuente-oficial
description: >-
  Para responder o ejecutar CUALQUIER configuración/setup de Claude Code, claude.ai, conectores, MCP
  servers, environments, setup scripts, plugins, skills, o herramientas externas (Perplexity,
  MarkItDown, etc.). Usalo ANTES de dar un solo paso de UI o un comando de instalación. Fuerza traer
  la fuente autoritativa primero — code.claude.com/docs, el tool `read_documentation` del entorno, o
  el repo/doc oficial de la herramienta — y prohíbe adivinar pantallas, botones, URLs o comandos.
  Nace de mandar al usuario a pantallas equivocadas varias veces por no leer la doc antes.
---

# Config de Claude / tooling — fuente oficial primero

El usuario pierde tiempo cuando le doy pasos de UI adivinados. Regla dura: **no des un paso de
configuración sin haber leído la fuente autoritativa que lo respalda.**

## Antes de responder, traé la data correcta
1. **Entorno Claude Code (cloud): usá `read_documentation`** (MCP claude-code-remote) con el topic
   que corresponda (`connectors.add`, `environment.setup_script`, `environment.secrets`,
   `environment.network`, `github.access`, etc.). Es lo más actualizado y le muestra al usuario una
   tarjeta con botón a esa pantalla.
2. **Doc de producto:** `https://code.claude.com/docs/en/...` (ej. `cloud-environments`,
   `claude-code-on-the-web`, `hooks`, `settings-reference`). Si el índice: `.../docs/llms.txt`.
3. **Herramientas externas:** el repo/doc **oficial** (GitHub del proyecto, docs del vendor). Si el
   host está bloqueado por el proxy de egress, probá el `raw.githubusercontent.com` del repo oficial.
4. Citá la fuente y **el comando/URL exacto** que sacaste de ahí. No lo reconstruyas de memoria.

## Distinguí las tres superficies (no las mezcles)
- **claude.ai (el chat):** conectores/skills/plugins se gestionan en **Customize** o
  `claude.ai/customize/connectors`. Se leen al **iniciar** la sesión (una sesión abierta no los
  toma). No corre código local ni instala paquetes Python.
- **Claude Code en la nube:** las herramientas del sistema se instalan en el **Setup script del
  environment** (editable desde el selector de environment en la **pantalla de sesión nueva**: hover
  sobre el environment → engranaje; el dropdown del título de la sesión es solo indicador). Si abre
  en **solo lectura**, es un environment de organización → lo edita un Owner en
  `claude.ai/admin-settings → Cloud environments`.
- **Claude Code local (escritorio/terminal):** `claude mcp add ...`, `~/.claude/`, hooks locales.
  El usuario puede NO tener escritorio — preguntá antes de asumir.

## Gotchas verificados de este entorno
- **Proyecto multi-repo:** una sesión con varios repos arranca "por encima" de los clones y **no
  lee** el `.claude/settings.json` (hooks) de ningún repo. Para instalar deps en esas sesiones va el
  **Setup script del environment**, no un hook del repo. Las **skills** del repo (`.claude/skills/`)
  cargan; las que habilitás en tu cuenta claude.ai cargan en **todas** las sesiones cloud.
- **`cffi` roto:** en el contenedor base falta `_cffi_backend`; paquetes que dependen de
  `cryptography`/`pdfminer` (ej. MarkItDown, pypdf) crashean. Fix: `pip install --force-reinstall cffi`
  (un `pip install cffi` a secas dice "already satisfied" pero el backend sigue roto).
- Muchos MCP por API key (ej. Perplexity Sonar) requieren **organización con billing** en la consola
  del vendor; no funcionan con la cuenta gratis.

## Regla de honestidad
Si una capacidad **no existe** en la superficie que usa el usuario (ej. instalar MarkItDown como
conector en claude.ai chat), decilo derecho y ofrecé la alternativa real — no lo mandes a buscar una
pantalla que no existe. Y aclará cuando algo es pago antes de que lo pague.
