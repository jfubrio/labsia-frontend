---
name: tsmx-ficha-nicho
description: Investiga un candidato de micro nicho para TikTok Shop México y escribe o actualiza su ficha en docs/tiktok-shop-mx/investigacion/ siguiendo el protocolo de T02 (cinco búsquedas, hasta diez resultados por búsqueda, creadores únicos, preguntas de compra, precios externos, limitaciones y rúbrica de cinco dimensiones). Úsala cuando el usuario pida investigar un nicho, hacer la ronda 2, agregar un candidato nuevo, actualizar una ficha, "investigar cocinas pequeñas", "ronda 2 de mascotas" o cualquier frase parecida, aunque no diga "ficha". No la uses para la matriz comparativa (tsmx-matriz) ni para validar un producto concreto (tsmx-validar-producto).
---

# Ficha de nicho (T02)

Una ficha es el registro de **lo que se observó** sobre un candidato en una fecha. Dos fichas del mismo candidato en días distintos deben poder compararse línea por línea; por eso la estructura es fija y las búsquedas se repiten idénticas.

Lee `references/convenciones.md` de la skill `tiktok-shop-mx` si no lo hiciste en esta sesión, y `assets/protocolo_ronda.md` (en esta carpeta): contiene el protocolo paso a paso y la estructura obligatoria del archivo. El protocolo está escrito para un investigador sin acceso autenticado; si en tu sesión sí hay acceso a TikTok o al catálogo afiliado, el protocolo se amplía (ver §"Con acceso"), nunca se recorta.

## Flujo

1. **Ubica la ficha.** `docs/tiktok-shop-mx/03_INVESTIGACION_NICHOS.md` lista los candidatos y el nombre de archivo de cada ficha (`NN_slug.md`). Un candidato nuevo recibe el siguiente número y se añade a esa tabla.
2. **Decide si es ronda 1 o ronda 2.** Si la ficha existe y su sección 8 dice "Pendiente", es ronda 2: reutiliza **exactamente** las cinco consultas de la sección 2, añade una subsección "3b. Observaciones — ronda 2" con la misma tabla, y en la sección 8 compara qué cambió (creadores nuevos, métricas, fechas). No reescribas la ronda 1.
3. **Ejecuta las búsquedas.** Una por tipo (problema, solución, producto, objeción, contexto mexicano). Prioriza TikTok (`allowed_domains: ["tiktok.com"]`), luego sin restricción para captar YouTube, foros y marketplaces. Hasta diez resultados por búsqueda.
4. **Intenta abrir lo que importa.** Videos de TikTok con URL, páginas de producto, listados de Mercado Libre y Amazon MX. Si el proxy responde 403 o `ENOTFOUND`, anótalo una vez en "3.1 Resumen de acceso" y marca cada dato como "vía fragmento de buscador". No lo intentes veinte veces: dos intentos por dominio bastan para documentar el bloqueo.
5. **Registra sin inventar.** Cada fila de la tabla de resultados necesita URL real. Métricas, fechas y comentarios que no viste: "no disponible". Un precio solo cuenta con URL y fecha.
6. **Evalúa.** Nota 0–5 por dimensión con justificación de dos a cuatro líneas que cite filas de la tabla. "Economía del afiliado" y "Calidad operativa del vendedor" solo se puntúan con datos del catálogo afiliado MX; sin acceso, "sin evidencia". Deja el cálculo de la puntuación al script de `tsmx-matriz`, pero escribe la línea "Puntuación parcial" con el formato del protocolo para que el script la lea.
7. **Cierra.** Lista de fuentes numerada con fecha, sección "Ronda 2" con lo pendiente, y luego: `tsmx-matriz` para regenerar la matriz y `tsmx-backlog` si cambia el estado de T02.

## Con acceso autenticado o red abierta

Si puedes abrir TikTok: registra vistas, likes, comentarios, fecha de publicación y las tres preguntas de compra más repetidas en comentarios de cada video (con cita textual breve). Si puedes abrir el catálogo afiliado MX: para cada producto tipo anota precio, comisión, envío, vendedor, calificación del vendedor y si ofrece muestras, con captura fechada guardada fuera del repositorio (Google Drive) y referencia en la ficha. Eso habilita puntuar las dos dimensiones económicas.

## Errores que ya ocurrieron y conviene evitar

- Usar la conclusión redactada por el buscador como evidencia. Solo cuentan títulos, URLs y fragmentos; la síntesis del motor no es una fuente.
- Cambiar las consultas entre rondas "para mejorar resultados". Rompe la comparación; si una consulta es mala, añade una sexta marcada como nueva.
- Asignar nota de demanda alta porque hay muchos videos. Muchos videos de España no son demanda en México.
- Dejar la puntuación como "0.39" sin decir que el máximo alcanzable con 60 % de peso es 0.60.
