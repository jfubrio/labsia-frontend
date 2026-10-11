import type { RawOffer } from '../types.js'
import type { PriceConnector, ConnectorMeta } from './types.js'

/**
 * Conector que entrega ofertas ya conocidas. Lo usa la ingesta externa (POST /api/v1/caza/observations): una
 * herramienta como changedetection.io, un escenario de Make o una captura manual envían el precio observado y
 * CAZA IA lo procesa con el mismo ciclo de vigilancia (perfil, veredicto, propuesta, alerta).
 */
export const WEBHOOK_META: ConnectorMeta = {
  clave: 'webhook',
  nombre: 'Ingesta externa',
  mercado: 'MX',
  moneda: 'MXN',
  tipo: 'api',
  soportaCompra: false,
  estadoValidacion: 'validado',
  habilitado: true,
}

export class StaticConnector implements PriceConnector {
  readonly meta = WEBHOOK_META
  constructor(private readonly offers: RawOffer[]) {}
  async fetchOffers(): Promise<RawOffer[]> {
    return this.offers
  }
}
