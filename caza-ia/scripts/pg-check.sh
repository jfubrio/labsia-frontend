#!/usr/bin/env bash
# Aplica las migraciones de CAZA IA en un PostgreSQL temporal y corre la comprobación de guardas.
# Uso: scripts/pg-check.sh            (desde caza-ia/)
# Requiere PostgreSQL instalado (binarios en /usr/lib/postgresql/<ver>/bin o en PATH).
# Si corre como root usa el usuario 'postgres' para initdb; el directorio de datos va a /tmp/cazapg-$$.
set -euo pipefail
cd "$(dirname "$0")/.."

PGBIN="$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb 2>/dev/null | sort -V | tail -1)")"
[ -x "$PGBIN/initdb" ] || { echo "No se encontró PostgreSQL (initdb). Instálalo o exporta PATH."; exit 2; }

D="/tmp/cazapg-$$"
PORT=$((54000 + RANDOM % 1000))
run_as() { if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
cleanup() { run_as "$PGBIN/pg_ctl" -D "$D/data" stop >/dev/null 2>&1 || true; rm -rf "$D"; }
trap cleanup EXIT

mkdir -p "$D"; [ "$(id -u)" = "0" ] && chown postgres "$D"
run_as "$PGBIN/initdb" -D "$D/data" -U caza -A trust >/dev/null
run_as "$PGBIN/pg_ctl" -D "$D/data" -o "-k $D -p $PORT -c listen_addresses=''" -l "$D/log" start >/dev/null
sleep 1
export PGHOST="$D" PGPORT="$PORT" PGUSER=caza
createdb caza_check

echo "== Aplicando migraciones"
for f in src/db/migrations/*.sql; do
  echo "   $f"
  psql -v ON_ERROR_STOP=1 -q -d caza_check -f "$f" >/dev/null
done

echo "== Tablas"
psql -d caza_check -Atc "select string_agg(table_name, ' ' order by table_name) from information_schema.tables where table_schema='public'"

echo "== Guardas de compra (esperado: 1 orden, errores en pasos 1, 2, 4 y 5)"
out="$(psql -d caza_check -f src/db/checks/guards_check.sql 2>&1 || true)"
errors="$(printf '%s\n' "$out" | grep -c 'ERROR' || true)"
orders="$(psql -d caza_check -Atc "select count(*) from caza_purchase_orders")"
printf '%s\n' "$out" | grep -E 'ERROR|^---' | sed 's/^psql:[^:]*:[0-9]*: //'
echo "   errores esperados: 4  obtenidos: $errors"
echo "   órdenes esperadas: 1  obtenidas: $orders"
if [ "$errors" -ne 4 ] || [ "$orders" -ne 1 ]; then
  echo "FALLO: las guardas no se comportan como se espera"; exit 1
fi
echo "OK: migraciones y guardas verificadas"
