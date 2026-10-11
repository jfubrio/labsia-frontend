#!/usr/bin/env bash
# Aplica las migraciones pendientes a DATABASE_URL en orden, registrando cada una en caza_schema_migrations.
# Idempotente: una migración aplicada no se vuelve a ejecutar. Uso: DATABASE_URL=postgres://... scripts/migrate.sh
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?DATABASE_URL es obligatoria}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "CREATE TABLE IF NOT EXISTS caza_schema_migrations (nombre TEXT PRIMARY KEY, aplicada_en TIMESTAMPTZ NOT NULL DEFAULT NOW())"
for f in src/db/migrations/*.sql; do
  n="$(basename "$f")"
  if [ "$(psql "$DATABASE_URL" -Atc "SELECT 1 FROM caza_schema_migrations WHERE nombre = '$n'")" = "1" ]; then
    echo "   ya aplicada: $n"; continue
  fi
  echo "== aplicando $n"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -1 -f "$f"
  psql "$DATABASE_URL" -Atq -c "INSERT INTO caza_schema_migrations (nombre) VALUES ('$n')"
done
echo "OK: esquema al día"
