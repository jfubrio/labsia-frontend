import { describe, it, expect } from 'vitest'
import { checkSpendLimit } from '../src/engines/spend-limits.js'

const limit = { monedaBase: 'MXN', presupuestoMensualBase: 20000, maxOrdenesMes: 2 }

describe('límites de gasto', () => {
  it('permite una compra dentro del presupuesto y del número de órdenes', () => {
    const r = checkSpendLimit(limit, { comprometidoMesBase: 7899, compromisosMes: 1 }, 6100.19)
    expect(r.ok).toBe(true)
    expect(r.disponibleBase).toBe(12101)
  })

  it('rechaza cuando el monto supera el presupuesto disponible', () => {
    const r = checkSpendLimit(limit, { comprometidoMesBase: 15000, compromisosMes: 1 }, 6100.19)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.razon).toMatch(/Presupuesto mensual insuficiente/)
  })

  it('rechaza cuando ya se alcanzó el máximo de órdenes del mes, aunque sobre presupuesto', () => {
    const r = checkSpendLimit(limit, { comprometidoMesBase: 1000, compromisosMes: 2 }, 500)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.razon).toMatch(/2 compras al mes/)
  })

  it('el disponible nunca se maquilla: puede ser negativo si ya se excedió', () => {
    const r = checkSpendLimit(limit, { comprometidoMesBase: 21000, compromisosMes: 1 }, 1)
    expect(r.disponibleBase).toBe(-1000)
    expect(r.ok).toBe(false)
  })
})
