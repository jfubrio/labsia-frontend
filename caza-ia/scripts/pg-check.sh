#!/usr/bin/env bash
# Aplica las migraciones en un PostgreSQL temporal y corre la comprobación de guardas de compra.
set -euo pipefail
cd "$(dirname "$0")/.."
exec scripts/with-temp-pg.sh bash -c '
  echo "== Tablas"
  psql -d caza_check -Atc "select string_agg(table_name, '"'"' '"'"' order by table_name) from information_schema.tables where table_schema='"'"'public'"'"'"
  echo "== Guardas de compra (esperado: 1 orden, errores en pasos 1, 2, 4 y 5)"
  out="$(psql -d caza_check -f src/db/checks/guards_check.sql 2>&1 || true)"
  errors="$(printf "%s\n" "$out" | grep -c ERROR || true)"
  orders="$(psql -d caza_check -Atc "select count(*) from caza_purchase_orders")"
  printf "%s\n" "$out" | grep -E "ERROR|^---" | sed "s/^psql:[^:]*:[0-9]*: //"
  echo "   errores esperados: 4  obtenidos: $errors"
  echo "   órdenes esperadas: 1  obtenidas: $orders"
  if [ "$errors" -ne 4 ] || [ "$orders" -ne 1 ]; then echo "FALLO: las guardas no se comportan como se espera"; exit 1; fi
  echo "OK: migraciones y guardas verificadas"
'
