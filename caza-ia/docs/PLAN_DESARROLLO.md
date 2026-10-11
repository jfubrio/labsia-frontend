# CAZA IA — Plan de desarrollo

> **Estado de este archivo:** reconstrucción a partir del resumen del plan original (ChatGPT Pages),
> cuyo enlace no llegó al repositorio. Las secciones marcadas con `[PENDIENTE: texto original]`
> deben sustituirse por el contenido completo del documento cuando se pegue aquí.
> Lo que sí está completo es lo que la fase 1 implementa en código: esquema lógico de base de datos,
> configuración de los Sony WH-1000XM6, conector con datos de prueba y guardas de compra.

**Reglas no negociables (vigentes en todas las fases):**

1. Las compras están **deshabilitadas** hasta que se complete la fase 6 y exista aprobación humana explícita.
2. Ninguna compra se ejecuta sin una autorización `approve` registrada, vinculada a una oferta concreta y con vigencia.
3. Un mismo producto no puede comprarse dos veces mientras exista una orden activa (restricción en base de datos, no solo en código).
4. Un descuento solo cuenta como real contra el **precio real de mercado**, que sale del comportamiento de la oferta competitiva entre tiendas a lo largo del tiempo. El precio de lista, el de lanzamiento y el "antes" que anuncia una tienda nunca son referencia.
5. Los conectores reales solo se activan tras validar accesos y términos de uso en la fase 0.

---

## 1. Arquitectura

```
                 ┌──────────────────────────────────────────────────┐
                 │                 CAZA IA (core)                   │
   Conectores    │                                                  │
 ┌────────────┐  │  ┌──────────────┐   ┌────────────────────────┐   │
 │ Mock (F1)  │──┼─▶│ Ingesta de   │──▶│ Motor de validación de │   │
 │ Amazon MX  │  │  │ observaciones│   │ descuentos reales      │   │
 │ Sony Store │  │  └──────────────┘   └───────────┬────────────┘   │
 │ Best Buy / │  │          │                      │                │
 │ Amazon US  │  │          ▼                      ▼                │
 └────────────┘  │  ┌──────────────┐   ┌────────────────────────┐   │
                 │  │ Historial de │   │ Motor de comparación   │   │
                 │  │ precios (DB) │   │ internacional          │   │
                 │  └──────────────┘   └───────────┬────────────┘   │
                 │                                 ▼                │
                 │                     ┌────────────────────────┐   │
   Operador ────▶│   approve / reject  │ Motor de autorización  │   │
   (humano)      │                     │ + anti-duplicados      │   │
                 │                     └───────────┬────────────┘   │
                 │                                 ▼                │
                 │                     ┌────────────────────────┐   │
                 │     PURCHASES_ENABLED=false     │ Ejecutor de compra   │ (F6+)
                 │                     └────────────────────────┘   │
                 └──────────────────────────────────────────────────┘
```

Stack alineado con LABSIA: Node 22 + TypeScript, PostgreSQL (migraciones SQL numeradas), Fastify y Drizzle en
fases posteriores, Redis/BullMQ para programación de vigilancia, Vitest para pruebas.

## 2. Motores del sistema

| Motor | Responsabilidad | Entrada | Salida | Fase |
| --- | --- | --- | --- | --- |
| Ingesta | Normaliza observaciones de precio de cada conector | `RawOffer` del conector | `PriceObservation` | 1 |
| **Precio real de mercado** (central) | Calcula a cuánto se consigue de verdad el producto, a partir del comportamiento de la oferta competitiva en el tiempo | Historial multitienda 90 días | `MarketPriceProfile` (precio real, piso, techo, régimen, lanzamiento inflado, confianza) | 1 |
| Validación de descuentos | Juzga una oferta contra el precio real de mercado | Observación + `MarketPriceProfile` | `DiscountVerdict` (mínimo histórico, real, dudoso, falso, sin historial) | 1 (lógica) / 3 (datos reales) |
| Comparación internacional | Calcula precio aterrizado por mercado (tipo de cambio, envío, impuestos) | Observaciones de varios mercados | Ranking por precio aterrizado | 1 (lógica) / 4 (tipos de cambio en vivo) |
| Autorización | Gestiona `approve`/`reject`, vigencia y vínculo con oferta | Decisión del operador | `PurchaseAuthorization` | 1 (lógica) / 5 (UI) |
| Anti-duplicados | Impide dos órdenes activas para el mismo producto | Intento de orden | Orden creada o rechazo idempotente | 1 |
| Ejecutor de compra | Ejecuta la compra en el conector autorizado | Autorización aprobada vigente | `PurchaseOrder` | 6 (deshabilitado antes) |

## 3. Precio real de mercado y validación de descuentos

**Este es el motor central. Sin él, nada de lo demás sirve.** Un producto no vale lo que dice su precio de lista, ni lo que costó al lanzarse, ni el "antes" que una tienda imprime junto al precio. Vale lo que de verdad se ha podido pagar por él, en la tienda más competitiva, a lo largo del tiempo. Un modelo nuevo sale caro y baja; una tienda oficial puede quedarse meses en el precio de lanzamiento; una tienda puede inventar un "antes" que nunca existió. El análisis del comportamiento del precio en el tiempo es lo que separa una oferta real de una puesta en escena.

### 3.1 Cómo se calcula el precio real (`src/engines/market-price.ts`)

1. **Oferta competitiva, no tienda a tienda.** Se toman las observaciones en stock de todas las tiendas del mismo mercado y moneda en una ventana de 90 días.
2. **Precio vigente por tienda.** Las tiendas no se muestrean el mismo día ni con la misma frecuencia. Cada tienda conserva su último precio conocido como vigente hasta 7 días (o hasta verse sin stock), para no confundir "hoy solo vimos la tienda cara" con "hoy subió el precio". En producción este plazo se alinea con el intervalo de vigilancia.
3. **Precio competitivo del día** = mínimo entre los precios vigentes de todas las tiendas. Una tienda que se queda en 11,999 cuando otras venden a 8,999 no mueve el precio real.
4. **Mediana ponderada por recencia** sobre la serie diaria (vida media 21 días). Los primeros meses de un modelo nuevo pesan poco; lo reciente pesa mucho.
5. **Régimen.** Mediana de los últimos 30 días contra la de los 60 anteriores: bajando, estable o subiendo (umbral ±5 %). Si el precio viene bajando, el precio real se acota a la mediana reciente: lo que importa es a cuánto se consigue hoy.
6. **Lanzamiento inflado.** Si el primer 30 % de la serie está más de 15 % por encima del precio real y la tendencia es negativa, se marca y se descarta como referencia.
7. **Piso y techo** de la serie competitiva: el mejor y el peor precio al que de verdad se pudo comprar.
8. **Confianza** según días con observaciones reales (no arrastradas) y número de tiendas: alta (≥20 días y ≥2 tiendas), media (≥10 días), baja; y baja también si no hay datos en los últimos 30 días. Con menos de 5 días no hay precio real.

### 3.2 Veredicto sobre una oferta (`src/engines/discount-validator.ts`)

| Veredicto | Condición | Efecto |
| --- | --- | --- |
| `minimo_historico` | precio ≤ piso de la ventana y por debajo del precio real | propone compra |
| `real` | precio < precio real y ahorro ≥ umbral del producto (12 % en los Sony) | propone compra |
| `dudoso` | precio < precio real pero ahorro < umbral | solo informa |
| `falso` | precio ≥ precio real, aunque la tienda anuncie descuento | solo informa |
| `sin_historial` | sin perfil de mercado suficiente | nada se da por bueno |

Además se marca **ancla inflada** cuando el "antes" anunciado supera el peor precio competitivo visto en la ventana, y se informa el ahorro anunciado solo para evidenciar la diferencia con el ahorro real. Ninguna propuesta se genera con confianza baja o sin historial.

### 3.3 Objetivo derivado

Si el producto no fija un objetivo manual, el objetivo = precio real × (1 − umbral), sin superar el tope duro `precioMaximo`. Así el objetivo sigue al mercado en lugar de a un número escrito a mano.

### 3.4 Ejemplo con los Sony WH-1000XM6 (datos de prueba, `src/connectors/fixtures/`)

Historial sintético de 90 días con cuatro tiendas: la oficial fija en 11,999 (lanzamiento), Amazon y Mercado Libre bajando por escalones hasta 8,999 y 9,099, y una venta flash de un día a 7,499.

| Resultado del análisis | Valor |
| --- | --- |
| Precio real de mercado | 8,999 MXN |
| Piso / techo competitivo | 7,499 / 11,999 MXN |
| Régimen | bajando (−8.2 %) |
| Lanzamiento inflado | sí (primer tramo 27.8 % sobre el precio real) |
| Objetivo derivado (12 %) | 7,919 MXN |

| Oferta | Anuncia | Veredicto | Por qué |
| --- | --- | --- | --- |
| Tienda oficial 9,499 "antes 11,999" | −20.8 % | **falso** | 11,999 fue precio de lanzamiento; 9,499 está sobre el precio real |
| Amazon 9,199 "antes 10,999" | −16.4 % | falso | igual o mayor que el precio real |
| Amazon 8,599 "antes 9,999" | −14 % | dudoso | ahorro real 4.4 %, bajo el umbral |
| Amazon 7,899 "antes 9,999" | −21 % | **real** | ahorro real 12.2 % y sobre el piso; propone compra |
| Amazon 5,933 "antes 9,999" | −40.7 % | **mínimo histórico** | mejora el mejor precio competitivo visto; propone compra |

### 3.5 Compra en EE. UU. vía buzón en Texas con cruce personal

EE. UU. es mercado de **compra**, no solo de comparación: hay un buzón de recepción en Texas y el comprador vive
cerca de la frontera, pasa por el buzón y cruza él mismo con la mercancía. Eso evita el reenvío por paquetería y la
importación simplificada sobre todo el valor: aplica la **franquicia de pasajero** y, solo si el valor la excede, la
tasa global sobre el excedente. Una compra allí es doméstica (la tienda cobra el impuesto de venta de Texas y suele
enviar gratis al buzón). Para competir con una oferta local, una oferta de EE. UU. se evalúa por su **precio
aterrizado** en MXN (`src/engines/international-comparison.ts`, `src/config/logistics.ts`):

```
cruce personal:  aterrizado = (precio + impuesto de venta + envío doméstico + recepción en buzón + costo de viaje) × tc
                              + max(0, precio − franquicia disponible) × tasa sobre el excedente × tc
paquetería (alternativa): (precio + impuesto de venta + envío doméstico + recepción) × tc
                              + precio × tasa del tramo T-MEC × tc + reenvío × tc
```

| Componente | Supuesto fase 1 | Estado |
| --- | --- | --- |
| Impuesto de venta Texas | 8.25 % (tope combinado; depende de la dirección exacta del buzón) | por confirmar |
| Envío tienda → buzón | 0 USD | por confirmar |
| Recepción en el buzón | 5 USD por paquete | por confirmar con el proveedor |
| Costo del viaje al buzón | 0 (el comprador pasa de todos modos) | decisión |
| Franquicia de pasajero por tierra | 500 USD por persona y cruce (tabla PRODECON 2026; 300 USD en 2024; 150 USD para residentes de la franja fronteriza, regla 3.4.1 RGCE) | por confirmar cuál aplica |
| Excedente de la franquicia | 19 % tasa global, con factura, hasta 3,000 USD; por encima requiere agente aduanal | por confirmar en RGCE 2026 / ANAM |
| Paquetería (alternativa) | 35 USD de reenvío + tramos T-MEC 0/17/19 % | por confirmar |
| Tipo de cambio | fijo 18.5 hasta la fase 4 (Banxico FIX) | — |

Reglas:

1. El **veredicto** de una oferta de EE. UU. se juzga contra el precio real del mercado de EE. UU., en dólares, con su propio historial multitienda. Un precio que aterriza barato pero no es descuento real en su mercado **no se propone**: el análisis del mercado manda, no el tipo de cambio.
2. El **objetivo** y el **tope** se expresan siempre en MXN y salen del perfil del mercado de casa. Derivar el objetivo de un perfil en otra moneda es un error y el código lo rechaza.
3. Se **propone** la compra en EE. UU. solo si el mercado está en `mercadosCompra`, existe buzón, el veredicto es real o mínimo histórico con confianza suficiente, el valor no exige agente aduanal y el aterrizado queda por debajo del objetivo y del tope.
4. La franquicia es por persona y por cruce: si varias compras comparten un cruce, `franquiciaDisponibleUsd` reparte la que queda. Esto lo gestionará el flujo de aprobación en la fase 5.
5. La autorización `approve` guarda el tope en la moneda de la oferta (USD) y el aterrizado estimado en MXN; el tope también se valida aterrizado contra el máximo del producto.

Ejemplo con los datos de prueba (tc 18.5): el mercado US tiene precio real 369.99 USD y piso 329.99. Best Buy a 299.99 USD
es mínimo histórico y aterriza en 6,100.19 MXN dentro de la franquicia: **se propone**. Amazon US a 349.99 aterriza en
7,101 MXN, por debajo del objetivo, pero su ahorro frente al precio real US es 5.4 %: dudoso, se informa. A 379 USD
aterriza en 7,682.50 y gana la comparación al local de 8,999, pero no es descuento real en EE. UU.: tampoco se propone.
Por paquetería el mismo 379 aterrizaría en 9,662 y perdería.

## 4. Base de datos, API e integraciones por validar

Esquema lógico implementado en `src/db/migrations/001_caza_ia_schema.sql` y `002_purchase_guards.sql`:

| Tabla | Propósito |
| --- | --- |
| `caza_products` | Producto vigilado, moneda base, estado |
| `caza_watch_configs` | Precio de lista (solo informativo), objetivo manual opcional, tope duro, umbral de descuento, mercados, requiere aprobación |
| `caza_connectors` | Conector por tienda/mercado, estado de validación de acceso (fase 0) |
| `caza_buzones` | Buzones de recepción en el extranjero: modo de ingreso (cruce personal o paquetería), impuesto de venta, recepción, franquicia, tasa sobre excedente, reenvío |
| `caza_reglas_importacion` | Tramos de importación por paquetería por valor (USD) entre origen y destino, con fuente y vigencia (ruta alternativa) |
| `caza_price_observations` | Cada precio observado: tienda, precio, precio anunciado anterior, moneda, stock, URL, hash de la oferta |
| `caza_market_price_profiles` | Perfil de precio real de mercado por producto, mercado y moneda: serie competitiva, precio real, piso, techo, régimen, confianza |
| `caza_discount_verdicts` | Veredicto por observación contra el perfil de precio real |
| `caza_purchase_authorizations` | `approve`/`reject` del operador, vigencia, vínculo con observación; tope en moneda de la oferta, aterrizado en base y buzón |
| `caza_purchase_orders` | Órdenes (ninguna se crea con compras deshabilitadas); índice único parcial anti-duplicados |
| `caza_audit_log` | Todo evento relevante, inmutable |

Integraciones por validar en fase 0 (acceso, API oficial o scraping permitido, límites de tasa):

| Integración | Mercado | Uso | Vía | Estado |
| --- | --- | --- | --- | --- |
| Amazon México | MX | precio, stock | PA-API 5.0 (requiere cuenta Associates con ventas); sin scraping | por validar |
| Keepa | MX | historial de precios de Amazon | API de pago; cobertura MX por confirmar | por validar |
| Sony Store México | MX | precio, stock | changedetection.io o Crawlee, si robots.txt y términos lo permiten | por validar |
| Mercado Libre | MX | precio, stock | API oficial con OAuth; búsqueda pública cerrada desde 2025 (por confirmar) | por validar |
| Amazon US | US | precio, stock, **compra vía buzón** | PA-API US (misma cuenta Associates) | por validar |
| Best Buy | US | precio, stock, compra vía buzón | Best Buy Developer API (clave gratuita) | por validar |
| Walmart | US | precio, stock, compra vía buzón | Walmart Affiliate API (peticiones firmadas) | por validar |
| eBay | US | precio, stock, compra vía buzón | Browse API oficial; producción requiere aprobación de eBay | por validar |
| B&H Photo / Newegg | US | precio, stock | sin API pública; changedetection.io si sus términos lo permiten | por validar |
| Buzón Texas | US→MX | recepción; el comprador recoge y cruza por tierra | proveedor del buzón (tarifa de recepción, dirección); franquicia de pasajero | por confirmar |
| Banxico SIE / Frankfurter | — | tipo de cambio FIX | API oficial gratuita con token / respaldo autoalojado | por validar |

Evaluación detallada de herramientas, licencias y decisiones por fase en [HERRAMIENTAS_EXISTENTES.md](HERRAMIENTAS_EXISTENTES.md).

`[PENDIENTE: texto original — endpoints de la API interna]`

## 5. Autorización `approve` y prevención de compras duplicadas

Flujo: observación → veredicto `real` → propuesta de compra → el operador registra `approve` o `reject` → si
`approve`, la autorización vale para **una** observación concreta, con precio máximo y vigencia (por defecto 24 h).
Una autorización caducada, usada o para otra oferta no habilita nada.

Prevención de duplicados, en este orden:

1. **Idempotencia**: cada intento de orden lleva una clave `idempotency_key` derivada de producto + autorización. Repetir el intento devuelve la misma orden.
2. **Restricción en base de datos**: índice único parcial sobre `product_id` donde `status IN ('pending','authorized','placed')`. Dos procesos en paralelo no pueden crear dos órdenes activas.
3. **Autorización de un solo uso**: `caza_purchase_authorizations.consumed_at` se marca al crear la orden.
4. **Interruptor global**: `PURCHASES_ENABLED` es `false` y el ejecutor lanza error si se le invoca.

## 6. Etapas de desarrollo

| Fase | Objetivo | Depende de | Entregables | Criterio de aceptación |
| --- | --- | --- | --- | --- |
| 0 | Validar accesos e integraciones | — | Tabla de conectores con estado, términos revisados | Cada conector marcado `validado` o `descartado` con evidencia |
| 1 | Motor de precio real de mercado, base de datos, configuración de los Sony, conector mock | 0 (puede avanzar en paralelo con mock) | Migraciones 001–003, motor de precio real con historial multitienda, `sony-wh1000xm6.ts`, conector mock, motores con pruebas | `npm test` y `npm run typecheck` en verde; el ancla de lanzamiento se juzga `falso`; demo corre sin red; ninguna orden creada |
| 2 | Vigilancia programada | 1 | Worker BullMQ, programación por producto, persistencia en Postgres | Observaciones cada N horas en DB con historial consultable |
| 3 | Conectores reales MX | 0, 2 | Amazon MX, Sony Store MX | Precio real coincide con la página en 3 verificaciones manuales |
| 4 | Compra en EE. UU. en vivo | 3 | Conectores US, tipo de cambio diario (Banxico), tarifa real del buzón, franquicia y tasa de excedente confirmadas | Precio aterrizado reproducible con la fórmula documentada contra un ticket real de compra y cruce |
| 5 | Panel y flujo `approve` | 2 | API + UI de propuestas, aprobación con vigencia | Aprobación registrada en audit log; rechazo bloquea orden |
| 6 | Ejecución de compra (habilitable) | 3, 5 | Ejecutor por conector, `PURCHASES_ENABLED` configurable | Prueba de duplicado concurrente: 2 intentos → 1 orden |
| 7 | Pruebas de extremo a extremo y hardening | 6 | Suite E2E, alertas, límites de gasto | Simulacro completo sin compra real, alertas disparan |
| 8 | Operación | 7 | Runbook, backups, monitoreo | Primera compra real aprobada manualmente y documentada |

`[PENDIENTE: texto original — detalle de cada fase]`

## 7. Pruebas

- Unitarias (Vitest) para cada motor: validación de descuentos, comparación internacional, autorización, anti-duplicados.
- Prueba de concurrencia (fase 6) con dos intentos simultáneos contra Postgres, siguiendo el patrón de LABSIA DOC 10.
- Prueba de interruptor: con `PURCHASES_ENABLED=false` el ejecutor nunca llega al conector.

## 8. Decisiones pendientes

- [ ] Moneda base y mercado principal: se asume MXN y México.
- [ ] Umbral de descuento real por defecto: se asume 10 % (12 % en los Sony).
- [ ] Parámetros del motor de precio real: ventana 90 días, vida media 21 días, vigencia 7 días, régimen ±5 %, lanzamiento inflado 15 %. Ajustar con datos reales en fase 3.
- [ ] Vigencia de una autorización `approve`: se asume 24 h.
- [ ] Buzón en Texas: dirección exacta (fija la tasa de impuesto de venta, se asume 8.25 %), tarifa de recepción por paquete (se asumen 5 USD) y horarios.
- [ ] Franquicia de pasajero que aplica al comprador: 500 USD general por tierra (PRODECON 2026) o 150 USD si cuenta como residente de la franja fronteriza. Cambia qué compras quedan libres de impuestos.
- [ ] Excedente de franquicia: confirmar 19 % de tasa global, requisito de factura y tope de 3,000 USD del pago simplificado (RGCE 2026 / ANAM).
- [ ] Cómo repartir la franquicia entre varias compras que cruzan juntas (fase 5).
- [ ] Tramos de importación por paquetería desde EE. UU. (ruta alternativa): confirmar vigencia en DOF/SAT.
- [ ] Alcance de tiendas de EE. UU. tras la fase 0: Amazon US, Best Buy, Walmart, eBay confirmadas como candidatas; B&H y Newegg dependen de términos.
- [ ] Qué tiendas quedan en el alcance tras la fase 0.

## 9. Configuración inicial: Sony WH-1000XM6

Ejemplo para construir la lógica, definido en `src/config/products/sony-wh1000xm6.ts`:

| Parámetro | Valor |
| --- | --- |
| Producto | Sony WH-1000XM6 (audífonos inalámbricos con cancelación de ruido) |
| Moneda base | MXN |
| Precio de lista informativo | 11,999 MXN (lanzamiento Sony Store MX). **No es referencia de nada** |
| Precio objetivo | derivado: precio real de mercado × (1 − 12 %) |
| Tope duro (`precioMaximo`) | 8,499 MXN |
| Umbral de descuento real | 12 % |
| Mercados vigilados | MX (principal), US |
| Mercados de compra | MX y US (buzón en Texas, cruce personal) |
| Requiere aprobación humana | sí |
| Compras | deshabilitadas |
| Vigilancia | no activada (se activa en fase 2) |
