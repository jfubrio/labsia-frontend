---
name: caza-connector
description: Agregar, validar o modificar un conector de tienda en CAZA IA (Amazon MX vía PA-API, Mercado Libre, Sony Store, Best Buy, Keepa, Banxico para tipo de cambio, changedetection.io como fuente externa, o cualquier tienda nueva). Úsala siempre que se hable de conectar una tienda, scraping, API de una tienda, fase 0, validación de accesos, o de las tablas caza_connectors y el registro de conectores, aunque el usuario solo diga "agrega Liverpool" o "conecta Mercado Libre".
---

# Conectores de tienda

Un conector convierte lo que una tienda publica en `RawOffer`s. Todo lo demás (precio real, veredicto, autorización)
es común. Por eso un conector debe ser pequeño, honesto con el stock y respetuoso con la tienda.

## Antes de escribir código: la puerta de fase 0

Ningún conector real se habilita sin pasar por aquí. Responde y deja la evidencia en
`docs/HERRAMIENTAS_EXISTENTES.md` (sección 2) y en el estado del conector:

| Pregunta | Resultado |
| --- | --- |
| ¿Existe API oficial? ¿Qué requisitos de acceso tiene? | p. ej. PA-API exige cuenta de Associates con ventas |
| Si no hay API, ¿robots.txt y términos permiten acceso automatizado? | Amazon lo prohíbe: descartado para scraping |
| ¿Límites de tasa? ¿Costo? | Keepa cobra por tokens |
| ¿Devuelve stock y vendedor, o solo precio? | Sin stock fiable, el precio no puede entrar a la serie competitiva |

Resultado: `validado` o `descartado` en `src/connectors/registry.ts` y en `003_seed_sony_wh1000xm6.sql`, con nota.
Herramientas de evasión anti-bot (FlareSolverr, Byparr y similares) no se integran bajo ninguna circunstancia.

## Lo que ya existe

Implementados y probados sin red: `bestbuy_us`, `ebay_us`, `mercadolibre_mx`, `amazon_mx` y `amazon_us` (PA-API con
firma SigV4 propia), más el conector `webhook` de ingesta externa (`POST /api/v1/caza/observations`). La fábrica
(`src/connectors/factory.ts`) lee el estado de `caza_connectors`, las credenciales del entorno y el identificador en
`caza_product_identifiers`; `npm run connectors:status` dice por qué cada uno está o no activo y
`npm run connector:probe -- <clave>` hace una llamada real. Para activar uno, sigue `docs/RUNBOOK.md`, sección 3: no
hace falta código. Para agregar una tienda nueva, sigue "Implementar".

## Implementar

1. Crea `src/connectors/<clave>.connector.ts` implementando `PriceConnector` (`src/connectors/types.ts`):
   - `meta`: clave, mercado, moneda, tipo (`api` | `scraping` | `mock`), `soportaCompra`, `estadoValidacion`, `habilitado`.
   - `fetchOffers(productSlug, now)`: devuelve una `RawOffer` por oferta visible. Rellena `store` con la tienda y `seller` con el vendedor si la tienda es marketplace; `inStock` debe ser verdadero solo si se puede comprar ahora; `advertisedPreviousPrice` es el "antes" que la tienda muestra, se guarda como dato, nunca se confía en él.
   - No implementes `fetchHistory` en conectores reales: el historial se construye en la base de datos con cada observación.
2. Credenciales por variables de entorno validadas con zod en `src/config/env.ts`; nunca en el código ni en fixtures.
3. Llamadas HTTP con `fetch` nativo y tiempo de espera; sin SDKs abandonados (ver sección 7 de HERRAMIENTAS_EXISTENTES).
4. Mapea el producto: el conector necesita saber el identificador de la tienda (ASIN, id de ítem, URL) por `productSlug`. Ponlo en la configuración del producto, no dentro del conector.
5. Registra el conector en `src/connectors/registry.ts`, en la migración de datos iniciales, en `credentialsPresent` e `instantiate` de `src/connectors/factory.ts` y, si pide identificador, en `NEEDS_IDENTIFIER`. Agrega sus variables a `src/config/env.ts` y `.env.example`.

## Probar sin red

Las pruebas no deben depender de la tienda. Guarda una respuesta real anonimizada o sintética en
`src/connectors/fixtures/` y prueba la función de mapeo (respuesta → `RawOffer[]`) por separado de la función que
hace la petición. Casos mínimos: oferta normal, sin stock, precio con "antes", moneda inesperada (debe fallar o
descartarse, nunca convertirse en silencio).

## Qué no hace un conector

- No calcula descuentos ni compara con historial.
- No decide compras: `soportaCompra` solo declara capacidad; el ejecutor (fase 6) la usa con autorización.
- No reintenta agresivamente: respeta el intervalo de `caza_watch_configs.intervalo_minutos` (6 h por defecto).
