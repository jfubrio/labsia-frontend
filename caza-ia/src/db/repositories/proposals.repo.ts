import type { Db } from '../client.js'
import type { PurchaseProposal } from '../../engines/authorization.js'

/**
 * Inserta una propuesta pendiente. Si ya hay una pendiente para el producto, el índice único la rechaza y se
 * devuelve null: la vigilancia no acumula propuestas que nadie ha revisado.
 */
export const PROPOSAL_TTL_HOURS_DEFAULT = 24

export async function insertProposal(
  db: Db,
  productId: string,
  verdictId: string | null,
  buzonId: string | null,
  p: PurchaseProposal,
  now: Date = new Date(),
  ttlHours: number = PROPOSAL_TTL_HOURS_DEFAULT,
): Promise<string | null> {
  const expiraEn = new Date(now.getTime() + ttlHours * 3_600_000)
  try {
    const { rows } = await db.query(
      `INSERT INTO caza_purchase_proposals
         (product_id, observation_id, verdict_id, precio, moneda, precio_objetivo, objetivo_derivado, precio_aterrizado_base, moneda_base, buzon_id, motivo, creado_en, expira_en)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [productId, p.observationId, verdictId, p.precio, p.moneda, p.precioObjetivo, p.objetivoDerivado, p.precioAterrizadoBase, p.monedaBase, buzonId, p.motivo, now, expiraEn],
    )
    return rows[0].id as string
  } catch (err) {
    if ((err as { constraint?: string }).constraint === 'uniq_pending_proposal_per_product') return null
    throw err
  }
}

/** Las propuestas pendientes vencidas pasan a 'expirada'; así la vigilancia puede proponer de nuevo. Devuelve cuántas expiraron. */
export async function expireStaleProposals(db: Db, productId: string | null, now: Date = new Date()): Promise<number> {
  const { rowCount } = await db.query(
    `UPDATE caza_purchase_proposals SET estado = 'expirada', decidido_en = $1
      WHERE estado = 'pendiente' AND expira_en <= $1 ${productId ? 'AND product_id = $2' : ''}`,
    productId ? [now, productId] : [now],
  )
  return rowCount ?? 0
}

export interface ProposalRow {
  id: string
  product_id: string
  product_slug: string
  product_nombre: string
  observation_id: string
  verdict_id: string | null
  precio: string
  moneda: string
  precio_objetivo: string
  objetivo_derivado: boolean
  precio_aterrizado_base: string
  moneda_base: string
  buzon: string | null
  motivo: string
  estado: string
  expira_en: Date
  decidido_en: Date | null
  decidido_por: string | null
  motivo_decision: string | null
  authorization_id: string | null
  creado_en: Date
  tienda: string | null
  url: string | null
  en_stock: boolean
  veredicto: string | null
  precio_real: string | null
  confianza: string | null
}

const PROPOSAL_SELECT = `
  SELECT pr.id, pr.product_id, p.slug AS product_slug, p.nombre AS product_nombre, pr.observation_id, pr.verdict_id,
         pr.precio, pr.moneda, pr.precio_objetivo, pr.objetivo_derivado, pr.precio_aterrizado_base, pr.moneda_base,
         b.clave AS buzon, pr.motivo, pr.estado, pr.expira_en, pr.decidido_en, pr.decidido_por, pr.motivo_decision,
         pr.authorization_id, pr.creado_en, o.tienda, o.url, o.en_stock, v.veredicto, v.precio_real, v.confianza
    FROM caza_purchase_proposals pr
    JOIN caza_products p ON p.id = pr.product_id
    JOIN caza_price_observations o ON o.id = pr.observation_id
    LEFT JOIN caza_discount_verdicts v ON v.id = pr.verdict_id
    LEFT JOIN caza_buzones b ON b.id = pr.buzon_id`

export async function listProposals(db: Db, estado?: string): Promise<ProposalRow[]> {
  const { rows } = await db.query(
    `${PROPOSAL_SELECT} ${estado ? 'WHERE pr.estado = $1' : ''} ORDER BY pr.creado_en DESC LIMIT 200`,
    estado ? [estado] : [],
  )
  return rows as ProposalRow[]
}

export async function getProposal(db: Db, id: string): Promise<ProposalRow | null> {
  const { rows } = await db.query(`${PROPOSAL_SELECT} WHERE pr.id = $1`, [id])
  return (rows[0] as ProposalRow | undefined) ?? null
}

export async function countPendingProposals(db: Db, productId: string): Promise<number> {
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM caza_purchase_proposals WHERE product_id = $1 AND estado = 'pendiente'`,
    [productId],
  )
  return rows[0].n as number
}
