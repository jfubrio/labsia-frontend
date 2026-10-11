import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { buildMarketPriceProfile, dailyCompetitiveSeries, derivedTargetPrice, weightedMedian } from '../src/engines/market-price.js'
import type { PriceObservation } from '../src/types.js'
import { loadScenario, NOW } from './helpers.js'

const DAY = 86_400_000
function obs(store: string, daysAgo: number, price: number, inStock = true): PriceObservation {
  return {
    id: randomUUID(),
    productSlug: 'x',
    offerHash: 'h',
    connector: 'mock',
    store,
    market: 'MX',
    currency: 'MXN',
    price,
    advertisedPreviousPrice: null,
    inStock,
    url: 'https://mock.local',
    observedAt: new Date(NOW.getTime() - daysAgo * DAY),
  }
}
const opts = { now: NOW, market: 'MX' as const, currency: 'MXN' as const }

describe('precio real de mercado (Sony WH-1000XM6, historial multitienda)', () => {
  it('descarta el precio de lanzamiento y la tienda oficial que nunca baja', async () => {
    const { history } = await loadScenario('descuento_real')
    const p = buildMarketPriceProfile(history, opts)
    expect(p.confianza).toBe('alta')
    expect(p.tiendas).toEqual(['amazon_mx', 'liverpool_mx', 'mercadolibre_mx', 'sony_store_mx'])
    expect(p.diasCubiertos).toBe(90)
    expect(p.lanzamientoInflado).toBe(true)
    expect(p.regimen).toBe('bajando')
    expect(p.precioReal).toBe(8999) // no 11,999 (lanzamiento) ni 9,799 (mediana histórica)
    expect(p.piso).toBe(7499)
    expect(p.techo).toBe(11999)
  })

  it('deriva el objetivo del precio real menos el umbral, sin superar el tope', async () => {
    const { history } = await loadScenario('descuento_real')
    const p = buildMarketPriceProfile(history, opts)
    expect(derivedTargetPrice(p, 12, 8499)).toBe(7919.12)
    expect(derivedTargetPrice(p, 2, 8499)).toBe(8499) // tope duro
  })

  it('con solo el periodo de lanzamiento el precio real es alto, pero la confianza cae por falta de datos recientes', async () => {
    const { history } = await loadScenario('descuento_real')
    const soloLanzamiento = history.filter((h) => NOW.getTime() - h.observedAt.getTime() >= 60 * DAY)
    const p = buildMarketPriceProfile(soloLanzamiento, opts)
    expect(p.precioReal).toBeGreaterThan(10500)
    expect(p.confianza).toBe('baja')
    expect(p.notas.join(' ')).toMatch(/últimos 30 días/)
  })
})

describe('serie competitiva diaria', () => {
  it('usa el último precio vigente de cada tienda, no solo las observadas ese día', () => {
    const serie = dailyCompetitiveSeries([obs('A', 10, 10000), obs('B', 9, 12000), obs('B', 8, 12000)], opts)
    const d9 = serie.find((s) => s.ageDays === 9)!
    expect(d9.precioMinimo).toBe(10000)
    expect(d9.tienda).toBe('A')
    expect(d9.tiendasObservadas).toBe(2)
  })

  it('una tienda sin stock deja de contar', () => {
    const serie = dailyCompetitiveSeries([obs('A', 10, 10000), obs('A', 9, 10000, false), obs('B', 10, 12000), obs('B', 9, 12000)], opts)
    expect(serie.find((s) => s.ageDays === 10)!.precioMinimo).toBe(10000)
    expect(serie.find((s) => s.ageDays === 9)!.precioMinimo).toBe(12000)
  })

  it('el precio vigente caduca tras maxStaleDays', () => {
    const serie = dailyCompetitiveSeries([obs('A', 20, 10000), obs('B', 20, 12000), obs('B', 5, 12000)], { ...opts, maxStaleDays: 7 })
    expect(serie.find((s) => s.ageDays === 14)!.precioMinimo).toBe(10000)
    expect(serie.find((s) => s.ageDays === 12)).toBeUndefined() // ninguna tienda vigente
    expect(serie.find((s) => s.ageDays === 5)!.precioMinimo).toBe(12000)
  })

  it('ignora otra moneda u otro mercado', () => {
    const us = { ...obs('A', 3, 100), market: 'US' as const, currency: 'USD' as const }
    expect(dailyCompetitiveSeries([us], opts)).toHaveLength(0)
  })

  it('sin historial suficiente no hay precio real', () => {
    const p = buildMarketPriceProfile([obs('A', 1, 100)], opts)
    expect(p.precioReal).toBeNull()
    expect(p.confianza).toBe('sin_historial')
  })
})

describe('weightedMedian', () => {
  it('pesa más los valores con mayor peso', () => {
    expect(weightedMedian([100, 200, 300], [1, 1, 1])).toBe(200)
    expect(weightedMedian([100, 200, 300], [10, 1, 1])).toBe(100)
    expect(weightedMedian([], [])).toBeNull()
  })
})
