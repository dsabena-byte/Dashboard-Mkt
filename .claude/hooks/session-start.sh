#!/bin/bash
# SessionStart hook (Claude Code en la web): instala MarkItDown para convertir
# PDF/Office/imágenes → Markdown y ahorrar tokens al pasarle contenido a Claude.
set -euo pipefail

# Solo en el entorno remoto (Claude Code web). En local no hace nada.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Idempotente: instala solo si falta.
if ! command -v markitdown >/dev/null 2>&1; then
  pip install --quiet 'markitdown[all]' || pip install --quiet markitdown
fi
