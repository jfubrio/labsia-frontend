import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createDb, type Db } from '../../src/db/client.js'
import { getProductBySlug, connectorIdsByClave } from '../../src/db/repositories/products.repo.js'
import { insertObservation, countObservations, listHistory } from '../../src/db/repositories/observations.repo.js'
import { countPendingProposals } from '../../src/db/repositories/proposals.repo.js'
import { listRuns } from '../../src/db/repositories/runs.repo.js'
import { MockConnector } from '../../src/connectors/mock.connector.js'
import { toObservation } from '../../src/engines/ingest.js'
import { defaultComparisonConfig } from '../../src/engines/international-comparison.js'
import { runWatch } from '../../src/watch/run-watch.js'

/**
 * Prueba de integración de la fase 2. Requiere DATABASE_URL con las migraciones aplicadas:
 *   npm run test:db      (levanta un PostgreSQL temporal y la corre)
 * Sin DATABASE_URL se omite, para que `npm test` siga corriendo sin infraestructura.
 */
const url = process.env.DATABASE_URL
const d = url ? describe : describe.skip

d('vigilancia persistida (fase 2)', () => {
  let db: Db
  const NOW = new Date('2026-10-11T12:00:00Z')
  const cmp = defaultComparisonConfig(18.5)

  beforeAll(async () => {
    db = createDb(url)
    const product = await getProductBySlug(db, 'sony-wh1000xm6')
    const mockId = (await connectorIdsByClave(db)).get('mock')!
    for (const raw of await new MockConnector().fetchHistory('sony-wh1000xm6', 90, NOW)) {
      await insertObservation(db, product.id, mockId, toObservation('sony-wh1000xm6', raw))
    }
  })
  afterAll(async () => {
    await db.end()
  })

  it('un ciclo persiste observaciones, perfiles por mercado, veredictos y la corrida', async () => {
    const product = await getProductBySlug(db, 'sony-wh1000xm6')
    const antes = await countObservations(db, product.id)
    const r = await runWatch(product, { db, connectors: [new MockConnector('descuento_real')], comparison: cmp, now: NOW })
    expect(r.observaciones).toBe(1)
    expect(r.veredictos).toBe(1)
    expect(await countObservations(db, product.id)).toBe(antes + 1)
    expect(r.perfiles.MX?.precioReal).toBe(8999) // mismo precio real que el motor en memoria: el historial viene de la DB
    expect(r.perfiles.US?.precioReal).toBe(369.99)
    const runs = await listRuns(db, product.id, 1)
    expect(runs[0].estado).toBe('ok')
    expect(runs[0].observaciones).toBe(1)
  })

  it('la oferta real del primer ciclo dejó una propuesta pendiente', async () => {
    const product = await getProductBySlug(db, 'sony-wh1000xm6')
    expect(await countPendingProposals(db, product.id)).toBe(1)
  })

  it('mientras haya una propuesta pendiente, los ciclos siguientes no acumulan otras', async () => {
    const product = await getProductBySlug(db, 'sony-wh1000xm6')
    const r1 = await runWatch(product, { db, connectors: [new MockConnector('descuento_real')], comparison: cmp, now: NOW })
    const r2 = await runWatch(product, { db, connectors: [new MockConnector('minimo_historico')], comparison: cmp, now: NOW })
    expect(r1.veredictos + r2.veredictos).toBe(2) // se siguen juzgando y guardando
    expect(r1.propuestas + r2.propuestas).toBe(0) // pero no se proponen de nuevo
    expect(await countPendingProposals(db, product.id)).toBe(1)
  })

  it('el historial consultado por mercado solo trae ese mercado y esa moneda', async () => {
    const product = await getProductBySlug(db, 'sony-wh1000xm6')
    const mx = await listHistory(db, product.id, 'MX', 'MXN', 90, NOW)
    const us = await listHistory(db, product.id, 'US', 'USD', 90, NOW)
    expect(mx.length).toBeGreaterThan(50)
    expect(us.length).toBeGreaterThan(50)
    expect(mx.every((o) => o.currency === 'MXN' && o.market === 'MX')).toBe(true)
    expect(us.every((o) => o.currency === 'USD' && o.market === 'US')).toBe(true)
  })

  it('ninguna orden existe después de vigilar', async () => {
    const { rows } = await db.query('select count(*)::int as n from caza_purchase_orders')
    expect(rows[0].n).toBe(0)
  })
})
