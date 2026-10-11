import { describe, it, expect } from 'vitest'
import { validateDiscount } from '../src/engines/discount-validator.js'
import { proposePurchase, decideAuthorization, checkAuthorization } from '../src/engines/authorization.js'
import { loadScenario, product, NOW } from './helpers.js'

async function realProposal() {
  const { history, offers } = await loadScenario('descuento_real')
  const obs = offers[0]!
  const verdict = validateDiscount(obs, history, product, NOW)
  const proposal = proposePurchase(obs, verdict, product)!
  return { obs, verdict, proposal }
}

describe('proposePurchase', () => {
  it('genera propuesta solo con veredicto real y precio ≤ objetivo', async () => {
    const { proposal } = await realProposal()
    expect(proposal).not.toBeNull()
    expect(proposal.precio).toBe(7899)
  })

  it('no propone con veredicto falso', async () => {
    const { history, offers } = await loadScenario('descuento_falso')
    const v = validateDiscount(offers[0]!, history, product, NOW)
    expect(proposePurchase(offers[0]!, v, product)).toBeNull()
  })

  it('no propone si el precio supera el objetivo aunque el descuento sea real', async () => {
    const { obs, verdict } = await realProposal()
    const caro = { ...obs, price: product.precioObjetivo + 1 }
    expect(proposePurchase(caro, verdict, product)).toBeNull()
  })

  it('no propone ofertas fuera de la moneda base', async () => {
    const { obs, verdict } = await realProposal()
    const us = { ...obs, currency: 'USD' as const, market: 'US' as const }
    expect(proposePurchase(us, verdict, product)).toBeNull()
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
