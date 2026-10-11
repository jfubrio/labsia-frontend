import { createHash, randomUUID } from 'node:crypto'
import type { RawOffer, PriceObservation } from '../types.js'

export function offerHash(o: RawOffer): string {
  return createHash('sha256')
    .update([o.connector, o.store ?? '', o.price.toFixed(2), o.currency, o.url, o.seller ?? ''].join('|'))
    .digest('hex')
    .slice(0, 32)
}

/** Solo se guardan enlaces http(s): una URL de tienda acaba como enlace en las páginas del operador. */
export function safeHttpUrl(u: string): string {
  try {
    const parsed = new URL(u)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : ''
  } catch {
    return ''
  }
}

/** Normaliza una oferta cruda en una observación persistible. */
export function toObservation(productSlug: string, o: RawOffer): PriceObservation {
  if (!(o.price > 0)) throw new Error(`CAZA: precio inválido ${o.price}`)
  const clean = { ...o, url: safeHttpUrl(o.url) }
  return { ...clean, id: randomUUID(), productSlug, offerHash: offerHash(clean) }
}
