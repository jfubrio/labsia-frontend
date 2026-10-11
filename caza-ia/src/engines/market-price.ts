import type { PriceObservation, Market, Currency } from '../types.js'

/**
 * MOTOR CENTRAL: precio real de mercado.
 *
 * El precio real de un producto NO es su precio de lista, ni el de lanzamiento, ni el "antes" que anuncia
 * una tienda. Es el precio al que de verdad se ha podido comprar, en la tienda más competitiva, a lo largo
 * del tiempo. Por eso:
 *
 *  1. Se toman todas las observaciones en stock de todas las tiendas del mismo mercado y moneda.
 *  2. Por cada día se toma el MÍNIMO entre tiendas: el precio competitivo del día. Una tienda que se queda
 *     en precio alto (p. ej. la tienda oficial a precio de lanzamiento) no mueve el precio real.
 *  3. Sobre esa serie diaria se calcula una mediana ponderada por recencia (vida media configurable), de modo
 *     que los primeros meses de un modelo nuevo, cuando el precio aún no se ha asentado, pesan poco.
 *  4. Se detecta el régimen (bajando / estable / subiendo). Si el precio viene bajando, el precio real se
 *     acota por la mediana reciente: lo que importa es a cuánto se consigue hoy, no el promedio histórico.
 *  5. Se detecta explícitamente un lanzamiento inflado: precios iniciales muy por encima del precio real
 *     seguidos de una caída sostenida. Esos precios no son referencia válida para ningún descuento.
 *  6. Se entrega una confianza según días cubiertos y número de tiendas. Sin historial suficiente no hay
 *     precio real y ningún descuento se puede dar por bueno.
 */

export interface MarketPriceOptions {
  now: Date
  market: Market
  currency: Currency
  /** Ventana total de análisis. */
  windowDays?: number
  /** Ventana "reciente" para mediana reciente y tendencia. */
  recentDays?: number
  /** Vida media del peso por recencia, en días. */
  halfLifeDays?: number
  /** Días que el último precio conocido de una tienda sigue contando como vigente. */
  maxStaleDays?: number
}

export interface DailyCompetitivePrice {
  day: string // YYYY-MM-DD
  ageDays: number
  /** Mínimo entre los precios vigentes de todas las tiendas ese día. */
  precioMinimo: number
  tienda: string
  /** Tiendas con precio vigente (en stock y no caducado) ese día. */
  tiendasObservadas: number
}

export type Regimen = 'bajando' | 'estable' | 'subiendo'
export type Confianza = 'alta' | 'media' | 'baja' | 'sin_historial'

export interface MarketPriceProfile {
  market: Market
  currency: Currency
  calculadoEn: Date
  ventanaDias: number
  serie: DailyCompetitivePrice[]
  /** Días de la serie competitiva (incluye precios vigentes arrastrados). */
  diasCubiertos: number
  /** Días con observaciones reales en stock. La confianza se mide con esto, no con los arrastrados. */
  diasObservados: number
  muestras: number
  tiendas: string[]
  /** Precio real de mercado: a cuánto se consigue de verdad. null sin historial. */
  precioReal: number | null
  /** Mediana ponderada por recencia de la serie competitiva (antes de acotar por régimen). */
  medianaPonderada: number | null
  medianaReciente: number | null
  medianaAnterior: number | null
  /** Mejor precio competitivo visto en la ventana. */
  piso: number | null
  /** Peor precio competitivo visto en la ventana (techo de la serie de mínimos). */
  techo: number | null
  tendenciaPct: number | null
  regimen: Regimen | null
  /** true si los primeros precios estaban muy por encima del precio real y luego cayeron de forma sostenida. */
  lanzamientoInflado: boolean
  confianza: Confianza
  notas: string[]
}

const DAY_MS = 86_400_000

export const MARKET_PRICE_DEFAULTS = {
  windowDays: 90,
  recentDays: 30,
  halfLifeDays: 21,
  maxStaleDays: 7,
  minDaysForProfile: 5,
  trendThresholdPct: 5,
  launchInflationPct: 15,
} as const

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/** Mediana ponderada: el valor donde el peso acumulado cruza la mitad del total. */
export function weightedMedian(values: number[], weights: number[]): number | null {
  if (values.length === 0 || values.length !== weights.length) return null
  const pairs = values.map((v, i) => ({ v, w: weights[i]! })).sort((a, b) => a.v - b.v)
  const total = pairs.reduce((s, p) => s + p.w, 0)
  if (total <= 0) return null
  let acc = 0
  for (const p of pairs) {
    acc += p.w
    if (acc >= total / 2) return p.v
  }
  return pairs[pairs.length - 1]!.v
}

/**
 * Serie diaria del precio competitivo.
 *
 * Las tiendas no se muestrean el mismo día ni con la misma frecuencia. Para no confundir "hoy solo vimos la
 * tienda cara" con "hoy el precio subió", cada tienda conserva su último precio conocido como VIGENTE durante
 * `maxStaleDays` días (o hasta que se la vea sin stock). El precio competitivo de un día es el mínimo entre los
 * precios vigentes de todas las tiendas ese día.
 */
export function dailyCompetitiveSeries(observations: PriceObservation[], opts: MarketPriceOptions): DailyCompetitivePrice[] {
  const windowDays = opts.windowDays ?? MARKET_PRICE_DEFAULTS.windowDays
  const maxStale = opts.maxStaleDays ?? MARKET_PRICE_DEFAULTS.maxStaleDays
  const nowDay = Math.floor(opts.now.getTime() / DAY_MS)

  // Última observación por tienda y día (en ventana, mismo mercado y moneda), con o sin stock.
  const byStoreDay = new Map<string, Map<number, { price: number; inStock: boolean }>>()
  let oldestDay = nowDay
  for (const o of observations) {
    if (o.market !== opts.market || o.currency !== opts.currency) continue
    const obsDay = Math.floor(o.observedAt.getTime() / DAY_MS)
    const age = nowDay - obsDay
    if (age < 0 || age > windowDays) continue
    const tienda = o.store ?? o.connector
    const days = byStoreDay.get(tienda) ?? new Map()
    const cur = days.get(obsDay)
    // Dentro del mismo día, la observación más barata en stock manda; sin stock solo si no hay otra.
    if (!cur || (o.inStock && (!cur.inStock || o.price < cur.price))) days.set(obsDay, { price: o.price, inStock: o.inStock })
    byStoreDay.set(tienda, days)
    if (obsDay < oldestDay) oldestDay = obsDay
  }
  if (byStoreDay.size === 0) return []

  const perStore = [...byStoreDay.entries()].map(([tienda, days]) => ({
    tienda,
    points: [...days.entries()].sort((a, b) => a[0] - b[0]),
  }))

  const serie: DailyCompetitivePrice[] = []
  for (let day = oldestDay; day <= nowDay; day++) {
    let min: number | null = null
    let tiendaMin = ''
    let vigentes = 0
    for (const { tienda, points } of perStore) {
      // Último punto de la tienda en o antes de este día, dentro del límite de vigencia.
      let last: { day: number; price: number; inStock: boolean } | null = null
      for (const [d, v] of points) {
        if (d > day) break
        last = { day: d, ...v }
      }
      if (!last || !last.inStock || day - last.day > maxStale) continue
      vigentes++
      if (min === null || last.price < min) {
        min = last.price
        tiendaMin = tienda
      }
    }
    if (min === null) continue
    serie.push({
      day: new Date(day * DAY_MS).toISOString().slice(0, 10),
      ageDays: nowDay - day,
      precioMinimo: min,
      tienda: tiendaMin,
      tiendasObservadas: vigentes,
    })
  }
  return serie
}

export function buildMarketPriceProfile(observations: PriceObservation[], opts: MarketPriceOptions): MarketPriceProfile {
  const windowDays = opts.windowDays ?? MARKET_PRICE_DEFAULTS.windowDays
  const recentDays = opts.recentDays ?? MARKET_PRICE_DEFAULTS.recentDays
  const halfLife = opts.halfLifeDays ?? MARKET_PRICE_DEFAULTS.halfLifeDays
  const serie = dailyCompetitiveSeries(observations, opts)
  const notas: string[] = []

  const enVentana = observations.filter((o) => {
    const age = (opts.now.getTime() - o.observedAt.getTime()) / DAY_MS
    return o.inStock && o.market === opts.market && o.currency === opts.currency && age >= 0 && age <= windowDays
  })
  const tiendas = [...new Set(enVentana.map((o) => o.store ?? o.connector))].sort()
  const diasObservados = new Set(enVentana.map((o) => Math.floor(o.observedAt.getTime() / DAY_MS))).size

  const base: MarketPriceProfile = {
    market: opts.market,
    currency: opts.currency,
    calculadoEn: opts.now,
    ventanaDias: windowDays,
    serie,
    diasCubiertos: serie.length,
    diasObservados,
    muestras: enVentana.length,
    tiendas,
    precioReal: null,
    medianaPonderada: null,
    medianaReciente: null,
    medianaAnterior: null,
    piso: null,
    techo: null,
    tendenciaPct: null,
    regimen: null,
    lanzamientoInflado: false,
    confianza: 'sin_historial',
    notas,
  }

  if (diasObservados < MARKET_PRICE_DEFAULTS.minDaysForProfile || serie.length === 0) {
    notas.push(`Historial insuficiente: ${diasObservados} días con observaciones reales (mínimo ${MARKET_PRICE_DEFAULTS.minDaysForProfile}).`)
    return base
  }

  const prices = serie.map((p) => p.precioMinimo)
  const weights = serie.map((p) => Math.pow(0.5, p.ageDays / halfLife))
  const medianaPonderada = weightedMedian(prices, weights)!
  const recientes = serie.filter((p) => p.ageDays <= recentDays).map((p) => p.precioMinimo)
  const anteriores = serie.filter((p) => p.ageDays > recentDays).map((p) => p.precioMinimo)
  const medianaReciente = median(recientes)
  const medianaAnterior = median(anteriores)
  const piso = Math.min(...prices)
  const techo = Math.max(...prices)

  let tendenciaPct: number | null = null
  let regimen: Regimen | null = null
  if (medianaReciente !== null && medianaAnterior !== null) {
    tendenciaPct = round2(((medianaReciente - medianaAnterior) / medianaAnterior) * 100)
    regimen =
      tendenciaPct <= -MARKET_PRICE_DEFAULTS.trendThresholdPct
        ? 'bajando'
        : tendenciaPct >= MARKET_PRICE_DEFAULTS.trendThresholdPct
          ? 'subiendo'
          : 'estable'
  } else {
    regimen = 'estable'
    notas.push('Sin datos suficientes fuera de la ventana reciente para medir tendencia; se asume estable.')
  }

  // Precio real: mediana ponderada, acotada por la mediana reciente cuando el precio viene bajando.
  let precioReal = medianaPonderada
  if (regimen === 'bajando' && medianaReciente !== null && medianaReciente < precioReal) {
    precioReal = medianaReciente
    notas.push(`Precio en descenso (${tendenciaPct}%): el precio real se acota a la mediana reciente.`)
  }

  // Lanzamiento inflado: el primer tramo de la serie está muy por encima del precio real y la tendencia es negativa.
  const headCount = Math.max(1, Math.floor(serie.length * 0.3))
  const headMedian = median(serie.slice(0, headCount).map((p) => p.precioMinimo))!
  const lanzamientoInflado =
    headMedian > precioReal * (1 + MARKET_PRICE_DEFAULTS.launchInflationPct / 100) && (tendenciaPct ?? 0) < 0
  if (lanzamientoInflado) {
    notas.push(
      `Lanzamiento inflado: el primer tramo (${headMedian}) está ${round2(((headMedian - precioReal) / precioReal) * 100)}% por encima del precio real; no se usa como referencia de descuento.`,
    )
  }

  let confianza: Confianza =
    diasObservados >= 20 && tiendas.length >= 2 ? 'alta' : diasObservados >= 10 ? 'media' : 'baja'
  if (tiendas.length < 2) notas.push('Una sola tienda en el historial: el precio competitivo puede no reflejar el mercado.')
  if (recientes.length === 0) {
    confianza = 'baja'
    notas.push(`Sin precio competitivo en los últimos ${recentDays} días: el precio real puede estar desactualizado.`)
  }

  return {
    ...base,
    precioReal: round2(precioReal),
    medianaPonderada: round2(medianaPonderada),
    medianaReciente: medianaReciente === null ? null : round2(medianaReciente),
    medianaAnterior: medianaAnterior === null ? null : round2(medianaAnterior),
    piso,
    techo,
    tendenciaPct,
    regimen,
    lanzamientoInflado,
    confianza,
  }
}

/**
 * Precio objetivo derivado del análisis: precio real menos el umbral de ahorro, sin superar el tope duro.
 * Es lo que se usa cuando el producto no fija un objetivo manual.
 */
export function derivedTargetPrice(profile: MarketPriceProfile, umbralDescuentoPct: number, precioMaximo: number): number | null {
  if (profile.precioReal === null) return null
  const objetivo = profile.precioReal * (1 - umbralDescuentoPct / 100)
  return round2(Math.min(objetivo, precioMaximo))
}
