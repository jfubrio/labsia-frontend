import { Queue, Worker, type Job } from 'bullmq'
import IORedis from 'ioredis'
import type { Db } from '../db/client.js'
import { listProducts, getProductBySlug } from '../db/repositories/products.repo.js'
import { buildConnectors } from '../connectors/factory.js'
import type { Env } from '../config/env.js'
import { comparisonWithLiveRate } from '../fx/service.js'
import { runWatch } from './run-watch.js'
import type { ComparisonConfig } from '../engines/international-comparison.js'
import type { Notifier } from '../notify/notifier.js'

export const WATCH_QUEUE = 'caza-watch'

export interface WatchJobData {
  productSlug: string
}

/** BullMQ 6 pide el cliente ya construido en ESM. maxRetriesPerRequest: null es requisito de BullMQ para workers. */
function redisClient(redisUrl: string): IORedis {
  return new IORedis(redisUrl, { maxRetriesPerRequest: null })
}

/**
 * Un Job Scheduler de BullMQ por producto con vigilancia activa, repitiendo cada `intervalo_minutos`.
 * upsert es idempotente: volver a sincronizar no duplica repetibles. Los productos que dejaron de vigilarse se quitan.
 */
export async function syncSchedulers(
  db: Db,
  redisUrl: string,
  opts: { everyMsOverride?: number } = {},
): Promise<{ programados: string[]; retirados: string[] }> {
  const connection = redisClient(redisUrl)
  const queue = new Queue<WatchJobData>(WATCH_QUEUE, { connection })
  try {
    const vigilados = await listProducts(db, { soloVigilados: true })
    const existentes = await queue.getJobSchedulers()
    const programados: string[] = []
    for (const p of vigilados) {
      // BullMQ alinea el primer disparo al siguiente múltiplo de `every`; con 6 h el primer ciclo puede tardar hasta 6 h.
      const every = opts.everyMsOverride ?? p.intervaloMinutos * 60_000
      await queue.upsertJobScheduler(p.slug, { every }, { name: 'watch', data: { productSlug: p.slug } })
      programados.push(p.slug)
    }
    const retirados: string[] = []
    for (const s of existentes) {
      if (s.key && !programados.includes(s.key)) {
        await queue.removeJobScheduler(s.key)
        retirados.push(s.key)
      }
    }
    return { programados, retirados }
  } finally {
    await queue.close()
    await connection.quit()
  }
}

/** Worker: cada job ejecuta un ciclo de vigilancia para su producto. Concurrencia 1: las tiendas no se martillan. */
export function startWatchWorker(db: Db, redisUrl: string, comparison: ComparisonConfig, notifiers: Notifier[] = [], env: Env | null = null): Worker<WatchJobData> {
  return new Worker<WatchJobData>(
    WATCH_QUEUE,
    async (job: Job<WatchJobData>) => {
      const product = await getProductBySlug(db, job.data.productSlug)
      const e = env ?? (await import('../config/env.js')).env
      const { connectors } = await buildConnectors(db, product, e)
      const live = env ? (await comparisonWithLiveRate(db, e)).comparison : comparison
      const result = await runWatch(product, { db, connectors, comparison: live, disparador: 'scheduler', notifiers })
      return { observaciones: result.observaciones, veredictos: result.veredictos, propuestas: result.propuestas }
    },
    { connection: redisClient(redisUrl), concurrency: 1 },
  )
}
