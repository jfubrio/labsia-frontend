import type { Db } from '../db/client.js'
import { num } from '../db/client.js'
import type { Env } from '../config/env.js'
import { idempotencyKey } from '../engines/purchase-executor.js'
import { getSpendLimit, getSpendState } from '../db/repositories/spend-limits.repo.js'
import { checkSpendLimit } from '../engines/spend-limits.js'
import { notifyAll, type Notifier } from '../notify/notifier.js'
import { recordNotifications } from '../db/repositories/notifications.repo.js'

/**
 * Ejecutor de compra (fase 6), modo COMPRA ASISTIDA.
 *
 * Ninguna API de tienda ejecuta compras (PA-API, Best Buy, eBay Browse y Mercado Libre solo informan), así que el
 * ejecutor no "compra": registra la ORDEN que el comprador ejecuta a mano en la tienda, con el enlace, el precio y la
 * autorización que la respalda, y después sigue su estado (colocada con referencia, recogida o entregada, cancelada).
 *
 * Crear la orden es la única acción que compromete dinero, y pasa por las tres capas del interruptor:
 *   1. código:          CAZA_PHASE >= 6 y PURCHASES_ENABLED=true (loadEnv rechaza la combinación inválida);
 *   2. base de datos:   caza_settings.purchases_enabled = 'true' (trigger trg_a_purchases_enabled);
 *   3. autorización:    approve vigente, no consumida, de este producto, precio ≤ tope (trigger de autorización).
 * Y además: una sola orden activa por producto (índice único parcial), clave idempotente y límite de gasto.
 */
export type OrderStatus = 'pending' | 'authorized' | 'placed' | 'cancelled' | 'failed' | 'delivered'

export interface OrderRow {
  id: string
  product_slug: string
  authorization_id: string
  connector: string
  idempotency_key: string
  status: OrderStatus
  precio_final: number | null
  moneda: string
  referencia_externa: string | null
  buzon: string | null
  guia_reenvio: string | null
  recogido_en: Date | null
  creado_en: Date
  actualizado_en: Date
  url: string | null
  tienda: string | null
  precio_maximo: number
  precio_aterrizado_base: number | null
}

export type CreateOrderResult =
  | { status: 'disabled'; razon: string }
  | { status: 'rejected'; razon: string }
  | { status: 'duplicate'; order: OrderRow }
  | { status: 'created'; order: OrderRow }

const ORDER_SELECT = `
  SELECT o.id, p.slug AS product_slug, o.authorization_id, c.clave AS connector, o.idempotency_key, o.status, o.precio_final, o.moneda,
         o.referencia_externa, b.clave AS buzon, o.guia_reenvio, o.recogido_en, o.creado_en, o.actualizado_en,
         obs.url, obs.tienda, a.precio_maximo, a.precio_aterrizado_base
    FROM caza_purchase_orders o
    JOIN caza_products p ON p.id = o.product_id
    JOIN caza_connectors c ON c.id = o.connector_id
    JOIN caza_purchase_authorizations a ON a.id = o.authorization_id
    JOIN caza_price_observations obs ON obs.id = a.observation_id
    LEFT JOIN caza_buzones b ON b.id = o.buzon_id`

function toRow(r: Record<string, unknown>): OrderRow {
  return {
    ...(r as unknown as OrderRow),
    precio_final: num(r.precio_final as string | null),
    precio_maximo: num(r.precio_maximo as string)!,
    precio_aterrizado_base: num(r.precio_aterrizado_base as string | null),
    moneda: (r.moneda as string).trim(),
  }
}

export async function getOrder(db: Db, id: string): Promise<OrderRow | null> {
  const { rows } = await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [id])
  return rows[0] ? toRow(rows[0]) : null
}

export async function listOrders(db: Db, limit = 50): Promise<OrderRow[]> {
  const { rows } = await db.query(`${ORDER_SELECT} ORDER BY o.creado_en DESC LIMIT $1`, [limit])
  return rows.map(toRow)
}

async function getByKey(db: Db, key: string): Promise<OrderRow | null> {
  const { rows } = await db.query(`${ORDER_SELECT} WHERE o.idempotency_key = $1`, [key])
  return rows[0] ? toRow(rows[0]) : null
}

export interface CreateOrderInput {
  authorizationId: string
  /** Identidad de quien registra la orden (el comprador u operador). */
  actor: string
  /** Precio al que se va a comprar; por defecto el tope autorizado. Debe ser ≤ tope: lo valida el trigger. */
  precioFinal?: number
  now?: Date
  notifiers?: Notifier[]
}

export async function createOrderFromAuthorization(db: Db, env: Env, input: CreateOrderInput): Promise<CreateOrderResult> {
  const now = input.now ?? new Date()
  if (!env.PURCHASES_ENABLED || env.CAZA_PHASE < 6) {
    return { status: 'disabled', razon: `Las compras están deshabilitadas en el código (fase ${env.CAZA_PHASE}, PURCHASES_ENABLED=${env.PURCHASES_ENABLED}). Ninguna orden fue creada.` }
  }
  if (!input.actor?.trim()) return { status: 'rejected', razon: 'Falta la identidad de quien registra la orden' }

  const { rows: auths } = await db.query(
    `SELECT a.id, a.product_id, p.slug, a.decision, a.precio_maximo, a.moneda, a.precio_aterrizado_base, a.buzon_id, a.expira_en, a.consumido_en, obs.connector_id
       FROM caza_purchase_authorizations a JOIN caza_products p ON p.id = a.product_id
       JOIN caza_price_observations obs ON obs.id = a.observation_id WHERE a.id = $1`,
    [input.authorizationId],
  )
  const auth = auths[0]
  if (!auth) return { status: 'rejected', razon: `La autorización ${input.authorizationId} no existe` }

  const key = idempotencyKey(auth.slug, auth.id)
  const existing = await getByKey(db, key)
  if (existing) return { status: 'duplicate', order: existing }

  // Comprobaciones previas con mensajes claros; los triggers las vuelven a aplicar de forma atómica.
  if (auth.decision !== 'approve') return { status: 'rejected', razon: 'La autorización no es approve' }
  if (auth.consumido_en) return { status: 'rejected', razon: 'La autorización ya fue consumida' }
  if (new Date(auth.expira_en).getTime() <= now.getTime()) return { status: 'rejected', razon: 'La autorización expiró' }
  const precioFinal = input.precioFinal ?? num(auth.precio_maximo)!
  if (precioFinal > num(auth.precio_maximo)!) return { status: 'rejected', razon: `Precio ${precioFinal} excede el tope autorizado ${auth.precio_maximo}` }

  const limit = await getSpendLimit(db)
  if (limit) {
    // La autorización que se va a consumir ya está comprometida: se descuenta para no contarla dos veces.
    const state = await getSpendState(db, now)
    const montoAuth = num(auth.precio_aterrizado_base) ?? num(auth.precio_maximo)!
    const check = checkSpendLimit(limit, { comprometidoMesBase: state.comprometidoMesBase - montoAuth, compromisosMes: state.compromisosMes - 1 }, montoAuth)
    if (!check.ok) return { status: 'rejected', razon: check.razon }
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO caza_purchase_orders (product_id, authorization_id, connector_id, idempotency_key, status, precio_final, moneda, buzon_id, creado_en, actualizado_en)
       VALUES ($1, $2, $3, $4, 'authorized', $5, $6, $7, $8, $8) RETURNING id`,
      [auth.product_id, auth.id, auth.connector_id, key, precioFinal, auth.moneda, auth.buzon_id, now],
    )
    const order = (await getOrder(db, rows[0].id))!
    await db.query(`INSERT INTO caza_audit_log (ocurrido_en, actor, evento, product_id, payload) VALUES ($1,$2,'order.created',$3,$4)`, [
      now, input.actor, auth.product_id, JSON.stringify({ orderId: order.id, authorizationId: auth.id, precioFinal, moneda: order.moneda, idempotencyKey: key }),
    ])
    if (input.notifiers?.length) {
      const n = { evento: 'order.created' as const, titulo: `CAZA IA: orden registrada para ${auth.slug}`, cuerpo: `${precioFinal} ${order.moneda} en ${order.tienda ?? order.connector}. Cómprala en la tienda y marca la orden como colocada con la referencia.`, productSlug: auth.slug as string, datos: { orderId: order.id } }
      const outcomes = await notifyAll(input.notifiers, n)
      await recordNotifications(db, auth.product_id, n, outcomes, now).catch(() => undefined)
    }
    return { status: 'created', order }
  } catch (err) {
    const e = err as { code?: string; constraint?: string; message: string }
    if (e.code === '23505' && e.constraint === 'caza_purchase_orders_idempotency_key_key') {
      return { status: 'duplicate', order: (await getByKey(db, key))! }
    }
    if (e.code === '23505' && e.constraint === 'uniq_active_order_per_product') {
      const { rows } = await db.query(`${ORDER_SELECT} WHERE o.product_id = $1 AND o.status IN ('pending','authorized','placed') LIMIT 1`, [auth.product_id])
      return rows[0] ? { status: 'duplicate', order: toRow(rows[0]) } : { status: 'rejected', razon: 'Ya existe una orden activa para el producto' }
    }
    if (e.message.startsWith('CAZA:')) return { status: e.message.includes('deshabilitadas') ? 'disabled' : 'rejected', razon: e.message }
    throw err
  }
}

const TRANSITIONS: Record<string, OrderStatus[]> = {
  authorized: ['placed', 'cancelled', 'failed'],
  placed: ['delivered', 'cancelled'],
}

export async function transitionOrder(
  db: Db,
  orderId: string,
  to: OrderStatus,
  input: { actor: string; referenciaExterna?: string; precioFinal?: number; guiaReenvio?: string; now?: Date },
): Promise<OrderRow> {
  const now = input.now ?? new Date()
  const order = await getOrder(db, orderId)
  if (!order) throw new Error(`CAZA: la orden ${orderId} no existe`)
  if (!TRANSITIONS[order.status]?.includes(to)) throw new Error(`CAZA: no se puede pasar de ${order.status} a ${to}`)
  if (to === 'placed' && !input.referenciaExterna) throw new Error('CAZA: marcar como colocada requiere la referencia de la tienda (número de pedido)')
  if (input.precioFinal !== undefined && input.precioFinal > order.precio_maximo) throw new Error(`CAZA: precio final ${input.precioFinal} excede el tope autorizado ${order.precio_maximo}`)
  await db.query(
    `UPDATE caza_purchase_orders SET status = $2, referencia_externa = COALESCE($3, referencia_externa), precio_final = COALESCE($4, precio_final),
            guia_reenvio = COALESCE($5, guia_reenvio), recogido_en = CASE WHEN $2 = 'delivered' THEN $6 ELSE recogido_en END, actualizado_en = $6
      WHERE id = $1`,
    [orderId, to, input.referenciaExterna ?? null, input.precioFinal ?? null, input.guiaReenvio ?? null, now],
  )
  const updated = (await getOrder(db, orderId))!
  await db.query(`INSERT INTO caza_audit_log (ocurrido_en, actor, evento, product_id, payload) SELECT $1, $2, $3, product_id, $4 FROM caza_purchase_orders WHERE id = $5`, [
    now, input.actor, `order.${to}`, JSON.stringify({ orderId, referenciaExterna: input.referenciaExterna ?? null, precioFinal: updated.precio_final }), orderId,
  ])
  return updated
}
