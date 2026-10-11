import { describe, it, expect } from 'vitest'
import { fakeFetch, fetchJson, HttpError } from '../src/connectors/http.js'
import { BestBuyConnector, mapBestBuyProduct } from '../src/connectors/bestbuy.connector.js'
import { EbayConnector, mapEbayItem } from '../src/connectors/ebay.connector.js'
import { MercadoLibreConnector, mapMeliItem } from '../src/connectors/mercadolibre.connector.js'
import { AmazonPaapiConnector, mapPaapiItem, signPaapiRequest, PAAPI_LOCALES } from '../src/connectors/amazon-paapi.connector.js'

const NOW = new Date('2026-10-11T12:00:00Z')

describe('http', () => {
  it('fetchJson devuelve JSON y lanza HttpError con el cuerpo en errores', async () => {
    const f = fakeFetch({ 'https://ok': { body: { a: 1 } }, 'https://bad': { status: 403, body: 'AssociateNotEligible' } })
    expect(await fetchJson(f, 'https://ok')).toEqual({ a: 1 })
    await expect(fetchJson(f, 'https://bad')).rejects.toThrow(HttpError)
    await expect(fetchJson(f, 'https://bad')).rejects.toThrow(/403.*AssociateNotEligible/)
  })
})

describe('Best Buy', () => {
  it('mapea salePrice, regularPrice como "antes" y disponibilidad en línea', () => {
    const o = mapBestBuyProduct({ sku: 6505727, name: 'Sony WH-1000XM6', salePrice: 299.99, regularPrice: 449.99, onSale: true, onlineAvailability: true, url: 'https://www.bestbuy.com/x' }, NOW)!
    expect(o.store).toBe('bestbuy_us')
    expect(o.price).toBe(299.99)
    expect(o.advertisedPreviousPrice).toBe(449.99)
    expect(o.inStock).toBe(true)
    expect(o.currency).toBe('USD')
  })
  it('sin stock en línea queda inStock=false; sin precio se descarta', () => {
    expect(mapBestBuyProduct({ sku: 1, salePrice: 10, onlineAvailability: false }, NOW)!.inStock).toBe(false)
    expect(mapBestBuyProduct({ sku: 1 }, NOW)).toBeNull()
  })
  it('consulta por SKU con la clave y sin identificador no llama', async () => {
    const f = fakeFetch({ 'https://api.bestbuy.com/v1/products(sku=6505727)': { body: { products: [{ sku: 6505727, salePrice: 379.99, regularPrice: 449.99, onlineAvailability: true }] } } })
    const c = new BestBuyConnector({ apiKey: 'K', identifiers: { 'sony-wh1000xm6': '6505727' }, fetchImpl: f })
    const offers = await c.fetchOffers('sony-wh1000xm6', NOW)
    expect(offers).toHaveLength(1)
    expect(f.calls[0]!.url).toContain('apiKey=K')
    expect(await c.fetchOffers('otro', NOW)).toEqual([])
    expect(() => new BestBuyConnector({ apiKey: '', identifiers: {} })).toThrow(/BESTBUY_API_KEY/)
  })
})

describe('eBay', () => {
  it('mapea precio, precio original y disponibilidad; descarta usados y otras monedas', () => {
    const o = mapEbayItem({ itemId: 'v1|1|0', price: { value: '329.99', currency: 'USD' }, marketingPrice: { originalPrice: { value: '449.99', currency: 'USD' } }, estimatedAvailabilities: [{ estimatedAvailabilityStatus: 'IN_STOCK' }], itemWebUrl: 'https://www.ebay.com/itm/1', seller: { username: 'tienda' }, condition: 'New' }, NOW)!
    expect(o.price).toBe(329.99)
    expect(o.advertisedPreviousPrice).toBe(449.99)
    expect(o.inStock).toBe(true)
    expect(o.seller).toBe('tienda')
    expect(mapEbayItem({ itemId: 'x', price: { value: '100', currency: 'USD' }, condition: 'Used' }, NOW)).toBeNull()
    expect(mapEbayItem({ itemId: 'x', price: { value: '100', currency: 'EUR' } }, NOW)).toBeNull()
  })
  it('obtiene token client-credentials una vez y lo reutiliza', async () => {
    const f = fakeFetch({
      'https://api.sandbox.ebay.com/identity/v1/oauth2/token': { body: { access_token: 'T', expires_in: 7200 } },
      'https://api.sandbox.ebay.com/buy/browse/v1/item/v1%7C1%7C0': { body: { itemId: 'v1|1|0', price: { value: '300', currency: 'USD' }, condition: 'New' } },
    })
    const c = new EbayConnector({ clientId: 'id', clientSecret: 'sec', environment: 'sandbox', identifiers: { s: 'v1|1|0' }, fetchImpl: f })
    await c.fetchOffers('s', NOW)
    await c.fetchOffers('s', NOW)
    const tokenCalls = f.calls.filter((x) => x.url.includes('oauth2/token'))
    expect(tokenCalls).toHaveLength(1)
    expect(tokenCalls[0]!.init?.headers?.authorization).toMatch(/^Basic /)
    expect(f.calls.filter((x) => x.url.includes('/item/'))[0]!.init?.headers?.authorization).toBe('Bearer T')
  })
})

describe('Mercado Libre', () => {
  it('mapea precio, original_price, stock por cantidad y estado; descarta usados y otras monedas', () => {
    const o = mapMeliItem({ id: 'MLM1', price: 8999, original_price: 9999, currency_id: 'MXN', available_quantity: 3, status: 'active', permalink: 'https://x', seller_id: 7, condition: 'new' }, NOW)!
    expect(o.price).toBe(8999)
    expect(o.advertisedPreviousPrice).toBe(9999)
    expect(o.inStock).toBe(true)
    expect(o.seller).toBe('seller:7')
    expect(mapMeliItem({ id: 'x', price: 1, currency_id: 'MXN', available_quantity: 0, status: 'active' }, NOW)!.inStock).toBe(false)
    expect(mapMeliItem({ id: 'x', price: 1, currency_id: 'USD' }, NOW)).toBeNull()
    expect(mapMeliItem({ id: 'x', price: 1, currency_id: 'MXN', condition: 'used' }, NOW)).toBeNull()
  })
  it('renueva el token con refresh_token tras un 401', async () => {
    let calls = 0
    const f = fakeFetch({
      'https://api.mercadolibre.com/items/MLM1': () => (++calls === 1 ? { status: 401, body: 'expired' } : { body: { id: 'MLM1', price: 8999, currency_id: 'MXN', available_quantity: 1, status: 'active' } }),
      'https://api.mercadolibre.com/oauth/token': { body: { access_token: 'NUEVO' } },
    })
    const c = new MercadoLibreConnector({ accessToken: 'VIEJO', clientId: 'c', clientSecret: 's', refreshToken: 'r', identifiers: { s: 'MLM1' }, fetchImpl: f })
    const offers = await c.fetchOffers('s', NOW)
    expect(offers).toHaveLength(1)
    expect(f.calls.some((x) => x.url.includes('/oauth/token'))).toBe(true)
    expect(() => new MercadoLibreConnector({ identifiers: {} })).toThrow(/MELI_ACCESS_TOKEN/)
  })
})

describe('Amazon PA-API 5.0', () => {
  it('la firma SigV4 es determinista y lleva las cabeceras exigidas', () => {
    const h1 = signPaapiRequest({ host: 'webservices.amazon.com', region: 'us-east-1', path: '/paapi5/getitems', target: 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems', body: '{"ItemIds":["B0"]}', accessKey: 'AKIA', secretKey: 'S', now: NOW })
    const h2 = signPaapiRequest({ host: 'webservices.amazon.com', region: 'us-east-1', path: '/paapi5/getitems', target: 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems', body: '{"ItemIds":["B0"]}', accessKey: 'AKIA', secretKey: 'S', now: NOW })
    expect(h1).toEqual(h2)
    expect(h1['x-amz-date']).toBe('20261011T120000Z')
    expect(h1['content-encoding']).toBe('amz-1.0')
    expect(h1.authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIA\/20261011\/us-east-1\/ProductAdvertisingAPI\/aws4_request, SignedHeaders=content-encoding;content-type;host;x-amz-date;x-amz-target, Signature=[0-9a-f]{64}$/)
    const h3 = signPaapiRequest({ host: 'webservices.amazon.com', region: 'us-east-1', path: '/paapi5/getitems', target: 'x', body: '{"ItemIds":["B1"]}', accessKey: 'AKIA', secretKey: 'S', now: NOW })
    expect(h3.authorization).not.toBe(h1.authorization) // otro cuerpo, otra firma
  })
  it('mapea el listing nuevo: precio, SavingBasis como "antes", disponibilidad Now', () => {
    const item = { ASIN: 'B0F3', DetailPageURL: 'https://www.amazon.com.mx/dp/B0F3', Offers: { Listings: [{ Price: { Amount: 8999, Currency: 'MXN' }, SavingBasis: { Amount: 9999, Currency: 'MXN' }, Availability: { Type: 'Now' }, MerchantInfo: { Name: 'Amazon México' }, Condition: { Value: 'New' } }] } }
    const o = mapPaapiItem(item, PAAPI_LOCALES.MX, NOW)!
    expect(o.store).toBe('amazon_mx')
    expect(o.price).toBe(8999)
    expect(o.advertisedPreviousPrice).toBe(9999)
    expect(o.inStock).toBe(true)
    expect(o.currency).toBe('MXN')
    expect(mapPaapiItem({ ASIN: 'x', Offers: { Listings: [{ Price: { Amount: 10, Currency: 'USD' } }] } }, PAAPI_LOCALES.MX, NOW)).toBeNull()
  })
  it('envía GetItems firmado al host del locale y propaga los errores de la API', async () => {
    const f = fakeFetch({
      'https://webservices.amazon.com.mx/paapi5/getitems': (init) => {
        const body = JSON.parse(init!.body!)
        return body.ItemIds[0] === 'B0F3' ? { body: { ItemsResult: { Items: [{ ASIN: 'B0F3', Offers: { Listings: [{ Price: { Amount: 8999, Currency: 'MXN' }, Availability: { Type: 'Now' } }] } }] } } } : { body: { Errors: [{ Code: 'AssociateNotEligible', Message: 'no elegible' }] } }
      },
    })
    const c = new AmazonPaapiConnector({ accessKey: 'A', secretKey: 'S', partnerTag: 'tag-20', locale: 'MX', identifiers: { s: 'B0F3', t: 'B0X' }, fetchImpl: f })
    const offers = await c.fetchOffers('s', NOW)
    expect(offers[0]!.price).toBe(8999)
    expect(f.calls[0]!.init?.headers?.['x-amz-target']).toBe('com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems')
    expect(JSON.parse(f.calls[0]!.init!.body!).Marketplace).toBe('www.amazon.com.mx')
    await expect(c.fetchOffers('t', NOW)).rejects.toThrow(/AssociateNotEligible/)
  })
})
