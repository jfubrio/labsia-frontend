import type { PriceObservation, DiscountVerdict, ProductConfig } from '../types.js'
import { buildMarketPriceProfile, type MarketPriceProfile } from './market-price.js'

function pct(from: number, to: number): number {
  return Math.round(((from - to) / from) * 10000) / 100
}

/**
 * Juzga una oferta contra el PRECIO REAL DE MERCADO (engines/market-price.ts), nunca contra el precio de
 * lista, el de lanzamiento ni el "antes" que anuncia la tienda.
 */
export function validateDiscountWithProfile(
  obs: PriceObservation,
  profile: MarketPriceProfile,
  product: ProductConfig,
): DiscountVerdict {
  const ahorroPctAnunciado =
    obs.advertisedPreviousPrice && obs.advertisedPreviousPrice > 0 ? pct(obs.advertisedPreviousPrice, obs.price) : null
  const anclaInflada =
    !!obs.advertisedPreviousPrice && profile.techo !== null && obs.advertisedPreviousPrice > profile.techo * 1.02

  const base: Omit<DiscountVerdict, 'veredicto' | 'razon' | 'ahorroPctReal'> = {
    observationId: obs.id,
    precioReal: profile.precioReal,
    piso: profile.piso,
    techo: profile.techo,
    regimen: profile.regimen,
    confianza: profile.confianza,
    ahorroPctAnunciado,
    anclaInflada,
    lanzamientoInflado: profile.lanzamientoInflado,
    diasCubiertos: profile.diasCubiertos,
    tiendas: profile.tiendas.length,
  }

  if (profile.precioReal === null || profile.piso === null) {
    return {
      ...base,
      ahorroPctReal: null,
      veredicto: 'sin_historial',
      razon: `Sin historial suficiente (${profile.diasObservados} días con observaciones reales). El descuento anunciado no se puede verificar.`,
    }
  }

  const precioReal = profile.precioReal
  const ahorroPctReal = pct(precioReal, obs.price)
  const ancla = anclaInflada
    ? ` El "antes" anunciado (${obs.advertisedPreviousPrice}) supera el peor precio competitivo visto (${profile.techo}): ancla inflada.`
    : ''
  const lanzamiento = profile.lanzamientoInflado ? ' Los precios de lanzamiento quedaron descartados como referencia.' : ''

  if (obs.price <= profile.piso && ahorroPctReal > 0) {
    return {
      ...base,
      ahorroPctReal,
      veredicto: 'minimo_historico',
      razon: `Precio ${obs.price} ${obs.currency} iguala o mejora el mejor precio competitivo de la ventana (${profile.piso}); ahorro de ${ahorroPctReal}% frente al precio real ${precioReal}.${ancla}${lanzamiento}`,
    }
  }

  if (obs.price >= precioReal) {
    return {
      ...base,
      ahorroPctReal,
      veredicto: 'falso',
      razon: `Precio ${obs.price} ${obs.currency} igual o mayor que el precio real de mercado (${precioReal}, régimen ${profile.regimen}).${ancla}${lanzamiento}`,
    }
  }

  if (ahorroPctReal >= product.umbralDescuentoPct) {
    return {
      ...base,
      ahorroPctReal,
      veredicto: 'real',
      razon: `Ahorro real de ${ahorroPctReal}% frente al precio real de mercado (${precioReal}); supera el umbral de ${product.umbralDescuentoPct}%.${ancla}${lanzamiento}`,
    }
  }

  return {
    ...base,
    ahorroPctReal,
    veredicto: 'dudoso',
    razon: `Ahorro real de ${ahorroPctReal}% frente al precio real de mercado (${precioReal}); no alcanza el umbral de ${product.umbralDescuentoPct}%.${ancla}${lanzamiento}`,
  }
}

/** Atajo: construye el perfil de mercado de la observación y la juzga. */
export function validateDiscount(
  obs: PriceObservation,
  history: PriceObservation[],
  product: ProductConfig,
  now: Date = obs.observedAt,
): DiscountVerdict {
  const profile = buildMarketPriceProfile(
    history.filter((h) => h.id !== obs.id),
    { now, market: obs.market, currency: obs.currency },
  )
  return validateDiscountWithProfile(obs, profile, product)
}
