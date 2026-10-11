/**
 * Comprobación del programador BullMQ y del worker contra DATABASE_URL y REDIS_URL.
 * Carga historial sintético, activa la vigilancia del producto con un intervalo de prueba de 5 s, sincroniza los Job
 * Schedulers dos veces (idempotencia), espera el primer job completado, comprueba la corrida en la DB, desactiva la
 * vigilancia y verifica que el scheduler se retira. Uso: npm run phase2:worker-check
 */
import { createDb } from '../db/client.js'
import { loadEnv, notifierConfigFrom } from '../config/env.js'
import { createNotifiers } from '../notify/notifier.js'
import { setWatchActive, getProductBySlug, connectorIdsByClave } from '../db/repositories/products.repo.js'
import { insertObservation } from '../db/repositories/observations.repo.js'
import { listRuns } from '../db/repositories/runs.repo.js'
import { MockConnector } from '../connectors/mock.connector.js'
import { toObservation } from '../engines/ingest.js'
import { defaultComparisonConfig } from '../engines/international-comparison.js'
import { syncSchedulers, startWatchWorker } from '../watch/scheduler.js'

const env = loadEnv()
if (!env.REDIS_URL) throw new Error('CAZA: REDIS_URL es obligatoria para esta comprobación')
const db = createDb(env.DATABASE_URL)
const slug = 'sony-wh1000xm6'
const fail = (msg: string): never => {
  console.error(`FALLO: ${msg}`)
  process.exit(1)
}

const product = await getProductBySlug(db, slug)
const mockId = (await connectorIdsByClave(db)).get('mock')!
for (const raw of await new MockConnector().fetchHistory(slug, 90)) await insertObservation(db, product.id, mockId, toObservation(slug, raw))
await setWatchActive(db, slug, true)

const s1 = await syncSchedulers(db, env.REDIS_URL, { everyMsOverride: 5_000 })
console.log(`sync 1: programados=${s1.programados} retirados=${s1.retirados}`)
const s2 = await syncSchedulers(db, env.REDIS_URL, { everyMsOverride: 5_000 })
console.log(`sync 2 (idempotente): programados=${s2.programados} retirados=${s2.retirados}`)
if (s1.programados.length !== 1 || s2.programados.length !== 1 || s2.retirados.length !== 0) fail('la sincronización no es idempotente')

const worker = startWatchWorker(db, env.REDIS_URL, defaultComparisonConfig(env.USD_MXN_RATE), createNotifiers(notifierConfigFrom(env)), env)
await new Promise<void>((resolve, reject) => {
  worker.on('completed', (job, result) => {
    console.log(`job completado para ${job.data.productSlug}: ${JSON.stringify(result)}`)
    resolve()
  })
  worker.on('failed', (_j, err) => reject(err))
  setTimeout(() => reject(new Error('timeout de 30 s esperando el primer job del scheduler')), 30_000)
}).catch((e) => fail((e as Error).message))

const runs = await listRuns(db, product.id, 3)
const porScheduler = runs.filter((r) => r.disparador === 'scheduler' && r.estado === 'ok')
console.log(`corridas por scheduler en DB: ${porScheduler.length}`)
if (porScheduler.length < 1) fail('el job no dejó corrida en caza_watch_runs')

await setWatchActive(db, slug, false)
const s3 = await syncSchedulers(db, env.REDIS_URL)
console.log(`sync 3 (vigilancia desactivada): programados=${s3.programados} retirados=${s3.retirados}`)
if (s3.retirados.length !== 1) fail('el scheduler no se retiró al desactivar la vigilancia')

await worker.close()
await db.end()
console.log('OK: programador BullMQ y worker verificados (vigilancia desactivada al terminar)')
process.exit(0) // ioredis mantiene vivo el event loop tras close(); salida explícita
