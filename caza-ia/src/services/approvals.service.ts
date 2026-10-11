import type { Db } from '../db/client.js'
import { withTransaction } from '../db/client.js'
import { getProposal, type ProposalRow } from '../db/repositories/proposals.repo.js'
import { listProducts, buzonIdByClave } from '../db/repositories/products.repo.js'
import { insertAuthorization } from '../db/repositories/authorizations.repo.js'
import { decideAuthorization, type PurchaseProposal } from '../engines/authorization.js'
import type { AuthorizationDecision, PurchaseAuthorization, Currency, DiscountVerdict } from '../types.js'

export class ApprovalError extends Error {
  constructor(
    public readonly code: 'not_found' | 'not_pending' | 'expired' | 'invalid',
    message: string,
  ) {
    super(message)
    this.name = 'ApprovalError'
  }
}

export interface DecideProposalInput {
  proposalId: string
  decision: AuthorizationDecision
  /** Identidad del operador que decide. Queda en la autorización y en el audit log. */
  decididoPor: string
  motivo?: string
  /** Solo approve: tope autorizado en la moneda de la oferta. Por defecto el precio de la propuesta. */
  precioMaximo?: number
  ttlHours?: number
  now?: Date
}

/** Reconstruye la PurchaseProposal del motor a partir de la fila persistida, para reutilizar decideAuthorization. */
function toEngineProposal(row: ProposalRow): PurchaseProposal {
  const verdict: DiscountVerdict = {
    observationId: row.observation_id,
    veredicto: (row.veredicto ?? 'real') as DiscountVerdict['veredicto'],
    precioReal: row.precio_real === null ? null : Number(row.precio_real),
    piso: null,
    techo: null,
    regimen: null,
    confianza: (row.confianza ?? 'alta') as DiscountVerdict['confianza'],
    ahorroPctReal: null,
    ahorroPctAnunciado: null,
    anclaInflada: false,
    lanzamientoInflado: false,
    diasCubiertos: 0,
    tiendas: 0,
    razon: row.motivo,
  }
  return {
    productSlug: row.product_slug,
    observationId: row.observation_id,
    connector: '',
    precio: Number(row.precio),
    moneda: row.moneda.trim() as Currency,
    veredicto: verdict,
    precioObjetivo: Number(row.precio_objetivo),
    objetivoDerivado: row.objetivo_derivado,
    precioAterrizadoBase: Number(row.precio_aterrizado_base),
    monedaBase: row.moneda_base.trim() as Currency,
    buzon: row.buzon,
    motivo: row.motivo,
  }
}

/**
 * Decide una propuesta pendiente. Todo en una transacción:
 *  - la propuesta debe estar 'pendiente' y vigente;
 *  - se crea la autorización (approve con tope y vigencia, o reject) con las mismas reglas del motor;
 *  - la propuesta pasa a 'aprobada' o 'rechazada' con quién, cuándo y por qué;
 *  - queda un evento en el audit log.
 * Aprobar no compra: habilita al ejecutor (fase 6) a crear una orden mientras la autorización esté vigente.
 */
export async function decideProposal(db: Db, input: DecideProposalInput): Promise<{ proposal: ProposalRow; authorization: PurchaseAuthorization }> {
  const now = input.now ?? new Date()
  if (!input.decididoPor?.trim()) throw new ApprovalError('invalid', 'Falta la identidad de quien decide')

  return withTransaction(db, async (client) => {
    const { rows } = await client.query(`SELECT id, estado, expira_en, product_id FROM caza_purchase_proposals WHERE id = $1 FOR UPDATE`, [input.proposalId])
    const locked = rows[0]
    if (!locked) throw new ApprovalError('not_found', `La propuesta ${input.proposalId} no existe`)
    if (locked.estado !== 'pendiente') throw new ApprovalError('not_pending', `La propuesta ya está ${locked.estado}`)
    if (new Date(locked.expira_en).getTime() <= now.getTime()) {
      await client.query(`UPDATE caza_purchase_proposals SET estado = 'expirada', decidido_en = $2 WHERE id = $1`, [input.proposalId, now])
      throw new ApprovalError('expired', 'La propuesta expiró sin respuesta; la vigilancia volverá a proponer si la oferta sigue')
    }

    const row = (await getProposal(client as unknown as Db, input.proposalId))!
    const product = (await listProducts(client as unknown as Db)).find((p) => p.id === row.product_id)
    if (!product) throw new ApprovalError('invalid', 'El producto de la propuesta ya no está activo')

    const { authorization, audit } = decideAuthorization({
      proposal: toEngineProposal(row),
      decision: input.decision,
      autorizadoPor: input.decididoPor,
      product,
      ttlHours: input.ttlHours ?? 24,
      now,
      precioMaximo: input.precioMaximo,
    })
    const buzonId = row.buzon ? await buzonIdByClave(client as unknown as Db, row.buzon) : null
    await insertAuthorization(client, row.product_id, buzonId, authorization)
    await client.query(
      `UPDATE caza_purchase_proposals
          SET estado = $2, decidido_en = $3, decidido_por = $4, motivo_decision = $5, authorization_id = $6
        WHERE id = $1`,
      [row.id, input.decision === 'approve' ? 'aprobada' : 'rechazada', now, input.decididoPor, input.motivo ?? null, authorization.id],
    )
    await client.query(`INSERT INTO caza_audit_log (ocurrido_en, actor, evento, product_id, payload) VALUES ($1,$2,$3,$4,$5)`, [
      audit.ocurridoEn,
      audit.actor,
      audit.evento,
      row.product_id,
      JSON.stringify({ ...audit.payload, proposalId: row.id, motivo: input.motivo ?? null }),
    ])
    const updated = (await getProposal(client as unknown as Db, row.id))!
    return { proposal: updated, authorization }
  })
}
