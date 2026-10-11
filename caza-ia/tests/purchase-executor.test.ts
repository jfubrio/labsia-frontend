import { describe, it, expect } from 'vitest'
import { loadEnv } from '../src/config/env.js'
import { validateDiscountWithProfile } from '../src/engines/discount-validator.js'
import { buildMarketPriceProfile } from '../src/engines/market-price.js'
import { proposePurchase, decideAuthorization } from '../src/engines/authorization.js'
import { executePurchase, InMemoryOrderStore, idempotencyKey } from '../src/engines/purchase-executor.js'
import { loadScenario, product, NOW } from './helpers.js'

async function approved() {
  const { history, offers } = await loadScenario('descuento_real')
  const obs = offers[0]!
  const profile = buildMarketPriceProfile(history, { now: NOW, market: 'MX', currency: 'MXN' })
  const verdict = validateDiscountWithProfile(obs, profile, product)
  const proposal = proposePurchase(obs, verdict, product, profile)!
  const { authorization } = decideAuthorization({ proposal, decision: 'approve', autorizadoPor: 'op@labsia.mx', product, ttlHours: 24, now: NOW })
  return { obs, authorization }
}

describe('interruptor de compras', () => {
  it('fase 1 por defecto: PURCHASES_ENABLED=false y ninguna orden se crea', async () => {
    const env = loadEnv({})
    expect(env.PURCHASES_ENABLED).toBe(false)
    expect(env.CAZA_PHASE).toBe(1)
    const { obs, authorization } = await approved()
    const store = new InMemoryOrderStore()
    const r = executePurchase(env, store, authorization, obs, obs.price, NOW)
    expect(r.status).toBe('disabled')
    expect(store.all()).toHaveLength(0)
    expect(authorization.consumidoEn).toBeNull()
  })

  it('PURCHASES_ENABLED=true antes de la fase 6 es un error de configuración', () => {
    expect(() => loadEnv({ PURCHASES_ENABLED: 'true', CAZA_PHASE: '1' })).toThrow(/fase 1/)
    expect(() => loadEnv({ PURCHASES_ENABLED: 'true', CAZA_PHASE: '5' })).toThrow(/fase 5/)
  })
})

describe('prevención de compras duplicadas (simulando fase 6 habilitada)', () => {
  const env6 = loadEnv({ PURCHASES_ENABLED: 'true', CAZA_PHASE: '6' })

  it('crea una orden y consume la autorización', async () => {
    const { obs, authorization } = await approved()
    const store = new InMemoryOrderStore()
    const r = executePurchase(env6, store, authorization, obs, obs.price, NOW)
    expect(r.status).toBe('created')
    expect(authorization.consumidoEn).toEqual(NOW)
    expect(store.all()).toHaveLength(1)
  })

  it('repetir el intento devuelve la misma orden (idempotencia)', async () => {
    const { obs, authorization } = await approved()
    const store = new InMemoryOrderStore()
    const a = executePurchase(env6, store, authorization, obs, obs.price, NOW)
    const b = executePurchase(env6, store, authorization, obs, obs.price, NOW)
    expect(a.status).toBe('created')
    expect(b.status).toBe('duplicate')
    if (a.status === 'created' && b.status === 'duplicate') expect(b.order.id).toBe(a.order.id)
    expect(store.all()).toHaveLength(1)
    expect(idempotencyKey(product.slug, authorization.id)).toBe(store.all()[0]!.idempotencyKey)
  })

  it('una segunda autorización para el mismo producto no crea una segunda orden activa', async () => {
    const first = await approved()
    const second = await approved() // nueva observación y nueva autorización
    const store = new InMemoryOrderStore()
    const a = executePurchase(env6, store, first.authorization, first.obs, first.obs.price, NOW)
    const b = executePurchase(env6, store, second.authorization, second.obs, second.obs.price, NOW)
    expect(a.status).toBe('created')
    expect(b.status).toBe('duplicate')
    expect(store.all()).toHaveLength(1)
    expect(second.authorization.consumidoEn).toBeNull()
  })

  it('rechaza precio final por encima del tope autorizado', async () => {
    const { obs, authorization } = await approved()
    const store = new InMemoryOrderStore()
    const r = executePurchase(env6, store, authorization, obs, authorization.precioMaximo + 1, NOW)
    expect(r.status).toBe('rejected')
    expect(store.all()).toHaveLength(0)
  })

  it('rechaza un conector no validado', async () => {
    const { obs, authorization } = await approved()
    const store = new InMemoryOrderStore()
    const r = executePurchase(env6, store, authorization, { ...obs, connector: 'amazon_mx' }, obs.price, NOW)
    expect(r.status).toBe('rejected')
    if (r.status === 'rejected') expect(r.razon).toMatch(/no validado/)
  })
})
