/**
 * Un ciclo de vigilancia manual contra DATABASE_URL, sin Redis.
 * Uso: npm run watch:once -- [slug] [--seed-history] [--activate]
 *   --seed-history  carga el historial sintético del conector mock como observaciones (solo para demostrar la fase 2)
 *   --activate      marca vigilancia_activa=true en el producto (lo que el scheduler usa para programarlo)
 * Imprime observaciones, perfiles por mercado, veredictos, propuestas y las últimas corridas.
 */
import { createDb } from '../db/client.js'
import { loadEnv, notifierConfigFrom } from '../config/env.js'
import { createNotifiers } from '../notify/notifier.js'
import { getProductBySlug, setWatchActive, connectorIdsByClave } from '../db/repositories/products.repo.js'
import { insertObservation, countObservations } from '../db/repositories/observations.repo.js'
import { countPendingProposals } from '../db/repositories/proposals.repo.js'
import { listRuns } from '../db/repositories/runs.repo.js'
import { latestProfile } from '../db/repositories/profiles.repo.js'
import { buildConnectors } from '../connectors/factory.js'
import { MockConnector } from '../connectors/mock.connector.js'
import { toObservation } from '../engines/ingest.js'
import { comparisonWithLiveRate } from '../fx/service.js'
import { runWatch } from '../watch/run-watch.js'

const args = process.argv.slice(2)
const slug = args.find((a) => !a.startsWith('--')) ?? 'sony-wh1000xm6'
const env = loadEnv()
const db = createDb(env.DATABASE_URL)
const now = new Date()

try {
  const product = await getProductBySlug(db, slug)

  if (args.includes('--seed-history')) {
    const ids = await connectorIdsByClave(db)
    const mockId = ids.get('mock')!
    const history = await new MockConnector().fetchHistory(slug, 90, now)
    for (const raw of history) await insertObservation(db, product.id, mockId, toObservation(slug, raw))
    console.log(`historial sintético cargado: ${history.length} observaciones`)
  }
  if (args.includes('--activate')) {
    await setWatchActive(db, slug, true)
    console.log('vigilancia_activa = true')
  }

  const { connectors, report } = await buildConnectors(db, product, env)
  console.log(`conectores: ${report.map((r) => `${r.clave}=${r.estado}`).join(', ')}`)
  const { comparison, rate } = await comparisonWithLiveRate(db, env, now)
  console.log(`tipo de cambio USD→MXN: ${rate.rate} (${rate.fuente}, ${rate.fecha}${rate.stale ? ', desactualizado' : ''})`)
  const result = await runWatch(product, { db, connectors, comparison, now, disparador: 'manual', notifiers: createNotifiers(notifierConfigFrom(env)) })
  console.log(`corrida ${result.runId}: ${result.observaciones} observaciones, ${result.veredictos} veredictos, ${result.propuestas} propuestas, ${result.alertas} alertas enviadas`)
  for (const [market, p] of Object.entries(result.perfiles)) {
    console.log(`  perfil ${market}: precio real ${p.precioReal} ${p.currency}, piso ${p.piso}, régimen ${p.regimen}, confianza ${p.confianza}, días observados ${p.diasObservados}, tiendas ${p.tiendas.length}`)
  }
  console.log(`observaciones acumuladas del producto: ${await countObservations(db, product.id)}`)
  console.log(`propuestas pendientes de approve: ${await countPendingProposals(db, product.id)}`)
  for (const m of product.mercados) {
    const lp = await latestProfile(db, product.id, m)
    if (lp) console.log(`  último perfil ${m} en DB: ${new Date(lp.calculado_en).toISOString()} precio real ${lp.precio_real} confianza ${lp.confianza}`)
  }
  console.log('últimas corridas:')
  for (const r of await listRuns(db, product.id, 5)) {
    console.log(`  ${new Date(r.iniciado_en).toISOString()} ${r.disparador} ${r.estado} obs=${r.observaciones} ver=${r.veredictos} prop=${r.propuestas}${r.error ? ' error=' + r.error : ''}`)
  }
} finally {
  await db.end()
}
