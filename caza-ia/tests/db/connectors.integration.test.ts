import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createDb, type Db } from '../../src/db/client.js'
import { resetTestState } from './reset.js'
import { getProductBySlug } from '../../src/db/repositories/products.repo.js'
import { buildConnectors } from '../../src/connectors/factory.js'
import { loadEnv } from '../../src/config/env.js'
import { fakeFetch } from '../../src/connectors/http.js'
import { buildApp } from '../../src/api/app.js'
import { defaultComparisonConfig } from '../../src/engines/international-comparison.js'
import { createNotifiers } from '../../src/notify/notifier.js'
import { runWatch } from '../../src/watch/run-watch.js'

/** Fase 0 y 3 sin tiendas reales: estado de conectores desde la DB, credenciales, identificadores e ingesta externa. */
const url = process.env.DATABASE_URL
const d = url ? describe : describe.skip

d('conectores: estado, credenciales, identificadores e ingesta', () => {
  let db: Db
  let app: ReturnType<typeof buildApp>
  const H = { 'x-caza-token': 't', 'content-type': 'application/json' }
  const NOW = new Date('2026-10-11T12:00:00Z')
  const envSin = loadEnv({})
  const envCon = loadEnv({ BESTBUY_API_KEY: 'K' })

  beforeAll(async () => {
    db = createDb(url)
    await resetTestState(db, NOW)
    app = buildApp({ db, apiToken: 't', env: envCon, comparison: defaultComparisonConfig(18.5), notifiers: createNotifiers({ log: () => {} }) })
    await app.ready()
  })
  afterAll(async () => {
    await app.close()
    await db.end()
  })

  it('por defecto solo el mock está activo; los reales reportan por qué no', async () => {
    const product = await getProductBySlug(db, 'sony-wh1000xm6')
    const { connectors, report } = await buildConnectors(db, product, envSin)
    expect(connectors.map((c) => c.meta.clave)).toEqual(['mock'])
    const by = Object.fromEntries(report.map((r) => [r.clave, r.estado]))
    expect(by.bestbuy_us).toBe('no_validado')
    expect(by.amazon_mx).toBe('no_validado')
    expect(by.webhook).toBe('solo_ingesta')
    expect(by.bhphoto_us).toBe('sin_implementacion')
  })

  it('validar un conector por la API lo deja habilitado y auditado; sin credenciales sigue sin activarse', async () => {
    const r = await app.inject({ method: 'PUT', url: '/api/v1/caza/connectors/bestbuy_us', headers: H, payload: { estadoValidacion: 'validado', notas: 'clave de desarrollador aprobada 2026-10-11', habilitado: true, actualizadoPor: 'op@labsia.mx' } })
    expect(r.statusCode).toBe(200)
    expect(r.json().habilitado).toBe(true)
    const product = await getProductBySlug(db, 'sony-wh1000xm6')
    expect(Object.fromEntries((await buildConnectors(db, product, envSin)).report.map((x) => [x.clave, x.estado])).bestbuy_us).toBe('sin_credenciales')
    expect(Object.fromEntries((await buildConnectors(db, product, envCon)).report.map((x) => [x.clave, x.estado])).bestbuy_us).toBe('sin_identificador')
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM caza_audit_log WHERE evento = 'connector.validated'`)
    expect(rows[0].n).toBe(1)
  })

  it('con identificador, credenciales y validación el conector se instancia y consulta la tienda', async () => {
    const r = await app.inject({ method: 'PUT', url: '/api/v1/caza/products/sony-wh1000xm6/identifiers', headers: H, payload: { identificadores: { bestbuy_us: '6505727' }, actualizadoPor: 'op@labsia.mx' } })
    expect(r.statusCode).toBe(200)
    expect(r.json().identificadores.bestbuy_us).toBe('6505727')
    const product = await getProductBySlug(db, 'sony-wh1000xm6')
    const f = fakeFetch({ 'https://api.bestbuy.com/v1/products(sku=6505727)': { body: { products: [{ sku: 6505727, salePrice: 299.99, regularPrice: 449.99, onlineAvailability: true }] } } })
    const { connectors, report } = await buildConnectors(db, product, envCon, f)
    expect(report.find((x) => x.clave === 'bestbuy_us')?.estado).toBe('activo')
    expect(connectors.map((c) => c.meta.clave).sort()).toEqual(['bestbuy_us', 'mock'])
    const result = await runWatch(product, { db, connectors: connectors.filter((c) => c.meta.clave === 'bestbuy_us'), comparison: defaultComparisonConfig(18.5), now: NOW })
    expect(result.observaciones).toBe(1)
    expect(result.veredictos).toBe(1)
    const status = (await app.inject({ method: 'GET', url: '/api/v1/caza/products/sony-wh1000xm6/connectors', headers: H })).json()
    expect(status.identificadores.bestbuy_us).toBe('6505727')
    expect(status.conectores.find((x: { clave: string }) => x.clave === 'bestbuy_us').credenciales).toBe(true)
  })

  it('descartar un conector lo deshabilita aunque se pida habilitado', async () => {
    const r = await app.inject({ method: 'PUT', url: '/api/v1/caza/connectors/bhphoto_us', headers: H, payload: { estadoValidacion: 'descartado', notas: 'términos no permiten acceso automatizado', habilitado: true, actualizadoPor: 'op@labsia.mx' } })
    expect(r.json().habilitado).toBe(false)
    expect((await app.inject({ method: 'PUT', url: '/api/v1/caza/connectors/no_existe', headers: H, payload: { estadoValidacion: 'validado', notas: 'x', actualizadoPor: 'y' } })).statusCode).toBe(404)
  })

  it('la ingesta externa procesa una observación con el ciclo completo y propone si procede', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/v1/caza/observations', headers: H, payload: { productSlug: 'sony-wh1000xm6', store: 'sony_store_mx', market: 'MX', currency: 'MXN', price: 7899, advertisedPreviousPrice: 11999, inStock: true, url: 'https://www.sony.com.mx/x', observedAt: NOW.toISOString() } })
    expect(r.statusCode).toBe(201)
    expect(r.json().observaciones).toBe(1)
    expect(r.json().veredictos).toBe(1)
    expect(r.json().perfil.precioReal).toBe(8999)
    // La prueba anterior dejó una propuesta pendiente (Best Buy); una sola pendiente por producto.
    const { rows: pend } = await db.query(`SELECT count(*)::int AS n FROM caza_purchase_proposals WHERE estado = 'pendiente'`)
    expect(pend[0].n).toBe(1)
    const { rows } = await db.query(`SELECT o.tienda, c.clave FROM caza_price_observations o JOIN caza_connectors c ON c.id = o.connector_id WHERE o.url = 'https://www.sony.com.mx/x'`)
    expect(rows[0].clave).toBe('webhook')
    expect((await app.inject({ method: 'POST', url: '/api/v1/caza/observations', headers: H, payload: { productSlug: 'sony-wh1000xm6', store: 'x', market: 'MX', currency: 'MXN', price: -1, url: 'https://x' } })).statusCode).toBe(400)
    expect((await app.inject({ method: 'POST', url: '/api/v1/caza/observations', headers: H, payload: { productSlug: 'nope', store: 'x', market: 'MX', currency: 'MXN', price: 1, url: 'https://x' } })).statusCode).toBe(404)
  })
})
