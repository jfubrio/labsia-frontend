import type { ProductConfig } from '../../types.js'
import { sonyWh1000xm6 } from './sony-wh1000xm6.js'

export const products: Record<string, ProductConfig> = {
  [sonyWh1000xm6.slug]: sonyWh1000xm6,
}

export function getProduct(slug: string): ProductConfig {
  const p = products[slug]
  if (!p) throw new Error(`CAZA: producto desconocido '${slug}'`)
  return p
}
