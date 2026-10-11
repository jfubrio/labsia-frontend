import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import type { Market, Currency, RawOffer } from '../types.js'
import type { PriceConnector, ConnectorMeta } from './types.js'

interface FixtureOffer {
  connector: string
  market: Market
  currency: Currency
  price: number
  advertisedPreviousPrice: number | null
  inStock: boolean
  url?: string
  seller?: string
  daysAgo?: number
}

interface Fixture {
  productSlug: string
  history: FixtureOffer[]
  scenarios: Record<string, { description: string; offers: FixtureOffer[] }>
}

const here = path.dirname(fileURLToPath(import.meta.url))

function loadFixture(productSlug: string): Fixture {
  const file = path.join(here, 'fixtures', `${productSlug}.json`)
  return JSON.parse(readFileSync(file, 'utf8')) as Fixture
}

export type MockScenario = 'descuento_real' | 'descuento_falso' | 'descuento_dudoso' | 'comparacion_internacional'

/**
 * Conector con datos de prueba. No hace red. Sirve para la fase 1 y para las pruebas de motores.
 */
export class MockConnector implements PriceConnector {
  readonly meta: ConnectorMeta = {
    clave: 'mock',
    nombre: 'Conector de prueba',
    mercado: 'MX',
    moneda: 'MXN',
    tipo: 'mock',
    soportaCompra: false,
    estadoValidacion: 'validado',
    habilitado: true,
  }

  constructor(private readonly scenario: MockScenario = 'descuento_real') {}

  async fetchOffers(productSlug: string, now: Date = new Date()): Promise<RawOffer[]> {
    const fx = loadFixture(productSlug)
    const sc = fx.scenarios[this.scenario]
    if (!sc) throw new Error(`CAZA mock: escenario '${this.scenario}' no existe para ${productSlug}`)
    return sc.offers.map((o) => ({
      connector: o.connector,
      market: o.market,
      currency: o.currency,
      price: o.price,
      advertisedPreviousPrice: o.advertisedPreviousPrice ?? null,
      inStock: o.inStock,
      url: o.url ?? `https://mock.local/${o.market.toLowerCase()}/${productSlug}`,
      seller: o.seller,
      observedAt: now,
    }))
  }

  async fetchHistory(productSlug: string, days: number, now: Date = new Date()): Promise<RawOffer[]> {
    const fx = loadFixture(productSlug)
    return fx.history
      .filter((h) => (h.daysAgo ?? 0) <= days)
      .map((h) => ({
        connector: h.connector,
        market: h.market,
        currency: h.currency,
        price: h.price,
        advertisedPreviousPrice: h.advertisedPreviousPrice ?? null,
        inStock: h.inStock,
        url: h.url ?? `https://mock.local/${h.market.toLowerCase()}/${productSlug}`,
        seller: h.seller,
        observedAt: new Date(now.getTime() - (h.daysAgo ?? 0) * 86_400_000),
      }))
  }
}
