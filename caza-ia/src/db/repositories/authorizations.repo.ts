import type { Db } from '../client.js'
import type { PurchaseAuthorization } from '../../types.js'
import type pg from 'pg'

export async function insertAuthorization(
  db: Db | pg.PoolClient,
  productId: string,
  buzonId: string | null,
  a: PurchaseAuthorization,
): Promise<void> {
  await db.query(
    `INSERT INTO caza_purchase_authorizations
       (id, product_id, observation_id, decision, precio_maximo, moneda, precio_aterrizado_base, buzon_id, autorizado_por, expira_en, creado_en)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [a.id, productId, a.observationId, a.decision, a.precioMaximo, a.moneda, a.precioAterrizadoBase, buzonId, a.autorizadoPor, a.expiraEn, a.creadoEn],
  )
}
