#!/usr/bin/env bash
# Levanta un PostgreSQL temporal, aplica las migraciones de CAZA IA, exporta DATABASE_URL y ejecuta el comando dado.
# Uso: scripts/with-temp-pg.sh <comando...>           (desde caza-ia/)
# Requiere PostgreSQL instalado (binarios en /usr/lib/postgresql/<ver>/bin o en PATH). Como root usa el usuario 'postgres'.
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
for f in src/db/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d caza_check -f "$f" >/dev/null; done
export DATABASE_URL="postgres://caza@localhost:$PORT/caza_check?host=$D"
"$@"
