import { describe, it, expect } from 'vitest'
import { validateDiscount, MIN_SAMPLES_FOR_VERDICT } from '../src/engines/discount-validator.js'
import { loadScenario, product, NOW } from './helpers.js'

describe('validateDiscount', () => {
  it('marca como real un precio por debajo de la mediana 90d que supera el umbral', async () => {
    const { history, offers } = await loadScenario('descuento_real')
    const v = validateDiscount(offers[0]!, history, product, NOW)
    expect(v.veredicto).toBe('real')
    expect(v.mediana90d).toBe(9399)
    expect(v.ahorroPctReal).toBeGreaterThanOrEqual(product.umbralDescuentoPct)
    expect(v.muestras).toBe(12)
  })

  it('marca como falso un descuento anunciado cuyo precio no baja de la mediana 90d', async () => {
    const { history, offers } = await loadScenario('descuento_falso')
    const v = validateDiscount(offers[0]!, history, product, NOW)
    expect(v.veredicto).toBe('falso')
    expect(v.ahorroPctAnunciado).toBeGreaterThan(20) // la tienda anuncia 27 %
    expect(v.ahorroPctReal).toBeLessThanOrEqual(0)
  })

  it('marca como dudoso un ahorro real por debajo del umbral', async () => {
    const { history, offers } = await loadScenario('descuento_dudoso')
    const v = validateDiscount(offers[0]!, history, product, NOW)
    expect(v.veredicto).toBe('dudoso')
    expect(v.ahorroPctReal).toBeGreaterThan(0)
    expect(v.ahorroPctReal!).toBeLessThan(product.umbralDescuentoPct)
  })

  it('marca como dudoso cuando el historial es insuficiente', async () => {
    const { history, offers } = await loadScenario('descuento_real')
    const v = validateDiscount(offers[0]!, history.slice(0, MIN_SAMPLES_FOR_VERDICT - 1), product, NOW)
    expect(v.veredicto).toBe('dudoso')
    expect(v.razon).toMatch(/insuficiente/)
  })

  it('ignora el historial de otra moneda o mercado', async () => {
    const { history, offers } = await loadScenario('comparacion_internacional')
    const us = offers.find((o) => o.market === 'US')!
    const v = validateDiscount(us, history, product, NOW)
    expect(v.muestras).toBe(0)
    expect(v.veredicto).toBe('dudoso')
  })
})
