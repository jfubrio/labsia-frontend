import { describe, it, expect } from 'vitest'
import { fakeFetch } from '../src/connectors/http.js'
import { BanxicoProvider, FrankfurterProvider, FixedProvider } from '../src/fx/providers.js'

const NOW = new Date('2026-10-11T12:00:00Z')

describe('proveedores de tipo de cambio', () => {
  it('Banxico lee SF43718 oportuno con el token en Bmx-Token y convierte la fecha', async () => {
    const f = fakeFetch({ 'https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF43718/datos/oportuno': { body: { bmx: { series: [{ idSerie: 'SF43718', datos: [{ fecha: '10/10/2026', dato: '18.4321' }] }] } } } })
    const q = await new BanxicoProvider('TOKEN', f).latest(NOW)
    expect(q).toEqual({ base: 'USD', quote: 'MXN', rate: 18.4321, fecha: '2026-10-10', fuente: 'banxico' })
    expect(f.calls[0]!.init?.headers?.['Bmx-Token']).toBe('TOKEN')
    expect(() => new BanxicoProvider('')).toThrow(/BANXICO_TOKEN/)
  })

  it('Frankfurter lee latest?base=USD&symbols=MXN', async () => {
    const f = fakeFetch({ 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=MXN': { body: { date: '2026-10-10', rates: { MXN: 18.5 } } } })
    const q = await new FrankfurterProvider(f).latest(NOW)
    expect(q.rate).toBe(18.5)
    expect(q.fuente).toBe('frankfurter')
    const sin = fakeFetch({ 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=MXN': { body: { date: '2026-10-10', rates: {} } } })
    await expect(new FrankfurterProvider(sin).latest(NOW)).rejects.toThrow(/MXN/)
  })

  it('el proveedor fijo siempre responde y se marca como fijo', async () => {
    const q = await new FixedProvider(18.5).latest(NOW)
    expect(q.fuente).toBe('fijo')
    expect(q.fecha).toBe('2026-10-11')
  })
})
