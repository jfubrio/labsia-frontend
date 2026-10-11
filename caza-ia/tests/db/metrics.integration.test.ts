import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createDb, type Db } from '../../src/db/client.js'
import { resetTestState } from './reset.js'
import { getProductBySlug } from '../../src/db/repositories/products.repo.js'
import { MockConnector } from '../../src/connectors/mock.connector.js'
import { defaultComparisonConfig } from '../../src/engines/international-comparison.js'
import { runWatch } from '../../src/watch/run-watch.js'
import { buildApp } from '../../src/api/app.js'
import { createNotifiers } from '../../src/notify/notifier.js'

/** Dashboard: métricas agregadas por HTTP y por SSE. Requiere DATABASE_URL (npm run test:db). */
const url = process.env.DATABASE_URL
const d = url ? describe : describe.skip

d('métricas del tablero', () => {
  let db: Db
  let app: ReturnType<typeof buildApp>
  const H = { 'x-caza-token': 't' }
  const NOW = new Date()

  beforeAll(async () => {
    db = createDb(url)
    await resetTestState(db, NOW)
    const product = await getProductBySlug(db, 'sony-wh1000xm6')
    await runWatch(product, { db, connectors: [new MockConnector('descuento_real')], comparison: defaultComparisonConfig(18.5), now: NOW, notifiers: createNotifiers({ log: () => {} }) })
    app = buildApp({ db, apiToken: 't', metricsIntervalMs: 50 })
    await app.ready()
  })
  afterAll(async () => {
    await app.close()
    await db.end()
  })

  it('las páginas se sirven sin token; los datos no', async () => {
    expect((await app.inject({ method: 'GET', url: '/dashboard' })).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: '/ui' })).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: '/api/v1/caza/metrics' })).statusCode).toBe(401)
    expect((await app.inject({ method: 'GET', url: '/api/v1/caza/metrics/stream?token=malo' })).statusCode).toBe(401)
  })

  it('GET /metrics agrega propuestas, vigilancia, alertas, gasto y perfiles por producto y mercado', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/v1/caza/metrics', headers: H })
    expect(r.statusCode).toBe(200)
    const m = r.json()
    expect(m.compras).toEqual({ habilitadasEnDb: false, ordenesActivas: 0, ordenesTotales: 0 })
    expect(m.productos).toEqual({ total: 1, vigilados: 0 })
    expect(m.propuestas.pendientes).toBe(1)
    expect(m.propuestas.ultimas[0].precio).toBe(7899)
    expect(m.vigilancia.corridas24h).toBe(1)
    expect(m.vigilancia.errores24h).toBe(0)
    expect(m.vigilancia.observaciones24h).toBeGreaterThan(0)
    expect(m.alertas.enviadas24h).toBe(1)
    expect(m.gasto.presupuestoMensual).toBe(20000)
    expect(m.gasto.disponible).toBe(20000)
    const p = m.porProducto[0]
    expect(p.slug).toBe('sony-wh1000xm6')
    expect(p.objetivoDerivado).toBe(true)
    expect(p.precioObjetivoEfectivo).toBe(7919.12) // 8999 × (1 − 12 %)
    expect(p.mercados.map((x: { mercado: string }) => x.mercado).sort()).toEqual(['MX', 'US'])
    const mx = p.mercados.find((x: { mercado: string }) => x.mercado === 'MX')
    expect(mx.precioReal).toBe(8999)
    expect(mx.regimen).toBe('bajando')
    expect(mx.serie.length).toBeGreaterThan(80)
    expect(mx.serie[0]).toHaveProperty('precioMinimo')
  })

  it('el stream SSE entrega el primer evento de métricas al conectar y sigue empujando', async () => {
    // inject() espera a que la respuesta termine y un SSE no termina: se usa un servidor real y se lee el flujo.
    const address = await app.listen({ port: 0, host: '127.0.0.1' })
    const controller = new AbortController()
    try {
      const res = await fetch(`${address}/api/v1/caza/metrics/stream?token=t`, { signal: controller.signal })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toMatch(/text\/event-stream/)
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      const deadline = Date.now() + 3000
      while (Date.now() < deadline && (buf.match(/event: metrics/g) ?? []).length < 2) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value)
      }
      expect(buf).toMatch(/^retry: 3000/)
      const eventos = buf.split('\n\n').filter((e) => e.startsWith('event: metrics'))
      expect(eventos.length).toBeGreaterThanOrEqual(2) // el inicial y al menos uno del intervalo (50 ms en esta prueba)
      const first = JSON.parse(eventos[0]!.split('\ndata: ')[1]!)
      expect(first.propuestas.pendientes).toBe(1)
      expect(first.porProducto[0].mercados.length).toBe(2)
    } finally {
      controller.abort()
    }
  })
})
