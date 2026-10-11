/**
 * Demo de fase 1: corre sin red y sin base de datos.
 * 1) Construye el PRECIO REAL DE MERCADO de los Sony WH-1000XM6 a partir del historial multitienda de 90 días.
 * 2) Juzga cada escenario contra ese precio real (nunca contra el precio de lista ni el "antes" anunciado).
 * 3) Muestra que, incluso con una autorización approve válida, el ejecutor no crea ninguna orden.
 */
import { loadEnv } from '../config/env.js'
import { sonyWh1000xm6 as product } from '../config/products/sony-wh1000xm6.js'
import { MockConnector, type MockScenario } from '../connectors/mock.connector.js'
import { toObservation } from '../engines/ingest.js'
import { buildMarketPriceProfile } from '../engines/market-price.js'
import { validateDiscountWithProfile } from '../engines/discount-validator.js'
import { compareInternational, defaultComparisonConfig, landedPrice } from '../engines/international-comparison.js'
import { proposePurchase, effectiveTargetPrice, decideAuthorization } from '../engines/authorization.js'
import { executePurchase, InMemoryOrderStore } from '../engines/purchase-executor.js'

const env = loadEnv()
const now = new Date()
const store = new InMemoryOrderStore()

console.log(`CAZA IA — demo fase ${env.CAZA_PHASE} — producto ${product.nombre}`)
console.log(`PURCHASES_ENABLED=${env.PURCHASES_ENABLED}  vigilancia_activa=${product.vigilanciaActiva}\n`)

const history = (await new MockConnector().fetchHistory(product.slug, 90, now)).map((o) => toObservation(product.slug, o))
const profile = buildMarketPriceProfile(history, { now, market: 'MX', currency: product.monedaBase })
const profileUS = buildMarketPriceProfile(history, { now, market: 'US', currency: 'USD' })
const comparison = defaultComparisonConfig(env.USD_MXN_RATE)
const { objetivo, derivado } = effectiveTargetPrice(product, profile)

console.log('── Precio real de mercado (MX, 90 días, 4 tiendas)')
console.log(`   precio de lista informativo: ${product.precioListaInformativo} (NO se usa como referencia)`)
console.log(`   precio real: ${profile.precioReal}  mediana reciente: ${profile.medianaReciente}  mediana anterior: ${profile.medianaAnterior}`)
console.log(`   piso: ${profile.piso}  techo: ${profile.techo}  tendencia: ${profile.tendenciaPct}%  régimen: ${profile.regimen}`)
console.log(`   lanzamiento inflado: ${profile.lanzamientoInflado}  confianza: ${profile.confianza}  días observados: ${profile.diasObservados}  tiendas: ${profile.tiendas.join(', ')}`)
for (const n of profile.notas) console.log(`   nota: ${n}`)
console.log(`   objetivo efectivo: ${objetivo} ${product.monedaBase}${derivado ? ' (derivado del precio real menos ' + product.umbralDescuentoPct + '%)' : ''}; tope duro: ${product.precioMaximo}\n`)

console.log('── Precio real de mercado (US, 90 días, 3 tiendas) — compra vía buzón en Texas')
console.log(`   precio real: ${profileUS.precioReal} USD  piso: ${profileUS.piso}  techo: ${profileUS.techo}  régimen: ${profileUS.regimen}  confianza: ${profileUS.confianza}  tiendas: ${profileUS.tiendas.join(', ')}`)
const bz = comparison.buzones.US!
console.log(`   buzón ${bz.clave}: impuesto de venta ${bz.impuestoVentaPct}%, reenvío ${bz.tarifaReenvio} ${bz.currency}, importación MX por tramos T-MEC (0/17/19 %), tc ${env.USD_MXN_RATE}. Supuestos por confirmar.\n`)

const scenarios: MockScenario[] = ['ancla_lanzamiento', 'descuento_falso', 'descuento_dudoso', 'descuento_real', 'tienda_sin_stock', 'minimo_historico', 'comparacion_internacional', 'oferta_usa_gana', 'oferta_usa_no_gana']

for (const scenario of scenarios) {
  const offers = (await new MockConnector(scenario).fetchOffers(product.slug, now)).map((o) => toObservation(product.slug, o))
  console.log(`── Escenario: ${scenario}`)
  for (const obs of offers) {
    const prof = obs.market === 'MX' ? profile : profileUS
    const verdict = validateDiscountWithProfile(obs, prof, product)
    console.log(
      `   ${obs.store} ${obs.price} ${obs.currency} (anuncia antes: ${obs.advertisedPreviousPrice ?? '—'}, ${verdict.ahorroPctAnunciado ?? 0}%) → ${verdict.veredicto.toUpperCase()} | ${verdict.razon}`,
    )
    if (obs.market !== 'MX') {
      const lp = landedPrice(obs, comparison)
      console.log(`   aterrizado vía ${lp.buzon}: ${lp.precioAterrizado} MXN = (${lp.precioLocal} + imp. venta ${lp.impuestoVenta}) × ${lp.tipoCambio} + importación ${lp.tasaImportacionPct}% ${lp.impuestosImportacion} + reenvío ${lp.reenvio}`)
    }
    const proposal = proposePurchase(obs, verdict, product, profile, comparison) // objetivo siempre del perfil MX
    if (!proposal && !obs.inStock) console.log('   Sin stock: no se genera propuesta de compra aunque el veredicto sea bueno.')
    if (!proposal && obs.inStock && obs.market !== 'MX' && (verdict.veredicto === 'real' || verdict.veredicto === 'minimo_historico')) {
      console.log(`   Buen precio en ${obs.market}, pero aterrizado supera el objetivo ${objetivo} MXN: se informa, no se propone.`)
    }
    if (proposal) {
      console.log(`   Propuesta de compra a ${proposal.precio} ${proposal.moneda}${proposal.buzon ? ` vía ${proposal.buzon} (aterrizado ${proposal.precioAterrizadoBase} MXN)` : ''} (objetivo ${proposal.precioObjetivo} MXN). Requiere approve humano.`)
      const { authorization } = decideAuthorization({ proposal, decision: 'approve', autorizadoPor: 'demo@labsia.mx', product, ttlHours: env.DEFAULT_AUTHORIZATION_TTL_HOURS, now })
      const result = executePurchase(env, store, authorization, obs, obs.price, now)
      console.log(`   Ejecutor: ${result.status}${'razon' in result ? ` — ${result.razon}` : ''}`)
    }
  }
  if (scenario === 'comparacion_internacional') {
    const cmp = compareInternational(offers, defaultComparisonConfig(env.USD_MXN_RATE))
    for (const r of cmp.ranking) {
      console.log(`   ${r.market} ${r.store}: ${r.precioLocal} ${r.monedaLocal} → aterrizado ${r.precioAterrizado} ${r.monedaBase}${r.buzon ? ` vía ${r.buzon} (imp. venta ${r.impuestoVenta}, importación ${r.tasaImportacionPct}% = ${r.impuestosImportacion}, reenvío ${r.reenvio})` : ''}`)
    }
    console.log(`   Alternativas internacionales que ganan al mejor precio local: ${cmp.alternativasInternacionales.length}`)
  }
  console.log()
}

console.log(`Órdenes creadas: ${store.all().length} (esperado: 0)`)
if (store.all().length !== 0) {
  console.error('ERROR: se creó una orden con las compras deshabilitadas')
  process.exit(1)
}
