import type { RawOffer } from '../types.js'
import type { PriceConnector, ConnectorMeta } from './types.js'
import { defaultFetch, fetchJson, type HttpFetch } from './http.js'

/**
 * eBay Browse API (EE. UU.). OAuth client-credentials con el scope público de Buy; producción requiere aprobación
 * de eBay (el sandbox está abierto). GET /buy/browse/v1/item/{itemId}.
 */
export interface EbayItem {
  itemId: string
  title?: string
  price?: { value: string; currency: string }
  marketingPrice?: { originalPrice?: { value: string; currency: string } }
  estimatedAvailabilities?: { estimatedAvailabilityStatus?: string }[]
  itemWebUrl?: string
  seller?: { username?: string }
  condition?: string
}

export interface EbayConfig {
  clientId: string
  clientSecret: string
  /** 'production' | 'sandbox' */
  environment?: 'production' | 'sandbox'
  /** itemId por slug de producto. */
  identifiers: Record<string, string>
  fetchImpl?: HttpFetch
  /** Solo artículos nuevos; los usados no son comparables con el precio real de mercado. */
  soloNuevos?: boolean
}

export const EBAY_META: ConnectorMeta = {
  clave: 'ebay_us',
  nombre: 'eBay (Browse API)',
  mercado: 'US',
  moneda: 'USD',
  tipo: 'api',
  soportaCompra: false,
  estadoValidacion: 'por_validar',
  habilitado: false,
}

export function mapEbayItem(item: EbayItem, now: Date, soloNuevos = true): RawOffer | null {
  const price = Number(item.price?.value)
  if (!(price > 0) || item.price?.currency !== 'USD') return null
  if (soloNuevos && item.condition && !/^new/i.test(item.condition)) return null
  const original = Number(item.marketingPrice?.originalPrice?.value)
  const status = item.estimatedAvailabilities?.[0]?.estimatedAvailabilityStatus
  return {
    connector: 'ebay_us',
    store: 'ebay_us',
    market: 'US',
    currency: 'USD',
    price,
    advertisedPreviousPrice: original > price ? original : null,
    inStock: status ? status === 'IN_STOCK' : true,
    url: item.itemWebUrl ?? `https://www.ebay.com/itm/${item.itemId}`,
    seller: item.seller?.username,
    observedAt: now,
  }
}

export class EbayConnector implements PriceConnector {
  readonly meta = EBAY_META
  private readonly fetchImpl: HttpFetch
  private token: { value: string; expiresAt: number } | null = null
  private readonly base: string

  constructor(private readonly cfg: EbayConfig) {
    if (!cfg.clientId || !cfg.clientSecret) throw new Error('CAZA: eBay requiere EBAY_CLIENT_ID y EBAY_CLIENT_SECRET')
    this.fetchImpl = cfg.fetchImpl ?? defaultFetch
    this.base = cfg.environment === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'
  }

  private async accessToken(now: Date): Promise<string> {
    if (this.token && this.token.expiresAt > now.getTime() + 60_000) return this.token.value
    const basic = Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`).toString('base64')
    const data = await fetchJson<{ access_token: string; expires_in: number }>(this.fetchImpl, `${this.base}/identity/v1/oauth2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Basic ${basic}` },
      body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
    })
    this.token = { value: data.access_token, expiresAt: now.getTime() + data.expires_in * 1000 }
    return data.access_token
  }

  async fetchOffers(productSlug: string, now: Date = new Date()): Promise<RawOffer[]> {
    const itemId = this.cfg.identifiers[productSlug]
    if (!itemId) return []
    const token = await this.accessToken(now)
    const item = await fetchJson<EbayItem>(this.fetchImpl, `${this.base}/buy/browse/v1/item/${encodeURIComponent(itemId)}`, {
      headers: { authorization: `Bearer ${token}`, 'x-ebay-c-marketplace-id': 'EBAY_US' },
    })
    const offer = mapEbayItem(item, now, this.cfg.soloNuevos ?? true)
    return offer ? [offer] : []
  }
}
