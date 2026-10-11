# CAZA IA — Runbook de operación

Cómo levantar, operar, conectar tiendas y, cuando se decida, habilitar compras. Todo lo que aquí se describe está
implementado; lo que falta son credenciales y decisiones (ver "Conectar", abajo).

## 1. Levantar

```bash
cd caza-ia
cp .env.example .env            # pon al menos CAZA_API_TOKEN (≥ 24 caracteres: openssl rand -hex 24)
docker compose up -d --build    # postgres, redis, migraciones, api (:3080), worker
```

Sin Docker: PostgreSQL 13+ y Redis a mano, `DATABASE_URL` y `REDIS_URL` en `.env`, luego
`npm install && npm run migrate && npm run api` y, en otra terminal, `npm run watch:worker`.

Comprobar: `curl localhost:3080/health` → `{"ok":true}`. Tablero en `http://localhost:3080/dashboard`, operador en `/ui`.

## 2. Operar

| Tarea | Cómo |
| --- | --- |
| Ver estado general | `/dashboard` (tiempo real) o `GET /api/v1/caza/metrics` |
| Activar la vigilancia de un producto | `POST /api/v1/caza/products/<slug>/watch {"activa":true}` o `npm run watch:once -- <slug> --activate`. El worker programa un ciclo cada `intervalo_minutos` (6 h); el primer disparo se alinea al siguiente múltiplo del intervalo, para un ciclo inmediato `npm run watch:once -- <slug>` |
| Revisar y decidir propuestas | `/ui` o `POST /api/v1/caza/proposals/<id>/approve\|reject {"decididoPor":"tu@correo"}`. Una propuesta vence a las 24 h |
| Ajustar límites de gasto | `PUT /api/v1/caza/limits {"presupuestoMensualBase":20000,"maxOrdenesMes":2,"actualizadoPor":"tu@correo"}` |
| Ver alertas enviadas | `GET /api/v1/caza/notifications`; canales en `.env` (`CAZA_NOTIFY_WEBHOOK_URL`, Telegram) |
| Tipo de cambio | `GET /api/v1/caza/fx`; forzar actualización `POST /api/v1/caza/fx/refresh`. Sin `BANXICO_TOKEN` usa Frankfurter; sin red, `USD_MXN_RATE` marcado como fijo |
| Ingesta externa | `POST /api/v1/caza/observations` con `X-CAZA-Token` (changedetection.io, Make o captura manual) |
| Estado de conectores | `npm run connectors:status -- <slug>` o `GET /api/v1/caza/products/<slug>/connectors` |

Todas las peticiones a `/api/...` llevan la cabecera `X-CAZA-Token`.

## 3. Conectar (cierre de la fase 0)

Cada conector se activa cuando se cumplen tres cosas: está **validado y habilitado** en la base de datos, tiene
**credenciales** en `.env`, y el producto tiene **identificador** en esa tienda. Hasta entonces el informe de
conectores dice por qué no está activo.

1. Obtener credenciales (ver `docs/HERRAMIENTAS_EXISTENTES.md`, sección 2):
   - Best Buy: `BESTBUY_API_KEY` (developer.bestbuy.com).
   - eBay: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`; `EBAY_ENV=sandbox` hasta que eBay apruebe producción.
   - Mercado Libre: `MELI_ACCESS_TOKEN` o `MELI_CLIENT_ID` + `MELI_CLIENT_SECRET` + `MELI_REFRESH_TOKEN`.
   - Amazon (MX y US): `PAAPI_ACCESS_KEY`, `PAAPI_SECRET_KEY`, `PAAPI_PARTNER_TAG` (cuenta de Associates con ventas calificadas).
   - Banxico: `BANXICO_TOKEN`.
   - Sony Store MX, B&H, Newegg: sin API; si sus términos lo permiten, changedetection.io apuntando a `POST /api/v1/caza/observations`; si no, descartar.
2. Registrar el identificador del producto en cada tienda:
   `PUT /api/v1/caza/products/sony-wh1000xm6/identifiers {"identificadores":{"bestbuy_us":"<sku>","amazon_mx":"<asin>","amazon_us":"<asin>","mercadolibre_mx":"<MLM...>","ebay_us":"<itemId>"},"actualizadoPor":"tu@correo"}`
3. Sondear antes de habilitar: `npm run connector:probe -- bestbuy_us sony-wh1000xm6` hace una llamada real y muestra las ofertas mapeadas.
4. Validar y habilitar con evidencia:
   `PUT /api/v1/caza/connectors/bestbuy_us {"estadoValidacion":"validado","notas":"clave aprobada el <fecha>; términos revisados","habilitado":true,"actualizadoPor":"tu@correo"}`
   Para descartar: `"estadoValidacion":"descartado"` con el motivo (queda deshabilitado).
5. Verificar en tres ciclos que el precio observado coincide con la tienda (criterio de la fase 3) y anotar la evidencia en `HERRAMIENTAS_EXISTENTES.md`.
6. Buzón en Texas y franquicia: ajustar `src/config/logistics.ts` y `caza_buzones` con la tarifa de recepción real, la dirección (impuesto de venta) y la franquicia que aplica (500 USD general o 150 USD fronteriza).

## 4. Habilitar compras (fase 6, compra asistida)

Ninguna API de tienda ejecuta compras: CAZA IA registra la orden y el comprador la ejecuta a mano. Habilitar
requiere las tres capas, en este orden, y queda auditado:

1. `.env`: `CAZA_PHASE=6` y `PURCHASES_ENABLED=true` (con fase menor el arranque falla). Reiniciar api y worker.
2. Base de datos: `UPDATE caza_settings SET valor='true' WHERE clave='purchases_enabled';`
3. Flujo por orden: aprobar la propuesta → `POST /api/v1/caza/authorizations/<id>/order {"actor":"tu@correo"}` (crea la orden
   `authorized` bajo tope, vigencia, una activa por producto y límite de gasto) → comprar en la tienda → `POST /api/v1/caza/orders/<id>/placed {"actor":"...","referenciaExterna":"<pedido>"}` → recoger en el buzón y cruzar → `POST /api/v1/caza/orders/<id>/delivered`.

Para apagar: `UPDATE caza_settings SET valor='false'` surte efecto de inmediato sin reiniciar.

## 5. Respaldos y monitoreo

- Respaldo diario: `docker compose exec postgres pg_dump -U caza caza | gzip > caza-$(date +%F).sql.gz`. Restaurar: `gunzip -c archivo | docker compose exec -T postgres psql -U caza caza`.
- Qué vigilar en el tablero: corridas con error en 24 h (rojo), alertas fallidas, tipo de cambio desactualizado o fijo, propuestas pendientes por vencer, presupuesto comprometido.
- Logs: `docker compose logs -f api worker`.
- El audit log (`caza_audit_log`) es inmutable: decisiones, órdenes, cambios de límites y validaciones de conectores quedan ahí con quién y cuándo.

## 6. Verificación antes de un despliegue

La CI de GitHub (`.github/workflows/caza-ia.yml`) corre todo esto en cada push y además construye la imagen, la arranca
contra PostgreSQL y comprueba `/health` y la protección por token. En local:

```bash
npm run verify && npm run db:check && npm run test:db
npm run phase2:worker-check   # con Redis
npm run e2e:check             # simulacro completo con compra simulada en PostgreSQL temporal
```
