#!/usr/bin/env bash
# Criterio de aceptación de la fase 5: aprobación registrada en audit log; rechazo bloquea orden.
# Corre la suite de integración de la API contra un PostgreSQL temporal.
set -euo pipefail
cd "$(dirname "$0")/.."
exec scripts/with-temp-pg.sh npx vitest run tests/db/api.integration.test.ts
