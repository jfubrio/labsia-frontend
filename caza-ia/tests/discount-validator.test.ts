import { describe, it, expect } from 'vitest'
import { validateDiscount } from '../src/engines/discount-validator.js'
import { loadScenario, product, NOW } from './helpers.js'

describe('validateDiscount contra el precio real de mercado', () => {
  it('el "antes 11,999" de la tienda oficial es FALSO: era precio de lanzamiento, no referencia', async () => {
    const { history, offers } = await loadScenario('ancla_lanzamiento')
    const v = validateDiscount(offers[0]!, history, product, NOW)
    expect(v.veredicto).toBe('falso')
    expect(v.ahorroPctAnunciado).toBeCloseTo(20.84, 1) // lo que la tienda presume
    expect(v.ahorroPctReal).toBeLessThan(0) // lo que de verdad ahorra: nada
    expect(v.precioReal).toBe(8999)
    expect(v.lanzamientoInflado).toBe(true)
    expect(v.razon).toMatch(/lanzamiento/)
  })

  it('un precio igual o mayor al precio real es falso aunque anuncie descuento', async () => {
    const { history, offers } = await loadScenario('descuento_falso')
    const v = validateDiscount(offers[0]!, history, product, NOW)
    expect(v.veredicto).toBe('falso')
    expect(v.anclaInflada).toBe(false) // 10,999 sí se vio como precio competitivo
  })

  it('por debajo del precio real pero sin alcanzar el umbral es dudoso', async () => {
    const { history, offers } = await loadScenario('descuento_dudoso')
    const v = validateDiscount(offers[0]!, history, product, NOW)
    expect(v.veredicto).toBe('dudoso')
    expect(v.ahorroPctReal).toBeGreaterThan(0)
    expect(v.ahorroPctReal!).toBeLessThan(product.umbralDescuentoPct)
  })

  it('ahorro ≥ umbral frente al precio real y sobre el piso es real', async () => {
    const { history, offers } = await loadScenario('descuento_real')
    const v = validateDiscount(offers[0]!, history, product, NOW)
    expect(v.veredicto).toBe('real')
    expect(v.ahorroPctReal).toBeGreaterThanOrEqual(product.umbralDescuentoPct)
    expect(v.confianza).toBe('alta')
    expect(v.tiendas).toBe(4)
  })

  it('igualar o mejorar el mejor precio competitivo es mínimo histórico', async () => {
    const { history, offers } = await loadScenario('minimo_historico')
    const v = validateDiscount(offers[0]!, history, product, NOW)
    expect(v.veredicto).toBe('minimo_historico')
    expect(v.piso).toBe(7499)
  })

  it('marca ancla inflada cuando el "antes" supera lo peor visto en el mercado', async () => {
    const { history, offers } = await loadScenario('descuento_real')
    const v = validateDiscount({ ...offers[0]!, advertisedPreviousPrice: 14999 }, history, product, NOW)
    expect(v.anclaInflada).toBe(true)
    expect(v.razon).toMatch(/ancla inflada/)
  })

  it('sin historial no se puede verificar nada', async () => {
    const { history, offers } = await loadScenario('descuento_real')
    const v = validateDiscount(offers[0]!, history.slice(0, 2), product, NOW)
    expect(v.veredicto).toBe('sin_historial')
  })

  it('ignora el historial de otra moneda o mercado', async () => {
    const { history, offers } = await loadScenario('comparacion_internacional')
    const us = offers.find((o) => o.market === 'US')!
    const soloMX = history.filter((h) => h.market === 'MX')
    const v = validateDiscount(us, soloMX, product, NOW)
    expect(v.veredicto).toBe('sin_historial')
    expect(v.diasCubiertos).toBe(0)
  })

  it('una oferta en EE. UU. se juzga contra el mercado de EE. UU., en dólares', async () => {
    const { history, offers } = await loadScenario('oferta_usa_gana')
    const v = validateDiscount(offers[0]!, history, product, NOW)
    expect(v.veredicto).toBe('minimo_historico')
    expect(v.precioReal).toBe(369.99)
    expect(v.piso).toBe(329.99)
    expect(v.tiendas).toBe(3)
  })
})
