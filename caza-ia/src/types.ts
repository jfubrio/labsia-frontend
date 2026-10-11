export type Market = 'MX' | 'US'
export type Currency = 'MXN' | 'USD'

export interface ProductConfig {
  slug: string
  nombre: string
  marca: string
  modelo: string
  monedaBase: Currency
  precioReferencia: number | null
  precioObjetivo: number
  precioMaximo: number
  umbralDescuentoPct: number
  mercados: Market[]
  requiereAprobacion: boolean
  vigilanciaActiva: boolean
  intervaloMinutos: number
}

/** Lo que devuelve un conector antes de normalizar. */
export interface RawOffer {
  connector: string
  market: Market
  currency: Currency
  price: number
  advertisedPreviousPrice?: number | null
  inStock: boolean
  url: string
  seller?: string
  observedAt: Date
}

/** Observación normalizada, equivalente a una fila de caza_price_observations. */
export interface PriceObservation extends RawOffer {
  id: string
  productSlug: string
  offerHash: string
}

export type DiscountVerdictKind = 'real' | 'dudoso' | 'falso'

export interface DiscountVerdict {
  observationId: string
  veredicto: DiscountVerdictKind
  mediana30d: number | null
  mediana90d: number | null
  minimo90d: number | null
  ahorroPctReal: number | null
  ahorroPctAnunciado: number | null
  muestras: number
  razon: string
}

export interface LandedPrice {
  observationId: string
  connector: string
  market: Market
  precioLocal: number
  monedaLocal: Currency
  tipoCambio: number
  envio: number
  impuestos: number
  precioAterrizado: number
  monedaBase: Currency
}

export type AuthorizationDecision = 'approve' | 'reject'

export interface PurchaseAuthorization {
  id: string
  productSlug: string
  observationId: string
  decision: AuthorizationDecision
  precioMaximo: number
  moneda: Currency
  autorizadoPor: string
  expiraEn: Date
  consumidoEn: Date | null
  creadoEn: Date
}

export type OrderStatus = 'pending' | 'authorized' | 'placed' | 'cancelled' | 'failed' | 'delivered'

export interface PurchaseOrder {
  id: string
  productSlug: string
  authorizationId: string
  connector: string
  idempotencyKey: string
  status: OrderStatus
  precioFinal: number | null
  moneda: Currency
  creadoEn: Date
}

export interface AuditEvent {
  ocurridoEn: Date
  actor: string
  evento: string
  productSlug?: string
  payload: Record<string, unknown>
}
