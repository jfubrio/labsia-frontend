---
name: caza-scenario
description: Trabajar con el motor de precio real de mercado de CAZA IA. Ajustar parámetros (ventana, vida media, vigencia, umbrales de régimen o lanzamiento), agregar escenarios al fixture multitienda, agregar un producto de prueba, o entender por qué una oferta salió real, falso, dudoso o mínimo histórico. Úsala siempre que se hable de precio real, veredictos, anclas, precios de lanzamiento, historial de precios, fixtures o del archivo market-price.ts, aunque el usuario no nombre el motor.
---

# Motor de precio real y escenarios

El motor (`caza-ia/src/engines/market-price.ts`) es el núcleo del sistema: si juzga mal, todo lo demás sobra.
Cualquier cambio aquí se hace con los números a la vista, no de memoria.

## Cómo piensa el motor (resumen operativo)

1. Toma observaciones en stock del mismo mercado y moneda en 90 días.
2. Cada tienda mantiene su último precio vigente hasta 7 días (o hasta verse sin stock). Esto evita que un día en que solo se vio la tienda cara parezca una subida.
3. Precio competitivo del día = mínimo entre precios vigentes de todas las tiendas.
4. Precio real = mediana ponderada por recencia (vida media 21 días), acotada por la mediana reciente si el régimen es "bajando".
5. Lanzamiento inflado: primer 30 % de la serie más de 15 % sobre el precio real con tendencia negativa.
6. Confianza según **días con observaciones reales** (no arrastradas) y número de tiendas.

Los parámetros viven en `MARKET_PRICE_DEFAULTS`. La sección 3 del plan los explica con el ejemplo de los Sony.

## Ver el perfil antes y después de cualquier cambio

```bash
cd caza-ia && npm run profile              # sony-wh1000xm6 MX MXN
npm run profile -- <slug> MX MXN           # otro producto del fixture
```

Imprime precio real, piso, techo, régimen, confianza, notas, objetivo derivado y la serie diaria
`edad:precio@tienda/tiendas vigentes`. Léela de derecha (hoy) a izquierda (hace 90 días) y comprueba que cada tramo
corresponde a la tienda que esperabas. Si un tramo largo lo domina una tienda observada una sola vez, es el arrastre
de 7 días actuando sobre un muestreo escaso: ajusta el fixture o `maxStaleDays`, no el veredicto.

## Agregar un escenario

Los escenarios están en `src/connectors/fixtures/<slug>.json` bajo `scenarios`. Cada uno lleva `description` (qué
demuestra y qué veredicto se espera) y `offers`. Pasos:

1. Decide qué comportamiento del mercado quieres demostrar (un ancla inflada, un régimen al alza, una tienda sin stock, una oferta en otra moneda).
2. Agrega el escenario al JSON y su nombre al tipo `MockScenario` en `src/connectors/mock.connector.ts`.
3. Agrega una prueba en `tests/discount-validator.test.ts` (veredicto) o `tests/market-price.test.ts` (perfil) que afirme el veredicto y la razón de fondo, no solo el valor. Un buen test dice por qué: `expect(v.razon).toMatch(/lanzamiento/)`.
4. Súmalo a la lista `scenarios` de `src/scripts/phase1-demo.ts` si aporta al recorrido de la demo.
5. `npm run verify`.

## Cambiar el historial del fixture

El historial se generó con un script y debe seguir siendo reproducible: la tienda oficial fija en el precio de
lanzamiento, dos tiendas bajando por escalones, una venta flash de un día. Si cambias precios o fechas, vuelve a
correr `npm run profile` y actualiza las aserciones numéricas de las pruebas y la tabla de la sección 3.4 del plan.
Nunca uses datos reales de tiendas en los fixtures.

## Agregar un producto de prueba

1. `src/config/products/<slug>.ts` con `ProductConfig` (deja `precioObjetivo: null` salvo que el usuario fije uno; `precioListaInformativo` es solo informativo).
2. Regístralo en `src/config/products/index.ts`.
3. `src/connectors/fixtures/<slug>.json` con `history` multitienda (mínimo 20 días observados y 2 tiendas para confianza alta) y `scenarios`.
4. Pruebas que fijen precio real, piso, régimen y al menos un veredicto por tipo.

## Ajustar parámetros del motor

Cambia uno a la vez, corre `npm run profile`, mira qué veredictos cambian en `npm run demo`, y documenta el motivo en
"Decisiones pendientes" del plan. Un parámetro que hace pasar un test rompiendo el caso del ancla de lanzamiento
("antes 11,999, ahora 9,499" debe seguir siendo falso) está mal ajustado.
