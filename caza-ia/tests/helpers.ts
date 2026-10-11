import { sonyWh1000xm6 as product } from '../src/config/products/sony-wh1000xm6.js'
import { MockConnector, type MockScenario } from '../src/connectors/mock.connector.js'
import { toObservation } from '../src/engines/ingest.js'
import type { PriceObservation } from '../src/types.js'

export const NOW = new Date('2026-10-11T12:00:00Z')
export { product }

export async function loadScenario(scenario: MockScenario): Promise<{ history: PriceObservation[]; offers: PriceObservation[] }> {
  const c = new MockConnector(scenario)
  const history = (await c.fetchHistory(product.slug, 90, NOW)).map((o) => toObservation(product.slug, o))
  const offers = (await c.fetchOffers(product.slug, NOW)).map((o) => toObservation(product.slug, o))
  return { history, offers }
}
