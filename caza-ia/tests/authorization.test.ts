import { describe, it, expect } from 'vitest'
import { validateDiscountWithProfile } from '../src/engines/discount-validator.js'
import { buildMarketPriceProfile } from '../src/engines/market-price.js'
import { proposePurchase, effectiveTargetPrice, decideAuthorization, checkAuthorization } from '../src/engines/authorization.js'
import { defaultComparisonConfig } from '../src/engines/international-comparison.js'
import { loadScenario, product, NOW } from './helpers.js'

const CMP = defaultComparisonConfig(18.5)

async function judged(scenario: Parameters<typeof loadScenario>[0]) {
  const { history, offers } = await loadScenario(scenario)
  const obs = offers[0]!
  // El veredicto se juzga contra el perfil del mercado de la oferta; el objetivo sale siempre del perfil de casa (MX).
  const profile = buildMarketPriceProfile(history, { now: NOW, market: 'MX', currency: 'MXN' })
  const offerProfile = obs.market === 'MX' ? profile : buildMarketPriceProfile(history, { now: NOW, market: obs.market, currency: obs.currency })
  const verdict = validateDiscountWithProfile(obs, offerProfile, product)
  return { obs, profile, offerProfile, verdict, proposal: proposePurchase(obs, verdict, product, profile, CMP) }
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

  it('rechaza derivar el objetivo de un perfil en otra moneda', async () => {
    const { offerProfile } = await judged('oferta_usa_gana')
    expect(offerProfile.currency).toBe('USD')
    expect(() => effectiveTargetPrice(product, offerProfile)).toThrow(/perfil en MXN/)
  })
})

describe('compra en EE. UU. vía buzón en Texas', () => {
  it('propone cuando el precio aterrizado en MXN queda bajo el objetivo', async () => {
    const { proposal, verdict } = await judged('oferta_usa_gana')
    expect(verdict.veredicto).toBe('minimo_historico') // juzgado contra el mercado US
    expect(proposal).not.toBeNull()
    expect(proposal!.moneda).toBe('USD')
    expect(proposal!.precio).toBe(299.99)
    expect(proposal!.buzon).toBe('buzon_tx')
    expect(proposal!.precioAterrizadoBase).toBe(6100.19) // cruce personal, dentro de la franquicia
    expect(proposal!.precioAterrizadoBase).toBeLessThanOrEqual(proposal!.precioObjetivo)
  })

  it('no propone una oferta que aterriza barata pero no es descuento real en su mercado', async () => {
    const { proposal, verdict } = await judged('oferta_usa_dudosa')
    expect(verdict.veredicto).toBe('dudoso')
    expect(proposal).toBeNull()
  })

  it('no propone cuando el aterrizado supera el objetivo aunque el descuento sea real', async () => {
    const { obs, verdict, profile } = await judged('oferta_usa_gana')
    // Sin franquicia disponible y con reenvío por paquetería el mismo 299.99 USD aterriza por encima del objetivo
    const caro = { ...CMP, buzones: { US: { ...CMP.buzones.US!, modoIngreso: 'paqueteria' as const, tarifaReenvio: 80 } } }
    expect(proposePurchase(obs, verdict, product, profile, caro)).toBeNull()
  })

  it('no propone cuando el valor exige agente aduanal', async () => {
    const { obs, verdict, profile } = await judged('oferta_usa_gana')
    expect(proposePurchase({ ...obs, price: 3200 }, { ...verdict }, product, profile, CMP)).toBeNull()
  })

  it('no propone en un mercado donde no se permite comprar', async () => {
    const { obs, verdict, profile } = await judged('oferta_usa_gana')
    expect(proposePurchase(obs, verdict, { ...product, mercadosCompra: ['MX'] }, profile, CMP)).toBeNull()
  })

  it('no propone en el extranjero sin configuración de comparación o sin buzón', async () => {
    const { obs, verdict, profile } = await judged('oferta_usa_gana')
    expect(proposePurchase(obs, verdict, product, profile, null)).toBeNull()
    expect(proposePurchase(obs, verdict, product, profile, { ...CMP, buzones: {} })).toBeNull()
  })

  it('la autorización guarda tope en USD y aterrizado en MXN, y el tope respeta el máximo del producto', async () => {
    const { proposal } = await judged('oferta_usa_gana')
    const { authorization } = decideAuthorization({ proposal: proposal!, decision: 'approve', autorizadoPor: 'op@labsia.mx', product, ttlHours: 24, now: NOW })
    expect(authorization.moneda).toBe('USD')
    expect(authorization.precioMaximo).toBe(299.99)
    expect(authorization.precioAterrizadoBase).toBe(6100.19)
    expect(authorization.buzon).toBe('buzon_tx')
    // Un tope de 420 USD aterriza en ~8,540 MXN, por encima del máximo 8,499
    expect(() =>
      decideAuthorization({ proposal: proposal!, decision: 'approve', autorizadoPor: 'op@labsia.mx', product, ttlHours: 24, now: NOW, precioMaximo: 420 }),
    ).toThrow(/precio máximo/)
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

  it('sin configuración de comparación no propone ofertas fuera de la moneda base', async () => {
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
