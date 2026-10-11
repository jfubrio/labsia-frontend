import type { Market, Currency, RawOffer } from '../types.js'

export type ValidationStatus = 'por_validar' | 'validado' | 'descartado'

export interface ConnectorMeta {
  clave: string
  nombre: string
  mercado: Market
  moneda: Currency
  tipo: 'mock' | 'api' | 'scraping'
  soportaCompra: boolean
  estadoValidacion: ValidationStatus
  habilitado: boolean
}

export interface PriceConnector {
  readonly meta: ConnectorMeta
  /** Devuelve las ofertas visibles ahora para el producto. */
  fetchOffers(productSlug: string, now?: Date): Promise<RawOffer[]>
  /** Historial disponible en el conector (solo el mock lo tiene; los reales lo construyen en DB). */
  fetchHistory?(productSlug: string, days: number, now?: Date): Promise<RawOffer[]>
}
