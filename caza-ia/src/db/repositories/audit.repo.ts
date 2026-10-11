import type { Db } from '../client.js'
import type { AuditEvent } from '../../types.js'

export async function insertAudit(db: Db, productId: string | null, e: AuditEvent): Promise<void> {
  await db.query(
    `INSERT INTO caza_audit_log (ocurrido_en, actor, evento, product_id, payload) VALUES ($1,$2,$3,$4,$5)`,
    [e.ocurridoEn, e.actor, e.evento, productId, JSON.stringify(e.payload)],
  )
}
