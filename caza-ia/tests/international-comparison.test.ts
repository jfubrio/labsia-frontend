import { describe, it, expect } from 'vitest'
import { compareInternational, landedPrice, defaultComparisonConfig } from '../src/engines/international-comparison.js'
import { importTierFor, importacionUsaMexico } from '../src/config/logistics.js'
import { loadScenario } from './helpers.js'

describe('precio aterrizado vía buzón en Texas', () => {
  it('suma impuesto de venta, importación por tramo y reenvío del buzón', async () => {
    const { offers } = await loadScenario('comparacion_internacional')
    const us = offers.find((o) => o.market === 'US')!
    const lp = landedPrice(us, defaultComparisonConfig(18.5))
    // 379 USD: imp. venta 8.25 % = 31.27 ; (379 + 31.27) × 18.5 = 7590.00
    // importación 19 % (tramo > 117 USD) = 379 × 0.19 × 18.5 = 1332.19 ; reenvío 35 USD × 18.5 = 647.5
    expect(lp.buzon).toBe('buzon_tx')
    expect(lp.impuestoVenta).toBe(31.27)
    expect(lp.tasaImportacionPct).toBe(19)
    expect(lp.impuestosImportacion).toBe(1332.19)
    expect(lp.reenvio).toBe(647.5)
    expect(lp.precioAterrizado).toBe(9569.69)
    expect(lp.monedaBase).toBe('MXN')
  })

  it('el mercado local no paga buzón, importación ni impuesto de venta extra', async () => {
    const { offers } = await loadScenario('comparacion_internacional')
    const mx = offers.find((o) => o.market === 'MX')!
    const lp = landedPrice(mx, defaultComparisonConfig(18.5))
    expect(lp.precioAterrizado).toBe(8999)
    expect(lp.buzon).toBeNull()
    expect(lp.impuestosImportacion).toBe(0)
    expect(lp.reenvio).toBe(0)
  })

  it('a 379 USD la oferta local gana; a 299.99 USD la de EE. UU. gana', async () => {
    const cfg = defaultComparisonConfig(18.5)
    const { offers } = await loadScenario('comparacion_internacional')
    const cmp = compareInternational(offers, cfg)
    expect(cmp.mejorLocal?.precioAterrizado).toBe(8999)
    expect(cmp.alternativasInternacionales).toHaveLength(0)

    const gana = (await loadScenario('oferta_usa_gana')).offers
    const cmp2 = compareInternational([...offers.filter((o) => o.market === 'MX'), ...gana], cfg)
    expect(cmp2.ranking[0]!.store).toBe('bestbuy_us')
    expect(cmp2.ranking[0]!.precioAterrizado).toBe(7709.65)
    expect(cmp2.alternativasInternacionales).toHaveLength(1)
  })

  it('tramos de importación T-MEC: 0 % hasta 50, 17 % hasta 117, 19 % después', () => {
    expect(importTierFor(importacionUsaMexico, 49.99).tasa).toBe(0)
    expect(importTierFor(importacionUsaMexico, 50).tasa).toBe(0.17)
    expect(importTierFor(importacionUsaMexico, 116.99).tasa).toBe(0.17)
    expect(importTierFor(importacionUsaMexico, 117).tasa).toBe(0.19)
    expect(importTierFor(importacionUsaMexico, 3000).tasa).toBe(0.19)
    expect(importacionUsaMexico.porConfirmar).toBe(true)
  })

  it('un producto barato cae en el tramo exento', async () => {
    const { offers } = await loadScenario('comparacion_internacional')
    const us = { ...offers.find((o) => o.market === 'US')!, price: 45 }
    const lp = landedPrice(us, defaultComparisonConfig(18.5))
    expect(lp.tasaImportacionPct).toBe(0)
    expect(lp.impuestosImportacion).toBe(0)
  })

  it('falla sin tipo de cambio, sin buzón o sin reglas de importación', async () => {
    const { offers } = await loadScenario('comparacion_internacional')
    const us = offers.find((o) => o.market === 'US')!
    const sinTc = defaultComparisonConfig(18.5)
    delete sinTc.rates.USD
    expect(() => landedPrice(us, sinTc)).toThrow(/tipo de cambio/)
    const sinBuzon = defaultComparisonConfig(18.5)
    sinBuzon.buzones = {}
    expect(() => landedPrice(us, sinBuzon)).toThrow(/sin buzón/)
    const sinReglas = defaultComparisonConfig(18.5)
    sinReglas.importacion = {}
    expect(() => landedPrice(us, sinReglas)).toThrow(/reglas de importación/)
  })
})
