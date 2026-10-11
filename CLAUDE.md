# labsia-frontend

Monorepo de LABSIA. Hoy contiene la landing (`labsia-landing-archive/`), documentación de diseño en `uploads/`
y el módulo **CAZA IA** en `caza-ia/`, que es donde ocurre el desarrollo activo.

## CAZA IA en una línea

Vigilancia de precios con **precio real de mercado** calculado a partir del comportamiento de la oferta competitiva
en el tiempo, validación de descuentos contra ese precio, comparación internacional y compras solo con autorización
humana. Plan: `caza-ia/docs/PLAN_DESARROLLO.md`. Herramientas y decisiones de integración: `caza-ia/docs/HERRAMIENTAS_EXISTENTES.md`.

## Reglas que no se negocian

1. **El precio real sale del análisis en el tiempo**, nunca del precio de lista, de lanzamiento ni del "antes" anunciado. El motor es `caza-ia/src/engines/market-price.ts`; todo veredicto se juzga contra él.
2. **Compras deshabilitadas** hasta la fase 6: `PURCHASES_ENABLED=false`, `CAZA_PHASE < 6` y `caza_settings.purchases_enabled='false'`. No aflojes ninguna de las tres capas sin que el usuario lo pida de forma explícita.
3. **Sin scraping de Amazon** ni herramientas de evasión anti-bot. Conectores reales solo vía API oficial o tiendas cuyos términos lo permitan, y solo tras validarlos en fase 0.
4. **Anti-duplicados en la base de datos**, no solo en código (índice único parcial y triggers en `002_purchase_guards.sql`).
5. Ninguna propuesta de compra con confianza `baja` o `sin_historial`.
6. **Ningún endpoint de la API compra.** La API solo lista, aprueba, rechaza y activa vigilancia; una aprobación habilita al ejecutor, no ejecuta.

## Comandos (desde `caza-ia/`)

En local corre `npm install` la primera vez; en sesiones en la nube lo hace el hook de arranque.

```bash
npm run verify        # typecheck + suite unitaria + demo sin red (antes de cada push)
npm run db:check      # aplica migraciones en un PostgreSQL temporal y prueba las guardas
npm run test:db       # pruebas de integración de la vigilancia (PostgreSQL temporal); obligatorio si tocaste src/db o src/watch
npm run phase2:check  # criterio de aceptación de la fase 2 (dos ciclos de vigilancia persistidos)
npm run phase2:worker-check  # programador BullMQ + worker con Redis temporal; obligatorio si tocaste src/watch/scheduler.ts
npm run phase5:check  # API del operador: approve en audit log, reject bloquea orden; obligatorio si tocaste src/api o src/services
npm run profile       # imprime el perfil de precio real del fixture (ajuste de parámetros)
npm test -- tests/market-price.test.ts   # una sola suite
```

Infraestructura: PostgreSQL vía `DATABASE_URL` (fase 2+); Redis vía `REDIS_URL` solo para el programador BullMQ
(`npm run watch:worker`). Las pruebas no necesitan Redis.

## Convenciones

- Node 22, TypeScript estricto, ESM (`.js` en los imports relativos), Vitest, zod, `pg` con SQL explícito, BullMQ, Fastify. Sin frameworks nuevos sin acordarlo.
- Migraciones SQL numeradas en `src/db/migrations/`; mientras nada esté desplegado se editan en sitio; después, solo se agregan.
- Español en documentación, mensajes y nombres de columnas; inglés en identificadores de código.
- Datos de prueba sintéticos en `src/connectors/fixtures/`; nunca datos reales de tiendas.
- Al cambiar el motor de precio real o la lógica de veredictos, actualiza la sección 3 del plan y el ejemplo numérico.

## Skills del proyecto (`.claude/skills/`)

| Skill | Úsala cuando |
| --- | --- |
| `caza-verify` | vas a hacer push, o tocaste motores, SQL o fixtures |
| `caza-scenario` | ajustas el motor de precio real, agregas un escenario o un producto de prueba |
| `caza-connector` | agregas o validas un conector de tienda (fase 0 y fase 3) |
| `caza-migration` | agregas o cambias tablas, índices, triggers o datos iniciales |
| `caza-phase` | arrancas o cierras una fase del plan |
| `steward` | cuidas el PR: CI, revisiones, conflictos |
