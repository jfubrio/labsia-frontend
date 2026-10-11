# CAZA IA

Vigilancia de precios, **precio real de mercado a partir del comportamiento de la oferta competitiva en el tiempo**, validación de descuentos, comparación internacional y compras con autorización humana. El precio de lista, el de lanzamiento y el "antes" que anuncia una tienda nunca son referencia.
Este directorio contiene la **fase 1** del plan ([docs/PLAN_DESARROLLO.md](docs/PLAN_DESARROLLO.md)).

**Estado:** todo el código de las fases 1 a 8 está escrito y probado. Lo que falta no es código: credenciales e identificadores de tiendas (fase 0), datos reales del buzón y la decisión de habilitar compras. Compras deshabilitadas, vigilancia implementada pero no activada en ningún producto. Operación: [docs/RUNBOOK.md](docs/RUNBOOK.md).

## Qué incluye la fase 3 (conectores reales) y 4 (tipo de cambio)

| Pieza | Ruta | Notas |
| --- | --- | --- |
| Conectores | `src/connectors/` | Best Buy (SKU), eBay Browse (OAuth client-credentials), Mercado Libre (Bearer con refresh), Amazon PA-API 5.0 (SigV4 propia, MX y US). Mapeadores puros probados con respuestas sintéticas; sin SDKs ni scraping |
| Ingesta externa | `POST /api/v1/caza/observations`, conector `webhook` | changedetection.io, Make o captura manual envían un precio y corre el ciclo completo |
| Fase 0 en DB | `caza_connectors`, `caza_product_identifiers`, `PUT /api/v1/caza/connectors/:clave`, `PUT .../products/:slug/identifiers` | Un conector se instancia solo si está validado y habilitado, tiene credenciales y, si las necesita, identificador. Informe con el motivo: `npm run connectors:status`; sondeo real: `npm run connector:probe -- <clave>` |
| Tipo de cambio | `src/fx/` | Banxico SIE (SF43718) → Frankfurter → fijo del entorno, con caché diario en `caza_fx_rates` y procedencia visible en el tablero |

## Qué incluye la fase 6 (compra asistida) y 8 (operación)

| Pieza | Ruta | Notas |
| --- | --- | --- |
| Ejecutor | `src/services/orders.service.ts`, `POST /api/v1/caza/authorizations/:id/order`, `POST .../orders/:id/placed\|cancelled\|failed\|delivered` | Ninguna API de tienda compra: se registra la orden bajo las tres capas del interruptor, tope, vigencia, una activa por producto y límite de gasto; el comprador ejecuta y marca colocada con referencia; recogida en el buzón = entregada |
| Despliegue | `Dockerfile`, `docker-compose.yml`, `scripts/migrate.sh` | PostgreSQL, Redis, migraciones idempotentes, API y worker |
| Simulacro E2E | `scripts/e2e-check.sh` | Migraciones, API real, alerta a webhook falso, approve, compra simulada (solo en PostgreSQL temporal), colocada y entregada |

## Qué incluye la fase 7 (parcial: alertas y límites de gasto)

| Pieza | Ruta | Notas |
| --- | --- | --- |
| Alertas al operador | `src/notify/notifier.ts` | Consola siempre; webhook JSON genérico (`CAZA_NOTIFY_WEBHOOK_URL`, compatible con Apprise, ntfy, Slack/Discord, Make) y Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`). Eventos: propuesta creada, propuesta expirada, error de vigilancia, límite de gasto. Cada envío queda en `caza_notifications` |
| Límites de gasto | `src/engines/spend-limits.ts`, `caza_spend_limits` | Presupuesto mensual en moneda base y máximo de órdenes; mide lo comprometido (approve vigentes + órdenes activas). Bloquea la aprobación (422, auditado) y el ejecutor. `GET`/`PUT /api/v1/caza/limits` |
| Simulacro | `scripts/phase7-check.sh` | Vigilancia → propuesta → alerta a un webhook falso → aprobación → bloqueo por presupuesto y por máximo de órdenes → 0 órdenes |

## Qué incluye la fase 5 (flujo approve / reject)

| Pieza | Ruta | Notas |
| --- | --- | --- |
| Servicio de decisiones | `src/services/approvals.service.ts` | Transacción: bloquea la propuesta, exige que esté pendiente y vigente, crea la autorización con las reglas del motor, marca la propuesta y escribe el audit log |
| API del operador | `src/api/app.ts` | Fastify. `GET /api/v1/caza/products`, `GET .../products/:slug/summary`, `POST .../products/:slug/watch`, `GET .../proposals?estado=`, `GET .../proposals/:id`, `POST .../proposals/:id/approve` y `/reject`. Token compartido en `X-CAZA-Token`. Ningún endpoint compra |
| Página del operador | `src/api/ui.ts` → `/ui` | Lista pendientes con precio, aterrizado, objetivo, veredicto y vencimiento; botones de aprobar y rechazar |
| Tablero en tiempo real ([captura](docs/img/dashboard-claro.png)) | `src/api/dashboard.ts` → `/dashboard`, `src/db/repositories/metrics.repo.ts` | Tarjetas de estado (propuestas, vigilancia, alertas, presupuesto, órdenes, interruptor de compras) y, por producto y mercado, el perfil de precio real con la serie competitiva diaria graficada (SVG propio, paleta validada, tooltip, modo oscuro, vista de tabla). `GET /api/v1/caza/metrics` y SSE `GET /api/v1/caza/metrics/stream` cada 5 s |
| Expiración de propuestas | `expireStaleProposals` en cada ciclo de vigilancia | 24 h sin respuesta → `expirada`; la vigilancia puede proponer de nuevo |
| Criterio de aceptación | `scripts/phase5-check.sh` | Approve registrado en audit log con operador; reject bloquea la orden en la base de datos aunque el interruptor estuviera encendido; propuesta vencida expira |

## Qué incluye la fase 2 (vigilancia programada)

| Pieza | Ruta | Notas |
| --- | --- | --- |
| Cliente y repositorios PostgreSQL | `src/db/client.ts`, `src/db/repositories/` | Productos, observaciones (historial por mercado y moneda), perfiles, veredictos, propuestas, corridas, audit log |
| Ciclo de vigilancia | `src/watch/run-watch.ts` | Observa con los conectores usables → recalcula el perfil de precio real por mercado con el historial de la DB → juzga → registra una propuesta pendiente de approve (una sola por producto). Nunca compra |
| Programador y worker | `src/watch/scheduler.ts` | BullMQ sobre Redis: un Job Scheduler por producto con `vigilancia_activa`, repetido cada `intervalo_minutos`; worker con concurrencia 1 |
| Ciclo manual sin Redis | `src/scripts/watch-once.ts` | `npm run watch:once -- <slug> [--seed-history] [--activate]` |
| Criterio de aceptación | `scripts/phase2-check.sh`, `scripts/phase2-worker-check.sh` | Dos ciclos contra un PostgreSQL temporal: historial consultable, perfil recalculado por ciclo, 0 órdenes. El worker: scheduler sincronizado dos veces sin duplicar, primer job completado y registrado como corrida `scheduler`, scheduler retirado al desactivar la vigilancia |

## Qué incluye la fase 1

| Pieza | Ruta | Notas |
| --- | --- | --- |
| Esquema de base de datos | `src/db/migrations/001_caza_ia_schema.sql` | Productos, configuración de vigilancia, conectores, observaciones, veredictos, autorizaciones, órdenes, audit log |
| Guardas de compra | `src/db/migrations/002_purchase_guards.sql` | Índice único de una orden activa por producto, trigger que exige `approve` vigente y de un solo uso, interruptor `purchases_enabled=false`, audit log inmutable |
| Datos iniciales | `src/db/migrations/003_seed_sony_wh1000xm6.sql` | Conectores MX y US en `por_validar`, buzón en Texas con cruce personal, tramos de importación por paquetería y los Sony WH-1000XM6 |
| **Motor de precio real de mercado** | `src/engines/market-price.ts` | Núcleo del sistema: serie competitiva diaria entre tiendas, mediana ponderada por recencia, régimen, detección de lanzamiento inflado, confianza, objetivo derivado |
| Configuración de los Sony | `src/config/products/sony-wh1000xm6.ts` | Precio de lista solo informativo, objetivo derivado del precio real, tope duro 8,499 MXN, umbral 12 %, mercados MX y US, compra permitida en MX y US |
| Conector con datos de prueba | `src/connectors/mock.connector.ts` + `fixtures/` | Historial sintético multitienda de 90 días en MX (tienda oficial fija en lanzamiento, dos tiendas bajando, una venta flash) y en US (Amazon, Best Buy, Walmart) y nueve escenarios; no hace red |
| Motor de validación de descuentos | `src/engines/discount-validator.ts` | Juzga cada oferta contra el precio real de mercado: mínimo histórico, real, dudoso, falso o sin historial; marca anclas infladas |
| Compra en EE. UU. vía buzón en Texas | `src/engines/international-comparison.ts` + `src/config/logistics.ts` | Precio aterrizado en MXN con cruce personal: impuesto de venta de Texas, recepción en el buzón, franquicia de pasajero y 19 % solo sobre el excedente. Paquetería (reenvío + tramos T-MEC) como ruta alternativa. Las ofertas de EE. UU. compiten por lo que cuestan ya en casa |
| Motor de autorización | `src/engines/authorization.ts` | Propuesta → `approve`/`reject` vinculado a una oferta, con tope y vigencia |
| Ejecutor y anti-duplicados | `src/engines/purchase-executor.ts` | Interruptor por fase, idempotencia, una orden activa por producto |

## Uso

```bash
cd caza-ia
npm install
npm run verify        # typecheck + pruebas unitarias + demo sin red (lo que se corre antes de cada push)
npm run db:check      # aplica las migraciones en un PostgreSQL temporal y comprueba las guardas de compra
npm run test:db       # pruebas de integración de la vigilancia contra un PostgreSQL temporal
npm run phase2:check  # criterio de aceptación de la fase 2: dos ciclos de vigilancia persistidos
npm run phase2:worker-check  # programador BullMQ + worker contra Redis y PostgreSQL temporales (usa REDIS_URL si existe)
npm run phase5:check  # criterio de aceptación de la fase 5: approve en audit log, reject bloquea orden
npm run phase6:check  # criterio de la fase 6: dos intentos concurrentes → una orden; interruptor en tres capas
npm run phase7:check  # simulacro: alertas disparan a un webhook falso, límite de gasto bloquea, 0 órdenes
npm run e2e:check     # simulacro completo con compra simulada en PostgreSQL temporal
npm run profile       # imprime el perfil de precio real de mercado del fixture y su serie diaria
npm run demo          # recorre los nueve escenarios sin red ni base de datos
```

Vigilancia contra una base de datos propia (`DATABASE_URL`) y, para el programador, Redis (`REDIS_URL`):

```bash
npm run watch:once -- sony-wh1000xm6 --seed-history   # un ciclo manual, sin Redis; --seed-history solo para demostrar
npm run watch:once -- sony-wh1000xm6 --activate       # marca vigilancia_activa para que el programador lo tome
npm run watch:worker                                  # programador BullMQ + worker (requiere REDIS_URL)
```

Ningún producto tiene `vigilancia_activa` por defecto: activarla es una decisión explícita.

API del operador (`DATABASE_URL` y `CAZA_API_TOKEN` obligatorios; `REDIS_URL` opcional para resincronizar el programador al activar vigilancia):

```bash
CAZA_API_TOKEN=un-token-largo npm run api     # http://localhost:3080/dashboard (tablero) y /ui (approve/reject)
curl -H "X-CAZA-Token: un-token-largo" localhost:3080/api/v1/caza/proposals
curl -H "X-CAZA-Token: un-token-largo" -H 'content-type: application/json' \
     -d '{"decididoPor":"tu@correo"}' -X POST localhost:3080/api/v1/caza/proposals/<id>/approve
```

Skills de Claude Code para este proyecto en `../.claude/skills/` (`caza-verify`, `caza-scenario`, `caza-connector`,
`caza-migration`, `caza-phase`, `steward`); las convenciones generales están en `../CLAUDE.md`. Las sesiones en la nube
instalan dependencias solas con el hook `../.claude/hooks/session-start.sh`.

Aplicar las migraciones en una base de datos PostgreSQL (cuando exista una, a partir de la fase 2):

```bash
for f in src/db/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

Comprobar las guardas de compra sobre una base de datos de prueba ya existente (`npm run db:check` lo hace solo en un PostgreSQL temporal):

```bash
psql "$DATABASE_URL" -f src/db/checks/guards_check.sql
```

## Interruptor de compras

Hay tres capas y las tres deben estar abiertas para que una orden exista:

1. `CAZA_PHASE >= 6` y `PURCHASES_ENABLED=true` en el entorno. Con fase menor y `true`, el arranque falla.
2. `caza_settings.purchases_enabled = 'true'` en la base de datos. El trigger `trg_a_purchases_enabled` aborta cualquier `INSERT` en `caza_purchase_orders` mientras sea `false`.
3. Una autorización `approve` vigente, no consumida, para esa observación y con precio dentro del tope.

## Pendientes para conectar (no es código)

- Revisar [docs/HERRAMIENTAS_EXISTENTES.md](docs/HERRAMIENTAS_EXISTENTES.md) y resolver las tareas de fase 0 que lista (cuenta de Amazon Associates, Keepa, Mercado Libre, Sony Store, Banxico, Best Buy, buzón en Texas).
- La fase 6 (ejecutor de compra) necesita la 3 (conectores reales con compra) además de la 5: no se habilita nada hasta cerrar la fase 0.
- Al desplegar, el primer disparo de cada Job Scheduler se alinea al siguiente múltiplo del intervalo (con 6 h puede tardar hasta 6 h); si hace falta un ciclo inmediato, correr `npm run watch:once`.

- Pegar el texto completo del plan original en `docs/PLAN_DESARROLLO.md` donde dice `[PENDIENTE: texto original]`.
- Confirmar las decisiones de la sección 8 del plan (moneda base, umbral, vigencia, supuestos de importación).
- Confirmar el precio de lista de los Sony WH-1000XM6 en México.
- Cerrar la fase 0: marcar cada conector como `validado` o `descartado` en `caza_connectors` y en `src/connectors/registry.ts`.
