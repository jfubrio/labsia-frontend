#!/usr/bin/env bash
# Comprueba el programador BullMQ y el worker. Usa REDIS_URL si está definida; si no, levanta un redis-server temporal.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${REDIS_URL:-}" ]; then
  command -v redis-server >/dev/null || { echo "No hay REDIS_URL ni redis-server instalado."; exit 2; }
  PORT=$((56000 + RANDOM % 1000))
  redis-server --port "$PORT" --save "" --appendonly no --daemonize yes --logfile /dev/null >/dev/null
  trap 'redis-cli -p "$PORT" shutdown nosave >/dev/null 2>&1 || true' EXIT
  sleep 1
  export REDIS_URL="redis://127.0.0.1:$PORT/0"
  echo "redis temporal en $REDIS_URL"
fi
exec scripts/with-temp-pg.sh npx tsx src/scripts/worker-smoke.ts
