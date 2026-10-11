# Convenciones de evidencia del proyecto

Estas reglas vienen de `00_LEER_PRIMERO.md` y `03_INVESTIGACION_NICHOS.md`. Existen porque el proyecto decide con dinero real sobre nichos y productos; una cifra inventada o una inferencia disfrazada de hecho produce una decisión equivocada que cuesta semanas.

## 1. Tres tipos de afirmación, siempre etiquetados

| Etiqueta | Qué es | Ejemplo |
|---|---|---|
| **[HECHO]** / "hecho" | Algo visto en una fuente concreta, con URL y fecha de observación. | "La página oficial MX dice que el piloto aplica a menos de 2,000 seguidores [S-5]." |
| **[INFERENCIA]** / "inferencia" | Conclusión del investigador a partir de hechos. Puede estar equivocada. | "La ausencia de resultados para la consulta de objeción sugiere un vacío de contenido." |
| **[PROPUESTA]** / "propuesta" | Algo que requiere decisión del propietario. | "Registrar una app pública en Partner Center." |

En tablas, usa una columna "Tipo"; en prosa, la etiqueta al inicio de la frase.

## 2. Datos desconocidos

Escribe **"no disponible"** (o "sin evidencia" en rúbricas). Nunca 0, nunca "N/A" sin explicación, nunca un valor estimado sin la palabra "estimado" y su base.

## 3. Fuentes

Cada cifra, cita o requisito lleva:
- URL completa,
- fecha de observación (la fecha en que se consultó),
- fecha de publicación o actualización si la página la muestra; si no, "no visible",
- si se leyó la página o solo un fragmento del índice del buscador (dilo: "vía fragmento de buscador").

Fuentes oficiales (dominios de TikTok, documentación de una API) y no oficiales (prensa, blogs, vendedores de datos) van en secciones separadas. Una fuente no oficial nunca sustituye a una oficial para un requisito.

## 4. Lo que no se infiere

- Ventas, comisiones o rentabilidad a partir de vistas, likes o seguidores.
- Elegibilidad en TikTok Shop a partir de ofertas en Amazon o Mercado Libre (sirven solo para comparar precio).
- Permisos de una cuenta sin acceso autenticado: quedan "NO VERIFICADO" con la ruta in-app donde se comprobarían.
- "Baja competencia" o "nicho validado": no se declaran hasta tener puntuación completa y datos de catálogo.

## 5. Rúbrica de nichos (0 a 5 por dimensión)

| Dimensión | Peso |
|---|---|
| Demanda observable | 25 % |
| Necesidades sin contenido útil suficiente | 20 % |
| Economía del afiliado | 25 % |
| Facilidad de demostración original | 15 % |
| Calidad operativa del vendedor | 15 % |

Puntuación = Σ(peso × nota) / 5, máximo 1.00. Si falta una dimensión, la puntuación es **INCOMPLETA**: reporta el parcial, el peso cubierto y qué falta. El script de `tsmx-matriz` hace este cálculo; no lo repitas a mano.

## 6. Seguridad

Nada de contraseñas, tokens, cookies de sesión, RFC, CURP ni datos bancarios en el repositorio. Si un documento necesita referirse a ellos, dice "cargado en la cuenta" o "pendiente", nunca el valor.

## 7. Estilo

Español de México, frases cortas, tablas para datos, prosa para razonamiento. Encabezados numerados como en los documentos existentes. Fecha en formato AAAA-MM-DD.
