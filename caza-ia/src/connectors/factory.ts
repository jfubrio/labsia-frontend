import type { PriceConnector } from './types.js'
import { connectorCatalog, isConnectorUsable } from './registry.js'
import { MockConnector } from './mock.connector.js'

/**
 * Instancia los conectores usables (validados y habilitados) para los mercados de un producto.
 * En fase 2 solo existe el mock; los reales se agregan aquí al cerrar su fase 0 (ver skill caza-connector).
 */
export function connectorsFor(markets: string[]): PriceConnector[] {
  return connectorCatalog
    .filter((c) => isConnectorUsable(c.clave) && markets.includes(c.mercado))
    .map((c) => {
      switch (c.clave) {
        case 'mock':
          return new MockConnector()
        default:
          throw new Error(`CAZA: el conector '${c.clave}' está habilitado pero no tiene implementación`)
      }
    })
}
