# 11 · Herramientas existentes aplicables (revisión preliminar)

**Estado:** preliminar · **Fecha de observación:** 2026-10-11 · **Alcance:** revisión de herramientas en GitHub, PyPI, APIs oficiales y conectores ya disponibles en la sesión de Cowork, con vistas a T03–T08. **No se adopta ninguna herramienta en este documento**; cada fila indica qué falta verificar.

Convención: **[HECHO]** observado en la fuente citada; **[INFERENCIA]** deducción del agente; **[PROPUESTA]** requiere decisión del propietario.

> Limitación de método: la política de red del entorno bloqueó el acceso directo a `github.com` (páginas), `developers.tiktok.com`, `partner.tiktokshop.com`, `api.mercadolibre.com` y `*.tiktok.com`. Sí respondieron `api.github.com` y `pypi.org`. Por regla de alcance de la sesión no se consultaron repositorios de GitHub fuera de `jfubrio/labsia-frontend` mediante la API; los datos de repositorios provienen de fragmentos del índice del buscador y de los metadatos públicos de PyPI. Las cifras de estrellas y fechas de commit no fueron verificadas en GitHub.

---

## 1. Resumen ejecutivo

1. **[HECHO]** Existe una vía oficial y conforme a términos para obtener datos de afiliado del lado del creador: la **Affiliate Creator API** de TikTok Shop Partner Center, con autorización OAuth del creador (`user_type=1`) y permisos parciales por alcance. Es la única fuente candidata para T05 (importación) y T07 (comisiones estimadas / aprobadas / liquidadas) que no depende de scraping.
2. **[HECHO]** No se encontró ninguna herramienta open source dedicada al seguimiento de comisiones de afiliado de TikTok Shop. Lo que existe son scrapers comerciales (Apify) cuya cobertura de México no está confirmada y "skills" de agentes que son guías, no software.
3. **[HECHO]** Los scrapers no oficiales de TikTok (por ejemplo `TikTokApi`) siguen publicándose, pero exigen cookies de sesión y proxies, y los términos de TikTok prohíben la extracción automatizada sin autorización escrita. **[INFERENCIA]** No deben formar parte del MVP; a lo sumo sirven para observación manual puntual, y eso también requiere decisión del propietario.
4. **[HECHO]** La sesión de Cowork ya tiene conectores activos para Supabase, Make, Vercel, Google Drive, GitHub, Canva, Figma y Higgsfield. **[INFERENCIA]** Cubren base de datos, automatización, despliegue, almacenamiento de evidencia y producción de activos para T04–T08 sin contratar nada nuevo; su uso concreto queda para la decisión de arquitectura en T04.
5. **[HECHO]** La documentación de LABSIA en `uploads/` describe un stack Next.js + TypeScript + PostgreSQL + Vercel con módulos de autenticación JWT, leads y métricas. **[INFERENCIA]** Es un patrón reutilizable para el MVP interno (T04–T08), aunque el dominio es distinto.

---

## 2. Datos de TikTok y TikTok Shop

| Herramienta | Tipo | Aplicable a | Observado (fecha obs. 2026-10-11) | Riesgo / límite | Falta verificar |
|---|---|---|---|---|---|
| **TikTok Shop Affiliate Creator API** (Partner Center) | API oficial | T05, T07, T03 (catálogo y comisión por producto) | **[HECHO]** Flujo: construir enlace de autorización en `shop.tiktok.com/alliance/creator/auth` con `app_key` y `state`, el creador aprueba, callback con código, intercambio por tokens, llamadas a Affiliate Creator APIs. Token de creador y token de vendedor son credenciales distintas. El creador puede autorizar solo parte de los alcances. El integrador de creador/afiliado construye una **app pública** autorizada con `user_type=1`. Para aparecer en la lista de autorización de creadores hay que entregar el `app_key` (14 caracteres) al partner manager. Fuentes [F-1]–[F-5]. | Requiere registrarse como desarrollador en Partner Center (es abrir una cuenta: **fuera de alcance en T00–T02**). Lista de alcances del lado creador no localizada. Disponibilidad para el mercado MX no confirmada en el fragmento. | Alcances exactos para creadores; si el registro de desarrollador exige entidad legal; si las apps públicas de creador están habilitadas para MX; versión de endpoints (`/affiliate_creator/`, versión 202405 según blog no oficial [F-6]). |
| **TikTok Research API** | API oficial (académica) | Ninguno | **[HECHO]** Solo investigadores de instituciones sin fines de lucro, regiones iniciales EE. UU. y Europa, uso no comercial [F-7], [F-8]. | No aplica a un proyecto comercial en México. | — |
| **Creator Search Insights** (dentro de la app) | Función oficial in-app | T02 ronda 2 (demanda de búsqueda) | **[HECHO]** Lanzada en marzo de 2024 en regiones seleccionadas; se accede buscando el nombre de la herramienta en el buscador de TikTok o desde Creator Tools [F-9]. Disponibilidad en México: no confirmada. | Requiere cuenta con sesión. Datos no exportables por API. | Si aparece en una cuenta MX del propietario (pendiente P-04 en `08_REGISTRO_DECISIONES.md`). |
| **`TikTokApi`** (davidteather, PyPI `TikTokApi`) | Open source no oficial | T02 (observación) | **[HECHO]** PyPI: versión 7.3.3, licencia MIT, última subida 2026-04-01, repositorio github.com/davidteather/tiktok-api. Fuentes de terceros: usa Playwright, exige cookie `ms_token` y a menudo proxies; el propio proyecto advierte bloqueos [F-10], [F-11]. | **[HECHO]** Los términos de TikTok prohíben extraer datos por medios automatizados sin autorización escrita [F-12]. **[INFERENCIA]** Riesgo de bloqueo de cuenta y legal; incompatible con un proyecto que depende de la buena salud de la cuenta de afiliado. | Nada que verificar salvo que el propietario decida asumir el riesgo; no recomendado. |
| **`yt-dlp`** (`--dump-json`) | Open source | T02 (metadatos de videos individuales) | **[HECHO]** PyPI: versión 2026.8.19, última subida 2026-10-10. Ninguna fuente confirmó qué campos de TikTok expone (vistas, likes) ni si extrae comentarios [F-13]. | Mismo riesgo contractual que cualquier extracción automatizada. Desde este entorno `*.tiktok.com` está bloqueado, así que no se pudo probar. | Ejecutar `yt-dlp --dump-json` sobre una URL pública fuera de este entorno y registrar los campos. |
| **Actores de Apify para TikTok Shop** (lemur, api-empire, kaix, unseenuser, etc.) | SaaS de scraping, de pago | T03 (comisión por producto) | **[HECHO]** Varios devuelven un campo de comisión; las regiones listadas son EE. UU., Reino Unido y Sudeste Asiático; **ninguno nombra México** [F-14]. | Costo por uso; mismo riesgo contractual; cobertura MX no confirmada. | Abrir el esquema de entrada de cada actor y comprobar si el país incluye MX (requiere cuenta Apify: fuera de alcance ahora). |
| **Nodos n8n / módulos Make para TikTok Shop** | Automatización | T05 | **[HECHO]** No existe nodo oficial de TikTok en n8n; se usa HTTP Request. No se encontró módulo de Make para TikTok Shop [F-15]. | — | Si Make (conector ya activo) permite llamadas HTTP firmadas a la Partner API. |

---

## 3. Demanda de búsqueda y comparación de precios externos

| Herramienta | Tipo | Aplicable a | Observado | Riesgo / límite | Falta verificar |
|---|---|---|---|---|---|
| **Google Trends API (alfa)** | API oficial, acceso restringido | T02 ronda 2 | **[HECHO]** Anunciada el 24 jul 2025; acceso por solicitud, sin clave autoservicio, sin calendario de disponibilidad general; seguía en alfa en ago 2026 [F-16], [F-17]. | Cola sin plazo; no sirve para planificar. | — |
| **`trendspyg`** (PyPI) | Open source | T02 ronda 2 (interés relativo por consulta y región) | **[HECHO]** PyPI: versión 1.9.0, MIT, última subida 2026-10-01, repositorio github.com/flack0x/trendspyg. Se presenta como sustituto de `pytrends`, que terceros describen como archivado [F-18]. | Raspa la interfaz web de Google Trends; sujeto a límites de tasa. Google Trends devuelve índices relativos, no volúmenes. | Que funcione con `geo=MX` y en español; límites de tasa reales. |
| **`pytrends`** | Open source | — | **[HECHO]** Descrito como archivado o inactivo por terceros [F-18], [F-19]. | No usar. | — |
| **API de Mercado Libre** (`/sites/MLM/search`) | API oficial | T02 y T03 (precio de referencia en MX) | **[HECHO]** Documentación oficial antigua (2020) muestra recursos públicos sin credenciales; un README de terceros afirma que la búsqueda ya no es accesible por cambios de política, sin fecha [F-20]. Desde este entorno `api.mercadolibre.com` está bloqueado por el proxy (403), así que no se pudo probar. | Posible exigencia de token OAuth (requiere crear una aplicación en Mercado Libre: abrir cuenta, fuera de alcance ahora). | Probar `GET https://api.mercadolibre.com/sites/MLM/search?q=...` sin token fuera de este entorno y registrar el código de respuesta. |
| **`mercadolibre-python`** (GearPlug) y **`python-meli`** | Open source | T03 | **[HECHO]** Envoltorios de la API; `python-meli` declara cobertura parcial (categorías, ubicaciones, monedas). PyPI no devolvió metadatos legibles para `mercadolibre-python` en esta sesión [F-21]. | Dependen de que la API siga siendo accesible. | Estado de mantenimiento en GitHub. |
| **Keepa** (API y paquete PyPI `keepa`) | SaaS de pago + cliente open source | T03 (historial de precios Amazon MX) | **[HECHO]** La extensión de Keepa lista `amazon.com.mx` entre las localizaciones soportadas; la API exige clave y funciona por tokens; PyPI `keepa` versión 1.6.0, última subida 2026-10-05 [F-22]. | Suscripción de pago (**gasto: fuera de alcance ahora**). Identificador de dominio para MX no localizado. | Costo del plan mínimo y el identificador de dominio MX. |

---

## 4. Publicación, aprobación y producción de contenido

| Herramienta | Tipo | Aplicable a | Observado | Riesgo / límite | Falta verificar |
|---|---|---|---|---|---|
| **Mixpost** | Open source autoalojado | T06 (aprobación) | **[HECHO]** Incluye flujos de aprobación; la edición gratuita Lite cubre Facebook Pages, X y Mastodon, y las demás redes están en ediciones de pago [F-23]. | TikTok solo en edición de pago (**gasto**). | Precio y si la publicación en TikTok incluye el etiquetado de contenido comercial exigido en `09_REQUISITOS_AFILIACION_MX.md`. |
| **Postiz** | Open source autoalojado | T06 | **[HECHO]** Autoalojable, más de 30 plataformas; los resultados no confirman TikTok ni flujo de aprobación [F-23]. | — | Soporte de TikTok y de aprobación en la documentación oficial. |
| **Canva, Figma, Higgsfield** | Conectores ya activos en la sesión | T09 (activos visuales), T06 | **[HECHO]** Disponibles como MCP en esta sesión; no se usaron. | Higgsfield consume créditos (**gasto**); Canva y Figma según plan del propietario. | Planes vigentes del propietario (pendiente P-01). |

**[INFERENCIA]** Para T06 el requisito crítico no es programar publicaciones sino que *una edición invalide la aprobación previa y cada acción quede trazada*. Eso es lógica de datos propia (T04) más que una herramienta de publicación; las herramientas de arriba solo cubrirían el último paso.

---

## 5. Infraestructura ya disponible en la sesión (conectores MCP)

| Conector | Estado observado | Posible uso (propuesta, pendiente de T04) |
|---|---|---|
| **Supabase** | Activo | PostgreSQL gestionado para el esquema de T04 (productos, vendedores, contenido, aprobaciones, comisiones estimadas/aprobadas/liquidadas), autenticación y respaldos (T08). |
| **Make** | Activo | Importaciones programadas (T05) mediante llamadas HTTP a la Affiliate Creator API, si Make soporta la firma de peticiones de TikTok Shop. |
| **Vercel** | Activo | Despliegue del panel interno (patrón ya usado por LABSIA). |
| **Google Drive** | Activo | Almacén de evidencia de T02 (capturas con URL y fecha) y de constancias fiscales que **no** deben vivir en el repositorio. |
| **GitHub** | Activo (alcance: este repositorio) | Control de versiones de documentación y código. |
| **Canva / Figma / Higgsfield** | Activos | Ver §4. |

**[HECHO]** Ninguno de estos conectores se usó para crear, modificar ni gastar nada en esta sesión.

---

## 6. Patrón reutilizable del propio repositorio (LABSIA)

**[HECHO]** `uploads/19_DASHBOARD_BACKEND.md`, `20_DASHBOARD_FRONTEND.md` y `27_OPERACIONES_EN_PRODUCCION.md` documentan un backend con módulos `auth` (bcrypt + JWT, login/refresh/logout) y `leads` (listado, detalle, cambio de estado, mensajes, métricas) sobre PostgreSQL, con Next.js, TypeScript y Vercel.

**[INFERENCIA]** La estructura de módulos, la autenticación y el patrón de métricas son transferibles al MVP de T04–T08 cambiando el dominio (leads → productos, contenidos, aprobaciones, comisiones). No se copia nada ahora; es insumo para T04.

---

## 7. Riesgos transversales (inferencias)

1. **Términos de servicio.** Toda extracción automatizada de TikTok sin autorización escrita viola sus términos [F-12]. El proyecto depende de la salud de la cuenta de afiliado, así que el costo de un bloqueo supera el beneficio de cualquier scraper.
2. **Dependencia de cuentas nuevas.** Las dos fuentes de datos oficiales relevantes (Affiliate Creator API y, posiblemente, API de Mercado Libre) exigen registrar aplicaciones de desarrollador. Esto es "abrir cuentas" y queda fuera de T00–T02; se registra como pendiente para la decisión del propietario.
3. **Cobertura de México.** Ninguna herramienta de terceros confirmó cobertura MX de TikTok Shop. No asumirla.
4. **Fragilidad.** Terceros reportan que cerca de la mitad de los repositorios "tiktok scraper" en GitHub llevan más de un año sin actualizarse [F-11]. Cualquier dependencia no oficial debe tratarse como desechable.

---

## 8. Propuesta de siguiente paso (requiere decisión del propietario)

1. Decidir si se registra una aplicación pública de creador en TikTok Shop Partner Center para usar la Affiliate Creator API. Es la única vía conforme para T05 y T07. Sin esa decisión, T07 solo podría alimentarse con exportaciones manuales desde la app.
2. Probar fuera de este entorno, sin cuentas nuevas: `GET /sites/MLM/search` de Mercado Libre sin token; `yt-dlp --dump-json` sobre una URL pública de TikTok; disponibilidad de Creator Search Insights en una cuenta MX existente.
3. Diferir cualquier herramienta de pago (Apify, Keepa, Mixpost de pago, créditos de Higgsfield) hasta que exista presupuesto (P-01) y los resultados de T02 justifiquen el gasto.

---

## 9. Fuentes (todas observadas el 2026-10-11 mediante índice de buscador o metadatos de PyPI)

- [F-1] TikTok Shop Partner Center — Creator authorization guide — https://partner.tiktokshop.com/docv2/page/creator-authorization-guide
- [F-2] TikTok Shop Partner Center — Affiliate integration — https://partner.tiktokshop.com/docv2/page/affiliate-integration
- [F-3] TikTok Shop Partner Center — Affiliate Seller API overview — https://partner.tiktokshop.com/docv2/page/6697960798b0a502f89e3d00
- [F-4] TikTok Shop Partner Center — TikTok Shop developer guide — https://partner.tiktokshop.com/docv2/page/tts-developer-guide
- [F-5] TikTok for Developers — anuncio de disponibilidad general de las Affiliate APIs — https://developers.tiktok.com/blog/2024-tiktok-shop-affiliate-apis-launch-developer-opportunity
- [F-6] (no oficial) bemomentiq.com — "TikTok Shop Affiliate APIs: Creator, Partner, and Seller" — https://bemomentiq.com/blog/tiktok-shop-affiliate-apis-explained
- [F-7] TikTok for Developers — Research API FAQ — https://developers.tiktok.com/docs/en/research-api-faq
- [F-8] (no oficial) xpoz.ai — límites de acceso de la Research API — https://www.xpoz.ai/blog/guides/tiktok-research-api-limits-access-and-alternatives/
- [F-9] TikTok Newsroom — Creator Search Insights (14 mar 2024) — https://newsroom.tiktok.com/creatorsearchinsights?lang=en-ZA
- [F-10] PyPI — TikTokApi (7.3.3, MIT, 2026-04-01) — https://pypi.org/project/TikTokApi/ ; repositorio declarado: https://github.com/davidteather/tiktok-api
- [F-11] (no oficial) thunderbit.com — estado de scrapers de TikTok en GitHub — https://thunderbit.com/es/blog/best-tiktok-scraper-alternatives
- [F-12] (registro de terceros de los Términos de TikTok) conductatlas.com — prohibición de extracción automatizada — https://conductatlas.com/platform/tiktok/tiktok-terms-of-service/prohibition-on-scraping-and-data-extraction/
- [F-13] PyPI — yt-dlp (2026.8.19, 2026-10-10) — https://pypi.org/project/yt-dlp/
- [F-14] Apify — actores de TikTok Shop: https://apify.com/lemur/tiktok-shop-products ; https://apify.com/api-empire/tiktok-shop-search-scraper ; https://apify.com/kaix/tiktok-shop-scraper ; https://apify.com/unseenuser/TikTok-Shop-Scraper
- [F-15] (no oficial) eesel.ai — integraciones de TikTok con n8n — https://www.eesel.ai/es/blog/tiktok-integrations-with-n8n
- [F-16] Google Search Central Blog — Introducing the Google Trends API (alpha), 24 jul 2025 — https://developers.google.cn/search/blog/2025/07/trends-api
- [F-17] (no oficial) ppc.land — alfa de Google Trends API — https://ppc.land/google-opens-alpha-testing-for-new-trends-api-targeting-developers-and-journalists/
- [F-18] PyPI — trendspyg (1.9.0, MIT, 2026-10-01) — https://pypi.org/project/trendspyg/ ; repositorio declarado: https://github.com/flack0x/trendspyg
- [F-19] (no oficial) SerpApi — estado de pytrends — https://serpapi.com/blog/scraping-google-trends-with-python-pytrends-alternative.md
- [F-20] Mercado Libre Developers — documentación (última actualización 2020) — https://developers.mercadolibre.com.mx/en_us/about-us ; (no oficial) README de mercadolibre-mcp — https://glama.ai/mcp/servers/@lumile/mercadolibre-mcp
- [F-21] PyPI — mercadolibre-python — https://pypi.org/project/mercadolibre-python ; python-meli — https://pypi.org/project/python-meli
- [F-22] PyPI — keepa (1.6.0, 2026-10-05) — https://pypi.org/project/keepa/ ; (no oficial) nexscope.ai — guía de la API de Keepa — https://www.nexscope.ai/blog/keepa-api-guide
- [F-23] (no oficial) postiz.com — comparación Postiz vs Mixpost — https://postiz.com/compare/postiz/mixpost ; alternativeto.net — https://alternativeto.net/software/postiz
- Intentos bloqueados por la política de red (403 del proxy): partner.tiktokshop.com, developers.tiktok.com, api.mercadolibre.com, github.com (páginas), www.npmjs.com.
