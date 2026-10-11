import { createHash, createHmac } from 'node:crypto'
import type { RawOffer, Market, Currency } from '../types.js'
import type { PriceConnector, ConnectorMeta } from './types.js'
import { defaultFetch, fetchJson, type HttpFetch } from './http.js'

/**
 * Amazon Product Advertising API 5.0 (México y EE. UU.). Vía oficial; CAZA IA no scrapea Amazon.
 * Requiere cuenta de Associates con ventas calificadas: antes de eso toda llamada devuelve AssociateNotEligible.
 * Firma AWS SigV4 implementada aquí con node:crypto (el SDK con TypeScript fue archivado en 2026).
 * PA-API no ejecuta compras: solo precio, stock y "antes" anunciado (SavingBasis).
 */
export interface PaapiLocale {
  host: string
  region: string
  marketplace: string
  market: Market
  currency: Currency
}

/** Región de México por confirmar en la referencia de locales de PA-API. */
export const PAAPI_LOCALES: Record<'MX' | 'US', PaapiLocale> = {
  US: { host: 'webservices.amazon.com', region: 'us-east-1', marketplace: 'www.amazon.com', market: 'US', currency: 'USD' },
  MX: { host: 'webservices.amazon.com.mx', region: 'us-east-1', marketplace: 'www.amazon.com.mx', market: 'MX', currency: 'MXN' },
}

export interface PaapiConfig {
  accessKey: string
  secretKey: string
  partnerTag: string
  locale: 'MX' | 'US'
  /** ASIN por slug de producto. */
  identifiers: Record<string, string>
  fetchImpl?: HttpFetch
}

export interface PaapiItem {
  ASIN: string
  DetailPageURL?: string
  ItemInfo?: { Title?: { DisplayValue?: string } }
  Offers?: {
    Listings?: {
      Price?: { Amount?: number; Currency?: string }
      SavingBasis?: { Amount?: number; Currency?: string }
      Availability?: { Type?: string }
      MerchantInfo?: { Name?: string }
      Condition?: { Value?: string }
    }[]
  }
}

const sha256 = (s: string | Buffer) => createHash('sha256').update(s).digest('hex')
const hmac = (key: Buffer | string, s: string) => createHmac('sha256', key).update(s).digest()

/** Firma SigV4 de una petición PA-API (POST JSON). Devuelve las cabeceras a enviar. Determinista para una fecha dada. */
export function signPaapiRequest(p: { host: string; region: string; path: string; target: string; body: string; accessKey: string; secretKey: string; now: Date }): Record<string, string> {
  const amzDate = p.now.toISOString().replace(/[:-]|\.\d{3}/g, '') // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8)
  const service = 'ProductAdvertisingAPI'
  const headers: Record<string, string> = {
    'content-encoding': 'amz-1.0',
    'content-type': 'application/json; charset=utf-8',
    host: p.host,
    'x-amz-date': amzDate,
    'x-amz-target': p.target,
  }
  const signedHeaderNames = Object.keys(headers).sort()
  const canonicalHeaders = signedHeaderNames.map((h) => `${h}:${headers[h]!.trim()}\n`).join('')
  const signedHeaders = signedHeaderNames.join(';')
  const canonicalRequest = ['POST', p.path, '', canonicalHeaders, signedHeaders, sha256(p.body)].join('\n')
  const scope = `${dateStamp}/${p.region}/${service}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n')
  const kDate = hmac(`AWS4${p.secretKey}`, dateStamp)
  const kRegion = hmac(kDate, p.region)
  const kService = hmac(kRegion, service)
  const kSigning = hmac(kService, 'aws4_request')
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex')
  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${p.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  }
}

export function mapPaapiItem(item: PaapiItem, locale: PaapiLocale, now: Date): RawOffer | null {
  const listing = item.Offers?.Listings?.find((l) => !l.Condition?.Value || l.Condition.Value === 'New') ?? item.Offers?.Listings?.[0]
  const price = listing?.Price?.Amount
  if (typeof price !== 'number' || !(price > 0)) return null
  if (listing?.Price?.Currency && listing.Price.Currency !== locale.currency) return null
  const basis = listing?.SavingBasis?.Amount
  return {
    connector: locale.market === 'MX' ? 'amazon_mx' : 'amazon_us',
    store: locale.market === 'MX' ? 'amazon_mx' : 'amazon_us',
    market: locale.market,
    currency: locale.currency,
    price,
    advertisedPreviousPrice: typeof basis === 'number' && basis > price ? basis : null,
    inStock: listing?.Availability?.Type === 'Now',
    url: item.DetailPageURL ?? `https://${locale.marketplace}/dp/${item.ASIN}`,
    seller: listing?.MerchantInfo?.Name,
    observedAt: now,
  }
}

export class AmazonPaapiConnector implements PriceConnector {
  readonly meta: ConnectorMeta
  private readonly fetchImpl: HttpFetch
  private readonly locale: PaapiLocale

  constructor(private readonly cfg: PaapiConfig) {
    if (!cfg.accessKey || !cfg.secretKey || !cfg.partnerTag) throw new Error('CAZA: PA-API requiere PAAPI_ACCESS_KEY, PAAPI_SECRET_KEY y PAAPI_PARTNER_TAG')
    this.locale = PAAPI_LOCALES[cfg.locale]
    this.fetchImpl = cfg.fetchImpl ?? defaultFetch
    this.meta = {
      clave: cfg.locale === 'MX' ? 'amazon_mx' : 'amazon_us',
      nombre: cfg.locale === 'MX' ? 'Amazon México' : 'Amazon US',
      mercado: this.locale.market,
      moneda: this.locale.currency,
      tipo: 'api',
      soportaCompra: false,
      estadoValidacion: 'por_validar',
      habilitado: false,
    }
  }

  async fetchOffers(productSlug: string, now: Date = new Date()): Promise<RawOffer[]> {
    const asin = this.cfg.identifiers[productSlug]
    if (!asin) return []
    const body = JSON.stringify({
      ItemIds: [asin],
      PartnerTag: this.cfg.partnerTag,
      PartnerType: 'Associates',
      Marketplace: this.locale.marketplace,
      Resources: ['ItemInfo.Title', 'Offers.Listings.Price', 'Offers.Listings.SavingBasis', 'Offers.Listings.Availability.Type', 'Offers.Listings.MerchantInfo', 'Offers.Listings.Condition'],
    })
    const path = '/paapi5/getitems'
    const headers = signPaapiRequest({ host: this.locale.host, region: this.locale.region, path, target: 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems', body, accessKey: this.cfg.accessKey, secretKey: this.cfg.secretKey, now })
    const data = await fetchJson<{ ItemsResult?: { Items?: PaapiItem[] }; Errors?: { Code: string; Message: string }[] }>(this.fetchImpl, `https://${this.locale.host}${path}`, { method: 'POST', headers, body })
    if (data.Errors?.length) throw new Error(`CAZA PA-API: ${data.Errors.map((e) => `${e.Code}: ${e.Message}`).join('; ')}`)
    return (data.ItemsResult?.Items ?? []).map((i) => mapPaapiItem(i, this.locale, now)).filter((o): o is RawOffer => o !== null)
  }
}
