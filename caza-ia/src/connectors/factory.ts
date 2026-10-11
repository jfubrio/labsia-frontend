import type { PriceConnector } from './types.js'
import type { Env } from '../config/env.js'
import type { Db } from '../db/client.js'
import type { ProductRow } from '../db/repositories/products.repo.js'
import { listConnectors, identifiersFor, type ConnectorRow } from '../db/repositories/connectors.repo.js'
import type { HttpFetch } from './http.js'
import { MockConnector } from './mock.connector.js'
import { BestBuyConnector } from './bestbuy.connector.js'
import { EbayConnector } from './ebay.connector.js'
import { MercadoLibreConnector } from './mercadolibre.connector.js'
import { AmazonPaapiConnector } from './amazon-paapi.connector.js'

export type ConnectorStatus = 'activo' | 'no_validado' | 'deshabilitado' | 'sin_credenciales' | 'sin_identificador' | 'sin_implementacion' | 'solo_ingesta'

export interface ConnectorReport {
  clave: string
  nombre: string
  mercado: string
  estadoValidacion: string
  habilitado: boolean
  credenciales: boolean
  identificador: string | null
  estado: ConnectorStatus
}

/** Qué credenciales tiene cada conector en el entorno. Lo usa la fábrica y el comando de estado. */
export function credentialsPresent(clave: string, env: Env): boolean {
  switch (clave) {
    case 'mock':
    case 'webhook':
      return true
    case 'bestbuy_us':
      return !!env.BESTBUY_API_KEY
    case 'ebay_us':
      return !!(env.EBAY_CLIENT_ID && env.EBAY_CLIENT_SECRET)
    case 'mercadolibre_mx':
      return !!(env.MELI_ACCESS_TOKEN || (env.MELI_CLIENT_ID && env.MELI_CLIENT_SECRET && env.MELI_REFRESH_TOKEN))
    case 'amazon_mx':
    case 'amazon_us':
      return !!(env.PAAPI_ACCESS_KEY && env.PAAPI_SECRET_KEY && env.PAAPI_PARTNER_TAG)
    default:
      return false
  }
}

const NEEDS_IDENTIFIER = new Set(['bestbuy_us', 'ebay_us', 'mercadolibre_mx', 'amazon_mx', 'amazon_us'])
const IMPLEMENTED = new Set(['mock', 'bestbuy_us', 'ebay_us', 'mercadolibre_mx', 'amazon_mx', 'amazon_us'])

/** `identifiers` va indexado por slug de producto, como lo esperan los conectores. */
function instantiate(c: ConnectorRow, env: Env, identifiers: Record<string, string>, fetchImpl?: HttpFetch): PriceConnector {
  switch (c.clave) {
    case 'mock':
      return new MockConnector()
    case 'bestbuy_us':
      return new BestBuyConnector({ apiKey: env.BESTBUY_API_KEY, identifiers, fetchImpl })
    case 'ebay_us':
      return new EbayConnector({ clientId: env.EBAY_CLIENT_ID, clientSecret: env.EBAY_CLIENT_SECRET, environment: env.EBAY_ENV, identifiers, fetchImpl })
    case 'mercadolibre_mx':
      return new MercadoLibreConnector({
        accessToken: env.MELI_ACCESS_TOKEN || undefined,
        clientId: env.MELI_CLIENT_ID || undefined,
        clientSecret: env.MELI_CLIENT_SECRET || undefined,
        refreshToken: env.MELI_REFRESH_TOKEN || undefined,
        identifiers,
        fetchImpl,
      })
    case 'amazon_mx':
    case 'amazon_us':
      return new AmazonPaapiConnector({ accessKey: env.PAAPI_ACCESS_KEY, secretKey: env.PAAPI_SECRET_KEY, partnerTag: env.PAAPI_PARTNER_TAG, locale: c.clave === 'amazon_mx' ? 'MX' : 'US', identifiers, fetchImpl })
    default:
      throw new Error(`CAZA: el conector '${c.clave}' no tiene implementación`)
  }
}

/**
 * Construye los conectores que pueden consultar un producto. La base de datos es la fuente de verdad del estado
 * (fase 0): un conector solo se instancia si está 'validado' y habilitado, tiene credenciales en el entorno y, si las
 * necesita, un identificador del producto en esa tienda. El resto queda en el informe con el motivo.
 */
export async function buildConnectors(
  db: Db,
  product: ProductRow,
  env: Env,
  fetchImpl?: HttpFetch,
): Promise<{ connectors: PriceConnector[]; report: ConnectorReport[] }> {
  const rows = (await listConnectors(db)).filter((c) => product.mercados.includes(c.mercado))
  const identifiers = await identifiersFor(db, product.id)
  const connectors: PriceConnector[] = []
  const report: ConnectorReport[] = []
  for (const c of rows) {
    const identificador = identifiers[c.clave] ?? null
    const creds = credentialsPresent(c.clave, env)
    let estado: ConnectorStatus
    if (c.clave === 'webhook') estado = 'solo_ingesta'
    else if (!IMPLEMENTED.has(c.clave)) estado = 'sin_implementacion'
    else if (c.estadoValidacion !== 'validado') estado = 'no_validado'
    else if (!c.habilitado) estado = 'deshabilitado'
    else if (!creds) estado = 'sin_credenciales'
    else if (NEEDS_IDENTIFIER.has(c.clave) && !identificador) estado = 'sin_identificador'
    else estado = 'activo'
    report.push({ clave: c.clave, nombre: c.nombre, mercado: c.mercado, estadoValidacion: c.estadoValidacion, habilitado: c.habilitado, credenciales: creds, identificador, estado })
    if (estado === 'activo') connectors.push(instantiate(c, env, identificador ? { [product.slug]: identificador } : {}, fetchImpl))
  }
  return { connectors, report }
}
