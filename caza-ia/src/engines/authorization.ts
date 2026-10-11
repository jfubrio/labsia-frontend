import { randomUUID } from 'node:crypto'
import type {
  PriceObservation,
  DiscountVerdict,
  ProductConfig,
  PurchaseAuthorization,
  AuthorizationDecision,
  AuditEvent,
  Currency,
} from '../types.js'
import type { MarketPriceProfile } from './market-price.js'
import { derivedTargetPrice } from './market-price.js'
import { landedPrice, type ComparisonConfig } from './international-comparison.js'

export interface PurchaseProposal {
  productSlug: string
  observationId: string
  connector: string
  precio: number
  moneda: Currency
  veredicto: DiscountVerdict
  /** Objetivo aplicado, en moneda base: el manual del producto o el derivado del precio real de mercado. */
  precioObjetivo: number
  objetivoDerivado: boolean
  /** Precio aterrizado en moneda base. Igual al precio para ofertas locales. */
  precioAterrizadoBase: number
  monedaBase: Currency
  /** Buzón de recepción para compras en el extranjero; null si es compra local. */
  buzon: string | null
  motivo: string
}

/**
 * Objetivo efectivo, SIEMPRE en moneda base: el manual si existe; si no, el derivado del perfil de precio real del
 * mercado de casa. Nunca sobre el tope. Un perfil de otro mercado o moneda no sirve para derivar el objetivo: lo que
 * se compara después es el precio aterrizado en casa.
 */
export function effectiveTargetPrice(product: ProductConfig, homeProfile: MarketPriceProfile | null): { objetivo: number | null; derivado: boolean } {
  if (product.precioObjetivo !== null) {
    return { objetivo: Math.min(product.precioObjetivo, product.precioMaximo), derivado: false }
  }
  if (!homeProfile) return { objetivo: null, derivado: true }
  if (homeProfile.currency !== product.monedaBase) {
    throw new Error(`CAZA: el objetivo se deriva del perfil en ${product.monedaBase}; se recibió un perfil en ${homeProfile.currency} (${homeProfile.market})`)
  }
  return { objetivo: derivedTargetPrice(homeProfile, product.umbralDescuentoPct, product.precioMaximo), derivado: true }
}

/**
 * Una observación se convierte en propuesta solo si:
 *  - el veredicto es 'real' o 'minimo_historico', juzgado contra el precio real de SU mercado,
 *  - la confianza del perfil no es 'baja' ni 'sin_historial',
 *  - hay stock,
 *  - el mercado está en `mercadosCompra` y, si es extranjero, existe buzón y reglas de importación,
 *  - su PRECIO ATERRIZADO en moneda base no excede el objetivo efectivo ni el tope duro.
 *
 * El objetivo y el tope se expresan en moneda base; por eso una oferta en EE. UU. compite por lo que costaría
 * ya en casa (impuesto de venta, importación, reenvío), no por su etiqueta en dólares.
 */
export function proposePurchase(
  obs: PriceObservation,
  verdict: DiscountVerdict,
  product: ProductConfig,
  /** Perfil del mercado de CASA (moneda base): de aquí sale el objetivo. El veredicto ya se juzgó contra el perfil del mercado de la oferta. */
  homeProfile: MarketPriceProfile | null = null,
  comparison: ComparisonConfig | null = null,
): PurchaseProposal | null {
  if (verdict.veredicto !== 'real' && verdict.veredicto !== 'minimo_historico') return null
  if (verdict.confianza === 'baja' || verdict.confianza === 'sin_historial') return null
  if (!obs.inStock) return null
  if (!product.mercadosCompra.includes(obs.market)) return null

  let precioAterrizadoBase = obs.price
  let buzon: string | null = null
  if (obs.currency !== product.monedaBase) {
    if (!comparison) return null
    if (!comparison.buzones[obs.market]) return null
    const landed = landedPrice(obs, comparison)
    if (landed.requiereAgenteAduanal) return null
    precioAterrizadoBase = landed.precioAterrizado
    buzon = landed.buzon
  }

  const { objetivo, derivado } = effectiveTargetPrice(product, homeProfile)
  if (objetivo === null) return null
  if (precioAterrizadoBase > objetivo || precioAterrizadoBase > product.precioMaximo) return null
  const viaBuzon = buzon ? ` Precio aterrizado vía ${buzon}: ${precioAterrizadoBase} ${product.monedaBase}.` : ''
  return {
    productSlug: product.slug,
    observationId: obs.id,
    connector: obs.connector,
    precio: obs.price,
    moneda: obs.currency,
    veredicto: verdict,
    precioObjetivo: objetivo,
    objetivoDerivado: derivado,
    precioAterrizadoBase,
    monedaBase: product.monedaBase,
    buzon,
    motivo: `${verdict.razon}${viaBuzon} ${precioAterrizadoBase} ${product.monedaBase} ≤ objetivo ${objetivo}${derivado ? ' (derivado del precio real de mercado)' : ''}.`,
  }
}

export interface DecideInput {
  proposal: PurchaseProposal
  decision: AuthorizationDecision
  autorizadoPor: string
  product: ProductConfig
  ttlHours: number
  now?: Date
  /** Tope autorizado; por defecto el precio de la propuesta. Nunca puede superar product.precioMaximo. */
  precioMaximo?: number
}

/** Registra la decisión del operador. Un 'approve' vale para UNA observación, con tope y vigencia. */
export function decideAuthorization(input: DecideInput): { authorization: PurchaseAuthorization; audit: AuditEvent } {
  const now = input.now ?? new Date()
  if (!input.autorizadoPor.trim()) throw new Error('CAZA: la autorización requiere la identidad del operador')
  const tope = input.precioMaximo ?? input.proposal.precio
  // El tope del producto está en moneda base: para una oferta extranjera se compara el precio aterrizado.
  const topeEnBase = input.proposal.buzon ? input.proposal.precioAterrizadoBase * (tope / input.proposal.precio) : tope
  if (topeEnBase > input.product.precioMaximo) {
    throw new Error(`CAZA: tope ${tope} ${input.proposal.moneda} (≈ ${Math.round(topeEnBase)} ${input.product.monedaBase} aterrizado) excede el precio máximo del producto (${input.product.precioMaximo})`)
  }
  if (input.decision === 'approve' && input.proposal.precio > tope) {
    throw new Error(`CAZA: no se puede aprobar: precio ${input.proposal.precio} > tope ${tope}`)
  }
  const authorization: PurchaseAuthorization = {
    id: randomUUID(),
    productSlug: input.proposal.productSlug,
    observationId: input.proposal.observationId,
    decision: input.decision,
    precioMaximo: tope,
    moneda: input.proposal.moneda,
    precioAterrizadoBase: input.proposal.buzon ? input.proposal.precioAterrizadoBase : null,
    buzon: input.proposal.buzon,
    autorizadoPor: input.autorizadoPor,
    expiraEn: new Date(now.getTime() + input.ttlHours * 3_600_000),
    consumidoEn: null,
    creadoEn: now,
  }
  const audit: AuditEvent = {
    ocurridoEn: now,
    actor: input.autorizadoPor,
    evento: `authorization.${input.decision}`,
    productSlug: authorization.productSlug,
    payload: { authorizationId: authorization.id, observationId: authorization.observationId, precioMaximo: tope, moneda: authorization.moneda, precioAterrizadoBase: authorization.precioAterrizadoBase, buzon: authorization.buzon, expiraEn: authorization.expiraEn.toISOString() },
  }
  return { authorization, audit }
}

export type AuthorizationCheck = { ok: true } | { ok: false; razon: string }

/** Verifica que una autorización habilite comprar ESTA observación, ahora, a este precio. */
export function checkAuthorization(
  auth: PurchaseAuthorization,
  obs: PriceObservation,
  precioFinal: number,
  now: Date = new Date(),
): AuthorizationCheck {
  if (auth.decision !== 'approve') return { ok: false, razon: 'La autorización no es approve' }
  if (auth.observationId !== obs.id) return { ok: false, razon: 'La autorización es para otra oferta' }
  if (auth.productSlug !== obs.productSlug) return { ok: false, razon: 'La autorización es para otro producto' }
  if (auth.consumidoEn) return { ok: false, razon: 'La autorización ya fue consumida' }
  if (auth.expiraEn.getTime() <= now.getTime()) return { ok: false, razon: 'La autorización expiró' }
  if (precioFinal > auth.precioMaximo) return { ok: false, razon: `Precio ${precioFinal} excede el tope autorizado ${auth.precioMaximo}` }
  return { ok: true }
}
