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

export interface PurchaseProposal {
  productSlug: string
  observationId: string
  connector: string
  precio: number
  moneda: Currency
  veredicto: DiscountVerdict
  /** Objetivo aplicado: el manual del producto o el derivado del precio real de mercado. */
  precioObjetivo: number
  objetivoDerivado: boolean
  motivo: string
}

/** Objetivo efectivo: el manual si existe; si no, el derivado del análisis de mercado. Nunca sobre el tope. */
export function effectiveTargetPrice(product: ProductConfig, profile: MarketPriceProfile | null): { objetivo: number | null; derivado: boolean } {
  if (product.precioObjetivo !== null) {
    return { objetivo: Math.min(product.precioObjetivo, product.precioMaximo), derivado: false }
  }
  if (!profile) return { objetivo: null, derivado: true }
  return { objetivo: derivedTargetPrice(profile, product.umbralDescuentoPct, product.precioMaximo), derivado: true }
}

/**
 * Una observación se convierte en propuesta solo si:
 *  - el veredicto es 'real' o 'minimo_historico' (juzgado contra el precio real de mercado),
 *  - la confianza del perfil no es 'baja' ni 'sin_historial',
 *  - hay stock,
 *  - el precio no excede el objetivo efectivo ni el tope duro,
 *  - está en la moneda base (las alternativas internacionales se reportan, no se proponen, hasta la fase 4).
 */
export function proposePurchase(
  obs: PriceObservation,
  verdict: DiscountVerdict,
  product: ProductConfig,
  profile: MarketPriceProfile | null = null,
): PurchaseProposal | null {
  if (verdict.veredicto !== 'real' && verdict.veredicto !== 'minimo_historico') return null
  if (verdict.confianza === 'baja' || verdict.confianza === 'sin_historial') return null
  if (!obs.inStock) return null
  if (obs.currency !== product.monedaBase) return null
  const { objetivo, derivado } = effectiveTargetPrice(product, profile)
  if (objetivo === null) return null
  if (obs.price > objetivo || obs.price > product.precioMaximo) return null
  return {
    productSlug: product.slug,
    observationId: obs.id,
    connector: obs.connector,
    precio: obs.price,
    moneda: obs.currency,
    veredicto: verdict,
    precioObjetivo: objetivo,
    objetivoDerivado: derivado,
    motivo: `${verdict.razon} Precio ${obs.price} ${obs.currency} ≤ objetivo ${objetivo}${derivado ? ' (derivado del precio real de mercado)' : ''}.`,
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
  if (tope > input.product.precioMaximo) {
    throw new Error(`CAZA: tope ${tope} excede el precio máximo del producto (${input.product.precioMaximo})`)
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
    payload: { authorizationId: authorization.id, observationId: authorization.observationId, precioMaximo: tope, expiraEn: authorization.expiraEn.toISOString() },
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
