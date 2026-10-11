import type { PriceObservation, LandedPrice, Market, Currency } from '../types.js'

export interface MarketAssumptions {
  /** Envío estimado al destino, en moneda base. */
  envioMonedaBase: number
  /** Impuestos y aranceles de importación, como fracción del valor convertido (0.15 = 15 %). */
  impuestosPct: number
}

export interface ComparisonConfig {
  monedaBase: Currency
  /** Tipos de cambio a moneda base: cuántas unidades de moneda base vale 1 unidad de la clave. */
  rates: Partial<Record<Currency, number>>
  /** Supuestos por mercado de origen. El mercado local no paga envío ni impuestos de importación. */
  assumptions: Partial<Record<Market, MarketAssumptions>>
  mercadoLocal: Market
}

/** Supuestos por defecto (fase 1). Confirmar en "Decisiones pendientes" del plan. */
export const defaultComparisonConfig = (usdMxn: number): ComparisonConfig => ({
  monedaBase: 'MXN',
  mercadoLocal: 'MX',
  rates: { MXN: 1, USD: usdMxn },
  assumptions: {
    US: { envioMonedaBase: 650, impuestosPct: 0.15 },
  },
})

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function landedPrice(obs: PriceObservation, cfg: ComparisonConfig): LandedPrice {
  const rate = cfg.rates[obs.currency]
  if (!rate) throw new Error(`CAZA: sin tipo de cambio para ${obs.currency}`)
  const convertido = obs.price * rate
  const isLocal = obs.market === cfg.mercadoLocal
  const a = isLocal ? { envioMonedaBase: 0, impuestosPct: 0 } : cfg.assumptions[obs.market]
  if (!a) throw new Error(`CAZA: sin supuestos de importación para el mercado ${obs.market}`)
  const impuestos = round2(convertido * a.impuestosPct)
  return {
    observationId: obs.id,
    connector: obs.connector,
    market: obs.market,
    precioLocal: obs.price,
    monedaLocal: obs.currency,
    tipoCambio: rate,
    envio: a.envioMonedaBase,
    impuestos,
    precioAterrizado: round2(convertido + impuestos + a.envioMonedaBase),
    monedaBase: cfg.monedaBase,
  }
}

export interface ComparisonResult {
  ranking: LandedPrice[]
  mejorLocal: LandedPrice | null
  /** Ofertas extranjeras cuyo precio aterrizado es menor al mejor precio local. */
  alternativasInternacionales: LandedPrice[]
}

/** Ordena todas las ofertas en stock por precio aterrizado y señala alternativas internacionales que ganan al mejor precio local. */
export function compareInternational(offers: PriceObservation[], cfg: ComparisonConfig): ComparisonResult {
  const ranking = offers
    .filter((o) => o.inStock)
    .map((o) => landedPrice(o, cfg))
    .sort((a, b) => a.precioAterrizado - b.precioAterrizado)
  const mejorLocal = ranking.find((r) => r.market === cfg.mercadoLocal) ?? null
  const alternativasInternacionales = ranking.filter(
    (r) => r.market !== cfg.mercadoLocal && (mejorLocal === null || r.precioAterrizado < mejorLocal.precioAterrizado),
  )
  return { ranking, mejorLocal, alternativasInternacionales }
}
