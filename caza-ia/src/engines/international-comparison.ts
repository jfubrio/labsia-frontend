import type { PriceObservation, LandedPrice, Market, Currency } from '../types.js'
import { type Mailbox, type ImportRules, importTierFor, buzonTexas, importacionUsaMexico } from '../config/logistics.js'

export interface ComparisonConfig {
  monedaBase: Currency
  mercadoLocal: Market
  /** Tipos de cambio a moneda base: cuántas unidades de moneda base vale 1 unidad de la clave. */
  rates: Partial<Record<Currency, number>>
  /** Buzón por mercado extranjero desde el que se reenvía a casa. Sin buzón, el mercado solo se compara, no se compra. */
  buzones: Partial<Record<Market, Mailbox>>
  /** Reglas de importación por paquetería por mercado de origen hacia el mercado local (modo paqueteria). */
  importacion: Partial<Record<Market, ImportRules>>
  /**
   * Franquicia que aún queda disponible en el cruce, por mercado, en USD (modo cruce_personal). Si no se indica se
   * usa la franquicia completa del buzón. Sirve cuando varias compras comparten un mismo cruce.
   */
  franquiciaDisponibleUsd?: Partial<Record<Market, number>>
}

/** Configuración por defecto (fase 1): casa en México, buzón en Texas. Supuestos por confirmar en el plan, sección 8. */
export const defaultComparisonConfig = (usdMxn: number): ComparisonConfig => ({
  monedaBase: 'MXN',
  mercadoLocal: 'MX',
  rates: { MXN: 1, USD: usdMxn },
  buzones: { US: buzonTexas },
  importacion: { US: importacionUsaMexico },
})

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Precio aterrizado en moneda base de una oferta, tal como lo pagaría el comprador.
 *
 *   local:           precio
 *   cruce_personal:  (precio + impuesto de venta + envío doméstico + recepción en buzón + costo de viaje) × tc
 *                    + max(0, precio − franquicia disponible) × tasa sobre el excedente × tc
 *   paqueteria:      (precio + impuesto de venta + envío doméstico + recepción en buzón) × tc
 *                    + precio × tasa del tramo de importación × tc + tarifa de reenvío × tc
 */
export function landedPrice(obs: PriceObservation, cfg: ComparisonConfig): LandedPrice {
  const rate = cfg.rates[obs.currency]
  if (!rate) throw new Error(`CAZA: sin tipo de cambio para ${obs.currency}`)
  const base = {
    observationId: obs.id,
    connector: obs.connector,
    store: obs.store ?? obs.connector,
    market: obs.market,
    precioLocal: obs.price,
    monedaLocal: obs.currency,
    tipoCambio: rate,
    monedaBase: cfg.monedaBase,
  }
  if (obs.market === cfg.mercadoLocal) {
    return {
      ...base,
      buzon: null,
      modoIngreso: null,
      impuestoVenta: 0,
      envioDomestico: 0,
      recepcionBuzon: 0,
      costoViaje: 0,
      franquiciaAplicadaUsd: 0,
      baseGravableUsd: 0,
      tasaImportacionPct: 0,
      impuestosImportacion: 0,
      reenvio: 0,
      requiereAgenteAduanal: false,
      precioAterrizado: round2(obs.price * rate),
    }
  }
  const buzon = cfg.buzones[obs.market]
  if (!buzon) throw new Error(`CAZA: sin buzón para el mercado ${obs.market}; solo se puede comparar, no comprar`)
  if (buzon.currency !== obs.currency) throw new Error(`CAZA: el buzón ${buzon.clave} opera en ${buzon.currency}, la oferta está en ${obs.currency}`)

  const impuestoVenta = round2(obs.price * (buzon.impuestoVentaPct / 100))
  const enOrigen = obs.price + impuestoVenta + buzon.envioDomestico + buzon.tarifaRecepcion

  if (buzon.modoIngreso === 'cruce_personal') {
    const franquicia = Math.max(0, cfg.franquiciaDisponibleUsd?.[obs.market] ?? buzon.franquiciaUsd)
    const franquiciaAplicadaUsd = Math.min(franquicia, obs.price)
    const baseGravableUsd = round2(Math.max(0, obs.price - franquiciaAplicadaUsd))
    const impuestosImportacion = round2(baseGravableUsd * buzon.tasaExcedente * rate)
    const requiereAgenteAduanal = obs.price > buzon.topeSimplificadoUsd
    return {
      ...base,
      buzon: buzon.clave,
      modoIngreso: 'cruce_personal',
      impuestoVenta,
      envioDomestico: buzon.envioDomestico,
      recepcionBuzon: buzon.tarifaRecepcion,
      costoViaje: buzon.costoViaje,
      franquiciaAplicadaUsd,
      baseGravableUsd,
      tasaImportacionPct: baseGravableUsd > 0 ? round2(buzon.tasaExcedente * 100) : 0,
      impuestosImportacion,
      reenvio: 0,
      requiereAgenteAduanal,
      precioAterrizado: round2((enOrigen + buzon.costoViaje) * rate + impuestosImportacion),
    }
  }

  const reglas = cfg.importacion[obs.market]
  if (!reglas) throw new Error(`CAZA: sin reglas de importación por paquetería desde ${obs.market}`)
  const tier = importTierFor(reglas, obs.price)
  const impuestosImportacion = round2(obs.price * tier.tasa * rate)
  const reenvio = round2(buzon.tarifaReenvio * rate)
  return {
    ...base,
    buzon: buzon.clave,
    modoIngreso: 'paqueteria',
    impuestoVenta,
    envioDomestico: buzon.envioDomestico,
    recepcionBuzon: buzon.tarifaRecepcion,
    costoViaje: 0,
    franquiciaAplicadaUsd: 0,
    baseGravableUsd: obs.price,
    tasaImportacionPct: round2(tier.tasa * 100),
    impuestosImportacion,
    reenvio,
    requiereAgenteAduanal: tier.maxUsd === null,
    precioAterrizado: round2(enOrigen * rate + impuestosImportacion + reenvio),
  }
}

export interface ComparisonResult {
  ranking: LandedPrice[]
  mejorLocal: LandedPrice | null
  /** Ofertas extranjeras cuyo precio aterrizado es menor al mejor precio local. */
  alternativasInternacionales: LandedPrice[]
}

/** Ordena las ofertas en stock por precio aterrizado y señala las extranjeras que ganan al mejor precio local. */
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
