import { describe, it, expect } from 'vitest'
import { validateDiscountWithProfile } from '../src/engines/discount-validator.js'
import { buildMarketPriceProfile } from '../src/engines/market-price.js'
import { proposePurchase, effectiveTargetPrice, decideAuthorization, checkAuthorization } from '../src/engines/authorization.js'
import { loadScenario, product, NOW } from './helpers.js'

async function judged(scenario: Parameters<typeof loadScenario>[0]) {
  const { history, offers } = await loadScenario(scenario)
  const obs = offers[0]!
  const profile = buildMarketPriceProfile(history, { now: NOW, market: 'MX', currency: 'MXN' })
  const verdict = validateDiscountWithProfile(obs, profile, product)
  return { obs, profile, verdict, proposal: proposePurchase(obs, verdict, product, profile) }
}

async function realProposal() {
  const r = await judged('descuento_real')
  return { ...r, proposal: r.proposal! }
}

describe('objetivo efectivo', () => {
  it('sin objetivo manual se deriva del precio real de mercado', async () => {
    const { profile } = await judged('descuento_real')
    expect(product.precioObjetivo).toBeNull()
    expect(effectiveTargetPrice(product, profile)).toEqual({ objetivo: 7919.12, derivado: true })
  })

  it('un objetivo manual se respeta pero nunca supera el tope', async () => {
    const { profile } = await judged('descuento_real')
    expect(effectiveTargetPrice({ ...product, precioObjetivo: 7000 }, profile)).toEqual({ objetivo: 7000, derivado: false })
    expect(effectiveTargetPrice({ ...product, precioObjetivo: 9000 }, profile)).toEqual({ objetivo: 8499, derivado: false })
  })

  it('sin perfil ni objetivo manual no hay objetivo', () => {
    expect(effectiveTargetPrice(product, null)).toEqual({ objetivo: null, derivado: true })
  })
})

describe('proposePurchase', () => {
  it('propone con veredicto real y precio ≤ objetivo derivado', async () => {
    const { proposal } = await realProposal()
    expect(proposal.precio).toBe(7899)
    expect(proposal.precioObjetivo).toBe(7919.12)
    expect(proposal.objetivoDerivado).toBe(true)
  })

  it('propone en mínimo histórico', async () => {
    const { proposal } = await judged('minimo_historico')
    expect(proposal?.precio).toBe(5933)
  })

  it('no propone con veredicto falso ni con el ancla de lanzamiento', async () => {
    expect((await judged('descuento_falso')).proposal).toBeNull()
    expect((await judged('ancla_lanzamiento')).proposal).toBeNull()
  })

  it('no propone si el precio supera el objetivo aunque el descuento sea real', async () => {
    const { obs, verdict, profile } = await realProposal()
    expect(proposePurchase({ ...obs, price: 7920 }, verdict, product, profile)).toBeNull()
  })

  it('no propone una oferta sin stock aunque el veredicto sea real', async () => {
    const { obs, verdict, proposal } = await judged('tienda_sin_stock')
    expect(obs.inStock).toBe(false)
    expect(verdict.veredicto).toBe('real') // el precio sí es bueno: 7,899 contra el precio real 8,999
    expect(verdict.ahorroPctReal).toBeGreaterThanOrEqual(product.umbralDescuentoPct)
    expect(verdict.confianza).toBe('alta')
    expect(proposal).toBeNull() // pero no se puede comprar, así que no hay nada que proponer
  })

  it('no propone con confianza baja', async () => {
    const { obs, verdict, profile } = await realProposal()
    expect(proposePurchase(obs, { ...verdict, confianza: 'baja' }, product, profile)).toBeNull()
  })

  it('no propone ofertas fuera de la moneda base', async () => {
    const { obs, verdict, profile } = await realProposal()
    const us = { ...obs, currency: 'USD' as const, market: 'US' as const }
    expect(proposePurchase(us, verdict, product, profile)).toBeNull()
  })
})

describe('decideAuthorization / checkAuthorization', () => {
  it('approve queda vinculado a la observación, con tope y vigencia', async () => {
    const { obs, proposal } = await realProposal()
    const { authorization, audit } = decideAuthorization({ proposal, decision: 'approve', autorizadoPor: 'op@labsia.mx', product, ttlHours: 24, now: NOW })
    expect(authorization.observationId).toBe(obs.id)
    expect(authorization.precioMaximo).toBe(7899)
    expect(authorization.expiraEn.getTime()).toBe(NOW.getTime() + 24 * 3_600_000)
    expect(audit.evento).toBe('authorization.approve')
    expect(checkAuthorization(authorization, obs, 7899, NOW)).toEqual({ ok: true })
  })

  it('reject nunca habilita', async () => {
    const { obs, proposal } = await realProposal()
    const { authorization } = decideAuthorization({ proposal, decision: 'reject', autorizadoPor: 'op@labsia.mx', product, ttlHours: 24, now: NOW })
    expect(checkAuthorization(authorization, obs, 7899, NOW).ok).toBe(false)
  })

  it('rechaza un tope por encima del precio máximo del producto', async () => {
    const { proposal } = await realProposal()
    expect(() =>
      decideAuthorization({ proposal, decision: 'approve', autorizadoPor: 'op@labsia.mx', product, ttlHours: 24, now: NOW, precioMaximo: product.precioMaximo + 1 }),
    ).toThrow(/precio máximo/)
  })

  it('exige identidad del operador', async () => {
    const { proposal } = await realProposal()
    expect(() => decideAuthorization({ proposal, decision: 'approve', autorizadoPor: '  ', product, ttlHours: 24, now: NOW })).toThrow(/identidad/)
  })

  it('no habilita otra oferta, un precio mayor al tope, ni tras expirar o consumirse', async () => {
    const { obs, proposal } = await realProposal()
    const { authorization } = decideAuthorization({ proposal, decision: 'approve', autorizadoPor: 'op@labsia.mx', product, ttlHours: 1, now: NOW })
    expect(checkAuthorization(authorization, { ...obs, id: 'otra' }, 7899, NOW).ok).toBe(false)
    expect(checkAuthorization(authorization, obs, 7900, NOW).ok).toBe(false)
    expect(checkAuthorization(authorization, obs, 7899, new Date(NOW.getTime() + 3_600_000)).ok).toBe(false)
    expect(checkAuthorization({ ...authorization, consumidoEn: NOW }, obs, 7899, NOW).ok).toBe(false)
  })
})
