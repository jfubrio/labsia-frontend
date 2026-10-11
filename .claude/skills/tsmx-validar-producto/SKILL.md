---
name: tsmx-validar-producto
description: Valida un producto concreto del catálogo afiliado de TikTok Shop México para el ticket T03 (variante, vendedor, elegibilidad, comisión, costos, envío, reseñas, derechos y demostración) y produce un archivo en docs/tiktok-shop-mx/investigacion/productos/ con la plantilla de assets/. Úsala cuando el usuario diga "valida este producto", "revisa este organizador del catálogo", "qué comisión da", "sirve para el piloto", pegue un enlace o captura del Affiliate Center, o pida completar las dimensiones económicas de una ficha. Antes de empezar comprueba que T03 está autorizado en el backlog; si no, explica por qué no se ejecuta y ofrece registrar el pendiente con tsmx-decision.
---

# Validación de producto (T03)

T03 es el puente entre la investigación (T02) y el piloto (T09). Aquí se obtienen los datos que las fichas no pudieron puntuar: economía del afiliado y calidad operativa del vendedor. Un producto "validado" es uno con todas las filas de la plantilla llenas con evidencia; un producto con filas "no disponible" en economía no es apto para piloto, por bueno que parezca.

## Precondiciones

1. `07_BACKLOG_DESARROLLADOR.md` muestra T03 en `en curso` o existe una D-xx en `08_REGISTRO_DECISIONES.md` que autoriza iniciarlo. Sin eso, no se ejecuta: la fase de investigación prohíbe abrir cuentas y gastar, y T03 normalmente exige una cuenta de creador verificada.
2. El propietario aporta la evidencia del catálogo (capturas fechadas en Google Drive, o el agente tiene acceso autenticado en su sesión). El agente nunca pide credenciales; si no hay acceso, el archivo se crea con "no disponible" y estado "falta información".

## Flujo

1. Copia `assets/plantilla_producto.md` (en esta carpeta) a `docs/tiktok-shop-mx/investigacion/productos/NN-<slug-producto>.md`, donde NN es el número de la ficha del nicho.
2. Llena cada tabla. Cada valor de precio, comisión, calificación o condición lleva evidencia: ruta de la captura en Drive o URL con fecha. Las ofertas de Mercado Libre y Amazon solo sirven para la fila "precio de referencia externo".
3. Calcula la comisión neta estimada con las retenciones de `09_REQUISITOS_AFILIACION_MX.md` §2 y escribe la fórmula usada. Si las retenciones del documento están en discrepancia (sección 5), calcula con ambas y muestra el rango.
4. Revisa derechos: categoría permitida, afirmaciones del listado que un video no puede repetir, marcas de terceros. Una duda aquí es motivo de "descartado" o de consulta al propietario, no de "probablemente bien".
5. Escribe el veredicto con las notas propuestas para las dos dimensiones económicas de la ficha y por qué.
6. Actualiza la ficha del nicho: sección 5 (catálogo afiliado) con enlace al archivo de producto y, si el propietario acepta las notas, la rúbrica. Luego `tsmx-matriz --write` y `tsmx-backlog`.

## Qué no hacer

- No comprar el producto ni solicitar muestras: eso lo decide el propietario con el P-05 (muestras) y P-01 (presupuesto).
- No convertir reseñas de Amazon en "calidad operativa del vendedor" de TikTok Shop; son vendedores distintos.
- No inferir ventas a partir de "vendidos" mostrados en el listado sin anotar que es una cifra autodeclarada por la plataforma.
