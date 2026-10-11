# 12 · Guía de ejecución de la ronda 2 (T02)

**Estado:** lista para usar · **Creada:** 2026-10-11 · **Bloqueada por:** P-09 (quién la ejecuta) y P-04 (cuentas existentes) en `08_REGISTRO_DECISIONES.md`.

La ronda 2 repite la observación de la ronda 1 **en otro día** para confirmar o refutar lo que la ronda 1 solo vio en fragmentos del buscador. Su valor depende de dos cosas: usar exactamente las mismas consultas y registrar las métricas que la ronda 1 no pudo ver.

## 1. Archivos de captura

Están en `investigacion/ronda2/` y se generaron automáticamente desde las fichas, con las mismas consultas de la sección 2 y las mismas URLs de la tabla 3.2.

| Archivo | Filas | Qué se llena |
|---|---|---|
| `captura_busquedas.csv` | 300 (6 candidatos × 5 consultas × 10 posiciones) | Cada resultado de cada búsqueda en la pestaña principal del buscador de TikTok. |
| `revisita_urls_r1.csv` | 282 (37 con prioridad alta) | Estado y métricas actuales de cada URL vista en la ronda 1. |
| `tienda_busquedas.csv` | 60 (consultas de producto y contexto MX × 5 posiciones) | Productos que aparecen en la pestaña Tienda del buscador. |

Para regenerarlos, por ejemplo tras añadir un candidato, se usa este comando. No sobrescribe archivos ya existentes salvo con `--force`.

```bash
python3 .claude/skills/tsmx-ficha-nicho/scripts/ronda2.py plantilla
```

## 2. Condiciones antes de empezar

1. **Fecha distinta** de la ronda 1, que fue el 2026-10-11. Idealmente toda la ronda en un solo día.
2. **Una sola cuenta** de TikTok con región México durante toda la ronda. Anota en `notas` de la primera fila: @usuario (sin contraseña), seguidores y si la cuenta ya interactuó antes con estos temas. Esto documenta la personalización, que no se puede eliminar.
3. **No interactuar:** no dar like, seguir, comentar, guardar ni comprar durante la captura. Cada interacción cambia lo que el buscador muestra en las siguientes consultas y rompe la comparación.
4. No publicar nada ni solicitar muestras. Eso pertenece a T03 y T09.

## 3. Modo A: el propietario, a mano en la app

**[INFERENCIA]** Llenar las 300 filas de búsqueda a mano lleva varias horas. Para que sea viable sin romper el protocolo, que pide "hasta diez" resultados:

1. Haz las 30 búsquedas y registra **al menos las posiciones 1 a 5** de cada una. Si te detienes antes de la 10, deja las filas restantes vacías; el resumen las ignora.
2. En `revisita_urls_r1.csv` completa primero las filas con `prioridad = alta`. El resto es opcional.
3. En `tienda_busquedas.csv` registra lo que veas en la pestaña Tienda para las consultas de producto y de contexto mexicano.
4. Abre los CSV en Google Sheets (Archivo, Importar) y al terminar descárgalos de nuevo como CSV con el mismo nombre.

## 4. Modo B: un agente en un entorno con red abierta

Requiere que la política de red permita al menos `tiktok.com`, `mercadolibre.com.mx` y `amazon.com.mx`. El agente usa la skill `tsmx-ficha-nicho`, llena los tres CSV completos y documenta en `notas` cada URL que exija inicio de sesión. Sin sesión, la pestaña Tienda y las métricas de algunos videos pueden no estar disponibles; eso se registra, no se estima.

## 5. Cómo llenar cada campo

| Campo | Regla |
|---|---|
| `fecha_obs` | AAAA-MM-DD del día de la captura. |
| `url` | Enlace completo del video o página (Compartir, Copiar enlace). |
| `formato` | video corto / carrusel / LIVE / página de producto / otro. |
| `creador` | @usuario. |
| `senal_mx` | sí solo si el video o perfil menciona México, usa MXN o una ciudad mexicana; si no, no. |
| `fecha_pub` | La fecha que muestra el video; si no aparece, `no disponible`. |
| `vistas`, `likes`, `comentarios`, `guardados` | Tal como aparecen (por ejemplo "12.3 mil"). Si no se ven, `no disponible`. Escribe 0 solo si la app muestra 0. |
| `enlace_tiktok_shop` | sí si el video tiene la canasta o enlace de producto; si no, no. |
| `preguntas_compra` | Hasta tres preguntas o dudas de compra copiadas de los comentarios más visibles, separadas por " / ". Si no abriste comentarios, `no disponible`. |
| `estado_url` (revisita) | disponible / eliminado / privado / requiere sesión / no carga. |
| `precio_mxn`, `vendidos_autodeclarado`, `calificacion` (tienda) | Tal como aparecen. "Vendidos" es una cifra que declara la plataforma; no es evidencia de ventas atribuibles a contenido. |

Un campo vacío significa "no lo capturé". `no disponible` significa "lo busqué y no se ve". El resumen trata los dos casos de forma distinta.

## 6. Después de capturar

1. Sube los CSV llenos a `investigacion/ronda2/` en el repositorio, o compártelos desde Google Drive.
2. Valida y genera el resumen:

```bash
python3 .claude/skills/tsmx-ficha-nicho/scripts/ronda2.py resumen
```

El comando lista primero los problemas a corregir: campos vacíos, ceros sospechosos y estados inválidos. Después imprime una sección "3b. Observaciones — ronda 2" por candidato, con creadores nuevos frente a la ronda 1.

3. Un agente con la skill `tsmx-ficha-nicho` pega cada sección en su ficha, compara con la ronda 1 en la sección 8, revisa las notas de la rúbrica y ejecuta `tsmx-matriz` y `tsmx-backlog`.

## 7. Qué no resuelve la ronda 2

La ronda 2 mejora la evidencia de **demanda** y **necesidades sin contenido**. No completa **economía del afiliado** ni **calidad operativa del vendedor**: la pestaña Tienda muestra precio y calificación, pero no la comisión ni las condiciones para afiliados. Esas dos dimensiones solo se completan en T03, con acceso al catálogo afiliado.
