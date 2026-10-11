import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createDb, type Db } from '../../src/db/client.js'
import { resetTestState } from './reset.js'
import { getProductBySlug, connectorIdsByClave } from '../../src/db/repositories/products.repo.js'
import { insertObservation } from '../../src/db/repositories/observations.repo.js'
import { countPendingProposals, expireStaleProposals } from '../../src/db/repositories/proposals.repo.js'
import { MockConnector } from '../../src/connectors/mock.connector.js'
import { toObservation } from '../../src/engines/ingest.js'
import { defaultComparisonConfig } from '../../src/engines/international-comparison.js'
import { runWatch } from '../../src/watch/run-watch.js'
import { buildApp } from '../../src/api/app.js'

/** Fase 5: approve registrado en audit log; reject bloquea la orden. Requiere DATABASE_URL (npm run test:db). */
const url = process.env.DATABASE_URL
const d = url ? describe : describe.skip

d('API del operador: approve y reject (fase 5)', () => {
  let db: Db
  let app: ReturnType<typeof buildApp>
  const TOKEN = 'token-de-prueba'
  const H = { 'x-caza-token': TOKEN, 'content-type': 'application/json' }
  const NOW = new Date('2026-10-11T12:00:00Z')
  const cmp = defaultComparisonConfig(18.5)
  let productId: string

  async function nuevaPropuesta(scenario: 'descuento_real' | 'minimo_historico' | 'oferta_usa_gana' = 'descuento_real'): Promise<string> {
    const product = await getProductBySlug(db, 'sony-wh1000xm6')
    const r = await runWatch(product, { db, connectors: [new MockConnector(scenario)], comparison: cmp, now: NOW })
    expect(r.propuestas).toBe(1)
    const { rows } = await db.query(`SELECT id FROM caza_purchase_proposals WHERE estado = 'pendiente' AND product_id = $1`, [product.id])
    return rows[0].id as string
  }

  beforeAll(async () => {
    db = createDb(url)
    await resetTestState(db, NOW)
    productId = (await getProductBySlug(db, 'sony-wh1000xm6')).id
    app = buildApp({ db, apiToken: TOKEN })
    await app.ready()
  })
  afterAll(async () => {
    await app.close()
    await db.end()
  })

  it('rechaza peticiones sin token y responde /health sin él', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/caza/proposals' })).statusCode).toBe(401)
    expect((await app.inject({ method: 'GET', url: '/api/v1/caza/proposals', headers: { 'x-caza-token': TOKEN + 'x' } })).statusCode).toBe(401)
    expect((await app.inject({ method: 'GET', url: '/api/v1/caza/proposals', headers: { 'x-caza-token': TOKEN.slice(0, -1) } })).statusCode).toBe(401)
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: '/ui', headers: H })).headers['content-type']).toMatch(/text\/html/)
  })

  it('lista la propuesta pendiente con precio, aterrizado, objetivo y veredicto', async () => {
    const id = await nuevaPropuesta()
    const r = await app.inject({ method: 'GET', url: '/api/v1/caza/proposals?estado=pendiente', headers: H })
    expect(r.statusCode).toBe(200)
    const rows = r.json()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(id)
    expect(Number(rows[0].precio)).toBe(7899)
    expect(rows[0].veredicto).toBe('real')
    expect(Number(rows[0].precio_objetivo)).toBe(7919.12)
    expect(new Date(rows[0].expira_en).getTime()).toBe(NOW.getTime() + 24 * 3_600_000)
  })

  it('approve crea la autorización, marca la propuesta aprobada y deja el evento en el audit log', async () => {
    const { rows: before } = await db.query(`SELECT id FROM caza_purchase_proposals WHERE estado = 'pendiente'`)
    const id = before[0].id as string
    const r = await app.inject({ method: 'POST', url: `/api/v1/caza/proposals/${id}/approve`, headers: H, payload: { decididoPor: 'op@labsia.mx' } })
    expect(r.statusCode).toBe(200)
    const { proposal, authorization } = r.json()
    expect(proposal.estado).toBe('aprobada')
    expect(proposal.decidido_por).toBe('op@labsia.mx')
    expect(authorization.decision).toBe('approve')
    expect(authorization.precioMaximo).toBe(7899)

    const { rows: auth } = await db.query(`SELECT decision, precio_maximo, autorizado_por, consumido_en FROM caza_purchase_authorizations WHERE id = $1`, [authorization.id])
    expect(auth[0].decision).toBe('approve')
    expect(auth[0].consumido_en).toBeNull()
    const { rows: audit } = await db.query(`SELECT actor, payload FROM caza_audit_log WHERE evento = 'authorization.approve' AND product_id = $1`, [productId])
    expect(audit).toHaveLength(1)
    expect(audit[0].actor).toBe('op@labsia.mx')
    expect(audit[0].payload.proposalId).toBe(id)

    // Decidir dos veces no es posible
    const again = await app.inject({ method: 'POST', url: `/api/v1/caza/proposals/${id}/reject`, headers: H, payload: { decididoPor: 'op@labsia.mx' } })
    expect(again.statusCode).toBe(409)
    expect(await countPendingProposals(db, productId)).toBe(0)
  })

  it('un tope por encima del máximo del producto se rechaza con 400', async () => {
    const id = await nuevaPropuesta('minimo_historico')
    const r = await app.inject({ method: 'POST', url: `/api/v1/caza/proposals/${id}/approve`, headers: H, payload: { decididoPor: 'op@labsia.mx', precioMaximo: 9000 } })
    expect(r.statusCode).toBe(400)
    expect(r.json().error).toMatch(/precio máximo/)
    expect(await countPendingProposals(db, productId)).toBe(1) // sigue pendiente
  })

  it('reject marca la propuesta rechazada y la autorización reject bloquea cualquier orden en la base de datos', async () => {
    const { rows } = await db.query(`SELECT id FROM caza_purchase_proposals WHERE estado = 'pendiente'`)
    const id = rows[0].id as string
    const r = await app.inject({ method: 'POST', url: `/api/v1/caza/proposals/${id}/reject`, headers: H, payload: { decididoPor: 'op@labsia.mx', motivo: 'precio aún alto' } })
    expect(r.statusCode).toBe(200)
    expect(r.json().proposal.estado).toBe('rechazada')
    expect(r.json().proposal.motivo_decision).toBe('precio aún alto')
    const authId = r.json().authorization.id as string

    // Aun con el interruptor de compras encendido (solo dentro de esta transacción, que se revierte), el trigger bloquea la orden.
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      await client.query(`UPDATE caza_settings SET valor = 'true' WHERE clave = 'purchases_enabled'`)
      const mockId = (await connectorIdsByClave(db)).get('mock')!
      await expect(
        client.query(
          `INSERT INTO caza_purchase_orders (product_id, authorization_id, connector_id, idempotency_key, moneda, precio_final)
           VALUES ($1, $2, $3, 'k-reject', 'MXN', 5933)`,
          [productId, authId, mockId],
        ),
      ).rejects.toThrow(/no es approve/)
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
    const { rows: settings } = await db.query(`SELECT valor FROM caza_settings WHERE clave = 'purchases_enabled'`)
    expect(settings[0].valor).toBe('false')
  })

  it('una propuesta vencida expira y la vigilancia puede proponer de nuevo', async () => {
    const id = await nuevaPropuesta('oferta_usa_gana')
    const later = new Date(NOW.getTime() + 25 * 3_600_000)
    expect(await expireStaleProposals(db, productId, later)).toBe(1)
    const r = await app.inject({ method: 'POST', url: `/api/v1/caza/proposals/${id}/approve`, headers: H, payload: { decididoPor: 'op@labsia.mx' } })
    expect(r.statusCode).toBe(409)
    expect(r.json().code).toBe('not_pending')
    const product = await getProductBySlug(db, 'sony-wh1000xm6')
    const again = await runWatch(product, { db, connectors: [new MockConnector('descuento_real')], comparison: cmp, now: later })
    expect(again.propuestas).toBe(1)
  })

  it('activar y desactivar la vigilancia queda registrado', async () => {
    const on = await app.inject({ method: 'POST', url: '/api/v1/caza/products/sony-wh1000xm6/watch', headers: H, payload: { activa: true } })
    expect(on.statusCode).toBe(200)
    const products = (await app.inject({ method: 'GET', url: '/api/v1/caza/products', headers: H })).json()
    expect(products[0].vigilanciaActiva).toBe(true)
    const off = await app.inject({ method: 'POST', url: '/api/v1/caza/products/sony-wh1000xm6/watch', headers: H, payload: { activa: false } })
    expect(off.json().vigilanciaActiva).toBe(false)
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM caza_audit_log WHERE evento = 'watch.toggled'`)
    expect(rows[0].n).toBe(2)
    const summary = (await app.inject({ method: 'GET', url: '/api/v1/caza/products/sony-wh1000xm6/summary', headers: H })).json()
    expect(summary.perfiles.MX.precio_real).toBe('8999.00')
  })

  it('ninguna orden existe al terminar', async () => {
    const { rows } = await db.query('select count(*)::int as n from caza_purchase_orders')
    expect(rows[0].n).toBe(0)
  })
})
