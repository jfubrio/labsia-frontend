# CAZA IA — Herramientas existentes útiles y aplicables

Revisión de proyectos de código abierto en GitHub y de APIs oficiales que CAZA IA puede integrar o tomar como referencia, con la decisión por fase. Fecha de revisión: 2026-10-11. Las páginas de Amazon, Keepa, Banxico, Mercado Libre y Best Buy no eran accesibles desde este entorno; sus datos provienen de documentación replicada y fuentes secundarias y están marcados como **por confirmar** donde corresponde.

## Resumen de decisiones

| Necesidad | Decisión | Herramienta | Fase |
| --- | --- | --- | --- |
| Programación de vigilancia | Integrar | BullMQ sobre Redis (ya es el estándar en LABSIA); pg-boss como alternativa si se quiere evitar Redis | 2 |
| Historial y detección de precio en tiendas sin API (Sony Store MX) | Integrar como servicio lateral | changedetection.io (Apache-2.0) con detección de precio y stock, hablando con CAZA IA por webhook y API REST | 2–3 |
| Precio y compra en Amazon México | Integrar vía API oficial | Product Advertising API 5.0 (locale México) con firma SigV4 propia; **no scraping** | 3 |
| Historial de precios de Amazon | Evaluar, de pago | Keepa API (cobertura de .com.mx **por confirmar**) | 3 |
| Mercado Libre | Integrar vía API oficial con OAuth | API de Mercado Libre con app registrada; la búsqueda pública parece cerrada desde 2025 | 3 |
| Comparación US | Integrar vía API oficial | Best Buy Developer API (clave gratuita, uso comercial sujeto a aprobación); Amazon US vía PA-API | 4 |
| Tipo de cambio USD→MXN | Integrar | Banxico SIE (FIX oficial, token gratuito) como fuente primaria; Frankfurter autoalojado (MIT) como respaldo | 4 |
| Scraping cuando una tienda lo permite | Integrar como librería | Crawlee + Playwright (Apache-2.0) respetando robots.txt y términos | 3 |
| Notificaciones al operador | Integrar | Apprise (BSD-2) o ntfy; Telegram/WhatsApp/correo/webhook | 5 |
| Diseño de producto y UX | Solo referencia | PriceBuddy, Discount Bandit, changedetection.io | — |
| Evasión de protecciones anti-bot | **No integrar** | FlareSolverr, Byparr y similares | — |

## 1. Rastreadores de precios completos (referencia y posible servicio lateral)

| Proyecto | Stack | Licencia | Lo útil para CAZA IA | Limitación |
| --- | --- | --- | --- | --- |
| [changedetection.io](https://github.com/dgtlmoon/changedetection.io) (~34.9k estrellas) | Python, Docker | Apache-2.0 | Detección de precio y stock en páginas de producto leyendo metadatos (JSON-LD), límites superior e inferior de precio, alertas por porcentaje, selectores CSS/XPath/JSONPath/jq, API REST con OpenAPI, Playwright para páginas con JavaScript, notificaciones vía Apprise | Es monitor genérico: no valida descuentos contra historial propio ni gestiona autorizaciones. Encaja como **conector** de CAZA IA, no como núcleo |
| [PriceBuddy](https://github.com/jez500/pricebuddy) (~1.4k) | Laravel/Filament (PHP), Docker | GPL-3.0 (por confirmar en LICENSE.md) | Historial de precios, estrategias de scrape configurables sin código, scraping asistido por IA opcional (OpenAI, Anthropic, Gemini, Ollama), notificaciones (Telegram, Discord, Apprise, ntfy), API REST | PHP y GPL: no se puede embeber como librería en código propio; solo como servicio aparte. Sin motor de descuentos reales |
| [Discount Bandit](https://github.com/Cybrarist/Discount-Bandit) (~748) | Laravel/Filament (PHP), SQLite/MySQL, Docker | GPL-3.0 según directorios (archivo LICENSE no localizado) | Multiusuario, Amazon, eBay, AliExpress, Walmart, Target, Newegg, tiendas personalizadas, notificaciones por criterio | Sin México confirmado, PHP, sin API documentada |
| Scripts sueltos en Python (Amazon-price-tracker y similares) | Python | varias | Ninguno: umbral simple y correo | Sin historial, sin pruebas, sin mantenimiento |

**Decisión.** CAZA IA mantiene su núcleo propio en TypeScript (motores de validación, autorización y anti-duplicados ya implementados en fase 1). changedetection.io se adopta como servicio lateral para las tiendas sin API: él observa la página y envía la observación a CAZA IA por webhook; CAZA IA conserva el historial, el veredicto y la autorización. PriceBuddy y Discount Bandit sirven como referencia de UX (vista de historial, reglas por producto) para la fase 5.

## 2. Conectores de tiendas

### Amazon México

- **API oficial:** Product Advertising API 5.0. México es un locale soportado y el host del scratchpad es `webservices.amazon.com.mx` ([locale reference](https://webservices.amazon.com/paapi5/documentation/locale-reference.html), [scratchpad](https://webservices.amazon.com/paapi5/documentation/play-around-using-scratchpad.html)). Región exacta **por confirmar** en la página del locale México.
- **Requisito de acceso:** cuenta de Amazon Associates con **tres ventas calificadas en 180 días**; antes de eso cada llamada devuelve `AssociateNotEligible` ([fuente secundaria](https://affiliatexblocks.com/tools/associatenoteligible-error-checker/)). Esto es un bloqueo de fase 0: hay que decidir si CAZA IA opera con una cuenta de afiliado activa.
- **SDK:** el SDK oficial para Node es antiguo; la distribución no oficial con TypeScript [Robot-Inventor/paapi5-nodejs-sdk](https://github.com/Robot-Inventor/paapi5-nodejs-sdk) (Apache-2.0) fue **archivada en septiembre de 2026**. Recomendación: implementar la firma SigV4 y las llamadas `GetItems`/`SearchItems` directamente con `fetch` (es HTTPS POST con JSON), sin dependencia externa.
- **Scraping:** las Condiciones de Uso de Amazon prohíben "data mining, robots o herramientas similares de recolección" y recopilar listados o precios ([copia de las condiciones](https://conductatlas.com/platform/amazon/amazon-conditions-of-use/provision/CA-P-018441/prohibition-on-data-mining-and-scraping-tools/)). CAZA IA **no** scrapea Amazon.
- **Compra automatizada:** PA-API no ejecuta compras. La fase 6 en Amazon requiere una decisión aparte (compra manual asistida o un flujo de navegador con sesión del propio usuario), que debe validarse contra los términos antes de construirla.

### Historial de precios de Amazon: Keepa

- API REST de pago por tokens por minuto; plan básico citado en ~49 EUR/mes por 20 tokens/min, 1 token por ASIN consultado ([documentación de planes](https://keepa.com/api-docs/plans-tokens.html), [precios según terceros](https://revenuegeeks.com/keepa-pricing/)).
- Cobertura de Amazon México por la API: **por confirmar**. La extensión de navegador sí lista .com.mx; la API documenta 11 dominios.
- Cliente: no hay librería Node mantenida; existe el cliente Python [akaszynski/keepa](https://github.com/akaszynski/keepa) (Apache-2.0) y servidores MCP en Node. Llamar la REST directamente es suficiente.
- **Uso en CAZA IA:** opcional en fase 3 para arrancar el historial de 90 días sin esperar a acumularlo. Solo si la fase 0 confirma México y el costo.

### Mercado Libre

- API oficial con OAuth 2.0 y app registrada ([documentación de autenticación](https://developers.mercadolibre.com.ar/en_us/identity-and-access-management-oauth-and-tokens)).
- Fuentes de terceros reportan que desde 2025 las llamadas sin token a `/sites/{site}/search` e `/items/{id}` devuelven 403 ([servidor MCP](https://glama.ai/mcp/servers/hgsefxwq4c), [guías de conectores](https://anythingmcp.com/es/guides/connect-mercado-libre-to-claude)). **Por confirmar** en el DevCenter oficial.
- No hay SDK oficial para Node; el acceso con `fetch` + OAuth es directo. El SDK no oficial `@ar-agents/mercadolibre` no indica soporte del sitio MLM.

### Sony Store México

- Sin API pública conocida. Opción: changedetection.io con detección de precio por JSON-LD, o Crawlee + Playwright si robots.txt y términos lo permiten (revisar en fase 0). Precio de lanzamiento del WH-1000XM6 en Sony Store: 11,999 MXN ([TechRadar MX](https://global.techradar.com/es-mx/tech/sony-sorprendio-en-mayo-con-el-lanzamiento-de-su-nueva-camara-y-sus-audifonos-wh-1000xm6)).

### Best Buy (comparación US)

- Developer API con clave gratuita; campos `salePrice`, `regularPrice`, `onSale`. Uso comercial sujeto a aprobación ([guía](https://jentic.com/apis/bestbuy)). SDK oficial [bestbuy-sdk-js](https://github.com/BestBuyAPIs/bestbuy-sdk-js) (MIT) sin actividad reciente (~4 años); usar `fetch` directo.

## 3. Tipo de cambio

| Fuente | Tipo | Costo | Uso |
| --- | --- | --- | --- |
| Banxico SIE REST ([`/SieAPIRest/service/v1/`](https://www.banxico.org.mx/SieAPIRest/service/v1/)) | Oficial. Series SF43718 (FIX, fecha de determinación) y SF60653 (fecha de liquidación) | Gratuito con token | **Primaria** para el precio aterrizado. Sin cliente Node mantenido; el cliente PHP [Xint0/banxico-php](https://github.com/Xint0/banxico-php) (MIT) documenta las series. Implementar con `fetch` |
| [Frankfurter](https://github.com/lineofflight/frankfurter) | Agregador de bancos centrales, incluye Banco de México como proveedor; API sin clave; autoalojable con Docker | Gratuito | **Respaldo** y pruebas locales. Confirmar MXN en `/v1/currencies` |
| `banxico-exchange-rate` (npm, AllRatesToday) | Comercial, clave, 300 peticiones/mes gratis | Freemium | No adoptar: intermediario innecesario |

## 4. Programación de tareas (fase 2)

| Librería | Licencia | Requiere | Ventaja | Desventaja |
| --- | --- | --- | --- | --- |
| [BullMQ](https://github.com/taskforcesh/bullmq) (~9.5k) | MIT | Redis o Dragonfly | Ya se usa en LABSIA (DOC 10/18); Job Schedulers para vigilancia periódica; limitación de tasa; deduplicación | Issue abierto sobre repetibles duplicados al cambiar horario con la misma clave ([#2617](https://github.com/taskforcesh/bullmq/issues/2617)); funciones de grupo solo en Pro |
| [pg-boss](https://github.com/timgit/pg-boss) (~4.0k) | MIT | PostgreSQL 13+ y Node 22.12+ | Sin Redis; cron y RRULE; reintentos con backoff; dead letter | Menor rendimiento que Redis a gran volumen (irrelevante para decenas de productos) |

**Decisión.** BullMQ por coherencia con LABSIA. Si CAZA IA se despliega aislado y sin Redis, pg-boss es la alternativa con menos infraestructura.

## 5. Scraping con permiso

- [Crawlee](https://github.com/apify/crawlee) (~26.1k, Apache-2.0, Node 22.13+): `PlaywrightCrawler` para páginas con JavaScript, `CheerioCrawler` para HTML estático, cola persistente, rotación de proxies y huellas realistas. Se usa **solo** en tiendas cuyo robots.txt y términos permitan el acceso automatizado, con intervalos largos (6 h por defecto en `caza_watch_configs`) y un solo producto por petición.
- Chromium y Playwright ya están disponibles en el entorno de desarrollo de LABSIA.

## 6. Notificaciones (fase 5)

- [Apprise](https://github.com/caronc/apprise) (BSD-2-Clause): Telegram, WhatsApp, Slack, Discord, correo y webhooks JSON con una sola URL de configuración; CLI, API Python y Docker. changedetection.io lo trae integrado.
- Alternativa ligera: ntfy (publicar por HTTP a un tópico).
- Para el flujo `approve`, la notificación debe llevar un enlace a la propuesta en el panel; la aprobación nunca se hace respondiendo al mensaje.

## 7. Lo que no se integra y por qué

- **FlareSolverr, Byparr y herramientas de evasión de Cloudflare.** Su propósito es saltar protecciones anti-bot. Contradice la regla de operar solo con APIs oficiales o con tiendas que permiten el acceso, y además se rompen con frecuencia ([ScrapeOps](https://scrapeops.io/python-web-scraping-playbook/python-flaresolverr)).
- **Scraping de Amazon** por prohibición expresa en sus condiciones.
- **Paquetes npm sin mantenimiento** (`bestbuy` ~4 años sin publicar, `paapi5-nodejs-sdk` archivado): se reemplazan por llamadas `fetch` propias, pequeñas y probadas.
- **Servicios intermediarios de tipo de cambio** cuando la fuente oficial es gratuita.

## 8. Precios públicos encontrados para los Sony WH-1000XM6

Estos datos son **informativos** y alimentan el conector mock como ejemplo. Ninguno es referencia de descuento: el precio real sale del análisis del comportamiento de la oferta competitiva en el tiempo (plan, sección 3).

| Dato | Valor | Fuente |
| --- | --- | --- |
| Precio de lanzamiento Sony Store MX (mayo 2026) | 11,999 MXN | [TechRadar MX](https://global.techradar.com/es-mx/tech/sony-sorprendio-en-mayo-con-el-lanzamiento-de-su-nueva-camara-y-sus-audifonos-wh-1000xm6) |
| Precio de lista en Amazon MX | 9,999 MXN | [Xataka MX](https://www.xataka.com.mx/seleccion/amazon-mega-ofertas-2026-tienen-a-precio-remate-mejores-audifonos-sony-wh-1000xm6) |
| Precio en Mega Ofertas 2026 (Amazon MX) | 5,933 MXN | misma fuente |

Lo que ilustran: el 11,999 fue precio de lanzamiento de un modelo nuevo y el 9,999 es un precio de lista; una oferta "antes 11,999, ahora 9,499" presume 21 % de descuento y no ahorra nada frente a lo que ya se pagaba en el mercado. El 5,933 muestra hasta dónde ha llegado la oferta competitiva, y por eso el objetivo se deriva del análisis en vez de fijarse a mano.

## 9. Tareas que esto agrega a la fase 0

- [ ] Decidir si se opera con una cuenta de Amazon Associates y cumplir las tres ventas calificadas, o descartar Amazon MX como conector de precio.
- [ ] Confirmar host y región de PA-API para México.
- [ ] Confirmar cobertura de Amazon México en la API de Keepa y su costo mensual.
- [ ] Registrar una app en el DevCenter de Mercado Libre y verificar el 403 en búsqueda sin token.
- [ ] Revisar robots.txt y términos de Sony Store México para decidir entre changedetection.io y descartar.
- [ ] Obtener token de Banxico SIE y verificar MXN en Frankfurter.
- [ ] Solicitar clave de Best Buy Developer y revisar aprobación de uso comercial.
