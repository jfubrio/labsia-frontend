/**
 * Demo de fase 1: corre sin red y sin base de datos.
 * Recorre los cuatro escenarios del conector mock para los Sony WH-1000XM6 y muestra que,
 * incluso con una autorización approve válida, el ejecutor no crea ninguna orden.
 */
import { loadEnv } from '../config/env.js'
import { sonyWh1000xm6 as product } from '../config/products/sony-wh1000xm6.js'
import { MockConnector, type MockScenario } from '../connectors/mock.connector.js'
import { toObservation } from '../engines/ingest.js'
import { validateDiscount } from '../engines/discount-validator.js'
import { compareInternational, defaultComparisonConfig } from '../engines/international-comparison.js'
import { proposePurchase, decideAuthorization } from '../engines/authorization.js'
import { executePurchase, InMemoryOrderStore } from '../engines/purchase-executor.js'

const env = loadEnv()
const now = new Date()
const store = new InMemoryOrderStore()

console.log(`CAZA IA — demo fase ${env.CAZA_PHASE} — producto ${product.nombre}`)
console.log(`PURCHASES_ENABLED=${env.PURCHASES_ENABLED}  vigilancia_activa=${product.vigilanciaActiva}\n`)

const scenarios: MockScenario[] = ['descuento_real', 'descuento_falso', 'descuento_dudoso', 'comparacion_internacional']

for (const scenario of scenarios) {
  const connector = new MockConnector(scenario)
  const history = (await connector.fetchHistory(product.slug, 90, now)).map((o) => toObservation(product.slug, o))
  const offers = (await connector.fetchOffers(product.slug, now)).map((o) => toObservation(product.slug, o))

  console.log(`── Escenario: ${scenario}`)
  for (const obs of offers) {
    const verdict = validateDiscount(obs, history, product, now)
    console.log(
      `   ${obs.market} ${obs.price} ${obs.currency} (anuncia antes: ${obs.advertisedPreviousPrice ?? '—'}) → ${verdict.veredicto.toUpperCase()} | ${verdict.razon}`,
    )
    const proposal = proposePurchase(obs, verdict, product)
    if (proposal) {
      console.log(`   Propuesta de compra generada a ${proposal.precio} ${proposal.moneda}. Requiere approve humano.`)
      const { authorization } = decideAuthorization({ proposal, decision: 'approve', autorizadoPor: 'demo@labsia.mx', product, ttlHours: env.DEFAULT_AUTHORIZATION_TTL_HOURS, now })
      const result = executePurchase(env, store, authorization, obs, obs.price, now)
      console.log(`   Ejecutor: ${result.status}${'razon' in result ? ` — ${result.razon}` : ''}`)
    }
  }
  if (scenario === 'comparacion_internacional') {
    const cmp = compareInternational(offers, defaultComparisonConfig(env.USD_MXN_RATE))
    for (const r of cmp.ranking) {
      console.log(`   ${r.market}: ${r.precioLocal} ${r.monedaLocal} → aterrizado ${r.precioAterrizado} ${r.monedaBase} (tc ${r.tipoCambio}, envío ${r.envio}, impuestos ${r.impuestos})`)
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
