# 00 · LEER PRIMERO

**Proyecto:** TikTok Shop México mediante creadores afiliados, sin inventario propio.
**Propietario:** Juan Fuentes.
**Ubicación en el repositorio:** `docs/tiktok-shop-mx/`. Los archivos de LABSIA (`labsia-landing-archive/`, `uploads/`) no forman parte de este proyecto y no deben modificarse desde aquí.

## Objetivo

Identificar micro nichos comercialmente viables, probar contenido original y medir **comisiones liquidadas menos costos**. Las vistas por sí solas no validan el negocio.

La segmentación se hará por **problema de compra, audiencia y profundidad del contenido**; no por supuesta inteligencia del público.

## Orden de ejecución

| Paso | Ticket | Descripción |
|---|---|---|
| 1 | T00 | Documentar alcance, responsables y decisiones pendientes. |
| 2 | T01 | Verificar requisitos públicos vigentes y posibilidades de acceso. |
| 3 | T02 | Investigar seis candidatos con evidencia trazable. |
| 4 | — | Seleccionar candidatos **únicamente** después de comparar los resultados. |
| 5 | T03+ | Validar productos, acceso de afiliación y economía **antes** de desarrollar automatizaciones. |

## Reglas de redacción para todos los documentos

1. Separa siempre **hechos observados**, **inferencias** y **propuestas**. Cada sección o tabla debe indicar a cuál de los tres pertenece.
2. Los datos desconocidos quedan como **"no disponible"**; nunca como cero.
3. Toda cifra lleva fuente, URL y fecha de observación.
4. No se infieren ventas, comisiones ni rentabilidad a partir de vistas.
5. Los permisos que solo pueden comprobarse dentro de una cuenta se registran como **no verificados** mientras no exista acceso autenticado.
6. Nunca se guardan contraseñas, tokens ni credenciales en el repositorio.

## Mapa de documentos

| Archivo | Contenido |
|---|---|
| `00_LEER_PRIMERO.md` | Este documento. Objetivo, orden y reglas. |
| `03_INVESTIGACION_NICHOS.md` | Protocolo de investigación de los seis candidatos y rúbrica de evaluación. |
| `07_BACKLOG_DESARROLLADOR.md` | Tickets T00–T10, criterios de aceptación y estado. |
| `08_REGISTRO_DECISIONES.md` | Resultado de T00: alcance, responsables, restricciones y pendientes. |
| `09_REQUISITOS_AFILIACION_MX.md` | Resultado de T01: requisitos públicos con fuentes fechadas y permisos de cuenta no verificados. |
| `10_MATRIZ_NICHOS.md` | Resultado de T02: matriz comparativa de los seis candidatos. |
| `11_HERRAMIENTAS_EXISTENTES.md` | Revisión preliminar de APIs oficiales, herramientas open source y conectores aplicables a T03–T08. |
| `investigacion/` | Una ficha por candidato con las observaciones de T02 (`01_` a `06_`). |

## Estado al 2026-10-11

T00 hecho. T01 y T02 preliminares. Limitación principal de la sesión: la política de red del entorno bloqueó el acceso directo a `tiktok.com`, Mercado Libre y Amazon México, así que toda la evidencia proviene de fragmentos del índice del buscador. Ver detalles en cada documento.

## Skills de proyecto (Claude Code)

En `.claude/skills/` hay skills que encapsulan el flujo de este proyecto. Se cargan solas al trabajar en el repositorio con Claude Code o Cowork.

| Skill | Para qué |
|---|---|
| `tiktok-shop-mx` | Punto de entrada: convenciones de evidencia y enrutamiento al resto. |
| `tsmx-ficha-nicho` | Investigar un candidato (ronda 1 o 2) y escribir su ficha con el protocolo de T02. |
| `tsmx-matriz` | Regenerar la tabla de `10_MATRIZ_NICHOS.md` desde las fichas (`scripts/matriz.py`). |
| `tsmx-backlog` | Cambiar estados de tickets con registro de cambios (`scripts/backlog.py`). |
| `tsmx-decision` | Registrar decisiones, pendientes y supuestos en `08_REGISTRO_DECISIONES.md`. |
| `tsmx-requisitos` | Verificar y actualizar T01 con fuentes oficiales fechadas. |
| `tsmx-validar-producto` | Plantilla y flujo de T03; solo con autorización registrada. |

## Restricciones operativas

- No abrir cuentas, publicar contenido, contratar servicios ni gastar dinero durante T00–T02.
- No ejecutar T03 en adelante sin aprobación explícita del propietario tras revisar T02.
