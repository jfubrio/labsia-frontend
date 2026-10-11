---
name: tsmx-matriz
description: Recalcula y regenera la tabla comparativa de docs/tiktok-shop-mx/10_MATRIZ_NICHOS.md leyendo las rúbricas de todas las fichas en docs/tiktok-shop-mx/investigacion/ con el script scripts/matriz.py. Úsala después de crear o modificar cualquier ficha de nicho, cuando el usuario pida "actualiza la matriz", "compara los nichos", "cuál va mejor", "recalcula puntuaciones" o cuando una puntuación de ficha y la matriz no coincidan. No decide ni recomienda un nicho: solo ordena la evidencia.
---

# Matriz de nichos

La matriz es un derivado de las fichas: nunca se edita a mano la tabla de puntuaciones, porque una cifra copiada mal invalida la comparación. El script la calcula y la escribe entre marcadores; el resto del documento (lectura, limitaciones, qué falta) sí se redacta.

## Uso

```bash
python3 .claude/skills/tsmx-matriz/scripts/matriz.py            # imprime la tabla y avisa de problemas
python3 .claude/skills/tsmx-matriz/scripts/matriz.py --write    # reemplaza el bloque entre <!-- matriz:inicio --> y <!-- matriz:fin -->
python3 .claude/skills/tsmx-matriz/scripts/matriz.py --json     # salida estructurada para otros usos
```

El script busca en cada ficha la tabla `| Dimensión | Peso | Nota (0–5) | Justificación |`, acepta notas enteras de 0 a 5 o "sin evidencia" (también "s/e"), y calcula Σ(peso × nota)/5 sobre las dimensiones evaluadas, el peso cubierto y el máximo alcanzable. Marca INCOMPLETA cuando falta cualquier dimensión. Si una ficha no tiene la tabla o tiene una nota fuera de rango, lo reporta y no escribe nada.

## Después de regenerar

1. Lee la tabla nueva y revisa que cada fila cite la ficha correcta.
2. Actualiza a mano la sección "Lectura de la matriz" solo si el orden o las brechas cambiaron. Describe diferencias en términos de notas por dimensión, no de "ganadores": con 40 % del peso sin evidencia, una diferencia de 0.05 no significa nada, y el documento debe decirlo.
3. Si alguna puntuación pasó a completa (las cinco dimensiones con nota), cambia el estado del documento de "PRELIMINAR" a "RONDA N COMPLETA" y anota en `08_REGISTRO_DECISIONES.md` que ya es posible comparar.
4. Encadena `tsmx-backlog` si el estado de T02 cambia.

## Qué no hacer

- No elegir "el mejor" ni sugerir empezar por uno. Esa decisión es del propietario y requiere puntuación completa más T03.
- No rellenar "sin evidencia" con una nota intermedia "para poder comparar".
