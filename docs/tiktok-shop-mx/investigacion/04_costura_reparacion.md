# Ficha 04 · Accesorios de costura y reparación doméstica

**Estado:** preliminar (ronda 1 de 2) · **Fecha de observación:** 2026-10-11 · **Investigador:** agente automatizado, sin acceso autenticado a TikTok ni al catálogo afiliado.

> Aviso de método: en esta sesión **ninguna página web pudo abrirse** (ni TikTok, ni Mercado Libre MX, ni Amazon MX, ni medios). WebFetch devolvió `ENOTFOUND` y `curl` recibió 403 del proxy de salida para todos los hosts probados (detalle en §3.1 y §6). Todo lo registrado proviene **exclusivamente de títulos, URLs y fragmentos devueltos por el buscador (WebSearch)**. Ninguna métrica fue verificada en la página original.

## 1. Definición

### Comprador (propuesta)
PROPUESTA (no observada directamente): persona en México sin habilidades de costura que necesita resolver una reparación menor urgente (botón caído, bastilla descosida, roto pequeño en playera, parche en rodilla de mezclilla, broche de cierre) sin ir a la costurera; estudiantes/universitarios que viven solos, padres con uniformes escolares, personas que viajan. Secundario: aficionado que empieza a coser.

### Problema concreto (propuesta)
Prenda inutilizada por un daño pequeño; la costurera cuesta tiempo y dinero (una página de descubrimiento de TikTok sobre "lista de precios de arreglos de costura 2025 en México" cita bastillas de uniforme en $30, según fragmento); no se tiene aguja/hilo a mano ni se sabe cuál usar; los parches termoadhesivos se despegan al lavar.

### Posibles productos (propuesta)
1. Kit de costura portátil (estuche con agujas, hilos, tijera, descosedor, cinta métrica; ~100–172 piezas).
2. Mini kit de bolsillo/viaje con cierre.
3. Cinta termoadhesiva para dobladillos y parches (fusible / "cinta de fusión").
4. Parches termoadhesivos (lisos o bordados) y entretela adhesiva.
5. Mini máquina de coser de mano o portátil.
6. Kit de broches de presión con herramienta, enhebrador de agujas.

## 2. Búsquedas formuladas

| Tipo | Consulta |
|---|---|
| (a) Problema | se me rompió la ropa cómo arreglar sin costurera |
| (b) Solución | cómo coser un botón a mano fácil |
| (c) Producto | kit de costura portátil tiktok shop |
| (d) Objeción | parche termoadhesivo se despega ropa |
| (e) Contexto mexicano | kit de costura México dónde comprar |

Cada consulta se ejecutó con WebSearch restringida a `tiktok.com` y, además, sin restricción de dominio (variantes: "cómo arreglar ropa rota sin coser en casa", "coser botón a mano paso a paso principiantes", "kit de costura portátil mercadolibre.com.mx precio", "parche termoadhesivo se despega al lavar opiniones", "kit de costura precio México amazon.com.mx"). Búsquedas complementarias: "kit de costura mini costurero arreglar ropa tiktok México" (modo extendido, tiktok.com), "zurcido invisible pantalón mezclilla tiktok", "tiktok.com/view/product kit de costura México", "\"TikTok Shop\" México kit de costura OR mini máquina de coser video", y tres búsquedas de precio restringidas a amazon.com.mx / mercadolibre.com.mx / xataka.com.mx.

## 3. Observaciones — ronda 1

### 3.1 Resumen de acceso

HECHOS OBSERVADOS
- **WebSearch** funcionó en todas las consultas. Resultados devueltos por búsqueda restringida a tiktok.com: (a) 10, (b) 10, (c) **2** (solo páginas de descubrimiento de máquinas de coser; ningún kit), (d) 10, (e) 10. Búsquedas sin restricción: (a) 10, (b) 9, (c) 10, (d) 9, (e) 10. Complementarias: 10 + 10 + 4 + 9 + 10 + 10 + 10.
- **WebFetch a TikTok** (`@anali.aldebaran/video/7556376442599198008`, `@academiacintialeon/video/7358511490644856070`, `@cosiendoendowntown/video/7068412393352629510`, `https://www.tiktok.com/discover/maquina-de-costura-portatil-tiktok-shop`, `https://shop.tiktok.com/mx`, `https://www.tiktok.com/search?q=...`): todos `getaddrinfo ENOTFOUND`. `curl` vía proxy: `CONNECT tunnel failed, response 403`; el estado del proxy registra "policy denial" para `www.tiktok.com:443` y `shop.tiktok.com:443`. **No se pudo comprobar si TikTok exige inicio de sesión.**
- **WebFetch a Mercado Libre MX, Amazon MX, El Universal MX**: mismo bloqueo. Incluso `https://example.com/` fue rechazado. **0 páginas abiertas.**

### 3.2 Tabla de resultados

Fecha de observación para todas las filas: 2026-10-11. "Fecha pub." = no disponible salvo que la URL/fragmento la contenga. Métricas: "no disponible" salvo mención en fragmento. Preguntas de compra: "no disponible (comentarios no accesibles)" salvo texto en el título/fragmento.

| # | Consulta | URL | Fecha obs. | Fecha pub. | Formato | Creador/fuente | Métricas públicas | Preguntas de compra observadas |
|---|---|---|---|---|---|---|---|---|
| 1 | (a) tiktok | https://www.tiktok.com/discover/coser-un-roto-sin-que-se-note | 2026-10-11 | no disponible | página de descubrimiento | TikTok (agregada) | no disponible | Título refleja la necesidad "sin que se note" |
| 2 | (a) tiktok | https://www.tiktok.com/discover/como-arreglar-un-agujero-en-tu-ropa-sin-coser | 2026-10-11 | no disponible | página de descubrimiento | TikTok (agregada); fragmento: "entretela adhesiva o fiselina… se plancha"; "cinta de dobladillo y un trozo de tela de sobra con plancha" | no disponible | Necesidad "sin coser" |
| 3 | (a) tiktok | https://www.tiktok.com/discover/como-arreglar-tela-rota | 2026-10-11 | no disponible | página de descubrimiento | TikTok (agregada) | no disponible | no disponible |
| 4 | (a) tiktok | https://www.tiktok.com/@anali.aldebaran/video/7556376442599198008 | 2026-10-11 | no disponible | video corto | @anali.aldebaran — "Cómo arreglar ropa rasgada sin coser rápidamente"; fragmento: recomienda el producto "Mendafácil" con plancha; advierte que tela desgastada se rasga más | no disponible | Objeción implícita: ¿sirve en tela desgastada? |
| 5 | (a) tiktok | https://www.tiktok.com/discover/c%C3%B3mo-coser-ropa-rota-con-un-hilo | 2026-10-11 | no disponible | página de descubrimiento | TikTok (agregada) | no disponible | no disponible |
| 6 | (a) tiktok | https://www.tiktok.com/discover/como-coser-con-hilo-y-aguja-algo-roto | 2026-10-11 | no disponible | página de descubrimiento | TikTok (agregada); fragmento: "puntada de escalera (invisible)", "punto atrás" | no disponible | no disponible |
| 7 | (a) tiktok | https://www.tiktok.com/discover/como-reparar-una-camisa-rota | 2026-10-11 | no disponible | página de descubrimiento | TikTok (agregada) | no disponible | no disponible |
| 8 | (a),compl. | https://www.tiktok.com/discover/zurcido-invisible-a-mano-en-rasgado-de-pantal%C3%B3n | 2026-10-11 | no disponible | página de descubrimiento | TikTok (agregada) | no disponible | no disponible |
| 9 | (a) tiktok | https://www.tiktok.com/discover/como-coser-un-hueco-roto-sin-que-se-note | 2026-10-11 | no disponible | página de descubrimiento | TikTok (agregada) | no disponible | no disponible |
| 10 | (a) tiktok | https://www.tiktok.com/discover/como-arreglar-el-broche-de-un-cierre | 2026-10-11 | no disponible | página de descubrimiento | TikTok (agregada); fragmento: "kits de cierres de cinco garras que se fijan con una herramienta de presión, sin aguja" | no disponible | no disponible |
| 11 | (b) tiktok | https://www.tiktok.com/@academiacintialeon/video/7358511490644856070 | 2026-10-11 | no disponible | video corto (tutorial) | @academiacintialeon — "Cómo coser un botón: tutorial paso a paso" | no disponible | no disponible |
| 12 | (b) tiktok | https://www.tiktok.com/@costuraycreativid/video/7363324284372045062 | 2026-10-11 | no disponible | video corto (tutorial) | @costuraycreativid — "Cómo coser un botón: guía fácil"; fragmento: "basta con una aguja, un carrete de hilo y un dedal" | no disponible | no disponible |
| 13 | (b) tiktok | https://www.tiktok.com/@asundominguezmoda/video/7420790842287344928 | 2026-10-11 | no disponible | video corto (tutorial) | @asundominguezmoda — "¡Hoy os enseño a coser un botón!… tanta gente que me seguís y decís que 'no sabéis coser ni un botón'" (España) | no disponible | Texto: audiencia que "no sabe coser ni un botón" |
| 14 | (b) tiktok | https://www.tiktok.com/@eduardorealcouture/video/7370103524140567813 | 2026-10-11 | no disponible | video corto (tutorial) | @eduardorealcouture — "Cómo coser un botón de 4 huecos" | no disponible | no disponible |
| 15 | (b) tiktok | https://www.tiktok.com/discover/como-coser-botones-a-peluche-articulacion ; /discover/c%C3%B3mo-coser-un-boton-en-un-peluche ; /discover/como-coser-boton-con-aguja-de-4-agujeros ; /discover/como-colocar-botao-na-blusa (PT) ; /discover/arreglar-un-boton-de-su-camisa ; /discover/como-coser-boton-pantalon-mezclilla-con-hilo | 2026-10-11 | no disponible | páginas de descubrimiento | TikTok (agregada); fragmento de "arreglar un botón de su camisa": "colocar un alfiler entre el botón y la tela… envolver el hilo por detrás unas seis veces" | no disponible | Título "botón pantalón mezclilla con hilo" sugiere duda sobre botones de jeans |
| 16 | (c) tiktok | https://www.tiktok.com/discover/maquina-de-costura-portatil-tiktok-shop | 2026-10-11 | no disponible | página de descubrimiento (portugués/español) | TikTok (agregada); fragmento: vendedor brasileño "R$19,99"; "12 puntadas, overlock… kit incluido… 25 % de descuento en TikTok Shop" (país no identificado) | no disponible | no disponible |
| 17 | (c),compl. | https://www.tiktok.com/discover/mini-maquina-de-costura | 2026-10-11 | no disponible | página de descubrimiento | TikTok (agregada); fragmento: máquina "ZF-SM202, dos velocidades, luz, reversa, pilas o corriente" con "P. Unitario: $7.54" sin moneda ni tienda | no disponible | no disponible |
| 18 | (d) tiktok | https://www.tiktok.com/discover/como-quitar-parche-termoadhesivo ; https://www.tiktok.com/discover/como-quitar-un-parche-termoadhesivo-ropa | 2026-10-11 | no disponible | páginas de descubrimiento | TikTok (agregada) | no disponible | Necesidad inversa: cómo quitarlo |
| 19 | (d) tiktok | https://www.tiktok.com/@agujitasdesbordadas/video/6880313351621102849 | 2026-10-11 | no disponible (ID de video sugiere 2020) | video corto (tutorial) | @agujitasdesbordadas — "mini tutorial sobre cómo volver termoadhesivos los parches" #bordado #janome | no disponible | no disponible |
| 20 | (d) tiktok | https://www.tiktok.com/discover/como-pegar-los-parches-para-ropa-de-la-parisina | 2026-10-11 | no disponible | página de descubrimiento (**MX**: Parisina es cadena de mercería mexicana) | TikTok (agregada) | no disponible | Duda de uso: cómo pegar parches comprados en Parisina |
| 21 | (d) tiktok | https://www.tiktok.com/discover/como-pegar-un-parche-sin-pegamento-para-ropa | 2026-10-11 | no disponible | página de descubrimiento | TikTok (agregada) | no disponible | no disponible |
| 22 | (d) tiktok | https://www.tiktok.com/discover/como-se-pegan-los-parches-de-temu-en-la-ropa | 2026-10-11 | no disponible | página de descubrimiento | TikTok (agregada) | no disponible | Duda de uso: parches comprados en Temu |
| 23 | (d) tiktok | https://www.tiktok.com/@angel.villarce/video/7377459155646385414 | 2026-10-11 | no disponible | video corto | @angel.villarce — "Aprende a hacer parches creativos para tu ropa" | no disponible | no disponible |
| 24 | (d) tiktok | https://www.tiktok.com/@cosiendoendowntown/video/7068412393352629510 | 2026-10-11 | no disponible | video corto | @cosiendoendowntown — "Cinta de fusión de tela para pegar los parches #parcheentrepiernas #parcheenjeans #costurafácil" | no disponible | Caso de uso: parche en entrepierna de jeans |
| 25 | (d) tiktok | https://www.tiktok.com/tag/parchebordado ; /discover/como-van-los-parches-del-uniforme-t3-fa | 2026-10-11 | no disponible | hashtag / página de descubrimiento | TikTok | no disponible | no disponible |
| 26 | (d) tiktok (fragmento agregado) | (resumen del buscador sobre las páginas anteriores, sin URL única) | 2026-10-11 | no disponible | — | TikTok (agregada) | no disponible | "Si el parche se despega después de lavar, planchar nuevamente"; "dejar enfriar 30 minutos"; "reforzar con unas puntadas en los bordes"; "para tejidos gruesos utiliza dos tiras juntas"; "lavar a máquina a 60 °C máximo y no utilizar cloro" |
| 27 | (e) tiktok | https://www.tiktok.com/discover/lista-de-precios-de-arreglos-costura-2025-en-m%C3%A9xico ; /discover/lista-de-precios-en-costura-en-m%C3%A9xico ; /discover/tabla-de-precios-de-costura-2025 | 2026-10-11 | no disponible | páginas de descubrimiento (**MX**) | TikTok (agregada); fragmento: anuncio de costurera mexicana "bastillas en uniformes escolares por $30" | no disponible | Indica costo de alternativa (costurera) |
| 28 | (e) tiktok | https://www.tiktok.com/@sew_tech_company/video/7364880897146998032 | 2026-10-11 | no disponible | video corto (comercio) | @sew_tech_company — "la mejor tienda de máquinas de coser en CDMX" | no disponible | no disponible |
| 29 | (e) tiktok | https://www.tiktok.com/@i.weytextil/video/7543794179814493460 | 2026-10-11 | no disponible | video corto (comercio) | @i.weytextil — tienda de telas, Centro Histórico CDMX, "pedido por WhatsApp", "envíos a todo México" | no disponible | no disponible |
| 30 | (e) tiktok | https://www.tiktok.com/discover/calle-de-telas-centro-cdmx ; /discover/tienda-de-telas-en-guadalajara ; /discover/donde-comprar-tela-en-mexico ; /discover/donde-comprar-maquinas-troqueladoras-cdmx ; /discover/taller-de-alta-costura-en-toluca-en-mexico-para-vestidos ; /discover/donde-comprar-herramientas-para-marroquineria-en-cdmx | 2026-10-11 | no disponible | páginas de descubrimiento (**MX**) | TikTok (agregada) — telas y talleres, **ningún kit de costura** | no disponible | no disponible |
| 31 | compl. extendida | https://www.tiktok.com/@mundocosturero/video/7287008242339695877 | 2026-10-11 | no disponible | video corto (tutorial) | @mundocosturero — "Apuesto a que no conocías este hack para poder arreglar tu ropa" #costuraparaprincipiantes | no disponible | no disponible |
| 32 | compl. extendida | https://www.tiktok.com/@costurero_de_marylo/video/7321814598452137221 | 2026-10-11 | no disponible | video corto | @costurero_de_marylo — "Cómo hacer ropa a mano: guía de costura creativa" | no disponible | no disponible |
| 33 | compl. extendida | https://www.tiktok.com/discover/onde-comprar-kit-de-costura-tiktok-shop (PT) ; /discover/kit-de-costura-del-dollar-city ; /discover/mini-maquina-de-costura-amazon ; /discover/maquina-de-costura-portatil-shopee ; /discover/mini-m%C3%A1quina-de-costura-port%C3%A1til-t%C3%A1-tavado ; /discover/mini-maquina-de-costura-costura-poliamida | 2026-10-11 | no disponible (fragmento: la página "onde comprar…" se "actualizó el 5 de octubre de 2026") | páginas de descubrimiento (Brasil / Dollarcity, país no identificado) | TikTok (agregada); fragmentos: "Se desprendió un botón justo antes de salir. Este kit de costura pequeño cabe en cualquier bolso"; "kit súper completo con agujas de diferentes tamaños, hilos y accesorios"; "kit de costura ideal para principiantes que encontré en Dollarcity, perfecto para viajar y emergencias"; "kit profesional de 71 piezas" | no disponible | Casos de uso: botón antes de salir, viaje, emergencias |
| 34 | compl. | https://www.tiktok.com/discover/zurcidos-invisibles ; /discover/zurcido-invisible-paso-a-paso ; /discover/zurcido-invisible-a-mano ; /discover/como-coser-un-pantalon-de-mezclilla ; /discover/como-hacer-dobladillo-a-jeans-a-mano ; /discover/parches-parisina-para-pantalones | 2026-10-11 | no disponible | páginas de descubrimiento | TikTok (agregada); resumen del buscador: "los videos más visibles tienen entre algunos cientos y varios miles de me gusta… cuentas pequeñas o academias de costura" (no verificado) | no disponible | "Parches Parisina para pantalones" (MX) |
| 35 | compl. | https://shop.tiktok.com/us/k/tiktok-shop-mexico | 2026-10-11 | no disponible | página de palabra clave TikTok Shop **EE. UU.** | TikTok Shop US | no disponible | no disponible |
| 36 | (a) web | https://www.canal26.com/tendencias/2026/01/16/sin-maquina-de-coser-o-gastar-de-mas-el-truco-definitivo-para-arreglar-un-pantalon-en-casa/ | 2026-10-11 | 2026-01-16 (en URL) | artículo | Canal 26 (Argentina) | no disponible | no disponible |
| 37 | (a) web | https://www.diariouno.com.ar/sociedad/increible-truco-costura-como-tapar-un-agujero-la-ropa-un-poco-lana-y-una-aguja-n1447742 ; https://www.mdzol.com/tendencias/mujer-ensena-efectivo-truco-tapar-los-huecos-la-ropa-y-se-hace-viral-n1051978 ; https://www.losandes.com.ar/por-las-redes/sin-costura-como-solucionar-los-agujeritos-la-ropa-y-dejarla-como-nueva-un-simple-truco-n5966550 ; https://www.minutouno.com/lifestyle/el-truco-casero-arreglar-los-agujeros-las-remeras-tener-que-tirarlas-n6129607 | 2026-10-11 | 2025-10-15 (Los Andes, según fragmento); resto no disponible | artículos (Argentina) sobre "truco viral" | medios argentinos; fragmento atribuye el truco de entretela adhesiva a la influencer "Estela Moreno" (Instagram) | no disponible | no disponible |
| 38 | (a) web | https://www.eluniversal.com.mx/tendencias/el-truco-viral-con-el-que-puedes-arreglar-los-agujeros-de-tus-prendas-evita-tirar-prendas/ | 2026-10-11 | no disponible | artículo (**MX**) | El Universal | no disponible | no disponible (página no abrió) |
| 39 | (a) web | https://www.crehana.com/business/descargables/manual-de-emergencias-para-arreglar-tu-ropa/ ; https://www.c-and-a.com/es/es/shop/reparacion-y-upcycling-de-ropa ; https://www.mercadolibre.com.ar/blog/como-reparar-campera-de-mujer-rota-paso-a-paso | 2026-10-11 | no disponible | descargable / guía de marca / blog | Crehana; C&A (España); ML Argentina | no disponible | no disponible |
| 40 | (b) web | https://static.buenosaires.gob.ar/sites/default/files/2026-08/Coser%20un%20bot%C3%B3n.pdf ; https://static.buenosaires.gob.ar/sites/default/files/2026-08/Pegado%20de%20parches%20termoadhesivos.pdf | 2026-10-11 | 2026-08 (en URL) | guías PDF (Gobierno de Buenos Aires) | GCBA | no disponible | Guía de parches: "evitar nylon, poliéster, cuerina, vinilo, cuero sintético"; "planchar sin vapor 15–30 s"; "puntadas en codos/rodillas" |
| 41 | (b) web | https://mallorcadiario.com/como-coser-boton-para-que-dure ; https://www.compradiccion.com/otros/video-como-coser-un-boton/amp ; https://www.skillshare.com/es/classes/conceptos-basicos-de-la-costura-a-mano-haz-maravillas-con-tela-aguja-e-hilo/467604165 | 2026-10-11 | no disponible | artículo / video / curso | Mallorca Diario; Compradicción; Skillshare (Bernadette Banner) | no disponible | "hilo de bordar demasiado grueso… usar hilo específico para botones" |
| 42 | (d) web | https://www.textilesleon.com/wp-content/uploads/2022/07/MANUAL-APLICACION-DEL-TERMOADHESIVO.pdf ; https://es.ifixit.com/Gu%C3%ADa/Poniendo+un+parche+termo-adhesivo/19442 | 2026-10-11 | 2022-07 (en URL) / no disponible | manual de fabricante / guía | Textiles León; iFixit | no disponible | "no lavar durante las 12 horas posteriores"; "170–190 °C, 45–60 s" |
| 43 | (e) web | https://www.etsy.com/mx/r/similar/1691868117 ; https://mx.ebay.com/b/Multi-Color-Button-to-Cover-Kit-Sewing-Buttons/7320/bn_111064184 | 2026-10-11 | no disponible | listados (Etsy MX / eBay MX) | — | Fragmentos: kit de reparación de cuero 59 pzas "MX$508.58"; kits de botones forrados "MXN $97.33–$526.42" | no disponible |
| 44 | compl. precio | https://listado.mercadolibre.com.mx/kit-de-costura ; https://listado.mercadolibre.com.mx/kit-costura ; https://listado.mercadolibre.com.mx/kits-de-costura ; https://www.amazon.com.mx/kit-de-costura/s?k=kit+de+costura ; fichas Amazon B0FJY6KPRH, B0BX6JCQJP, B0BDR93GFK, B07M61LNG8 | 2026-10-11 | no disponible | listados de producto (MX) | Mercado Libre MX / Amazon MX | ver §4; fragmento ML: kit 172 pzs "4.7 de 1,226 reseñas" (no verificado) | no disponible |
| 45 | compl. precio | https://listado.mercadolibre.com.mx/cinta-termoadhesiva-para-ropa ; https://listado.mercadolibre.com.mx/cinta-adhesiva-dobladillo ; https://www.amazon.com.mx/TOPPERFUN-Insertar-revestimiento-dobladillo-aglutinante/dp/B0CXB7678X | 2026-10-11 | no disponible | listados de producto (MX) | Mercado Libre MX / Amazon MX | ver §4 | Fragmento ML: "muchos anuncios son de compra internacional, enviados desde China" |
| 46 | compl. precio | https://www.amazon.com.mx/gp/bestsellers/kitchen/10202189011 ; fichas Amazon B0C49MDG1K, B0DJS5DNRX, B0C3PX9WH3, B09JXTWHFY, B08QGVBSDM ; https://listado.mercadolibre.com.mx/maquina-de-coser-sewing-machine | 2026-10-11 | no disponible | listados de producto (MX) | Amazon MX / Mercado Libre MX | ver §4; fragmento: máquina "de 1 segundo" "3.3 estrellas, 799 valoraciones" (no verificado) | no disponible |
| 47 | compl. | https://lachapulinaverde.substack.com/p/iel-mercado-de-las-maquinas-de-coser | 2026-10-11 | no disponible | boletín | Substack "La Chapulina Verde"; fragmento: "ventas de costura y manualidades en Amazon subieron 27 % entre 2023 y 2024"; "#sewingtiktok más de 615k publicaciones" (no verificado) | no disponible | no disponible |

### 3.3 Creadores únicos

Tras deduplicar por URL de video (páginas `/discover/`, `/tag/` y `shop.tiktok.com/us/k/` son agregadas, no creadores):

Cuentas de TikTok con video individual en resultados: @anali.aldebaran, @academiacintialeon, @costuraycreativid, @asundominguezmoda, @eduardorealcouture, @agujitasdesbordadas, @angel.villarce, @cosiendoendowntown, @sew_tech_company, @i.weytextil, @mundocosturero, @costurero_de_marylo.

**Total: 12 cuentas únicas con URL de video** (12 videos). En tema (reparación/costura doméstica): 10; comercio de telas/máquinas en CDMX: 2 (@sew_tech_company, @i.weytextil — señal México explícita). Ninguna cuenta con señal de afiliación a TikTok Shop en el texto visible. Señales de México aparecen sobre todo en páginas de descubrimiento (Parisina, listas de precios de arreglos en México, calle de telas CDMX, Guadalajara, Toluca). Cuentas mencionadas solo en resúmenes del buscador sin URL verificable: "Costura Facil", "Estela Moreno" (Instagram) — no se cuentan.

Observación destacable: la búsqueda de producto (c) restringida a TikTok devolvió **solo 2 resultados**, ambos de máquinas de coser (Brasil/indeterminado), y **ningún video de kit de costura**. La búsqueda extendida complementaria tampoco devolvió un video de kit con URL propia, solo páginas de descubrimiento (una en portugués, otra de Dollarcity).

### 3.4 Preguntas y objeciones de compra observadas (hechos)

HECHOS OBSERVADOS (solo en títulos/descripciones/fragmentos; **no se accedió a ningún comentario**):
- Necesidad formulada como "sin coser" / "sin que se note" / "sin costurera" (títulos de ≥4 páginas de descubrimiento).
- Dudas de uso de parches: "cómo pegar los parches de la Parisina", "cómo se pegan los parches de Temu", "cómo pegar un parche sin pegamento", "cómo quitar parche termoadhesivo".
- Objeción de durabilidad del parche: fragmentos responden "si se despega después de lavar, planchar de nuevo", "reforzar con puntadas", "dejar enfriar", "dos tiras para tejidos gruesos"; manuales externos: "no lavar en 12 h", "evitar nylon/poliéster/cuerina".
- Casos de uso para kit: "se desprendió un botón justo antes de salir", "cabe en cualquier bolso", "viajar y emergencias", "reparaciones en casa".
- Audiencia que "no sabe coser ni un botón" (@asundominguezmoda); materiales mínimos: aguja, hilo, dedal.
- Referencia de costo alternativo: bastilla de uniforme en costurera "$30" (fragmento de página MX).
- Ninguna reseña independiente sobre despegue de parches en TikTok ni en la web (búsqueda (d) sin restricción devolvió solo manuales de fabricante y páginas no relacionadas).

### 3.5 Vacíos de contenido detectados (inferencias)

INFERENCIAS (sin acceso a comentarios ni al feed MX):
1. Los tutoriales de "coser un botón" y "zurcido invisible" abundan (academias de costura, creadores de España y Latinoamérica); en cambio, **contenido en español mexicano que muestre un kit de costura concreto resolviendo una reparación** casi no apareció (0 videos con URL propia).
2. Falta contenido que responda **qué parche/cinta usar según la tela** (mezclilla, poliéster de uniforme, licra) y **si aguanta lavadas**, con prueba real; lo disponible son instrucciones de fabricante o "vuelve a planchar".
3. Las dudas sobre parches de Parisina y Temu indican compra previa en tiendas mexicanas/importación sin instrucciones claras; hay espacio para "cómo usar lo que ya compraste" y para comparar kit vs ir a la costurera ($30 por bastilla según fragmento).
4. El contenido de "kit portátil" visible proviene de Brasil (TikTok Shop BR) y Dollarcity; no se vio equivalente MX.

PROPUESTAS (no validadas): demostración "botón caído → arreglado en 2 minutos" con kit de bolsillo; prueba de parche termoadhesivo en mezclilla tras 5 lavadas; guía "qué hay dentro del kit de 172 piezas y qué sí vas a usar"; comparación cinta de dobladillo vs costurera para uniformes escolares.

## 4. Comparación de valor en ofertas externas (no demuestra elegibilidad en TikTok Shop)

Importante: **ninguna página de marketplace pudo abrirse**. Los precios provienen únicamente de fragmentos de búsqueda restringida a amazon.com.mx/mercadolibre.com.mx del 2026-10-11; la asociación precio↔URL es la que indicó el fragmento y **no fue verificada en la ficha**. Pueden estar desactualizados.

| Producto tipo | Marketplace | Precio visto (MXN) | URL | Fecha obs. |
|---|---|---|---|---|
| Kit de costura 172 pzas (JASUVII) | Amazon MX | $149.59 (antes $189.49) según fragmento | https://www.amazon.com.mx/JASUVII-principiantes-bricolaje-reparaci%C3%B3n-arreglos/dp/B0FJY6KPRH | 2026-10-11 |
| Kit de costura 172 pzas (Juzanl) | Amazon MX | $179.00 (antes $209.00) según fragmento | https://www.amazon.com.mx/Kit-Costura-Accesorios-Cremallera-Principiantes/dp/B0BX6JCQJP | 2026-10-11 |
| Kit de costura 172 pzas (VIDA4U) | Amazon MX | $199.99 (lista $249.00) según fragmento | https://www.amazon.com.mx/VIDA4U-Suministros-Accesorios-Munualidad-Campamentos/dp/B0BDR93GFK | 2026-10-11 |
| Kit de costura 172 pzas (HomES KC01 / genérico / "costurero de lujo") | Mercado Libre MX | $128.25–$148.92 ; $139–$144 ; $129.93–$149.91 según fragmentos (varias capturas) | https://listado.mercadolibre.com.mx/kit-de-costura | 2026-10-11 |
| Mini kit de costura portátil con cierre (12 hilos, tijeras) | Amazon MX | no disponible | https://www.amazon.com.mx/cremallera-principiante-emergencia-reparaci%C3%B3n-suministros/dp/B07M61LNG8 | 2026-10-11 |
| Cinta termoadhesiva para dobladillo (Selanusa) | Mercado Libre MX | $65 (1 rollo) ; $108.50 (2 rollos 19 mm) ; $398 (10 rollos) según fragmento | https://listado.mercadolibre.com.mx/cinta-termoadhesiva-para-ropa | 2026-10-11 |
| Cinta termoadhesiva para dobladillo (Betterware) | Mercado Libre MX | $120 ; juego de 4 $259 según fragmento | https://listado.mercadolibre.com.mx/cinta-adhesiva-dobladillo | 2026-10-11 |
| Cinta termoadhesiva 2 rollos × 70 yardas (TOPPERFUN) | Amazon MX | $159.59 según fragmento; relacionados "LIHAO desde $139.99", "HeatnBond desde $269.54" | https://www.amazon.com.mx/TOPPERFUN-Insertar-revestimiento-dobladillo-aglutinante/dp/B0CXB7678X | 2026-10-11 |
| Mini máquina de coser manual de bolsillo (82 g) | Amazon MX | $140.90 según fragmento | https://www.amazon.com.mx/m%C3%A1quina-port%C3%A1til-Bolsillo-compacta-pr%C3%A1ctica/dp/B0C49MDG1K | 2026-10-11 |
| Mini máquina de coser de mano (roja) | Amazon MX | $149.00 según fragmento | https://www.amazon.com.mx/m%C3%A1quina-coser-port%C3%A1til-hogar-viajes/dp/B0DJS5DNRX | 2026-10-11 |
| Máquina portátil "de 1 segundo" (lista de más vendidos) | Amazon MX | $179.00 según fragmento | https://www.amazon.com.mx/gp/bestsellers/kitchen/10202189011 | 2026-10-11 |
| Mini máquina eléctrica 12 puntadas (Bluelander) | Amazon MX | $499.00 (lista $869.00) según fragmento | https://www.amazon.com.mx/Bluelander-El%C3%A9ctrica-Port%C3%A1til-Puntadas-Almohadas/dp/B0C3PX9WH3 | 2026-10-11 |
| Mini máquina portátil con kit (Tiiyee) | Mercado Libre MX | $211.58 según fragmento | https://listado.mercadolibre.com.mx/maquina-de-coser-sewing-machine | 2026-10-11 |
| Parches termoadhesivos (lisos/bordados) | Mercado Libre MX / Amazon MX | no disponible (no se buscó ficha específica; solo cinta) | — | 2026-10-11 |

## 5. Catálogo afiliado TikTok Shop MX

HECHOS OBSERVADOS
- Intento 1: WebFetch `https://shop.tiktok.com/mx` → `ENOTFOUND`; curl → 403 del proxy ("policy denial" para `shop.tiktok.com:443`). **Bloqueado antes de llegar al sitio.**
- Intento 2: búsqueda `tiktok.com/view/product kit de costura México` (tiktok.com) → 4 resultados, ninguno con formato `/view/product/`; solo páginas `/discover/` y una página de palabra clave de TikTok Shop **EE. UU.** (`shop.tiktok.com/us/k/tiktok-shop-mexico`).
- Intento 3: búsqueda `"TikTok Shop" México kit de costura OR mini máquina de coser video` (sin restricción) → 0 productos/vendedores/videos de TikTok Shop MX; solo Mercado Libre, eBay, un boletín.
- Menciones de "TikTok Shop" en fragmentos corresponden a Brasil (precios en R$, portugués) o a país no identificado.

Resultado: **bloqueado**. Estado: **no verificado**. El catálogo afiliado MX requiere acceso autenticado y, en esta sesión, además salida de red.

## 6. Limitaciones

- **Acceso:** 0 páginas abiertas; todo proviene de fragmentos del buscador. No se pudo comprobar si TikTok exige inicio de sesión (bloqueo previo del proxy a todos los hosts).
- **Métricas:** ninguna verificada. Las cifras citadas (4.7/1,226 reseñas de un kit en ML; 3.3/799 de una máquina en Amazon; "cientos a varios miles de me gusta" en zurcidos; "615k publicaciones #sewingtiktok") están solo en resúmenes del buscador.
- **Personalización:** los resultados web no equivalen al feed de TikTok ni están personalizados a México; buscador "US-only", con sesgo a España, Argentina, Brasil e inglés.
- **Tamaño de muestra:** 12 videos de TikTok con creador identificable y ~35 páginas agregadas `/discover/`; la consulta de producto (c) devolvió solo 2 resultados.
- **Idioma/país:** mezcla de español de España, Argentina, Colombia, portugués; señales mexicanas concentradas en páginas agregadas (Parisina, CDMX, Guadalajara).
- **Fecha:** una sola observación (2026-10-11); sin fechas de publicación de videos; artículos externos de 2022–2026.
- **Precios:** solo fragmentos; sin verificación de vendedor, envío ni vigencia.

## 7. Evaluación preliminar

| Dimensión | Peso | Nota (0–5) | Justificación |
|---|---|---|---|
| Demanda observable | 25 % | 3 | TikTok genera ≥30 páginas de descubrimiento distintas para variantes del problema (roto sin que se note, sin coser, botón, parche, zurcido, broche), varias con señal México (Parisina, precios de arreglos en México). 12 cuentas con video. Pero ninguna métrica verificada y la consulta de producto casi vacía en TikTok. |
| Necesidades sin contenido útil suficiente | 20 % | 3 | Tutoriales de técnica (botón, zurcido) abundan; falta contenido MX que muestre kits concretos, pruebas de durabilidad de parches/cintas por tipo de tela tras lavado, y guías para parches ya comprados (Parisina/Temu). Sin comentarios no se confirma qué preguntas quedan sin responder. |
| Economía del afiliado | 25 % | sin evidencia | Requiere catálogo afiliado MX (comisiones, precio en TikTok Shop, stock). No accesible. |
| Facilidad de demostración original | 15 % | 4 | Botón caído, bastilla o parche se demuestran en un video corto con resultado visible e inmediato, sin habilidades avanzadas; requiere plancha para parches/cintas y algo de pulso para costura a mano. Durabilidad exige seguimiento. |
| Calidad operativa del vendedor | 15 % | sin evidencia | Requiere datos de vendedores en TikTok Shop MX. No accesible. |

**Puntuación parcial:** Σ(peso × nota)/5 = (0.25×3 + 0.20×3 + 0.15×4)/5 = 1.95/5 = **0.39** sobre las dimensiones evaluadas (peso cubierto: **60 %**). Normalizada al peso cubierto: 1.95/0.60 = 3.25 sobre 5. **Puntuación: INCOMPLETA** — faltan: Economía del afiliado (25 %) y Calidad operativa del vendedor (15 %).

## 8. Ronda 2

Pendiente. Repetir la observación en otro día con las mismas cinco búsquedas y comparar. Si en esa sesión hay salida de red, abrir primero: las filas 4, 11, 12, 24 y 31 (videos); `https://www.tiktok.com/discover/como-pegar-los-parches-para-ropa-de-la-parisina`; `https://shop.tiktok.com/mx`; y los listados de Mercado Libre MX / Amazon MX de §4 para verificar precios y reseñas.

## 9. Fuentes

Todas consultadas (como resultado de búsqueda, no abiertas) el 2026-10-11.

1. https://www.tiktok.com/discover/coser-un-roto-sin-que-se-note
2. https://www.tiktok.com/discover/como-arreglar-un-agujero-en-tu-ropa-sin-coser
3. https://www.tiktok.com/discover/como-arreglar-tela-rota
4. https://www.tiktok.com/@anali.aldebaran/video/7556376442599198008
5. https://www.tiktok.com/discover/c%C3%B3mo-coser-ropa-rota-con-un-hilo
6. https://www.tiktok.com/discover/como-coser-con-hilo-y-aguja-algo-roto
7. https://www.tiktok.com/discover/como-reparar-una-camisa-rota
8. https://www.tiktok.com/discover/zurcido-invisible-a-mano-en-rasgado-de-pantal%C3%B3n
9. https://www.tiktok.com/discover/como-coser-un-hueco-roto-sin-que-se-note
10. https://www.tiktok.com/discover/como-arreglar-el-broche-de-un-cierre
11. https://www.tiktok.com/@academiacintialeon/video/7358511490644856070
12. https://www.tiktok.com/@costuraycreativid/video/7363324284372045062
13. https://www.tiktok.com/@asundominguezmoda/video/7420790842287344928
14. https://www.tiktok.com/@eduardorealcouture/video/7370103524140567813
15. https://www.tiktok.com/discover/como-coser-botones-a-peluche-articulacion
16. https://www.tiktok.com/discover/c%C3%B3mo-coser-un-boton-en-un-peluche
17. https://www.tiktok.com/discover/como-coser-boton-con-aguja-de-4-agujeros
18. https://www.tiktok.com/discover/como-colocar-botao-na-blusa
19. https://www.tiktok.com/discover/arreglar-un-boton-de-su-camisa
20. https://www.tiktok.com/discover/como-coser-boton-pantalon-mezclilla-con-hilo
21. https://www.tiktok.com/discover/maquina-de-costura-portatil-tiktok-shop
22. https://www.tiktok.com/discover/mini-maquina-de-costura
23. https://www.tiktok.com/discover/como-quitar-parche-termoadhesivo
24. https://www.tiktok.com/@agujitasdesbordadas/video/6880313351621102849
25. https://www.tiktok.com/discover/como-pegar-los-parches-para-ropa-de-la-parisina
26. https://www.tiktok.com/discover/como-pegar-un-parche-sin-pegamento-para-ropa
27. https://www.tiktok.com/discover/como-se-pegan-los-parches-de-temu-en-la-ropa
28. https://www.tiktok.com/@angel.villarce/video/7377459155646385414
29. https://www.tiktok.com/@cosiendoendowntown/video/7068412393352629510
30. https://www.tiktok.com/tag/parchebordado
31. https://www.tiktok.com/discover/como-quitar-un-parche-termoadhesivo-ropa
32. https://www.tiktok.com/discover/como-van-los-parches-del-uniforme-t3-fa
33. https://www.tiktok.com/discover/lista-de-precios-de-arreglos-costura-2025-en-m%C3%A9xico
34. https://www.tiktok.com/@sew_tech_company/video/7364880897146998032
35. https://www.tiktok.com/discover/donde-comprar-maquinas-troqueladoras-cdmx
36. https://www.tiktok.com/discover/lista-de-precios-en-costura-en-m%C3%A9xico
37. https://www.tiktok.com/discover/calle-de-telas-centro-cdmx
38. https://www.tiktok.com/discover/taller-de-alta-costura-en-toluca-en-mexico-para-vestidos
39. https://www.tiktok.com/discover/tienda-de-telas-en-guadalajara
40. https://www.tiktok.com/@i.weytextil/video/7543794179814493460
41. https://www.tiktok.com/discover/donde-comprar-tela-en-mexico
42. https://www.tiktok.com/discover/donde-comprar-herramientas-para-marroquineria-en-cdmx
43. https://www.tiktok.com/@mundocosturero/video/7287008242339695877
44. https://www.tiktok.com/discover/onde-comprar-kit-de-costura-tiktok-shop
45. https://www.tiktok.com/discover/mini-m%C3%A1quina-de-costura-port%C3%A1til-t%C3%A1-tavado
46. https://www.tiktok.com/discover/mini-maquina-de-costura-costura-poliamida
47. https://www.tiktok.com/@costurero_de_marylo/video/7321814598452137221
48. https://www.tiktok.com/discover/mini-maquina-de-costura-amazon
49. https://www.tiktok.com/discover/kit-de-costura-del-dollar-city
50. https://www.tiktok.com/discover/maquina-de-costura-portatil-shopee
51. https://www.tiktok.com/discover/lista-de-precios-de-arreglos-en-costura-miami
52. https://www.tiktok.com/discover/tabla-de-precios-de-costura-2025
53. https://shop.tiktok.com/us/k/tiktok-shop-mexico
54. https://www.tiktok.com/discover/como-coser-un-pantalon-de-mezclilla
55. https://www.tiktok.com/discover/zurcidos-invisibles
56. https://www.tiktok.com/discover/zurcido-invisible-paso-a-paso
57. https://www.tiktok.com/discover/zurcido-invisible-a-mano
58. https://www.tiktok.com/discover/como-hacer-dobladillo-a-jeans-a-mano
59. https://www.tiktok.com/discover/parches-parisina-para-pantalones
60. https://shop.tiktok.com/mx (intento de apertura fallido)
61. https://www.canal26.com/tendencias/2026/01/16/sin-maquina-de-coser-o-gastar-de-mas-el-truco-definitivo-para-arreglar-un-pantalon-en-casa/
62. https://www.diariouno.com.ar/sociedad/increible-truco-costura-como-tapar-un-agujero-la-ropa-un-poco-lana-y-una-aguja-n1447742
63. https://www.mdzol.com/tendencias/mujer-ensena-efectivo-truco-tapar-los-huecos-la-ropa-y-se-hace-viral-n1051978
64. https://www.mercadolibre.com.ar/blog/como-reparar-campera-de-mujer-rota-paso-a-paso
65. https://www.crehana.com/business/descargables/manual-de-emergencias-para-arreglar-tu-ropa/
66. https://www.losandes.com.ar/por-las-redes/sin-costura-como-solucionar-los-agujeritos-la-ropa-y-dejarla-como-nueva-un-simple-truco-n5966550
67. https://www.eluniversal.com.mx/tendencias/el-truco-viral-con-el-que-puedes-arreglar-los-agujeros-de-tus-prendas-evita-tirar-prendas/
68. https://www.c-and-a.com/es/es/shop/reparacion-y-upcycling-de-ropa
69. https://www.minutouno.com/lifestyle/el-truco-casero-arreglar-los-agujeros-las-remeras-tener-que-tirarlas-n6129607
70. https://es.ifixit.com/Gu%C3%ADa/Poniendo+un+parche+termo-adhesivo/19442
71. https://www.diariodecuyo.com.ar/tendencia/paso-a-paso-como-arreglar-una-campera-puffer-quemada-o-rajada-1747342.html
72. https://static.buenosaires.gob.ar/sites/default/files/2026-08/Coser%20un%20bot%C3%B3n.pdf
73. https://static.buenosaires.gob.ar/sites/default/files/2026-08/Pegado%20de%20parches%20termoadhesivos.pdf
74. https://mallorcadiario.com/como-coser-boton-para-que-dure
75. https://www.compradiccion.com/otros/video-como-coser-un-boton/amp
76. https://www.skillshare.com/es/classes/conceptos-basicos-de-la-costura-a-mano-haz-maravillas-con-tela-aguja-e-hilo/467604165
77. https://www.textilesleon.com/wp-content/uploads/2022/07/MANUAL-APLICACION-DEL-TERMOADHESIVO.pdf
78. https://www.etsy.com/mx/r/similar/1691868117
79. https://mx.ebay.com/b/Multi-Color-Button-to-Cover-Kit-Sewing-Buttons/7320/bn_111064184
80. https://listado.mercadolibre.com.mx/kit-de-costura
81. https://listado.mercadolibre.com.mx/kit-costura
82. https://listado.mercadolibre.com.mx/kits-de-costura
83. https://www.amazon.com.mx/kit-de-costura/s?k=kit+de+costura
84. https://www.amazon.com.mx/Kit-Costura-Accesorios-Cremallera-Principiantes/dp/B0BX6JCQJP
85. https://www.amazon.com.mx/JASUVII-principiantes-bricolaje-reparaci%C3%B3n-arreglos/dp/B0FJY6KPRH
86. https://www.amazon.com.mx/VIDA4U-Suministros-Accesorios-Munualidad-Campamentos/dp/B0BDR93GFK
87. https://www.amazon.com.mx/cremallera-principiante-emergencia-reparaci%C3%B3n-suministros/dp/B07M61LNG8
88. https://listado.mercadolibre.com.mx/cinta-adhesiva-dobladillo
89. https://listado.mercadolibre.com.mx/cinta-termoadhesiva-para-ropa
90. https://www.amazon.com.mx/TOPPERFUN-Insertar-revestimiento-dobladillo-aglutinante/dp/B0CXB7678X
91. https://www.amazon.com.mx/gp/bestsellers/kitchen/10202189011
92. https://www.amazon.com.mx/m%C3%A1quina-port%C3%A1til-Bolsillo-compacta-pr%C3%A1ctica/dp/B0C49MDG1K
93. https://www.amazon.com.mx/m%C3%A1quina-coser-port%C3%A1til-hogar-viajes/dp/B0DJS5DNRX
94. https://www.amazon.com.mx/Bluelander-El%C3%A9ctrica-Port%C3%A1til-Puntadas-Almohadas/dp/B0C3PX9WH3
95. https://www.amazon.com.mx/principiantes-velocidad-extensi%C3%B3n-accesorios-almacenamiento/dp/B09JXTWHFY
96. https://www.amazon.com.mx/almacenamiento-principiantes-suministros-necesarios-el%C3%A9ctrico/dp/B08QGVBSDM
97. https://listado.mercadolibre.com.mx/maquina-de-coser-sewing-machine
98. https://lachapulinaverde.substack.com/p/iel-mercado-de-las-maquinas-de-coser
