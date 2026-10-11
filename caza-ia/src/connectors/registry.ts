import type { ConnectorMeta } from './types.js'

/**
 * Catálogo de conectores. Refleja la tabla caza_connectors.
 * Solo 'mock' está validado y habilitado en fase 1. Los demás esperan la validación de accesos de la fase 0.
 */
export const connectorCatalog: ConnectorMeta[] = [
  { clave: 'mock', nombre: 'Conector de prueba', mercado: 'MX', moneda: 'MXN', tipo: 'mock', soportaCompra: false, estadoValidacion: 'validado', habilitado: true },
  { clave: 'amazon_mx', nombre: 'Amazon México', mercado: 'MX', moneda: 'MXN', tipo: 'api', soportaCompra: true, estadoValidacion: 'por_validar', habilitado: false },
  { clave: 'sony_store_mx', nombre: 'Sony Store México', mercado: 'MX', moneda: 'MXN', tipo: 'scraping', soportaCompra: false, estadoValidacion: 'por_validar', habilitado: false },
  { clave: 'mercadolibre_mx', nombre: 'Mercado Libre', mercado: 'MX', moneda: 'MXN', tipo: 'api', soportaCompra: false, estadoValidacion: 'por_validar', habilitado: false },
  { clave: 'amazon_us', nombre: 'Amazon US', mercado: 'US', moneda: 'USD', tipo: 'api', soportaCompra: false, estadoValidacion: 'por_validar', habilitado: false },
  { clave: 'bestbuy_us', nombre: 'Best Buy', mercado: 'US', moneda: 'USD', tipo: 'api', soportaCompra: false, estadoValidacion: 'por_validar', habilitado: false },
]

export function isConnectorUsable(clave: string): boolean {
  const c = connectorCatalog.find((x) => x.clave === clave)
  return !!c && c.habilitado && c.estadoValidacion === 'validado'
}
