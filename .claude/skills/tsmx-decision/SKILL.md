---
name: tsmx-decision
description: Registra decisiones tomadas (D-xx), pendientes que requieren al propietario (P-xx), supuestos de trabajo (S-xx) y entradas de bitácora en docs/tiktok-shop-mx/08_REGISTRO_DECISIONES.md del proyecto TikTok Shop MX. Úsala cuando el usuario decida algo ("vamos con presupuesto de 3,000 pesos", "yo seré el responsable de contenido", "no registraremos app en Partner Center"), cuando surja una pregunta que solo el propietario puede responder, cuando un ticket quede bloqueado, o cuando cierre un pendiente P-xx existente. Si dudas entre anotarlo o no, anótalo: un pendiente olvidado bloquea tickets semanas después.
---

# Registro de decisiones

`08_REGISTRO_DECISIONES.md` tiene secciones numeradas: 1 Alcance, 2 Responsables, 3 Restricciones, 4 Decisiones tomadas (D-xx), 5 Decisiones pendientes (P-xx), 6 Supuestos (S-xx), 7 Bitácora. Cada tabla tiene identificadores correlativos; usa el siguiente número libre y nunca reutilices uno.

## Qué va en cada tabla

- **D-xx (decisión tomada).** Solo decisiones del propietario o instrucciones explícitas suyas. Columnas: ID, decisión, justificación, fecha, tipo ("hecho" cuando consta por escrito del propietario). Una decisión del agente por defecto no es D-xx: es una propuesta en el documento correspondiente.
- **P-xx (pendiente).** Columnas: ID, pendiente, por qué importa, qué se necesita, qué tickets bloquea. Escribe "qué se necesita" como algo que el propietario pueda responder en una línea (monto, nombre, sí/no). Nunca pidas credenciales.
- **S-xx (supuesto).** Lo que el trabajo asume sin evidencia, con el riesgo si es falso. Cuando un supuesto se confirma o se refuta, no lo borres: añade "confirmado el AAAA-MM-DD por D-xx" o "refutado".
- **Bitácora.** Una línea por evento relevante: entrega, bloqueo, cambio de entorno, decisión recibida.

## Cerrar un pendiente

Cuando el propietario responde un P-xx: crea la D-xx con la respuesta, y en la fila P-xx añade al final "Cerrado por D-xx (AAAA-MM-DD)". Luego revisa en `07_BACKLOG_DESARROLLADOR.md` si algún ticket bloqueado puede pasar a `pendiente` o `en curso` (usa `tsmx-backlog`).

## Si las secciones 2 o 3 cambian

Responsables y restricciones también se actualizan aquí (sección 2 y 3). Un responsable nuevo se añade con "hecho" si lo dijo el propietario; una restricción nueva cita de dónde sale (especificación, requisito oficial de `09_...`, política de red observada).
