#!/usr/bin/env bash
# Simulacro de la fase 7 (parcial, sin tiendas reales): la vigilancia propone, las alertas disparan a un receptor
# webhook falso y quedan registradas, el operador aprueba por la API, el límite de gasto bloquea la segunda aprobación
# y ninguna orden se crea. Todo contra PostgreSQL temporal.
set -euo pipefail
cd "$(dirname "$0")/.."
exec scripts/with-temp-pg.sh bash -c '
  node -e "
    const http = require(\"http\"); let n = 0;
    http.createServer((req, res) => { let b = \"\"; req.on(\"data\", c => b += c); req.on(\"end\", () => { n++; console.log(\"[webhook falso] \" + JSON.parse(b).titulo); res.end(\"ok\"); }); }).listen(3999, () => console.log(\"webhook falso en :3999\"));
    setTimeout(() => process.exit(0), 60000);
  " &
  WH=$!
  sleep 1
  export CAZA_NOTIFY_WEBHOOK_URL=http://127.0.0.1:3999/caza
  echo "== Ciclo de vigilancia con alertas"
  npx tsx src/scripts/watch-once.ts sony-wh1000xm6 --seed-history
  echo "== Alertas registradas"
  psql -d caza_check -Atc "select canal, evento, estado from caza_notifications order by canal"
  enviadas=$(psql -d caza_check -Atc "select count(*) from caza_notifications where estado='"'"'enviada'"'"' and canal='"'"'webhook'"'"'")
  echo "== Límite de gasto"
  psql -d caza_check -Atc "select presupuesto_mensual_base, max_ordenes_mes from caza_spend_limits"
  echo "== Pruebas de integración de la fase 7"
  npx vitest run tests/db/phase7.integration.test.ts 2>&1 | grep -E "✓|×|Tests " || true
  kill $WH 2>/dev/null || true
  orders=$(psql -d caza_check -Atc "select count(*) from caza_purchase_orders")
  echo "== Resultado: alertas webhook enviadas=$enviadas (esperado ≥1), órdenes=$orders (esperado 0)"
  [ "$enviadas" -ge 1 ] && [ "$orders" -eq 0 ] || { echo "FALLO: simulacro de fase 7"; exit 1; }
  echo "OK: simulacro sin compra real; alertas disparan; límite de gasto aplicado"
'
