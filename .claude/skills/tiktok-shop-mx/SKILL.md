---
name: tiktok-shop-mx
description: Punto de entrada y convenciones del proyecto "TikTok Shop México con creadores afiliados, sin inventario" documentado en docs/tiktok-shop-mx/. Úsala siempre que el usuario mencione TikTok Shop, afiliados, micro nichos, fichas de nicho, la matriz de nichos, el backlog T00–T10, el registro de decisiones, requisitos de afiliación o cualquier archivo de docs/tiktok-shop-mx/, aunque no diga "skill". Carga las convenciones de evidencia antes de escribir o modificar cualquier documento del proyecto y enruta a la skill específica (tsmx-ficha-nicho, tsmx-matriz, tsmx-backlog, tsmx-decision, tsmx-requisitos, tsmx-validar-producto, tsmx-audiencia).
---

# TikTok Shop MX · skill raíz

Este proyecto vive en `docs/tiktok-shop-mx/`. Su objetivo es identificar micro nichos viables y medir **comisiones liquidadas menos costos**; las vistas no validan nada. Lee `docs/tiktok-shop-mx/00_LEER_PRIMERO.md` si no lo has leído en esta sesión.

## Antes de tocar cualquier documento

Lee `references/convenciones.md` (en esta carpeta). Resume las reglas que todos los documentos del proyecto siguen: separar hechos, inferencias y propuestas; "no disponible" en lugar de cero; fuentes con URL y fecha; nada de credenciales; nunca inferir ventas desde vistas. Los documentos existentes ya las aplican y un documento que las rompa se nota de inmediato.

## Qué skill usar

| Si el usuario quiere... | Usa |
|---|---|
| Investigar un candidato de nicho, hacer la ronda 2, crear o actualizar una ficha en `investigacion/` | `tsmx-ficha-nicho` |
| Recalcular o regenerar `10_MATRIZ_NICHOS.md` a partir de las fichas | `tsmx-matriz` |
| Cambiar el estado de un ticket T00–T10 en `07_BACKLOG_DESARROLLADOR.md` | `tsmx-backlog` |
| Registrar una decisión (D-xx), un pendiente (P-xx) o un supuesto (S-xx) en `08_REGISTRO_DECISIONES.md` | `tsmx-decision` |
| Verificar o actualizar requisitos de afiliación (T01, `09_REQUISITOS_AFILIACION_MX.md`) | `tsmx-requisitos` |
| Validar un producto concreto del catálogo afiliado (T03) | `tsmx-validar-producto` |
| Planificar videos, registrar métricas de TikTok Studio o decidir con la fase de audiencia (T02B) | `tsmx-audiencia` |

Una tarea suele tocar varias: terminar una ficha implica recalcular la matriz y anotar el estado del ticket. Encadena las skills en ese orden y deja un solo commit por entrega.

## Restricciones operativas que no cambian con la fase

- No abrir cuentas, publicar contenido, contratar servicios ni gastar dinero sin instrucción explícita del propietario.
- No ejecutar T03 en adelante mientras el backlog diga que T02 está preliminar y no exista aprobación registrada en `08_REGISTRO_DECISIONES.md`.
- Los archivos de LABSIA (`labsia-landing-archive/`, `uploads/`) no forman parte del proyecto; no se tocan desde aquí.

## Entorno

Si una herramienta de red falla con 403 del proxy o `ENOTFOUND`, no es un error del sitio: la política de red del entorno bloquea ese dominio. Regístralo como limitación en el documento (sección "Limitaciones") y sigue con lo que la búsqueda web sí permita. No sustituyas datos bloqueados con suposiciones.

## Al cerrar una entrega

1. Actualiza el estado del ticket con `tsmx-backlog`.
2. Añade una línea a la bitácora de `08_REGISTRO_DECISIONES.md`.
3. Verifica con `git status` que solo cambió `docs/tiktok-shop-mx/` (y `.claude/` si editaste skills).
4. Commit con prefijo `docs(tiktok-shop-mx):` y resumen de hallazgos, bloqueos y siguiente paso.
