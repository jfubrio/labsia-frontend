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
import { getMetrics } from '../db/repositories/metrics.repo.js'
import { listConnectors, setConnectorValidation, identifiersFor, setIdentifiers } from '../db/repositories/connectors.repo.js'
import { buildConnectors, credentialsPresent } from '../connectors/factory.js'
import { StaticConnector } from '../connectors/static.connector.js'
import { runWatch } from '../watch/run-watch.js'
import type { Env } from '../config/env.js'
import type { ComparisonConfig } from '../engines/international-comparison.js'
import { comparisonWithLiveRate, getCachedRate, resolveRate, providersFrom } from '../fx/service.js'
import { createOrderFromAuthorization, transitionOrder, listOrders, getOrder } from '../services/orders.service.js'
import type { Notifier } from '../notify/notifier.js'
import type { RawOffer } from '../types.js'
import { operatorPage } from './ui.js'
import { dashboardPage } from './dashboard.js'

export interface ApiOptions {
  db: Db
  /** Token compartido que deben traer las peticiones en X-CAZA-Token. Sin token configurado, la API no arranca. */
  apiToken: string
  /** Se llama tras cambiar vigilancia_activa, para resincronizar el programador si hay Redis. */
  onWatchChanged?: () => Promise<void>
  /** Intervalo de refresco del stream de métricas (SSE), en ms. */
  metricsIntervalMs?: number
  /** Entorno (credenciales de conectores) para el informe de conectores y la ingesta externa. */
  env?: Env
  /** Configuración de comparación y canales de alerta para procesar observaciones ingresadas por la API. */
  comparison?: ComparisonConfig
  notifiers?: Notifier[]
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

  // Las páginas (/ui, /dashboard) son cascarones sin datos: se sirven sin token para poder abrirlas en el navegador.
  // Todo lo que devuelve datos exige el token, en cabecera o, para EventSource (que no admite cabeceras), en ?token=.
  const PUBLIC_PATHS = new Set(['/health', '/ui', '/dashboard'])
  app.addHook('onRequest', async (req, reply) => {
    const path = req.url.split('?')[0] ?? req.url
    if (PUBLIC_PATHS.has(path)) return
    const header = req.headers['x-caza-token']
    const query = (req.query as { token?: string } | undefined)?.token
    const token = header ?? (path === '/api/v1/caza/metrics/stream' ? query : undefined)
    if (token !== opts.apiToken) {
      await reply.code(401).send({ error: 'token inválido' })
    }
  })

  app.get('/health', async () => ({ ok: true }))

  app.get('/ui', async (_req, reply) => reply.type('text/html').send(operatorPage()))
  app.get('/dashboard', async (_req, reply) => reply.type('text/html').send(dashboardPage()))

  app.get('/api/v1/caza/metrics', async () => getMetrics(db))

  /** Server-Sent Events: empuja las métricas al conectar y después cada metricsIntervalMs (5 s por defecto). */
  app.get('/api/v1/caza/metrics/stream', async (req, reply) => {
    const interval = opts.metricsIntervalMs ?? 5_000
    reply.raw.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' })
    reply.raw.write('retry: 3000\n\n')
    let closed = false
    const push = async () => {
      if (closed) return
      try {
        const m = await getMetrics(db)
        reply.raw.write(`event: metrics\ndata: ${JSON.stringify(m)}\n\n`)
      } catch (err) {
        reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: (err as Error).message })}\n\n`)
      }
    }
    await push()
    const timer = setInterval(push, interval)
    req.raw.on('close', () => {
      closed = true
      clearInterval(timer)
    })
    return reply
  })

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

  // Fase 0 y 3: estado de conectores, identificadores por tienda e ingesta externa de observaciones.
  app.get('/api/v1/caza/connectors', async () => {
    const rows = await listConnectors(db)
    return rows.map((c) => ({ ...c, credenciales: opts.env ? credentialsPresent(c.clave, opts.env) : null }))
  })

  app.put<{ Params: { clave: string } }>('/api/v1/caza/connectors/:clave', async (req, reply) => {
    const body = z.object({ estadoValidacion: z.enum(['por_validar', 'validado', 'descartado']), notas: z.string().min(1), habilitado: z.boolean().default(false), actualizadoPor: z.string().min(1) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'body inválido', detalles: body.error.issues })
    try {
      const row = await setConnectorValidation(db, req.params.clave, body.data)
      await db.query(`INSERT INTO caza_audit_log (actor, evento, payload) VALUES ($1, 'connector.validated', $2)`, [body.data.actualizadoPor, JSON.stringify({ clave: req.params.clave, ...body.data })])
      return row
    } catch (err) {
      return reply.code(404).send({ error: (err as Error).message })
    }
  })

  app.get<{ Params: { slug: string } }>('/api/v1/caza/products/:slug/connectors', async (req, reply) => {
    let product
    try {
      product = await getProductBySlug(db, req.params.slug)
    } catch {
      return reply.code(404).send({ error: 'producto no encontrado' })
    }
    if (!opts.env) return reply.code(503).send({ error: 'la API no tiene entorno de conectores configurado' })
    const { report } = await buildConnectors(db, product, opts.env)
    return { slug: product.slug, identificadores: await identifiersFor(db, product.id), conectores: report }
  })

  app.put<{ Params: { slug: string } }>('/api/v1/caza/products/:slug/identifiers', async (req, reply) => {
    const body = z.object({ identificadores: z.record(z.string(), z.string()), actualizadoPor: z.string().min(1) }).safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'body inválido: { identificadores: { bestbuy_us: "6505727" }, actualizadoPor }' })
    let product
    try {
      product = await getProductBySlug(db, req.params.slug)
    } catch {
      return reply.code(404).send({ error: 'producto no encontrado' })
    }
    try {
      const ids = await setIdentifiers(db, product.id, body.data.identificadores)
      await db.query(`INSERT INTO caza_audit_log (actor, evento, product_id, payload) VALUES ($1, 'identifiers.updated', $2, $3)`, [body.data.actualizadoPor, product.id, JSON.stringify(ids)])
      return { slug: product.slug, identificadores: ids }
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message })
    }
  })

  /**
   * Ingesta externa: changedetection.io, un escenario de Make o una captura manual envían un precio observado y CAZA IA
   * lo procesa con el ciclo de vigilancia completo (perfil, veredicto, propuesta, alerta). Nunca compra.
   */
  const observationBody = z.object({
    productSlug: z.string().min(1),
    store: z.string().min(1),
    market: z.enum(['MX', 'US']),
    currency: z.enum(['MXN', 'USD']),
    price: z.number().positive(),
    advertisedPreviousPrice: z.number().positive().nullable().optional(),
    inStock: z.boolean().default(true),
    url: z.string().url(),
    seller: z.string().optional(),
    observedAt: z.string().datetime().optional(),
  })
  app.post('/api/v1/caza/observations', async (req, reply) => {
    const body = observationBody.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: 'body inválido', detalles: body.error.issues })
    if (!opts.comparison) return reply.code(503).send({ error: 'la API no tiene configuración de comparación para procesar observaciones' })
    let product
    try {
      product = await getProductBySlug(db, body.data.productSlug)
    } catch {
      return reply.code(404).send({ error: 'producto no encontrado' })
    }
    if (!product.mercados.includes(body.data.market)) return reply.code(400).send({ error: `el producto no vigila el mercado ${body.data.market}` })
    const offer: RawOffer = {
      connector: 'webhook',
      store: body.data.store,
      market: body.data.market,
      currency: body.data.currency,
      price: body.data.price,
      advertisedPreviousPrice: body.data.advertisedPreviousPrice ?? null,
      inStock: body.data.inStock,
      url: body.data.url,
      seller: body.data.seller,
      observedAt: body.data.observedAt ? new Date(body.data.observedAt) : new Date(),
    }
    const comparison = opts.env ? (await comparisonWithLiveRate(db, opts.env, offer.observedAt)).comparison : opts.comparison
    const result = await runWatch(product, { db, connectors: [new StaticConnector([offer])], comparison, disparador: 'manual', notifiers: opts.notifiers, now: offer.observedAt })
    return reply.code(201).send({ runId: result.runId, observaciones: result.observaciones, veredictos: result.veredictos, propuestas: result.propuestas, perfil: result.perfiles[body.data.market] ? { precioReal: result.perfiles[body.data.market]!.precioReal, confianza: result.perfiles[body.data.market]!.confianza } : null })
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

  /**
   * Fase 6, compra asistida. Registrar la orden es la única acción que compromete dinero y pasa por las tres capas del
   * interruptor (código, base de datos, autorización). Ninguna ruta llama a una tienda para comprar: el comprador
   * ejecuta la compra a mano y la marca como colocada con la referencia del pedido.
   */
  app.get('/api/v1/caza/orders', async () => listOrders(db))
  app.get<{ Params: { id: string } }>('/api/v1/caza/orders/:id', async (req, reply) => (await getOrder(db, req.params.id)) ?? reply.code(404).send({ error: 'orden no encontrada' }))

  app.post<{ Params: { id: string } }>('/api/v1/caza/authorizations/:id/order', async (req, reply) => {
    const body = z.object({ actor: z.string().min(1), precioFinal: z.number().positive().optional() }).safeParse(req.body ?? {})
    if (!body.success) return reply.code(400).send({ error: 'body inválido', detalles: body.error.issues })
    if (!opts.env) return reply.code(503).send({ error: 'la API no tiene entorno configurado' })
    const r = await createOrderFromAuthorization(db, opts.env, { authorizationId: req.params.id, ...body.data, notifiers: opts.notifiers })
    const status = r.status === 'created' ? 201 : r.status === 'duplicate' ? 200 : r.status === 'disabled' ? 403 : 409
    return reply.code(status).send(r)
  })

  for (const to of ['placed', 'cancelled', 'failed', 'delivered'] as const) {
    app.post<{ Params: { id: string } }>(`/api/v1/caza/orders/:id/${to}`, async (req, reply) => {
      const body = z.object({ actor: z.string().min(1), referenciaExterna: z.string().optional(), precioFinal: z.number().positive().optional(), guiaReenvio: z.string().optional() }).safeParse(req.body ?? {})
      if (!body.success) return reply.code(400).send({ error: 'body inválido', detalles: body.error.issues })
      try {
        return await transitionOrder(db, req.params.id, to, body.data)
      } catch (err) {
        const msg = (err as Error).message
        return reply.code(msg.includes('no existe') ? 404 : 409).send({ error: msg })
      }
    })
  }

  // Fase 4: tipo de cambio del día con su procedencia.
  app.get('/api/v1/caza/fx', async () => {
    const cached = await getCachedRate(db, new Date())
    return { cache: cached, fijo: opts.env?.USD_MXN_RATE ?? null }
  })
  app.post('/api/v1/caza/fx/refresh', async (_req, reply) => {
    if (!opts.env) return reply.code(503).send({ error: 'la API no tiene entorno configurado' })
    const rate = await resolveRate(db, providersFrom(opts.env), new Date())
    return rate
  })

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
