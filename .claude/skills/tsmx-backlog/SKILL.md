---
name: tsmx-backlog
description: Cambia el estado de un ticket T00–T10 en docs/tiktok-shop-mx/07_BACKLOG_DESARROLLADOR.md con el script scripts/backlog.py, que deja constancia en el registro de cambios. Úsala al terminar o avanzar cualquier ticket del proyecto TikTok Shop MX, cuando el usuario diga "marca T02 como hecho", "T03 bloqueado", "actualiza el backlog", "qué estado tienen los tickets", o al cerrar una entrega de fichas, matriz o requisitos. Un ticket sin registro de cambio no cuenta como actualizado.
---

# Backlog (T00–T10)

El backlog es la única fuente de verdad sobre qué está hecho. Su valor depende de que cada cambio de estado tenga fecha y motivo: así el propietario puede reconstruir por qué T02 pasó a "preliminar" sin releer commits.

## Estados

| Estado | Significado |
|---|---|
| `pendiente` | No iniciado. |
| `en curso` | Alguien trabaja en él hoy. |
| `preliminar` | Entregado con una parte bloqueada o incompleta; los pendientes están escritos en la columna Notas o en el documento de salida. |
| `hecho` | Cumple el criterio de aceptación de la tabla. Si no lo cumple, no es "hecho". |
| `bloqueado` | No puede avanzar sin una decisión o acceso; el bloqueo está registrado como P-xx en `08_REGISTRO_DECISIONES.md`. |

## Uso

```bash
python3 .claude/skills/tsmx-backlog/scripts/backlog.py --listar
python3 .claude/skills/tsmx-backlog/scripts/backlog.py T02 preliminar --motivo "Ronda 1 completa; ronda 2 y dimensiones económicas pendientes" --nota "2026-10-11. Seis fichas y 10_MATRIZ_NICHOS.md."
```

`--motivo` es obligatorio. `--nota` reemplaza la columna Notas de la fila; si se omite, la columna se conserva. `--fecha` por defecto es hoy.

## Reglas de criterio

- Antes de poner `hecho`, lee el criterio de aceptación de la fila y comprueba que el documento de salida lo cumple. "Fuentes oficiales fechadas" significa que cada requisito tiene URL y fecha; si la mitad están "vía fragmento de buscador" sin fecha, el estado correcto es `preliminar`.
- Un ticket pasa a `bloqueado` solo si existe el P-xx correspondiente. Si no existe, créalo primero con `tsmx-decision`.
- T03 en adelante no pasan a `en curso` sin una decisión D-xx del propietario que lo autorice, porque la fase de investigación prohíbe abrir cuentas y gastar.
- Tras cambiar un estado, añade una línea a la bitácora de `08_REGISTRO_DECISIONES.md` (sección 7) si la entrega es relevante para el propietario.
