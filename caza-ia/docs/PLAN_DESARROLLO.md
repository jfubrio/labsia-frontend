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
4. Un descuento solo cuenta como real si el precio actual es menor que el precio típico observado, no solo que el "precio anterior" que anuncia la tienda.
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
| Validación de descuentos | Decide si un descuento anunciado es real contra el historial | Observación + historial 30/90 días | `DiscountVerdict` (real, dudoso, falso) | 1 (lógica) / 3 (datos reales) |
| Comparación internacional | Calcula precio aterrizado por mercado (tipo de cambio, envío, impuestos) | Observaciones de varios mercados | Ranking por precio aterrizado | 1 (lógica) / 4 (tipos de cambio en vivo) |
| Autorización | Gestiona `approve`/`reject`, vigencia y vínculo con oferta | Decisión del operador | `PurchaseAuthorization` | 1 (lógica) / 5 (UI) |
| Anti-duplicados | Impide dos órdenes activas para el mismo producto | Intento de orden | Orden creada o rechazo idempotente | 1 |
| Ejecutor de compra | Ejecuta la compra en el conector autorizado | Autorización aprobada vigente | `PurchaseOrder` | 6 (deshabilitado antes) |

## 3. Validación de descuentos reales y comparación internacional

Un precio anunciado como "antes $X, ahora $Y" no se toma como descuento. El motor compara el precio actual con:

- la **mediana de 30 días** y la **mediana de 90 días** del historial propio;
- el **mínimo de 90 días** (para detectar "oferta" que en realidad es el precio habitual);
- un **umbral mínimo de ahorro** configurado por producto (por defecto 10 %).

Veredictos: `real` (por debajo de la mediana 90d y supera el umbral), `dudoso` (por debajo de la mediana 30d pero no de la 90d, o historial insuficiente), `falso` (igual o por encima de la mediana 90d aunque la tienda anuncie descuento).

La comparación internacional convierte cada oferta a la moneda base del producto (MXN) y suma envío e impuestos
estimados de importación por mercado. Solo las ofertas con precio aterrizado menor al mejor precio local se reportan
como alternativa. `[PENDIENTE: texto original — tabla de mercados y supuestos de importación]`

## 4. Base de datos, API e integraciones por validar

Esquema lógico implementado en `src/db/migrations/001_caza_ia_schema.sql` y `002_purchase_guards.sql`:

| Tabla | Propósito |
| --- | --- |
| `caza_products` | Producto vigilado, moneda base, estado |
| `caza_watch_configs` | Precio objetivo, precio máximo, umbral de descuento, mercados, requiere aprobación |
| `caza_connectors` | Conector por tienda/mercado, estado de validación de acceso (fase 0) |
| `caza_price_observations` | Cada precio observado: precio, precio anunciado anterior, moneda, stock, URL, hash de la oferta |
| `caza_discount_verdicts` | Veredicto del motor por observación |
| `caza_purchase_authorizations` | `approve`/`reject` del operador, vigencia, vínculo con observación |
| `caza_purchase_orders` | Órdenes (ninguna se crea con compras deshabilitadas); índice único parcial anti-duplicados |
| `caza_audit_log` | Todo evento relevante, inmutable |

Integraciones por validar en fase 0 (acceso, API oficial o scraping permitido, límites de tasa):

| Integración | Mercado | Uso | Vía | Estado |
| --- | --- | --- | --- | --- |
| Amazon México | MX | precio, stock | PA-API 5.0 (requiere cuenta Associates con ventas); sin scraping | por validar |
| Keepa | MX | historial de precios de Amazon | API de pago; cobertura MX por confirmar | por validar |
| Sony Store México | MX | precio, stock | changedetection.io o Crawlee, si robots.txt y términos lo permiten | por validar |
| Mercado Libre | MX | precio, stock | API oficial con OAuth; búsqueda pública cerrada desde 2025 (por confirmar) | por validar |
| Amazon US / Best Buy | US | comparación internacional | PA-API US / Best Buy Developer API | por validar |
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
| 1 | Base de datos, configuración de los Sony, conector mock | 0 (puede avanzar en paralelo con mock) | Migraciones 001–002, `sony-wh1000xm6.ts`, conector mock, motores con pruebas | `npm test` y `npm run typecheck` en verde; demo corre sin red; ninguna orden creada |
| 2 | Vigilancia programada | 1 | Worker BullMQ, programación por producto, persistencia en Postgres | Observaciones cada N horas en DB con historial consultable |
| 3 | Conectores reales MX | 0, 2 | Amazon MX, Sony Store MX | Precio real coincide con la página en 3 verificaciones manuales |
| 4 | Comparación internacional en vivo | 3 | Conector US, tipo de cambio diario | Precio aterrizado reproducible con la fórmula documentada |
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
- [ ] Umbral de descuento real por defecto: se asume 10 %.
- [ ] Vigencia de una autorización `approve`: se asume 24 h.
- [ ] Supuestos de importación US→MX (envío e impuestos): se asumen 15 % + envío fijo; confirmar.
- [ ] Qué tiendas quedan en el alcance tras la fase 0.

## 9. Configuración inicial: Sony WH-1000XM6

Definida en `src/config/products/sony-wh1000xm6.ts`:

| Parámetro | Valor |
| --- | --- |
| Producto | Sony WH-1000XM6 (audífonos inalámbricos con cancelación de ruido) |
| Moneda base | MXN |
| Precio de referencia (lista MX) | 9,999 MXN en Amazon MX; 11,999 MXN en Sony Store al lanzamiento `[confirmar]` |
| Precio objetivo | 7,999 MXN |
| Precio máximo autorizable | 8,499 MXN |
| Umbral de descuento real | 12 % |
| Mercados vigilados | MX (principal), US (comparación) |
| Requiere aprobación humana | sí |
| Compras | deshabilitadas |
| Vigilancia | no activada (se activa en fase 2) |
