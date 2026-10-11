# CAZA IA

Vigilancia de precios, **precio real de mercado a partir del comportamiento de la oferta competitiva en el tiempo**, validación de descuentos, comparación internacional y compras con autorización humana. El precio de lista, el de lanzamiento y el "antes" que anuncia una tienda nunca son referencia.
Este directorio contiene la **fase 1** del plan ([docs/PLAN_DESARROLLO.md](docs/PLAN_DESARROLLO.md)).

**Estado:** compras deshabilitadas, vigilancia no activada, conectores reales pendientes de validación (fase 0).

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
npm run verify      # typecheck + pruebas + demo sin red (lo que se corre antes de cada push)
npm run db:check    # aplica las migraciones en un PostgreSQL temporal y comprueba las guardas de compra
npm run profile     # imprime el perfil de precio real de mercado del fixture y su serie diaria
npm run demo        # recorre los seis escenarios sin red ni base de datos
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

## Pendientes antes de la fase 2

- Revisar [docs/HERRAMIENTAS_EXISTENTES.md](docs/HERRAMIENTAS_EXISTENTES.md) y resolver las tareas de fase 0 que lista (cuenta de Amazon Associates, Keepa, Mercado Libre, Sony Store, Banxico, Best Buy).

- Pegar el texto completo del plan original en `docs/PLAN_DESARROLLO.md` donde dice `[PENDIENTE: texto original]`.
- Confirmar las decisiones de la sección 8 del plan (moneda base, umbral, vigencia, supuestos de importación).
- Confirmar el precio de lista de los Sony WH-1000XM6 en México.
- Cerrar la fase 0: marcar cada conector como `validado` o `descartado` en `caza_connectors` y en `src/connectors/registry.ts`.
