/**
 * Límites de gasto. Se evalúan en moneda base sobre lo COMPROMETIDO en el mes: autorizaciones approve vigentes y no
 * consumidas (el operador ya dijo sí) más órdenes activas (pending, authorized, placed). Así una aprobación no puede
 * exceder el presupuesto aunque la compra aún no se haya ejecutado.
 */
export interface SpendLimit {
  monedaBase: string
  presupuestoMensualBase: number
  maxOrdenesMes: number
}

export interface SpendState {
  /** Monto comprometido en el mes en curso, en moneda base. */
  comprometidoMesBase: number
  /** Órdenes activas + autorizaciones approve vigentes del mes. */
  compromisosMes: number
}

export type SpendCheck = { ok: true; disponibleBase: number } | { ok: false; razon: string; disponibleBase: number }

export function checkSpendLimit(limit: SpendLimit, state: SpendState, nuevoMontoBase: number): SpendCheck {
  const disponibleBase = Math.round((limit.presupuestoMensualBase - state.comprometidoMesBase) * 100) / 100
  if (state.compromisosMes + 1 > limit.maxOrdenesMes) {
    return { ok: false, disponibleBase, razon: `Límite de ${limit.maxOrdenesMes} compras al mes alcanzado (${state.compromisosMes} comprometidas)` }
  }
  if (nuevoMontoBase > disponibleBase) {
    return {
      ok: false,
      disponibleBase,
      razon: `Presupuesto mensual insuficiente: ${nuevoMontoBase} ${limit.monedaBase} supera el disponible ${disponibleBase} de ${limit.presupuestoMensualBase}`,
    }
  }
  return { ok: true, disponibleBase }
}
