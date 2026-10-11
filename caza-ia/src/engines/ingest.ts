import { createHash, randomUUID } from 'node:crypto'
import type { RawOffer, PriceObservation } from '../types.js'

export function offerHash(o: RawOffer): string {
  return createHash('sha256')
    .update([o.connector, o.price.toFixed(2), o.currency, o.url, o.seller ?? ''].join('|'))
    .digest('hex')
    .slice(0, 32)
}

/** Normaliza una oferta cruda en una observación persistible. */
export function toObservation(productSlug: string, o: RawOffer): PriceObservation {
  if (!(o.price > 0)) throw new Error(`CAZA: precio inválido ${o.price}`)
  return { ...o, id: randomUUID(), productSlug, offerHash: offerHash(o) }
}
