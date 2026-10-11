import { describe, it, expect } from 'vitest'
import { compareInternational, landedPrice, defaultComparisonConfig, type ComparisonConfig } from '../src/engines/international-comparison.js'
import { importTierFor, importacionUsaMexico } from '../src/config/logistics.js'
import { loadScenario } from './helpers.js'

const cfg = defaultComparisonConfig(18.5)
const paqueteria = (): ComparisonConfig => ({ ...cfg, buzones: { US: { ...cfg.buzones.US!, modoIngreso: 'paqueteria' } } })

describe('precio aterrizado con cruce personal por el buzón en Texas', () => {
  it('dentro de la franquicia solo paga impuesto de venta y recepción en el buzón', async () => {
    const { offers } = await loadScenario('comparacion_internacional')
    const us = offers.find((o) => o.market === 'US')!
    const lp = landedPrice(us, cfg)
    // 379 USD: imp. venta 8.25 % = 31.27 ; recepción 5 ; (379 + 31.27 + 5) × 18.5 = 7682.50 ; franquicia 500 cubre todo
    expect(lp.modoIngreso).toBe('cruce_personal')
    expect(lp.impuestoVenta).toBe(31.27)
    expect(lp.recepcionBuzon).toBe(5)
    expect(lp.franquiciaAplicadaUsd).toBe(379)
    expect(lp.baseGravableUsd).toBe(0)
    expect(lp.impuestosImportacion).toBe(0)
    expect(lp.reenvio).toBe(0)
    expect(lp.precioAterrizado).toBe(7682.5)
    expect(lp.requiereAgenteAduanal).toBe(false)
  })

  it('por encima de la franquicia paga la tasa global solo sobre el excedente', async () => {
    const { offers } = await loadScenario('comparacion_internacional')
    const us = { ...offers.find((o) => o.market === 'US')!, price: 800 }
    const lp = landedPrice(us, cfg)
    // excedente 300 USD × 19 % × 18.5 = 1054.5
    expect(lp.franquiciaAplicadaUsd).toBe(500)
    expect(lp.baseGravableUsd).toBe(300)
    expect(lp.tasaImportacionPct).toBe(19)
    expect(lp.impuestosImportacion).toBe(1054.5)
  })

  it('si la franquicia ya se usó en el mismo cruce, todo el valor es gravable', async () => {
    const { offers } = await loadScenario('oferta_usa_gana')
    const lp = landedPrice(offers[0]!, { ...cfg, franquiciaDisponibleUsd: { US: 0 } })
    expect(lp.franquiciaAplicadaUsd).toBe(0)
    expect(lp.baseGravableUsd).toBe(299.99)
    expect(lp.precioAterrizado).toBe(7154.65)
  })

  it('por encima del tope del pago simplificado exige agente aduanal', async () => {
    const { offers } = await loadScenario('oferta_usa_gana')
    const lp = landedPrice({ ...offers[0]!, price: 3200 }, cfg)
    expect(lp.requiereAgenteAduanal).toBe(true)
  })

  it('el mercado local no paga buzón, importación ni impuesto de venta extra', async () => {
    const { offers } = await loadScenario('comparacion_internacional')
    const mx = offers.find((o) => o.market === 'MX')!
    const lp = landedPrice(mx, cfg)
    expect(lp.precioAterrizado).toBe(8999)
    expect(lp.buzon).toBeNull()
    expect(lp.modoIngreso).toBeNull()
    expect(lp.impuestosImportacion).toBe(0)
  })

  it('con cruce personal el US a 379 gana la comparación al local de 8,999', async () => {
    const { offers } = await loadScenario('comparacion_internacional')
    const cmp = compareInternational(offers, cfg)
    expect(cmp.mejorLocal?.precioAterrizado).toBe(8999)
    expect(cmp.ranking[0]!.store).toBe('amazon_us')
    expect(cmp.alternativasInternacionales).toHaveLength(1)
  })
})

describe('precio aterrizado por paquetería (ruta alternativa)', () => {
  it('paga importación por tramo sobre todo el valor más el reenvío', async () => {
    const { offers } = await loadScenario('comparacion_internacional')
    const us = offers.find((o) => o.market === 'US')!
    const lp = landedPrice(us, paqueteria())
    // (379 + 31.27 + 5) × 18.5 = 7682.5 ; importación 19 % = 379 × 0.19 × 18.5 = 1332.19 ; reenvío 35 × 18.5 = 647.5
    expect(lp.modoIngreso).toBe('paqueteria')
    expect(lp.tasaImportacionPct).toBe(19)
    expect(lp.impuestosImportacion).toBe(1332.19)
    expect(lp.reenvio).toBe(647.5)
    expect(lp.precioAterrizado).toBe(9662.19)
  })

  it('con paquetería el local de 8,999 gana al US de 379', async () => {
    const { offers } = await loadScenario('comparacion_internacional')
    expect(compareInternational(offers, paqueteria()).alternativasInternacionales).toHaveLength(0)
  })

  it('tramos de importación T-MEC: 0 % hasta 50, 17 % hasta 117, 19 % después', () => {
    expect(importTierFor(importacionUsaMexico, 49.99).tasa).toBe(0)
    expect(importTierFor(importacionUsaMexico, 50).tasa).toBe(0.17)
    expect(importTierFor(importacionUsaMexico, 116.99).tasa).toBe(0.17)
    expect(importTierFor(importacionUsaMexico, 117).tasa).toBe(0.19)
    expect(importacionUsaMexico.porConfirmar).toBe(true)
  })

  it('falla sin tipo de cambio, sin buzón o sin reglas de importación', async () => {
    const { offers } = await loadScenario('comparacion_internacional')
    const us = offers.find((o) => o.market === 'US')!
    const sinTc = defaultComparisonConfig(18.5)
    delete sinTc.rates.USD
    expect(() => landedPrice(us, sinTc)).toThrow(/tipo de cambio/)
    expect(() => landedPrice(us, { ...cfg, buzones: {} })).toThrow(/sin buzón/)
    expect(() => landedPrice(us, { ...paqueteria(), importacion: {} })).toThrow(/reglas de importación/)
  })
})
