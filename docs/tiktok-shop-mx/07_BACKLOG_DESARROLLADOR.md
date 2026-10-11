# 07 · Backlog del desarrollador

Estado posible de un ticket: `pendiente`, `en curso`, `preliminar` (entregado con una parte bloqueada o incompleta y pendientes explícitos), `hecho`, `bloqueado`.

| Ticket | Trabajo | Criterio de aceptación | Estado | Notas |
|---|---|---|---|---|
| T00 | Preparar documentación y registro de decisiones | Alcance, responsables, restricciones y pendientes explícitos | hecho | 2026-10-11. `08_REGISTRO_DECISIONES.md`. Siete pendientes (P-01 a P-07) requieren al propietario. |
| T01 | Verificar requisitos de afiliación en México | Fuentes oficiales fechadas; requisitos públicos separados del acceso real de cada cuenta | preliminar | 2026-10-11. `09_REQUISITOS_AFILIACION_MX.md`. Fuentes oficiales obtenidas vía índice de buscador (la red del entorno bloquea `*.tiktok.com`); permisos de cuenta no verificados. Cierre: lectura directa de 8 páginas oficiales y recorrido in-app por el propietario. |
| T02 | Investigar los seis candidatos | Seis fichas, matriz comparativa, fuentes y limitaciones | preliminar | 2026-10-11, ronda 1 de 2. Seis fichas en `investigacion/` y `10_MATRIZ_NICHOS.md`. Puntuaciones incompletas (40 % del peso sin evidencia). Ronda 2 lista para ejecutar con `12_GUIA_RONDA2.md`; bloqueada por P-09 y P-04. |
| T02B | Estrategia orgánica de audiencia y alcance (añadido por D-08) | Pilares trazables a evidencia de T02, cadencia, métricas, reglas de decisión y reglas de cumplimiento; aprobada por el propietario | preliminar | `13_ESTRATEGIA_AUDIENCIA.md`. Ejecución requiere P-10 (cuenta) y P-12 (aprobación). |
| T03 | Validar productos y muestras | Variante, vendedor, elegibilidad, comisión, costos y derechos comprobados | pendiente | No iniciar sin aprobación tras T02. Requiere cuenta de creador verificada (P-04). Insumo: `11_HERRAMIENTAS_EXISTENTES.md`. |
| T04 | Diseñar MVP interno | Arquitectura y esquema de datos aprobados según necesidades observadas | pendiente | Insumo: `11_HERRAMIENTAS_EXISTENTES.md` (Affiliate Creator API, conectores activos, patrón LABSIA). |
| T05 | Implementar captura e importación | Validación, datos ausentes e importación sin duplicados | pendiente | |
| T06 | Implementar contenido y aprobación | Ediciones invalidan aprobaciones previas; acciones trazables | pendiente | |
| T07 | Implementar métricas y economía | Distingue comisiones estimadas, aprobadas y liquidadas | pendiente | |
| T08 | Implementar permisos y respaldos | Accesos restringidos y restauración comprobada | pendiente | |
| T09 | Ejecutar piloto autorizado | Contenido original, productos verificados y medición comparable | pendiente | |
| T10 | Evaluar resultados | Decisión sustentada de continuar, modificar, extender o detener | pendiente | |

## Registro de cambios de estado

| Fecha | Ticket | De | A | Motivo |
|---|---|---|---|---|
| 2026-10-11 | T00 | pendiente | hecho | Documentación y registro de decisiones creados; pendientes explícitos. |
| 2026-10-11 | T01 | pendiente | preliminar | Requisitos públicos documentados con fuentes oficiales fechadas; sin acceso directo a las páginas ni a una cuenta. |
| 2026-10-11 | T02 | pendiente | preliminar | Ronda 1 completada sin abrir páginas; ronda 2 y dimensiones económicas pendientes. |
| 2026-10-11 | T02 | preliminar | preliminar | Kit de ronda 2 preparado (12_GUIA_RONDA2.md y plantillas CSV); ronda 2 bloqueada por P-09 y P-04 |
| 2026-10-11 | T02B | pendiente | preliminar | Estrategia redactada (13_ESTRATEGIA_AUDIENCIA.md); pendiente aprobación P-12 y cuenta P-10 |

## Trabajo adicional registrado (fuera de la numeración)

| Fecha | Trabajo | Resultado |
|---|---|---|
| 2026-10-11 | Revisión de herramientas existentes aplicables (GitHub, PyPI, APIs oficiales, conectores de la sesión) | `11_HERRAMIENTAS_EXISTENTES.md`, preliminar; ninguna herramienta adoptada. |
