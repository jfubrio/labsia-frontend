# CAZA IA

Vigilancia de precios, validación de descuentos reales, comparación internacional y compras con autorización humana.
Este directorio contiene la **fase 1** del plan ([docs/PLAN_DESARROLLO.md](docs/PLAN_DESARROLLO.md)).

**Estado:** compras deshabilitadas, vigilancia no activada, conectores reales pendientes de validación (fase 0).

## Qué incluye la fase 1

| Pieza | Ruta | Notas |
| --- | --- | --- |
| Esquema de base de datos | `src/db/migrations/001_caza_ia_schema.sql` | Productos, configuración de vigilancia, conectores, observaciones, veredictos, autorizaciones, órdenes, audit log |
| Guardas de compra | `src/db/migrations/002_purchase_guards.sql` | Índice único de una orden activa por producto, trigger que exige `approve` vigente y de un solo uso, interruptor `purchases_enabled=false`, audit log inmutable |
| Datos iniciales | `src/db/migrations/003_seed_sony_wh1000xm6.sql` | Conectores en `por_validar` y los Sony WH-1000XM6 |
| Configuración de los Sony | `src/config/products/sony-wh1000xm6.ts` | Objetivo 7,999 MXN, máximo 8,499 MXN, umbral 12 %, mercados MX y US |
| Conector con datos de prueba | `src/connectors/mock.connector.ts` + `fixtures/` | Historial sintético de 90 días y cuatro escenarios; no hace red |
| Motor de validación de descuentos | `src/engines/discount-validator.ts` | Compara contra medianas de 30 y 90 días, nunca contra el "antes" anunciado |
| Motor de comparación internacional | `src/engines/international-comparison.ts` | Precio aterrizado: tipo de cambio + impuestos de importación + envío |
| Motor de autorización | `src/engines/authorization.ts` | Propuesta → `approve`/`reject` vinculado a una oferta, con tope y vigencia |
| Ejecutor y anti-duplicados | `src/engines/purchase-executor.ts` | Interruptor por fase, idempotencia, una orden activa por producto |

## Uso

```bash
cd caza-ia
npm install
npm run typecheck
npm test
npm run demo        # corre los cuatro escenarios sin red ni base de datos
```

Aplicar las migraciones en una base de datos PostgreSQL (cuando exista una, a partir de la fase 2):

```bash
for f in src/db/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

Comprobar las guardas de compra sobre una base de datos de prueba (verificado contra PostgreSQL 16):

```bash
psql "$DATABASE_URL" -f src/db/checks/guards_check.sql
```

## Interruptor de compras

Hay tres capas y las tres deben estar abiertas para que una orden exista:

1. `CAZA_PHASE >= 6` y `PURCHASES_ENABLED=true` en el entorno. Con fase menor y `true`, el arranque falla.
2. `caza_settings.purchases_enabled = 'true'` en la base de datos. El trigger `trg_a_purchases_enabled` aborta cualquier `INSERT` en `caza_purchase_orders` mientras sea `false`.
3. Una autorización `approve` vigente, no consumida, para esa observación y con precio dentro del tope.

## Pendientes antes de la fase 2

- Pegar el texto completo del plan original en `docs/PLAN_DESARROLLO.md` donde dice `[PENDIENTE: texto original]`.
- Confirmar las decisiones de la sección 8 del plan (moneda base, umbral, vigencia, supuestos de importación).
- Confirmar el precio de lista de los Sony WH-1000XM6 en México.
- Cerrar la fase 0: marcar cada conector como `validado` o `descartado` en `caza_connectors` y en `src/connectors/registry.ts`.
