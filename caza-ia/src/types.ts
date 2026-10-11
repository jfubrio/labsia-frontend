export type Market = 'MX' | 'US'
export type Currency = 'MXN' | 'USD'

export interface ProductConfig {
  slug: string
  nombre: string
  marca: string
  modelo: string
  monedaBase: Currency
  /**
   * Precio de lista o de lanzamiento, SOLO informativo. Nunca se usa como referencia de descuento:
   * el precio real sale del análisis del comportamiento de la oferta competitiva en el tiempo.
   */
  precioListaInformativo: number | null
  /**
   * Objetivo manual. Si es null, se deriva del precio real de mercado menos el umbral de descuento
   * (ver engines/market-price.ts). Nunca supera precioMaximo.
   */
  precioObjetivo: number | null
  /** Tope duro de seguridad: por encima de esto nunca se autoriza nada. */
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
  /** Tienda que publica la oferta. Si falta, se usa el conector. Permite comparar tiendas por día. */
  store?: string
  seller?: string
  observedAt: Date
}

/** Observación normalizada, equivalente a una fila de caza_price_observations. */
export interface PriceObservation extends RawOffer {
  id: string
  productSlug: string
  offerHash: string
}

/**
 *  minimo_historico: por debajo o igual al mejor precio competitivo visto en la ventana
 *  real:             por debajo del precio real de mercado y el ahorro supera el umbral
 *  dudoso:           por debajo del precio real pero sin alcanzar el umbral
 *  falso:            igual o por encima del precio real, aunque la tienda anuncie descuento
 *  sin_historial:    no hay serie competitiva suficiente para juzgar
 */
export type DiscountVerdictKind = 'minimo_historico' | 'real' | 'dudoso' | 'falso' | 'sin_historial'

export interface DiscountVerdict {
  observationId: string
  veredicto: DiscountVerdictKind
  /** Precio real de mercado contra el que se juzga la oferta. */
  precioReal: number | null
  piso: number | null
  techo: number | null
  regimen: 'bajando' | 'estable' | 'subiendo' | null
  confianza: 'alta' | 'media' | 'baja' | 'sin_historial'
  /** Ahorro frente al precio real de mercado. */
  ahorroPctReal: number | null
  /** Ahorro frente al "antes" que anuncia la tienda. Solo informativo. */
  ahorroPctAnunciado: number | null
  /** true si el "antes" anunciado supera el peor precio competitivo visto: ancla inflada. */
  anclaInflada: boolean
  lanzamientoInflado: boolean
  diasCubiertos: number
  tiendas: number
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
