#!/usr/bin/env bash
# Simulacro de extremo a extremo (fase 7) contra PostgreSQL temporal, migraciones aplicadas con scripts/migrate.sh
# (dos veces: la segunda debe no hacer nada), API real escuchando, alertas a un webhook falso y compra SIMULADA con el
# interruptor encendido solo en esta base de datos temporal. Termina con la orden colocada y entregada.
set -euo pipefail
cd "$(dirname "$0")/.."
S="$(mktemp -d)"
trap 'rm -rf "$S"' EXIT
export S
exec scripts/with-temp-pg.sh bash -c '
  set -e
  echo "== migraciones idempotentes (ya aplicadas por el arranque; volver a correrlas no hace nada)"
  ya=$(bash scripts/migrate.sh | grep -c "ya aplicada")
  echo "   $ya ya aplicadas (esperado 3)"
  [ "$ya" -ge 3 ]
  node -e "
    const http = require(\"http\"); let n = 0;
    http.createServer((req, res) => { let b = \"\"; req.on(\"data\", c => b += c); req.on(\"end\", () => { n++; console.log(\"[webhook falso] \" + JSON.parse(b).titulo); res.end(\"ok\"); }); }).listen(3998);
    setTimeout(() => process.exit(0), 120000);
  " &
  WH=$!
  sleep 1
  export CAZA_NOTIFY_WEBHOOK_URL=http://127.0.0.1:3998/caza CAZA_API_TOKEN=e2e CAZA_API_PORT=3083 CAZA_PHASE=6 PURCHASES_ENABLED=true
  npx tsx src/scripts/api-server.ts > "$S/api.log" 2>&1 &
  API=$!
  for i in $(seq 1 30); do curl -fs localhost:3083/health >/dev/null 2>&1 && break; sleep 0.5; done
  H="X-CAZA-Token: e2e"; J="content-type: application/json"
  echo "== 1. historial + vigilancia (propuesta + alerta)"
  npx tsx src/scripts/watch-once.ts sony-wh1000xm6 --seed-history --activate | grep -E "corrida|tipo de cambio"
  PID=$(curl -s -H "$H" "localhost:3083/api/v1/caza/proposals?estado=pendiente" | node -e "process.stdin.on(\"data\",d=>console.log(JSON.parse(d)[0].id))")
  echo "== 2. approve por la API"
  AUTH=$(curl -s -H "$H" -H "$J" -X POST -d "{\"decididoPor\":\"e2e@labsia.mx\"}" "localhost:3083/api/v1/caza/proposals/$PID/approve" | node -e "process.stdin.on(\"data\",d=>console.log(JSON.parse(d).authorization.id))")
  echo "   autorización $AUTH"
  echo "== 3. orden con la DB apagada (debe fallar) y encendida (debe crearse)"
  code=$(curl -s -o "$S/o1.json" -w "%{http_code}" -H "$H" -H "$J" -X POST -d "{\"actor\":\"e2e@labsia.mx\"}" "localhost:3083/api/v1/caza/authorizations/$AUTH/order"); echo "   DB apagada → HTTP $code ($(node -e "console.log(JSON.parse(require(\"fs\").readFileSync(\"$S/o1.json\")).status)"))"
  [ "$code" = "403" ]
  psql -d caza_check -Atc "UPDATE caza_settings SET valor='"'"'true'"'"' WHERE clave='"'"'purchases_enabled'"'"'" >/dev/null
  code=$(curl -s -o "$S/o2.json" -w "%{http_code}" -H "$H" -H "$J" -X POST -d "{\"actor\":\"e2e@labsia.mx\"}" "localhost:3083/api/v1/caza/authorizations/$AUTH/order"); echo "   DB encendida → HTTP $code"
  [ "$code" = "201" ]
  OID=$(node -e "console.log(JSON.parse(require(\"fs\").readFileSync(\"$S/o2.json\")).order.id)")
  echo "== 4. segundo intento idempotente y compra asistida: colocada → entregada"
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "$H" -H "$J" -X POST -d "{\"actor\":\"e2e@labsia.mx\"}" "localhost:3083/api/v1/caza/authorizations/$AUTH/order"); echo "   repetido → HTTP $code (duplicado)"; [ "$code" = "200" ]
  curl -s -H "$H" -H "$J" -X POST -d "{\"actor\":\"e2e@labsia.mx\",\"referenciaExterna\":\"SIM-0001\"}" "localhost:3083/api/v1/caza/orders/$OID/placed" | node -e "process.stdin.on(\"data\",d=>console.log(\"   \"+JSON.parse(d).status))"
  curl -s -H "$H" -H "$J" -X POST -d "{\"actor\":\"e2e@labsia.mx\"}" "localhost:3083/api/v1/caza/orders/$OID/delivered" | node -e "process.stdin.on(\"data\",d=>console.log(\"   \"+JSON.parse(d).status))"
  echo "== 5. métricas finales"
  curl -s -H "$H" localhost:3083/api/v1/caza/metrics | node -e "process.stdin.on(\"data\",d=>{const m=JSON.parse(d);console.log(\"   órdenes totales=\"+m.compras.ordenesTotales+\" activas=\"+m.compras.ordenesActivas+\" alertas=\"+m.alertas.enviadas24h+\" compras DB=\"+m.compras.habilitadasEnDb)})"
  kill $API $WH 2>/dev/null || true
  alertas=$(psql -d caza_check -Atc "select count(*) from caza_notifications where estado='"'"'enviada'"'"' and canal='"'"'webhook'"'"'")
  entregadas=$(psql -d caza_check -Atc "select count(*) from caza_purchase_orders where status='"'"'delivered'"'"'")
  audit=$(psql -d caza_check -Atc "select count(*) from caza_audit_log where evento in ('"'"'proposal.created'"'"','"'"'authorization.approve'"'"','"'"'order.created'"'"','"'"'order.placed'"'"','"'"'order.delivered'"'"')")
  echo "== Resultado: alertas webhook=$alertas (≥2) órdenes entregadas=$entregadas (1) eventos de audit=$audit (5)"
  [ "$alertas" -ge 2 ] && [ "$entregadas" -eq 1 ] && [ "$audit" -eq 5 ] || { echo "FALLO: simulacro E2E"; exit 1; }
  echo "OK: simulacro E2E completo con compra simulada (solo en la base de datos temporal)"
'
