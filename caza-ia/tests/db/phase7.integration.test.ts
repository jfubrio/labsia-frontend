import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createDb, type Db } from '../../src/db/client.js'
import { resetTestState } from './reset.js'
import { getProductBySlug, connectorIdsByClave } from '../../src/db/repositories/products.repo.js'
import { insertObservation } from '../../src/db/repositories/observations.repo.js'
import { setSpendLimit, getSpendState } from '../../src/db/repositories/spend-limits.repo.js'
import { MockConnector } from '../../src/connectors/mock.connector.js'
import { toObservation } from '../../src/engines/ingest.js'
import { defaultComparisonConfig } from '../../src/engines/international-comparison.js'
import { runWatch } from '../../src/watch/run-watch.js'
import { buildApp } from '../../src/api/app.js'
import { createNotifiers, type FetchLike } from '../../src/notify/notifier.js'

/** Fase 7 (parcial): alertas disparan y quedan registradas; el límite de gasto bloquea una aprobación. Requiere DATABASE_URL. */
const url = process.env.DATABASE_URL
const d = url ? describe : describe.skip

d('alertas y límites de gasto (fase 7)', () => {
  let db: Db
  let app: ReturnType<typeof buildApp>
  const H = { 'x-caza-token': 't', 'content-type': 'application/json' }
  const NOW = new Date('2026-10-11T12:00:00Z')
  const cmp = defaultComparisonConfig(18.5)
  const webhookCalls: unknown[] = []
  const fakeFetch: FetchLike = async (_u, init) => {
    webhookCalls.push(JSON.parse(init.body))
    return { ok: true, status: 200 }
  }
  const notifiers = createNotifiers({ webhookUrl: 'https://hooks.example/caza', fetchImpl: fakeFetch, log: () => {} })

  beforeAll(async () => {
    db = createDb(url)
    await resetTestState(db, NOW)
    app = buildApp({ db, apiToken: 't' })
    await app.ready()
  })
  afterAll(async () => {
    await app.close()
    await db.end()
  })

  it('una propuesta nueva dispara la alerta por consola y webhook, y ambas quedan registradas', async () => {
    const product = await getProductBySlug(db, 'sony-wh1000xm6')
    const r = await runWatch(product, { db, connectors: [new MockConnector('descuento_real')], comparison: cmp, now: NOW, notifiers })
    expect(r.propuestas).toBe(1)
    expect(r.alertas).toBe(2)
    expect(webhookCalls).toHaveLength(1)
    expect((webhookCalls[0] as Record<string, unknown>).evento).toBe('proposal.created')
    const { rows } = await db.query(`SELECT canal, evento, estado FROM caza_notifications ORDER BY canal`)
    expect(rows).toEqual([
      { canal: 'console', evento: 'proposal.created', estado: 'enviada' },
      { canal: 'webhook', evento: 'proposal.created', estado: 'enviada' },
    ])
  })

  it('la API expone el límite y lo comprometido; aprobar dentro del presupuesto compromete el monto', async () => {
    const before = (await app.inject({ method: 'GET', url: '/api/v1/caza/limits', headers: H })).json()
    expect(before.limit.presupuestoMensualBase).toBe(20000)
    expect(before.state.comprometidoMesBase).toBe(0)
    const { rows } = await db.query(`SELECT id FROM caza_purchase_proposals WHERE estado = 'pendiente'`)
    const r = await app.inject({ method: 'POST', url: `/api/v1/caza/proposals/${rows[0].id}/approve`, headers: H, payload: { decididoPor: 'op@labsia.mx' } })
    expect(r.statusCode).toBe(200)
    const state = await getSpendState(db, NOW)
    expect(state.comprometidoMesBase).toBe(7899)
    expect(state.compromisosMes).toBe(1)
  })

  it('una segunda aprobación que excede el presupuesto se rechaza con 422, queda en el audit log y la propuesta sigue pendiente', async () => {
    await setSpendLimit(db, { presupuestoMensualBase: 10000, maxOrdenesMes: 5, actualizadoPor: 'test' })
    const product = await getProductBySlug(db, 'sony-wh1000xm6')
    const r0 = await runWatch(product, { db, connectors: [new MockConnector('minimo_historico')], comparison: cmp, now: NOW, notifiers })
    expect(r0.propuestas).toBe(1)
    const { rows } = await db.query(`SELECT id FROM caza_purchase_proposals WHERE estado = 'pendiente'`)
    const r = await app.inject({ method: 'POST', url: `/api/v1/caza/proposals/${rows[0].id}/approve`, headers: H, payload: { decididoPor: 'op@labsia.mx' } })
    expect(r.statusCode).toBe(422)
    expect(r.json().code).toBe('spend_limit')
    expect(r.json().error).toMatch(/Presupuesto mensual insuficiente/)
    const { rows: audit } = await db.query(`SELECT count(*)::int AS n FROM caza_audit_log WHERE evento = 'spend.limit'`)
    expect(audit[0].n).toBe(1)
    const { rows: still } = await db.query(`SELECT estado FROM caza_purchase_proposals WHERE id = $1`, [rows[0].id])
    expect(still[0].estado).toBe('pendiente')
  })

  it('el máximo de órdenes al mes también bloquea', async () => {
    await setSpendLimit(db, { presupuestoMensualBase: 100000, maxOrdenesMes: 1, actualizadoPor: 'test' })
    const { rows } = await db.query(`SELECT id FROM caza_purchase_proposals WHERE estado = 'pendiente'`)
    const r = await app.inject({ method: 'POST', url: `/api/v1/caza/proposals/${rows[0].id}/approve`, headers: H, payload: { decididoPor: 'op@labsia.mx' } })
    expect(r.statusCode).toBe(422)
    expect(r.json().error).toMatch(/1 compras al mes/)
  })

  it('subir el límite por la API desbloquea la aprobación y queda auditado', async () => {
    const put = await app.inject({ method: 'PUT', url: '/api/v1/caza/limits', headers: H, payload: { presupuestoMensualBase: 30000, maxOrdenesMes: 3, actualizadoPor: 'admin@labsia.mx' } })
    expect(put.statusCode).toBe(200)
    expect(put.json().maxOrdenesMes).toBe(3)
    const { rows } = await db.query(`SELECT id FROM caza_purchase_proposals WHERE estado = 'pendiente'`)
    const r = await app.inject({ method: 'POST', url: `/api/v1/caza/proposals/${rows[0].id}/approve`, headers: H, payload: { decididoPor: 'op@labsia.mx' } })
    expect(r.statusCode).toBe(200)
    const list = (await app.inject({ method: 'GET', url: '/api/v1/caza/notifications', headers: H })).json()
    expect(list.length).toBeGreaterThanOrEqual(4)
  })

  it('ninguna orden existe al terminar el simulacro', async () => {
    const { rows } = await db.query('select count(*)::int as n from caza_purchase_orders')
    expect(rows[0].n).toBe(0)
  })
})
