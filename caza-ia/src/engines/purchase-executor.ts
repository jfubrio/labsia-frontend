import { createHash, randomUUID } from 'node:crypto'
import type { Env } from '../config/env.js'
import type { PriceObservation, PurchaseAuthorization, PurchaseOrder, AuditEvent } from '../types.js'
import { checkAuthorization } from './authorization.js'
import { isConnectorUsable } from '../connectors/registry.js'
import { checkSpendLimit, type SpendLimit, type SpendState } from './spend-limits.js'

export const ACTIVE_STATUSES: ReadonlySet<PurchaseOrder['status']> = new Set(['pending', 'authorized', 'placed'])

/** Clave idempotente: el mismo producto + autorización siempre produce la misma orden. */
export function idempotencyKey(productSlug: string, authorizationId: string): string {
  return createHash('sha256').update(`${productSlug}|${authorizationId}`).digest('hex').slice(0, 40)
}

/**
 * Almacén de órdenes. En fase 1 es en memoria y replica las dos guardas de la migración 002:
 *  - clave idempotente única
 *  - una sola orden activa por producto
 * En fase 6 se sustituye por Postgres, donde esas guardas ya existen como índices y triggers.
 */
export class InMemoryOrderStore {
  private byKey = new Map<string, PurchaseOrder>()

  findByKey(key: string): PurchaseOrder | undefined {
    return this.byKey.get(key)
  }

  activeForProduct(productSlug: string): PurchaseOrder | undefined {
    for (const o of this.byKey.values()) {
      if (o.productSlug === productSlug && ACTIVE_STATUSES.has(o.status)) return o
    }
    return undefined
  }

  insert(order: PurchaseOrder): PurchaseOrder {
    if (this.byKey.has(order.idempotencyKey)) {
      throw new Error('CAZA: clave idempotente duplicada')
    }
    if (this.activeForProduct(order.productSlug)) {
      throw new Error(`CAZA: ya existe una orden activa para ${order.productSlug}`)
    }
    this.byKey.set(order.idempotencyKey, order)
    return order
  }

  all(): PurchaseOrder[] {
    return [...this.byKey.values()]
  }
}

export class PurchasesDisabledError extends Error {
  constructor(phase: number) {
    super(`CAZA: las compras están deshabilitadas (fase ${phase}, PURCHASES_ENABLED=false). Ninguna orden fue creada.`)
    this.name = 'PurchasesDisabledError'
  }
}

export type ExecuteResult =
  | { status: 'disabled'; razon: string }
  | { status: 'rejected'; razon: string }
  | { status: 'duplicate'; order: PurchaseOrder }
  | { status: 'created'; order: PurchaseOrder; audit: AuditEvent }

/**
 * Único punto por el que puede nacer una orden. Orden de comprobaciones (igual que los triggers de la 002):
 *  1. interruptor global (fase y PURCHASES_ENABLED)
 *  2. idempotencia (mismo intento → misma orden, sin efectos)
 *  3. autorización vigente para esta oferta y precio
 *  4. conector validado y habilitado
 *  5. ninguna orden activa para el producto
 *  6. límite de gasto mensual (si se proporciona el estado)
 */
export function executePurchase(
  env: Env,
  store: InMemoryOrderStore,
  auth: PurchaseAuthorization,
  obs: PriceObservation,
  precioFinal: number,
  now: Date = new Date(),
  /** Límite de gasto vigente y lo comprometido en el mes; si se pasa, se aplica antes de crear la orden. */
  spend?: { limit: SpendLimit; state: SpendState; montoBase: number },
): ExecuteResult {
  if (!env.PURCHASES_ENABLED || env.CAZA_PHASE < 6) {
    return { status: 'disabled', razon: new PurchasesDisabledError(env.CAZA_PHASE).message }
  }

  const key = idempotencyKey(auth.productSlug, auth.id)
  const existing = store.findByKey(key)
  if (existing) return { status: 'duplicate', order: existing }

  const check = checkAuthorization(auth, obs, precioFinal, now)
  if (!check.ok) return { status: 'rejected', razon: check.razon }

  if (!isConnectorUsable(obs.connector)) {
    return { status: 'rejected', razon: `Conector '${obs.connector}' no validado o deshabilitado` }
  }

  const active = store.activeForProduct(auth.productSlug)
  if (active) return { status: 'duplicate', order: active }

  if (spend) {
    const check = checkSpendLimit(spend.limit, spend.state, spend.montoBase)
    if (!check.ok) return { status: 'rejected', razon: check.razon }
  }

  const order: PurchaseOrder = {
    id: randomUUID(),
    productSlug: auth.productSlug,
    authorizationId: auth.id,
    connector: obs.connector,
    idempotencyKey: key,
    status: 'authorized',
    precioFinal,
    moneda: auth.moneda,
    creadoEn: now,
  }
  store.insert(order)
  auth.consumidoEn = now
  return {
    status: 'created',
    order,
    audit: {
      ocurridoEn: now,
      actor: 'sistema',
      evento: 'order.created',
      productSlug: order.productSlug,
      payload: { orderId: order.id, authorizationId: auth.id, precioFinal, idempotencyKey: key },
    },
  }
}
