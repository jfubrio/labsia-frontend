import type { Db } from '../client.js'
import type { PurchaseProposal } from '../../engines/authorization.js'

/**
 * Inserta una propuesta pendiente. Si ya hay una pendiente para el producto, el índice único la rechaza y se
 * devuelve null: la vigilancia no acumula propuestas que nadie ha revisado.
 */
export async function insertProposal(
  db: Db,
  productId: string,
  verdictId: string | null,
  buzonId: string | null,
  p: PurchaseProposal,
): Promise<string | null> {
  try {
    const { rows } = await db.query(
      `INSERT INTO caza_purchase_proposals
         (product_id, observation_id, verdict_id, precio, moneda, precio_objetivo, objetivo_derivado, precio_aterrizado_base, moneda_base, buzon_id, motivo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [productId, p.observationId, verdictId, p.precio, p.moneda, p.precioObjetivo, p.objetivoDerivado, p.precioAterrizadoBase, p.monedaBase, buzonId, p.motivo],
    )
    return rows[0].id as string
  } catch (err) {
    if ((err as { constraint?: string }).constraint === 'uniq_pending_proposal_per_product') return null
    throw err
  }
}

export async function countPendingProposals(db: Db, productId: string): Promise<number> {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM caza_purchase_proposals WHERE product_id = $1 AND estado = 'pendiente'`,
    [productId],
  )
  return rows[0].n as number
}
