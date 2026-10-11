import type { PriceObservation, DiscountVerdict, ProductConfig } from '../types.js'

export const MIN_SAMPLES_FOR_VERDICT = 5

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

function pct(from: number, to: number): number {
  return Math.round(((from - to) / from) * 10000) / 100
}

/**
 * Decide si un descuento es real. Nunca confía en el "precio anterior" anunciado:
 * compara contra la mediana de 30 y 90 días del historial propio, en la misma moneda.
 *
 *  - real:   precio < mediana 90d  y ahorro vs 90d >= umbral del producto
 *  - dudoso: historial insuficiente, o precio < mediana 30d pero el ahorro vs 90d no llega al umbral
 *  - falso:  precio >= mediana 90d (aunque la tienda anuncie descuento)
 */
export function validateDiscount(
  obs: PriceObservation,
  history: PriceObservation[],
  product: ProductConfig,
  now: Date = obs.observedAt,
): DiscountVerdict {
  const sameCurrency = history.filter(
    (h) => h.currency === obs.currency && h.market === obs.market && h.inStock && h.id !== obs.id,
  )
  const dayMs = 86_400_000
  const within = (days: number) => sameCurrency.filter((h) => now.getTime() - h.observedAt.getTime() <= days * dayMs)
  const h30 = within(30).map((h) => h.price)
  const h90 = within(90).map((h) => h.price)

  const mediana30d = median(h30)
  const mediana90d = median(h90)
  const minimo90d = h90.length ? Math.min(...h90) : null
  const ahorroPctAnunciado =
    obs.advertisedPreviousPrice && obs.advertisedPreviousPrice > 0 ? pct(obs.advertisedPreviousPrice, obs.price) : null

  const base: Omit<DiscountVerdict, 'veredicto' | 'razon' | 'ahorroPctReal'> = {
    observationId: obs.id,
    mediana30d,
    mediana90d,
    minimo90d,
    ahorroPctAnunciado,
    muestras: h90.length,
  }

  if (mediana90d === null || h90.length < MIN_SAMPLES_FOR_VERDICT) {
    return {
      ...base,
      ahorroPctReal: null,
      veredicto: 'dudoso',
      razon: `Historial insuficiente (${h90.length} muestras, mínimo ${MIN_SAMPLES_FOR_VERDICT}). El descuento anunciado no se puede verificar.`,
    }
  }

  const ahorroPctReal = pct(mediana90d, obs.price)

  if (obs.price >= mediana90d) {
    return {
      ...base,
      ahorroPctReal,
      veredicto: 'falso',
      razon: `Precio ${obs.price} ${obs.currency} igual o mayor que la mediana de 90 días (${mediana90d}). El "antes" anunciado no refleja el precio habitual.`,
    }
  }

  if (ahorroPctReal >= product.umbralDescuentoPct) {
    return {
      ...base,
      ahorroPctReal,
      veredicto: 'real',
      razon: `Ahorro real de ${ahorroPctReal}% frente a la mediana de 90 días (${mediana90d}); supera el umbral de ${product.umbralDescuentoPct}%.`,
    }
  }

  return {
    ...base,
    ahorroPctReal,
    veredicto: 'dudoso',
    razon: `Ahorro real de ${ahorroPctReal}% frente a la mediana de 90 días (${mediana90d}); no alcanza el umbral de ${product.umbralDescuentoPct}%.`,
  }
}
