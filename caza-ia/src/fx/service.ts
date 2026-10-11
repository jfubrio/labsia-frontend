import type { Db } from '../db/client.js'
import { num } from '../db/client.js'
import type { Env } from '../config/env.js'
import type { HttpFetch } from '../connectors/http.js'
import { BanxicoProvider, FrankfurterProvider, FixedProvider, type FxProvider, type FxQuote } from './providers.js'
import { defaultComparisonConfig, type ComparisonConfig } from '../engines/international-comparison.js'

export interface ResolvedRate extends FxQuote {
  /** true si el dato no es de hoy (caché de días anteriores) o es el valor fijo. */
  stale: boolean
  obtenidoEn: string
}

const MAX_CACHE_DAYS = 7

export async function getCachedRate(db: Db, now: Date): Promise<ResolvedRate | null> {
  const { rows } = await db.query(
    `SELECT fecha, tasa, fuente, obtenido_en FROM caza_fx_rates
      WHERE base = 'USD' AND quote = 'MXN' AND fuente <> 'fijo' AND fecha >= ($1::date - $2::int)
      ORDER BY fecha DESC, CASE fuente WHEN 'banxico' THEN 0 ELSE 1 END LIMIT 1`,
    [now, MAX_CACHE_DAYS],
  )
  const r = rows[0]
  if (!r) return null
  const fecha = new Date(r.fecha).toISOString().slice(0, 10)
  return { base: 'USD', quote: 'MXN', rate: num(r.tasa)!, fecha, fuente: r.fuente, stale: fecha !== now.toISOString().slice(0, 10), obtenidoEn: new Date(r.obtenido_en).toISOString() }
}

export async function storeRate(db: Db, q: FxQuote, now: Date): Promise<void> {
  await db.query(
    `INSERT INTO caza_fx_rates (fecha, base, quote, tasa, fuente, obtenido_en) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (fecha, base, quote, fuente) DO UPDATE SET tasa = EXCLUDED.tasa, obtenido_en = EXCLUDED.obtenido_en`,
    [q.fecha, q.base, q.quote, q.rate, q.fuente, now],
  )
}

/** Proveedores en orden de preferencia según el entorno: Banxico (si hay token) → Frankfurter → fijo. */
export function providersFrom(env: Env, fetchImpl?: HttpFetch): FxProvider[] {
  const list: FxProvider[] = []
  if (env.BANXICO_TOKEN) list.push(new BanxicoProvider(env.BANXICO_TOKEN, fetchImpl))
  if (env.FRANKFURTER_URL) list.push(new FrankfurterProvider(fetchImpl, env.FRANKFURTER_URL))
  list.push(new FixedProvider(env.USD_MXN_RATE))
  return list
}

/**
 * Tipo de cambio del día: caché de hoy → proveedores en orden (se guarda el primero que responda) → caché de hasta
 * 7 días (marcada como desactualizada) → valor fijo del entorno (marcado como 'fijo'). Nunca lanza: siempre hay un
 * tipo de cambio con su procedencia, y la procedencia queda a la vista del operador.
 */
export async function resolveRate(db: Db, providers: FxProvider[], now: Date = new Date()): Promise<ResolvedRate> {
  const cached = await getCachedRate(db, now)
  if (cached && !cached.stale) return cached
  for (const p of providers) {
    if (p.fuente === 'fijo') continue
    try {
      const q = await p.latest(now)
      await storeRate(db, q, now)
      return { ...q, stale: q.fecha !== now.toISOString().slice(0, 10), obtenidoEn: now.toISOString() }
    } catch {
      // siguiente proveedor
    }
  }
  if (cached) return cached
  const fixed = providers.find((p) => p.fuente === 'fijo')
  if (!fixed) throw new Error('CAZA: sin tipo de cambio disponible y sin valor fijo')
  const q = await fixed.latest(now)
  return { ...q, stale: true, obtenidoEn: now.toISOString() }
}

/** Configuración de comparación con el tipo de cambio resuelto (fase 4) en lugar del fijo de fase 1. */
export async function comparisonWithLiveRate(db: Db, env: Env, now: Date = new Date(), fetchImpl?: HttpFetch): Promise<{ comparison: ComparisonConfig; rate: ResolvedRate }> {
  const rate = await resolveRate(db, providersFrom(env, fetchImpl), now)
  return { comparison: defaultComparisonConfig(rate.rate), rate }
}
