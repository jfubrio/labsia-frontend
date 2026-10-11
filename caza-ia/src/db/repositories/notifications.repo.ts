import type { Db } from '../client.js'
import type { Notification, NotifyOutcome } from '../../notify/notifier.js'

export async function recordNotifications(db: Db, productId: string | null, n: Notification, outcomes: NotifyOutcome[], now: Date = new Date()): Promise<void> {
  for (const o of outcomes) {
    await db.query(
      `INSERT INTO caza_notifications (enviado_en, canal, evento, product_id, titulo, cuerpo, estado, error) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [now, o.canal, n.evento, productId, n.titulo, n.cuerpo, o.estado, o.error ?? null],
    )
  }
}

export async function listNotifications(db: Db, limit = 20) {
  const { rows } = await db.query(`SELECT enviado_en, canal, evento, titulo, estado, error FROM caza_notifications ORDER BY enviado_en DESC LIMIT $1`, [limit])
  return rows
}
