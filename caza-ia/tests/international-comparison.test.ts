import { describe, it, expect } from 'vitest'
import { compareInternational, landedPrice, defaultComparisonConfig } from '../src/engines/international-comparison.js'
import { loadScenario } from './helpers.js'

describe('comparación internacional', () => {
  it('calcula el precio aterrizado con tipo de cambio, impuestos y envío', async () => {
    const { offers } = await loadScenario('comparacion_internacional')
    const us = offers.find((o) => o.market === 'US')!
    const lp = landedPrice(us, defaultComparisonConfig(18.5))
    // 379 * 18.5 = 7011.5 ; impuestos 15 % = 1051.72 (redondeo a centavos) ; envío 650 → 8713.22
    expect(lp.precioAterrizado).toBe(8713.22)
    expect(lp.monedaBase).toBe('MXN')
  })

  it('no aplica envío ni impuestos al mercado local', async () => {
    const { offers } = await loadScenario('comparacion_internacional')
    const mx = offers.find((o) => o.market === 'MX')!
    const lp = landedPrice(mx, defaultComparisonConfig(18.5))
    expect(lp.precioAterrizado).toBe(8999)
    expect(lp.envio).toBe(0)
    expect(lp.impuestos).toBe(0)
  })

  it('señala la oferta US como alternativa cuando gana al mejor precio local', async () => {
    const { offers } = await loadScenario('comparacion_internacional')
    const cmp = compareInternational(offers, defaultComparisonConfig(18.5))
    expect(cmp.mejorLocal?.precioAterrizado).toBe(8999)
    expect(cmp.alternativasInternacionales).toHaveLength(1)
    expect(cmp.ranking[0]!.market).toBe('US')
  })

  it('con un tipo de cambio alto la oferta US deja de ser alternativa', async () => {
    const { offers } = await loadScenario('comparacion_internacional')
    const cmp = compareInternational(offers, defaultComparisonConfig(21))
    expect(cmp.alternativasInternacionales).toHaveLength(0)
  })

  it('falla si no hay tipo de cambio para la moneda', async () => {
    const { offers } = await loadScenario('comparacion_internacional')
    const us = offers.find((o) => o.market === 'US')!
    const cfg = defaultComparisonConfig(18.5)
    delete cfg.rates.USD
    expect(() => landedPrice(us, cfg)).toThrow(/tipo de cambio/)
  })
})
