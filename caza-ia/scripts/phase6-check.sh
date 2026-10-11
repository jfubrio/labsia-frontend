#!/usr/bin/env bash
# Criterio de aceptación de la fase 6: dos intentos concurrentes → una sola orden; interruptor en tres capas.
# Enciende las compras solo dentro de la base de datos temporal de prueba.
set -euo pipefail
cd "$(dirname "$0")/.."
exec scripts/with-temp-pg.sh npx vitest run tests/db/orders.integration.test.ts
