import type { RawOffer } from '../types.js'
import type { PriceConnector, ConnectorMeta } from './types.js'
import { defaultFetch, fetchJson, type HttpFetch } from './http.js'

/**
 * Mercado Libre México. API oficial con OAuth: desde 2025 las llamadas sin token devuelven 403 (por confirmar).
 * GET https://api.mercadolibre.com/items/{itemId} con Bearer. El token se renueva con refresh_token si se configura.
 */
export interface MeliItem {
  id: string
  title?: string
  price?: number
  original_price?: number | null
  currency_id?: string
  available_quantity?: number
  status?: string
  permalink?: string
  seller_id?: number
  condition?: string
}

export interface MeliConfig {
  accessToken?: string
  clientId?: string
  clientSecret?: string
  refreshToken?: string
  /** itemId (MLM...) por slug de producto. */
  identifiers: Record<string, string>
  fetchImpl?: HttpFetch
  baseUrl?: string
}

export const MELI_META: ConnectorMeta = {
  clave: 'mercadolibre_mx',
  nombre: 'Mercado Libre',
  mercado: 'MX',
  moneda: 'MXN',
  tipo: 'api',
  soportaCompra: false,
  estadoValidacion: 'por_validar',
  habilitado: false,
}

export function mapMeliItem(item: MeliItem, now: Date): RawOffer | null {
  if (typeof item.price !== 'number' || !(item.price > 0) || item.currency_id !== 'MXN') return null
  if (item.condition && item.condition !== 'new') return null
  return {
    connector: 'mercadolibre_mx',
    store: 'mercadolibre_mx',
    market: 'MX',
    currency: 'MXN',
    price: item.price,
    advertisedPreviousPrice: typeof item.original_price === 'number' && item.original_price > item.price ? item.original_price : null,
    inStock: item.status === 'active' && (item.available_quantity ?? 0) > 0,
    url: item.permalink ?? `https://articulo.mercadolibre.com.mx/${item.id}`,
    seller: item.seller_id ? `seller:${item.seller_id}` : undefined,
    observedAt: now,
  }
}

export class MercadoLibreConnector implements PriceConnector {
  readonly meta = MELI_META
  private readonly fetchImpl: HttpFetch
  private readonly base: string
  private token: string | null

  constructor(private readonly cfg: MeliConfig) {
    if (!cfg.accessToken && !(cfg.clientId && cfg.clientSecret && cfg.refreshToken)) {
      throw new Error('CAZA: Mercado Libre requiere MELI_ACCESS_TOKEN o MELI_CLIENT_ID + MELI_CLIENT_SECRET + MELI_REFRESH_TOKEN')
    }
    this.fetchImpl = cfg.fetchImpl ?? defaultFetch
    this.base = cfg.baseUrl ?? 'https://api.mercadolibre.com'
    this.token = cfg.accessToken ?? null
  }

  private async refresh(): Promise<string> {
    const data = await fetchJson<{ access_token: string }>(this.fetchImpl, `${this.base}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: this.cfg.clientId!, client_secret: this.cfg.clientSecret!, refresh_token: this.cfg.refreshToken! }).toString(),
    })
    this.token = data.access_token
    return data.access_token
  }

  async fetchOffers(productSlug: string, now: Date = new Date()): Promise<RawOffer[]> {
    const itemId = this.cfg.identifiers[productSlug]
    if (!itemId) return []
    const token = this.token ?? (await this.refresh())
    const get = (t: string) => fetchJson<MeliItem>(this.fetchImpl, `${this.base}/items/${encodeURIComponent(itemId)}`, { headers: { authorization: `Bearer ${t}` } })
    let item: MeliItem
    try {
      item = await get(token)
    } catch (err) {
      if ((err as { status?: number }).status === 401 && this.cfg.refreshToken) item = await get(await this.refresh())
      else throw err
    }
    const offer = mapMeliItem(item, now)
    return offer ? [offer] : []
  }
}
