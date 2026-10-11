import type { Db } from '../db/client.js'
import type { PriceConnector } from '../connectors/types.js'
import type { ProductRow } from '../db/repositories/products.repo.js'
import { connectorIdsByClave, buzonIdByClave } from '../db/repositories/products.repo.js'
import { insertObservation, listHistory } from '../db/repositories/observations.repo.js'
import { insertProfile } from '../db/repositories/profiles.repo.js'
import { insertVerdict } from '../db/repositories/verdicts.repo.js'
import { insertProposal, expireStaleProposals } from '../db/repositories/proposals.repo.js'
import { startRun, finishRun } from '../db/repositories/runs.repo.js'
import { insertAudit } from '../db/repositories/audit.repo.js'
import { toObservation } from '../engines/ingest.js'
import { buildMarketPriceProfile, MARKET_PRICE_DEFAULTS, type MarketPriceProfile } from '../engines/market-price.js'
import { validateDiscountWithProfile } from '../engines/discount-validator.js'
import { proposePurchase } from '../engines/authorization.js'
import type { ComparisonConfig } from '../engines/international-comparison.js'
import type { Market, Currency, PriceObservation } from '../types.js'
import { notifyAll, proposalNotification, type Notifier } from '../notify/notifier.js'
import { recordNotifications } from '../db/repositories/notifications.repo.js'

export interface WatchDeps {
  db: Db
  connectors: PriceConnector[]
  comparison: ComparisonConfig
  now?: Date
  disparador?: 'scheduler' | 'manual'
  /** Canales de alerta al operador. Sin canales no se alerta (pruebas unitarias); con ellos cada envío queda registrado. */
  notifiers?: Notifier[]
}

export interface WatchResult {
  runId: string
  observaciones: number
  veredictos: number
  propuestas: number
  alertas: number
  perfiles: Record<string, MarketPriceProfile>
}

const currencyFor = (market: Market): Currency => (market === 'US' ? 'USD' : 'MXN')

/**
 * Un ciclo de vigilancia para un producto:
 *  1. pide ofertas a cada conector usable de sus mercados y las persiste como observaciones;
 *  2. recalcula el perfil de precio real por mercado con el historial de la base de datos (no con el del conector);
 *  3. juzga cada observación nueva contra el perfil de su mercado y persiste el veredicto;
 *  4. si procede, registra una propuesta pendiente de approve (una sola pendiente por producto).
 * Nunca compra: eso es del ejecutor, en fase 6, con autorización.
 */
export async function runWatch(product: ProductRow, deps: WatchDeps): Promise<WatchResult> {
  const now = deps.now ?? new Date()
  const { db } = deps
  const connectorIds = await connectorIdsByClave(db)
  const runId = await startRun(db, product.id, deps.disparador ?? 'manual', deps.connectors.map((c) => c.meta.clave))

  try {
    // 1. Observar
    const nuevas: PriceObservation[] = []
    for (const connector of deps.connectors) {
      const connectorId = connectorIds.get(connector.meta.clave)
      if (!connectorId) throw new Error(`CAZA: el conector '${connector.meta.clave}' no está en caza_connectors`)
      const offers = await connector.fetchOffers(product.slug, now)
      for (const raw of offers) {
        if (!product.mercados.includes(raw.market)) continue
        const obs = toObservation(product.slug, raw)
        await insertObservation(db, product.id, connectorId, obs)
        nuevas.push(obs)
      }
    }

    // 2. Perfil por mercado, con el historial persistido
    const perfiles: Record<string, MarketPriceProfile> = {}
    const profileIds: Record<string, string> = {}
    for (const market of product.mercados) {
      const currency = currencyFor(market)
      const history = await listHistory(db, product.id, market, currency, MARKET_PRICE_DEFAULTS.windowDays, now)
      const profile = buildMarketPriceProfile(history, { now, market, currency })
      perfiles[market] = profile
      profileIds[market] = await insertProfile(db, product.id, profile)
    }
    const homeProfile = perfiles[product.mercados.find((m) => currencyFor(m) === product.monedaBase) ?? 'MX'] ?? null

    // 3. Veredictos y 4. propuestas. Antes, las propuestas vencidas sin respuesta expiran para no bloquear una nueva.
    const expiradas = await expireStaleProposals(db, product.id, now)
    let alertas = 0
    if (expiradas > 0) {
      await insertAudit(db, product.id, { ocurridoEn: now, actor: 'sistema', evento: 'proposal.expired', productSlug: product.slug, payload: { expiradas } })
      alertas += await alert(deps, product.id, now, {
        evento: 'proposal.expired',
        titulo: `CAZA IA: propuesta expirada para ${product.nombre}`,
        cuerpo: `${expiradas} propuesta(s) vencieron sin respuesta. Si la oferta sigue, la vigilancia propondrá de nuevo.`,
        productSlug: product.slug,
      })
    }
    let veredictos = 0
    let propuestas = 0
    for (const obs of nuevas) {
      const profile = perfiles[obs.market]
      if (!profile) continue
      // El perfil incluye la observación recién insertada; se juzga contra el resto del historial.
      const verdict = validateDiscountWithProfile(obs, profile, product)
      const verdictId = await insertVerdict(db, verdict, profileIds[obs.market] ?? null)
      veredictos++

      const proposal = proposePurchase(obs, verdict, product, homeProfile, deps.comparison)
      if (!proposal) continue
      const buzonId = proposal.buzon ? await buzonIdByClave(db, proposal.buzon) : null
      const proposalId = await insertProposal(db, product.id, verdictId, buzonId, proposal, now)
      if (proposalId) {
        propuestas++
        await insertAudit(db, product.id, {
          ocurridoEn: now,
          actor: 'sistema',
          evento: 'proposal.created',
          productSlug: product.slug,
          payload: { proposalId, observationId: obs.id, precio: obs.price, moneda: obs.currency, precioAterrizadoBase: proposal.precioAterrizadoBase, buzon: proposal.buzon, veredicto: verdict.veredicto },
        })
        alertas += await alert(deps, product.id, now, proposalNotification({
          productSlug: product.slug,
          productNombre: product.nombre,
          precio: obs.price,
          moneda: obs.currency,
          precioAterrizadoBase: proposal.precioAterrizadoBase,
          monedaBase: proposal.monedaBase,
          buzon: proposal.buzon,
          veredicto: verdict.veredicto,
          tienda: obs.store ?? obs.connector,
          expiraEn: new Date(now.getTime() + 24 * 3_600_000),
          proposalId,
        }))
      }
    }

    await finishRun(db, runId, { observaciones: nuevas.length, veredictos, propuestas })
    return { runId, observaciones: nuevas.length, veredictos, propuestas, alertas, perfiles }
  } catch (err) {
    await finishRun(db, runId, { observaciones: 0, veredictos: 0, propuestas: 0, error: (err as Error).message })
    await alert(deps, product.id, now, {
      evento: 'watch.error',
      titulo: `CAZA IA: falló la vigilancia de ${product.nombre}`,
      cuerpo: (err as Error).message,
      productSlug: product.slug,
    })
    throw err
  }
}

/** Envía a todos los canales configurados y registra cada resultado. Nunca lanza: una alerta fallida no detiene la vigilancia. */
async function alert(deps: WatchDeps, productId: string, now: Date, n: Parameters<typeof notifyAll>[1]): Promise<number> {
  if (!deps.notifiers || deps.notifiers.length === 0) return 0
  const outcomes = await notifyAll(deps.notifiers, n)
  try {
    await recordNotifications(deps.db, productId, n, outcomes, now)
  } catch {
    // registrar la alerta no debe tumbar la corrida
  }
  return outcomes.filter((o) => o.estado === 'enviada').length
}
