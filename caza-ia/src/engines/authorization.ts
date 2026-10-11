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

export interface PurchaseProposal {
  productSlug: string
  observationId: string
  connector: string
  precio: number
  moneda: Currency
  veredicto: DiscountVerdict
  motivo: string
}

/**
 * Una observación se convierte en propuesta solo si:
 *  - el veredicto es 'real',
 *  - hay stock,
 *  - el precio no excede el precio objetivo del producto,
 *  - está en la moneda base (las alternativas internacionales se reportan, no se proponen, hasta la fase 4).
 */
export function proposePurchase(
  obs: PriceObservation,
  verdict: DiscountVerdict,
  product: ProductConfig,
): PurchaseProposal | null {
  if (verdict.veredicto !== 'real') return null
  if (!obs.inStock) return null
  if (obs.currency !== product.monedaBase) return null
  if (obs.price > product.precioObjetivo) return null
  return {
    productSlug: product.slug,
    observationId: obs.id,
    connector: obs.connector,
    precio: obs.price,
    moneda: obs.currency,
    veredicto: verdict,
    motivo: `${verdict.razon} Precio ${obs.price} ${obs.currency} ≤ objetivo ${product.precioObjetivo}.`,
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
