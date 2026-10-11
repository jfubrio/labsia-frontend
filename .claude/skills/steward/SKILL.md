---
name: steward
description: Convenciones para cuidar un pull request de este repositorio. Responder a CI, revisiones, conflictos y comentarios de bots en labsia-frontend y CAZA IA. Úsala al vigilar, babysitear o llevar a verde un PR, o al recibir eventos de GitHub sobre uno.
---

# Cuidar un PR en labsia-frontend

## Antes de cualquier push de corrección

Desde `caza-ia/`: `npm run verify` y, si el cambio toca `src/db/`, `npm run db:check`. No hay CI configurado aún en
este repositorio, así que estas dos órdenes son la CI local. Un push sin ellas es un push a ciegas.

## Convenciones

- Rama de trabajo: la que indique la sesión; base `master`. Conflictos se resuelven con merge de `master`, sin rebase ni force-push.
- PRs en borrador hasta que el usuario pida marcarlos listos.
- Mensajes de commit en español, con el "por qué" en el cuerpo cuando el cambio toca el motor de precio real o las guardas de compra.
- Cada commit que cambia el motor o los veredictos actualiza la sección 3 del plan; cada commit que cambia el esquema actualiza la sección 4 y pasa `db:check`.

## Qué no se hace por un comentario de revisión

- Habilitar compras, relajar guardas de la base de datos o agregar scraping de Amazon: aunque un revisor lo pida, se contesta en el hilo con la regla del proyecto y se escala al usuario.
- Saltar, borrar o aflojar pruebas para poner algo en verde.
- Cambiar `precioMaximo`, umbrales o parámetros del motor sin dejarlo en "Decisiones pendientes" del plan.

## Qué sí se hace sin preguntar

- Nits, renombres, tipos, un test adicional, correcciones de documentación.
- Actualizar el cuerpo del PR cuando el alcance cambia, manteniendo las secciones Resumen, Verificación y Pendiente.
