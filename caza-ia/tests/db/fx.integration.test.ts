import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createDb, type Db } from '../../src/db/client.js'
import { resetTestState } from './reset.js'
import { resolveRate, getCachedRate, comparisonWithLiveRate } from '../../src/fx/service.js'
import { BanxicoProvider, FrankfurterProvider, FixedProvider } from '../../src/fx/providers.js'
import { fakeFetch } from '../../src/connectors/http.js'
import { loadEnv } from '../../src/config/env.js'

/** Fase 4: cadena de resolución del tipo de cambio con caché en PostgreSQL. Requiere DATABASE_URL. */
const url = process.env.DATABASE_URL
const d = url ? describe : describe.skip

d('tipo de cambio con caché', () => {
  let db: Db
  const NOW = new Date('2026-10-11T12:00:00Z')
  const banxicoOk = fakeFetch({ 'https://www.banxico.org.mx': { body: { bmx: { series: [{ idSerie: 'SF43718', datos: [{ fecha: '11/10/2026', dato: '18.2500' }] }] } } } })
  const banxicoCaido = fakeFetch({ 'https://www.banxico.org.mx': { status: 500, body: 'caído' } })
  const frankfurter = fakeFetch({ 'https://api.frankfurter.dev': { body: { date: '2026-10-11', rates: { MXN: 18.6 } } } })

  beforeAll(async () => {
    db = createDb(url)
    await resetTestState(db, NOW)
    await db.query('TRUNCATE caza_fx_rates')
  })
  afterAll(async () => {
    await db.end()
  })

  it('sin caché usa el primer proveedor que responde y lo guarda', async () => {
    const r = await resolveRate(db, [new BanxicoProvider('T', banxicoOk), new FrankfurterProvider(frankfurter), new FixedProvider(18.5)], NOW)
    expect(r.fuente).toBe('banxico')
    expect(r.rate).toBe(18.25)
    expect(r.stale).toBe(false)
    expect((await getCachedRate(db, NOW))?.rate).toBe(18.25)
  })

  it('con caché de hoy no vuelve a llamar a ningún proveedor', async () => {
    const llamadas = banxicoOk.calls.length
    const r = await resolveRate(db, [new BanxicoProvider('T', banxicoOk)], NOW)
    expect(r.rate).toBe(18.25)
    expect(banxicoOk.calls.length).toBe(llamadas)
  })

  it('si Banxico falla cae a Frankfurter; si todo falla usa la caché reciente; sin caché usa el fijo', async () => {
    const manana = new Date('2026-10-12T12:00:00Z')
    const r1 = await resolveRate(db, [new BanxicoProvider('T', banxicoCaido), new FrankfurterProvider(fakeFetch({ 'https://api.frankfurter.dev': { body: { date: '2026-10-12', rates: { MXN: 18.6 } } } })), new FixedProvider(18.5)], manana)
    expect(r1.fuente).toBe('frankfurter')
    expect(r1.rate).toBe(18.6)

    const pasado = new Date('2026-10-13T12:00:00Z')
    const r2 = await resolveRate(db, [new BanxicoProvider('T', banxicoCaido), new FrankfurterProvider(banxicoCaido), new FixedProvider(18.5)], pasado)
    expect(r2.stale).toBe(true)
    expect(r2.fuente).toBe('frankfurter') // la caché más reciente (12/10), marcada como desactualizada
    expect(r2.rate).toBe(18.6)

    await db.query('TRUNCATE caza_fx_rates')
    const r3 = await resolveRate(db, [new BanxicoProvider('T', banxicoCaido), new FixedProvider(18.5)], pasado)
    expect(r3.fuente).toBe('fijo')
    expect(r3.stale).toBe(true)
    expect(await getCachedRate(db, pasado)).toBeNull() // el fijo no se guarda
  })

  it('comparisonWithLiveRate construye la configuración con el tipo de cambio resuelto', async () => {
    const env = loadEnv({ USD_MXN_RATE: '17.9', FRANKFURTER_URL: '' })
    const { comparison, rate } = await comparisonWithLiveRate(db, env, NOW)
    expect(rate.fuente).toBe('fijo')
    expect(comparison.rates.USD).toBe(17.9)
  })
})
