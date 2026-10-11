import type { Db } from '../client.js'
import type { MarketPriceProfile } from '../../engines/market-price.js'

export async function insertProfile(db: Db, productId: string, p: MarketPriceProfile): Promise<string> {
  const { rows } = await db.query(
    `INSERT INTO caza_market_price_profiles
       (product_id, mercado, moneda, calculado_en, ventana_dias, precio_real, mediana_ponderada, mediana_reciente, mediana_anterior,
        piso, techo, tendencia_pct, regimen, lanzamiento_inflado, confianza, dias_cubiertos, dias_observados, muestras, tiendas, serie, notas)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     RETURNING id`,
    [
      productId, p.market, p.currency, p.calculadoEn, p.ventanaDias, p.precioReal, p.medianaPonderada, p.medianaReciente, p.medianaAnterior,
      p.piso, p.techo, p.tendenciaPct, p.regimen, p.lanzamientoInflado, p.confianza, p.diasCubiertos, p.diasObservados, p.muestras, p.tiendas,
      JSON.stringify(p.serie), p.notas,
    ],
  )
  return rows[0].id as string
}

export interface LatestProfileRow {
  calculado_en: Date
  mercado: string
  precio_real: string | null
  piso: string | null
  regimen: string | null
  confianza: string
  dias_observados: number
}

export async function latestProfile(db: Db, productId: string, market: string): Promise<LatestProfileRow | null> {
  const { rows } = await db.query(
    `SELECT calculado_en, mercado, precio_real, piso, regimen, confianza, dias_observados
       FROM caza_market_price_profiles WHERE product_id = $1 AND mercado = $2 ORDER BY calculado_en DESC LIMIT 1`,
    [productId, market],
  )
  return (rows[0] as LatestProfileRow | undefined) ?? null
}
