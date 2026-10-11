import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createDb, type Db } from '../../src/db/client.js'
import { resetTestState } from './reset.js'
import { getProductBySlug } from '../../src/db/repositories/products.repo.js'
import { MockConnector } from '../../src/connectors/mock.connector.js'
import { defaultComparisonConfig } from '../../src/engines/international-comparison.js'
import { runWatch } from '../../src/watch/run-watch.js'
import { decideProposal } from '../../src/services/approvals.service.js'
import { createOrderFromAuthorization, transitionOrder } from '../../src/services/orders.service.js'
import { loadEnv } from '../../src/config/env.js'
import { buildApp } from '../../src/api/app.js'

/**
 * Fase 6: compra asistida. Criterio: dos intentos concurrentes → una sola orden; el interruptor en sus tres capas.
 * Solo esta suite enciende las compras, y solo en la base de datos temporal de prueba.
 */
const url = process.env.DATABASE_URL
const d = url ? describe : describe.skip

d('ejecutor de compra (compra asistida)', () => {
  let db: Db
  const NOW = new Date('2026-10-11T12:00:00Z')
  const cmp = defaultComparisonConfig(18.5)
  const envOff = loadEnv({})
  const envOn = loadEnv({ CAZA_PHASE: '6', PURCHASES_ENABLED: 'true' })

  async function aprobada(scenario: 'descuento_real' | 'minimo_historico' | 'oferta_usa_gana'): Promise<string> {
    const product = await getProductBySlug(db, 'sony-wh1000xm6')
    await db.query(`UPDATE caza_purchase_proposals SET estado = 'expirada' WHERE estado = 'pendiente'`)
    const r = await runWatch(product, { db, connectors: [new MockConnector(scenario)], comparison: cmp, now: NOW })
    expect(r.propuestas).toBe(1)
    const { rows } = await db.query(`SELECT id FROM caza_purchase_proposals WHERE estado = 'pendiente'`)
    const { authorization } = await decideProposal(db, { proposalId: rows[0].id, decision: 'approve', decididoPor: 'op@labsia.mx', now: NOW })
    return authorization.id
  }

  beforeAll(async () => {
    db = createDb(url)
    await resetTestState(db, NOW)
  })
  afterAll(async () => {
    await db.query(`UPDATE caza_settings SET valor = 'false' WHERE clave = 'purchases_enabled'`)
    await db.end()
  })

  it('capa 1: con el código en fase < 6 no se crea ninguna orden aunque la DB lo permitiera', async () => {
    const authId = await aprobada('descuento_real')
    const r = await createOrderFromAuthorization(db, envOff, { authorizationId: authId, actor: 'op@labsia.mx', now: NOW })
    expect(r.status).toBe('disabled')
    expect(() => loadEnv({ PURCHASES_ENABLED: 'true', CAZA_PHASE: '5' })).toThrow(/fase 5/)
  })

  it('capa 2: con el código en fase 6 pero la DB apagada, el trigger rechaza y la autorización no se consume', async () => {
    const { rows } = await db.query(`SELECT id FROM caza_purchase_authorizations WHERE decision = 'approve' AND consumido_en IS NULL ORDER BY creado_en DESC LIMIT 1`)
    const r = await createOrderFromAuthorization(db, envOn, { authorizationId: rows[0].id, actor: 'op@labsia.mx', now: NOW })
    expect(r.status).toBe('disabled')
    if (r.status === 'disabled') expect(r.razon).toMatch(/purchases_enabled=false/)
    const { rows: a } = await db.query(`SELECT consumido_en FROM caza_purchase_authorizations WHERE id = $1`, [rows[0].id])
    expect(a[0].consumido_en).toBeNull()
  })

  it('capa 3: con todo encendido, la orden se crea, consume la autorización y queda auditada; repetir es idempotente', async () => {
    await db.query(`UPDATE caza_settings SET valor = 'true' WHERE clave = 'purchases_enabled'`)
    const { rows } = await db.query(`SELECT id FROM caza_purchase_authorizations WHERE decision = 'approve' AND consumido_en IS NULL ORDER BY creado_en DESC LIMIT 1`)
    const r1 = await createOrderFromAuthorization(db, envOn, { authorizationId: rows[0].id, actor: 'op@labsia.mx', now: NOW })
    expect(r1.status).toBe('created')
    if (r1.status !== 'created') return
    expect(r1.order.status).toBe('authorized')
    expect(r1.order.precio_final).toBe(7899)
    const { rows: a } = await db.query(`SELECT consumido_en FROM caza_purchase_authorizations WHERE id = $1`, [rows[0].id])
    expect(a[0].consumido_en).not.toBeNull()
    const r2 = await createOrderFromAuthorization(db, envOn, { authorizationId: rows[0].id, actor: 'op@labsia.mx', now: NOW })
    expect(r2.status).toBe('duplicate')
    if (r2.status === 'duplicate') expect(r2.order.id).toBe(r1.order.id)
    const { rows: audit } = await db.query(`SELECT count(*)::int AS n FROM caza_audit_log WHERE evento = 'order.created'`)
    expect(audit[0].n).toBe(1)
  })

  it('criterio de fase 6: dos intentos concurrentes con autorizaciones distintas → una sola orden activa', async () => {
    await transitionOrder(db, (await db.query(`SELECT id FROM caza_purchase_orders WHERE status = 'authorized'`)).rows[0].id, 'cancelled', { actor: 'op@labsia.mx', now: NOW })
    const a1 = await aprobada('minimo_historico')
    const a2 = await aprobada('oferta_usa_gana')
    const [r1, r2] = await Promise.all([
      createOrderFromAuthorization(db, envOn, { authorizationId: a1, actor: 'op@labsia.mx', now: NOW }),
      createOrderFromAuthorization(db, envOn, { authorizationId: a2, actor: 'op@labsia.mx', now: NOW }),
    ])
    const estados = [r1.status, r2.status].sort()
    expect(estados).toEqual(['created', 'duplicate'])
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM caza_purchase_orders WHERE status IN ('pending','authorized','placed')`)
    expect(rows[0].n).toBe(1)
  })

  it('el ciclo de vida: colocada con referencia, entregada; transiciones inválidas se rechazan', async () => {
    const { rows } = await db.query(`SELECT id FROM caza_purchase_orders WHERE status = 'authorized'`)
    const id = rows[0].id as string
    await expect(transitionOrder(db, id, 'placed', { actor: 'op@labsia.mx', now: NOW })).rejects.toThrow(/referencia/)
    await expect(transitionOrder(db, id, 'delivered', { actor: 'op@labsia.mx', now: NOW })).rejects.toThrow(/no se puede pasar/)
    const placed = await transitionOrder(db, id, 'placed', { actor: 'op@labsia.mx', referenciaExterna: 'BBY-123', now: NOW })
    expect(placed.status).toBe('placed')
    expect(placed.referencia_externa).toBe('BBY-123')
    const delivered = await transitionOrder(db, id, 'delivered', { actor: 'op@labsia.mx', now: NOW })
    expect(delivered.status).toBe('delivered')
    expect(delivered.recogido_en).not.toBeNull()
    const { rows: audit } = await db.query(`SELECT evento FROM caza_audit_log WHERE evento LIKE 'order.%' ORDER BY id`)
    expect(audit.map((x) => x.evento)).toEqual(['order.created', 'order.cancelled', 'order.created', 'order.placed', 'order.delivered'])
  })

  it('la API expone el ejecutor con el mismo interruptor: 403 apagado, 201 encendido', async () => {
    const appOff = buildApp({ db, apiToken: 't', env: envOff })
    await appOff.ready()
    const authId = await aprobada('descuento_real')
    const H = { 'x-caza-token': 't', 'content-type': 'application/json' }
    const off = await appOff.inject({ method: 'POST', url: `/api/v1/caza/authorizations/${authId}/order`, headers: H, payload: { actor: 'op@labsia.mx' } })
    expect(off.statusCode).toBe(403)
    await appOff.close()
    const appOn = buildApp({ db, apiToken: 't', env: envOn })
    await appOn.ready()
    const on = await appOn.inject({ method: 'POST', url: `/api/v1/caza/authorizations/${authId}/order`, headers: H, payload: { actor: 'op@labsia.mx' } })
    expect(on.statusCode).toBe(201)
    const orders = (await appOn.inject({ method: 'GET', url: '/api/v1/caza/orders', headers: H })).json()
    expect(orders.length).toBeGreaterThanOrEqual(2)
    const bad = await appOn.inject({ method: 'POST', url: `/api/v1/caza/orders/${on.json().order.id}/delivered`, headers: H, payload: { actor: 'op@labsia.mx' } })
    expect(bad.statusCode).toBe(409)
    await appOn.close()
  })
})
