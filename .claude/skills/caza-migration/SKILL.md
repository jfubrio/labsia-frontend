---
name: caza-migration
description: Crear o modificar el esquema de base de datos de CAZA IA (tablas, columnas, índices, triggers, datos iniciales, guardas de compra) y validarlo en un PostgreSQL temporal. Úsala siempre que se mencionen migraciones, SQL, PostgreSQL, columnas, índices, triggers, el esquema, los datos iniciales (seed) o las tablas caza_*, aunque la petición sea tan breve como "agrega un campo".
---

# Migraciones de CAZA IA

El esquema vive en `caza-ia/src/db/migrations/` como SQL numerado, siguiendo la convención de LABSIA (UUID como
clave, `TIMESTAMPTZ`, nombres de columna en español). Las guardas de compra están en la base de datos a propósito:
dos procesos en paralelo no pueden burlar un índice único ni un trigger.

## Editar en sitio o agregar una migración

Mientras el plan diga que nada está desplegado (fase 1 y 2), se editan `001`, `002` y `003` en sitio para que el
esquema se lea completo en pocos archivos. Desde que exista una base de datos real, solo se agregan archivos
`NNN_descripcion.sql` y nunca se tocan los anteriores. Si no está claro en qué situación estamos, pregunta o lee la
sección 6 del plan.

## Reglas del esquema

- Toda tabla nueva lleva `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()` y `creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- Prefijo `caza_` en todas las tablas.
- Estados cerrados con `CHECK (col IN (...))` y el mismo conjunto que el tipo TypeScript en `src/types.ts`. Si agregas un veredicto o estado, cámbialo en los dos lados.
- Montos `NUMERIC(12,2)`, porcentajes `NUMERIC(6,2)`, moneda `CHAR(3)`, mercado `CHAR(2)`.
- Nada que relaje `002_purchase_guards.sql` sin petición explícita del usuario. En particular: el índice parcial `uniq_active_order_per_product`, el trigger de autorización, el interruptor `caza_settings.purchases_enabled` y la inmutabilidad del audit log.
- El orden de triggers `BEFORE INSERT` es alfabético: `trg_a_purchases_enabled` debe seguir evaluándose antes que el de autorización para no consumir una autorización con el interruptor apagado.

## Validar

```bash
cd caza-ia && npm run db:check
```

Levanta un PostgreSQL temporal, aplica todas las migraciones con `ON_ERROR_STOP` y corre
`src/db/checks/guards_check.sql`. Debe terminar en `OK` con 4 errores esperados y 1 orden. Si cambias una guarda,
amplía `guards_check.sql` con el caso nuevo y actualiza el conteo esperado en `scripts/pg-check.sh`.

Si la columna nueva la escribe o lee el código, agrega el campo al tipo correspondiente en `src/types.ts`, al
repositorio en `src/db/repositories/` y a la tabla de "Base de datos" de la sección 4 del plan; luego `npm run test:db`.

## Cuando llegue Drizzle (fase 2+)

LABSIA usa Drizzle sobre PostgreSQL. Al introducirlo, el esquema en TypeScript se genera a partir de estas
migraciones SQL, no al revés: el SQL sigue siendo la fuente de verdad para índices parciales y triggers, que Drizzle
no expresa bien.
