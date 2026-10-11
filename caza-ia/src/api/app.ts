import Fastify, { type FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { Db } from '../db/client.js'
import { listProposals, getProposal, countPendingProposals } from '../db/repositories/proposals.repo.js'
import { listProducts, getProductBySlug, setWatchActive } from '../db/repositories/products.repo.js'
import { latestProfile } from '../db/repositories/profiles.repo.js'
import { listRuns } from '../db/repositories/runs.repo.js'
import { decideProposal, ApprovalError } from '../services/approvals.service.js'
import { getSpendLimit, setSpendLimit, getSpendState } from '../db/repositories/spend-limits.repo.js'
import { listNotifications } from '../db/repositories/notifications.repo.js'
import { operatorPage } from './ui.js'

export interface ApiOptions {
  db: Db
  /** Token compartido que deben traer las peticiones en X-CAZA-Token. Sin token configurado, la API no arranca. */
  apiToken: string
  /** Se llama tras cambiar vigilancia_activa, para resincronizar el programador si hay Redis. */
  onWatchChanged?: () => Promise<void>
}

const decideBody = z.object({
  decididoPor: z.string().min(1),
  motivo: z.string().max(500).optional(),
  precioMaximo: z.number().positive().optional(),
  ttlHours: z.number().positive().max(24 * 14).optional(),
})

/**
 * API del operador (fase 5). Solo lectura de propuestas y perfiles, y las dos decisiones humanas: approve y reject.
 * No existe ningún endpoint que compre: eso es del ejecutor (fase 6), y sigue deshabilitado.
 */
export function buildApp(opts: ApiOptions): FastifyInstance {
  if (!opts.apiToken) throw new Error('CAZA: CAZA_API_TOKEN es obligatorio para levantar la API')
  const app = Fastify({ logger: false })
  const { db } = opts

  app.addHook('onRequest', async (req, reply) => {
    if (req.url === '/health') return
    const token = req.headers['x-caza-token']
    if (token !== opts.apiToken) {
      await reply.code(401).send({ error: 'token inválido' })
    }
  })

  app.get('/health', async () => ({ ok: true }))

  app.get('/ui', async (_req, reply) => reply.type('text/html').send(operatorPage()))

  app.get('/api/v1/caza/products', async () => {
    const products = await listProducts(db)
    return Promise.all(
      products.map(async (p) => ({
        slug: p.slug,
        nombre: p.nombre,
        monedaBase: p.monedaBase,
        precioObjetivo: p.precioObjetivo,
        precioMaximo: p.precioMaximo,
        mercados: p.mercados,
        mercadosCompra: p.mercadosCompra,
        vigilanciaActiva: p.vigilanciaActiva,
        intervaloMinutos: p.intervaloMinutos,
        propuestasPendientes: await countPendingProposals(db, p.id),
      })),
    )
  })

  app.get<{ Params: { slug: string } }>('/api/v1/caza/products/:slug/summary', async (req, reply) => {
    let product
    try {
      product = await getProductBySlug(db, req.params.slug)
    } catch {
      return reply.code(404).send({ error: 'producto no encontrado' })
    }
    const perfiles = Object.fromEntries(await Promise.all(product.mercados.map(async (m) => [m, await latestProfile(db, product.id, m)])))
    return { product, perfiles, corridas: await listRuns(db, product.id, 10), propuestasPendientes: await countPendingProposals(db, product.id) }
  })

  app.post<{ Params: { slug: string }; Body: { activa: boolean } }>('/api/v1/caza/products/:slug/watch', async (req, reply) => {
    const body = z.object({ activa: z.boolean() }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'body inválido: { activa: boolean }' })
    try {
      await getProductBySlug(db, req.params.slug)
    } catch {
      return reply.code(404).send({ error: 'producto no encontrado' })
    }
    await setWatchActive(db, req.params.slug, body.data.activa)
    await db.query(`INSERT INTO caza_audit_log (actor, evento, product_id, payload) SELECT 'operador', 'watch.toggled', id, $2 FROM caza_products WHERE slug = $1`, [
      req.params.slug,
      JSON.stringify({ activa: body.data.activa }),
    ])
    if (opts.onWatchChanged) await opts.onWatchChanged()
    return { slug: req.params.slug, vigilanciaActiva: body.data.activa }
  })

  app.get<{ Querystring: { estado?: string } }>('/api/v1/caza/proposals', async (req) => {
    return listProposals(db, req.query.estado ?? 'pendiente')
  })

  app.get<{ Params: { id: string } }>('/api/v1/caza/proposals/:id', async (req, reply) => {
    const p = await getProposal(db, req.params.id)
    return p ?? reply.code(404).send({ error: 'propuesta no encontrada' })
  })

  app.get('/api/v1/caza/limits', async () => {
    const limit = await getSpendLimit(db)
    const state = await getSpendState(db)
    return { limit, state, disponibleBase: limit ? Math.round((limit.presupuestoMensualBase - state.comprometidoMesBase) * 100) / 100 : null }
  })

  app.put('/api/v1/caza/limits', async (req, reply) => {
    const body = z.object({ presupuestoMensualBase: z.number().positive(), maxOrdenesMes: z.number().int().positive(), actualizadoPor: z.string().min(1) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'body inválido', detalles: body.error.issues })
    await setSpendLimit(db, body.data)
    await db.query(`INSERT INTO caza_audit_log (actor, evento, payload) VALUES ($1, 'spend.limit.updated', $2)`, [body.data.actualizadoPor, JSON.stringify(body.data)])
    return getSpendLimit(db)
  })

  app.get('/api/v1/caza/notifications', async () => listNotifications(db, 50))

  for (const decision of ['approve', 'reject'] as const) {
    app.post<{ Params: { id: string } }>(`/api/v1/caza/proposals/:id/${decision}`, async (req, reply) => {
      const body = decideBody.safeParse(req.body ?? {})
      if (!body.success) return reply.code(400).send({ error: 'body inválido', detalles: body.error.issues })
      try {
        const r = await decideProposal(db, { proposalId: req.params.id, decision, ...body.data })
        return { proposal: r.proposal, authorization: r.authorization }
      } catch (err) {
        if (err instanceof ApprovalError) {
          const status = err.code === 'not_found' ? 404 : err.code === 'invalid' ? 400 : err.code === 'spend_limit' ? 422 : 409
          return reply.code(status).send({ error: err.message, code: err.code })
        }
        if (err instanceof Error && err.message.startsWith('CAZA:')) return reply.code(400).send({ error: err.message })
        throw err
      }
    })
  }

  return app
}
