import type { Db } from '../client.js'
import type pg from 'pg'
import { num } from '../client.js'
import type { SpendLimit, SpendState } from '../../engines/spend-limits.js'

type Q = Db | pg.PoolClient

export async function getSpendLimit(db: Q): Promise<SpendLimit | null> {
  const { rows } = await db.query(`SELECT moneda_base, presupuesto_mensual_base, max_ordenes_mes FROM caza_spend_limits WHERE id = 1`)
  const r = rows[0]
  if (!r) return null
  return { monedaBase: r.moneda_base.trim(), presupuestoMensualBase: num(r.presupuesto_mensual_base)!, maxOrdenesMes: r.max_ordenes_mes }
}

export async function setSpendLimit(db: Q, l: { presupuestoMensualBase: number; maxOrdenesMes: number; actualizadoPor: string }): Promise<void> {
  await db.query(
    `INSERT INTO caza_spend_limits (id, presupuesto_mensual_base, max_ordenes_mes, actualizado_por, actualizado_en)
     VALUES (1, $1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE SET presupuesto_mensual_base = EXCLUDED.presupuesto_mensual_base, max_ordenes_mes = EXCLUDED.max_ordenes_mes,
       actualizado_por = EXCLUDED.actualizado_por, actualizado_en = NOW()`,
    [l.presupuestoMensualBase, l.maxOrdenesMes, l.actualizadoPor],
  )
}

/**
 * Comprometido del mes en curso (moneda base):
 *  - autorizaciones approve vigentes y no consumidas: su precio aterrizado estimado, o el tope si la compra es local;
 *  - órdenes activas: su precio final o, si aún no lo hay, el aterrizado/tope de su autorización.
 */
export async function getSpendState(db: Q, now: Date = new Date()): Promise<SpendState> {
  const { rows } = await db.query(
    `WITH auths AS (
       SELECT a.id, COALESCE(a.precio_aterrizado_base, a.precio_maximo) AS monto
         FROM caza_purchase_authorizations a
        WHERE a.decision = 'approve' AND a.consumido_en IS NULL AND a.expira_en > $1
          AND date_trunc('month', a.creado_en) = date_trunc('month', $1::timestamptz)
     ), orders AS (
       SELECT o.id, COALESCE(o.precio_final, a.precio_aterrizado_base, a.precio_maximo) AS monto
         FROM caza_purchase_orders o JOIN caza_purchase_authorizations a ON a.id = o.authorization_id
        WHERE o.status IN ('pending','authorized','placed')
          AND date_trunc('month', o.creado_en) = date_trunc('month', $1::timestamptz)
     )
     SELECT (SELECT COALESCE(sum(monto),0) FROM auths) + (SELECT COALESCE(sum(monto),0) FROM orders) AS comprometido,
            (SELECT count(*) FROM auths) + (SELECT count(*) FROM orders) AS compromisos`,
    [now],
  )
  return { comprometidoMesBase: num(rows[0].comprometido)!, compromisosMes: Number(rows[0].compromisos) }
}
