/**
 * Inspecciona el perfil de precio real de mercado de un producto a partir del historial del conector mock.
 * Uso: npm run profile -- [slug] [mercado] [moneda]      (por defecto sony-wh1000xm6 MX MXN)
 * Imprime el perfil completo y la serie competitiva diaria. Úsalo al ajustar fixtures o parámetros del motor.
 */
import { MockConnector } from '../connectors/mock.connector.js'
import { toObservation } from '../engines/ingest.js'
import { buildMarketPriceProfile, derivedTargetPrice } from '../engines/market-price.js'
import { getProduct } from '../config/products/index.js'
import type { Market, Currency } from '../types.js'

const slug = process.argv[2] ?? 'sony-wh1000xm6'
const market = (process.argv[3] ?? 'MX') as Market
const currency = (process.argv[4] ?? 'MXN') as Currency
const product = getProduct(slug)
const now = new Date()

const history = (await new MockConnector().fetchHistory(slug, 90, now)).map((o) => toObservation(slug, o))
const profile = buildMarketPriceProfile(history, { now, market, currency })
const { serie, ...resumen } = profile

console.log(JSON.stringify(resumen, null, 2))
console.log(`objetivo derivado (${product.umbralDescuentoPct}%, tope ${product.precioMaximo}):`, derivedTargetPrice(profile, product.umbralDescuentoPct, product.precioMaximo))
console.log('\nserie competitiva (edad:precio@tienda/tiendas vigentes):')
console.log(serie.map((s) => `${s.ageDays}:${s.precioMinimo}@${s.tienda}/${s.tiendasObservadas}`).join('  '))
