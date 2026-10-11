import type { Db } from '../../src/db/client.js'
import { getProductBySlug, connectorIdsByClave } from '../../src/db/repositories/products.repo.js'
import { insertObservation } from '../../src/db/repositories/observations.repo.js'
import { setSpendLimit } from '../../src/db/repositories/spend-limits.repo.js'
import { MockConnector } from '../../src/connectors/mock.connector.js'
import { toObservation } from '../../src/engines/ingest.js'

/**
 * Deja la base de datos de prueba en un estado conocido: sin propuestas, autorizaciones, órdenes, veredictos,
 * perfiles, corridas ni alertas; historial sintético recién cargado; límites de gasto en su valor inicial.
 * Las suites de integración comparten un mismo PostgreSQL temporal (npm run test:db), así que cada una debe
 * empezar desde aquí para no depender del orden.
 */
export async function resetTestState(db: Db, now: Date): Promise<void> {
  await db.query(`
    TRUNCATE caza_purchase_orders, caza_purchase_authorizations, caza_purchase_proposals, caza_discount_verdicts,
             caza_market_price_profiles, caza_watch_runs, caza_notifications, caza_price_observations, caza_audit_log
    RESTART IDENTITY CASCADE`)
  await setSpendLimit(db, { presupuestoMensualBase: 20000, maxOrdenesMes: 2, actualizadoPor: 'test-reset' })
  await db.query(`UPDATE caza_watch_configs SET vigilancia_activa = FALSE`)
  const product = await getProductBySlug(db, 'sony-wh1000xm6')
  const mockId = (await connectorIdsByClave(db)).get('mock')!
  for (const raw of await new MockConnector().fetchHistory('sony-wh1000xm6', 90, now)) {
    await insertObservation(db, product.id, mockId, toObservation('sony-wh1000xm6', raw))
  }
}
