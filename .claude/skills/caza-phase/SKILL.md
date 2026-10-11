---
name: caza-phase
description: Arrancar, avanzar o cerrar una fase del plan de desarrollo de CAZA IA (fases 0 a 8: validación de accesos, vigilancia programada, conectores reales, comparación internacional, panel y approve, ejecución de compra, pruebas E2E, operación). Úsala siempre que el usuario hable de "siguiente paso", "fase N", "empezar la vigilancia", "habilitar compras", criterios de aceptación, entregables o del plan, aunque no diga la palabra fase.
---

# Trabajar por fases

El plan (`caza-ia/docs/PLAN_DESARROLLO.md`, sección 6) fija para cada fase objetivo, dependencias, entregables y un
criterio de aceptación verificable. Trabajar por fases evita dos errores caros: construir un conector real antes de
validar su acceso, y habilitar compras antes de que exista el flujo de aprobación.

## Al arrancar una fase

1. Lee la fila de la fase en la sección 6 y las decisiones pendientes de la sección 8 que la afectan. Si una decisión pendiente bloquea la fase, plantéala al usuario con una recomendación concreta en vez de asumir en silencio.
2. Confirma las dependencias: la fase 3 (conectores reales) necesita la fase 0 cerrada para cada conector que vayas a tocar; la fase 6 necesita la 5 (approve con UI) y la 3.
3. Escribe en el PR o en el mensaje qué entregables vas a producir y qué criterio de aceptación vas a demostrar.

## Durante la fase

- Mantén el interruptor de compras cerrado salvo en la fase 6, y ahí solo cuando el usuario lo pida por escrito; el cambio de `CAZA_PHASE` y `PURCHASES_ENABLED` queda en el `.env.example` con comentario, nunca como valor por defecto en código.
- Cada entregable nuevo lleva prueba. Si introduces infraestructura (Redis, BullMQ, Fastify), añade cómo levantarla en el README y al hook de arranque si aplica a sesiones en la nube.
- Usa las otras skills: `caza-connector` para tiendas, `caza-migration` para SQL, `caza-scenario` para el motor, `caza-verify` antes de cada push.

## Al cerrar una fase

1. Demuestra el criterio de aceptación con un comando reproducible y pega su salida en el PR (p. ej. fase 2: observaciones persistidas cada N horas; fase 6: dos intentos concurrentes → una orden).
2. Marca la fase en la tabla de la sección 6 (agrega una columna "Estado" si aún no existe) y mueve a "Decisiones pendientes" lo que quedó abierto.
3. Actualiza el README ("Estado" y "Pendientes antes de la fase siguiente") y, si cambió la arquitectura, el diagrama de la sección 1.
4. Deja listo el arranque de la siguiente: qué dependencias faltan y qué decisiones hay que tomar.

## Referencia rápida de criterios

| Fase | Se cierra cuando |
| --- | --- |
| 0 | Cada conector tiene `validado` o `descartado` con evidencia en HERRAMIENTAS_EXISTENTES.md |
| 1 | `npm run verify` y `npm run db:check` en verde; el ancla de lanzamiento se juzga falso; 0 órdenes |
| 2 | Observaciones periódicas en PostgreSQL con historial consultable y perfil de mercado recalculado |
| 3 | Precio real de tres conectores coincide con la tienda en tres verificaciones manuales |
| 4 | Precio aterrizado reproducible con tipo de cambio de Banxico del día |
| 5 | Approve y reject quedan en audit log; reject bloquea la orden |
| 6 | Dos intentos concurrentes de compra → una sola orden; interruptor documentado |
| 7 | Simulacro E2E sin compra real; alertas disparan |
| 8 | Runbook, backups y primera compra real aprobada a mano y documentada |
