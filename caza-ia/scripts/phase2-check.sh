#!/usr/bin/env bash
# Criterio de aceptación de la fase 2: observaciones periódicas en PostgreSQL con historial consultable y perfil recalculado.
# Corre dos ciclos de vigilancia manuales contra un PostgreSQL temporal y comprueba que cada uno dejó observaciones,
# perfil y corrida registrada. Sin Redis: el programador BullMQ se prueba aparte (npm run watch:worker).
set -euo pipefail
cd "$(dirname "$0")/.."
exec scripts/with-temp-pg.sh bash -c '
  echo "== Ciclo 1 (con historial sintético y activación de vigilancia)"
  npx tsx src/scripts/watch-once.ts sony-wh1000xm6 --seed-history --activate
  echo "== Ciclo 2"
  npx tsx src/scripts/watch-once.ts sony-wh1000xm6
  runs="$(psql -d caza_check -Atc "select count(*) from caza_watch_runs where estado='"'"'ok'"'"'")"
  profiles="$(psql -d caza_check -Atc "select count(*) from caza_market_price_profiles")"
  obs="$(psql -d caza_check -Atc "select count(*) from caza_price_observations")"
  verd="$(psql -d caza_check -Atc "select count(*) from caza_discount_verdicts")"
  orders="$(psql -d caza_check -Atc "select count(*) from caza_purchase_orders")"
  active="$(psql -d caza_check -Atc "select vigilancia_activa from caza_watch_configs w join caza_products p on p.id=w.product_id where p.slug='"'"'sony-wh1000xm6'"'"'")"
  echo "== Resultado: corridas ok=$runs (esperado 2) perfiles=$profiles (esperado 4: 2 mercados × 2 ciclos) observaciones=$obs veredictos=$verd órdenes=$orders (esperado 0) vigilancia_activa=$active"
  [ "$runs" -eq 2 ] && [ "$profiles" -eq 4 ] && [ "$verd" -ge 2 ] && [ "$orders" -eq 0 ] && [ "$active" = "t" ] || { echo "FALLO: criterio de fase 2 no cumplido"; exit 1; }
  echo "OK: fase 2 verificada (historial consultable, perfil recalculado por ciclo, ninguna orden)"
'
