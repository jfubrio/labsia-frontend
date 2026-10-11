#!/bin/bash
# SessionStart hook: deja listo caza-ia (dependencias de Node) en sesiones de Claude Code en la nube.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR/caza-ia"
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm install --no-audit --no-fund
fi

# Comandos de verificación disponibles para la sesión
{
  echo 'export CAZA_DIR="$CLAUDE_PROJECT_DIR/caza-ia"'
} >> "${CLAUDE_ENV_FILE:-/dev/null}"
