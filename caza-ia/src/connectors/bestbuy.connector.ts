import type { RawOffer } from '../types.js'
import type { PriceConnector, ConnectorMeta } from './types.js'
import { defaultFetch, fetchJson, type HttpFetch } from './http.js'

/**
 * Best Buy Products API (EE. UU.). Clave gratuita en developer.bestbuy.com; uso comercial sujeto a aprobación.
 * Consulta por SKU: GET https://api.bestbuy.com/v1/products(sku=<sku>)?apiKey=...&format=json&show=...
 * Sin SDK: el oficial lleva años sin publicar.
 */
export interface BestBuyProduct {
  sku: number | string
  name?: string
  salePrice?: number
  regularPrice?: number
  onSale?: boolean
  onlineAvailability?: boolean
  url?: string
}

export interface BestBuyConfig {
  apiKey: string
  /** sku por slug de producto. */
  identifiers: Record<string, string>
  fetchImpl?: HttpFetch
  baseUrl?: string
}

export const BESTBUY_META: ConnectorMeta = {
  clave: 'bestbuy_us',
  nombre: 'Best Buy',
  mercado: 'US',
  moneda: 'USD',
  tipo: 'api',
  soportaCompra: false,
  estadoValidacion: 'por_validar',
  habilitado: false,
}

export function mapBestBuyProduct(p: BestBuyProduct, now: Date): RawOffer | null {
  if (typeof p.salePrice !== 'number' || !(p.salePrice > 0)) return null
  const regular = typeof p.regularPrice === 'number' && p.regularPrice > p.salePrice ? p.regularPrice : null
  return {
    connector: 'bestbuy_us',
    store: 'bestbuy_us',
    market: 'US',
    currency: 'USD',
    price: p.salePrice,
    advertisedPreviousPrice: regular,
    inStock: p.onlineAvailability === true,
    url: p.url ?? `https://www.bestbuy.com/site/${p.sku}.p`,
    seller: 'Best Buy',
    observedAt: now,
  }
}

export class BestBuyConnector implements PriceConnector {
  readonly meta = BESTBUY_META
  private readonly fetchImpl: HttpFetch
  private readonly baseUrl: string

  constructor(private readonly cfg: BestBuyConfig) {
    if (!cfg.apiKey) throw new Error('CAZA: Best Buy requiere BESTBUY_API_KEY')
    this.fetchImpl = cfg.fetchImpl ?? defaultFetch
    this.baseUrl = cfg.baseUrl ?? 'https://api.bestbuy.com/v1'
  }

  async fetchOffers(productSlug: string, now: Date = new Date()): Promise<RawOffer[]> {
    const sku = this.cfg.identifiers[productSlug]
    if (!sku) return []
    const url = `${this.baseUrl}/products(sku=${encodeURIComponent(sku)})?apiKey=${encodeURIComponent(this.cfg.apiKey)}&format=json&show=sku,name,salePrice,regularPrice,onSale,onlineAvailability,url`
    const data = await fetchJson<{ products?: BestBuyProduct[] }>(this.fetchImpl, url)
    return (data.products ?? []).map((p) => mapBestBuyProduct(p, now)).filter((o): o is RawOffer => o !== null)
  }
}
