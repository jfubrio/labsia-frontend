/**
 * Arranca el programador y el worker de vigilancia (BullMQ sobre Redis).
 * Requiere DATABASE_URL y REDIS_URL. Programa un Job Scheduler por producto con vigilancia_activa=true.
 * No compra nada: produce observaciones, perfiles, veredictos y propuestas pendientes de approve.
 */
import { createDb } from '../db/client.js'
import { loadEnv } from '../config/env.js'
import { defaultComparisonConfig } from '../engines/international-comparison.js'
import { syncSchedulers, startWatchWorker } from '../watch/scheduler.js'

const env = loadEnv()
if (!env.REDIS_URL) throw new Error('CAZA: REDIS_URL es obligatoria para el worker de vigilancia')
const db = createDb(env.DATABASE_URL)

const sync = await syncSchedulers(db, env.REDIS_URL)
console.log(`programados: ${sync.programados.join(', ') || '(ninguno: ningún producto con vigilancia_activa)'}; retirados: ${sync.retirados.join(', ') || '—'}`)

const worker = startWatchWorker(db, env.REDIS_URL, defaultComparisonConfig(env.USD_MXN_RATE))
worker.on('completed', (job, result) => console.log(`[${new Date().toISOString()}] ${job.data.productSlug}: ${JSON.stringify(result)}`))
worker.on('failed', (job, err) => console.error(`[${new Date().toISOString()}] ${job?.data.productSlug ?? '?'} falló: ${err.message}`))
console.log(`worker de vigilancia escuchando la cola ${worker.name}. Ctrl+C para salir.`)

const shutdown = async () => {
  await worker.close()
  await db.end()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
