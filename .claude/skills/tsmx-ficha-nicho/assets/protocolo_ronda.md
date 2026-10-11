# Protocolo para investigar un candidato (T02, cualquier ronda)

Fecha de observación: la fecha de hoy en formato AAAA-MM-DD (abajo aparece como <FECHA>). Idioma de todo lo escrito: español (México).

## Reglas inviolables
- NO inventes métricas, URLs, creadores, precios ni fechas. Solo registra lo que viste en una página que realmente abriste o en un resultado de búsqueda real. Si un dato no es visible, escribe "no disponible".
- NO infieras ventas, comisiones ni rentabilidad a partir de vistas.
- NO afirmes que un producto es elegible en TikTok Shop MX por verlo en Amazon o Mercado Libre. Esas ofertas sirven solo para comparar valor/precio.
- NO declares "baja competencia" ni "nicho validado". Describe lo observado.
- Separa en cada sección: HECHOS OBSERVADOS / INFERENCIAS / PROPUESTAS.
- No abras cuentas, no inicies sesión, no publiques nada, no gastes dinero.

## Herramientas
- Si el entorno tiene acceso autenticado a TikTok o al catálogo afiliado, amplía el registro según la sección "Con acceso autenticado" de SKILL.md.
- WebSearch (modo "standard"; usa "extended" si el resultado viene pobre). Puedes restringir con allowed_domains: ["tiktok.com"] para encontrar videos públicos de TikTok, y también buscar sin restricción para captar YouTube Shorts, Instagram, blogs, foros y marketplaces.
- WebFetch para abrir páginas públicas. Intenta abrir videos de TikTok (https://www.tiktok.com/@usuario/video/ID): a veces devuelven título, fecha, likes/comentarios en los metadatos; otras veces devuelven una página vacía o de inicio de sesión. Registra lo que ocurrió en cada caso. Intenta también https://www.tiktok.com/search?q=... y documenta si exige inicio de sesión.
- Para precios externos usa listados públicos de mercadolibre.com.mx y amazon.com.mx (vía WebSearch y WebFetch). Registra precio en MXN, URL y fecha. Si la página no abre, "no disponible".
- Intenta localizar páginas públicas de producto de TikTok Shop MX (por ejemplo URLs tipo https://www.tiktok.com/view/product/... o https://shop.tiktok.com/...). Si no encuentras ninguna o exigen sesión, documéntalo como limitación: el catálogo afiliado MX requiere acceso autenticado.

## Pasos
1. Define comprador, problema concreto y posibles productos (2–6 productos tipo, no marcas inventadas).
2. Formula exactamente 5 búsquedas, una por categoría: (a) problema, (b) solución, (c) producto, (d) objeción, (e) contexto mexicano. Escríbelas en español tal como las usarías en TikTok.
3. Ejecuta cada búsqueda. Examina hasta 10 resultados públicos por búsqueda. Prioriza TikTok; si TikTok no es accesible, usa otros resultados públicos y dilo.
4. Deduplica publicaciones (misma URL o mismo video) y cuenta creadores únicos.
5. Por cada resultado registra en la tabla: consulta, URL, fecha de observación, fecha de publicación (o "no disponible"), formato (video corto / artículo / listado de producto / foro / otro), métricas públicas visibles (vistas, likes, comentarios; "no disponible" si no se ven), preguntas de compra observadas en comentarios o texto ("no disponible" si no accediste a comentarios).
6. Comparación de valor externa: 3–6 productos tipo con rango de precio en MXN visto en Mercado Libre MX o Amazon MX, con URL y fecha. Sin inventar.
7. Catálogo afiliado MX: documenta el intento y el resultado (bloqueado / parcial / accesible).
8. Limitaciones: acceso, personalización (los resultados de búsqueda web no equivalen al feed de TikTok ni están personalizados a México), tamaño de muestra, idioma, fecha.
9. Evaluación: para cada una de las 5 dimensiones, nota 0–5 con justificación de 2–4 líneas, o "sin evidencia" si no puedes justificar con lo observado. Dimensiones: Demanda observable (25%), Necesidades sin contenido útil suficiente (20%), Economía del afiliado (25%), Facilidad de demostración original (15%), Calidad operativa del vendedor (15%). "Economía del afiliado" y "Calidad operativa del vendedor" normalmente quedarán "sin evidencia" porque exigen acceso al catálogo afiliado: no las rellenes con suposiciones. Calcula la puntuación parcial = Σ(peso × nota)/5 solo sobre las dimensiones evaluadas, y marca la puntuación como INCOMPLETA indicando qué dimensiones faltan.
10. Ronda 2: deja la sección vacía con el texto "Pendiente. Repetir la observación en otro día con las mismas cinco búsquedas y comparar."

## Estructura obligatoria del archivo de la ficha (Markdown)

# Ficha NN · <Nombre del candidato>

**Estado:** preliminar (ronda 1 de 2) · **Fecha de observación:** <FECHA> · **Investigador:** agente automatizado, sin acceso autenticado a TikTok ni al catálogo afiliado.

## 1. Definición
### Comprador (propuesta)
### Problema concreto (propuesta)
### Posibles productos (propuesta)

## 2. Búsquedas formuladas
| Tipo | Consulta |
(5 filas)

## 3. Observaciones — ronda 1
### 3.1 Resumen de acceso
(qué fuentes se pudieron abrir y cuáles no; cuántos resultados por búsqueda)
### 3.2 Tabla de resultados
| # | Consulta | URL | Fecha obs. | Fecha pub. | Formato | Creador/fuente | Métricas públicas | Preguntas de compra observadas |
### 3.3 Creadores únicos
(lista y conteo tras deduplicar)
### 3.4 Preguntas y objeciones de compra observadas (hechos)
### 3.5 Vacíos de contenido detectados (inferencias)

## 4. Comparación de valor en ofertas externas (no demuestra elegibilidad en TikTok Shop)
| Producto tipo | Marketplace | Precio visto (MXN) | URL | Fecha obs. |

## 5. Catálogo afiliado TikTok Shop MX
(intento, resultado, estado: no verificado)

## 6. Limitaciones

## 7. Evaluación preliminar
| Dimensión | Peso | Nota (0–5) | Justificación |
**Puntuación parcial:** X.XX sobre las dimensiones evaluadas (peso cubierto: YY %). **Puntuación: INCOMPLETA** — faltan: ...

## 8. Ronda 2
Pendiente. ...

## 9. Fuentes
(lista numerada de todas las URLs consultadas, con fecha <FECHA>)
