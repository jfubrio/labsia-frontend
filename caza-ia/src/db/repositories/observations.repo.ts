import type { Db } from '../client.js'
import { num } from '../client.js'
import type { PriceObservation, Market, Currency } from '../../types.js'

export async function insertObservation(
  db: Db,
  productId: string,
  connectorId: string,
  obs: PriceObservation,
): Promise<void> {
  await db.query(
    `INSERT INTO caza_price_observations
       (id, product_id, connector_id, tienda, observado_en, precio, precio_anterior_anunciado, moneda, en_stock, url, vendedor, oferta_hash, raw)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      obs.id,
      productId,
      connectorId,
      obs.store ?? null,
      obs.observedAt,
      obs.price,
      obs.advertisedPreviousPrice ?? null,
      obs.currency,
      obs.inStock,
      obs.url,
      obs.seller ?? null,
      obs.offerHash,
      JSON.stringify({ market: obs.market }),
    ],
  )
}

/** Historial de un producto en un mercado y moneda, dentro de una ventana de días, como PriceObservation. */
export async function listHistory(
  db: Db,
  productId: string,
  market: Market,
  currency: Currency,
  days: number,
  now: Date = new Date(),
): Promise<PriceObservation[]> {
  const { rows } = await db.query(
    `SELECT o.id, o.precio, o.precio_anterior_anunciado, o.moneda, o.en_stock, o.url, o.vendedor, o.tienda, o.oferta_hash,
            o.observado_en, c.clave AS connector, c.mercado
       FROM caza_price_observations o
       JOIN caza_connectors c ON c.id = o.connector_id
      WHERE o.product_id = $1 AND o.moneda = $2 AND o.observado_en >= $3::timestamptz - make_interval(days => $4)
        AND o.observado_en <= $3::timestamptz
      ORDER BY o.observado_en`,
    [productId, currency, now, days],
  )
  return rows
    .map((r) => ({
      id: r.id as string,
      productSlug: '',
      offerHash: r.oferta_hash as string,
      connector: r.connector as string,
      store: (r.tienda as string | null) ?? undefined,
      seller: (r.vendedor as string | null) ?? undefined,
      market: (r.raw?.market ?? market) as Market,
      currency: r.moneda.trim() as Currency,
      price: num(r.precio)!,
      advertisedPreviousPrice: num(r.precio_anterior_anunciado),
      inStock: r.en_stock as boolean,
      url: r.url as string,
      observedAt: new Date(r.observado_en),
    }))
    .filter((o) => o.market === market)
}

export async function countObservations(db: Db, productId: string): Promise<number> {
  const { rows } = await db.query(`SELECT count(*)::int AS n FROM caza_price_observations WHERE product_id = $1`, [productId])
  return rows[0].n as number
}
